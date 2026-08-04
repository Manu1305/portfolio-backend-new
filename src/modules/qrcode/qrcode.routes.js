import { Router } from 'express';
import { createQrCode, downloadQrCode } from './qrcode.controller.js';

const router = Router();

router.post('/', createQrCode);
router.get('/download', downloadQrCode);

export default router;
