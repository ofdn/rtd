// search helpers , used by the home page and by the header search
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// rtd-p-000123, rtdp123 or a bare 123 . a bare number can match any kind
var ID_KINDS = { p: "person", t: "typeface", o: "organisation" };
function parseIdQuery(raw) {
  var q = raw.trim();
  var full = /^rtd-?([pto])-?0*([0-9]+)$/i.exec(q);
  if (full) {
    return { kind: ID_KINDS[full[1].toLowerCase()], num: parseInt(full[2], 10) };
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

// ISNIs often get pasted with spaces or hyphens
function identifierMatches(item, rawQuery) {
  if (!item.external_ids) return false;
  var q = rawQuery.trim();
  var qCompact = q.replace(/[\s-]+/g, "");
  if (!q) return false;
  return Object.keys(item.external_ids).some(function (field) {
    var value = String(item.external_ids[field]);
    return value === q || value === qCompact;
  });
}

// word order and commas are ignored, so "Last1,First1" finds First1 Last1.
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

// Language names for scripts that the records list by script name
var SCRIPT_LANGUAGE_ALIASES = {
  "santali": "Ol Chiki",
  "santhali": "Ol Chiki",
  "ho": "Warang Citi",
  "punjabi": "Gurmukhi",
  "oriya": "Odia",
  "bengali": "Bangla"
};
function scriptSearchMatch(query, scripts) {
  if (!scripts || !scripts.length) return false;
  var normQuery = normalizeForSearch(query);
  var aliasTarget = SCRIPT_LANGUAGE_ALIASES[normQuery];
  return scripts.some(function (s) {
    return tokenSearchMatch(query, s) || (aliasTarget && s === aliasTarget);
  });
}

function findDirectMatch(index, q) {
  var parsedId = parseIdQuery(q);
  var hits = index.filter(function (item) {
    return idMatches(item, parsedId) || identifierMatches(item, q);
  });
  return hits.length === 1 ? hits[0] : null;
}

document.querySelectorAll(".copy-id").forEach(function (btn) {
  btn.addEventListener("click", function () {
    navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(function () {
      btn.classList.add("copied");
      setTimeout(function () { btn.classList.remove("copied"); }, 1200);
    });
  });
});
document.querySelectorAll(".citation-block").forEach(function (block) {
  var citations = JSON.parse(block.getAttribute("data-citation"));
  var accessed = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  var select = block.querySelector(".citation-style");
  var pre = block.querySelector(".citation-text");
  var copyBtn = block.querySelector(".citation-copy");
  var downloadBtn = block.querySelector(".citation-download");
  function render() {
    var text = citations[select.value].replaceAll("__ACCESSED__", accessed);
    pre.textContent = text;
    copyBtn.setAttribute("data-copy", text);
  }
  select.addEventListener("change", render);
  render();
  downloadBtn.addEventListener("click", function () {
    var text = citations.bibtex.replaceAll("__ACCESSED__", accessed);
    var blob = new Blob([text], { type: "application/x-bibtex" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = block.getAttribute("data-id") + ".bib";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
});

// Header search dropdown. The home page has no header search.
(function () {
  var input = document.getElementById("header-search-input");
  if (!input) return;
  var wrap = input.closest(".header-search-wrap");
  var form = input.closest("form");
  var results = document.getElementById("header-search-results");
  var clearBtn = document.getElementById("header-search-clear");
  var indexPromise = null;
  var MAX_RESULTS = 6;

  function updateClearVisibility() {
    clearBtn.hidden = !input.value;
  }

  function loadIndex() {
    if (indexPromise) return indexPromise;
    var base = form.getAttribute("action") || "";
    indexPromise = fetch(base + "search-index.json").then(function (r) {
      return r.json();
    });
    return indexPromise;
  }

  function hide() {
    results.hidden = true;
    results.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
  }

  function show(matches, q) {
    if (!matches.length) {
      results.innerHTML =
        '<p class="no-matches">No matches for &ldquo;' + escapeHtml(q) + '&rdquo; yet.</p>';
    } else {
      results.innerHTML =
        "<ul>" +
        matches
          .slice(0, MAX_RESULTS)
          .map(function (m) {
            return (
              '<li><a href="' + m.canonical_url + '"><span class="name">' + escapeHtml(m.name) + "</span>" +
              '<span class="kind-tag">' + m.kind + "</span>" +
              (m.subtitle ? '<span class="subtitle">' + escapeHtml(m.subtitle) + "</span>" : "") +
              "</a></li>"
            );
          })
          .join("") +
        "</ul>";
    }
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("input", function () {
    updateClearVisibility();
    var q = input.value.trim();
    if (!q) {
      hide();
      return;
    }
    loadIndex().then(function (index) {
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
      show(matches, q);
    });
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Escape") hide();
  });

  clearBtn.addEventListener("click", function () {
    input.value = "";
    updateClearVisibility();
    hide();
    input.focus();
  });

  wrap.addEventListener("focusout", function (e) {
    if (!wrap.contains(e.relatedTarget)) hide();
  });

  document.addEventListener("click", function (e) {
    if (!wrap.contains(e.target)) hide();
  });

  // Enter on an exact id goes straight to the record.
  form.addEventListener("submit", function (e) {
    var q = input.value.trim();
    if (!q) return;
    e.preventDefault();
    var base = form.getAttribute("action") || "";
    loadIndex().then(function (index) {
      var hit = findDirectMatch(index, q);
      if (hit) {
        window.location.href = base + { person: "people/", typeface: "typefaces/", organisation: "organisations/" }[hit.kind] + hit.slug + "/";
      } else {
        window.location.href = base + "?q=" + encodeURIComponent(q);
      }
    });
  });
})();

(function () {
  var toggle = document.getElementById("theme-toggle");
  if (!toggle) return;

  function isDark() {
    var explicit = document.documentElement.getAttribute("data-theme");
    if (explicit) return explicit === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function updateLabel() {
    toggle.setAttribute("aria-label", isDark() ? "Switch to light mode" : "Switch to dark mode");
  }

  updateLabel();
  toggle.addEventListener("click", function () {
    var next = isDark() ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rtd-theme", next);
    } catch (e) {}
    updateLabel();
  });
})();
