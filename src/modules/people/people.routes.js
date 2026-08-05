import { Router } from 'express';
import { listPeopleHandler, addPersonHandler } from './people.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.get('/', authenticate, requireRole('admin'), listPeopleHandler);
router.post('/', authenticate, requireRole('admin'), addPersonHandler);

export default router;
