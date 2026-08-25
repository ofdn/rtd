# Contributing

Thanks for helping build the Registry of Type Design. Contributions happen
via pull request; a maintainer reviews and merges before anything goes
live.

## Don't want to write JSON or open a pull request?

Use the issue forms instead - **[New person](../../issues/new?template=new-person.yml)**
or **[New typeface](../../issues/new?template=new-typeface.yml)**. Fill in
whatever you know, attach photos of sources directly in the form if you
don't have a web link, and submit it. A bot turns the submission into a
pull request within a minute or two (see `scripts/issue-to-record.js` and
`.github/workflows/issue-to-pr.yml`) - a maintainer still reviews and
merges it, same as any other PR, this just removes the JSON-writing step.
If something in the form couldn't be turned into a record automatically
(an unresolvable designer name, a missing required field), the bot
comments on the issue explaining what to fix instead. The rest of this
document is for people submitting via pull request directly.

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

A typeface's `designers[]` points at existing person records by id, it
never duplicates a person's details - so if the designer isn't in the
registry yet, submit them as a person record first (or in the same PR,
if you're comfortable ordering the commits so the person's file lands
before the typeface references it). If no individual designer can be
named at all, see "Typefaces with no known individual designer" below
instead of blocking on this.

## Typefaces with no known individual designer

Some typefaces genuinely have no person to credit - an anonymous
historical face, one attributed only to a foundry's in-house team, or
one lost to history. For these, leave `designers` as an empty array and
add an `attribution` field instead:

```json
"designers": [],
"attribution": {
  "unknown": true,
  "note": "Anonymous, foundry-attributed only"
}
```

`attribution` is only valid when `designers` is empty, and vice versa -
`npm run validate` enforces both directions. This is deliberately not a
way to skip crediting a designer who *is* identifiable; only use it when
there's genuinely no one to name. The issue form has the same escape
hatch (leave Designer(s) blank, fill in the reason field instead).

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

Every record needs a permanent `id` (`rtd-p-000001` for people,
`rtd-t-000001` for typefaces). Don't compute it by hand, run:

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
slug, add the old one to `previous_slugs` (see "Renaming a record"
above) so the old URL keeps redirecting, link to records by id in
anything meant to be long-lived regardless.

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

### No web link for a source

`sources[].url` must be a URL, but the underlying source doesn't have to
be born-digital. Print coverage (a newspaper clipping, a foundry
specimen sheet, a museum label) with no web presence is still usable -
photograph or scan it and host the image somewhere you can link to. The
easiest path is the issue forms above: drag and drop the photo into the
"Sources" field and GitHub hosts it and gives you a URL automatically,
which you (or the maintainer) can then use as `sources[].url`, with a
`title` describing what it is and where it's from (publication, date,
archive). This is separate from the no-Wikimedia-domain rule -
Wikimedia-hosted images are still blocked as sources, same as any other
Wikimedia-project URL.

### Sources in a language other than English, Odia, or Hindi

Review capacity currently only covers those three languages. If your
source is in another language, attach a photo/scan of it (same
drag-and-drop method) rather than only a link, so it can be reviewed
directly instead of relying on machine translation. Note the source
language in the PR description or issue so the maintainer knows to
arrange translation help before merging.

## Bio style

A `bio` is a caption, not a biography. Every person record follows the
same shape so the registry reads consistently at scale and stays easy to
translate later (plain, short, similarly-structured sentences translate
far more predictably than long ones with nested clauses):

1. **30 words maximum**, one or two sentences. `npm run validate` enforces
   this as a hard error (word count, not `maxLength`, since character
   count doesn't track word count reliably). Aim for 25-30, tighter is
   fine for a thin record.
2. **Lead with the type-design contribution**: what they designed or
   built, and for what script or project, as the first clause. Biographical
   framing (where they studied, their general job title) comes after, if
   it fits the word budget, never before.
3. **Cut anything that isn't about the type-design work**, even if
   true and sourced. "While studying calligraphy at X" is relevant
   context for *how* the work happened. "Before relocating to Melbourne
   for an unrelated master's degree" is a biographical detail about their
   life, not their type design work, and doesn't belong here even if a
   source mentions it. When in doubt, ask whether the clause explains the
   type-design contribution or just narrates the person's life; only the
   former earns a place in 30 words.
4. **Plain, simple sentence structure.** Short declarative sentences,
   minimal subordinate clauses, no idioms. Don't narrate your research
   process or sourcing confidence in the `bio` text itself (no
   "independent corroboration has not been found" type language) - that
   belongs in the verification flag, not the biography.
5. Trimming for length can mean dropping a secondary fact (a full script
   list, a co-designer's name, a location) in favor of the most notable
   one or two. That's expected, the full picture belongs in `sources`,
   the `bio` is a pointer to it, not a substitute for it.

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

## Machine-readable exports (JSON, Dublin Core, MARCXML)

Every person and typeface record is exported in three formats at build
time, all generated by `scripts/build.js` (people via
`scripts/lib/dublin-core.js` and `scripts/lib/marc-authority.js`,
typefaces via `dublin-core.js` only) directly from the same fields as the
HTML page. There's no separate step to fill in and no way for an export
to drift out of sync with the record it came from:

- `api/<kind>/<id>.json` - the full record as JSON, existing since the
  project's start.
- `api/<kind>/<id>.dc.xml` - simple (unqualified) Dublin Core, wrapped in
  the `oai_dc` envelope most repository/ILS import tools and OAI-PMH
  harvesters expect. People and typefaces both get one.
- `api/people/<id>.marc.xml` - a MARCXML record for people only (MARC's
  authority format models named entities, not individual creative works,
  so typefaces don't get one). Its `040`/`500` fields say explicitly
  that this is an informational export, not a NACO-authorized name
  authority record - RTD has no registered MARC organization code.
  Modeled on the same MARC 670 (Source Data Found) pattern already used
  for RTD's own LC-NAF outreach: every `sources[]` entry becomes a 670
  field citing RTD's own url in `$u`.

Adding a person or typeface the normal way (a new file in `data/`) is the
only step needed - all three exports appear for it on the next build,
linked from the record's own page next to the existing "JSON" link.

## Schema versioning

`schema/VERSION` is the schema's own semantic version (currently 1.0.0),
shown in the site footer. It's separate from `package.json`'s version,
which tracks the site/tooling, not the data shape. Bump it when you
change `schema/*.schema.json`:

- **Patch** (1.0.0 -> 1.0.1): a new optional field, a widened enum, a
  clarified description, anything an existing valid record already
  satisfies without changes.
- **Minor** (1.0.0 -> 1.1.0): a new required field with a sensible
  default that doesn't invalidate existing records once schema
  migrations catch up, or a meaningfully new capability.
- **Major** (1.0.0 -> 2.0.0): anything that could make a currently-valid
  record fail validation, a renamed/removed field, a narrowed pattern, a
  new required field with no default. Bulk-editing `data/` to match is
  part of the same PR, don't leave existing records failing `npm run
  validate` after a major bump.

## Review

A maintainer checks that:

- CI (schema, id uniqueness, referential integrity, source-domain check)
  passes.
- Sources actually support the claims being added.
- The record isn't a likely duplicate of an existing one (search
  `data/people/` or `data/typefaces/` and the site's search before adding
  a new record).
