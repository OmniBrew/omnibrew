# OmniBrew

Shared engine and game apps for 5e-based tabletop rules sites. The engine is a
Nuxt 4 layer; each game is a Nuxt 4 app that extends it. Mass Effect 5e is the
first app; Star Wars 5e comes later.

## Layout

```
packages/engine/      @omnibrew/engine: the shared 5e engine (Nuxt layer)
  app/                the site shell (layouts, header, navigation, search, units and color toggles),
                      game-neutral reference UI (record lists, power info, class table, item stats, stat
                      blocks, mechanic summaries), composables, Pinia stores, pure helpers in utils/
                      (components/content/ holds the MDC prose components: :distance, :condition, ::edge-list...)
  server/routes/      the prerendered search index and robots.txt
  shared/utils/       helpers for both app and server (record ids, record URLs, plain text of a body)
  content/            content file format (read/write one record per file), MDC helpers, Nuxt Content
                      schemas, derived records, the list of record pages to prerender
  rulesets/           core rules per edition (5e-2014 now, 5e-2024 later)
  schemas/            zod content schemas: enum registry, mechanics registry, power system, items, collections, prose components
  validator/          content validator CLI: schema, cross-references, prose (framework tags, MDC), notes backlog
  fixtures/sw5e/      SW5e-shaped sample game + content, validated in tests
  test/               vitest tests
apps/me5e/            @omnibrew/me5e: Mass Effect 5e (extends the engine)
  game/               ME game definition: enums, me:* mechanics, power system, content layout
  app/                pages at the live site's URLs, ME-only components (components/me/), theme, site config
  routes.ts           where each collection's records are on the site (the live URLs)
  migrate/            one-off migration of the content repo from its old data/ + text/en/ layout
  content.config.ts   Nuxt Content collections (one per content type) read from ../omnibrew-me5e-data
                      (or ME5E_CONTENT_DIR); generated records (Exalted Lineages) join their collection
```

## Commands

Requires Node 24 (see `.node-version`) and pnpm (version pinned in
`package.json` `packageManager`; `corepack pnpm …` works if pnpm isn't installed).

```sh
pnpm install                            # also runs `nuxt prepare` for the app
pnpm lint                               # ESLint across the repo (pnpm lint:fix to fix)
pnpm typecheck                          # tsc for engine and game code, nuxt typecheck for the app
pnpm test                               # vitest, all packages
pnpm --filter @omnibrew/me5e dev        # ME5e dev server on http://localhost:3000
pnpm --filter @omnibrew/me5e generate   # the static site in apps/me5e/.output/public
```

Environment variables (an `apps/me5e/.env` file works; it is git-ignored):

| Variable | Use |
|---|---|
| `ME5E_CONTENT_DIR` | The content repo, if it isn't checked out at `../omnibrew-me5e-data` |
| `CONTENT_CACHE_DIR` | Where Nuxt Content keeps its parse cache. It commits once per file, so on a spinning disk the first parse takes minutes; point this at an SSD folder |
| `NUXT_PUBLIC_INDEXABLE=false` | For a preview build (beta.n7.world): every page gets `noindex` and robots.txt disallows crawling. Canonical links always point at n7.world |

## Content validation

The ME5e content lives in [OmniBrew/masseffect-5e-data](https://github.com/OmniBrew/masseffect-5e-data).
Check it out next to this repo (`../omnibrew-me5e-data`), then:

```sh
pnpm validate:me5e                                   # summary; exits 1 on errors
pnpm validate:me5e --format md --fail-on none        # full markdown report
pnpm validate:me5e --format backlog --fail-on none   # rules written as notes (implementation backlog)
pnpm validate:me5e --format json --fail-on none      # everything, machine-readable
```

If your checkout has another name, pass it: `pnpm validate:me5e --content ../masseffect-5e-data`.
The content repo's own CI runs the same command against OmniBrew/omnibrew `main` (or the
omnibrew branch with the same name as the content branch, so paired changes test together).

The content is one markdown file per record (`content/<collection>/<id>.md`); its README
documents the format for contributors; its `messages/en.yml` holds the site's UI strings. The
dev server shows every page at the live site's URLs. The first start parses about 2,000 files
(seconds on an SSD; see `CONTENT_CACHE_DIR`); later starts read the parse cache.

### The 2026 content migration

`apps/me5e/migrate` moved the content from its old layout (`data/` + `text/en/`, Vue tags in
prose) to the engine format: plan/04 R6 and R7. It is re-runnable against any checkout of the
old layout (the old repo, queryluke/masseffect-5e-data, or a commit before the migration):

```sh
pnpm migrate:me5e --from <old checkout> --to <content repo> [--force] [--dry-run]
```

`apps/me5e/test/migrate.test.ts` holds one case per rename, and an end-to-end run over
`test/fixtures/legacy` compared with `test/fixtures/migrated` (regenerate those with
`UPDATE_MIGRATION_FIXTURE=1 pnpm test`, then review the diff).
