import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { recordPageRoutes } from '@omnibrew/engine/content'
import { defineNuxtConfig } from 'nuxt/config'
import { me5e } from './game'
import { contentRoot } from './paths'
import { recordRoutes } from './routes'

const messages = join(contentRoot, 'messages/en.yml')
// The Gen 2 backend's client config, written by `ampx sandbox` or the Amplify build (plan/20).
const amplifyOutputs = fileURLToPath(new URL('./amplify_outputs.json', import.meta.url))

export default defineNuxtConfig({
  extends: ['@omnibrew/engine'],

  alias: {
    // ME5e brand tokens. Imported by the engine's main.css (not listed in `css`),
    // so they compile in the same Tailwind build as Tailwind and Nuxt UI.
    '#game-theme': fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url)),
    ...(existsSync(amplifyOutputs) ? { '#amplify-outputs': amplifyOutputs } : {}),
  },

  ssr: true,

  devtools: { enabled: false },

  // The live site has always been dark by default.
  colorMode: { preference: 'dark', fallback: 'dark' },

  // `brand`: the home page's main call to action (n7-600 with white text in both modes; main.css).
  ui: {
    theme: { colors: ['primary', 'secondary', 'success', 'info', 'warning', 'error', 'neutral', 'brand'] },
  },

  // The theme's four families (main.css), downloaded from Google at build and served from the site.
  fonts: {
    defaults: { subsets: ['latin', 'latin-ext'] },
    families: [
      // Headlines: Saira's width axis pinned at 125%, so the one face is always the wide cut.
      { name: 'Saira', provider: 'google', weights: ['600 700'], providerOptions: { google: { experimental: { variableAxis: { wdth: ['125'] } } } } },
      { name: 'Chakra Petch', provider: 'google', weights: [600, 700] },
      { name: 'IBM Plex Sans', provider: 'google', weights: ['400 700'], styles: ['normal', 'italic'] },
      { name: 'IBM Plex Mono', provider: 'google', weights: [400, 500, 600] },
    ],
  },

  i18n: {
    // CI type-checks without the content repo; the locale then has no messages.
    locales: [{ code: 'en', language: 'en-US', name: 'English', ...(existsSync(messages) ? { file: messages } : {}) }],
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
