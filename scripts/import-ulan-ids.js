#!/usr/bin/env node
// Backfills external_ids.ulan (Getty Union List of Artist Names) by
// querying Getty's own reconciliation API locally, for every person
// record that doesn't already have one. As reliable an authority file as
// VIAF/ISNI/LC-NAF/GND (see schema/person.schema.json), so it gets the
// same "just a cross-reference, still needs its own confidence gate"
// treatment as scripts/backfill-new-candidate-ids.js used for Wikidata:
// require a decisive score gap over the runner-up AND a plausible
// occupation showing in Getty's own "Roles" field for that record, not
// just a name match, since ULAN's name index has plenty of unrelated
// people (there is more than one "Hermann Zapf"-shaped name possible in
// principle).
//
// Getty's LOD/SPARQL endpoint (vocab.getty.edu) has been unreliable; the
// reconciliation API (services.getty.edu) and preview endpoint used here
// have been stable in testing, so this deliberately avoids the SPARQL
// endpoint entirely.
//
// Usage:
//   node scripts/import-ulan-ids.js            # dry run, prints a report
//   node scripts/import-ulan-ids.js --write     # also writes the files
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");
const UA = "RegistryOfTypeDesign/1.0 (https://github.com/ofdn/rtd; ULAN backfill script)";
const RECONCILE_URL = "https://services.getty.edu/vocab/reconcile";

const PLAUSIBLE_ROLE_HINTS =
  /typograph|type designer|calligraph|graphic design|engrav|punchcut|letterer|printer|font design|book design|illustrat|artist|designer/i;

// Confirmed-wrong matches found during manual review of the first run
// (2026-08-07): score gap + exact name match + a generic ULAN "artist"
// role tag isn't always enough. "Mirjam Somers" scored a decisive gap
// (46.8 vs runner-up 16.2) and an exact name match, but the ULAN record
// (500531706) is a Dutch video artist with zero connection to
// typography/calligraphy/DecoType in its bio, unlike genuinely-correct
// same-shaped matches (Hoefler/Frere-Jones/Makela) where the person is
// distinctive enough that a coincidental second real person is
// implausible. Keyed by RTD person id, not name, so a same-named
// different RTD record later isn't accidentally caught by this.
const MANUAL_EXCLUDE_RTD_IDS = new Set([
  "rtd-p-000091", // Mirjam Somers -> wrong ULAN 500531706 (Dutch video artist)
]);

// Minimum absolute confidence, and how much stronger the top result must
// be than the runner-up, before a match is trusted enough to write.
const MIN_SCORE = 25;
const MIN_GAP_RATIO = 1.5;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .trim();
}

// ULAN names are often inverted ("Zapf, Hermann"), so compare as
// order-independent token sets rather than a literal string/substring
// match.
function tokenSetEqual(a, b) {
  const ta = new Set(normalizeName(a).split(/\s+/).filter(Boolean));
  const tb = new Set(normalizeName(b).split(/\s+/).filter(Boolean));
  if (ta.size !== tb.size) return false;
  for (const t of ta) if (!tb.has(t)) return false;
  return true;
}

async function fetchWithRetry(url, params, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${url}?${params}`, { headers: { "User-Agent": UA } });
      if (res.status === 499 || res.status === 503) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === attempts - 1) throw err;
      await sleep(1500 * (i + 1));
    }
  }
}

async function reconcile(name) {
  const query = JSON.stringify({ q0: { query: name, type: "/ulan", limit: 5 } });
  const params = new URLSearchParams({ queries: query }).toString();
  const res = await fetchWithRetry(RECONCILE_URL, params);
  const data = await res.json();
  return data.q0?.result ?? [];
}

async function fetchPreviewText(ulanId) {
  const res = await fetchWithRetry(`${RECONCILE_URL}/preview`, new URLSearchParams({ id: ulanId }).toString());
  return res.text();
}

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const path = join(dir, f);
      const text = readFileSync(path, "utf8");
      return { path, text, record: JSON.parse(text) };
    });
}

async function findConfidentMatch(name) {
  let results;
  try {
    results = await reconcile(name);
  } catch (err) {
    console.error(`  ! reconcile failed for "${name}": ${err.message}`);
    return null;
  }
  if (!results.length) return null;
  const top = results[0];
  const second = results[1];
  if (top.score < MIN_SCORE) return null;
  if (second && top.score < second.score * MIN_GAP_RATIO) return null;
  if (!tokenSetEqual(top.name, name)) return null;

  const ulanId = top.id.replace(/^ulan\//, "");
  await sleep(400);
  let preview;
  try {
    preview = await fetchPreviewText(top.id);
  } catch (err) {
    console.error(`  ! preview failed for ${top.id}: ${err.message}`);
    return null;
  }
  if (!PLAUSIBLE_ROLE_HINTS.test(preview)) return null;

  return { ulanId, score: top.score, secondScore: second?.score ?? null, previewSnippet: preview.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() };
}

async function main() {
  const write = process.argv.includes("--write");
  const peopleDir = join(repoRoot, "data/people");
  const people = listRecords(peopleDir);

  let checked = 0;
  let matched = 0;

  for (const { path, text, record } of people) {
    if (record.external_ids?.ulan) continue;
    if (MANUAL_EXCLUDE_RTD_IDS.has(record.id)) continue;
    checked++;
    const name = record.name?.preferred;
    if (!name) continue;

    const match = await findConfidentMatch(name);
    await sleep(500); // polite pacing, bounded batch job

    if (match) {
      matched++;
      console.log(`${record.id} ${name}: ULAN ${match.ulanId} (score ${match.score.toFixed(1)}${match.secondScore ? `, runner-up ${match.secondScore.toFixed(1)}` : ""})`);
      console.log(`  ${match.previewSnippet.slice(0, 160)}${match.previewSnippet.length > 160 ? "…" : ""}`);

      if (write) {
        const newExternalIds = { ...(record.external_ids ?? {}), ulan: match.ulanId };
        const parts = Object.entries(newExternalIds).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
        const newLine = `{ ${parts.join(", ")} }`;
        const oldMatch = text.match(/"external_ids":\s*\{[^}]*\}/);
        if (!oldMatch) {
          console.error(`  ! could not locate external_ids line in ${path}, skipped`);
          continue;
        }
        const newText = text.replace(oldMatch[0], `"external_ids": ${newLine}`);
        writeFileSync(path, newText);
      }
    }
  }

  console.log(
    `\nChecked ${checked} people without an existing ULAN id. Found ${matched} confident match(es).` +
      (write ? " Files written." : " Dry run, re-run with --write to apply.")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
