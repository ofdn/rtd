#!/usr/bin/env node
// Cross-references a parsed Wikidata fonts-in-a-script dump (see
// parse-wikidata-fonts.js) against the people/typefaces already in data/,
// to answer: which of these typefaces are already in RTD, which have a
// creator RTD already knows about but no typeface record yet, which name a
// person already confirmed unsourceable in an earlier research pass, and
// which are genuinely new and still need the normal sourcing workflow.
//
// Read-only, never writes into data/. This is a triage report, not an
// importer: adding a person still requires independent, non-Wikidata
// sourcing (see CONTRIBUTING.md / handoff "How to add a new person/
// typeface"), and adding a typeface for an already-known designer still
// needs its own source, not just a Wikidata claim.
//
// Usage:
//   node scripts/dedup-font-designers.js <input.json> [<input2.json> ...]
//   node scripts/dedup-font-designers.js <input.json> --out report.json
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseDump } from "./parse-wikidata-fonts.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

// Names already independently researched and confirmed to have zero
// independent sources or Wikidata claim references anywhere (South Asia
// occupation expansion session, see handoff "Remaining work"). Re-listed
// here so the dedup report doesn't send these back through research again;
// update this list if a name is ever re-checked and found sourceable.
// (Sandeep Shedmake was on this list until 2026-08-07, when an independent
// font-catalog credit for Samyak Oriya surfaced him as a real co-creator,
// see data/people/sandeep-shedmake.json.)
const KNOWN_UNSOURCEABLE = new Set([
  "Sujata Patel",
  "Sushant Dash",
  "Chaitanya Parida",
]);

function slugifyName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

function buildPeopleIndex(people) {
  const byName = new Map();
  for (const p of people) {
    const names = [p.name?.preferred, p.sort_name, ...(p.name?.alternates ?? [])].filter(Boolean);
    for (const n of names) {
      byName.set(slugifyName(n), p);
    }
  }
  return byName;
}

function buildTypefaceIndex(typefaces) {
  const byQid = new Map();
  const byName = new Map();
  for (const t of typefaces) {
    const qid = t.external_ids?.wikidata_qid;
    if (qid) byQid.set(qid, t);
    const names = [t.name?.preferred, ...(t.name?.alternates ?? [])].filter(Boolean);
    for (const n of names) byName.set(slugifyName(n), t);
  }
  return { byQid, byName };
}

function classifyCandidate(candidate, peopleIndex, typefaceIndex) {
  const matchedTypeface =
    typefaceIndex.byQid.get(candidate.wikidata_qid) ??
    typefaceIndex.byName.get(slugifyName(candidate.name));

  const creators = candidate.personCandidates.map((name) => {
    if (KNOWN_UNSOURCEABLE.has(name)) return { name, status: "known_unsourceable" };
    const match = peopleIndex.get(slugifyName(name));
    return match
      ? { name, status: "matched", rtd_id: match.id, rtd_slug: match.slug }
      : { name, status: "new" };
  });

  let bucket;
  if (matchedTypeface) {
    bucket = "already_in_rtd";
  } else if (creators.length === 0) {
    bucket = "no_person_candidate";
  } else if (creators.every((c) => c.status === "known_unsourceable")) {
    bucket = "skip_unsourceable";
  } else if (creators.some((c) => c.status === "matched")) {
    bucket = "ready_to_link";
  } else {
    bucket = "needs_research";
  }

  return {
    wikidata_qid: candidate.wikidata_qid,
    name: candidate.name,
    matched_typeface: matchedTypeface
      ? { id: matchedTypeface.id, slug: matchedTypeface.slug }
      : null,
    creators,
    orgCandidates: candidate.orgCandidates,
    bucket,
  };
}

function printBucket(label, items, describe) {
  if (!items.length) return;
  console.log(`\n=== ${label} (${items.length}) ===`);
  for (const item of items) console.log(describe(item));
}

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outPath = outIdx !== -1 ? args[outIdx + 1] : null;
  const inputPaths = args.filter((a, i) => a !== "--out" && (outIdx === -1 || i !== outIdx + 1));

  if (!inputPaths.length) {
    console.error(
      "Usage: node scripts/dedup-font-designers.js <input.json> [<input2.json> ...] [--out report.json]"
    );
    process.exit(1);
  }

  const rows = inputPaths.flatMap((p) => JSON.parse(readFileSync(p, "utf8")));
  const candidates = parseDump(rows);

  const people = listRecords(join(repoRoot, "data/people"));
  const typefaces = listRecords(join(repoRoot, "data/typefaces"));
  const peopleIndex = buildPeopleIndex(people);
  const typefaceIndex = buildTypefaceIndex(typefaces);

  const results = candidates.map((c) => classifyCandidate(c, peopleIndex, typefaceIndex));

  const byBucket = {
    already_in_rtd: results.filter((r) => r.bucket === "already_in_rtd"),
    ready_to_link: results.filter((r) => r.bucket === "ready_to_link"),
    needs_research: results.filter((r) => r.bucket === "needs_research"),
    skip_unsourceable: results.filter((r) => r.bucket === "skip_unsourceable"),
    no_person_candidate: results.filter((r) => r.bucket === "no_person_candidate"),
  };

  console.log(`Classified ${results.length} typefaces from ${inputPaths.join(", ")}`);
  console.log(`  already_in_rtd:      ${byBucket.already_in_rtd.length}`);
  console.log(`  ready_to_link:       ${byBucket.ready_to_link.length} (known RTD person, typeface record missing)`);
  console.log(`  needs_research:      ${byBucket.needs_research.length} (new/unresearched creator name)`);
  console.log(`  skip_unsourceable:   ${byBucket.skip_unsourceable.length} (all creators already confirmed unsourceable)`);
  console.log(`  no_person_candidate: ${byBucket.no_person_candidate.length} (org/license/unlabeled only, no creator to chase)`);

  printBucket(
    "ready_to_link",
    byBucket.ready_to_link,
    (r) =>
      `  ${r.name} (${r.wikidata_qid}) -> ${r.creators
        .filter((c) => c.status === "matched")
        .map((c) => `${c.name} [${c.rtd_id}]`)
        .join(", ")}` +
      (r.creators.some((c) => c.status !== "matched")
        ? `  [also: ${r.creators.filter((c) => c.status !== "matched").map((c) => `${c.name} (${c.status})`).join(", ")}]`
        : "")
  );

  printBucket(
    "needs_research",
    byBucket.needs_research,
    (r) => `  ${r.name} (${r.wikidata_qid}) -> ${r.creators.map((c) => `${c.name} (${c.status})`).join(", ")}`
  );

  printBucket(
    "skip_unsourceable",
    byBucket.skip_unsourceable,
    (r) => `  ${r.name} (${r.wikidata_qid}) -> ${r.creators.map((c) => c.name).join(", ")}`
  );

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(byBucket, null, 2) + "\n");
    console.log(`\nWrote full report: ${outPath}`);
  }
}

main();
