import { Router } from 'express';
import qrcodeRoutes from '../modules/qrcode/qrcode.routes.js';
import chatRoutes from '../modules/chat/chat.routes.js';
import contactRoutes from '../modules/contacts/contact.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';

const router = Router();

// Register each app/module's routes here.
// e.g. router.use('/url-shortener', urlShortenerRoutes);
router.use('/qrcode', qrcodeRoutes);
router.use('/chat', chatRoutes);
router.use('/contacts', contactRoutes);
router.use('/auth', authRoutes);

export default router;
