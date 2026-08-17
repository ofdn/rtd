// Informational MARCXML export of a person record - built the same way as
// dublin-core.js, straight from schema fields at build time, one file per
// person, never hand-authored. This is NOT a NACO-authorized name authority
// record (RTD has no MARC organization code registered with LC, and the
// 040/500 fields below say so explicitly): it's a structured, MARC-shaped
// export for an institution's own ILS/discovery layer to ingest RTD data
// with, on the same 670-field pattern already used for RTD's own LC-NAF
// outreach (see CONTRIBUTING.md / HANDOFF for that precedent). Typefaces
// don't get a MARC export - MARC's authority format models named entities
// (people, corporate bodies), not individual creative works, which is what
// Dublin Core (dublin-core.js) already covers for both record types.
import { escapeXml } from "./xml.js";

// External-id keys mapped to their MARC 024 $2 (source of number/code)
// value, where an established code exists (isni/viaf/naf/gnd are on the
// official MARC Code List for Relators/Sources; worldcat/ulan/wikidata are
// not standardized, used here for consistency, not compliance).
const IDENTIFIER_CODES = {
  isni: "isni",
  viaf: "viaf",
  lc_naf: "naf",
  gnd: "gnd",
  worldcat_entity: "worldcat",
  ulan: "ulan",
  wikidata_qid: "wikidata",
};

function controlfield(tag, value) {
  return `  <controlfield tag="${tag}">${escapeXml(value)}</controlfield>`;
}

function datafield(tag, ind1, ind2, subfields) {
  const subs = subfields
    .filter(([, value]) => value)
    .map(([code, value]) => `    <subfield code="${code}">${escapeXml(value)}</subfield>`)
    .join("\n");
  return subs ? `  <datafield tag="${tag}" ind1="${ind1}" ind2="${ind2}">\n${subs}\n  </datafield>` : "";
}

export function buildPersonMarc(record, { canonicalUrl, arkUrl }) {
  const name = record.sort_name || record.name.preferred;
  const dates = [record.birth_year, record.death_year].filter(Boolean).join("-");
  const recordStatus = record.record_status === "active" ? "n" : "d";

  const fields = [
    datafield("040", " ", " ", [["a", "OFDN"], ["b", "eng"], ["c", "OFDN"], ["e", "rtd"]]),
    datafield("024", "7", " ", [["a", arkUrl], ["2", "ark"]]),
    ...Object.entries(IDENTIFIER_CODES).map(([key, code]) =>
      record.external_ids?.[key] ? datafield("024", "7", " ", [["a", record.external_ids[key]], ["2", code]]) : ""
    ),
    datafield("100", "1", " ", [["a", name], ["d", dates]]),
    ...(record.name.alternates ?? []).map((alt) => datafield("400", "1", " ", [["a", alt]])),
    record.countries?.length ? datafield("370", " ", " ", [["c", record.countries.join(", ")]]) : "",
    datafield("372", " ", " ", [["a", "Type design"]]),
    record.roles?.length ? datafield("374", " ", " ", [["a", record.roles.join(", ")]]) : "",
    record.gender ? datafield("375", " ", " ", [["a", record.gender]]) : "",
    ...(record.sources ?? []).map((s) => datafield("670", " ", " ", [["a", s.title], ["u", s.url]])),
    datafield("670", " ", " ", [["a", "Registry of Type Design"], ["u", canonicalUrl]]),
    record.record_status !== "active" && record.superseded_by
      ? datafield("667", " ", " ", [["a", `Superseded by ${record.superseded_by}.`]])
      : "",
    datafield("500", " ", " ", [
      ["a", "Informational export from the Registry of Type Design (rtd.theofdn.org), not a NACO-authorized name authority record."],
    ]),
    datafield("856", "4", "0", [["u", canonicalUrl], ["z", "Registry of Type Design record"]]),
  ].filter(Boolean);

  return `<?xml version="1.0" encoding="UTF-8"?>
<record xmlns="http://www.loc.gov/MARC21/slim">
  <leader>00000${recordStatus}z  a2200000n  4500</leader>
${controlfield("001", record.id)}
${controlfield("003", "OFDN-RTD")}
${fields.join("\n")}
</record>
`;
}
