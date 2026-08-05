import { spawn } from 'child_process';
import { ytDlpPath, ytDlpAvailable } from '../../config/ytdlp.js';

const YOUTUBE_URL_RE = /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/i;
const FORMAT_ID_RE = /^[a-zA-Z0-9_.+-]+$/;

export function isYoutubeUrl(url) {
  return typeof url === 'string' && YOUTUBE_URL_RE.test(url);
}

export function isValidFormatId(formatId) {
  return typeof formatId === 'string' && FORMAT_ID_RE.test(formatId);
}

function runYtDlpJson(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytDlpPath, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => (stdout += chunk));
    proc.stderr.on('data', (chunk) => (stderr += chunk));

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(stderr.trim().split('\n').pop() || 'yt-dlp failed'));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('Failed to parse yt-dlp output'));
      }
    });
  });
}

export async function getVideoInfo(url) {
  if (!ytDlpAvailable()) throw new Error('yt-dlp is not installed on the server');

  const info = await runYtDlpJson(['--dump-single-json', '--no-warnings', '--no-playlist', url]);

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

// spawns yt-dlp with stdout piped straight to the response — no temp files,
// no buffering the whole video in memory
export function streamDownload(url, formatId, res) {
  if (!ytDlpAvailable()) throw new Error('yt-dlp is not installed on the server');

  const proc = spawn(ytDlpPath, ['-f', formatId, '-o', '-', '--no-playlist', url]);

  let stderr = '';
  proc.stderr.on('data', (chunk) => (stderr += chunk));

  proc.stdout.pipe(res);

  proc.on('error', () => {
    if (!res.headersSent) res.status(500).json({ error: 'Failed to start yt-dlp' });
  });

  proc.on('close', (code) => {
    if (code !== 0 && !res.headersSent) {
      res.status(500).json({ error: stderr.trim().split('\n').pop() || 'Download failed' });
    }
  });

  res.on('close', () => {
    if (!proc.killed) proc.kill();
  });
}
