const BASE_URL = 'https://vedicscriptures.github.io';

// the text itself never changes, so this is safe to cache in memory for the
// life of the process instead of refetching on every request
let chaptersCache = null;

async function getChapters() {
  if (chaptersCache) return chaptersCache;

  const res = await fetch(`${BASE_URL}/chapters`);
  if (!res.ok) throw new Error('Failed to fetch chapter list');

  const data = await res.json();
  chaptersCache = data.map((c) => ({ chapter: c.chapter_number, versesCount: c.verses_count }));
  return chaptersCache;
}

function dayOfYearUTC(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const today = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((today - start) / 86400000); // 0-indexed
}

async function resolveTodayReference() {
  const chapters = await getChapters();
  const total = chapters.reduce((sum, c) => sum + c.versesCount, 0);

  let index = dayOfYearUTC(new Date()) % total;

  for (const c of chapters) {
    if (index < c.versesCount) {
      return { chapter: c.chapter, verse: index + 1 }; // verses are 1-indexed
    }
    index -= c.versesCount;
  }

  return { chapter: 1, verse: 1 }; // unreachable in practice, just a safe fallback
}

// today's verse only ever changes once a day, and is identical for every
// visitor — cache it in memory so we're not hitting the free external API
// on every single page load
let todaysVerseCache = null; // { date: "YYYY-MM-DD", verse: {...} }

export async function getTodaysVerse() {
  const dateKey = new Date().toISOString().slice(0, 10);

  if (todaysVerseCache?.date === dateKey) {
    return todaysVerseCache.verse;
  }

  const { chapter, verse: verseNumber } = await resolveTodayReference();

  const res = await fetch(`${BASE_URL}/slok/${chapter}/${verseNumber}`);
  if (!res.ok) throw new Error('Failed to fetch verse');
  const data = await res.json();

  const verse = {
    chapter: data.chapter,
    verse: data.verse,
    sanskrit: data.slok,
    transliteration: data.transliteration,
    translations: [
      data.siva?.et && { author: 'Swami Sivananda', text: data.siva.et },
      data.purohit?.et && { author: 'Shri Purohit Swami', text: data.purohit.et },
    ].filter(Boolean),
  };

  todaysVerseCache = { date: dateKey, verse };
  return verse;
}
