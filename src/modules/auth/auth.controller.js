import { login, changePassword, saveDevice, listDevices } from './auth.service.js';

export async function loginHandler(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const token = await login(username, password);
    if (!token) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({ token });
  } catch (err) {
    next(err);
  }
}

export async function saveDeviceHandler(req, res, next) {
  try {
    const { deviceName, os, browser, ...metadata } = req.body || {};
    if (typeof deviceName !== 'string' || deviceName.trim().length === 0) {
      return res.status(400).json({ error: 'deviceName is required' });
    }
    if (deviceName.length > 200) {
      return res.status(400).json({ error: 'deviceName must be 200 characters or fewer' });
    }

    const device = await saveDevice(req.user.username, {
      deviceName,
      os,
      browser,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      metadata,
    });

    res.status(201).json({ device });
  } catch (err) {
    next(err);
  }
}

export async function changePasswordHandler(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      !currentPassword ||
      !newPassword
    ) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    }

    const success = await changePassword(req.user.username, currentPassword, newPassword);
    if (!success) {
      return res.status(401).json({ error: 'currentPassword is incorrect' });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function listDevicesHandler(req, res, next) {
  try {
    const devices = await listDevices(req.user.username);
    res.json({ devices });
  } catch (err) {
    next(err);
  }
}
