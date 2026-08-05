import { escapeHtml, pageShell, sourcesList, verificationNote, sameAsUris, identifiersList, copyableId } from "./shared.js";

// `designers` is the input record's designers[] enriched with each
// person's current name/slug (resolved by build.js), so the page can link
// to them without duplicating name data into the typeface record itself.
export function renderTypefacePage(record, { canonicalUrl, designers, related, schemaVersion }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    additionalType: "Typeface",
    identifier: record.id,
    name: record.name.preferred,
    alternateName: record.name.alternates?.length
      ? record.name.alternates
      : undefined,
    creator: designers.map((d) => ({
      "@type": "Person",
      name: d.name,
      identifier: d.id,
    })),
    dateCreated: record.design_year || undefined,
    datePublished: record.release_year || undefined,
    publisher: record.foundry?.length
      ? record.foundry.map((f) => ({ "@type": "Organization", name: f.name }))
      : undefined,
    url: canonicalUrl,
    sameAs: sameAsUris(record.external_ids),
  };

  const designersHtml = designers.length
    ? `<h2>Designers</h2>\n<ul class="record-list">\n${designers
        .map(
          (d) =>
            `<li><a href="../../people/${escapeHtml(d.slug)}/">${escapeHtml(
              d.name
            )}</a><span class="role">${escapeHtml(d.role)}</span></li>`
        )
        .join("\n")}\n</ul>`
    : "";

  const relatedHtml = related?.length
    ? `<section class="see-also">\n<h2>See also</h2>\n<ul>\n${related
        .map(
          (r) =>
            `<li><a href="../../typefaces/${escapeHtml(r.slug)}/">${escapeHtml(r.name)}</a></li>`
        )
        .join("\n")}\n</ul>\n</section>`
    : "";

  const body = `
<main>
<nav class="breadcrumb"><a href="../../">Registry Home</a> &rsaquo; ${escapeHtml(record.name.preferred)}</nav>
<div class="record-header">
<h1>${escapeHtml(record.name.preferred)}</h1>
${copyableId(record.id)}
</div>
${verificationNote(record)}
<dl class="facts">
${record.foundry?.length ? `<dt>Foundry</dt><dd>${escapeHtml(record.foundry.map((f) => f.name).join(", "))}</dd>` : ""}
${record.design_year || record.release_year ? `<dt>Year</dt><dd>${escapeHtml(record.design_year ?? "?")} (designed) / ${escapeHtml(record.release_year ?? "?")} (released)</dd>` : ""}
${record.era ? `<dt>Era</dt><dd>${escapeHtml(record.era)}</dd>` : ""}
${record.classification ? `<dt>Classification</dt><dd>${escapeHtml(record.classification)}</dd>` : ""}
</dl>
${record.description ? `<p class="description">${escapeHtml(record.description)}</p>` : ""}
${designersHtml}
${relatedHtml}
${sourcesList(record.sources)}
${identifiersList(record.external_ids)}
<p class="json-link"><a href="../../api/typefaces/${escapeHtml(record.id)}.json">JSON</a></p>
</main>
`;

  return pageShell({
    title: record.name.preferred,
    canonicalUrl,
    jsonLd,
    body,
    homePath: "../../",
    schemaVersion,
  });
}
