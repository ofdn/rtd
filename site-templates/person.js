import { escapeHtml, pageShell, sourcesList, verificationNote, sameAsUris } from "./shared.js";

// `works` is the computed reverse index (typefaces this person is credited
// on), passed in by build.js, it is never stored on the person record
// itself, to avoid the same relationship being hand-maintained in two files.
export function renderPersonPage(record, { canonicalUrl, works }) {
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
    ? `<h2>Typefaces</h2>\n<ul>\n${works
        .map(
          (w) =>
            `<li><a href="../../typefaces/${escapeHtml(w.slug)}/">${escapeHtml(
              w.name
            )}</a>, ${escapeHtml(w.role)}</li>`
        )
        .join("\n")}\n</ul>`
    : "";

  const body = `
<p><a href="../../">Registry of Type Design</a></p>
<h1>${escapeHtml(record.name.preferred)}</h1>
<p><small>${escapeHtml(record.id)}</small></p>
${verificationNote(record)}
${record.bio ? `<p>${escapeHtml(record.bio)}</p>` : ""}
<dl>
${record.roles?.length ? `<dt>Roles</dt><dd>${escapeHtml(record.roles.join(", "))}</dd>` : ""}
${record.birth_year || record.death_year ? `<dt>Dates</dt><dd>${escapeHtml(record.birth_year ?? "?")} – ${escapeHtml(record.death_year ?? "")}</dd>` : ""}
${record.countries?.length ? `<dt>Countries</dt><dd>${escapeHtml(record.countries.join(", "))}</dd>` : ""}
</dl>
${worksHtml}
${sourcesList(record.sources)}
<p><a href="../../api/people/${escapeHtml(record.id)}.json">JSON</a></p>
`;

  return pageShell({
    title: record.name.preferred,
    canonicalUrl,
    jsonLd,
    body,
  });
}

export function renderTombstonePage(record, { canonicalUrl, targetSlug }) {
  const message =
    record.record_status === "merged" && targetSlug
      ? `This record has been merged into <a href="../${escapeHtml(
          targetSlug
        )}/">${escapeHtml(record.superseded_by)}</a>.`
      : record.record_status === "merged"
      ? `This record has been merged into ${escapeHtml(record.superseded_by)}.`
      : "This record has been deprecated.";
  const body = `
<p><a href="../../">Registry of Type Design</a></p>
<h1>${escapeHtml(record.name?.preferred ?? record.id)}</h1>
<p><small>${escapeHtml(record.id)}</small></p>
<p>${message}</p>
`;
  return pageShell({
    title: `${record.name?.preferred ?? record.id} (${record.record_status})`,
    canonicalUrl,
    jsonLd: null,
    body,
  });
}
