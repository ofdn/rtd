import { escapeHtml, pageShell, sourcesList, verificationNote, sameAsUris } from "./shared.js";

// `designers` is the input record's designers[] enriched with each
// person's current name/slug (resolved by build.js), so the page can link
// to them without duplicating name data into the typeface record itself.
export function renderTypefacePage(record, { canonicalUrl, designers }) {
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
    ? `<h2>Designers</h2>\n<ul>\n${designers
        .map(
          (d) =>
            `<li><a href="../../people/${escapeHtml(d.slug)}/">${escapeHtml(
              d.name
            )}</a>, ${escapeHtml(d.role)}</li>`
        )
        .join("\n")}\n</ul>`
    : "";

  const body = `
<p><a href="../../">Registry of Type Design</a></p>
<h1>${escapeHtml(record.name.preferred)}</h1>
<p><small>${escapeHtml(record.id)}</small></p>
${verificationNote(record)}
${record.description ? `<p>${escapeHtml(record.description)}</p>` : ""}
<dl>
${record.foundry?.length ? `<dt>Foundry</dt><dd>${escapeHtml(record.foundry.map((f) => f.name).join(", "))}</dd>` : ""}
${record.design_year || record.release_year ? `<dt>Year</dt><dd>${escapeHtml(record.design_year ?? "?")} (designed) / ${escapeHtml(record.release_year ?? "?")} (released)</dd>` : ""}
${record.era ? `<dt>Era</dt><dd>${escapeHtml(record.era)}</dd>` : ""}
${record.classification ? `<dt>Classification</dt><dd>${escapeHtml(record.classification)}</dd>` : ""}
</dl>
${designersHtml}
${sourcesList(record.sources)}
<p><a href="../../api/typefaces/${escapeHtml(record.id)}.json">JSON</a></p>
`;

  return pageShell({
    title: record.name.preferred,
    canonicalUrl,
    jsonLd,
    body,
  });
}
