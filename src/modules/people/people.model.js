import mongoose from 'mongoose';

const personSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  relation: { type: String, trim: true }, // e.g. friend, family, colleague, other
  age: { type: Number },
  phone: { type: String, trim: true },
  email: { type: String, trim: true },
  birthday: { type: Date },
  howWeMet: { type: String, trim: true },
  notes: { type: String, trim: true },
  extra: { type: mongoose.Schema.Types.Mixed }, // catch-all for anything not modeled above
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Person', personSchema);
