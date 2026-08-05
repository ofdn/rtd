#!/usr/bin/env node
// Backfills external_ids (viaf, isni, lc_naf, gnd, worldcat_entity) from
// each record's existing wikidata_qid, since Wikidata already tracks these
// as authority-control claims. This is not "sourcing from Wikidata": these
// fields are cross-references, never a `sources[]` entry, the same rule
// that already applies to wikidata_qid itself (see CONTRIBUTING.md). Never
// overwrites a value a maintainer already entered by hand, only fills in
// what's currently missing.
//
// Usage:
//   node scripts/import-external-ids.js            # dry run, prints a report
//   node scripts/import-external-ids.js --write     # also writes the files
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

// Wikidata property -> external_ids field. P10832 (WorldCat Entities ID)
// is checked too, but is rarely populated, most WorldCat entity ids will
// still need a manual lookup at id.oclc.org.
const PROPERTY_MAP = {
  P214: "viaf",
  P213: "isni",
  P244: "lc_naf",
  P227: "gnd",
  P10832: "worldcat_entity",
};

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const text = readFileSync(join(dir, f), "utf8");
      return { file: join(dir, f), text, record: JSON.parse(text) };
    });
}

// Records are hand-formatted with short objects/arrays kept on one line
// (not what a plain JSON.stringify(record, null, 2) rewrite would
// produce, that expands every array/object, see git history for what
// happens when a script forgets this). Patch just the external_ids line
// in place instead of rewriting the whole file, so the diff only shows
// the actual content change.
function formatCompactObject(obj) {
  const parts = Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{ ${parts.join(", ")} }`;
}

async function fetchClaims(qid) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RegistryOfTypeDesign/1.0 (https://github.com/ofdn/rtd; external-id backfill script)" },
  });
  if (!res.ok) throw new Error(`${qid}: HTTP ${res.status}`);
  const data = await res.json();
  const entity = Object.values(data.entities)[0];
  const claims = entity.claims || {};
  const found = {};
  for (const [prop, field] of Object.entries(PROPERTY_MAP)) {
    const claim = claims[prop]?.[0]?.mainsnak?.datavalue?.value;
    if (typeof claim === "string" && claim) found[field] = claim;
  }
  return found;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const write = process.argv.includes("--write");
  const dirs = [
    { dir: join(repoRoot, "data/people"), kind: "person" },
    { dir: join(repoRoot, "data/typefaces"), kind: "typeface" },
  ];

  let checked = 0;
  let updatedRecords = 0;
  let fieldsAdded = 0;

  for (const { dir, kind } of dirs) {
    for (const { file, text, record } of listRecords(dir)) {
      const qid = record.external_ids?.wikidata_qid;
      if (!qid) continue;
      checked++;

      let found;
      try {
        found = await fetchClaims(qid);
      } catch (err) {
        console.error(`${record.id} (${qid}): fetch failed - ${err.message}`);
        continue;
      }

      const existing = record.external_ids ?? {};
      const missing = Object.entries(found).filter(([field]) => !existing[field]);

      if (missing.length) {
        console.log(`${record.id} ${record.name?.preferred ?? ""} (${qid}):`);
        for (const [field, value] of missing) {
          console.log(`  + ${field}: ${value}`);
        }
        updatedRecords++;
        fieldsAdded += missing.length;

        if (write) {
          const newExternalIds = { ...existing, ...Object.fromEntries(missing) };
          const oldMatch = text.match(/"external_ids":\s*\{[^}]*\}/);
          if (!oldMatch) {
            console.error(`  ! could not locate external_ids line in ${file}, skipped`);
            continue;
          }
          const newText = text.replace(oldMatch[0], `"external_ids": ${formatCompactObject(newExternalIds)}`);
          writeFileSync(file, newText);
        }
      }

      // Be polite to Wikidata's API, this is a bounded batch job, not a
      // scraper, no need to hammer it even though the dataset is small.
      await sleep(200);
    }
  }

  console.log(
    `\nChecked ${checked} records with a wikidata_qid. ${updatedRecords} had new identifiers (${fieldsAdded} fields total).` +
      (write ? " Files written." : " Dry run, re-run with --write to apply.")
  );
}

main();
