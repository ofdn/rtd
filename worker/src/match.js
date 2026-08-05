// Query/candidate string normalization and scoring for reconciliation.
// No dependencies: the dataset is small enough that a hand-rolled bigram
// similarity is simpler than pulling in a fuzzy-matching library.

// Same diacritic-stripping approach as scripts/mint-id.js's slugify(), but
// keeps spaces (a slug isn't useful for comparing "Aditi Pimprikar" against
// itself token-by-token).
export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function bigrams(s) {
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}

function diceCoefficient(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  const counts = new Map();
  for (const g of bigramsA) counts.set(g, (counts.get(g) ?? 0) + 1);
  let matches = 0;
  for (const g of bigramsB) {
    const count = counts.get(g) ?? 0;
    if (count > 0) {
      matches++;
      counts.set(g, count - 1);
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length);
}

// 100 for an exact normalized match, 70-95 for a substring match (scaled by
// how much of the longer string the shorter one covers), otherwise a Dice
// bigram-coefficient similarity capped below the substring band so a loose
// match never outranks a real substring hit.
export function scoreMatch(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) {
    const ratio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
    return Math.round(70 + ratio * 25);
  }
  return Math.round(diceCoefficient(q, c) * 65);
}

// Best score across a record's preferred name and any alternates, since a
// query might match an alternate spelling rather than the preferred form.
export function bestScore(query, record) {
  const names = [record.name, ...(record.alternates ?? [])];
  let best = 0;
  for (const name of names) {
    const s = scoreMatch(query, name);
    if (s > best) best = s;
  }
  return best;
}
