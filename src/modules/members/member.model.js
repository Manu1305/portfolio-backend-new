import mongoose from 'mongoose';

const memberSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    avatarUrl: { type: String, trim: true },
    interests: { type: [String], default: [] },
    favoriteMovie: { type: String, trim: true },
    language: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    toJSON: {
      transform: (doc, ret) => {
        delete ret.googleId;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default mongoose.model('Member', memberSchema);
