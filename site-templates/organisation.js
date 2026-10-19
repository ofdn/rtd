import { citationMeta, allNames, nativeNamesFact, linkTag, escapeHtml, pageShell, sourcesList, sameAsUris, identifiersList, copyableId, arkPermalink, citationBlock, printButton } from "./shared.js";

export const KIND_LABELS = {
  foundry: "Type foundry",
  publisher: "Font publisher",
  press: "Press",
  institution: "Institution",
};

function years(record) {
  if (!record.founded_year && !record.closed_year) return "";
  return `${record.founded_year ?? "?"}–${record.closed_year ?? ""}`;
}

// `typefaces` and `people` are resolved by build.js from foundry[].id and
// affiliations[].id, so the link lives only on the typeface or person record.
export function renderOrganisationPage(record, { canonicalUrl, typefaces, people, schemaVersion, arkUrl }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    identifier: record.id,
    name: record.name.preferred,
    alternateName: allNames(record.name).length ? allNames(record.name) : undefined,
    foundingDate: record.founded_year || undefined,
    dissolutionDate: record.closed_year || undefined,
    location: record.location || undefined,
    url: canonicalUrl,
    sameAs: [...(sameAsUris(record.external_ids) ?? []), record.website, arkUrl].filter(Boolean),
  };

  const listHtml = (heading, items, dir) =>
    items.length
      ? `<h2>${heading}</h2>\n<ul class="record-list">\n${items
          .map((i) => `<li><a href="../../${dir}/${escapeHtml(i.slug)}/">${escapeHtml(i.name)}</a>${i.role ? `<span class="role">${escapeHtml(i.role)}</span>` : ""}</li>`)
          .join("\n")}\n</ul>`
      : "";

  const body = `
<main>
<nav class="breadcrumb"><a href="../../">Registry Home</a> &rsaquo; <a href="../">Organisations</a> &rsaquo; ${escapeHtml(record.name.preferred)}</nav>
<div class="record-header">
<h1>${escapeHtml(record.name.preferred)}</h1>
${copyableId(record.id)}
${printButton()}
</div>
${arkPermalink(arkUrl)}
<dl class="facts">
${nativeNamesFact(record.name)}
<dt>Kind</dt><dd>${escapeHtml(KIND_LABELS[record.kind])}</dd>
${record.name.alternates?.length ? `<dt>Also known as</dt><dd>${escapeHtml(record.name.alternates.join(", "))}</dd>` : ""}
${record.location || record.countries?.length ? `<dt>Place</dt><dd>${escapeHtml([record.location, ...(record.countries ?? [])].filter(Boolean).join(", "))}</dd>` : ""}
${years(record) ? `<dt>Years</dt><dd>${escapeHtml(years(record))}</dd>` : ""}
${record.website ? `<dt>Website</dt><dd>${linkTag(record.website, escapeHtml(record.website.replace(/^https?:\/\//, "").replace(/\/$/, "")))}</dd>` : ""}
</dl>
${record.description ? `<p class="description">${escapeHtml(record.description)}</p>` : ""}
${listHtml("Typefaces", typefaces, "typefaces")}
${listHtml("People", people, "people")}
${sourcesList(record.sources)}
${identifiersList(record.external_ids)}
<p class="json-link"><a href="../../api/organisations/${escapeHtml(record.id)}.json">JSON</a></p>
${citationBlock(record, { canonicalUrl, arkUrl })}
</main>
`;

  return pageShell({
    title: record.name.preferred,
    canonicalUrl,
    jsonLd,
    body,
    homePath: "../../",
    schemaVersion,
    headMeta: citationMeta(record, { canonicalUrl, arkUrl, abstract: record.description }),
  });
}

// The /organisations/ index, A to Z, grouped by first letter.
export function renderOrganisationsIndexPage({ canonicalUrl, organisations, schemaVersion }) {
  const groups = new Map();
  for (const o of organisations) {
    const letter = o.name.charAt(0).toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(o);
  }
  const sections = [...groups.entries()]
    .map(
      ([letter, items]) =>
        `<h2 id="${escapeHtml(letter.toLowerCase())}">${escapeHtml(letter)}</h2>\n<ul class="record-list">\n${items
          .map(
            (o) =>
              `<li><a href="${escapeHtml(o.slug)}/">${escapeHtml(o.name)}</a>` +
              `<span class="role">${escapeHtml(KIND_LABELS[o.kind])}, ${o.typefacesCount} typeface${o.typefacesCount === 1 ? "" : "s"}, ${o.peopleCount} ${o.peopleCount === 1 ? "person" : "people"}</span></li>`
          )
          .join("\n")}\n</ul>`
    )
    .join("\n");

  const body = `
<main>
<nav class="breadcrumb"><a href="../">Registry Home</a> &rsaquo; Organisations</nav>
<div class="record-header">
<h1>Organisations</h1>
</div>
<p class="description">Type foundries, font publishers, presses and institutions linked to typefaces or people in the registry.</p>
${sections}
</main>
`;

  return pageShell({
    title: "Organisations",
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "../",
    schemaVersion,
  });
}
