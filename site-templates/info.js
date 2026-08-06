import { pageShell, escapeHtml } from "./shared.js";

// Static content page, not data-driven, so unlike person.js/typeface.js
// this has no per-record inputs beyond the counts already computed for
// the home page. Kept as its own template file (rather than an inline
// string in build.js like the smaller preservation/servicestatus pages)
// because it's long enough to be worth editing on its own.
export function renderInfoPage({ canonicalUrl, peopleCount, typefacesCount, schemaVersion, arkNaan }) {
  const body = `
<main>
<h1>About the registry</h1>

<h2>Origin</h2>
<p class="description">Registry of Type Design began as a concept in 2021, aiming to keep a live registry of verifiable information about typefaces and the people who made them. The registry's founder, Subhashish Panigrahi, was trying to collect information about typefaces and type designers to update Wikidata, and reached out to several type designers, including Dave Crossland (Google Fonts) and Kalapi Gajjar-Bordawekar (Universal Thirst), who pointed at existing public resources such as Google Fonts, Adobe Fonts, Typotheque, and MyFonts, among others. None of those sites maintain a permanent record of typefaces and type professionals that is both human- and machine-readable. By 2026, the paper prototype had become a live project with the full capability to maintain permanent records of type design history. Registry of Type Design is currently maintained at the <a href="https://theofdn.org">O Foundation</a>.</p>

<h2 id="licensing">Licensing</h2>
<p class="description">Site and data are licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)</a>: reuse, adaptation, and redistribution are permitted with attribution to Registry of Type Design and a link to the license. &copy; Subhashish Panigrahi.</p>

<h2>Machine-readable data</h2>
<p class="description">Every record here is published as JSON alongside its HTML page. The <a href="../api/people.json">People API</a> and <a href="../api/typefaces.json">Typefaces API</a> list every active record with its id, name, and canonical URL. Each individual record is also its own JSON document, for example <a href="../api/people/rtd-p-000001.json">api/people/rtd-p-000001.json</a>. Bulk CSV and NDJSON dumps of the full dataset are published at <a href="../dumps/">/dumps/</a>, for mirroring or offline analysis without hitting the API record by record.</p>

<h2>External identifiers</h2>
<p class="description">Where available, a record's Identifiers section lists a <a href="https://www.wikidata.org/">Wikidata</a> QID, <a href="https://viaf.org/">VIAF</a> and <a href="https://isni.org/">ISNI</a> (name authority files used by libraries worldwide), <a href="https://id.loc.gov/">LC/NAF</a> (Library of Congress), <a href="https://d-nb.info/">GND</a> (the German national authority file), and a <a href="https://id.oclc.org/worldcat/">WorldCat</a> Entity id. These are cross-references, a distinct concept from <code>sources</code> (see the sourcing policy in CONTRIBUTING.md): they let a researcher or another database confirm that a person or typeface here is the same one referenced elsewhere.</p>

<h2>RTD ids and the schema</h2>
<p class="description">Every record has a permanent, opaque id (<code>rtd-p-000001</code> for people, <code>rtd-t-000001</code> for typefaces): six digits, assigned sequentially, never reused or reassigned once published, even if a record is later merged or deprecated. The <code>slug</code> used in a page's URL can change if a record is renamed, the id never does. The full validation rules are public: <a href="https://github.com/ofdn/rtd/blob/main/schema/person.schema.json">person.schema.json</a> and <a href="https://github.com/ofdn/rtd/blob/main/schema/typeface.schema.json">typeface.schema.json</a> on GitHub define exactly what a valid record looks like, currently schema v${schemaVersion}, versioned separately from the site itself so a change to the data shape is always visible and dated.</p>
<p class="description">RTD ids also resolve as ARK identifiers under NAAN <code>${escapeHtml(arkNaan)}</code> (<code>ark:${escapeHtml(arkNaan)}/rtd-p-000001</code>, resolvable at <a href="https://n2t.net/ark:${escapeHtml(arkNaan)}/rtd-p-000001">n2t.net/ark:${escapeHtml(arkNaan)}/rtd-p-000001</a>), and the registry commits to keeping identifiers and data available long-term, see the <a href="../preservation/">preservation and persistence statement</a> for specifics.</p>

<p class="stat-line">Currently tracking <strong>${peopleCount}</strong> people, <strong>${typefacesCount}</strong> typefaces.</p>
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
