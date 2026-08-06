import { Router } from 'express';
import {
  listTransactionsHandler,
  createTransactionHandler,
  updateTransactionHandler,
  deleteTransactionHandler,
} from './transaction.controller.js';
import authenticate from '../../middleware/authenticate.js';
import requireRole from '../../middleware/requireRole.js';

const router = Router();

router.get('/transactions', authenticate, requireRole('admin'), listTransactionsHandler);
router.post('/transactions', authenticate, requireRole('admin'), createTransactionHandler);
router.put('/transactions/:id', authenticate, requireRole('admin'), updateTransactionHandler);
router.delete('/transactions/:id', authenticate, requireRole('admin'), deleteTransactionHandler);

export default router;
