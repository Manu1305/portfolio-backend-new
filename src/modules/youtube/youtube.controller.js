import { isYoutubeUrl, isValidFormatId, getVideoInfo, streamDownload, getHealth } from './youtube.service.js';

function sanitizeFilename(name) {
  // strip filesystem-illegal chars and control chars (incl. newlines, which
  // would otherwise let a crafted title inject extra HTTP headers)
  const cleaned = String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 150);
  return cleaned || 'video';
}

// HTTP header values must be Latin-1 — most YouTube titles aren't (emoji,
// accents, non-Latin scripts), so build an ASCII-safe fallback for the plain
// `filename=` part and carry the real name via the UTF-8 `filename*=` extension
function asciiOnly(name) {
  return name.replace(/[^\x20-\x7E]/g, '_');
}

export async function getInfoHandler(req, res, next) {
  try {
    const { url } = req.body || {};
    if (!isYoutubeUrl(url)) return res.status(400).json({ error: 'a valid YouTube URL is required' });

    const info = await getVideoInfo(url);
    res.json(info);
  } catch (err) {
    next(err);
  }
}

export function downloadHandler(req, res, next) {
  try {
    const { url, formatId } = req.query;
    if (!isYoutubeUrl(url)) return res.status(400).json({ error: 'a valid YouTube URL is required' });
    if (!isValidFormatId(formatId)) return res.status(400).json({ error: 'a valid formatId is required' });

    const ext = sanitizeFilename(String(req.query.ext || 'mp4'));
    const filename = `${sanitizeFilename(String(req.query.title || 'video'))}.${ext}`;

    // only applied once yt-dlp actually starts producing data, so an early
    // failure can still come back as a JSON error
    streamDownload(url, formatId, res, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${asciiOnly(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    });
  } catch (err) {
    next(err);
  }
}

export async function healthHandler(req, res, next) {
  try {
    res.json(await getHealth());
  } catch (err) {
    next(err);
  }
}
