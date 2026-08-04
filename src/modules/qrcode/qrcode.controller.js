import {
  validateText,
  validateFormat,
  validateErrorCorrectionLevel,
  validateLogo,
  generateDataUrl,
  generateSvg,
  generateBuffer,
} from './qrcode.service.js';

function validatePayload({ text, format, errorCorrectionLevel, logo }) {
  const textError = validateText(text);
  if (textError) return textError;

  const formatError = validateFormat(format);
  if (formatError) return formatError;

  const levelError = validateErrorCorrectionLevel(errorCorrectionLevel);
  if (levelError) return levelError;

  const logoError = validateLogo(logo);
  if (logoError) return logoError;

  if (logo && format === 'svg') return 'logo is only supported with format "png"';

  return null;
}

export async function createQrCode(req, res, next) {
  try {
    const { text, format = 'png' } = req.body || {};

    const error = validatePayload({ ...req.body, format });
    if (error) return res.status(400).json({ error });

    if (format === 'svg') {
      const svg = await generateSvg(text, req.body);
      return res.json({ svg });
    }

    const dataUrl = await generateDataUrl(text, req.body);
    return res.json({ dataUrl });
  } catch (err) {
    next(err);
  }
}

export async function downloadQrCode(req, res, next) {
  try {
    const { text, format = 'png' } = req.query;

    const error = validatePayload({ ...req.query, format });
    if (error) return res.status(400).json({ error });

    if (format === 'svg') {
      const svg = await generateSvg(text, req.query);
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Content-Disposition', 'attachment; filename="qrcode.svg"');
      return res.send(svg);
    }

    const buffer = await generateBuffer(text, req.query);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="qrcode.png"');
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}
