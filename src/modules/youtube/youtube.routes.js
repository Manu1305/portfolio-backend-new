import { Router } from 'express';
import { getInfoHandler, downloadHandler } from './youtube.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.post('/info', authenticate, requireRole(['admin', 'member']), getInfoHandler);
router.get('/download', authenticate, requireRole(['admin', 'member']), downloadHandler);

export default router;
