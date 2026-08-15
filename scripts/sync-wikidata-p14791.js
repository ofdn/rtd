#!/usr/bin/env node
// Reconciles RTD's own external_ids.wikidata_qid against Wikidata's
// P14791 ("Registry of Type Design ID") reverse claims.
//
// P14791 lets a Wikidata item declare "this is RTD record rtd-p-000001".
// Some items already carry that claim. This script:
//
//   1. Backfills external_ids.wikidata_qid on any RTD record a Wikidata
//      item already points to via P14791, when the record doesn't have
//      one yet (never overwrites a value a maintainer already entered).
//   2. Flags any record where the two sides disagree (local qid !=
//      Wikidata's declared qid for that rtd id) for manual review -
//      never resolved automatically.
//   3. For records that already have a wikidata_qid but whose Wikidata
//      item has no P14791 claim back, emits a QuickStatements v1 batch
//      (quickstatements.toolforge.org, "V1 commands" input mode) to add
//      it, referenced as "stated in" -> Registry of Type Design (Q140930468).
//   4. Lists RTD records with no wikidata_qid on either side - these need
//      a manual Wikidata search/creation, a script can't invent a match.
//
// This never treats Wikidata as a sources[] entry (see CONTRIBUTING.md,
// "Source policy") - wikidata_qid is a cross-reference, not sourcing.
//
// Usage:
//   node scripts/sync-wikidata-p14791.js                  # dry run, prints report
//   node scripts/sync-wikidata-p14791.js --write           # also backfills RTD json files
//   node scripts/sync-wikidata-p14791.js --qs out.txt      # also writes a QuickStatements batch
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

const RTD_ITEM_QID = "Q140930468"; // "Registry of Type Design" item, used as the reference's "stated in" value
const P14791 = "P14791"; // "Registry of Type Design ID" property

const SPARQL = `SELECT ?item ?rtdid WHERE { ?item wdt:${P14791} ?rtdid. }`;

function listRecords(dir, kind) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const file = join(dir, f);
      const text = readFileSync(file, "utf8");
      return { file, text, kind, record: JSON.parse(text) };
    });
}

function formatCompactObject(obj) {
  const parts = Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return `{ ${parts.join(", ")} }`;
}

async function resolveRedirect(qid) {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=info&format=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RegistryOfTypeDesign/1.0 (https://github.com/ofdn/rtd; P14791 reconciliation script)" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const entity = data.entities?.[qid];
  return entity?.redirects?.to ?? null;
}

async function fetchP14791Claims() {
  const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(SPARQL)}`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "RegistryOfTypeDesign/1.0 (https://github.com/ofdn/rtd; P14791 reconciliation script)",
    },
  });
  if (!res.ok) throw new Error(`SPARQL query failed: HTTP ${res.status}`);
  const data = await res.json();
  // rtd id -> qid. If more than one Wikidata item ever claims the same rtd
  // id (shouldn't happen, but data drifts), keep the first and flag the rest.
  const byRtdId = new Map();
  const dupes = [];
  for (const row of data.results.bindings) {
    const qid = row.item.value.replace("http://www.wikidata.org/entity/", "");
    const rtdid = row.rtdid.value;
    if (byRtdId.has(rtdid) && byRtdId.get(rtdid) !== qid) {
      dupes.push({ rtdid, qids: [byRtdId.get(rtdid), qid] });
    } else {
      byRtdId.set(rtdid, qid);
    }
  }
  return { byRtdId, dupes };
}

function writeQid(file, text, record, qid) {
  const existing = record.external_ids ?? {};
  const newExternalIds = { ...existing, wikidata_qid: qid };
  const oldMatch = text.match(/"external_ids":\s*\{[^}]*\}/);
  if (oldMatch) {
    writeFileSync(file, text.replace(oldMatch[0], `"external_ids": ${formatCompactObject(newExternalIds)}`));
    return;
  }
  if (text.includes('"external_ids"')) {
    console.error(`  ! could not locate external_ids line in ${file}, skipped`);
    return;
  }
  // Record has no external_ids block at all yet - insert one after "id".
  const idMatch = text.match(/"id":\s*"[^"]*",?\n/);
  if (idMatch) {
    const insertion = `  "external_ids": ${formatCompactObject(newExternalIds)},\n`;
    writeFileSync(file, text.replace(idMatch[0], idMatch[0] + insertion));
  } else {
    console.error(`  ! could not locate insertion point in ${file}, skipped`);
  }
}

function quickstatementsLine(qid, rtdid) {
  // QuickStatements v1 tab-separated command: add P14791 with a "stated
  // in" (P248) reference pointing at the Registry of Type Design item.
  return [qid, P14791, `"${rtdid}"`, "S248", RTD_ITEM_QID].join("\t");
}

async function main() {
  const write = process.argv.includes("--write");
  const qsIdx = process.argv.indexOf("--qs");
  const qsOut = qsIdx !== -1 ? process.argv[qsIdx + 1] : null;

  console.log("Querying Wikidata for existing P14791 claims...");
  const { byRtdId: wikidataByRtdId, dupes } = await fetchP14791Claims();
  console.log(`Wikidata has ${wikidataByRtdId.size} items with P14791 set.\n`);

  if (dupes.length) {
    console.log(`! ${dupes.length} rtd id(s) claimed by more than one Wikidata item (manual review):`);
    for (const d of dupes) console.log(`  ${d.rtdid}: ${d.qids.join(", ")}`);
    console.log("");
  }

  const dirs = [
    { dir: join(repoRoot, "data/people"), kind: "person" },
    { dir: join(repoRoot, "data/typefaces"), kind: "typeface" },
  ];
  const all = dirs.flatMap(({ dir, kind }) => listRecords(dir, kind));

  const toBackfill = []; // RTD missing qid, Wikidata has it
  const redirected = []; // RTD's qid was merged into Wikidata's declared qid - safe auto-correct
  const conflicts = []; // RTD has qid, disagrees with Wikidata's, and it's not a redirect
  const needsQuickstatements = []; // RTD has qid, Wikidata has no P14791 back
  const noQidAnywhere = []; // neither side has one

  for (const entry of all) {
    const { record } = entry;
    const localQid = record.external_ids?.wikidata_qid ?? null;
    const wikidataQid = wikidataByRtdId.get(record.id) ?? null;

    if (!localQid && wikidataQid) {
      toBackfill.push({ ...entry, qid: wikidataQid });
    } else if (localQid && wikidataQid && localQid !== wikidataQid) {
      const redirectTarget = await resolveRedirect(localQid);
      if (redirectTarget === wikidataQid) {
        redirected.push({ ...entry, oldQid: localQid, qid: wikidataQid });
      } else {
        conflicts.push({ ...entry, localQid, wikidataQid });
      }
    } else if (localQid && !wikidataQid) {
      needsQuickstatements.push({ ...entry, qid: localQid });
    } else if (!localQid && !wikidataQid) {
      noQidAnywhere.push(entry);
    }
  }

  // --- 1. Backfill RTD records from Wikidata's P14791 claims ---
  console.log(`=== ${toBackfill.length} RTD record(s) can be backfilled with a QID from Wikidata ===`);
  for (const { file, text, record, qid } of toBackfill) {
    console.log(`  + ${record.id} ${record.name?.preferred ?? ""} -> ${qid}`);
    if (write) writeQid(file, text, record, qid);
  }
  console.log(write ? "  (written)\n" : "  (dry run - re-run with --write to apply)\n");

  // --- 1b. Redirected/merged QIDs: RTD's stored qid was merged into another item ---
  console.log(`=== ${redirected.length} RTD record(s) have a stale QID (merged into Wikidata's declared item) ===`);
  for (const { file, text, record, oldQid, qid } of redirected) {
    console.log(`  ~ ${record.id} ${record.name?.preferred ?? ""}: ${oldQid} -> ${qid}`);
    if (write) writeQid(file, text, record, qid);
  }
  console.log(write ? "  (written)\n" : "  (dry run - re-run with --write to apply)\n");

  // --- 2. Conflicts ---
  console.log(`=== ${conflicts.length} conflict(s): RTD and Wikidata disagree on the QID (manual review) ===`);
  for (const { record, localQid, wikidataQid } of conflicts) {
    console.log(`  ${record.id} ${record.name?.preferred ?? ""}: RTD has ${localQid}, Wikidata's P14791 points from ${wikidataQid}`);
  }
  console.log("");

  // --- 3. RTD records with a QID whose Wikidata item lacks P14791 back ---
  console.log(`=== ${needsQuickstatements.length} RTD record(s) have a QID, but that Wikidata item has no P14791 claim yet ===`);
  for (const { record, qid } of needsQuickstatements) {
    console.log(`  ${record.id} ${record.name?.preferred ?? ""} (${qid})`);
  }
  console.log("");

  if (qsOut && needsQuickstatements.length) {
    const lines = needsQuickstatements.map(({ record, qid }) => quickstatementsLine(qid, record.id));
    writeFileSync(qsOut, lines.join("\n") + "\n");
    console.log(`Wrote ${lines.length} QuickStatements v1 command(s) to ${qsOut}`);
    console.log("Paste this file's contents into quickstatements.toolforge.org -> 'V1 commands' import mode.\n");
  } else if (needsQuickstatements.length) {
    console.log("(pass --qs <file.txt> to write a QuickStatements batch for these)\n");
  }

  // --- 4. No QID anywhere ---
  console.log(`=== ${noQidAnywhere.length} RTD record(s) have no Wikidata QID on either side ===`);
  for (const { kind, record } of noQidAnywhere) {
    console.log(`  ${record.id} (${kind}) ${record.name?.preferred ?? record.title ?? ""}`);
  }
}

main();
