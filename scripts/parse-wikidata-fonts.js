#!/usr/bin/env node
// Normalizes a raw Wikidata SPARQL query dump of fonts-in-a-script (as
// exported from query.wikidata.org, one row per item/property-value pair)
// into a clean per-typeface candidate list: typeface name + QID, split into
// likely-person, likely-organization, and license/other values, since the
// dump's value column mixes several different Wikidata properties (creator,
// distributor, license) under one flattened label with no property id to
// tell them apart.
//
// This never writes into data/, it's a read-only research aid. Sourcing and
// scope judgment for anything it surfaces still follows the normal "How to
// add a new person/typeface" workflow in the handoff/CONTRIBUTING.md, since
// Wikidata itself can never be a sources[] entry.
//
// Usage:
//   node scripts/parse-wikidata-fonts.js <input.json> [<input2.json> ...]
//   node scripts/parse-wikidata-fonts.js <input.json> --out candidates.json
import { readFileSync, writeFileSync } from "node:fs";

// Values that are clearly not a person's name: known licenses, generic
// Wikidata class labels that leak through when an item has no real creator
// statement, and the literal QID-as-label placeholder Wikidata shows when
// an item has no label in the query's language.
const NON_PERSON_EXACT = new Set([
  "typeface",
  "typeface family",
  "Unicode typeface",
  "freeware",
  "shareware",
  "proprietary license",
  "GNU General Public License",
  "GNU Project",
  "GPL font exception",
  "SIL Open Font License",
  "SIL Global",
]);

// Organizations/foundries: real values, just not a person. Kept in their
// own bucket rather than discarded, useful for a typeface's `foundry` field.
const ORG_SUFFIX_HINTS =
  /(Ltd\.?|Pvt\.?|Inc\.?|GmbH|Limited|Corporation|Corp\.?|LLC|Project|Institute|University|Foundation|Technology|Technologies|Multimedia|Infotech|Softwares?|Systems?)\b/i;

const KNOWN_ORGS = new Set([
  "Google",
  "Apple Inc.",
  "Microsoft",
  "Monotype",
  "Datasoft",
  "Centre for Development of Advanced Computing",
  "Indian Institute of Technology Madras",
]);

function isQidPlaceholderLabel(itemLabel, qid) {
  return itemLabel === qid;
}

function classifyValue(value) {
  if (NON_PERSON_EXACT.has(value)) return "license_or_generic";
  if (/^Q[0-9]+$/.test(value)) return "license_or_generic"; // unresolved QID label
  if (KNOWN_ORGS.has(value) || ORG_SUFFIX_HINTS.test(value)) return "org";
  return "person";
}

function qidFromUri(uri) {
  const m = /\/entity\/(Q[0-9]+)$/.exec(uri);
  return m ? m[1] : uri;
}

export function parseDump(rows) {
  const byQid = new Map();
  for (const row of rows) {
    const qid = qidFromUri(row.item);
    if (!byQid.has(qid)) {
      byQid.set(qid, {
        wikidata_qid: qid,
        name: isQidPlaceholderLabel(row.itemLabel, qid) ? null : row.itemLabel,
        statements: Number(row.statements) || null,
        sites: Number(row.sites) || null,
        personCandidates: new Set(),
        orgCandidates: new Set(),
        otherValues: new Set(),
      });
    }
    const entry = byQid.get(qid);
    if (!entry.name && !isQidPlaceholderLabel(row.itemLabel, qid)) {
      entry.name = row.itemLabel;
    }
    const value = row.jtrLabel;
    if (!value) continue;
    const kind = classifyValue(value);
    if (kind === "person") entry.personCandidates.add(value);
    else if (kind === "org") entry.orgCandidates.add(value);
    else entry.otherValues.add(value);
  }

  return [...byQid.values()]
    .map((e) => ({
      wikidata_qid: e.wikidata_qid,
      name: e.name ?? e.wikidata_qid,
      statements: e.statements,
      sites: e.sites,
      personCandidates: [...e.personCandidates].sort(),
      orgCandidates: [...e.orgCandidates].sort(),
      otherValues: [...e.otherValues].sort(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
  const inputPaths = args.filter((a, i) => a !== "--out" && (outIdx === -1 || i !== outIdx + 1));

  if (!inputPaths.length) {
    console.error(
      "Usage: node scripts/parse-wikidata-fonts.js <input.json> [<input2.json> ...] [--out candidates.json]"
    );
    process.exit(1);
  }

  const rows = inputPaths.flatMap((p) => JSON.parse(readFileSync(p, "utf8")));
  const candidates = parseDump(rows);

  const withPerson = candidates.filter((c) => c.personCandidates.length > 0);
  const withoutPerson = candidates.filter((c) => c.personCandidates.length === 0);

  console.log(
    `Parsed ${rows.length} rows -> ${candidates.length} unique typefaces (${inputPaths.join(", ")})`
  );
  console.log(`  ${withPerson.length} have at least one person-shaped creator candidate`);
  console.log(`  ${withoutPerson.length} have none (org/license/unlabeled only)`);

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(candidates, null, 2) + "\n");
    console.log(`\nWrote ${outPath}`);
  } else {
    console.log("\n(pass --out <file.json> to save the full candidate list)");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
