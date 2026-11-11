import { Jimp, JimpMime } from 'jimp';
import { openrouter as client, OPENROUTER_VISION_MODELS as MODELS } from '../../config/openrouter.js';

// generous — free models can spend tokens on hidden reasoning before answering
const MAX_TOKENS = 1500;
const MAX_DIMENSION = 1024;
const FIRST_TOKEN_TIMEOUT_MS = 45_000;

const SYSTEM_PROMPT = `You are the AI Image Studio on a personal portfolio website. A visitor has
uploaded an image and chosen a mode. Follow the mode's instructions exactly. Reply in plain text
(light markdown like **bold** or short lists is fine), with no preamble such as "Sure!" or
"Here is". Never identify real people by name from their face. Keep everything friendly and
safe for work; if the image is explicit or harmful, politely decline instead.`;

export const MODES = {
  describe: {
    label: 'Describe',
    prompt:
      'Describe this image vividly in 3-5 sentences: the subject, setting, colors, lighting, mood, and any interesting details someone might miss at first glance.',
  },
  alttext: {
    label: 'Alt text',
    prompt:
      'Write accessible alt text for this image: one concise sentence (under 125 characters) a screen reader would read. Then, on a new line starting with "Long description:", give a 2-3 sentence detailed description.',
  },
  roast: {
    label: 'Roast',
    prompt:
      'Give this image a playful, witty roast in 3-5 short punchy lines, like a friendly comedian. Roast the composition, the vibe, the choices, the background clutter. Never mock anyone\'s body, weight, skin, race, gender, age, disability, or other personal traits. Keep it good-natured, then end with one genuine compliment.',
  },
  story: {
    label: 'Story',
    prompt:
      'Write a short, imaginative story (about 150 words) inspired by this image. Give it a title on the first line in bold.',
  },
  poem: {
    label: 'Poem',
    prompt:
      'Write a short poem (8-12 lines) inspired by this image, capturing its mood and details. Give it a title on the first line in bold.',
  },
  ocr: {
    label: 'Read text',
    prompt:
      'Extract all readable text in this image exactly as written, preserving line breaks and order. If there is no readable text, say "No readable text found." and briefly say what the image shows instead.',
  },
};

export function isValidMode(mode) {
  return typeof mode === 'string' && Object.hasOwn(MODES, mode);
}

// Downscale + re-encode as JPEG so the model gets a small, uniform payload
// (fewer tokens, faster replies). GIFs become their first frame. Jimp can't
// decode WebP, so those (already capped at 5MB by multer) pass through as-is.
export async function prepareImage(buffer, mimetype) {
  if (mimetype === 'image/webp') {
    return `data:image/webp;base64,${buffer.toString('base64')}`;
  }

  let img;
  try {
    img = await Jimp.read(buffer);
  } catch {
    const err = new Error('could not read that image — try a different file');
    err.status = 400;
    throw err;
  }
  if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
    img.scaleToFit({ w: MAX_DIMENSION, h: MAX_DIMENSION });
  }
  // JPEG has no alpha — flatten onto white so transparent areas don't turn black
  const flat = new Jimp({ width: img.width, height: img.height, color: 0xffffffff });
  flat.composite(img, 0, 0);
  const jpeg = await flat.getBuffer(JimpMime.jpeg, { quality: 85 });
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

// Single streaming completion: no tools, no loop. Images are never persisted.
// Free models sometimes hang without ever sending a token, so if nothing
// arrives within FIRST_TOKEN_TIMEOUT_MS we abort and report the model as busy.
// Once text is flowing there's no cap beyond max_tokens.
export async function streamVisionReply({ mode, imageDataUrl }, { onText, signal }) {
  const timeoutCtl = new AbortController();
  const timer = setTimeout(() => timeoutCtl.abort(), FIRST_TOKEN_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeoutCtl.signal]) : timeoutCtl.signal;

  try {
    await runStream({ mode, imageDataUrl }, { onText, signal: combined, onFirstToken: () => clearTimeout(timer) });
  } catch (err) {
    if (timeoutCtl.signal.aborted && !signal?.aborted) {
      const busy = new Error('the model took too long to respond');
      busy.status = 429; // surfaced to the client as "busy"
      throw busy;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function runStream({ mode, imageDataUrl }, { onText, signal, onFirstToken }) {
  const stream = await client.chat.completions.create(
    {
      model: MODELS[0],
      // OpenRouter-specific: tried in order if the previous one errors / is rate-limited
      ...(MODELS.length > 1 && { models: MODELS }),
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: MODES[mode].prompt },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    },
    { signal }
  );

  let sawText = false;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content;
    if (delta) {
      if (!sawText) onFirstToken();
      sawText = true;
      onText(delta);
    }
  }

  if (!sawText && !signal?.aborted) {
    const err = new Error('the model returned an empty reply');
    err.status = 502;
    throw err;
  }
}
