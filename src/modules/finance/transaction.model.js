import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: 0.01 },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    category: { type: String, trim: true },
    note: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
