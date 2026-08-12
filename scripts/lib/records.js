// Shared id/slug logic used by scripts/mint-id.js and
// scripts/issue-to-record.js, so the two ways a record gets created
// (by hand, or from an issue form) can never disagree about how an id or
// slug is computed.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export const KIND_CONFIG = {
  person: { dir: "data/people", prefix: "rtd-p-" },
  typeface: { dir: "data/typefaces", prefix: "rtd-t-" },
};

export function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadJson(join(dir, f)));
}

export function nextId(records, prefix) {
  let max = 0;
  const idPattern = new RegExp(`^${prefix}(\\d{6})$`);
  for (const record of records) {
    const m = idPattern.exec(record.id ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

// If the plain slug is taken, append -2, -3, ... rather than a birth year
// or role (those aren't always known at mint time).
export function uniqueSlug(baseSlug, existingSlugs) {
  if (!existingSlugs.has(baseSlug)) return baseSlug;
  let n = 2;
  while (existingSlugs.has(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
}

// Existing active record(s) with the identical preferred name - a signal
// to check for a duplicate rather than a hard block.
export function sameNameCollisions(records, name) {
  return records.filter(
    (r) =>
      r.record_status === "active" &&
      r.name?.preferred?.toLowerCase() === name.toLowerCase()
  );
}
