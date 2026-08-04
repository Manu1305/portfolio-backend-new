import OpenAI from 'openai';
import { validateMessages, streamChatReply } from './chat.service.js';

export async function chatStream(req, res) {
  const { messages } = req.body || {};

  const error = validateMessages(messages);
  if (error) return res.status(400).json({ error });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const controller = new AbortController();
  // req 'close' fires as soon as the request body finishes being read — not
  // when the client disconnects. res 'close' fires on real disconnects too,
  // but also after a normal res.end(), so guard with writableEnded.
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    await streamChatReply(messages, {
      signal: controller.signal,
      onText: (textDelta) => {
        res.write(`data: ${JSON.stringify({ text: textDelta })}\n\n`);
      },
    });
    if (!controller.signal.aborted) {
      res.write('event: done\ndata: {}\n\n');
    }
  } catch (err) {
    if (!(err instanceof OpenAI.APIUserAbortError)) {
      console.error(err);
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'stream failed' })}\n\n`);
    }
  } finally {
    res.end();
  }
}
