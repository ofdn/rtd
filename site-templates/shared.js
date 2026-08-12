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

// Every link off rtd.theofdn.org itself (including theofdn.org, the
// parent O Foundation site, which is a separate site from RTD) opens in
// a new tab; internal navigation never does. noopener/noreferrer: the
// new tab shouldn't get a handle back to this page (a real, if minor,
// security consideration whenever target="_blank" is used).
const SITE_HOSTS = new Set(["rtd.theofdn.org"]);
export const EXTERNAL_LINK_ATTRS = 'target="_blank" rel="noopener noreferrer"';
export function isExternalUrl(url) {
  try {
    return !SITE_HOSTS.has(new URL(url).hostname);
  } catch {
    return false; // relative path, e.g. "../people/foo/", always internal
  }
}
// `<a>` tag builder used anywhere a URL comes from data (sources[], the
// identifier authority-file links, search results) rather than being
// hand-written in a template, so external-ness is decided once per call
// site instead of copy-pasted attribute strings everywhere.
export function linkTag(url, innerHtml, extraAttrs = "") {
  const target = isExternalUrl(url) ? ` ${EXTERNAL_LINK_ATTRS}` : "";
  return `<a href="${escapeHtml(url)}"${extraAttrs ? ` ${extraAttrs}` : ""}${target}>${innerHtml}</a>`;
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

const LINK_ICON = `<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;

// Permalink icon next to a heading, so a section on a long static page
// (like /info/) can be linked or cited directly instead of just the
// page as a whole. Plain anchor jump, no clipboard JS needed, the URL
// bar/right-click "copy link" already does the rest.
export function sectionAnchor(id) {
  return `<a class="section-anchor" href="#${escapeHtml(id)}" aria-label="Link to this section" title="Link to this section">${LINK_ICON}</a>`;
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

// Both icons ship in the DOM always; styles.css shows whichever matches
// the effective theme (see .theme-toggle .icon-sun/.icon-moon), same
// three-state pattern (system/explicit-light/explicit-dark) as the color
// tokens at the top of the stylesheet. Icon shown is the mode a click
// would switch *to*, not the current one.
const THEME_TOGGLE_ICON = `<svg class="icon-sun" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"></circle><line x1="12" y1="1.5" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22.5"></line><line x1="1.5" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22.5" y2="12"></line><line x1="4.5" y1="4.5" x2="6.2" y2="6.2"></line><line x1="17.8" y1="17.8" x2="19.5" y2="19.5"></line><line x1="4.5" y1="19.5" x2="6.2" y2="17.8"></line><line x1="17.8" y1="6.2" x2="19.5" y2="4.5"></line></svg><svg class="icon-moon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 1 0 11 11z"></path></svg>`;

// A single GET form works everywhere: on the home page itself, action=""
// submits back to the same page (progressively enhanced into a live
// client-side filter by home.js); on a person/typeface page, homePath
// ("../../") submits to the registry root with the query as ?q=, which
// home.js reads on load and searches immediately. No JS is required for
// this to work at all, only for it to avoid a full page reload.
//
// `#header-search-results` is the quick-select dropdown (wired up by the
// inline script in pageShell): as you type, if the query already matches
// a record in the index, a few candidates appear right there to jump to
// directly, instead of needing to submit and land on the home page's full
// results list to find out a record already exists.
function headerSearchForm(homePath) {
  return `<div class="header-search-wrap">
<form class="header-search" action="${escapeHtml(homePath)}" method="get" role="search">
<span class="header-search-icon" aria-hidden="true">${SEARCH_ICON}</span>
<label class="visually-hidden" for="header-search-input">Search people and typefaces</label>
<input id="header-search-input" type="search" name="q" placeholder="Search by name, typeface, or foundry&hellip;" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="header-search-results" aria-autocomplete="list">
<button type="button" id="header-search-clear" class="header-search-clear" aria-label="Clear search" hidden>&times;</button>
</form>
<div id="header-search-results" class="header-search-results" hidden></div>
</div>`;
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
<script>
// Runs before the stylesheet loads, so an explicit theme choice applies
// immediately with no flash of the wrong theme. No explicit choice made
// yet: leaves data-theme unset entirely and lets the prefers-color-scheme
// media query in styles.css drive it, same three-state pattern used
// throughout the CSS.
(function () {
  try {
    var t = localStorage.getItem("rtd-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
</script>
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
<button type="button" id="theme-toggle" class="theme-toggle" aria-label="Toggle dark mode">${THEME_TOGGLE_ICON}</button>
<a class="about-link" href="${escapeHtml(homePath)}info/">${INFO_ICON}<span>About</span></a>
</header>
${body}
<footer class="site-footer">
<div class="footer-content">
<a class="footer-logo-link" href="https://theofdn.org" aria-label="O Foundation" ${EXTERNAL_LINK_ATTRS}>
<img class="footer-logo footer-logo-light" src="${escapeHtml(homePath)}logo-black.svg" alt="" width="72" height="20">
<img class="footer-logo footer-logo-dark" src="${escapeHtml(homePath)}logo-white.svg" alt="" width="72" height="20">
</a>
<p>Registry of Type Design${siteVersion ? ` v${escapeHtml(siteVersion)}` : ""}${schemaVersion ? `, schema v${escapeHtml(schemaVersion)}` : ""}. A project of the ${linkTag("https://theofdn.org", "O Foundation")}, maintained by Subhashish Panigrahi. <a href="${escapeHtml(homePath)}info/#licensing">License</a> &middot; ${linkTag(REPO_URL, "Source on GitHub")} &middot; <a href="${escapeHtml(homePath)}preservation/">Preservation statement</a></p>
</div>
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

// Header search quick-select: as-you-type dropdown of existing records
// matching the query, so a search for something already in the registry
// doesn't require submitting and landing on the home page's full results
// list just to find out. No-ops entirely on the home page, which doesn't
// render this header form (it has its own hero search instead).
(function () {
  var input = document.getElementById("header-search-input");
  if (!input) return;
  var wrap = input.closest(".header-search-wrap");
  var form = input.closest("form");
  var results = document.getElementById("header-search-results");
  var clearBtn = document.getElementById("header-search-clear");
  var indexPromise = null;
  var MAX_RESULTS = 6;

  function updateClearVisibility() {
    clearBtn.hidden = !input.value;
  }

  function escapeHtmlClient(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // Same id-query and order/punctuation-insensitive name matching as
  // home.js's search (see there for the fuller rationale), duplicated
  // here rather than shared since this whole script is a template
  // literal with no module system on the client side.
  function parseIdQuery(raw) {
    var q = raw.trim();
    var full = /^rtd-?([pt])-?0*([0-9]+)$/i.exec(q);
    if (full) {
      return { kind: full[1].toLowerCase() === "p" ? "person" : "typeface", num: parseInt(full[2], 10) };
    }
    var bare = /^[0-9]+$/.exec(q);
    if (bare) {
      return { kind: null, num: parseInt(bare[0], 10) };
    }
    return null;
  }
  function idNum(id) {
    var m = /-([0-9]+)$/.exec(id);
    return m ? parseInt(m[1], 10) : null;
  }
  function idMatches(item, parsedId) {
    if (!parsedId) return false;
    if (idNum(item.id) !== parsedId.num) return false;
    if (parsedId.kind && item.kind !== parsedId.kind) return false;
    return true;
  }
  function normalizeForSearch(s) {
    return s.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokenSearchMatch(query, target) {
    var qTokens = normalizeForSearch(query).split(" ").filter(Boolean);
    if (!qTokens.length) return false;
    var normTarget = normalizeForSearch(target);
    return qTokens.every(function (t) {
      return normTarget.indexOf(t) !== -1;
    });
  }
  // A record's scripts[] stores the writing system ("Ol Chiki"), not the
  // language it's usually associated with ("Santali"), so a plain
  // tokenSearchMatch against scripts[] alone would miss a reader who
  // searches by language. This maps a handful of language names onto the
  // script they're inseparably tied to in this registry's own data (see
  // each script's records for the sourced language link), same
  // duplication rationale as the id/identifier helpers above.
  var SCRIPT_LANGUAGE_ALIASES = {
    "santali": "Ol Chiki",
    "santhali": "Ol Chiki",
    "ho": "Warang Citi",
    "punjabi": "Gurmukhi",
    "oriya": "Odia",
    "bangla": "Bengali"
  };
  function scriptSearchMatch(query, scripts) {
    if (!scripts || !scripts.length) return false;
    var normQuery = normalizeForSearch(query);
    var aliasTarget = SCRIPT_LANGUAGE_ALIASES[normQuery];
    return scripts.some(function (s) {
      return tokenSearchMatch(query, s) || (aliasTarget && s === aliasTarget);
    });
  }
  // Same exact-value identifier matching as home.js's search (see there
  // for the fuller rationale), duplicated here for the same reason as
  // the id-query helpers above: no module system on this inline script.
  function identifierMatches(item, rawQuery) {
    if (!item.external_ids) return false;
    var q = rawQuery.trim();
    var qCompact = q.replace(/[\\s-]+/g, "");
    if (!q) return false;
    return Object.keys(item.external_ids).some(function (field) {
      var value = String(item.external_ids[field]);
      return value === q || value === qCompact;
    });
  }
  function findDirectMatch(index, q) {
    var parsedId = parseIdQuery(q);
    var hits = index.filter(function (item) {
      return idMatches(item, parsedId) || identifierMatches(item, q);
    });
    return hits.length === 1 ? hits[0] : null;
  }

  function loadIndex() {
    if (indexPromise) return indexPromise;
    var base = form.getAttribute("action") || "";
    indexPromise = fetch(base + "search-index.json").then(function (r) {
      return r.json();
    });
    return indexPromise;
  }

  function hide() {
    results.hidden = true;
    results.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
  }

  function show(matches, q) {
    if (!matches.length) {
      results.innerHTML =
        '<p class="no-matches">No matches for &ldquo;' + escapeHtmlClient(q) + '&rdquo; yet.</p>';
    } else {
      results.innerHTML =
        "<ul>" +
        matches
          .slice(0, MAX_RESULTS)
          .map(function (m) {
            return (
              '<li><a href="' + m.canonical_url + '"><span class="name">' + escapeHtmlClient(m.name) + "</span>" +
              '<span class="kind-tag">' + m.kind + "</span>" +
              (m.subtitle ? '<span class="subtitle">' + escapeHtmlClient(m.subtitle) + "</span>" : "") +
              "</a></li>"
            );
          })
          .join("") +
        "</ul>";
    }
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("input", function () {
    updateClearVisibility();
    var q = input.value.trim();
    if (!q) {
      hide();
      return;
    }
    loadIndex().then(function (index) {
      var parsedId = parseIdQuery(q);
      var matches = index.filter(function (item) {
        return (
          tokenSearchMatch(q, item.name) ||
          (item.alternates || []).some(function (a) {
            return tokenSearchMatch(q, a);
          }) ||
          idMatches(item, parsedId) ||
          identifierMatches(item, q) ||
          scriptSearchMatch(q, item.scripts)
        );
      });
      show(matches, q);
    });
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    updateClearVisibility();
    hide();
    input.focus();
  });

  wrap.addEventListener("focusout", function (e) {
    if (!wrap.contains(e.relatedTarget)) hide();
  });

  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) hide();
  });

  // Enter still falls through to the plain GET submission (lands on the
  // home page's own results for a name query, unchanged) unless the
  // query is unambiguously an id, in which case skip straight to that
  // record instead of making the reader click through the dropdown.
  form.addEventListener("submit", function (e) {
    var q = input.value.trim();
    if (!q) return;
    e.preventDefault();
    var base = form.getAttribute("action") || "";
    loadIndex().then(function (index) {
      var hit = findDirectMatch(index, q);
      if (hit) {
        window.location.href = base + (hit.kind === "person" ? "people/" : "typefaces/") + hit.slug + "/";
      } else {
        window.location.href = base + "?q=" + encodeURIComponent(q);
      }
    });
  });
})();

// Theme toggle: flips between explicit light/dark, persisted to
// localStorage (read back by the anti-flash script in <head>). With no
// explicit choice ever made, this never runs and the page just follows
// the OS via the prefers-color-scheme media queries in styles.css.
(function () {
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  function isDark() {
    var explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function updateLabel() {
    toggle.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
  }

  updateLabel();
  toggle.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rtd-theme", next);
    } catch (e) {}
    updateLabel();
  });
})();
</script>
</body>
</html>
`;
}

export function verificationNote(record) {
  if (record.verification_status !== "needs_verification") return "";
  return `<aside class="callout"><strong>NOTE</strong><p>Add more verified sources if you have to improve this record.</p></aside>`;
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
  if (externalIds.ulan) {
    links.push({ label: "ULAN", value: externalIds.ulan, url: `https://vocab.getty.edu/page/ulan/${externalIds.ulan}` });
  }
  return links;
}

export function sameAsUris(externalIds) {
  const links = identifierLinks(externalIds);
  return links.length ? links.map((l) => l.url) : undefined;
}

// Rendered as bordered label badges (same visual language as the
// record-id badge next to the page title, see .record-id in styles.css),
// linking straight out to each authority file rather than printing the
// raw URL as visible text.
export function identifiersList(externalIds) {
  const links = identifierLinks(externalIds);
  if (!links.length) return "";
  const items = links
    .map((l) => linkTag(l.url, escapeHtml(l.label), `class="identifier-badge" title="${escapeHtml(l.value)}"`))
    .join("\n");
  return `<h2>Identifiers</h2>\n<div class="identifier-badges">\n${items}\n</div>`;
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

// Collapses "Latin" / "Latin script" / "Greek alphabet" style variants
// recorded across different entries into one canonical display name, so
// they land on the same /scripts/<slug>/ tag page instead of splitting
// into near-duplicate tags.
export function canonicalScriptName(script) {
  return script.replace(/\s+(script|alphabet)$/i, "").trim();
}

export function scriptSlug(script) {
  return canonicalScriptName(script)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Renders each of a record's scripts[] as a clickable tag pointing at its
// /scripts/<slug>/ page (same bordered-badge visual language as
// identifiersList, see .identifier-badge in styles.css). Person and
// typeface pages both live two levels deep (people/<slug>/,
// typefaces/<slug>/), so the relative path back up to /scripts/ is the
// same from either template.
export function scriptBadges(scripts) {
  if (!scripts || scripts.length === 0) return "";
  return scripts
    .map((s) =>
      linkTag(`../../scripts/${scriptSlug(s)}/`, escapeHtml(canonicalScriptName(s)), 'class="script-badge"')
    )
    .join("\n");
}

export function sourcesList(sources) {
  if (!sources || sources.length === 0) return "";
  const items = sources
    .map((s) => `<li>${linkTag(s.url, escapeHtml(s.title))}</li>`)
    .join("\n");
  return `<h2>Sources</h2>\n<ul class="plain-list">\n${items}\n</ul>`;
}
