import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  source: { type: String, default: 'chat' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Contact', contactSchema);
