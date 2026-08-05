import { mkdir, chmod, access } from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.join(__dirname, '..', 'bin');

const assetName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const destPath = path.join(binDir, assetName);
const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await exists(destPath)) {
    console.log(`yt-dlp binary already present at ${destPath}, skipping download.`);
    return;
  }

  await mkdir(binDir, { recursive: true });

  console.log(`Downloading yt-dlp from ${downloadUrl} ...`);
  const res = await fetch(downloadUrl, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  }

  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));

  if (process.platform !== 'win32') {
    await chmod(destPath, 0o755);
  }

  console.log(`yt-dlp binary installed at ${destPath}`);
}

main().catch((err) => {
  console.error('setup-ytdlp failed:', err.message);
  // don't fail the whole npm install over this — the youtube module will
  // just return a clear error at request time if the binary is missing
  process.exit(0);
});
