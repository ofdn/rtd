#!/usr/bin/env node
// Validates data/people/*.json and data/typefaces/*.json against the JSON
// schemas, plus rules a JSON Schema can't express on its own: filename/slug
// match, id uniqueness, cross-entity referential integrity, and the
// no-Wikimedia-project-as-a-source rule.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

// Domains that can never appear in a `sources[].url`, see the
// registry-sourcing-policy memory: citing Wikidata/Wikipedia/any Wikimedia
// project here would create a circular-sourcing loop and block Wikidata
// from ever citing this registry back.
const BLOCKED_SOURCE_DOMAINS = [
  "wikipedia.org",
  "wikidata.org",
  "wikimedia.org",
  "wikisource.org",
  "wiktionary.org",
  "wikibooks.org",
  "wikinews.org",
  "wikiquote.org",
  "wikiversity.org",
  "wikivoyage.org",
  "mediawiki.org",
];

function isBlockedSourceUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false; // malformed URL is caught by schema's format:"uri" check
  }
  return BLOCKED_SOURCE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(dir, f));
}

export function validateRoot(rootDir) {
  const errors = [];
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);

  const personSchema = loadJson(join(repoRoot, "schema/person.schema.json"));
  const typefaceSchema = loadJson(
    join(repoRoot, "schema/typeface.schema.json")
  );
  const validatePerson = ajv.compile(personSchema);
  const validateTypeface = ajv.compile(typefaceSchema);

  const peopleDir = join(rootDir, "people");
  const typefacesDir = join(rootDir, "typefaces");

  const peopleFiles = listRecords(peopleDir);
  const typefaceFiles = listRecords(typefacesDir);

  const allIds = new Map(); // id -> file (across both types, since a collision either way is a bug)
  const personIds = new Set();

  function checkSlugAndSchema(file, record, validateFn, kind) {
    const expectedSlug = basename(file, ".json");
    if (record.slug !== expectedSlug) {
      errors.push(
        `${file}: filename does not match slug (filename implies "${expectedSlug}", slug field is "${record.slug}")`
      );
    }
    if (!validateFn(record)) {
      for (const err of validateFn.errors) {
        errors.push(`${file}: ${err.instancePath || "(root)"} ${err.message}`);
      }
    }
    if (record.id) {
      if (allIds.has(record.id)) {
        errors.push(
          `${file}: duplicate id "${record.id}" (already used by ${allIds.get(record.id)})`
        );
      } else {
        allIds.set(record.id, file);
      }
      if (kind === "person") personIds.add(record.id);
    }
    for (const source of record.sources ?? []) {
      if (isBlockedSourceUrl(source.url)) {
        errors.push(
          `${file}: sources contains a Wikimedia-project URL ("${source.url}"), not allowed, see CONTRIBUTING.md`
        );
      }
    }
  }

  const people = [];
  for (const file of peopleFiles) {
    const record = loadJson(file);
    checkSlugAndSchema(file, record, validatePerson, "person");
    people.push({ file, record });
  }

  const typefaces = [];
  for (const file of typefaceFiles) {
    const record = loadJson(file);
    checkSlugAndSchema(file, record, validateTypeface, "typeface");
    typefaces.push({ file, record });
  }

  // Referential integrity: every typeface.designers[].id must be a known person id.
  for (const { file, record } of typefaces) {
    for (const designer of record.designers ?? []) {
      if (designer.id && !personIds.has(designer.id)) {
        errors.push(
          `${file}: designers references unknown person id "${designer.id}"`
        );
      }
    }
  }

  // Redirect stubs (see scripts/build.js) are generated at each entry in
  // previous_slugs, so a collision here would mean two records fighting
  // over the same URL, or a redirect silently shadowing a real page.
  function checkPreviousSlugs(records, kind) {
    const currentSlugs = new Set(records.map(({ record }) => record.slug));
    const oldSlugOwners = new Map(); // old slug -> file that claims it
    for (const { file, record } of records) {
      for (const oldSlug of record.previous_slugs ?? []) {
        if (oldSlug === record.slug) {
          errors.push(
            `${file}: previous_slugs contains "${oldSlug}", which is this record's current slug`
          );
        } else if (currentSlugs.has(oldSlug)) {
          errors.push(
            `${file}: previous_slugs entry "${oldSlug}" collides with another ${kind}'s current slug`
          );
        } else if (oldSlugOwners.has(oldSlug)) {
          errors.push(
            `${file}: previous_slugs entry "${oldSlug}" is already claimed by ${oldSlugOwners.get(oldSlug)}`
          );
        } else {
          oldSlugOwners.set(oldSlug, file);
        }
      }
    }
  }
  checkPreviousSlugs(people, "person");
  checkPreviousSlugs(typefaces, "typeface");

  // Non-fatal: more than one active record sharing a preferred name. Two
  // real people (or two real typefaces) can legitimately share a name, so
  // this doesn't fail CI, but it's worth a human glance to confirm it isn't
  // an accidental duplicate and that each record is actually
  // distinguishable (different slug, and a bio/description specific enough
  // to tell them apart). See the disambiguation convention in
  // CONTRIBUTING.md.
  const warnings = [];
  function checkNameCollisions(records, kind) {
    const byName = new Map();
    for (const { record } of records) {
      if (record.record_status !== "active") continue;
      const key = record.name?.preferred?.toLowerCase();
      if (!key) continue;
      const list = byName.get(key) ?? [];
      list.push(record);
      byName.set(key, list);
    }
    for (const group of byName.values()) {
      if (group.length > 1) {
        warnings.push(
          `${group.length} active ${kind} records are named "${group[0].name.preferred}": ${group
            .map((r) => `${r.id} (${r.slug})`)
            .join(", ")}. Confirm these are distinct ${kind}s, not a duplicate.`
        );
      }
    }
  }
  checkNameCollisions(people, "person");
  checkNameCollisions(typefaces, "typeface");

  return {
    errors,
    warnings,
    peopleCount: people.length,
    typefacesCount: typefaces.length,
  };
}

function main() {
  const rootDir = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : join(repoRoot, "data");

  const { errors, warnings, peopleCount, typefacesCount } = validateRoot(rootDir);

  if (warnings.length > 0) {
    console.warn(`Warnings (${warnings.length}, non-fatal):\n`);
    for (const w of warnings) console.warn(`  - ${w}`);
    console.warn("");
  }

  if (errors.length > 0) {
    console.error(`Validation failed (${errors.length} error(s)):\n`);
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  console.log(
    `Validation passed: ${peopleCount} people, ${typefacesCount} typefaces.`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
