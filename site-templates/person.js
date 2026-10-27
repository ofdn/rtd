import { citationMeta, allNames, nativeNamesFact, escapeHtml, pageShell, sourcesList, sameAsUris, identifiersList, nationalityLabel, arkPermalink, citationBlock, printButton, scriptBadges } from "./shared.js";

// `works` is built by build.js from typeface designers[].
export function renderPersonPage(record, { canonicalUrl, works, affiliations = [], demonyms, related, schemaVersion, arkUrl }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    identifier: record.id,
    name: record.name.preferred,
    alternateName: allNames(record.name).length ? allNames(record.name) : undefined,
    birthDate: record.birth_year || undefined,
    deathDate: record.death_year || undefined,
    nationality: record.countries?.length ? record.countries : undefined,
    jobTitle: record.roles?.length ? record.roles : undefined,
    url: canonicalUrl,
    sameAs: [...(sameAsUris(record.external_ids) ?? []), arkUrl],
  };

  const worksHtml = works.length
    ? `<h2>Typefaces</h2>\n<ul class="record-list">\n${works
        .map(
          (w) =>
            `<li><a href="../../typefaces/${escapeHtml(w.slug)}/">${escapeHtml(
              w.name
            )}</a><span class="role">${escapeHtml(w.role)}</span></li>`
        )
        .join("\n")}\n</ul>`
    : "";

  const relatedHtml = related?.length
    ? `<section class="see-also">\n<h2>See also</h2>\n<ul>\n${related
        .map(
          (r) =>
            `<li><a href="../../people/${escapeHtml(r.slug)}/">${escapeHtml(r.name)}</a></li>`
        )
        .join("\n")}\n</ul>\n</section>`
    : "";

  const body = `
<main>
<nav class="breadcrumb"><a href="../../">Registry home</a> &rsaquo; ${escapeHtml(record.name.preferred)}</nav>
<div class="record-header">
<h1>${escapeHtml(record.name.preferred)}</h1>
${printButton()}
</div>
${arkPermalink(arkUrl)}
<dl class="facts">
${nativeNamesFact(record.name)}
${record.roles?.length ? `<dt>Roles</dt><dd>${escapeHtml(record.roles.join(", "))}</dd>` : ""}
${record.birth_year || record.death_year ? `<dt>Dates</dt><dd>${escapeHtml(record.birth_year ?? "?")} – ${escapeHtml(record.death_year ?? "")}</dd>` : ""}
${record.countries?.length ? `<dt>Nationality</dt><dd>${escapeHtml(nationalityLabel(record.countries, demonyms))}</dd>` : ""}
${record.scripts?.length ? `<dt>Scripts</dt><dd>${scriptBadges(record.scripts)}</dd>` : ""}
${affiliations.some((a) => a.slug) ? `<dt>Organisations</dt><dd>${affiliations.filter((a) => a.slug).map((a) => `<a href="../../organisations/${escapeHtml(a.slug)}/">${escapeHtml(a.name)}</a>`).join(", ")}</dd>` : ""}
</dl>
${record.bio ? `<p class="bio">${escapeHtml(record.bio)}</p>` : ""}
${worksHtml}
${relatedHtml}
${sourcesList(record.sources)}
${identifiersList(record.external_ids)}
<p class="json-link"><a href="../../api/people/${escapeHtml(record.id)}.json">JSON</a> &middot; <a href="../../api/people/${escapeHtml(record.id)}.dc.xml">Dublin Core (XML)</a> &middot; <a href="../../api/people/${escapeHtml(record.id)}.marc.xml">MARCXML</a></p>
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
    headMeta: citationMeta(record, { canonicalUrl, arkUrl, abstract: record.bio }),
  });
}

export function renderTombstonePage(record, { canonicalUrl, targetSlug, schemaVersion, arkUrl }) {
  const message =
    record.record_status === "merged" && targetSlug
      ? `This record has been merged into <a href="../${escapeHtml(
          targetSlug
        )}/">${escapeHtml(record.superseded_by)}</a>.`
      : record.record_status === "merged"
      ? `This record has been merged into ${escapeHtml(record.superseded_by)}.`
      : "This record has been deprecated.";
  const body = `
<main>
<nav class="breadcrumb"><a href="../../">Registry home</a> &rsaquo; ${escapeHtml(record.name?.preferred ?? record.id)}</nav>
<div class="record-header">
<h1>${escapeHtml(record.name?.preferred ?? record.id)}</h1>
</div>
${arkPermalink(arkUrl)}
<p>${message}</p>
</main>
`;
  return pageShell({
    title: `${record.name?.preferred ?? record.id} (${record.record_status})`,
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "../../",
    schemaVersion,
  });
}
