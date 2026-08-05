import jwt from 'jsonwebtoken';
import { verifyGoogleIdToken } from '../../config/googleAuth.js';
import {
  findOrCreateFromGoogle,
  getMemberById,
  updateOwnProfile,
  uploadMemberAvatar,
  saveAvatarUrl,
  listMembers,
} from './member.service.js';

const TOKEN_EXPIRY = '7d';
const UPDATABLE_FIELDS = ['name', 'address', 'phone', 'interests', 'favoriteMovie', 'language'];

function signMemberToken(member) {
  return jwt.sign({ memberId: member._id, email: member.email, role: 'member' }, process.env.JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

function validateUpdates(body) {
  if (body.interests !== undefined) {
    if (!Array.isArray(body.interests) || !body.interests.every((i) => typeof i === 'string')) {
      return 'interests must be an array of strings';
    }
  }
  for (const field of ['name', 'address', 'phone', 'favoriteMovie', 'language']) {
    if (body[field] !== undefined && typeof body[field] !== 'string') {
      return `${field} must be a string`;
    }
    if (typeof body[field] === 'string' && body[field].length > 500) {
      return `${field} must be 500 characters or fewer`;
    }
  }
  return null;
}

export async function googleAuthHandler(req, res, next) {
  try {
    const { idToken } = req.body || {};
    if (typeof idToken !== 'string' || idToken.trim().length === 0) {
      return res.status(400).json({ error: 'idToken is required' });
    }

    let payload;
    try {
      payload = await verifyGoogleIdToken(idToken);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    if (!payload.email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const member = await findOrCreateFromGoogle({
      sub: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
    });

    res.json({ token: signMemberToken(member), member });
  } catch (err) {
    next(err);
  }
}

export async function getMeHandler(req, res, next) {
  try {
    const member = await getMemberById(req.user.memberId);
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

export async function updateMeHandler(req, res, next) {
  try {
    const body = req.body || {};
    const error = validateUpdates(body);
    if (error) return res.status(400).json({ error });

    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    const member = await updateOwnProfile(req.user.memberId, updates);
    res.json({ member });
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarHandler(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'avatar file is required' });

    const avatarUrl = await uploadMemberAvatar(req.file.buffer, req.file.originalname);
    const member = await saveAvatarUrl(req.user.memberId, avatarUrl);
    res.json({ avatarUrl, member });
  } catch (err) {
    next(err);
  }
}

export async function listMembersHandler(req, res, next) {
  try {
    const members = await listMembers();
    res.json({ members });
  } catch (err) {
    next(err);
  }
}
