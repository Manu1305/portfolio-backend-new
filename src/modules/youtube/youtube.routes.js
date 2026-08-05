import { Router } from 'express';
import { getInfoHandler, downloadHandler } from './youtube.controller.js';
import authenticate from '../../middleware/authenticate.js';

const router = Router();

router.post('/info', authenticate, getInfoHandler);
router.get('/download', authenticate, downloadHandler);

export default router;
