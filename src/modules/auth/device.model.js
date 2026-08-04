import mongoose from 'mongoose';

const deviceSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  deviceName: { type: String, required: true, trim: true },
  os: { type: String, trim: true },
  browser: { type: String, trim: true },
  ip: { type: String, trim: true },
  userAgent: { type: String, trim: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Device', deviceSchema);
