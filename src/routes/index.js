import { Router } from 'express';
import qrcodeRoutes from '../modules/qrcode/qrcode.routes.js';
import chatRoutes from '../modules/chat/chat.routes.js';
import contactRoutes from '../modules/contacts/contact.routes.js';
import authRoutes from '../modules/auth/auth.routes.js';
import profileRoutes from '../modules/profile/profile.routes.js';
import peopleRoutes from '../modules/people/people.routes.js';
import youtubeRoutes from '../modules/youtube/youtube.routes.js';
import memberRoutes from '../modules/members/member.routes.js';

const router = Router();

// Register each app/module's routes here.
// e.g. router.use('/url-shortener', urlShortenerRoutes);
router.use('/qrcode', qrcodeRoutes);
router.use('/chat', chatRoutes);
router.use('/contacts', contactRoutes);
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/people', peopleRoutes);
router.use('/youtube', youtubeRoutes);
router.use('/members', memberRoutes);

export default router;
