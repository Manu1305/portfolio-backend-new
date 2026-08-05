import Profile from './profile.model.js';
import imagekit from '../../config/imagekit.js';

// singleton document — always queried/updated with an empty filter
export async function getProfile() {
  return Profile.findOne();
}

export async function uploadAvatar(fileBuffer, fileName) {
  const result = await imagekit.upload({
    file: fileBuffer,
    fileName,
    folder: '/portfolio/avatars',
    useUniqueFileName: true,
  });
  return result.url;
}

export async function upsertProfile(data) {
  return Profile.findOneAndUpdate(
    {},
    { $set: { ...data, updatedAt: new Date() } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
}
