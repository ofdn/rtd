import { escapeHtml, pageShell, sourcesList, verificationNote, sameAsUris, identifiersList, nationalityLabel } from "./shared.js";

// `works` is the computed reverse index (typefaces this person is credited
// on), passed in by build.js, it is never stored on the person record
// itself, to avoid the same relationship being hand-maintained in two files.
export function renderPersonPage(record, { canonicalUrl, works, demonyms, related, schemaVersion }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    identifier: record.id,
    name: record.name.preferred,
    alternateName: record.name.alternates?.length
      ? record.name.alternates
      : undefined,
    birthDate: record.birth_year || undefined,
    deathDate: record.death_year || undefined,
    nationality: record.countries?.length ? record.countries : undefined,
    jobTitle: record.roles?.length ? record.roles : undefined,
    url: canonicalUrl,
    sameAs: sameAsUris(record.external_ids),
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
<nav class="breadcrumb"><a href="../../">Registry Home</a> &rsaquo; ${escapeHtml(record.name.preferred)}</nav>
<div class="record-header">
<h1>${escapeHtml(record.name.preferred)}</h1>
<span class="record-id">${escapeHtml(record.id)}</span>
</div>
${verificationNote(record)}
<dl class="facts">
${record.roles?.length ? `<dt>Roles</dt><dd>${escapeHtml(record.roles.join(", "))}</dd>` : ""}
${record.birth_year || record.death_year ? `<dt>Dates</dt><dd>${escapeHtml(record.birth_year ?? "?")} – ${escapeHtml(record.death_year ?? "")}</dd>` : ""}
${record.countries?.length ? `<dt>Nationality</dt><dd>${escapeHtml(nationalityLabel(record.countries, demonyms))}</dd>` : ""}
</dl>
${record.bio ? `<p class="bio">${escapeHtml(record.bio)}</p>` : ""}
${worksHtml}
${relatedHtml}
${sourcesList(record.sources)}
${identifiersList(record.external_ids)}
<p class="json-link"><a href="../../api/people/${escapeHtml(record.id)}.json">JSON</a></p>
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

export function renderTombstonePage(record, { canonicalUrl, targetSlug, schemaVersion }) {
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
<nav class="breadcrumb"><a href="../../">Registry Home</a> &rsaquo; ${escapeHtml(record.name?.preferred ?? record.id)}</nav>
<div class="record-header">
<h1>${escapeHtml(record.name?.preferred ?? record.id)}</h1>
<span class="record-id">${escapeHtml(record.id)}</span>
</div>
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
