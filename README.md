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

Every record has a permanent, opaque id (`RTD-P-000001` for people,
`RTD-T-000001` for typefaces) that never changes, separate from its
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

## License

© Subhashish Panigrahi. Registry data is licensed under [CC BY-SA
4.0](https://creativecommons.org/licenses/by-sa/4.0/) - see `LICENSE`.
