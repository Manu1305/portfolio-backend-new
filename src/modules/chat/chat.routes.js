import { Router } from 'express';
import { chatStream } from './chat.controller.js';

const router = Router();

router.post('/', chatStream);

export default router;
