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

export function copyableId(id) {
  return `<button type="button" class="record-id copy-id" data-copy="${escapeHtml(id)}">${escapeHtml(id)}</button>`;
}

// A hash of styles.css's own content, set once by build.js and appended to
// the stylesheet link as a cache-buster (`?v=<hash>`). Without this,
// browsers and the CDN in front of the custom domain hold onto a cached
// copy for up to their max-age (hours) after every deploy, so a CSS-only
// change doesn't actually reach visitors until that cache expires or they
// hard-refresh.
let cssVersion = "";
export function setCssVersion(hash) {
  cssVersion = hash;
}

// package.json's version, set once by build.js, shown in the footer next
// to the schema version (a separate number, see CONTRIBUTING.md's
// "Schema versioning" section for why the two don't move together).
let siteVersion = "";
export function setSiteVersion(version) {
  siteVersion = version;
}

const COPY_ICON = `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const PRINT_ICON = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;

// Works on any record page (person or typeface), triggers the browser's
// own print dialog, which already offers "Save as PDF" without RTD needing
// to generate/host PDF files itself. @media print in styles.css strips the
// header/footer/controls so the printed page is just the record content.
export function printButton() {
  return `<button type="button" class="print-btn" onclick="window.print()" aria-label="Print this page" title="Print this page">${PRINT_ICON}</button>`;
}

export function arkPermalink(arkUrl) {
  return `<p class="ark-permalink">ARK <code>${escapeHtml(arkUrl)}</code> <button type="button" class="copy-id copy-icon-btn" data-copy="${escapeHtml(arkUrl)}" aria-label="Copy ARK permalink">${COPY_ICON}</button></p>`;
}

function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Citation text is generated at build time with an `__ACCESSED__` token
// standing in for the retrieval date, since a static site can't know when
// a given reader is actually viewing the page; citationBlock()'s inline
// script fills that token in client-side with the visitor's local date.
export function buildCitations(record, { canonicalUrl, arkUrl }) {
  const title = record.name.preferred;
  const year = (record.updated_at || "").slice(0, 4);
  const updated = formatDate(record.updated_at);

  return {
    apa: `Panigrahi, S. (${year}). ${title}. Registry of Type Design. O Foundation. ${canonicalUrl}`,
    chicago: `Panigrahi, Subhashish. "${title}." Registry of Type Design. O Foundation. Last modified ${updated}. Accessed __ACCESSED__. ${canonicalUrl}.`,
    mla: `Panigrahi, Subhashish. "${title}." Registry of Type Design, O Foundation, ${updated}, ${canonicalUrl}. Accessed __ACCESSED__.`,
    vancouver: `Panigrahi S. ${title} [Internet]. Registry of Type Design. O Foundation; ${year} [cited __ACCESSED__]. Available from: ${canonicalUrl}`,
    bibtex: `@misc{${record.id},\n  author       = {Panigrahi, Subhashish},\n  title        = {{${title}}},\n  howpublished = {Registry of Type Design},\n  publisher    = {O Foundation},\n  year         = {${year}},\n  url          = {${canonicalUrl}},\n  urldate      = {__ACCESSED__},\n  note         = {ARK: ${arkUrl}}\n}`,
  };
}

const DOWNLOAD_ICON = `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

export function citationBlock(record, { canonicalUrl, arkUrl }) {
  const citations = buildCitations(record, { canonicalUrl, arkUrl });
  const data = escapeHtml(JSON.stringify(citations));
  return `<section class="citation-block" data-citation="${data}" data-id="${escapeHtml(record.id)}">
<h2>Cite this record</h2>
<div class="citation-controls">
<label class="visually-hidden" for="citation-style-${escapeHtml(record.id)}">Citation format</label>
<select id="citation-style-${escapeHtml(record.id)}" class="citation-style">
<option value="apa">APA</option>
<option value="chicago">Chicago</option>
<option value="mla">MLA</option>
<option value="vancouver">Vancouver</option>
<option value="bibtex">BibTeX</option>
</select>
<button type="button" class="copy-id copy-icon-btn citation-copy" aria-label="Copy citation">${COPY_ICON}</button>
<button type="button" class="citation-download">${DOWNLOAD_ICON}Download .bib</button>
</div>
<pre class="citation-text"></pre>
</section>`;
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

// Fill colors come from styles.css (.about-link .ring / .glyph), not
// hardcoded here, so the icon follows the header's light/dark accent
// tokens instead of being stuck at one fixed color.
const INFO_ICON = `<svg aria-hidden="true" class="about-icon" viewBox="0 0 24 24"><circle class="ring" cx="12" cy="12" r="12"></circle><rect class="glyph" x="10.6" y="10.2" width="2.8" height="7.4" rx="1"></rect><circle class="glyph" cx="12" cy="6.7" r="1.6"></circle></svg>`;

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
const REPO_URL = "https://github.com/ofdn/rtd";

export function pageShell({
  title,
  canonicalUrl,
  jsonLd,
  body,
  homePath = "",
  showHeaderSearch = true,
  schemaVersion,
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
<link rel="stylesheet" href="${escapeHtml(homePath)}styles.css${cssVersion ? `?v=${cssVersion}` : ""}">
${jsonLd ? jsonLdScript(jsonLd) : ""}
</head>
<body>
<header class="site-header">
<a class="logo" href="${escapeHtml(homePath)}">
<img class="logo-img logo-img-light" src="${escapeHtml(homePath)}logo-black-1.svg" alt="Registry of Type Design" width="96" height="24">
<img class="logo-img logo-img-dark" src="${escapeHtml(homePath)}logo-white-1.svg" alt="Registry of Type Design" width="96" height="24">
</a>
${showHeaderSearch ? headerSearchForm(homePath) : ""}
<a class="about-link" href="${escapeHtml(homePath)}info/">${INFO_ICON}<span>About</span></a>
</header>
${body}
<footer class="site-footer">
<a class="footer-logo-link" href="https://theofdn.org" aria-label="O Foundation">
<img class="footer-logo footer-logo-light" src="${escapeHtml(homePath)}logo-black.svg" alt="" width="72" height="20">
<img class="footer-logo footer-logo-dark" src="${escapeHtml(homePath)}logo-white.svg" alt="" width="72" height="20">
</a>
<p>Registry of Type Design${siteVersion ? ` v${escapeHtml(siteVersion)}` : ""}${schemaVersion ? `, schema v${escapeHtml(schemaVersion)}` : ""}. A project of the <a href="https://theofdn.org">O Foundation</a>, maintained by Subhashish Panigrahi. <a href="${escapeHtml(homePath)}info/#licensing">License</a> &middot; <a href="${REPO_URL}">Source on GitHub</a> &middot; <a href="${escapeHtml(homePath)}preservation/">Preservation statement</a></p>
</footer>
<script>
document.querySelectorAll(".copy-id").forEach(function (btn) {
  btn.addEventListener("click", function () {
    navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(function () {
      btn.classList.add("copied");
      setTimeout(function () { btn.classList.remove("copied"); }, 1200);
    });
  });
});
document.querySelectorAll(".citation-block").forEach(function (block) {
  var citations = JSON.parse(block.getAttribute("data-citation"));
  var accessed = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  var select = block.querySelector(".citation-style");
  var pre = block.querySelector(".citation-text");
  var copyBtn = block.querySelector(".citation-copy");
  var downloadBtn = block.querySelector(".citation-download");
  function render() {
    var text = citations[select.value].replaceAll("__ACCESSED__", accessed);
    pre.textContent = text;
    copyBtn.setAttribute("data-copy", text);
  }
  select.addEventListener("change", render);
  render();
  downloadBtn.addEventListener("click", function () {
    var text = citations.bibtex.replaceAll("__ACCESSED__", accessed);
    var blob = new Blob([text], { type: "application/x-bibtex" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = block.getAttribute("data-id") + ".bib";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});
</script>
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
    links.push({ label: "Wikidata", value: externalIds.wikidata_qid, url: `https://www.wikidata.org/wiki/${externalIds.wikidata_qid}` });
  }
  if (externalIds.viaf) {
    links.push({ label: "VIAF", value: externalIds.viaf, url: `https://viaf.org/viaf/${externalIds.viaf}` });
  }
  if (externalIds.isni) {
    links.push({ label: "ISNI", value: externalIds.isni, url: `https://isni.org/isni/${externalIds.isni.replaceAll(" ", "")}` });
  }
  if (externalIds.lc_naf) {
    links.push({ label: "LC/NAF", value: externalIds.lc_naf, url: `https://id.loc.gov/authorities/names/${externalIds.lc_naf}` });
  }
  if (externalIds.gnd) {
    links.push({ label: "GND", value: externalIds.gnd, url: `https://d-nb.info/gnd/${externalIds.gnd}` });
  }
  if (externalIds.worldcat_entity) {
    links.push({ label: "WorldCat", value: externalIds.worldcat_entity, url: `https://id.oclc.org/worldcat/entity/${externalIds.worldcat_entity}` });
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
    .map(
      (l) =>
        `<li>${escapeHtml(l.label)}: <a href="${escapeHtml(l.url)}">${escapeHtml(l.url)}</a></li>`
    )
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
