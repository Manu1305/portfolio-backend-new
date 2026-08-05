import { trackVisit, listVisitors } from './visitor.service.js';

const MAX_LIMIT = 200;
const LOCATION_PERMISSION_VALUES = ['granted', 'denied', 'unavailable', 'not_requested'];

// coerces/drops anything that could otherwise throw a Mongoose cast or
// validation error — this endpoint must never hard-fail a visitor's page
// load over a malformed field, only over a genuinely missing path
function toSafeString(value) {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : String(value);
}

function toSafeNumber(value) {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function toSafePreciseLocation(value) {
  if (!value || typeof value !== 'object') return undefined;
  const latitude = toSafeNumber(value.latitude);
  const longitude = toSafeNumber(value.longitude);
  if (latitude === undefined || longitude === undefined) return undefined;
  return { latitude, longitude, accuracy: toSafeNumber(value.accuracy) };
}

function toSafeLocationPermission(value) {
  return LOCATION_PERMISSION_VALUES.includes(value) ? value : 'not_requested';
}

export async function trackHandler(req, res, next) {
  try {
    const body = req.body || {};

    if (typeof body.path !== 'string' || body.path.trim().length === 0) {
      return res.status(400).json({ error: 'path is required' });
    }

    await trackVisit({
      ip: req.ip,
      userAgent: toSafeString(req.headers['user-agent']),
      referrer: toSafeString(body.referrer),
      path: body.path,
      language: toSafeString(body.language),
      timezone: toSafeString(body.timezone),
      screenWidth: toSafeNumber(body.screenWidth),
      screenHeight: toSafeNumber(body.screenHeight),
      preciseLocation: toSafePreciseLocation(body.preciseLocation),
      locationPermission: toSafeLocationPermission(body.locationPermission),
    });

    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listVisitorsHandler(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const { visitors, total } = await listVisitors({ page, limit });
    res.json({ visitors, total });
  } catch (err) {
    next(err);
  }
}
