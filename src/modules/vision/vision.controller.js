import OpenAI from 'openai';
import { MODES, isValidMode, prepareImage, streamVisionReply } from './vision.service.js';

export async function visionStream(req, res, next) {
  const mode = req.body?.mode;

  if (!req.file) return res.status(400).json({ error: 'image is required' });
  if (!isValidMode(mode)) {
    return res.status(400).json({ error: `mode must be one of: ${Object.keys(MODES).join(', ')}` });
  }

  // decode/resize before opening the stream so a bad image is a clean 400
  let imageDataUrl;
  try {
    imageDataUrl = await prepareImage(req.file.buffer, req.file.mimetype);
  } catch (err) {
    return next(err);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const controller = new AbortController();
  // see chat.controller.js — res 'close' also fires after a normal end()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    await streamVisionReply(
      { mode, imageDataUrl },
      {
        signal: controller.signal,
        onText: (textDelta) => {
          res.write(`data: ${JSON.stringify({ text: textDelta })}\n\n`);
        },
      }
    );
    if (!controller.signal.aborted) {
      res.write('event: done\ndata: {}\n\n');
    }
  } catch (err) {
    // only stay silent when the *client* went away — a server-side timeout
    // abort still needs an error event
    if (!(err instanceof OpenAI.APIUserAbortError && controller.signal.aborted)) {
      console.error(err);
      // upstream free-model pools get rate-limited; tell the client it's
      // temporary (code 'busy') rather than a generic failure
      const busy = err?.status === 429;
      res.write(
        `event: error\ndata: ${JSON.stringify({ error: busy ? 'busy' : 'stream failed' })}\n\n`
      );
    }
  } finally {
    res.end();
  }
}
