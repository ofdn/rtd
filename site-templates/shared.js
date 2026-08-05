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

// Resolves external_ids into canonical linked-data URIs for JSON-LD sameAs.
export function sameAsUris(externalIds) {
  if (!externalIds) return undefined;
  const uris = [];
  if (externalIds.wikidata_qid) {
    uris.push(`https://www.wikidata.org/wiki/${externalIds.wikidata_qid}`);
  }
  if (externalIds.viaf) {
    uris.push(`https://viaf.org/viaf/${externalIds.viaf}`);
  }
  if (externalIds.isni) {
    uris.push(`https://isni.org/isni/${externalIds.isni.replaceAll(" ", "")}`);
  }
  if (externalIds.lc_naf) {
    uris.push(`https://id.loc.gov/authorities/names/${externalIds.lc_naf}`);
  }
  if (externalIds.gnd) {
    uris.push(`https://d-nb.info/gnd/${externalIds.gnd}`);
  }
  return uris.length ? uris : undefined;
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
