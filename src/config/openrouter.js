import OpenAI from 'openai';

// fall back to a placeholder so a missing key fails per-request (a clean
// 401 from OpenRouter) instead of crashing the whole app at import time
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'missing-openrouter-api-key',
  defaultHeaders: {
    'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5173',
    'X-Title': process.env.SITE_NAME || 'Portfolio',
  },
});

// NOT 'openrouter/free' — that's a load-balanced alias across ALL free models,
// including reasoning models (burn their token budget on hidden reasoning
// before ever writing a real answer), coding-agent models, and even a content-
// moderation classifier. Pin to one actual general-purpose instruct model.
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'nvidia/nemotron-nano-9b-v2:free';
