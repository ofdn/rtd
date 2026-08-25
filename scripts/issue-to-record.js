#!/usr/bin/env node
// Turns a submitted "New person" / "New typeface" issue (see
// .github/ISSUE_TEMPLATE/) into a schema-valid JSON record, run from CI
// (.github/workflows/issue-to-pr.yml) after an issue is opened.
//
// This never merges anything itself - it writes the file, runs the same
// validation `npm run validate` runs, and reports the outcome so the
// workflow can either open a PR for a maintainer to review, or comment on
// the issue explaining what's missing. See CONTRIBUTING.md: a human still
// checks that sources support the claims and the record isn't a
// duplicate, this script only removes the JSON-typing step.
//
// Usage: node scripts/issue-to-record.js <person|typeface>
// Reads the issue body from the ISSUE_BODY env var. Results are written to
// $GITHUB_OUTPUT (using a random per-value delimiter, not a fixed one -
// the issue body is untrusted input, and a fixed "EOF" marker could be
// forged by a line inside it to inject extra output keys). Falls back to
// printing "OUTPUT key=value" to stdout when GITHUB_OUTPUT isn't set, for
// local testing. A human-readable report goes to stderr either way.
import { existsSync, writeFileSync, appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  KIND_CONFIG,
  slugify,
  listRecords,
  nextId,
  uniqueSlug,
  sameNameCollisions,
} from "./lib/records.js";
import { validateRoot } from "./validate.js";

function setOutput(key, value) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) {
    console.log(`OUTPUT ${key}=${value}`);
    return;
  }
  const delimiter = `ghadelim_${randomUUID()}`;
  appendFileSync(outFile, `${key}<<${delimiter}\n${value}\n${delimiter}\n`);
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

// Must match the exact `label:` text in the issue form YAML - see the
// comment at the top of each .github/ISSUE_TEMPLATE/*.yml file.
const PERSON_LABELS = {
  name: "Full name (preferred form)",
  alternates: "Alternate names or spellings",
  sortName: "Sort name",
  birthYear: "Birth year",
  deathYear: "Death year",
  countries: "Countries",
  roles: "Roles",
  activeStart: "Active years - start",
  activeEnd: "Active years - end",
  scripts: "Writing systems worked in",
  affiliations: "Affiliations",
  placeOfBirth: "Place of birth",
  placeOfDeath: "Place of death",
  almaMater: "Alma mater",
  positionsHeld: "Positions held",
  bio: "Short bio",
  sources: "Sources",
  sourceLanguage: "Primary language of your source(s)",
  confidence: "How solid is this source?",
  wikidataQid: "Wikidata QID",
  viaf: "VIAF",
  isni: "ISNI",
  lcNaf: "LC/NAF",
  gnd: "GND",
  worldcatEntity: "WorldCat entity",
  ulan: "ULAN",
  notes: "Anything else the maintainer should know?",
};

const TYPEFACE_LABELS = {
  name: "Typeface name (preferred form)",
  alternates: "Alternate names or spellings",
  designers: "Designer(s)",
  noDesignerReason: "If no individual designer is known, why?",
  foundry: "Foundry / publisher",
  designYear: "Design year",
  releaseYear: "Release year",
  classification: "Classification",
  scripts: "Scripts",
  era: "Era",
  unicodeCompliant: "Unicode-compliant?",
  description: "Short description",
  sources: "Sources",
  sourceLanguage: "Primary language of your source(s)",
  confidence: "How solid is this source?",
  wikidataQid: "Wikidata QID",
  viaf: "VIAF",
  isni: "ISNI",
  lcNaf: "LC/NAF",
  gnd: "GND",
  worldcatEntity: "WorldCat entity",
  notes: "Anything else the maintainer should know?",
};

function parseIssueForm(body) {
  const fields = {};
  const parts = body.split(/\r?\n(?=### )/);
  for (const part of parts) {
    const m = part.match(/^### (.+?)\r?\n\r?\n([\s\S]*)$/);
    if (!m) continue;
    const label = m[1].trim();
    let value = m[2].trim();
    if (value === "_No response_") value = "";
    fields[label] = value;
  }
  return fields;
}

function csv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function lines(value) {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// "URL | Title" per line, tolerant of an accidental missing pipe (the
// whole line becomes the url, title falls back to the url itself -
// npm run validate will reject a bad url shape and the PR will surface
// that for a human to fix rather than silently dropping the source).
function parseSources(value) {
  return lines(value).map((line) => {
    const idx = line.indexOf("|");
    if (idx === -1) return { url: line, title: line };
    const url = line.slice(0, idx).trim();
    const title = line.slice(idx + 1).trim() || url;
    return { url, title };
  });
}

function buildExternalIds(fields, labels, keys) {
  const out = {};
  for (const [schemaKey, labelKey] of keys) {
    const v = (fields[labels[labelKey]] || "").trim();
    if (v) out[schemaKey] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function verificationStatus(confidenceValue) {
  return /^thin/i.test(confidenceValue || "")
    ? "needs_verification"
    : undefined; // undefined -> field omitted, schema default is "verified"
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function buildPerson(fields) {
  const L = PERSON_LABELS;
  const name = (fields[L.name] || "").trim();
  const roles = csv(fields[L.roles]);
  if (!name) return { error: "Missing required field: " + L.name };
  if (!roles.length) return { error: "Missing required field: " + L.roles };

  const record = {
    name: { preferred: name, alternates: csv(fields[L.alternates]) },
    roles,
    sources: parseSources(fields[L.sources]),
    record_status: "active",
    superseded_by: null,
  };
  if (fields[L.sortName]) record.sort_name = fields[L.sortName].trim();
  if (fields[L.birthYear]) record.birth_year = fields[L.birthYear].trim();
  if (fields[L.deathYear]) record.death_year = fields[L.deathYear].trim();
  const countries = csv(fields[L.countries]);
  if (countries.length) record.countries = countries;
  const activeStart = (fields[L.activeStart] || "").trim();
  const activeEnd = (fields[L.activeEnd] || "").trim();
  if (activeStart || activeEnd) {
    record.active_years = {};
    if (activeStart) record.active_years.start = activeStart;
    if (activeEnd) record.active_years.end = activeEnd;
  }
  const scripts = csv(fields[L.scripts]);
  if (scripts.length) record.scripts = scripts;
  if (fields[L.placeOfBirth]) record.place_of_birth = fields[L.placeOfBirth].trim();
  if (fields[L.placeOfDeath]) record.place_of_death = fields[L.placeOfDeath].trim();
  const almaMater = csv(fields[L.almaMater]);
  if (almaMater.length) record.alma_mater = almaMater;
  if (fields[L.bio]) record.bio = fields[L.bio].trim();
  const externalIds = buildExternalIds(fields, L, [
    ["wikidata_qid", "wikidataQid"],
    ["viaf", "viaf"],
    ["isni", "isni"],
    ["lc_naf", "lcNaf"],
    ["gnd", "gnd"],
    ["worldcat_entity", "worldcatEntity"],
    ["ulan", "ulan"],
  ]);
  if (externalIds) record.external_ids = externalIds;
  const vs = verificationStatus(fields[L.confidence]);
  if (vs) record.verification_status = vs;

  // Affiliations and positions_held are free text in the form (studio +
  // years on one line) and not reliably splittable into the schema's
  // {name/title, start_year, end_year} shape - left for the maintainer to
  // add by hand from the issue body rather than guessed at here.
  const manualNotes = [];
  if (fields[L.affiliations]) {
    manualNotes.push(`Affiliations (from issue, add manually if useful):\n${fields[L.affiliations]}`);
  }
  if (fields[L.positionsHeld]) {
    manualNotes.push(`Positions held (from issue, add manually if useful):\n${fields[L.positionsHeld]}`);
  }

  return { record, manualNotes, sourceLanguage: fields[L.sourceLanguage], notes: fields[L.notes] };
}

// Resolves each "Name | role" / "rtd-p-###### | role" line against
// data/people. Returns { designers, unresolved } - any unresolved name
// means the caller must not open a PR (there's no valid id to write).
function resolveDesigners(value, peopleRecords) {
  const designers = [];
  const unresolved = [];
  for (const line of lines(value)) {
    const idx = line.indexOf("|");
    const namePart = (idx === -1 ? line : line.slice(0, idx)).trim();
    const role = (idx === -1 ? "" : line.slice(idx + 1).trim()) || "type designer";
    if (/^rtd-p-\d{6}$/.test(namePart)) {
      designers.push({ id: namePart, role });
      continue;
    }
    const matches = peopleRecords.filter(
      (r) =>
        r.record_status === "active" &&
        r.name?.preferred?.toLowerCase() === namePart.toLowerCase()
    );
    if (matches.length === 1) {
      designers.push({ id: matches[0].id, role });
    } else if (matches.length === 0) {
      unresolved.push(`"${namePart}" - no active person record with this exact preferred name. Open a "New person" issue for them first, or fix the spelling to match the registry.`);
    } else {
      unresolved.push(`"${namePart}" - matches ${matches.length} existing person records (${matches.map((m) => m.id).join(", ")}), ambiguous. Use their rtd-p-###### id instead.`);
    }
  }
  return { designers, unresolved };
}

function buildTypeface(fields, peopleRecords) {
  const L = TYPEFACE_LABELS;
  const name = (fields[L.name] || "").trim();
  if (!name) return { error: "Missing required field: " + L.name };

  const designersRaw = (fields[L.designers] || "").trim();
  const noDesignerReason = (fields[L.noDesignerReason] || "").trim();

  let designers = [];
  let attribution;
  if (designersRaw) {
    const { designers: resolved, unresolved } = resolveDesigners(designersRaw, peopleRecords);
    if (unresolved.length) {
      return { error: "Could not resolve designer(s):\n" + unresolved.map((u) => `- ${u}`).join("\n") };
    }
    if (!resolved.length) {
      return { error: "Missing required field: " + L.designers };
    }
    designers = resolved;
  } else if (noDesignerReason) {
    attribution = { unknown: true, note: noDesignerReason };
  } else {
    return {
      error: `Missing required field: either ${L.designers}, or ${L.noDesignerReason} explaining why no individual designer is known.`,
    };
  }

  const record = {
    name: { preferred: name, alternates: csv(fields[L.alternates]) },
    designers,
    ...(attribution ? { attribution } : {}),
    sources: parseSources(fields[L.sources]),
    record_status: "active",
    superseded_by: null,
  };
  const foundry = lines(fields[L.foundry]).map((line) => {
    const urlMatch = line.match(/https?:\/\/\S+/);
    if (!urlMatch) return { name: line };
    const url = urlMatch[0];
    const name = line.replace(url, "").replace(/[-|,]\s*$/, "").trim();
    return name ? { name, url } : { name: url, url };
  });
  if (foundry.length) record.foundry = foundry;
  if (fields[L.designYear]) record.design_year = fields[L.designYear].trim();
  if (fields[L.releaseYear]) record.release_year = fields[L.releaseYear].trim();
  if (fields[L.classification]) record.classification = fields[L.classification].trim();
  const scripts = csv(fields[L.scripts]);
  if (scripts.length) record.scripts = scripts;
  const era = (fields[L.era] || "").trim();
  if (["digital", "metal", "phototype", "wood", "other"].includes(era)) record.era = era;
  const unicode = (fields[L.unicodeCompliant] || "").trim();
  if (unicode === "Yes") record.unicode_compliant = true;
  else if (unicode === "No") record.unicode_compliant = false;
  if (fields[L.description]) record.description = fields[L.description].trim();
  const externalIds = buildExternalIds(fields, L, [
    ["wikidata_qid", "wikidataQid"],
    ["viaf", "viaf"],
    ["isni", "isni"],
    ["lc_naf", "lcNaf"],
    ["gnd", "gnd"],
    ["worldcat_entity", "worldcatEntity"],
  ]);
  if (externalIds) record.external_ids = externalIds;
  const vs = verificationStatus(fields[L.confidence]);
  if (vs) record.verification_status = vs;

  return { record, sourceLanguage: fields[L.sourceLanguage], notes: fields[L.notes] };
}

function main() {
  const kind = process.argv[2];
  if (kind !== "person" && kind !== "typeface") {
    console.error('Usage: node scripts/issue-to-record.js <person|typeface>');
    process.exit(2);
  }
  const body = process.env.ISSUE_BODY || "";
  const fields = parseIssueForm(body);

  const { dir, prefix } = KIND_CONFIG[kind];
  const absDir = join(repoRoot, dir);
  const records = listRecords(absDir);
  const peopleRecords = kind === "typeface" ? listRecords(join(repoRoot, "data/people")) : [];

  const built = kind === "person" ? buildPerson(fields) : buildTypeface(fields, peopleRecords);

  if (built.error) {
    setOutput("created", "false");
    setOutput("error_message", built.error);
    console.error(`Could not build a record:\n${built.error}`);
    return;
  }

  const { record, manualNotes = [], sourceLanguage, notes } = built;

  // Credits whoever actually submitted the issue, not the bot that opened
  // the PR on their behalf - see contributed_by[] on both schemas and the
  // citation-author logic in site-templates/shared.js.
  const issueAuthor = (process.env.ISSUE_AUTHOR || "").trim();
  if (issueAuthor) {
    record.contributed_by = [{ name: issueAuthor, type: "individual", url: `https://github.com/${issueAuthor}` }];
  }

  const rawName = record.name.preferred;
  const id = nextId(records, prefix);
  const baseSlug = slugify(rawName);
  const existingSlugs = new Set(records.map((r) => r.slug));
  const slug = uniqueSlug(baseSlug, existingSlugs);
  const collisions = sameNameCollisions(records, rawName);

  record.id = id;
  record.slug = slug;
  record.created_at = today();
  record.updated_at = today();
  // Re-order so id/slug/name lead, matching every hand-written record.
  const final = {
    id: record.id,
    slug: record.slug,
    name: record.name,
    ...Object.fromEntries(Object.entries(record).filter(([k]) => !["id", "slug", "name"].includes(k))),
  };

  const outPath = join(absDir, `${slug}.json`);
  if (existsSync(outPath)) {
    setOutput("created", "false");
    setOutput("error_message", `Refusing to overwrite existing file: ${dir}/${slug}.json`);
    console.error(`Refusing to overwrite existing file: ${outPath}`);
    return;
  }
  writeFileSync(outPath, JSON.stringify(final, null, 2) + "\n");

  // validateRoot checks the whole dataset, not just this file - narrow to
  // messages actually about the record just written, so an unrelated
  // pre-existing issue elsewhere in data/ doesn't show up as noise on
  // every generated PR.
  const { errors: allErrors, warnings: allWarnings } = validateRoot(join(repoRoot, "data"));
  const errors = allErrors.filter((e) => e.startsWith(`${outPath}:`));
  const warnings = allWarnings.filter((w) => w.includes(id) || w.includes(slug));

  const reportLines = [];
  if (collisions.length) {
    reportLines.push(
      `**Possible duplicate**: ${collisions.length} existing active ${kind} record(s) already use the name "${rawName}": ${collisions.map((r) => `${r.id} (${r.slug})`).join(", ")}. Confirm this isn't the same ${kind} before merging.`
    );
  }
  if (sourceLanguage && sourceLanguage.startsWith("Other")) {
    reportLines.push(`**Source language flagged as "Other"** - needs translation review before merging (see CONTRIBUTING.md).`);
  }
  if (manualNotes.length) reportLines.push(...manualNotes);
  if (notes) reportLines.push(`**Submitter notes**: ${notes}`);
  if (errors.length) {
    reportLines.push(`**\`npm run validate\` failed** - fix before merging:\n${errors.map((e) => `- ${e}`).join("\n")}`);
  }
  if (warnings.length) {
    reportLines.push(`**Validation warnings** (non-fatal):\n${warnings.map((w) => `- ${w}`).join("\n")}`);
  }

  setOutput("created", "true");
  setOutput("file", `${dir}/${slug}.json`);
  setOutput("record_id", id);
  setOutput("record_slug", slug);
  setOutput("record_name", rawName);
  setOutput("validation_failed", String(errors.length > 0));
  setOutput("report", reportLines.join("\n\n") || "No issues flagged.");
  console.error(`Wrote ${dir}/${slug}.json (${id})`);
  if (errors.length) console.error(`Validation errors:\n${errors.map((e) => `  - ${e}`).join("\n")}`);
}

main();
