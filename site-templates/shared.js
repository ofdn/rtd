// Small HTML helpers shared by the record page templates. No templating
// engine dependency, the dataset is small enough that plain template
// literals are simpler than pulling in a framework.

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// JSON-LD is embedded inside a <script> tag; guard against a source string
// containing "</script>" from prematurely closing the tag.
export function jsonLdScript(data) {
  const json = JSON.stringify(data, null, 2).replaceAll("</", "<\\/");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// Static stand-in for an HTTP 301: GitHub Pages serves plain files, there's
// no server-side redirect config available, so a renamed record's old slug
// gets a stub page instead. `<link rel="canonical">` tells search engines
// to consolidate on the new URL, `<meta http-equiv="refresh">` moves a
// human/browser there immediately, and the visible link is the fallback
// for anything that honors neither (e.g. curl).
export function renderRedirectPage({ name, targetUrl }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)}, Registry of Type Design</title>
<link rel="canonical" href="${escapeHtml(targetUrl)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<p>This record has moved. If you are not redirected automatically, follow <a href="${escapeHtml(targetUrl)}">this link</a>.</p>
</body>
</html>
`;
}

// Search icon shared by the compact header search and the home page's
// large hero search, inlined so the site has no icon-font dependency.
export const SEARCH_ICON = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

// A single GET form works everywhere: on the home page itself, action=""
// submits back to the same page (progressively enhanced into a live
// client-side filter by home.js); on a person/typeface page, homePath
// ("../../") submits to the registry root with the query as ?q=, which
// home.js reads on load and searches immediately. No JS is required for
// this to work at all, only for it to avoid a full page reload.
function headerSearchForm(homePath) {
  return `<form class="header-search" action="${escapeHtml(homePath)}" method="get" role="search">
<label class="visually-hidden" for="header-search-input">Search people and typefaces</label>
<input id="header-search-input" type="search" name="q" placeholder="Search by name, typeface, or foundry&hellip;" autocomplete="off">
<button type="submit" aria-label="Search">${SEARCH_ICON}</button>
</form>`;
}

// `homePath` is the relative path back to the site root from wherever this
// page lives (`""` for the home page, `"../../"` for a person/typeface
// page), used for the logo link, the stylesheet, and the search form's
// fallback target. `showHeaderSearch` is off on the home page, which
// already has its own large hero search box, see home.js.
export function pageShell({
  title,
  canonicalUrl,
  jsonLd,
  body,
  homePath = "",
  showHeaderSearch = true,
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}, Registry of Type Design</title>
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Plus+Jakarta+Sans:wght@700&amp;family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="${escapeHtml(homePath)}styles.css">
${jsonLd ? jsonLdScript(jsonLd) : ""}
</head>
<body>
<header class="site-header">
<a class="logo" href="${escapeHtml(homePath)}">Registry of Type Design</a>
${showHeaderSearch ? headerSearchForm(homePath) : ""}
</header>
${body}
<footer class="site-footer">
<p>&copy; ${new Date().getFullYear()} Subhashish Panigrahi. Site and data licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</p>
</footer>
</body>
</html>
`;
}

export function verificationNote(record) {
  if (record.verification_status !== "needs_verification") return "";
  return `<aside class="callout"><strong>Needs verification</strong><p>Sources for this record are thin or low-confidence. Help improve it by <a href="https://github.com/ofdn/rtd/blob/main/CONTRIBUTING.md">contributing a stronger source</a>.</p></aside>`;
}

// Resolves external_ids into {label, url} pairs, one per authority file
// that's actually present on the record. Single source of truth for both
// the visible "Identifiers" list on each page and the JSON-LD sameAs
// array, so the two can never drift out of sync with each other.
export function identifierLinks(externalIds) {
  if (!externalIds) return [];
  const links = [];
  if (externalIds.wikidata_qid) {
    links.push({ label: "Wikidata", url: `https://www.wikidata.org/wiki/${externalIds.wikidata_qid}` });
  }
  if (externalIds.viaf) {
    links.push({ label: "VIAF", url: `https://viaf.org/viaf/${externalIds.viaf}` });
  }
  if (externalIds.isni) {
    links.push({ label: "ISNI", url: `https://isni.org/isni/${externalIds.isni.replaceAll(" ", "")}` });
  }
  if (externalIds.lc_naf) {
    links.push({ label: "LC/NAF", url: `https://id.loc.gov/authorities/names/${externalIds.lc_naf}` });
  }
  if (externalIds.gnd) {
    links.push({ label: "GND", url: `https://d-nb.info/gnd/${externalIds.gnd}` });
  }
  if (externalIds.worldcat_entity) {
    links.push({ label: "WorldCat", url: `https://id.oclc.org/worldcat/entity/${externalIds.worldcat_entity}` });
  }
  return links;
}

export function sameAsUris(externalIds) {
  const links = identifierLinks(externalIds);
  return links.length ? links.map((l) => l.url) : undefined;
}

export function identifiersList(externalIds) {
  const links = identifierLinks(externalIds);
  if (!links.length) return "";
  const items = links
    .map((l) => `<li>${escapeHtml(l.label)}: <a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></li>`)
    .join("\n");
  return `<h2>Identifiers</h2>\n<ul class="plain-list">\n${items}\n</ul>`;
}

// Computes a single human-readable nationality label from a countries[]
// array using the demonym/compound tables in schema/demonyms.json (passed
// in by build.js). Kept out of hand-written bio text so the wording stays
// consistent across every record instead of drifting per-author.
export function nationalityLabel(countries, demonymsData) {
  if (!countries || countries.length === 0) return undefined;
  const { demonyms, compounds } = demonymsData;
  if (countries.length === 1) {
    return demonyms[countries[0]] || countries[0];
  }
  if (countries.length === 2) {
    const key = [...countries].sort().join("|");
    if (compounds[key]) return compounds[key];
  }
  return countries.map((c) => demonyms[c] || c).join(" and ");
}

export function sourcesList(sources) {
  if (!sources || sources.length === 0) return "";
  const items = sources
    .map(
      (s) =>
        `<li><a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a></li>`
    )
    .join("\n");
  return `<h2>Sources</h2>\n<ul class="plain-list">\n${items}\n</ul>`;
}
