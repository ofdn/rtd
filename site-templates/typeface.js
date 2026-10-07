import { allNames, nativeNamesFact, eraLabel, linkTag, escapeHtml, pageShell, sourcesList, sameAsUris, identifiersList, copyableId, arkPermalink, citationBlock, printButton, scriptBadges } from "./shared.js";

// `designers` is the input record's designers[] enriched with each
// person's current name/slug (resolved by build.js), so the page can link
// to them without duplicating name data into the typeface record itself.
const RELATION_LABELS = {
  revival_of: "Revival of",
  digitisation_of: "Digitisation of",
  adaptation_of: "Adaptation of",
  companion_to: "Companion to",
};

const ATTRIBUTION_LABELS = {
  unknown: "No individual designer known",
  anonymous: "Anonymous",
  collective: "Collective work",
  "foundry-only": "Credited to the foundry",
  lost: "Designer records lost",
};

// `relations` is related_typefaces[] resolved by build.js to {relation, name, slug}.
export function renderTypefacePage(record, { canonicalUrl, designers, related, relations = [], schemaVersion, arkUrl }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    additionalType: "Typeface",
    identifier: record.id,
    name: record.name.preferred,
    alternateName: allNames(record.name).length ? allNames(record.name) : undefined,
    creator: designers.length
      ? designers.map((d) => ({
          "@type": "Person",
          name: d.name,
          identifier: d.id,
        }))
      : undefined,
    dateCreated: record.design_year || undefined,
    datePublished: record.release_year || undefined,
    publisher: record.foundry?.length
      ? record.foundry.map((f) => ({ "@type": "Organization", name: f.name }))
      : undefined,
    url: canonicalUrl,
    sameAs: [...(sameAsUris(record.external_ids) ?? []), arkUrl],
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
    : record.attribution
    ? `<h2>Designers</h2>\n<p class="attribution-unknown">${ATTRIBUTION_LABELS[record.attribution.status ?? "unknown"]}: ${escapeHtml(record.attribution.note)}</p>`
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
${printButton()}
</div>
${arkPermalink(arkUrl)}
<dl class="facts">
${nativeNamesFact(record.name)}
${record.foundry?.length ? `<dt>Foundry</dt><dd>${escapeHtml(record.foundry.map((f) => f.name).join(", "))}</dd>` : ""}
${record.design_year || record.release_year ? `<dt>Year</dt><dd>${escapeHtml(record.design_year ?? "?")} (designed) / ${escapeHtml(record.release_year ?? "?")} (released)</dd>` : ""}
${record.commissioned_by?.length ? `<dt>Commissioned by</dt><dd>${record.commissioned_by.map((c) => (c.url ? linkTag(c.url, escapeHtml(c.name)) : escapeHtml(c.name))).join(", ")}</dd>` : ""}
${record.era ? `<dt>Era</dt><dd>${escapeHtml(eraLabel(record.era))}</dd>` : ""}
${record.classification ? `<dt>Classification</dt><dd>${escapeHtml(record.classification)}</dd>` : ""}
${record.scripts?.length ? `<dt>Scripts</dt><dd>${scriptBadges(record.scripts)}</dd>` : ""}
${record.languages?.length ? `<dt>Languages</dt><dd>${escapeHtml(record.languages.map((l) => l.name).join(", "))}</dd>` : ""}
${relations.map((r) => `<dt>${RELATION_LABELS[r.relation]}</dt><dd><a href="../../typefaces/${escapeHtml(r.slug)}/">${escapeHtml(r.name)}</a></dd>`).join("\n")}
</dl>
${record.description ? `<p class="description">${escapeHtml(record.description)}</p>` : ""}
${designersHtml}
${relatedHtml}
${sourcesList(record.sources)}
${identifiersList(record.external_ids)}
<p class="json-link"><a href="../../api/typefaces/${escapeHtml(record.id)}.json">JSON</a> &middot; <a href="../../api/typefaces/${escapeHtml(record.id)}.dc.xml">Dublin Core (XML)</a></p>
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
  });
}
