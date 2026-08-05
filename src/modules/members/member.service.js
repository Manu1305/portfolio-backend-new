import Member from './member.model.js';
import imagekit from '../../config/imagekit.js';

export async function findOrCreateFromGoogle({ sub, email, name, picture }) {
  let member = await Member.findOne({ googleId: sub });
  if (member) return member;

  member = await Member.create({
    googleId: sub,
    email,
    name,
    avatarUrl: picture || undefined,
  });
  return member;
}

export async function getMemberById(id) {
  return Member.findById(id);
}

export async function updateOwnProfile(id, updates) {
  return Member.findByIdAndUpdate(
    id,
    { $set: { ...updates, updatedAt: new Date() } },
    { returnDocument: 'after', runValidators: true }
  );
}

export async function uploadMemberAvatar(fileBuffer, fileName) {
  const result = await imagekit.upload({
    file: fileBuffer,
    fileName,
    folder: '/portfolio/members/avatars',
    useUniqueFileName: true,
  });
  return result.url;
}

export async function saveAvatarUrl(id, avatarUrl) {
  return updateOwnProfile(id, { avatarUrl });
}

export async function listMembers() {
  return Member.find().sort({ createdAt: -1 });
}
