import Transaction from './transaction.model.js';

export async function listTransactions({ month }) {
  const filter = month ? { date: { $regex: `^${month}` } } : {};
  return Transaction.find(filter).sort({ date: -1, createdAt: -1 });
}

export async function createTransaction(data) {
  return Transaction.create(data);
}

export async function updateTransaction(id, data) {
  return Transaction.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after', runValidators: true });
}

export async function deleteTransaction(id) {
  return Transaction.findByIdAndDelete(id);
}
