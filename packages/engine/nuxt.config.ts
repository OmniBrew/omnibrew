// @omnibrew/engine: the shared 5e engine, consumed by game apps as a Nuxt layer
// (`extends: ['@omnibrew/engine']`). Paths are resolved relative to this file so
// they keep working when the layer is extended from another directory.
import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/content'],

  css: [resolve('./app/assets/css/main.css')],

  alias: {
    // Game theme hook, imported by main.css so a game's @theme tokens join the same
    // Tailwind build. Each app points this at its own CSS (see apps/me5e/nuxt.config.ts).
    '#game-theme': resolve('./app/assets/css/game-theme.css'),
  },

  content: {
    experimental: {
      // Use Node's built-in node:sqlite (Node >= 22.5) instead of better-sqlite3,
      // so installs don't need to compile a native module.
      sqliteConnector: 'native',
    },
  },
})
