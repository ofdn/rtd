import { escapeHtml, pageShell } from "./shared.js";

export function renderHomePage({ canonicalUrl, people, typefaces }) {
  const peopleList = people
    .map(
      (p) =>
        `<li><a href="people/${escapeHtml(p.slug)}/">${escapeHtml(p.name)}</a></li>`
    )
    .join("\n");
  const typefacesList = typefaces
    .map(
      (t) =>
        `<li><a href="typefaces/${escapeHtml(t.slug)}/">${escapeHtml(t.name)}</a></li>`
    )
    .join("\n");

  const body = `
<h1>Registry of Type Design</h1>
<p>A global registry of typefaces and the people who made them, digital and pre-digital.</p>
<input id="search" type="search" placeholder="Search people and typefaces&hellip;" aria-label="Search">
<p><a href="api/people.json">People API</a> &middot; <a href="api/typefaces.json">Typefaces API</a> &middot; <a href="dumps/">Bulk dumps</a></p>
<div id="results" style="display:none"></div>
<h2>People (${people.length})</h2>
<ul id="people-list">
${peopleList}
</ul>
<h2>Typefaces (${typefaces.length})</h2>
<ul id="typefaces-list">
${typefacesList}
</ul>
<script>
(function () {
  var input = document.getElementById("search");
  var results = document.getElementById("results");
  var peopleList = document.getElementById("people-list");
  var typefacesList = document.getElementById("typefaces-list");
  var index = null;

  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();
    if (!q) {
      results.style.display = "none";
      peopleList.parentElement && (peopleList.style.display = "");
      return;
    }
    function run() {
      var matches = index.filter(function (item) {
        return (
          item.name.toLowerCase().includes(q) ||
          (item.alternates || []).some(function (a) {
            return a.toLowerCase().includes(q);
          })
        );
      });
      results.style.display = "block";
      results.innerHTML =
        "<h2>Search results</h2><ul>" +
        matches
          .map(function (m) {
            var href = (m.kind === "person" ? "people/" : "typefaces/") + m.slug + "/";
            return '<li><a href="' + href + '">' + m.name + "</a></li>";
          })
          .join("") +
        "</ul>";
    }
    if (index) {
      run();
    } else {
      fetch("search-index.json")
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          index = data;
          run();
        });
    }
  });
})();
</script>
`;

  return pageShell({
    title: "Registry of Type Design",
    canonicalUrl,
    jsonLd: null,
    body,
  });
}
