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
