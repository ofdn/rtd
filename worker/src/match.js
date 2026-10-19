// Query/candidate string normalization and scoring for reconciliation.
// No dependencies: the dataset is small enough that a hand-rolled bigram
// similarity is simpler than pulling in a fuzzy-matching library.

// Like slugify() in scripts/mint-id.js, but keeps spaces. Drops periods and
// commas so "R.K. Joshi" and "R. K. Joshi" both become "r k joshi".
export function normalize(text) {
  return text
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Matches "RK Joshi" to "R K Joshi", which normalize() leaves apart.
function compact(normalized) {
  return normalized.replace(/\s+/g, "");
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

// 100 exact, 96 spacing-only, 70-95 substring (by coverage), else a Dice
// bigram score kept below the substring band.
export function scoreMatch(query, candidate) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (compact(q) === compact(c)) return 96;
  if (c.includes(q) || q.includes(c)) {
    const ratio = Math.min(q.length, c.length) / Math.max(q.length, c.length);
    return Math.round(70 + ratio * 25);
  }
  return Math.round(diceCoefficient(q, c) * 65);
}

// Best score across the preferred name and alternates.
export function bestScore(query, record) {
  const names = [record.name, ...(record.alternates ?? [])];
  let best = 0;
  for (const name of names) {
    const s = scoreMatch(query, name);
    if (s > best) best = s;
  }
  return best;
}
