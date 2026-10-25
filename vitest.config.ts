import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [{
    // The parity test imports the old site's Vuex modules (apps/me5e/parity), which
    // use Nuxt 2's `~/` alias for the old site's root.
    name: 'legacy-site-alias',
    enforce: 'pre',
    resolveId(source, importer) {
      const root = importer?.match(/^(.*[\\/]masseffect-5e)[\\/]/)?.[1]
      if (!root || !source.startsWith('~/')) return null
      const path = join(root, source.slice(2))
      return existsSync(path) ? path : `${path}.js`
    },
  }],
  test: {
    environment: 'node',
    include: [
      'packages/*/test/**/*.test.ts',
      'apps/*/test/**/*.test.ts',
    ],
  },
})
