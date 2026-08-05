import { DISCLAIMER, userKeyFromReq, getTodaysReading, createTodaysReading } from './horoscope.service.js';

function validatePayload(body) {
  if (typeof body.dob !== 'string' || body.dob.trim().length === 0) {
    return 'dob is required';
  }
  if (Number.isNaN(Date.parse(body.dob))) {
    return 'dob must be a valid date';
  }
  for (const field of ['birthTime', 'birthPlace']) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return `${field} must be a string`;
    }
    if (typeof body[field] === 'string' && body[field].length > 200) {
      return `${field} must be 200 characters or fewer`;
    }
  }
  return null;
}

export async function getOrCreateReadingHandler(req, res, next) {
  try {
    const body = req.body || {};
    const error = validatePayload(body);
    if (error) return res.status(400).json({ error });

    const userKey = userKeyFromReq(req.user);

    const existing = await getTodaysReading(userKey);
    if (existing) {
      return res.json({ reading: existing, cached: true, disclaimer: DISCLAIMER });
    }

    const reading = await createTodaysReading(userKey, {
      dob: body.dob,
      birthTime: body.birthTime,
      birthPlace: body.birthPlace,
    });
    res.status(201).json({ reading, cached: false, disclaimer: DISCLAIMER });
  } catch (err) {
    next(err);
  }
}

export async function getTodayHandler(req, res, next) {
  try {
    const userKey = userKeyFromReq(req.user);
    const reading = await getTodaysReading(userKey);
    res.json({ reading, disclaimer: DISCLAIMER });
  } catch (err) {
    next(err);
  }
}
