import { Router } from 'express';
import { getOrCreateReadingHandler, getTodayHandler } from './horoscope.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.post('/', authenticate, requireRole(['admin', 'member']), getOrCreateReadingHandler);
router.get('/today', authenticate, requireRole(['admin', 'member']), getTodayHandler);

export default router;
