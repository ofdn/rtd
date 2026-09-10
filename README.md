# Registry of Type Design

A global, human- and machine-readable registry of typefaces and the people
who made them - digital and pre-digital, in any script or writing system.

## What this is

- `data/people/*.json` - one file per person (type designers and other
  professionals involved in creating typefaces).
- `data/typefaces/*.json` - one file per typeface.
- `schema/` - the JSON Schema each record must validate against.

These JSON files are the source of truth and are edited directly via pull
request. A build step compiles them into a static site (human-readable
pages, a JSON API, CSV/NDJSON bulk dumps, and a search index) published on
GitHub Pages.

## Identifiers

Every record has a permanent, opaque id (`rtd-p-000001` for people,
`rtd-t-000001` for typefaces) that never changes, separate from its
filename/slug (which can change if a record is renamed). Old ids are never
deleted or reused; merged/deprecated records resolve to a tombstone page
pointing at the current record.

## Sourcing policy

Sources must be independent and verifiable. **Wikidata, Wikipedia, and any
other Wikimedia project may never be used as a source** - see
`CONTRIBUTING.md`. This is enforced in CI, not just documentation.

## Contributing

See `CONTRIBUTING.md`.

## Local development

```
npm install
npm run validate   # validate data/ against the schemas
npm run build      # compile data/ into dist/
```

### Useful queries

Count people records carrying a given external identifier (needs
[`jq`](https://jqlang.org/)):

```
# ISNI
jq -s '[.[] | select(.external_ids.isni != null and .external_ids.isni != "")] | length' data/people/*.json

# LC-NAF
jq -s '[.[] | select(.external_ids.lc_naf != null and .external_ids.lc_naf != "")] | length' data/people/*.json
```

Count Wikidata items carrying an RTD id via the
[Registry of Type Design ID property (P14791)](https://www.wikidata.org/wiki/Property:P14791),
run at [query.wikidata.org](https://query.wikidata.org/) or via curl:

```
SELECT (COUNT(?item) AS ?count) WHERE { ?item wdt:P14791 ?rtdid. }
```

`scripts/sync-wikidata-p14791.js` runs this same query as part of a
fuller reconciliation between RTD's own `wikidata_qid` fields and
Wikidata's P14791 claims.

## License

© Subhashish Panigrahi. Registry data is licensed under [CC BY-SA
4.0](https://creativecommons.org/licenses/by-sa/4.0/) - see `LICENSE`.
