// @omnibrew/engine: the shared 5e engine, consumed by game apps as a Nuxt layer
// (`extends: ['@omnibrew/engine']`). Paths are resolved relative to this file so
// they keep working when the layer is extended from another directory.
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content', '@pinia/nuxt', '@nuxtjs/i18n'],

  css: [resolve('./app/assets/css/main.css')],

  alias: {
    // Game theme hook, imported by main.css so a game's @theme tokens join the same
    // Tailwind build. Each app points this at its own CSS (see apps/me5e/nuxt.config.ts).
    '#game-theme': resolve('./app/assets/css/game-theme.css'),
    // The backend's client config (Amplify Gen 2 amplify_outputs.json). Empty here: the site
    // then runs signed out. A game app points it at its own file when it has one.
    '#amplify-outputs': resolve('./app/amplify-outputs.json'),
  },

  hooks: {
    // Prose components (:distance, :condition...) appear in text fields too, which render
    // through <MDC>; that resolves components globally, unlike ContentRenderer.
    'components:extend'(components) {
      const dir = resolve('./app/components/content').replaceAll('\\', '/')
      for (const c of components) {
        if (c.filePath.replaceAll('\\', '/').startsWith(dir)) c.global = true
      }
    },
  },

  // `::note` renders the engine's note box (a titled aside) instead of Nuxt UI's callout.
  mdc: {
    components: { map: { note: 'NoteBox' } },
  },

  content: {
    experimental: {
      // Use Node's built-in node:sqlite (Node >= 22.5) instead of better-sqlite3,
      // so installs don't need to compile a native module.
      sqliteConnector: 'native',
    },
    // Nuxt Content caches every parsed file in SQLite with one commit per file. On a
    // spinning disk a commit takes ~0.2 s, so a cold parse of ME5e (2,000 files) takes
    // 6 minutes there and seconds on an SSD. CONTENT_CACHE_DIR moves the cache.
    ...(process.env.CONTENT_CACHE_DIR
      ? { _localDatabase: { type: 'sqlite' as const, filename: join(process.env.CONTENT_CACHE_DIR, 'contents.sqlite') } }
      : {}),
  },

  vite: {
    optimizeDeps: {
      // @nuxtjs/mdc asks Vite to pre-bundle its CommonJS dependencies as `@nuxtjs/mdc > …`, which
      // pnpm doesn't let the app resolve; without this, <MDC> mounted in the browser renders nothing in dev.
      include: [
        '@nuxt/content > @nuxtjs/mdc > unified > extend',
        '@nuxt/content > @nuxtjs/mdc > debug',
        // Imported on demand (utils/amplify.ts, the data layer); found late, they reload the page in dev.
        'aws-amplify',
        'aws-amplify/auth',
        'aws-amplify/auth/enable-oauth-listener',
        'aws-amplify/data',
        'aws-amplify/utils',
        'zod',
      ],
    },
  },

  icon: {
    // Prerendering ~900 pages at once keeps the server busy; with the 1.5 s default some icons
    // timed out and were missing from the static HTML until the page hydrated.
    fetchTimeout: 15_000,
  },

  nitro: {
    prerender: {
      // The site search's index and robots.txt (server/routes), static files once generated.
      routes: ['/search-index.json', '/robots.txt'],
    },
  },

  runtimeConfig: {
    public: {
      // A preview copy is built with NUXT_PUBLIC_INDEXABLE=false: noindex on every page and in robots.txt.
      indexable: true,
    },
  },

  // @pinia/nuxt's default is the app's own stores/ only; a relative dir is read in every layer.
  pinia: {
    storesDirs: ['stores'],
  },

  // UI strings. The game app lists its locales and points each at its content repo's
  // messages/<locale>.yml. No locale prefix in URLs while there is one locale (plan/04 D8).
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'en',
    detectBrowserLanguage: false,
  },
})
