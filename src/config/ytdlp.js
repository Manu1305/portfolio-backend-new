import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

export const ytDlpPath = path.join(__dirname, '..', '..', 'bin', assetName);

export function ytDlpAvailable() {
  return existsSync(ytDlpPath);
}
