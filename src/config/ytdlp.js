import os from 'os';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

export const ytDlpPath = path.join(__dirname, '..', '..', 'bin', assetName);

export function ytDlpAvailable() {
  return existsSync(ytDlpPath);
}

// YouTube blocks most datacenter IPs (Render included) with a "sign in to
// confirm you're not a bot" check — logged-in cookies are the reliable fix.
// Either point YTDLP_COOKIES_FILE at a file (e.g. a Render Secret File), or
// paste the Netscape-format cookies.txt contents into YTDLP_COOKIES and it
// gets written to a temp file once at startup.
//
// Either way it's copied to a writable temp file, because yt-dlp writes
// refreshed cookies back on exit and Render Secret Files are read-only.
function resolveCookiesPath() {
  let contents = null;
  const sourceFile = process.env.YTDLP_COOKIES_FILE;

  if (sourceFile) {
    if (!existsSync(sourceFile)) {
      console.error(`YTDLP_COOKIES_FILE is set but ${sourceFile} does not exist`);
      return null;
    }
    contents = readFileSync(sourceFile, 'utf8');
  } else if (process.env.YTDLP_COOKIES) {
    // env var UIs often flatten newlines — accept literal "\n" too
    contents = process.env.YTDLP_COOKIES.replace(/\\n/g, '\n');
  }
  if (!contents) return null;

  const tmpPath = path.join(os.tmpdir(), 'yt-dlp-cookies.txt');
  try {
    writeFileSync(tmpPath, contents, { mode: 0o600 });
    return tmpPath;
  } catch (err) {
    console.error('Failed to write yt-dlp cookies file:', err.message);
    return null;
  }
}

export const cookiesPath = resolveCookiesPath();

// args shared by every yt-dlp invocation
export function baseArgs() {
  const args = [
    // yt-dlp needs a JS runtime for YouTube; only deno is enabled by default,
    // but the node binary running this server is always available
    '--js-runtimes',
    `node:${process.execPath}`,
    '--no-update',
    '--no-warnings',
    '--no-playlist',
  ];
  if (cookiesPath) args.push('--cookies', cookiesPath);
  return args;
}
