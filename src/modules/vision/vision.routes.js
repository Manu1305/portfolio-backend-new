import { Router } from 'express';
import { createLimiter } from '../../middleware/rateLimit.js';
import { uploadSingle } from '../../middleware/upload.js';
import { visionStream } from './vision.controller.js';

const router = Router();

// public endpoint — the limiter runs before multer so blocked requests are
// rejected without buffering the upload
const visionLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "You've hit the AI Studio limit (10 images per 15 minutes). Try again in a bit.",
});

router.post('/stream', visionLimiter, uploadSingle('image'), visionStream);

export default router;
