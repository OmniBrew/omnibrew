import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

// The page tests mount the ME app, which needs its content repo next to this checkout (local only; CI skips them).
const withContent = existsSync(join(import.meta.dirname, '../omnibrew-me5e-data/content'))

export default defineConfig({
  test: {
    projects: [
      {
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
          name: 'unit',
          environment: 'node',
          include: [
            'packages/*/test/**/*.test.ts',
            'apps/*/test/**/*.test.ts',
          ],
          exclude: ['apps/*/test/nuxt/**'],
        },
      },
      // Components mounted in the ME app (Nuxt runtime, happy-dom): the sheet's numbers through the page.
      ...(withContent
        ? [await defineVitestProject({
            test: {
              name: 'nuxt',
              include: ['apps/me5e/test/nuxt/**/*.test.ts'],
              environment: 'nuxt',
              environmentOptions: { nuxt: { rootDir: 'apps/me5e', domEnvironment: 'happy-dom' } },
            },
          })]
        : []),
    ],
  },
})
