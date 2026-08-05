import Visitor from './visitor.model.js';

const MAX_FIELD_LENGTH = 500;

function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  const addr = ip.replace(/^::ffff:/, ''); // normalize IPv4-mapped IPv6

  if (addr === '::1' || addr === '127.0.0.1' || addr.startsWith('127.')) return true;
  if (addr.startsWith('10.')) return true;
  if (addr.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return true; // 172.16.0.0–172.31.255.255

  return false;
}

// never lets a slow/failed/rate-limited external lookup block saving the visit
async function lookupIpLocation(ip) {
  if (isPrivateOrLocalIp(ip)) return null;

  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.status !== 'success') return null;

    return {
      city: data.city,
      region: data.regionName,
      country: data.country,
      lat: data.lat,
      lon: data.lon,
    };
  } catch {
    return null;
  }
}

function truncate(value) {
  if (typeof value !== 'string') return value;
  return value.slice(0, MAX_FIELD_LENGTH);
}

export async function trackVisit(data) {
  const ipLocation = await lookupIpLocation(data.ip);

  return Visitor.create({
    ip: data.ip,
    ipLocation,
    preciseLocation: data.preciseLocation,
    locationPermission: data.locationPermission,
    userAgent: truncate(data.userAgent),
    referrer: truncate(data.referrer),
    path: truncate(data.path),
    language: truncate(data.language),
    timezone: truncate(data.timezone),
    screenWidth: data.screenWidth,
    screenHeight: data.screenHeight,
  });
}

export async function listVisitors({ page, limit }) {
  const skip = (page - 1) * limit;

  const [visitors, total] = await Promise.all([
    Visitor.find().sort({ visitedAt: -1 }).skip(skip).limit(limit),
    Visitor.countDocuments(),
  ]);

  return { visitors, total };
}
