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
<p class="utility-links"><a href="api/people.json">People API</a> &middot; <a href="api/typefaces.json">Typefaces API</a> &middot; <a href="dumps/">Bulk dumps</a> &middot; <a href="info/#reconciliation">Reconciliation service</a></p>
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

  // Recognizes an RTD id typed as-is ("rtd-p-000039"), without hyphens,
  // or as a bare number ("39", "039", "000039") so searching for an id
  // works the way searching for a name already does. A bare number has
  // no known kind (a person and a typeface can share the same trailing
  // number in their own independent sequences), a full "rtd-p-"/"rtd-t-"
  // form does.
  function parseIdQuery(raw) {
    var q = raw.trim();
    var full = /^rtd-?([pt])-?0*([0-9]+)$/i.exec(q);
    if (full) {
      return { kind: full[1].toLowerCase() === "p" ? "person" : "typeface", num: parseInt(full[2], 10) };
    }
    var bare = /^[0-9]+$/.exec(q);
    if (bare) {
      return { kind: null, num: parseInt(bare[0], 10) };
    }
    return null;
  }

  function idNum(id) {
    var m = /-([0-9]+)$/.exec(id);
    return m ? parseInt(m[1], 10) : null;
  }

  function idMatches(item, parsedId) {
    if (!parsedId) return false;
    if (idNum(item.id) !== parsedId.num) return false;
    if (parsedId.kind && item.kind !== parsedId.kind) return false;
    return true;
  }

  // Cross-referenced authority identifiers (VIAF, ISNI, LC-NAF, GND,
  // WorldCat, ULAN, a Wikidata QID) are exact values, not free text, so a
  // query matching one of them stored on a record is unambiguous. ISNI is
  // often copied with grouping spaces ("0000 0003 7140 3942"), so those
  // are stripped before comparing against RTD's own unspaced storage
  // format.
  function identifierMatches(item, rawQuery) {
    if (!item.external_ids) return false;
    var q = rawQuery.trim();
    var qCompact = q.replace(/\\s+/g, "");
    if (!q) return false;
    return Object.keys(item.external_ids).some(function (field) {
      var value = String(item.external_ids[field]);
      return value === q || value === qCompact;
    });
  }

  // Order- and punctuation-insensitive: every word in the query has to
  // appear somewhere in the target, regardless of what order they're
  // in. Makes "Crouwel,Wim" (last,first, e.g. pasted from a spreadsheet
  // export) match "Wim Crouwel" the same as typing it the "normal" way.
  function normalizeForSearch(s) {
    return s.toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
  }
  function tokenSearchMatch(query, target) {
    var qTokens = normalizeForSearch(query).split(" ").filter(Boolean);
    if (!qTokens.length) return false;
    var normTarget = normalizeForSearch(target);
    return qTokens.every(function (t) {
      return normTarget.indexOf(t) !== -1;
    });
  }

  // showKindTag off for the A-Z browse, where results are already split
  // into their own "People"/"Typefaces" heading, so repeating it on every
  // row is redundant. Left on for free-text search, which shows a single
  // mixed list where the tag is the only thing telling entries apart.
  function renderList(items, showKindTag) {
    if (!items.length) return "<p>No entries found.</p>";
    return (
      "<ul>" +
      items
        .map(function (m) {
          var href = (m.kind === "person" ? "people/" : "typefaces/") + m.slug + "/";
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
      (people.length ? "<h3>People</h3>" + renderList(people, false) : "") +
      (typefaces.length ? "<h3>Typefaces</h3>" + renderList(typefaces, false) : "");
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
        identifierMatches(item, q)
      );
    });
    results.innerHTML =
      '<h2>Results for &ldquo;' + escapeHtml(q) + '&rdquo;</h2>' +
      '<p class="results-meta">Showing ' + matches.length + " cataloged " + (matches.length === 1 ? "entry" : "entries") + ".</p>" +
      renderList(matches, true);
  }

  // Resolves a query to a single record when it's unambiguously an id
  // (RTD id, or an exact external identifier like ISNI/VIAF), so submit
  // and a direct ?q= link can jump straight to the record instead of
  // leaving it sitting in the results list.
  function findDirectMatch(idx, q) {
    var parsedId = parseIdQuery(q);
    var hits = idx.filter(function (item) {
      return idMatches(item, parsedId) || identifierMatches(item, q);
    });
    return hits.length === 1 ? hits[0] : null;
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
  // full-page reload on Enter would just be redundant, not broken. The
  // one thing submit still does on top of that: if the query is
  // unambiguously an id (a bare number matching exactly one record, or a
  // full "rtd-p-"/"rtd-t-" form), jump straight to that record's page
  // instead of just leaving it sitting in the results list.
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q) return;
    loadIndex().then(function (idx) {
      var hit = findDirectMatch(idx, q);
      if (hit) {
        window.location.href = (hit.kind === "person" ? "people/" : "typefaces/") + hit.slug + "/";
      }
    });
  });

  var initialQuery = new URLSearchParams(window.location.search).get("q");
  if (initialQuery) {
    input.value = initialQuery;
    loadIndex().then(function (idx) {
      var hit = findDirectMatch(idx, initialQuery);
      if (hit) {
        window.location.href = (hit.kind === "person" ? "people/" : "typefaces/") + hit.slug + "/";
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
