// OpenRefine Reconciliation Service API (v0.2) for Registry of Type Design.
// Single endpoint: GET with no query params returns the service manifest;
// GET ?query=... or ?queries=<json> and POST queries=<json> (form-encoded,
// the shape OpenRefine's own client sends) run reconciliation.
import { getData } from "./data.js";
import { bestScore } from "./match.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

const TYPE_LABELS = {
  person: [{ id: "person", name: "Person" }],
  typeface: [{ id: "typeface", name: "Typeface" }],
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function manifest(baseUrl) {
  return {
    versions: ["0.2"],
    name: "Registry of Type Design",
    identifierSpace: baseUrl,
    schemaSpace: "https://github.com/ofdn/rtd/blob/main/schema/",
    defaultTypes: [
      { id: "person", name: "Person" },
      { id: "typeface", name: "Typeface" },
    ],
    // Reuses the bare-id redirect scripts/build.js already publishes at
    // /<id>/, no dedicated reconciliation view page needed.
    view: { url: `${baseUrl}{{id}}` },
  };
}

function taggedPool(data, type) {
  if (type === "person") return data.people.map((record) => ({ record, kind: "person" }));
  if (type === "typeface") return data.typefaces.map((record) => ({ record, kind: "typeface" }));
  return [
    ...data.people.map((record) => ({ record, kind: "person" })),
    ...data.typefaces.map((record) => ({ record, kind: "typeface" })),
  ];
}

// `match: true` only when the top result is a unique, exact (score 100)
// hit, so a coincidental tie or a merely-close match never auto-matches.
function reconcileOne(q, data) {
  const query = q.query ?? "";
  const limit = Math.min(Math.max(1, Number(q.limit) || DEFAULT_LIMIT), MAX_LIMIT);
  const pool = taggedPool(data, q.type);

  const scored = pool
    .map(({ record, kind }) => ({ record, kind, score: bestScore(query, record) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const uniqueTopMatch =
    scored.length > 0 && scored[0].score === 100 && (scored.length === 1 || scored[1].score < 100);

  return {
    result: scored.slice(0, limit).map((r, i) => ({
      id: r.record.id,
      name: r.record.name,
      score: r.score,
      match: i === 0 && uniqueTopMatch,
      type: TYPE_LABELS[r.kind],
    })),
  };
}

async function parseQueries(request, url) {
  if (request.method === "POST") {
    const params = new URLSearchParams(await request.text());
    const raw = params.get("queries") ?? url.searchParams.get("queries");
    return raw ? JSON.parse(raw) : undefined;
  }
  if (url.searchParams.has("queries")) {
    return JSON.parse(url.searchParams.get("queries"));
  }
  if (url.searchParams.has("query")) {
    return {
      q0: {
        query: url.searchParams.get("query"),
        type: url.searchParams.get("type") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
      },
    };
  }
  return undefined;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const baseUrl = env.RTD_API_BASE ?? "https://rtd.theofdn.org/";
    const url = new URL(request.url);

    let queries;
    try {
      queries = await parseQueries(request, url);
    } catch {
      return json({ error: "Invalid JSON in 'queries'" }, 400);
    }

    if (!queries) {
      return json(manifest(baseUrl));
    }

    let data;
    try {
      data = await getData(baseUrl);
    } catch (err) {
      return json({ error: `Could not load dataset: ${err.message}` }, 502);
    }

    const response = {};
    for (const [key, q] of Object.entries(queries)) {
      response[key] = reconcileOne(q, data);
    }
    return json(response);
  },
};
