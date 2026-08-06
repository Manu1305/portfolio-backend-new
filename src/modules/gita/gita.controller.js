import { getTodaysVerse } from './gita.service.js';

export async function getTodayHandler(req, res, next) {
  try {
    const verse = await getTodaysVerse();
    res.json({ verse });
  } catch (err) {
    next(err);
  }
}
