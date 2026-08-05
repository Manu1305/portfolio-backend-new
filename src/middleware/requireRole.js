// requireRole('admin') for a single role, or requireRole(['admin', 'member'])
// to allow any one of several roles
export default function requireRole(role) {
  const allowed = Array.isArray(role) ? role : [role];
  return (req, res, next) => {
    if (!allowed.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
