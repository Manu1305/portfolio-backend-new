import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from './user.model.js';
import Device from './device.model.js';

const TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 10;

export async function login(username, password) {
  if (!process.env.JWT_SECRET) {
    const err = new Error('Server misconfiguration: JWT_SECRET is not set');
    err.status = 500;
    throw err;
  }

  const user = await User.findOne({ username });
  if (!user) return null;

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return null;

  return jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

export async function changePassword(username, currentPassword, newPassword) {
  const user = await User.findOne({ username });
  if (!user) return false;

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) return false;

  user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();
  return true;
}

export async function saveDevice(username, data) {
  return Device.create({ username, ...data });
}

export async function listDevices(username) {
  return Device.find({ username }).sort({ createdAt: -1 });
}
