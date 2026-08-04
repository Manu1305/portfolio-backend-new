import { Router } from 'express';
import { getContacts } from './contact.controller.js';
import apiKeyAuth from '../../middleware/apiKeyAuth.js';

const router = Router();

router.get('/', apiKeyAuth, getContacts);

export default router;
