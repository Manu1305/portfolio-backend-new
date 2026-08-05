import { Router } from 'express';
import { trackHandler, listVisitorsHandler } from './visitor.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.post('/track', trackHandler);
router.get('/', authenticate, requireRole('admin'), listVisitorsHandler);

export default router;
