# Contributing

Thanks for helping build the Registry of Type Design. Contributions happen
via pull request; a maintainer reviews and merges before anything goes
live.

## Adding or editing a record

1. Add or edit one JSON file under `data/people/` or `data/typefaces/`.
   Keep one record per pull request where practical - it makes review and
   history much easier to follow.
2. Follow the schema in `schema/person.schema.json` or
   `schema/typeface.schema.json`. Unknown fields are rejected outright, so
   check the schema rather than guessing a field name.
3. Filename must match the record's `slug` (e.g. `jan-tschichold.json` has
   `"slug": "jan-tschichold"`).
4. Run `npm install && npm run validate` locally before opening the PR -
   this is the same check CI runs.

## Renaming a record (changing its slug)

The `id` never changes, but `slug` can, if a record needs a better URL
(a spelling fix, a disambiguating suffix, etc). Whenever you change
`slug`:

1. Rename the file to match the new slug.
2. Add the *old* slug to `previous_slugs` (create the array if it doesn't
   exist yet, keep any earlier entries, never remove one).
3. Run `npm run validate` - it checks the old slug doesn't collide with
   any other record's current or former slug.

The build then publishes a redirect stub at the old URL that forwards to
the new one, so links out on the web (search engines, other sites,
bookmarks) don't quietly break. This is the only mechanism that keeps an
old URL alive; deleting a `previous_slugs` entry once published would
break that redirect, so treat the array as append-only.

## Identifiers

Every record needs a permanent `id` (`RTD-P-000001` for people,
`RTD-T-000001` for typefaces). Don't compute it by hand, run:

```
node scripts/mint-id.js person "Full Name"
node scripts/mint-id.js typeface "Typeface Name"
```

This scans `data/people/` or `data/typefaces/` for the highest existing
id and prints the next free one, plus a slug (see below). Add `--write`
to also scaffold the JSON stub file at `data/people/<slug>.json` (or
`data/typefaces/...`) with the required fields blank, ready to fill in:

```
node scripts/mint-id.js person "Full Name" --write
```

If two PRs happen to claim the same id anyway (the script only looks at
your local checkout, it doesn't coordinate across branches), CI will fail
on the second one, just rebase and re-run the script for the next free
number.

IDs are never reused or deleted, even for records that turn out to be
duplicates or mistakes. Use `record_status: "merged"` (with
`superseded_by` pointing at the surviving id) or `record_status:
"deprecated"` instead of deleting a file.

## Same name, different person (or typeface)

Two real people, or two real typefaces, can legitimately share a name.
The `id` is what actually identifies a record, never the name or the
slug, so a shared name is not itself a problem. `scripts/mint-id.js`
handles the mechanical part of this automatically:

- **Slug collision**: if the plain slugified name is already taken (e.g.
  a second "Nasim Ali"), the script suffixes it (`nasim-ali-2`) so the
  filename never collides. You can hand-pick a more descriptive
  disambiguator instead before opening the PR, if one is available (e.g.
  a birth year: `nasim-ali-1952`), but the numeric suffix is a safe
  default when no better disambiguator is known yet.
- **Same-name warning**: the script also prints any existing active
  record with the identical preferred name, so you can check whether
  you're actually looking at a duplicate of an existing record (edit
  that file instead of minting a new one) versus a genuine namesake (keep
  the new id, but make sure the two bios are distinguishable, e.g. by
  dates, country, or the typefaces they're linked to). `npm run validate`
  runs the same check across the whole dataset and prints it as a
  non-fatal warning, so drift introduced without the mint script still
  gets caught before merge.

The `id` is permanent and never changes. The `slug` (and therefore the
human-readable page URL, `/people/<slug>/` or `/typefaces/<slug>/`) is
allowed to change if a record is renamed, the machine-readable resolver
that never moves is the id-keyed API URL,
`/api/people/<id>.json` / `/api/typefaces/<id>.json`. If you rename a
slug, note that the old human page currently stops resolving (there's no
redirect stub for renamed slugs, only for records marked `merged` or
`deprecated`), link to records by id in anything meant to be
long-lived.

## Source policy

Every record needs at least one entry in `sources`, and every source must
be an independent, verifiable reference - books, published interviews,
foundry specimens/catalogs, museum or archive records, newspaper or
magazine coverage, academic papers, and similar.

**Wikidata, Wikipedia, and any other Wikimedia project may never be used
as a source.** If the only place a fact currently appears is a Wikipedia
article, that's a sign the fact needs an independent source before it
belongs here, not a reason to cite Wikipedia. This project exists in part
so Wikidata and similar projects can eventually cite *it* - sourcing our
facts from them would make that impossible (a source can't cite something
that cites it back). CI rejects any `sources[].url` on a Wikimedia-project
domain automatically.

`external_ids` (`wikidata_qid`, `viaf`, `isni`, `lc_naf`, `gnd`,
`worldcat_entity`) is fine to include, that's just a cross-reference to an
authority file, not a source. Each is a separate field for a separate
identifier system, since they're independent authority files with their
own ids, not one combined value. The site resolves whichever ones are
present into linked-data `sameAs` URIs automatically. `worldcat_entity`
is the id from an `id.oclc.org/worldcat/entity/...` URL, note that
WorldCat's own detail page for an entity currently asks for a
library-affiliated login to view, unlike the others here, still worth
recording since the identifier itself is a valid cross-reference even
when the page behind it isn't freely browsable.

If the only source you can find is thin or low-confidence (a bare LinkedIn
profile with no other detail, for example), don't leave the person or
typeface out entirely. Add the record with a minimal factual `bio` (e.g.
"Indian type designer.") plus a short note that a better source is
needed, and set `"verification_status": "needs_verification"`. The site
flags these records so a stronger source can be added later. This is
different from having *no* independent source at all: if you can't find
anything to cite, the record doesn't belong here yet, flagged or not.

Bios should state facts plainly. Don't narrate your research process or
sourcing confidence in the `bio` text itself (no "independent
corroboration has not been found" type language) - that belongs in the
verification flag, not the biography.

## Nationality

Don't write nationality adjectives ("Indian", "Indo-Canadian", etc.) into
`bio` text by hand. Just list the person's countries in `countries[]`;
the site computes a consistent nationality label from `schema/demonyms.json`
at build time and displays it on its own. This keeps the wording
consistent across records instead of drifting per contributor. If a
country or a two-country combination is missing from that file, add it
there rather than writing the adjective into the bio, and only add a
compound (like `Indo-Canadian`) if it's an unambiguous, well-established
term, not a guessed combination.

## What's deliberately out of scope

The schema intentionally has no field for images, no dedicated
oral-history/interview field, and no full bibliographic citation format.
Keep `bio`/`description` to a short summary and `sources` to a plain list
of links with titles - this keeps records reviewable and keeps the
registry from becoming unmaintainable at scale. If a fact needs an
interview to verify during review, link it in the PR description rather
than adding it as a permanent field.

## Review

A maintainer checks that:

- CI (schema, id uniqueness, referential integrity, source-domain check)
  passes.
- Sources actually support the claims being added.
- The record isn't a likely duplicate of an existing one (search
  `data/people/` or `data/typefaces/` and the site's search before adding
  a new record).
