export default function apiKeyAuth(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!process.env.ADMIN_API_KEY) {
    return res.status(500).json({ error: 'Server misconfiguration: ADMIN_API_KEY is not set' });
  }
  if (key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
