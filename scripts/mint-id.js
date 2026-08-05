#!/usr/bin/env node
// Computes the next free id and a collision-safe slug for a new person or
// typeface record, so contributors don't have to eyeball the highest
// existing id by hand (see CONTRIBUTING.md). Makes no filesystem changes
// unless --write is passed.
//
// Usage:
//   node scripts/mint-id.js person "Nasim Ali"
//   node scripts/mint-id.js typeface "Some Typeface" --write
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");

const KIND_CONFIG = {
  person: { dir: "data/people", prefix: "RTD-P-" },
  typeface: { dir: "data/typefaces", prefix: "RTD-T-" },
};

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadJson(join(dir, f)));
}

function nextId(records, prefix) {
  let max = 0;
  const idPattern = new RegExp(`^${prefix}(\\d{6})$`);
  for (const record of records) {
    const m = idPattern.exec(record.id ?? "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

// If the plain slug is taken, append -2, -3, ... rather than a birth year
// or role (those aren't always known at mint time). Once the record is
// drafted, a contributor is free to hand-pick a more descriptive
// disambiguator (e.g. "nasim-ali-1952") before opening the PR, this is
// just a safe default that guarantees no filename collision.
function uniqueSlug(baseSlug, existingSlugs) {
  if (!existingSlugs.has(baseSlug)) return baseSlug;
  let n = 2;
  while (existingSlugs.has(`${baseSlug}-${n}`)) n++;
  return `${baseSlug}-${n}`;
}

function buildStub(kind, id, slug, name, today) {
  const base = {
    id,
    slug,
    name: { preferred: name, alternates: [] },
  };
  if (kind === "person") {
    return {
      ...base,
      countries: [],
      roles: [],
      bio: "",
      sources: [],
      record_status: "active",
      superseded_by: null,
      created_at: today,
      updated_at: today,
    };
  }
  return {
    ...base,
    designers: [],
    sources: [],
    record_status: "active",
    superseded_by: null,
    created_at: today,
    updated_at: today,
  };
}

function main() {
  const [, , kindArg, nameArg, ...rest] = process.argv;
  const write = rest.includes("--write");

  if (!kindArg || !KIND_CONFIG[kindArg] || !nameArg) {
    console.error(
      'Usage: node scripts/mint-id.js <person|typeface> "Full Name" [--write]'
    );
    process.exit(1);
  }

  const { dir, prefix } = KIND_CONFIG[kindArg];
  const absDir = join(repoRoot, dir);
  const records = listRecords(absDir);

  const id = nextId(records, prefix);
  const baseSlug = slugify(nameArg);
  const existingSlugs = new Set(records.map((r) => r.slug));
  const slug = uniqueSlug(baseSlug, existingSlugs);

  // Same-name warning: an existing active record with this exact preferred
  // name is a signal to check before minting a brand new id, either this
  // is the same record (edit it, don't mint) or a genuine namesake (keep
  // going, but make sure the two bios are distinguishable).
  const collisions = records.filter(
    (r) =>
      r.record_status === "active" &&
      r.name?.preferred?.toLowerCase() === nameArg.toLowerCase()
  );

  console.log(`Next ${kindArg} id: ${id}`);
  console.log(
    `Suggested slug: ${slug}` +
      (slug !== baseSlug
        ? ` (disambiguated, "${baseSlug}" is already taken)`
        : "")
  );

  if (collisions.length) {
    console.log(
      `\nWarning: ${collisions.length} existing active ${kindArg} record(s) already use the name "${nameArg}":`
    );
    for (const r of collisions) console.log(`  - ${r.id} (${r.slug})`);
    console.log(
      `If this is the same ${kindArg}, edit that file instead of minting a new id. If it's a genuine namesake, keep this id/slug and make sure the bio/description makes the two clearly distinguishable (dates, country, foundry, etc).`
    );
  }

  if (write) {
    const today = new Date().toISOString().slice(0, 10);
    const outPath = join(absDir, `${slug}.json`);
    if (existsSync(outPath)) {
      console.error(`\nRefusing to overwrite existing file: ${outPath}`);
      process.exit(1);
    }
    const stub = buildStub(kindArg, id, slug, nameArg, today);
    writeFileSync(outPath, JSON.stringify(stub, null, 2) + "\n");
    console.log(`\nWrote stub: ${dir}/${slug}.json`);
    console.log(
      "Fill in the required fields, then run `npm run validate` before opening a PR."
    );
  }
}

main();
