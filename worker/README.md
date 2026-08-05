# RTD Reconciliation Service

An [OpenRefine Reconciliation Service API](https://reconciliation-api.github.io/specs/0.2/)
(v0.2) for Registry of Type Design, so OpenRefine's "Reconcile column"
feature can match spreadsheet data against RTD the way it already does
against Wikidata. Deployed as a Cloudflare Worker, separately from the
static site in `dist/` (GitHub Pages can't run per-request code).

It reads RTD's own published `search-index.json` at request time (cached
in memory for a few minutes), so it never needs a copy of `data/` and
always reflects whatever's currently live.

## One-time setup (do this once, by hand)

`theofdn.org`'s DNS already runs on Cloudflare, so this attaches to that
existing account and zone rather than creating anything new.

1. Confirm Workers is enabled on that Cloudflare account (Free plan
   includes it; the dashboard will prompt you to enable it on first
   visit to the Workers section if it isn't already).
2. Create an API token: Cloudflare dashboard → **My Profile → API
   Tokens → Create Token**. Use the **Edit Cloudflare Workers** template,
   scoped to the account and to the `theofdn.org` zone (it needs
   `Zone:DNS:Read` and `Zone:Workers Routes:Edit` on that zone, plus
   `Account:Workers Scripts:Edit`).
3. Locally: `cd worker && npm install`, then `npx wrangler login` (opens
   a browser to authorize), or skip login and instead set
   `CLOUDFLARE_API_TOKEN` as an environment variable to the token from
   step 2.
4. First deploy: `npx wrangler deploy`. This creates the Worker and
   attaches the route configured in `wrangler.toml`
   (`rtd.theofdn.org/reconcile*`).
5. For CI to deploy on every push (`.github/workflows/deploy-worker.yml`),
   add two GitHub Actions secrets/variables on the repo:
   `gh secret set CLOUDFLARE_API_TOKEN` (the token from step 2) and
   `gh variable set CLOUDFLARE_ACCOUNT_ID` (found on the Cloudflare
   dashboard's right sidebar, or `npx wrangler whoami`).

## Local development

```
cd worker
npm install
npx wrangler dev
```

Then, in another terminal:

```
curl http://localhost:8787/reconcile
curl http://localhost:8787/reconcile -d 'queries={"q0":{"query":"Aditi Pimprikar"}}'
curl "http://localhost:8787/reconcile?query=Aditi+Pimprikar&type=person"
```

## Using it from OpenRefine

In OpenRefine, on a text column: **Reconcile → Start reconciling → Add
Standard Service**, enter `https://rtd.theofdn.org/reconcile`, then
reconcile against the "Person" or "Typeface" type.

## Out of scope for now

`/suggest/entity`, `/preview/entity`, and `/extend` (the optional parts
of the spec that power autosuggest, hover-preview cards, and pulling in
extra columns) aren't implemented. Worth adding once the core matching
is confirmed working well against real spreadsheets.
