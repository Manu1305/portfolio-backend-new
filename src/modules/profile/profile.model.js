import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  age: { type: Number },
  gender: { type: String, trim: true },
  height: { type: Number }, // cm
  weight: { type: Number }, // kg
  email: { type: String, trim: true },
  phone: { type: String, trim: true },
  location: { type: String, trim: true },
  occupation: { type: String, trim: true },
  bio: { type: String, trim: true },
  avatarUrl: { type: String, trim: true },
  skills: { type: [String], default: [] },
  socialLinks: { type: mongoose.Schema.Types.Mixed, default: {} },
  extra: { type: mongoose.Schema.Types.Mixed }, // catch-all for anything not modeled above
  updatedAt: { type: Date, default: Date.now },
});

export default mongoose.model('Profile', profileSchema);
