import { spawn } from 'child_process';
import { ytDlpPath, ytDlpAvailable, baseArgs, cookiesPath } from '../../config/ytdlp.js';

const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i;
const FORMAT_ID_RE = /^[a-zA-Z0-9_.+-]+$/;

export function isYoutubeUrl(url) {
  return typeof url === 'string' && YOUTUBE_URL_RE.test(url);
}

export function isValidFormatId(formatId) {
  return typeof formatId === 'string' && FORMAT_ID_RE.test(formatId);
}

function notInstalledError() {
  const err = new Error('yt-dlp is not installed on the server');
  err.status = 503;
  return err;
}

// Turns yt-dlp's stderr into a message a visitor can act on. The full stderr
// is always logged server-side so Render logs show the real cause.
function friendlyYtDlpError(stderr) {
  const text = stderr || '';
  if (/confirm you.?re not a bot|Sign in to confirm/i.test(text)) {
    return cookiesPath
      ? 'YouTube is blocking the server (bot check). The configured cookies are probably expired — re-export them.'
      : 'YouTube is blocking the server (bot check). Configure YTDLP_COOKIES on the backend.';
  }
  if (/Requested format is not available/i.test(text)) {
    return 'That format is no longer available. Fetch the video again and pick another one.';
  }
  const lastLine = text.trim().split('\n').pop() || '';
  return lastLine.replace(/^ERROR:\s*/, '') || 'yt-dlp failed';
}

function ytDlpError(stderr) {
  const err = new Error(friendlyYtDlpError(stderr));
  err.status = 502;
  return err;
}

function runYtDlp(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`yt-dlp exited with code ${code}:\n${stderr}`);
        return reject(ytDlpError(stderr));
      }
      resolve(stdout);
    });
  });
}

export async function getVideoInfo(url) {
  if (!ytDlpAvailable()) throw notInstalledError();

  const stdout = await runYtDlp([...baseArgs(), '--dump-single-json', url]);
  let info;
  try {
    info = JSON.parse(stdout);
  } catch {
    const err = new Error('Failed to parse yt-dlp output');
    err.status = 502;
    throw err;
  }

  const formats = Array.isArray(info.formats) ? info.formats : [];

  const videoFormats = formats
    .filter((f) => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none')
    .map((f) => ({
      formatId: f.format_id,
      ext: f.ext,
      resolution: f.resolution || (f.height ? `${f.height}p` : null),
      filesizeApprox: f.filesize || f.filesize_approx || null,
      note: f.format_note || null,
    }));

  const audioFormats = formats
    .filter((f) => (!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none')
    .map((f) => ({
      formatId: f.format_id,
      ext: f.ext,
      filesizeApprox: f.filesize || f.filesize_approx || null,
      note: f.format_note || null,
    }));

  return {
    title: info.title || 'video',
    thumbnail: info.thumbnail || null,
    duration: info.duration || null,
    uploader: info.uploader || null,
    videoFormats,
    audioFormats,
  };
}

// Streams yt-dlp's stdout straight into the response — no temp files, no
// buffering the whole video in memory. Nothing is committed to the client
// (status, download headers) until the first byte of video actually arrives,
// so a failure before that comes back as a clean JSON error instead of an
// empty "successful" file. A failure after streaming has started destroys
// the connection, so the browser sees a failed download, not a truncated one.
export function streamDownload(url, formatId, res, downloadHeaders = {}) {
  if (!ytDlpAvailable()) throw notInstalledError();

  const proc = spawn(ytDlpPath, [...baseArgs(), '-f', formatId, '-o', '-', url]);

  let stderr = '';
  let started = false;
  let finished = false;

  proc.stderr.on('data', (chunk) => (stderr += chunk));

  proc.stdout.once('data', (chunk) => {
    started = true;
    for (const [name, value] of Object.entries(downloadHeaders)) res.setHeader(name, value);
    res.write(chunk);
    // end: false — whether to end cleanly or destroy is decided on exit below
    proc.stdout.pipe(res, { end: false });
  });

  const fail = (status, message) => {
    if (finished) return;
    finished = true;
    if (started || res.headersSent) {
      res.destroy();
    } else {
      res.status(status).json({ error: message });
    }
  };

  proc.on('error', (err) => {
    console.error('Failed to start yt-dlp:', err);
    fail(500, 'Failed to start yt-dlp');
  });

  // 'close' fires after all of stdout has been emitted
  proc.on('close', (code) => {
    if (finished) return;
    if (code === 0 && started) {
      finished = true;
      res.end();
      return;
    }
    console.error(`yt-dlp download exited with code ${code}:\n${stderr}`);
    fail(502, code === 0 ? 'yt-dlp produced no output' : friendlyYtDlpError(stderr));
  });

  res.on('close', () => {
    if (proc.exitCode === null && !proc.killed) proc.kill();
  });
}

// Admin diagnostics — answers "why doesn't it work on the server" without shell access
export async function getHealth() {
  const available = ytDlpAvailable();
  let version = null;
  let error = null;

  if (available) {
    try {
      version = (await runYtDlp(['--version'])).trim();
    } catch (err) {
      error = err.message;
    }
  }

  return {
    binaryPath: ytDlpPath,
    binaryPresent: available,
    version,
    error,
    jsRuntime: `node:${process.execPath}`,
    nodeVersion: process.version,
    cookiesConfigured: Boolean(cookiesPath),
    platform: process.platform,
  };
}
