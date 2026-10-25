import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import { contentRoot } from './paths'

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

  compatibilityDate: '2026-10-24',
})
