#!/usr/bin/env node
// Compiles data/people/*.json and data/typefaces/*.json into the published
// static site: human pages (with embedded JSON-LD), a canonical JSON API,
// CSV/NDJSON bulk dumps, and a client-side search index.
//
// Usage: node scripts/build.js [dataDir] [outDir]
// SITE_URL env var sets the absolute base URL used in canonical links and
// JSON-LD (defaults to a placeholder until a real domain is chosen).
import {
  readFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { toCsv } from "./csv.js";
import { renderPersonPage, renderTombstonePage } from "../site-templates/person.js";
import { renderTypefacePage } from "../site-templates/typeface.js";
import { renderHomePage } from "../site-templates/home.js";
import { renderInfoPage } from "../site-templates/info.js";
import { renderRedirectPage, nationalityLabel, pageShell } from "../site-templates/shared.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..");
const SITE_URL = (process.env.SITE_URL || "https://example.org/").replace(
  /\/?$/,
  "/"
);
// N2T resolves ark:54728/<id> to ${SITE_URL}ark/<id>/.
const ARK_NAAN = "54728";

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function listRecords(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => loadJson(join(dir, f)));
}

function writeFile(outDir, relPath, content) {
  const full = join(outDir, relPath);
  mkdirSync(full.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(full, content);
}

// Writes a redirect stub at every slug this record used to have, always
// pointing at wherever the record lives right now (its current canonical
// URL, whether that's an active page or a merged/deprecated tombstone).
// Validated in scripts/validate.js to never collide with a real slug.
function writeSlugRedirects(outDir, kindDir, record, canonicalUrl) {
  for (const oldSlug of record.previous_slugs ?? []) {
    const html = renderRedirectPage({
      name: record.name?.preferred ?? record.id,
      targetUrl: canonicalUrl,
    });
    writeFile(outDir, `${kindDir}/${oldSlug}/index.html`, html);
  }
}

// Resolves ark:<NAAN>/<id> to the record's current URL.
function writeArkRedirect(outDir, record, canonicalUrl) {
  const html = renderRedirectPage({
    name: record.name?.preferred ?? record.id,
    targetUrl: canonicalUrl,
  });
  writeFile(outDir, `ark/${record.id}/index.html`, html);
}

function writeBareIdRedirect(outDir, record, canonicalUrl) {
  const html = renderRedirectPage({
    name: record.name?.preferred ?? record.id,
    targetUrl: canonicalUrl,
  });
  writeFile(outDir, `${record.id}/index.html`, html);
  writeFile(outDir, `${record.id.toUpperCase()}/index.html`, html);
}

function build(dataDir, outDir) {
  const demonyms = loadJson(join(repoRoot, "schema/demonyms.json"));
  const schemaVersion = readFileSync(join(repoRoot, "schema/VERSION"), "utf8").trim();
  const people = listRecords(join(dataDir, "people"));
  const typefaces = listRecords(join(dataDir, "typefaces"));

  const personById = new Map(people.map((p) => [p.id, p]));
  const typefaceById = new Map(typefaces.map((t) => [t.id, t]));

  // Reverse index: person id -> typefaces they're credited on. Computed
  // here, not stored on the person record, so the relationship only has to
  // be edited in one place (the typeface's `designers` field).
  const worksByPerson = new Map();
  for (const tf of typefaces) {
    for (const d of tf.designers ?? []) {
      const list = worksByPerson.get(d.id) ?? [];
      list.push({ id: tf.id, slug: tf.slug, name: tf.name.preferred, role: d.role });
      worksByPerson.set(d.id, list);
    }
  }

  // "See also" cross-links: this is linked data, so each record's page
  // should surface a few laterally-related records, not just the direct
  // person<->typeface credit already covered above. Co-credit (people who
  // share a typeface, typefaces that share a designer) ranks above looser
  // matches (same nationality, same foundry), capped short since this is a
  // researcher-facing list, not a recommendation engine.
  function relatedPeople(record) {
    if (record.record_status !== "active") return [];
    const coDesignerIds = new Set();
    for (const tf of typefaces) {
      const designerIds = (tf.designers ?? []).map((d) => d.id);
      if (designerIds.includes(record.id)) {
        for (const id of designerIds) {
          if (id !== record.id) coDesignerIds.add(id);
        }
      }
    }
    const sameCountryIds = new Set();
    for (const p of people) {
      if (p.id === record.id || p.record_status !== "active") continue;
      if ((p.countries ?? []).some((c) => (record.countries ?? []).includes(c))) {
        sameCountryIds.add(p.id);
      }
    }
    const orderedIds = [...new Set([...coDesignerIds, ...sameCountryIds])];
    return orderedIds
      .map((id) => personById.get(id))
      .filter((p) => p && p.record_status === "active")
      .slice(0, 5)
      .map((p) => ({ name: p.name.preferred, slug: p.slug }));
  }

  function relatedTypefaces(record) {
    if (record.record_status !== "active") return [];
    const designerIds = new Set((record.designers ?? []).map((d) => d.id));
    const foundryNames = new Set((record.foundry ?? []).map((f) => f.name));
    const coDesignedIds = new Set();
    const sameFoundryIds = new Set();
    for (const tf of typefaces) {
      if (tf.id === record.id || tf.record_status !== "active") continue;
      if ((tf.designers ?? []).some((d) => designerIds.has(d.id))) {
        coDesignedIds.add(tf.id);
      }
      if ((tf.foundry ?? []).some((f) => foundryNames.has(f.name))) {
        sameFoundryIds.add(tf.id);
      }
    }
    const orderedIds = [...new Set([...coDesignedIds, ...sameFoundryIds])];
    return orderedIds
      .map((id) => typefaceById.get(id))
      .filter(Boolean)
      .slice(0, 5)
      .map((t) => ({ name: t.name.preferred, slug: t.slug }));
  }

  // Short secondary line shown under each name in home-page search/browse
  // results (e.g. "Swiss, Type Designer (1910-1980)" or "Haas Type
  // Foundry, 1957"), computed once at build time and shipped in
  // search-index.json so the client never has to duplicate the nationality
  // lookup logic that already lives in shared.js.
  function personSubtitle(record) {
    const parts = [];
    const nat = nationalityLabel(record.countries, demonyms);
    if (nat) parts.push(nat);
    if (record.roles?.length) parts.push(record.roles.join(", "));
    let subtitle = parts.join(" · ");
    if (record.birth_year || record.death_year) {
      const dates = `${record.birth_year ?? "?"}–${record.death_year ?? ""}`;
      subtitle = subtitle ? `${subtitle} (${dates})` : dates;
    }
    return subtitle || undefined;
  }

  function typefaceSubtitle(record) {
    const parts = [];
    if (record.foundry?.length) parts.push(record.foundry.map((f) => f.name).join(", "));
    const year = record.design_year || record.release_year;
    if (year) parts.push(year);
    return parts.length ? parts.join(", ") : undefined;
  }

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFile(outDir, ".nojekyll", "");
  writeFile(
    outDir,
    "styles.css",
    readFileSync(join(repoRoot, "site-templates/styles.css"), "utf8")
  );

  writeFile(
    outDir,
    "ark/servicestatus/index.html",
    pageShell({
      title: "ARK service status",
      canonicalUrl: `${SITE_URL}ark/servicestatus/`,
      jsonLd: null,
      body: `<main><h1>ARK service status</h1><p>OK.</p></main>`,
      homePath: "../../",
      schemaVersion,
    })
  );

  writeFile(
    outDir,
    "preservation/index.html",
    pageShell({
      title: "Preservation and persistence",
      canonicalUrl: `${SITE_URL}preservation/`,
      jsonLd: null,
      body: `<main>
<h1>Preservation and persistence</h1>
<p class="description">Registry of Type Design commits to best-effort persistent access to its identifiers and data.</p>
<ul class="plain-list">
<li>Ids (<code>rtd-p-</code>/<code>rtd-t-</code>, and the ARK identifiers built on them) are never reused or reassigned once published. A merged or deprecated record keeps its id and gets a redirect to wherever it lives now, it never gets deleted or handed to a different record.</li>
<li>All data is openly licensed (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) and published as bulk CSV/NDJSON dumps, for anyone who wants to mirror the data independently of this site.</li>
<li>The full source and edit history is public on <a href="https://github.com/ofdn/rtd">GitHub</a>. Anyone who has cloned the repository already holds a complete, independently usable copy of the registry and its history.</li>
</ul>
<p>Registry of Type Design is an independent, community-run project. We can't promise formal dark-archive or LOCKSS-style preservation today. Open licensing, public version history, and downloadable dumps mean the data survives independently of any single server or organization staying online.</p>
</main>`,
      homePath: "../",
      schemaVersion,
    })
  );

  writeFile(
    outDir,
    "info/index.html",
    renderInfoPage({
      canonicalUrl: `${SITE_URL}info/`,
      peopleCount: people.filter((p) => p.record_status === "active").length,
      typefacesCount: typefaces.filter((t) => t.record_status === "active").length,
      schemaVersion,
      arkNaan: ARK_NAAN,
    })
  );

  // --- People ---
  const peopleApiIndex = [];
  for (const record of people) {
    const canonicalUrl = `${SITE_URL}people/${record.slug}/`;
    const apiUrl = `${SITE_URL}api/people/${record.id}.json`;

    if (record.record_status === "active") {
      const works = worksByPerson.get(record.id) ?? [];
      const html = renderPersonPage(record, {
        canonicalUrl,
        works,
        demonyms,
        related: relatedPeople(record),
        schemaVersion,
        arkUrl: `https://n2t.net/ark:${ARK_NAAN}/${record.id}`,
      });
      writeFile(outDir, `people/${record.slug}/index.html`, html);
      writeFile(
        outDir,
        `api/people/${record.id}.json`,
        JSON.stringify(
          { ...record, canonical_url: canonicalUrl, api_url: apiUrl, typefaces: works },
          null,
          2
        )
      );
    } else {
      const target = record.superseded_by
        ? personById.get(record.superseded_by)
        : null;
      const html = renderTombstonePage(record, {
        canonicalUrl,
        targetSlug: target?.slug,
        schemaVersion,
      });
      writeFile(outDir, `people/${record.slug}/index.html`, html);
      writeFile(
        outDir,
        `api/people/${record.id}.json`,
        JSON.stringify(
          { ...record, canonical_url: canonicalUrl, api_url: apiUrl },
          null,
          2
        )
      );
    }
    writeSlugRedirects(outDir, "people", record, canonicalUrl);
    writeArkRedirect(outDir, record, canonicalUrl);
    writeBareIdRedirect(outDir, record, canonicalUrl);

    peopleApiIndex.push({
      id: record.id,
      slug: record.slug,
      name: record.name.preferred,
      sort_name: record.sort_name ?? record.name.preferred,
      alternates: record.name.alternates ?? [],
      record_status: record.record_status,
      api_url: apiUrl,
      canonical_url: canonicalUrl,
      subtitle: personSubtitle(record),
    });
  }
  writeFile(outDir, "api/people.json", JSON.stringify(peopleApiIndex, null, 2));

  // --- Typefaces ---
  const typefacesApiIndex = [];
  for (const record of typefaces) {
    const canonicalUrl = `${SITE_URL}typefaces/${record.slug}/`;
    const apiUrl = `${SITE_URL}api/typefaces/${record.id}.json`;

    if (record.record_status === "active") {
      const designers = (record.designers ?? []).map((d) => {
        const person = personById.get(d.id);
        return {
          id: d.id,
          role: d.role,
          name: person?.name?.preferred ?? d.id,
          slug: person?.slug ?? d.id,
        };
      });
      const html = renderTypefacePage(record, {
        canonicalUrl,
        designers,
        related: relatedTypefaces(record),
        schemaVersion,
        arkUrl: `https://n2t.net/ark:${ARK_NAAN}/${record.id}`,
      });
      writeFile(outDir, `typefaces/${record.slug}/index.html`, html);
      writeFile(
        outDir,
        `api/typefaces/${record.id}.json`,
        JSON.stringify(
          { ...record, canonical_url: canonicalUrl, api_url: apiUrl },
          null,
          2
        )
      );
    } else {
      const target = record.superseded_by
        ? typefaceById.get(record.superseded_by)
        : null;
      const html = renderTombstonePage(record, {
        canonicalUrl,
        targetSlug: target?.slug,
        schemaVersion,
      });
      writeFile(outDir, `typefaces/${record.slug}/index.html`, html);
      writeFile(
        outDir,
        `api/typefaces/${record.id}.json`,
        JSON.stringify(
          { ...record, canonical_url: canonicalUrl, api_url: apiUrl },
          null,
          2
        )
      );
    }
    writeSlugRedirects(outDir, "typefaces", record, canonicalUrl);
    writeArkRedirect(outDir, record, canonicalUrl);
    writeBareIdRedirect(outDir, record, canonicalUrl);

    typefacesApiIndex.push({
      id: record.id,
      slug: record.slug,
      name: record.name.preferred,
      alternates: record.name.alternates ?? [],
      record_status: record.record_status,
      api_url: apiUrl,
      canonical_url: canonicalUrl,
      subtitle: typefaceSubtitle(record),
    });
  }
  writeFile(
    outDir,
    "api/typefaces.json",
    JSON.stringify(typefacesApiIndex, null, 2)
  );

  // --- Search index (active records only) ---
  const searchIndex = [
    ...peopleApiIndex
      .filter((p) => p.record_status === "active")
      .map((p) => ({ ...p, kind: "person" })),
    ...typefacesApiIndex
      .filter((t) => t.record_status === "active")
      .map((t) => ({ ...t, kind: "typeface" })),
  ];
  writeFile(outDir, "search-index.json", JSON.stringify(searchIndex));

  // --- Dumps ---
  const peopleDumpRows = people.map((r) => ({
    id: r.id,
    slug: r.slug,
    preferred_name: r.name.preferred,
    alternates: r.name.alternates ?? [],
    sort_name: r.sort_name ?? "",
    birth_year: r.birth_year ?? "",
    death_year: r.death_year ?? "",
    countries: r.countries ?? [],
    roles: r.roles ?? [],
    active_years_start: r.active_years?.start ?? "",
    active_years_end: r.active_years?.end ?? "",
    scripts: r.scripts ?? [],
    wikidata_qid: r.external_ids?.wikidata_qid ?? "",
    record_status: r.record_status,
    superseded_by: r.superseded_by ?? "",
    canonical_url: `${SITE_URL}people/${r.slug}/`,
  }));
  writeFile(
    outDir,
    "dumps/people.csv",
    toCsv(peopleDumpRows, Object.keys(peopleDumpRows[0] ?? { id: 1 }))
  );
  writeFile(
    outDir,
    "dumps/people.ndjson",
    people.map((r) => JSON.stringify(r)).join("\n") + (people.length ? "\n" : "")
  );

  const typefacesDumpRows = typefaces.map((r) => ({
    id: r.id,
    slug: r.slug,
    preferred_name: r.name.preferred,
    alternates: r.name.alternates ?? [],
    designers: (r.designers ?? []).map(
      (d) => `${personById.get(d.id)?.name?.preferred ?? d.id} (${d.role})`
    ),
    foundry: (r.foundry ?? []).map((f) => f.name),
    design_year: r.design_year ?? "",
    release_year: r.release_year ?? "",
    classification: r.classification ?? "",
    era: r.era ?? "",
    wikidata_qid: r.external_ids?.wikidata_qid ?? "",
    record_status: r.record_status,
    superseded_by: r.superseded_by ?? "",
    canonical_url: `${SITE_URL}typefaces/${r.slug}/`,
  }));
  writeFile(
    outDir,
    "dumps/typefaces.csv",
    toCsv(typefacesDumpRows, Object.keys(typefacesDumpRows[0] ?? { id: 1 }))
  );
  writeFile(
    outDir,
    "dumps/typefaces.ndjson",
    typefaces.map((r) => JSON.stringify(r)).join("\n") +
      (typefaces.length ? "\n" : "")
  );

  // --- Home page ---
  const homeHtml = renderHomePage({
    canonicalUrl: SITE_URL,
    peopleCount: peopleApiIndex.filter((p) => p.record_status === "active").length,
    typefacesCount: typefacesApiIndex.filter((t) => t.record_status === "active").length,
    schemaVersion,
  });
  writeFile(outDir, "index.html", homeHtml);

  return {
    peopleCount: people.length,
    typefacesCount: typefaces.length,
  };
}

function main() {
  const dataDir = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : join(repoRoot, "data");
  const outDir = process.argv[3]
    ? resolve(process.cwd(), process.argv[3])
    : join(repoRoot, "dist");

  const { peopleCount, typefacesCount } = build(dataDir, outDir);
  console.log(
    `Built ${peopleCount} people and ${typefacesCount} typefaces into ${outDir}`
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
