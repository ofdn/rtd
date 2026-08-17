// Shared by dublin-core.js and marc-authority.js, kept separate from
// site-templates/shared.js's escapeHtml since XML additionally requires
// apostrophes escaped (HTML doesn't).
export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
