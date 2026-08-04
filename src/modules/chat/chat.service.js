import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import OpenAI from 'openai';
import { saveContact } from '../contacts/contact.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const aboutMe = readFileSync(join(__dirname, 'aboutme.md'), 'utf8');

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  // fall back to a placeholder so a missing key fails per-request (a clean
  // 401 from OpenRouter) instead of crashing the whole app at import time
  apiKey: process.env.OPENROUTER_API_KEY || 'missing-openrouter-api-key',
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5173',
    'X-Title': process.env.SITE_NAME || 'Portfolio',
  },
});

const MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const MAX_TOKENS = 1024;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_TOOL_TURNS = 4;

const ASSISTANT_NAME = 'Adima';

const SYSTEM_PROMPT = `Your name is ${ASSISTANT_NAME}, the AI assistant embedded in this personal
portfolio website. If asked who you are or what your name is, introduce yourself as ${ASSISTANT_NAME}.
Answer questions about the portfolio owner's projects, skills, background, and experience helpfully
and concisely, using ONLY the facts in ABOUT_ME below. If something isn't covered there, say you
don't have that information rather than guessing or making it up. Client project names are
confidential — if asked for a specific client's name, explain that project details are shared but
client identities are kept private.

ABOUT_ME:
${aboutMe}

If the visitor shares both their name and a physical address in the conversation, call the
save_contact_info tool to store it. Only call it once you have both a name and an address — not for
a name or address alone. Don't ask the visitor to repeat information they already gave you, and don't
call the tool more than once for the same person in a conversation.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'save_contact_info',
      description:
        "Save a visitor's contact info once they have provided BOTH their name and a physical/mailing address in this conversation. Optionally include email and phone if those were also given.",
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: "The visitor's full name" },
          address: { type: 'string', description: "The visitor's full mailing address" },
          email: { type: 'string', description: "The visitor's email address, if given" },
          phone: { type: 'string', description: "The visitor's phone number, if given" },
        },
        required: ['name', 'address'],
      },
    },
  },
];

export function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return 'messages is required and must be a non-empty array';
  }
  if (messages.length > MAX_MESSAGES) {
    return `messages must contain ${MAX_MESSAGES} or fewer entries`;
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) {
      return `messages[${i}].role must be "user" or "assistant"`;
    }
    if (typeof m.content !== 'string' || m.content.trim().length === 0) {
      return `messages[${i}].content is required`;
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return `messages[${i}].content must be ${MAX_MESSAGE_LENGTH} characters or fewer`;
    }
  }
  if (messages[0].role !== 'user') {
    return 'the first message must have role "user"';
  }
  return null;
}

async function runTool(name, args) {
  if (name === 'save_contact_info') {
    try {
      await saveContact(args);
      return 'Saved.';
    } catch (err) {
      console.error('Failed to save contact:', err);
      return 'Failed to save contact info due to a server error.';
    }
  }
  return `Unknown tool: ${name}`;
}

// Streams the assistant's reply, running any tool calls (e.g. saving contact
// info) and continuing the conversation until the model produces a final answer.
export async function streamChatReply(messages, { onText, signal }) {
  const conversation = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map(({ role, content }) => ({ role, content })),
  ];

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    if (signal?.aborted) return;

    const stream = await client.chat.completions.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: conversation,
        tools: TOOLS,
        stream: true,
      },
      { signal }
    );

    let text = '';
    const toolCallsByIndex = {};
    let finishReason = null;

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) finishReason = choice.finish_reason;

      if (choice.delta?.content) {
        text += choice.delta.content;
        onText(choice.delta.content);
      }

      for (const tc of choice.delta?.tool_calls || []) {
        const entry = (toolCallsByIndex[tc.index] ??= { id: '', name: '', arguments: '' });
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
      }
    }

    const toolCalls = Object.values(toolCallsByIndex);

    const assistantMessage = { role: 'assistant', content: text || null };
    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      }));
    }
    conversation.push(assistantMessage);

    if (finishReason !== 'tool_calls' || toolCalls.length === 0) return;

    for (const tc of toolCalls) {
      let args = {};
      try {
        args = JSON.parse(tc.arguments || '{}');
      } catch {
        // malformed arguments — proceed with an empty object, runTool will
        // fail validation naturally if required fields are missing
      }
      const result = await runTool(tc.name, args);
      conversation.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }
  }
}
