import { escapeHtml, pageShell } from "./shared.js";

// Single index page, no per-contributor subpage - every contributor
// (individual or institution) who submitted or substantially contributed a
// record, with links to what they contributed. Kept as one flat page
// rather than the /scripts/-style index+subpage pair since a contributor
// list doesn't need its own permalink yet.
export function renderContributorsPage({ canonicalUrl, contributors, schemaVersion }) {
  const items = contributors.length
    ? contributors
        .map((c) => {
          const totalCount = c.people.length + c.typefaces.length;
          const nameHtml = c.url
            ? `<a href="${escapeHtml(c.url)}"${c.url.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(c.name)}</a>`
            : escapeHtml(c.name);
          const recordLinks = [
            ...c.people.map((p) => `<a href="../people/${escapeHtml(p.slug)}/">${escapeHtml(p.name)}</a>`),
            ...c.typefaces.map((t) => `<a href="../typefaces/${escapeHtml(t.slug)}/">${escapeHtml(t.name)}</a>`),
          ].join(", ");
          return `<li><div class="contributor-name">${nameHtml}<span class="role">${c.type === "institution" ? "institution" : "individual"} &middot; ${totalCount} record${totalCount === 1 ? "" : "s"}</span></div><p class="contributor-records">${recordLinks}</p></li>`;
        })
        .join("\n")
    : `<li>No community-submitted records yet.</li>`;

  const body = `
<main>
<nav class="breadcrumb"><a href="../">Registry Home</a> &rsaquo; Contributors</nav>
<div class="record-header">
<h1>Contributors</h1>
</div>
<p class="description">Everyone, people and institutions alike, who has submitted or substantially contributed a record to the registry. Each is credited on their own record's "Cite this record" section instead of the registry's own maintainer. Most existing records were researched and entered by the registry's founder, Subhashish Panigrahi, and aren't listed individually here - this page tracks community submissions going forward.</p>
<ul class="contributors-list">
${items}
</ul>
</main>
`;

  return pageShell({
    title: "Contributors",
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "../",
    schemaVersion,
  });
}
