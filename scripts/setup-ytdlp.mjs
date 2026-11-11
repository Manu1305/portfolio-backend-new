import { mkdir, chmod, access, rename } from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binDir = path.join(__dirname, '..', 'bin');

// The plain "yt-dlp" release asset is a Python zipapp that needs python3 on
// the host — not guaranteed on Render's Node runtime. Use the self-contained
// per-platform builds instead. Local filename stays yt-dlp(.exe) so
// src/config/ytdlp.js doesn't care which asset it came from.
const RELEASE_ASSETS = {
  win32: 'yt-dlp.exe',
  linux: 'yt-dlp_linux',
  darwin: 'yt-dlp_macos',
};

const releaseAsset = RELEASE_ASSETS[process.platform] || 'yt-dlp';
const localName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const destPath = path.join(binDir, localName);
const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${releaseAsset}`;
const force = process.argv.includes('--force');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!force && (await exists(destPath))) {
    console.log(`yt-dlp binary already present at ${destPath}, skipping download (pass --force to refresh).`);
    return;
  }

  await mkdir(binDir, { recursive: true });

  console.log(`Downloading yt-dlp from ${downloadUrl} ...`);
  const res = await fetch(downloadUrl, { redirect: 'follow' });
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download yt-dlp: HTTP ${res.status}`);
  }

  // write to a temp file then rename, so a failed/partial download never
  // replaces a working binary
  const tmpPath = `${destPath}.download`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmpPath));
  await rename(tmpPath, destPath);

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
