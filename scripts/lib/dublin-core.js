// Simple (unqualified, 15-element) Dublin Core for every person and
// typeface record. Generated at build time straight from the same schema
// fields the HTML/JSON pages already use, so there's no separate
// DC-authoring step and the export can't drift out of sync with the record
// it describes: any future contributor adding a person/typeface via the
// normal data/ workflow gets one automatically, nothing extra to do.
//
// Wrapped in the oai_dc envelope (the format OAI-PMH harvesters and most
// repository/ILS import tools expect), even though RTD doesn't run an
// OAI-PMH endpoint itself - the per-record XML file at the same URL
// pattern as the JSON API is the delivery mechanism.
import { escapeXml } from "./xml.js";

const RIGHTS = "CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/";

function dcXml(elements) {
  const body = elements
    .filter(([, value]) => value)
    .map(([tag, value]) => `  <dc:${tag}>${escapeXml(value)}</dc:${tag}>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<oai_dc:dc xmlns:oai_dc="http://www.openarchives.org/OAI/2.0/oai_dc/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd">
${body}
</oai_dc:dc>
`;
}

export function buildPersonDc(record, { canonicalUrl, arkUrl, works }) {
  const dates = [record.birth_year, record.death_year].filter(Boolean).join("-");
  const elements = [
    ["title", dates ? `${record.name.preferred} (${dates})` : record.name.preferred],
    ["creator", "Registry of Type Design"],
    ...(record.roles ?? []).map((r) => ["subject", r]),
    ...(record.scripts ?? []).map((s) => ["subject", s]),
    ["description", record.bio ?? ""],
    ["publisher", "O Foundation"],
    // Metadata-record date (last time this RTD record itself changed), not
    // the person's own dates - those are already carried in the title and
    // in 100 $d on the MARCXML sibling export.
    ["date", record.updated_at],
    ["type", "Text"],
    ["format", "text/html"],
    ["identifier", record.id],
    ["identifier", canonicalUrl],
    ["identifier", arkUrl],
    ...(record.sources ?? []).map((s) => ["source", `${s.title}: ${s.url}`]),
    ["language", "en"],
    ...(works ?? []).map((w) => ["relation", `${w.name}: ${w.canonicalUrl}`]),
    ["coverage", (record.countries ?? []).join("; ")],
    record.record_status !== "active" && record.superseded_by
      ? ["relation", `Superseded by ${record.superseded_by}`]
      : null,
    ["rights", RIGHTS],
  ].filter(Boolean);
  return dcXml(elements);
}

export function buildTypefaceDc(record, { canonicalUrl, arkUrl, designers }) {
  const subjects = [...(record.scripts ?? [])];
  if (record.classification) subjects.push(record.classification);
  const elements = [
    ["title", record.name.preferred],
    ...(designers ?? []).map((d) => ["creator", d.name]),
    ...subjects.map((s) => ["subject", s]),
    ["description", record.description ?? ""],
    ["publisher", (record.foundry ?? []).map((f) => f.name).join("; ") || "O Foundation"],
    ["date", record.release_year || record.design_year || record.updated_at],
    ["type", "Text"],
    ["format", "text/html"],
    ["identifier", record.id],
    ["identifier", canonicalUrl],
    ["identifier", arkUrl],
    ...(record.sources ?? []).map((s) => ["source", `${s.title}: ${s.url}`]),
    ["language", "en"],
    ...(designers ?? []).map((d) => ["relation", `${d.name}: ${d.canonicalUrl}`]),
    record.record_status !== "active" && record.superseded_by
      ? ["relation", `Superseded by ${record.superseded_by}`]
      : null,
    ["rights", RIGHTS],
  ].filter(Boolean);
  return dcXml(elements);
}
