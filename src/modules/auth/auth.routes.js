import { Router } from 'express';
import {
  loginHandler,
  changePasswordHandler,
  saveDeviceHandler,
  listDevicesHandler,
} from './auth.controller.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();

router.post('/login', loginHandler);
router.patch('/password', authenticate, changePasswordHandler);
router.post('/device', authenticate, saveDeviceHandler);
router.get('/devices', authenticate, listDevicesHandler);

export default router;
