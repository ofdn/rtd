import { pageShell, SEARCH_ICON } from "./shared.js";

// The home page doesn't print full people/typeface lists inline: at
// registry scale (thousands of entries expected) that would bloat every
// page load. Instead it fetches search-index.json once and offers two
// client-side views over the same in-memory data: free-text search, and
// an A-Z letter picker. Both are driven by escapeHtml'd output built from
// the index, which is already public JSON, not user input, so no server
// round trip is needed per interaction.
//
// The search box is a plain GET form first (action=""), so pressing Enter
// works even with JS disabled (it reloads with ?q=..., which the script
// below reads on load). JS only upgrades this into a live, no-reload
// filter, it's never required for the search to function at all. This is
// also the page that a person/typeface page's header search form submits
// to, landing here with the same ?q= convention.
export function renderHomePage({ canonicalUrl, peopleCount, typefacesCount, schemaVersion }) {
  const body = `
<div class="home-hero">
<p class="tagline">A global registry of typefaces and the people who made them, digital and pre-digital.</p>
<form id="home-search-form" class="home-search" action="" method="get" role="search">
<label class="visually-hidden" for="search">Search people and typefaces</label>
<input id="search" type="search" name="q" placeholder="Search by typeface, designer, or foundry&hellip;" autocomplete="off">
${SEARCH_ICON}
</form>
<nav id="letters" class="letters" aria-label="Browse by first letter"></nav>
<p class="stat-line">Currently tracking <strong>${peopleCount}</strong> people, <strong>${typefacesCount}</strong> typefaces.</p>
</div>
<div id="results"></div>
<p class="utility-links"><a href="api/people.json">People API</a> &middot; <a href="api/typefaces.json">Typefaces API</a> &middot; <a href="dumps/">Bulk dumps</a></p>
<script>
(function () {
  var form = document.getElementById("home-search-form");
  var input = document.getElementById("search");
  var results = document.getElementById("results");
  var lettersNav = document.getElementById("letters");
  var index = null;
  var indexPromise = null;
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
          return (
            '<li><a href="' + href + '"><span class="name">' + escapeHtml(m.name) + "</span>" +
            '<span class="kind-tag">' + m.kind + "</span>" +
            (m.subtitle ? '<span class="subtitle">' + escapeHtml(m.subtitle) + "</span>" : "") +
            "</a></li>"
          );
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
    var present = {};
    index.forEach(function (item) {
      var key = foldedFirstLetter(item.sort_name || item.name);
      if (key) present[key] = true;
    });
    lettersNav.innerHTML = ALPHABET.map(function (l) {
      if (present[l]) {
        return '<button type="button" data-letter="' + l + '">' + l + "</button>";
      }
      return '<span class="letter-disabled" aria-disabled="true">' + l + "</span>";
    }).join("");
    lettersNav.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        showLetter(btn.getAttribute("data-letter"));
      });
    });
  }

  function markActiveLetter(letter) {
    lettersNav.querySelectorAll("button").forEach(function (btn) {
      if (btn.getAttribute("data-letter") === letter) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }

  function showLetter(letter) {
    input.value = "";
    markActiveLetter(letter);
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
    markActiveLetter(null);
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
      '<h2>Results for &ldquo;' + escapeHtml(q) + '&rdquo;</h2>' +
      '<p class="results-meta">Showing ' + matches.length + " cataloged " + (matches.length === 1 ? "entry" : "entries") + ".</p>" +
      renderList(matches);
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

  // The form's plain GET action already works without JS (it reloads with
  // ?q=...); once JS is running, results appear live as you type, so a
  // full-page reload on Enter would just be redundant, not broken.
  form.addEventListener("submit", function (e) {
    e.preventDefault();
  });

  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) {
    input.value = initialQuery;
    loadIndex().then(function () {
      runSearch(initialQuery);
    });
  } else {
    loadIndex();
  }
})();
</script>
`;

  return pageShell({
    title: "Registry of Type Design",
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "",
    showHeaderSearch: false,
    schemaVersion,
  });
}
