import { openrouter, OPENROUTER_MODEL } from '../../config/openrouter.js';
import Reading from './reading.model.js';

export const DISCLAIMER = 'For entertainment purposes only — not a real prediction.';

export function todayDateString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD", UTC
}

export function userKeyFromReq(user) {
  if (user.role === 'admin') return `admin:${user.username}`;
  return `member:${user.memberId}`;
}

export async function getTodaysReading(userKey) {
  return Reading.findOne({ userKey, date: todayDateString() });
}

async function generateReadingText(dob, birthTime, birthPlace) {
  const details = [`date of birth: ${dob}`, birthTime && `time of birth: ${birthTime}`, birthPlace && `place of birth: ${birthPlace}`]
    .filter(Boolean)
    .join(', ');

  const prompt = `You are a horoscope generator for a personal website's fun, entertainment-only feature — not real astrology or prediction. Given someone's birth details (${details}), write two short readings in classic horoscope style (vague enough to feel personal, specific enough to feel like a real reading).

Be honest and varied in tone — do NOT default to vague positivity. If the reading leans good, say so directly and specifically (what kind of good — opportunity, connection, a win). If it leans challenging or rough, say that directly too — a bad day should read as an actual bad day (friction, setbacks, a tough conversation), not softened into disguised positivity. Mix it up across calls: some readings should be clearly good, some clearly bad, some mixed or neutral. Keep it PG and non-alarming regardless of tone — no predictions of death, serious illness, accidents, or violence; "rough day at work" is fair game, "something terrible will happen to you" is not.

1. "yearReading": 2-3 sentences on how this year looks for them.
2. "dayReading": 1-2 sentences on how today looks for them.

Respond with ONLY valid JSON, no markdown, no extra text: {"yearReading": "...", "dayReading": "..."}`;

  const completion = await openrouter.chat.completions.create({
    model: OPENROUTER_MODEL,
    // generous budget: several free-tier models do hidden step-by-step
    // reasoning before the real answer, and that reasoning eats into
    // max_tokens too — too small a limit truncates before real content appears
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = completion.choices?.[0]?.message?.content || '';
  const match = raw.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(match ? match[0] : raw);
    if (typeof parsed.yearReading === 'string' && typeof parsed.dayReading === 'string') {
      return { yearReading: parsed.yearReading, dayReading: parsed.dayReading };
    }
  } catch {
    // fall through to the raw-text fallback below
  }

  // model didn't return clean JSON — still give the caller something usable
  return { yearReading: raw.trim() || 'The stars are quiet today.', dayReading: raw.trim() || 'The stars are quiet today.' };
}

export async function createTodaysReading(userKey, { dob, birthTime, birthPlace }) {
  const { yearReading, dayReading } = await generateReadingText(dob, birthTime, birthPlace);

  try {
    return await Reading.create({
      userKey,
      date: todayDateString(),
      dob,
      birthTime,
      birthPlace,
      yearReading,
      dayReading,
    });
  } catch (err) {
    // race: two near-simultaneous requests both passed the getTodaysReading
    // check before either had saved — the unique index catches it, just
    // return whichever one actually landed
    if (err.code === 11000) {
      return Reading.findOne({ userKey, date: todayDateString() });
    }
    throw err;
  }
}
