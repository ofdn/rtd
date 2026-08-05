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

export function pageShell({ title, canonicalUrl, jsonLd, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}, Registry of Type Design</title>
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">
<meta name="viewport" content="width=device-width, initial-scale=1">
${jsonLd ? jsonLdScript(jsonLd) : ""}
</head>
<body>
${body}
<footer>
<p><small>&copy; Subhashish Panigrahi. Data licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</small></p>
</footer>
</body>
</html>
`;
}

export function verificationNote(record) {
  if (record.verification_status !== "needs_verification") return "";
  return `<p><strong>Needs verification:</strong> sources for this record are thin or low-confidence. Help improve it by <a href="https://github.com/ofdn/rtd/blob/main/CONTRIBUTING.md">contributing a stronger source</a>.</p>`;
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
  return `<h2>Identifiers</h2>\n<ul>\n${items}\n</ul>`;
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
  return `<h2>Sources</h2>\n<ul>\n${items}\n</ul>`;
}
