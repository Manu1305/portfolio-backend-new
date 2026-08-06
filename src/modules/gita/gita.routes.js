import { Router } from 'express';
import { getTodayHandler } from './gita.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.get('/today', authenticate, requireRole(['admin', 'member']), getTodayHandler);

export default router;
