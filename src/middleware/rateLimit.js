import { rateLimit } from 'express-rate-limit';

// Per-IP limiter factory. app.js sets 'trust proxy' so req.ip is the real
// client behind Render's proxy. Blocked requests get the same { error } JSON
// shape as every other error in the API.
export function createLimiter({ windowMs, max, message = 'Too many requests, please try again later.' }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}
