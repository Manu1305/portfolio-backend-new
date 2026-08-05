import { Router } from 'express';
import {
  googleAuthHandler,
  getMeHandler,
  updateMeHandler,
  uploadAvatarHandler,
  listMembersHandler,
} from './member.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';
import { uploadSingle } from '../../middleware/upload.js';

const router = Router();

router.post('/google', googleAuthHandler);
router.get('/me', authenticate, requireRole('member'), getMeHandler);
router.post('/me', authenticate, requireRole('member'), updateMeHandler);
router.post('/me/avatar', authenticate, requireRole('member'), uploadSingle('avatar'), uploadAvatarHandler);
router.get('/', authenticate, requireRole('admin'), listMembersHandler);

export default router;
