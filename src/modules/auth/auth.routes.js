import { Router } from 'express';
import {
  loginHandler,
  changePasswordHandler,
  saveDeviceHandler,
  listDevicesHandler,
} from './auth.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.post('/login', loginHandler);
router.patch('/password', authenticate, requireRole('admin'), changePasswordHandler);
router.post('/device', authenticate, requireRole('admin'), saveDeviceHandler);
router.get('/devices', authenticate, requireRole('admin'), listDevicesHandler);

export default router;
