import multer from 'multer';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('image must be png, jpeg, webp, or gif'));
    }
    cb(null, true);
  },
});

// wraps multer so file-too-large / wrong-type errors come back as a clean
// 400 with a readable message, instead of falling through to the generic 500 handler
export function uploadSingle(fieldName) {
  const handler = upload.single(fieldName);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message || 'Invalid file upload' });
      next();
    });
  };
}
