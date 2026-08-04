import QRCode from 'qrcode';
import { Jimp, JimpMime } from 'jimp';

const MAX_TEXT_LENGTH = 2000;
const ALLOWED_FORMATS = ['png', 'svg'];
const ALLOWED_ERROR_CORRECTION = ['L', 'M', 'Q', 'H'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB decoded
const LOGO_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/;

export function validateText(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return 'text (or link) is required';
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return `text must be ${MAX_TEXT_LENGTH} characters or fewer`;
  }
  return null;
}

export function validateFormat(format) {
  if (!ALLOWED_FORMATS.includes(format)) {
    return `format must be one of: ${ALLOWED_FORMATS.join(', ')}`;
  }
  return null;
}

export function validateErrorCorrectionLevel(level) {
  if (level === undefined || level === null || level === '') return null;
  if (!ALLOWED_ERROR_CORRECTION.includes(level)) {
    return `errorCorrectionLevel must be one of: ${ALLOWED_ERROR_CORRECTION.join(', ')}`;
  }
  return null;
}

export function validateLogo(logo) {
  if (logo === undefined || logo === null || logo === '') return null;
  if (typeof logo !== 'string') return 'logo must be a base64 data URL string';
  const match = logo.match(LOGO_DATA_URL_RE);
  if (!match) return 'logo must be a base64 data URL, e.g. data:image/png;base64,....';
  const approxBytes = (match[2].length * 3) / 4;
  if (approxBytes > MAX_LOGO_BYTES) return 'logo image must be 2MB or smaller';
  return null;
}

function buildOptions({ size, margin, darkColor, lightColor, errorCorrectionLevel, logo }) {
  const width = Number(size) > 0 ? Math.min(Number(size), 2000) : 300;
  const hasValidLevel = ALLOWED_ERROR_CORRECTION.includes(errorCorrectionLevel);
  return {
    width,
    margin: Number.isInteger(Number(margin)) ? Number(margin) : 2,
    color: {
      dark: darkColor || '#000000',
      light: lightColor || '#ffffff',
    },
    // a logo covers part of the code, so it needs high error-correction to stay scannable
    errorCorrectionLevel: hasValidLevel ? errorCorrectionLevel : logo ? 'H' : 'M',
  };
}

async function embedLogo(qrBuffer, logoDataUrl, sizeRatio) {
  const match = logoDataUrl.match(LOGO_DATA_URL_RE);
  const logoBuffer = Buffer.from(match[2], 'base64');
  const ratio = Math.min(Math.max(Number(sizeRatio) || 0.22, 0.1), 0.3);

  const [qrImg, logoImg] = await Promise.all([Jimp.read(qrBuffer), Jimp.read(logoBuffer)]);

  const targetSize = Math.round(qrImg.width * ratio);
  logoImg.resize({ w: targetSize, h: targetSize });

  // white backing behind the logo so it stays legible against the code
  const pad = Math.round(targetSize * 0.12);
  const backing = new Jimp({ width: targetSize + pad * 2, height: targetSize + pad * 2, color: 0xffffffff });
  backing.composite(logoImg, pad, pad);

  const x = Math.round((qrImg.width - backing.width) / 2);
  const y = Math.round((qrImg.height - backing.height) / 2);
  qrImg.composite(backing, x, y);

  return qrImg.getBuffer(JimpMime.png);
}

export async function generateDataUrl(text, params = {}) {
  if (params.logo) {
    const buffer = await generateBuffer(text, params);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  }
  return QRCode.toDataURL(text, buildOptions(params));
}

export async function generateSvg(text, params = {}) {
  return QRCode.toString(text, { ...buildOptions(params), type: 'svg' });
}

export async function generateBuffer(text, params = {}) {
  const buffer = await QRCode.toBuffer(text, buildOptions(params));
  if (params.logo) {
    return embedLogo(buffer, params.logo, params.logoSizeRatio);
  }
  return buffer;
}
