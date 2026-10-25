import { resolve } from 'node:path'
import { defineCollection, defineCollectionSource, defineContentConfig } from '@nuxt/content'
import { contentCollectionName, contentSchema, deriveRecords, recordFiles } from '@omnibrew/engine/content'
import { createGame } from '@omnibrew/engine/schemas'
import { z } from 'zod'
import { me5e } from './game'
import { contentRoot as root } from './paths'

/**
 * Nuxt Content collections for the ME5e content repo (OmniBrew/masseffect-5e-data),
 * read from the sibling checkout (see paths.ts).
 *
 * One collection per content type, named in camelCase (`class-features` →
 * `classFeatures`), with its schema derived from the ME game definition (see the
 * engine's `contentSchema`). Number tables are data collections; every other
 * type is a page collection routed at `/<type>/<id>`. Records the game derives
 * from content (the Exalted Lineage edges) join their collection as a second source.
 */
const game = createGame(me5e)
const DATA = new Set(['attributions', 'character-progression', 'npc-stats'])
const derived = deriveRecords(root, me5e)

const records = Object.fromEntries(Object.entries(me5e.sources).map(([name, source]) => [
  contentCollectionName(name),
  defineCollection({
    type: DATA.has(name) ? 'data' : 'page',
    source: [
      { cwd: resolve(root, source.dir), include: '*.md', prefix: DATA.has(name) ? undefined : `/${name}` },
      ...(derived[name] ? [defineCollectionSource(recordFiles(derived[name], `/${name}`))] : []),
    ],
    schema: contentSchema(game, name),
  }),
]))

const chapter = z.object({ id: z.string(), title: z.string().optional(), is_new: z.boolean().optional(), is_change: z.boolean().optional(), sections: z.array(z.unknown()).optional() })
const person = z.object({ name: z.string(), image: z.string().optional(), roles: z.array(z.string()).optional() })

export default defineContentConfig({
  collections: {
    ...records,
    // Tables of contents for the manual and the guides (manual.yml, guide.yml).
    navigation: defineCollection({
      type: 'data',
      source: { cwd: resolve(root, 'content/navigation'), include: '*.yml' },
      schema: z.object({ chapters: z.array(chapter) }),
    }),
    // The About page's team list.
    about: defineCollection({
      type: 'data',
      source: { cwd: resolve(root, 'content/site'), include: 'about.yml' },
      schema: z.object({ current: z.array(person), former: z.array(person).optional() }),
    }),
  },
})
