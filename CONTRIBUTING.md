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

## Identifiers

Every record needs a permanent `id` (`RTD-P-000001` for people,
`RTD-T-000001` for typefaces) that you assign yourself: look at the
highest existing id in `data/people/` or `data/typefaces/` and use the
next number. If two PRs happen to claim the same id, CI will fail on the
second one - just rebase and take the next free number.

IDs are never reused or deleted, even for records that turn out to be
duplicates or mistakes. Use `record_status: "merged"` (with
`superseded_by` pointing at the surviving id) or `record_status:
"deprecated"` instead of deleting a file.

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

`external_ids.wikidata_qid` (and similar) is fine to include - that's just
a cross-reference, not a source.

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
