import { pageShell, escapeHtml, linkTag, sectionAnchor } from "./shared.js";

// Static content page, not data-driven, so unlike person.js/typeface.js
// this has no per-record inputs beyond the counts already computed for
// the home page. Kept as its own template file (rather than an inline
// string in build.js like the smaller preservation/servicestatus pages)
// because it's long enough to be worth editing on its own.
export function renderInfoPage({ canonicalUrl, peopleCount, typefacesCount, scriptsCount, schemaVersion, arkNaan }) {
  const body = `
<main>
<h1>About the registry</h1>

<p class="description">Registry of Type Design (RTD) is a free, human- and machine-readable registry of typefaces and the people who made them, digital and pre-digital, across scripts and geographies. Every record is independently sourced, given a permanent identifier, and published as a citable page alongside open data, so it can be reused, cross-referenced, or checked against its own sources.</p>

<h2 id="origin">Origin ${sectionAnchor("origin")}</h2>
<p class="description">Registry of Type Design began as a concept in 2021, aiming to keep a live registry of verifiable information about typefaces and the people who made them. The registry's founder, Subhashish Panigrahi, was trying to collect information about typefaces and type designers to update Wikidata, and reached out to several type designers, including Dave Crossland (Google Fonts), Yesha Goshar, Kalapi Gajjar-Bordawekar (Universal Thirst), who pointed at existing public resources such as Google Fonts, Adobe Fonts, Typotheque, and MyFonts, among others. While those sites are cited in RTD as sources, they are not catalogues of typefaces and type professionals. By 2026, the paper prototype had become a live project with the full capability to maintain permanent records of type design history. Registry of Type Design is currently maintained at the ${linkTag("https://theofdn.org", "O Foundation")}.</p>

<h2 id="contributors">Contributors ${sectionAnchor("contributors")}</h2>
<p class="description">Most existing records were researched and entered directly by the registry's maintainers. Anyone else who submits a record - via a <a href="../">New person or New typeface issue form</a> or a direct pull request - is credited by name on that record's own "Cite this record" section instead, and listed on the <a href="../contributors/">Contributors</a> page. Contributors can be individuals or institutions.</p>

<h2 id="licensing">Licensing ${sectionAnchor("licensing")}</h2>
<p class="description">Site and data are licensed under ${linkTag("https://creativecommons.org/licenses/by-sa/4.0/", "Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)")}: reuse, adaptation, and redistribution are permitted with attribution to Registry of Type Design and a link to the license.</p>
${linkTag("https://creativecommons.org/licenses/by-sa/4.0/", `<img class="cc-badge" src="../cc-by-sa.svg" alt="Creative Commons Attribution-ShareAlike 4.0 International" width="88" height="31">`, 'class="cc-badge-link"')}

<h2 id="machine-readable-data">Machine-readable data ${sectionAnchor("machine-readable-data")}</h2>
<p class="description">Every record here is published as JSON alongside its HTML page. The <a href="../api/people.json">People API</a> and <a href="../api/typefaces.json">Typefaces API</a> list every active record with its id, name, and canonical URL. Each individual record is also its own JSON document, for example <a href="../api/people/rtd-p-000001.json">api/people/rtd-p-000001.json</a>. Every record also has a ${linkTag("https://www.loc.gov/standards/sourcedescription/simpledc20021212.xml", "Dublin Core")} XML export at the same path with a <code>.dc.xml</code> extension, and every person record additionally has a ${linkTag("https://www.loc.gov/marc/", "MARCXML")} export at <code>.marc.xml</code>, built directly from the same schema fields, so an institution's own ILS or repository software can ingest a record without hand-mapping JSON first. The MARCXML export is informational, not a NACO-authorized name authority record, and says so in its own <code>500</code> field. Bulk CSV and NDJSON dumps of the full dataset are published at <a href="../dumps/">/dumps/</a>, for mirroring or offline analysis without hitting the API record by record.</p>

<h2 id="reconciliation">Reconciliation service ${sectionAnchor("reconciliation")}</h2>
<p class="description">RTD runs an ${linkTag("https://reconciliation-api.github.io/specs/0.2/", "OpenRefine Reconciliation Service API")} (v0.2) at <a href="https://rtd.theofdn.org/reconcile">rtd.theofdn.org/reconcile</a>, so a spreadsheet column of names can be matched against RTD the same way OpenRefine already matches against Wikidata. In OpenRefine, on a text column: <strong>Reconcile &rarr; Start reconciling &rarr; Add Standard Service</strong>, enter the URL (https://rtd.theofdn.org/reconcile), then reconcile against the "Person" or "Typeface" type. It reads RTD's own published data at request time, so it always reflects whatever's currently live, no separate copy to keep in sync. RTD is listed among OpenRefine's own documented ${linkTag("https://github.com/OpenRefine/OpenRefine/wiki/Reconcilable-Data-Sources", "Reconcilable Data Sources")}.</p>

<h2 id="external-identifiers">External identifiers ${sectionAnchor("external-identifiers")}</h2>
<p class="description">Where available, a record's Identifiers section lists a ${linkTag("https://www.wikidata.org/", "Wikidata")} QID, ${linkTag("https://viaf.org/", "VIAF")} and ${linkTag("https://isni.org/", "ISNI")} (name authority files used by libraries worldwide), ${linkTag("https://id.loc.gov/", "LC/NAF")} (Library of Congress), ${linkTag("https://d-nb.info/", "GND")} (the German national authority file), a ${linkTag("https://id.oclc.org/worldcat/", "WorldCat")} Entity id, and a Getty ${linkTag("https://www.getty.edu/research/tools/vocabularies/ulan/", "ULAN")} id (Union List of Artist Names). These are cross-references, a distinct concept from <code>sources</code> (see the sourcing policy in CONTRIBUTING.md): they let a researcher or another database confirm that a person or typeface here is the same one referenced elsewhere. Wikidata items can also point back: the ${linkTag("https://www.wikidata.org/wiki/Property:P14791", "Registry of Type Design ID (P14791)")} property stores an RTD id directly on the matching Wikidata item.</p>

<h2 id="rtd-ids-and-schema">RTD ids and the schema ${sectionAnchor("rtd-ids-and-schema")}</h2>
<p class="description">Every record has a permanent, opaque id (<code>rtd-p-000001</code> for people, <code>rtd-t-000001</code> for typefaces): six digits, assigned sequentially, never reused or reassigned once published, even if a record is later merged or deprecated. The <code>slug</code> used in a page's URL can change if a record is renamed, the id never does. The full validation rules are public: ${linkTag("https://github.com/ofdn/rtd/blob/main/schema/person.schema.json", "person.schema.json")} and ${linkTag("https://github.com/ofdn/rtd/blob/main/schema/typeface.schema.json", "typeface.schema.json")} on GitHub define exactly what a valid record looks like, currently schema v${schemaVersion}, versioned separately from the site itself so a change to the data shape is always visible and dated.</p>
<p class="description">RTD ids also resolve as ARK identifiers under NAAN <code>${escapeHtml(arkNaan)}</code> (<code>ark:${escapeHtml(arkNaan)}/rtd-p-000001</code>, resolvable at ${linkTag(`https://n2t.net/ark:${arkNaan}/rtd-p-000001`, `n2t.net/ark:${escapeHtml(arkNaan)}/rtd-p-000001`)}), registered in the ARK Alliance's own NAAN registry (${linkTag("https://arks.org/ark:54728", "arks.org/ark:54728")}), and the registry commits to keeping identifiers and data available long-term, see the <a href="../preservation/">preservation and persistence statement</a> for specifics.</p>

<p class="stat-line">Registry of Type Design currently archives details of <strong>${peopleCount}</strong> people and <strong>${typefacesCount}</strong> typefaces in <strong>${scriptsCount}</strong> scripts.</p>
</main>
`;

  return pageShell({
    title: "About",
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "../",
    schemaVersion,
  });
}
