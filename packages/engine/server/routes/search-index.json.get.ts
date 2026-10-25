import { defineEventHandler, queryCollection, useAppConfig } from '#imports'
import { contentCollectionName } from '../../content/collections'
import type { Chapter, SearchGroup } from '../../app/types/site'
import { bodyText, inlineText, recordId, recordPath } from '../../shared/utils/records'

/**
 * The site search index: one document per record of the collections the
 * game's `search` config lists, with its page and plain text. Prerendered to a
 * static file at generate (nuxt.config.ts) and searched in the browser.
 */
export interface SearchDoc {
  /** `<collection>/<id>`. */
  id: string
  title: string
  group: string
  collection: string
  /** The record a feature or trait belongs to (its class or species). */
  parent?: string
  to?: string
  text: string
}

type Row = Record<string, unknown> & { stem: string, body?: unknown }

/** Prose kept in fields (power advancements, set bonuses): every nested `text`. */
function fieldText(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach(v => fieldText(v, out))
  else if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value)) {
      if (key === 'text' && typeof v === 'string') out.push(inlineText(v))
      else fieldText(v, out)
    }
  }
  return out
}

export default defineEventHandler(async (event) => {
  const { game } = useAppConfig() as { game: { search: SearchGroup[], routes: Record<string, string | false> } }
  // queryCollection is typed per app; the collections here come from config.
  const query = (name: string) => (queryCollection as (e: typeof event, c: string) => { all: () => Promise<Row[]> })(event, contentCollectionName(name)).all()

  // The chapter (top-level entry of content/navigation/<collection>.yml) listing each record.
  const navigation = await query('navigation')
  const chapterOf = new Map<string, string>()
  for (const file of navigation) {
    const name = recordId(file)
    const walk = (chapter: string, nodes: Chapter[]) => nodes.forEach((n) => {
      chapterOf.set(`${name}/${n.id}`, chapter)
      walk(chapter, n.sections ?? [])
    })
    for (const c of (file.chapters ?? []) as Chapter[]) walk(c.id, [c])
  }

  const names = new Map<string, string>()
  const nameOf = async (collection: string, id: unknown) => {
    if (typeof id !== 'string') return undefined
    if (!names.has(`${collection}/${id}`)) {
      for (const r of await query(collection)) names.set(`${collection}/${recordId(r)}`, String(r.name ?? r.title ?? ''))
    }
    return names.get(`${collection}/${id}`)
  }

  const docs: SearchDoc[] = []
  for (const group of game.search) {
    for (const collection of group.collections) {
      for (const record of await query(collection)) {
        const id = recordId(record)
        const parent = record.klass ? await nameOf('classes', record.klass)
          : Array.isArray(record.species) ? await nameOf('species', record.species[0])
            : undefined
        docs.push({
          id: `${collection}/${id}`,
          title: String(record.name ?? record.title ?? id),
          group: group.id,
          collection,
          ...(parent ? { parent } : {}),
          to: recordPath(game.routes, collection, record, chapterOf.get(`${collection}/${id}`)),
          text: [bodyText(record.body), ...fieldText(Object.fromEntries(Object.entries(record).filter(([k]) => !['body', 'meta', 'seo', 'navigation'].includes(k))))].join(' ').trim(),
        })
      }
    }
  }
  return docs
})
