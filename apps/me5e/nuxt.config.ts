import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordPageRoutes } from '@omnibrew/engine/content'
import { defineNuxtConfig } from 'nuxt/config'
import { me5e } from './game'
import { contentRoot } from './paths'
import { recordRoutes } from './routes'

export default defineNuxtConfig({
  extends: ['@omnibrew/engine'],

  alias: {
    // ME5e brand tokens. Imported by the engine's main.css (not listed in `css`),
    // so they compile in the same Tailwind build as Tailwind and Nuxt UI.
    '#game-theme': fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url)),
  },

  ssr: true,

  devtools: { enabled: false },

  // The live site has always been dark by default.
  colorMode: { preference: 'dark', fallback: 'dark' },

  i18n: {
    locales: [{ code: 'en', language: 'en-US', name: 'English', file: join(contentRoot, 'messages/en.yml') }],
  },

  nitro: {
    prerender: {
      // Content links to pages that never existed (the live site 404s too; plan/14).
      ignore: ['/guide/encounter-creation'],
    },
  },

  hooks: {
    // `nuxt generate` crawls from / and also renders every record page, so pages no
    // other page links to (the April Fools' changelog post) exist as they did live.
    'prerender:routes'({ routes }) {
      for (const route of recordPageRoutes(contentRoot, me5e, recordRoutes)) routes.add(route)
    },
  },

  compatibilityDate: '2026-10-24',
})
