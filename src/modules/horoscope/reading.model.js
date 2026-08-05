import mongoose from 'mongoose';

const readingSchema = new mongoose.Schema({
  userKey: { type: String, required: true }, // e.g. "admin:manu" or "member:<id>" — one identity, any role
  date: { type: String, required: true }, // "YYYY-MM-DD", the calendar day this reading is FOR (UTC)
  dob: { type: String, required: true },
  birthTime: { type: String, trim: true },
  birthPlace: { type: String, trim: true },
  yearReading: { type: String, required: true },
  dayReading: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// one reading per user per day, enforced at the DB level too (not just app logic)
readingSchema.index({ userKey: 1, date: 1 }, { unique: true });

export default mongoose.model('Reading', readingSchema);
