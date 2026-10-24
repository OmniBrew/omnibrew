import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineCollection, defineContentConfig, z } from '@nuxt/content'

/**
 * Local preview of ME5e content through Nuxt Content (Phase 1 stretch).
 *
 * Reads the content repo as it is today, from the sibling checkout
 * (override with ME5E_CONTENT_DIR). nuxt.config.ts hooks rewrite legacy tags
 * to MDC and run the ME legacy adapter, so these schemas describe the engine
 * shape (`powerType`, `casting`), not the old files.
 */
const root = process.env.ME5E_CONTENT_DIR ?? fileURLToPath(new URL('../../../omnibrew-me5e-data/', import.meta.url))
const dir = (path: string) => resolve(root, path)

const json = z.record(z.string(), z.any())

export default defineContentConfig({
  collections: {
    powers: defineCollection({
      type: 'page',
      source: { cwd: dir('data/powers'), include: '*.md', prefix: '/powers' },
      schema: z.object({
        name: z.string(),
        level: z.number(),
        powerType: z.string(),
        classes: z.array(z.string()),
        tags: z.array(z.string()).optional(),
        casting: z.array(json),
        advancements: z.array(z.object({ id: z.string(), name: z.string(), text: z.string() })).optional(),
      }),
    }),
    // Class prose lives in text/en, mechanics in data/; the two collections join on the file name.
    classes: defineCollection({
      type: 'page',
      source: { cwd: dir('text/en/classes'), include: '*.md', prefix: '/classes' },
      schema: z.object({
        name: z.string(),
        snippet: z.string().optional(),
        profs: json.optional(),
        startingEquipment: z.array(z.object({ text: z.string() })).optional(),
      }),
    }),
    classData: defineCollection({
      type: 'data',
      source: { cwd: dir('data/classes'), include: '*.md' },
      schema: z.object({
        hitDie: z.number(),
        primaryAbility: z.array(z.string()),
        profs: json,
        progression: json,
      }),
    }),
  },
})
