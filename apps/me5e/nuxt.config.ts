import { fileURLToPath } from 'node:url'
import { defineNuxtConfig } from 'nuxt/config'
import { meLegacy } from './game/legacy'
import { legacyTagsToMdc } from './game/mdc'

export default defineNuxtConfig({
  extends: ['@omnibrew/engine'],

  alias: {
    // ME5e brand tokens. Imported by the engine's main.css (not listed in `css`),
    // so they compile in the same Tailwind build as Tailwind and Nuxt UI.
    '#game-theme': fileURLToPath(new URL('./app/assets/css/main.css', import.meta.url)),
  },

  ssr: true,

  devtools: { enabled: false },

  compatibilityDate: '2026-10-24',

  hooks: {
    // Today's content embeds Vue tags; render them as MDC components without touching the files.
    'content:file:beforeParse'({ file }) {
      if (file.id.endsWith('.md')) file.body = legacyTagsToMdc(file.body)
    },
    // Map legacy front-matter onto the engine shape (same adapter the validator uses).
    // By now Content has moved fields outside the schema (`type`, `mechanics`) into `meta`.
    'content:file:afterParse'({ content, collection }) {
      if (collection.name !== 'powers') return
      const meta = (content.meta ?? {}) as Record<string, unknown>
      const next = meLegacy({ ...meta, ...content }, { collection: 'powers', note: () => {} })
      for (const key of Object.keys(meta)) {
        if (!(key in next)) Reflect.deleteProperty(meta, key)
      }
      for (const [key, value] of Object.entries(next)) {
        if (!(key in meta)) content[key] = value
      }
    },
  },
})
