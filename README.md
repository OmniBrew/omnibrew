# OmniBrew

Shared engine and game apps for 5e-based tabletop rules sites. The engine is a
Nuxt 4 layer; each game is a Nuxt 4 app that extends it. Mass Effect 5e is the
first app; Star Wars 5e comes later.

## Layout

```
packages/engine/      @omnibrew/engine: the shared 5e engine (Nuxt layer)
  app/                components, composables and CSS shared by every game
                      (components/content/ holds the MDC prose components: :distance, :condition, ::edge-list...)
  content/            content file format (read/write one record per file), MDC helpers, Nuxt Content schemas
  rulesets/           core rules per edition (5e-2014 now, 5e-2024 later)
  schemas/            zod content schemas: enum registry, mechanics registry, power system, items, collections, prose components
  validator/          content validator CLI: schema, cross-references, prose (framework tags, MDC), notes backlog
  fixtures/sw5e/      SW5e-shaped sample game + content, validated in tests
  test/               vitest tests
apps/me5e/            @omnibrew/me5e: Mass Effect 5e (extends the engine)
  game/               ME game definition: enums, me:* mechanics, power system, content layout
  migrate/            one-off migration of the content repo from its old data/ + text/en/ layout
  content.config.ts   Nuxt Content collections (one per content type) read from ../omnibrew-me5e-data
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
pnpm --filter @omnibrew/me5e build      # production build
```

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
documents the format for contributors. The dev server previews it: `/powers`, `/classes`,
and `/<collection>/<id>` for any other record. The first start parses about 2,000 files
(a few minutes); later starts read `apps/me5e/.data/content`, the parse cache.

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
