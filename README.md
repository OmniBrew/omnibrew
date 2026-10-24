# OmniBrew

Shared engine and game apps for 5e-based tabletop rules sites. The engine is a
Nuxt 4 layer; each game is a Nuxt 4 app that extends it. Mass Effect 5e is the
first app; Star Wars 5e comes later.

## Layout

```
packages/engine/      @omnibrew/engine: the shared 5e engine (Nuxt layer)
  app/                components, composables and CSS shared by every game
                      (components/content/ holds MDC components such as :distance and :condition)
  rulesets/           core rules per edition (5e-2014 now, 5e-2024 later)
  schemas/            zod content schemas: enum registry, mechanics registry, power system, items, collections
  validator/          content validator CLI: schema, cross-references, data/text pairing, prose tags, notes backlog
  fixtures/sw5e/      SW5e-shaped sample game + content, validated in tests
  test/               vitest tests
apps/me5e/            @omnibrew/me5e: Mass Effect 5e (extends the engine)
  game/               ME game definition: enums, me:* mechanics, power system, legacy adapter
  content.config.ts   Nuxt Content collections read from ../omnibrew-me5e-data (local preview)
```

## Commands

Requires Node 22 (see `.node-version`) and pnpm (version pinned in
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

The validator reads content in today's format (data/ + text/en split) and maps it
onto the engine shape in memory with the ME legacy adapter (`apps/me5e/game/legacy.ts`);
nothing in the content repo is modified. The same adapter feeds the Nuxt Content
preview, so `/powers` and `/classes` in the dev server render today's files.

After changing the Nuxt Content hooks in `apps/me5e/nuxt.config.ts`, delete
`apps/me5e/.data/content`: parsed files are cached and the hooks won't rerun.
