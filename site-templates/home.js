import { pageShell } from "./shared.js";

// The home page doesn't print full people/typeface lists inline: at
// registry scale (thousands of entries expected) that would bloat every
// page load. Instead it fetches search-index.json once and offers two
// client-side views over the same in-memory data: free-text search, and
// an A-Z letter picker. Both are driven by escapeHtml'd output built from
// the index, which is already public JSON, not user input, so no server
// round trip is needed per interaction.
export function renderHomePage({ canonicalUrl, peopleCount, typefacesCount }) {
  const body = `
<h1>Registry of Type Design</h1>
<p>A global registry of typefaces and the people who made them, digital and pre-digital.</p>
<input id="search" type="search" placeholder="Search people and typefaces&hellip;" aria-label="Search">
<p><a href="api/people.json">People API</a> &middot; <a href="api/typefaces.json">Typefaces API</a> &middot; <a href="dumps/">Bulk dumps</a></p>
<p>${peopleCount} people, ${typefacesCount} typefaces.</p>
<nav id="letters" aria-label="Browse by first letter"></nav>
<div id="results"></div>
<script>
(function () {
  var input = document.getElementById("search");
  var results = document.getElementById("results");
  var lettersNav = document.getElementById("letters");
  var index = null;
  var indexPromise = null;

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // Folds an accented first character to its plain base letter (e.g.
  // "Älvarez" groups under "A") using Unicode NFD decomposition.
  function foldedFirstLetter(name) {
    var base = name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
    return (base[0] || "").toUpperCase();
  }

  function renderList(items) {
    if (!items.length) return "<p>No entries found.</p>";
    return (
      "<ul>" +
      items
        .map(function (m) {
          var href = (m.kind === "person" ? "people/" : "typefaces/") + m.slug + "/";
          return '<li><a href="' + href + '">' + escapeHtml(m.name) + "</a></li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function loadIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch("search-index.json")
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        index = data;
        renderLetterNav();
        return data;
      });
    return indexPromise;
  }

  function renderLetterNav() {
    var letters = {};
    index.forEach(function (item) {
      var key = foldedFirstLetter(item.sort_name || item.name);
      if (key) letters[key] = true;
    });
    var present = Object.keys(letters).sort();
    lettersNav.innerHTML = present
      .map(function (l) {
        return '<button type="button" data-letter="' + l + '">' + l + "</button>";
      })
      .join(" ");
    lettersNav.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showLetter(btn.getAttribute("data-letter"));
      });
    });
  }

  function showLetter(letter) {
    input.value = "";
    var matches = index
      .filter(function (item) {
        return foldedFirstLetter(item.sort_name || item.name) === letter;
      })
      .sort(function (a, b) {
        return (a.sort_name || a.name).localeCompare(b.sort_name || b.name);
      });
    var people = matches.filter(function (m) {
      return m.kind === "person";
    });
    var typefaces = matches.filter(function (m) {
      return m.kind === "typeface";
    });
    results.innerHTML =
      "<h2>" +
      letter +
      "</h2>" +
      (people.length ? "<h3>People</h3>" + renderList(people) : "") +
      (typefaces.length ? "<h3>Typefaces</h3>" + renderList(typefaces) : "");
  }

  function runSearch(q) {
    var needle = q.toLowerCase();
    var matches = index.filter(function (item) {
      return (
        item.name.toLowerCase().includes(needle) ||
        (item.alternates || []).some(function (a) {
          return a.toLowerCase().includes(needle);
        })
      );
    });
    results.innerHTML =
      "<h2>Search results (" + matches.length + ")</h2>" + renderList(matches);
  }

  input.addEventListener("input", function () {
    var q = input.value.trim();
    if (!q) {
      results.innerHTML = "";
      return;
    }
    loadIndex().then(function () {
      runSearch(q);
    });
  });

  loadIndex();
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
