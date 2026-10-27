import { pageShell, SEARCH_ICON } from "./shared.js";

// Search and A-Z browse run in the browser over search-index.json.
export function renderHomePage({ canonicalUrl, peopleCount, typefacesCount, scriptsCount, organisationsCount, schemaVersion }) {
  const script = `
<script>
(function () {
  var form = document.getElementById("home-search-form");
  var input = document.getElementById("search");
  var results = document.getElementById("results");
  var lettersNav = document.getElementById("letters");
  var index = null;
  var indexPromise = null;
  var ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  // a fixed pastel per letter , shuffled so neighbours never match
  var LETTER_TINTS = [1, 4, 13, 10, 9, 13, 11, 5, 12, 6, 3, 4, 11, 7, 11, 12, 8, 10, 3, 0, 8, 9, 13, 2, 6, 4];

  function foldedFirstLetter(name) {
    var base = name.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
    return (base[0] || "").toUpperCase();
  }

  var KIND_DIRS = { person: "people/", typeface: "typefaces/", organisation: "organisations/" };

  function renderList(items, showKindTag) {
    if (!items.length) return "<p>No entries found.</p>";
    return (
      "<ul>" +
      items
        .map(function (m) {
          var href = KIND_DIRS[m.kind] + m.slug + "/";
          return (
            '<li><a href="' + href + '"><span class="name">' + escapeHtml(m.name) + "</span>" +
            (showKindTag ? '<span class="kind-tag">' + m.kind + "</span>" : "") +
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
    lettersNav.innerHTML = ALPHABET.map(function (l, i) {
      if (present[l]) {
        return '<button type="button" class="tint-' + LETTER_TINTS[i] + '" data-letter="' + l + '">' + l + "</button>";
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
    var organisations = matches.filter(function (m) {
      return m.kind === "organisation";
    });
    results.innerHTML =
      "<h2>" +
      letter +
      "</h2>" +
      (people.length ? "<h3>People</h3>" + renderList(people, false) : "") +
      (typefaces.length ? "<h3>Typefaces</h3>" + renderList(typefaces, false) : "") +
      (organisations.length ? "<h3>Organisations</h3>" + renderList(organisations, false) : "");
  }

  function runSearch(q) {
    markActiveLetter(null);
    var parsedId = parseIdQuery(q);
    var matches = index.filter(function (item) {
      return (
        tokenSearchMatch(q, item.name) ||
        (item.alternates || []).some(function (a) {
          return tokenSearchMatch(q, a);
        }) ||
        idMatches(item, parsedId) ||
        identifierMatches(item, q) ||
        scriptSearchMatch(q, item.scripts)
      );
    });
    results.innerHTML =
      '<h2>Results for &ldquo;' + escapeHtml(q) + '&rdquo;</h2>' +
      '<p class="results-meta">Showing ' + matches.length + " cataloged " + (matches.length === 1 ? "entry" : "entries") + ".</p>" +
      renderList(matches, true);
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

  // Enter on an exact id goes straight to the record.
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    loadIndex().then(function (idx) {
      var hit = findDirectMatch(idx, q);
      if (hit) {
        window.location.href = KIND_DIRS[hit.kind] + hit.slug + "/";
      }
    });
  });

  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) {
    input.value = initialQuery;
    loadIndex().then(function (idx) {
      var hit = findDirectMatch(idx, initialQuery);
      if (hit) {
        window.location.href = KIND_DIRS[hit.kind] + hit.slug + "/";
        return;
      }
      runSearch(initialQuery);
    });
  } else {
    loadIndex();
  }
})();
</script>
`;

  const body = `
<div class="home-hero">
<p class="tagline">A global registry of typefaces, the people and the foundries who made them, digital and pre-digital.</p>
<form id="home-search-form" class="home-search" action="" method="get" role="search">
<label class="visually-hidden" for="search">Search people, typefaces and organisations</label>
<input id="search" type="search" name="q" placeholder="Search by typeface, designer, or foundry&hellip;" autocomplete="off">
${SEARCH_ICON}
</form>
<nav id="letters" class="letters" aria-label="Browse by first letter"></nav>
<p class="stat-line">Currently tracking <strong>${peopleCount}</strong> people, <strong>${typefacesCount}</strong> typefaces in <a href="scripts/"><strong>${scriptsCount}</strong> scripts</a>, and <a href="organisations/"><strong>${organisationsCount}</strong> type foundries and other organisations</a>.</p>
</div>
<div id="results"></div>
<p class="utility-links"><a href="scripts/">Browse by script</a> &middot; <a href="organisations/">Organisations</a> &middot; <a href="contributors/">Contributors</a> &middot; <a href="api/people.json">People API</a> &middot; <a href="api/typefaces.json">Typefaces API</a> &middot; <a href="dumps/">Bulk dumps</a> &middot; <a href="info/#reconciliation">Reconciliation service</a></p>
`;

  return pageShell({
    canonicalUrl,
    jsonLd: null,
    body,
    homePath: "",
    showHeaderSearch: false,
    schemaVersion,
    pageScript: script,
  });
}
