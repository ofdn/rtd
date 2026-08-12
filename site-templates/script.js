import { escapeHtml, pageShell } from "./shared.js";

// One page per script, listing every active typeface and person tagged
// with it, so "what exists for Ol Chiki" is a single click from any
// record that carries that tag instead of requiring a full-text search.
export function renderScriptPage({ canonicalUrl, name, typefaces, people, schemaVersion }) {
  const typefacesHtml = typefaces.length
    ? `<h2>Typefaces</h2>\n<ul class="record-list">\n${typefaces
        .map((t) => `<li><a href="../../typefaces/${escapeHtml(t.slug)}/">${escapeHtml(t.name)}</a></li>`)
        .join("\n")}\n</ul>`
    : "";
  const peopleHtml = people.length
    ? `<h2>People</h2>\n<ul class="record-list">\n${people
        .map((p) => `<li><a href="../../people/${escapeHtml(p.slug)}/">${escapeHtml(p.name)}</a></li>`)
        .join("\n")}\n</ul>`
    : "";

  const body = `
<main>
<nav class="breadcrumb"><a href="../../">Registry Home</a> &rsaquo; <a href="../">Scripts</a> &rsaquo; ${escapeHtml(name)}</nav>
<div class="record-header">
<h1>${escapeHtml(name)}</h1>
</div>
<p class="description">Typefaces and people in the registry linked to the ${escapeHtml(name)} script.</p>
${typefacesHtml}
${peopleHtml}
</main>
`;

  return pageShell({
    title: name,
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "../../",
    schemaVersion,
  });
}

// The /scripts/ index: every script tagged anywhere in the registry, with
// counts, linking into each script's own page above.
export function renderScriptsIndexPage({ canonicalUrl, scripts, schemaVersion }) {
  const items = scripts
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.slug)}/">${escapeHtml(s.name)}</a>` +
        `<span class="role">${s.typefacesCount} typeface${s.typefacesCount === 1 ? "" : "s"}, ${s.peopleCount} ${s.peopleCount === 1 ? "person" : "people"}</span></li>`
    )
    .join("\n");

  const body = `
<main>
<nav class="breadcrumb"><a href="../">Registry Home</a> &rsaquo; Scripts</nav>
<div class="record-header">
<h1>Scripts</h1>
</div>
<p class="description">Every writing system tagged on a typeface or person record, with the typefaces and people linked to it.</p>
<ul class="record-list">
${items}
</ul>
</main>
`;

  return pageShell({
    title: "Scripts",
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "../",
    schemaVersion,
  });
}
