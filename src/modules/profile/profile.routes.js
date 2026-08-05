import { Router } from 'express';
import { getProfileHandler, upsertProfileHandler, uploadAvatarHandler } from './profile.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';
import { uploadSingle } from '../../middleware/upload.js';

const router = Router();

router.get('/', authenticate, requireRole('admin'), getProfileHandler);
router.post('/', authenticate, requireRole('admin'), upsertProfileHandler);
router.post('/avatar', authenticate, requireRole('admin'), uploadSingle('avatar'), uploadAvatarHandler);

export default router;
