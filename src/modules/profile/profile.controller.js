import { getProfile, upsertProfile, uploadAvatar } from './profile.service.js';

const NUMERIC_FIELDS = ['age', 'height', 'weight'];

function validatePayload(body) {
  const { name } = body;
  if (typeof name !== 'string' || name.trim().length === 0) {
    return 'name is required';
  }
  if (name.length > 200) return 'name must be 200 characters or fewer';

  for (const field of NUMERIC_FIELDS) {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '' && typeof value !== 'number') {
      return `${field} must be a number`;
    }
  }

  if (body.bio && body.bio.length > 5000) return 'bio must be 5000 characters or fewer';
  if (body.skills !== undefined && !Array.isArray(body.skills)) return 'skills must be an array of strings';

  return null;
}

export async function getProfileHandler(req, res, next) {
  try {
    const profile = await getProfile();
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function upsertProfileHandler(req, res, next) {
  try {
    const error = validatePayload(req.body || {});
    if (error) return res.status(400).json({ error });

    const profile = await upsertProfile(req.body);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarHandler(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'avatar file is required' });

    const avatarUrl = await uploadAvatar(req.file.buffer, req.file.originalname);
    const profile = await upsertProfile({ avatarUrl });
    res.json({ avatarUrl, profile });
  } catch (err) {
    next(err);
  }
}
