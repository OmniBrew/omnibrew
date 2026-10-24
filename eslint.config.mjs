// Root flat config. createConfigForNuxt works without `nuxt prepare`
// (unlike withNuxt from @nuxt/eslint, which reads .nuxt/eslint.config.mjs).
import { createConfigForNuxt } from '@nuxt/eslint-config'

export default createConfigForNuxt({
  features: {
    // Lint plain TS/Node files (configs, validator CLI, tests) as well as Vue.
    tooling: true,
  },
  dirs: {
    // Nuxt 4 source dirs, so page/layout/app.vue naming rules apply correctly.
    src: [
      './apps/me5e/app',
      './packages/engine/app',
    ],
  },
}).append({
  ignores: [
    '**/node_modules/**',
    '**/.nuxt/**',
    '**/.output/**',
    '**/.data/**',
    '**/dist/**',
    '**/coverage/**',
  ],
})
