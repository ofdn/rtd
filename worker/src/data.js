// Fetches and caches the dataset to reconcile against. Reads RTD's own
// already-published search-index.json (scripts/build.js's "--- Search
// index ---" section) rather than a separate copy: it's already filtered
// to active records and already carries the "person"/"typeface" kind per
// entry, which is exactly the shape reconciliation needs, and it means
// this Worker never drifts out of sync with whatever's currently live.
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = null; // { people, typefaces, fetchedAt }

export async function getData(baseUrl) {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  const res = await fetch(`${baseUrl}search-index.json`, {
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch search-index.json: ${res.status}`);
  }
  const entries = await res.json();

  cache = {
    people: entries.filter((e) => e.kind === "person"),
    typefaces: entries.filter((e) => e.kind === "typeface"),
    fetchedAt: now,
  };
  return cache;
}
