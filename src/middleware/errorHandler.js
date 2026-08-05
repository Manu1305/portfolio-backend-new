export default function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
}
