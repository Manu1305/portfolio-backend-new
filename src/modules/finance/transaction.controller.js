import { listTransactions, createTransaction, updateTransaction, deleteTransaction } from './transaction.service.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function validateTransactionPayload(body) {
  if (body.type !== 'income' && body.type !== 'expense') {
    return 'type must be "income" or "expense"';
  }
  if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
    return 'amount must be a number greater than 0';
  }
  if (typeof body.date !== 'string' || !DATE_RE.test(body.date) || Number.isNaN(Date.parse(body.date))) {
    return 'date must be a valid "YYYY-MM-DD" string';
  }
  if (body.category !== undefined && typeof body.category !== 'string') {
    return 'category must be a string';
  }
  if (body.note !== undefined && typeof body.note !== 'string') {
    return 'note must be a string';
  }
  return null;
}

export async function listTransactionsHandler(req, res, next) {
  try {
    const { month } = req.query;
    if (month !== undefined && !MONTH_RE.test(month)) {
      return res.status(400).json({ error: 'month must be in "YYYY-MM" format' });
    }

    const transactions = await listTransactions({ month });
    res.json({ transactions });
  } catch (err) {
    next(err);
  }
}

export async function createTransactionHandler(req, res, next) {
  try {
    const body = req.body || {};
    const error = validateTransactionPayload(body);
    if (error) return res.status(400).json({ error });

    const transaction = await createTransaction({
      type: body.type,
      amount: body.amount,
      date: body.date,
      category: body.category,
      note: body.note,
    });
    res.status(201).json({ transaction });
  } catch (err) {
    next(err);
  }
}

export async function updateTransactionHandler(req, res, next) {
  try {
    const body = req.body || {};
    const error = validateTransactionPayload(body);
    if (error) return res.status(400).json({ error });

    const transaction = await updateTransaction(req.params.id, {
      type: body.type,
      amount: body.amount,
      date: body.date,
      category: body.category,
      note: body.note,
    });
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    res.json({ transaction });
  } catch (err) {
    next(err);
  }
}

export async function deleteTransactionHandler(req, res, next) {
  try {
    const transaction = await deleteTransaction(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
