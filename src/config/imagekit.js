import ImageKit from 'imagekit';

// fall back to placeholders so a missing key fails per-request (a clean
// error from the upload handler) instead of crashing the whole app at import time
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'missing-imagekit-public-key',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'missing-imagekit-private-key',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/missing',
});

export default imagekit;
