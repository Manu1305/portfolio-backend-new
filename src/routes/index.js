import { Router } from 'express';
import qrcodeRoutes from '../modules/qrcode/qrcode.routes.js';

const router = Router();

// Register each app/module's routes here.
// e.g. router.use('/url-shortener', urlShortenerRoutes);
router.use('/qrcode', qrcodeRoutes);

export default router;
