import { queryCollection } from '@nuxt/content/nitro'
import { contentCollectionName } from '../../content/collections'
import type { RecordDoc } from '../../app/types/site'
import { recordId, recordPath } from '../../shared/utils/records'

type Row = Record<string, unknown> & { stem: string }

/**
 * The record index: id, name and page of every record a reader can bookmark (the game's
 * `bookmarks` collections), without text: the bookmarks page names and links records with
 * it (plan/26 §1.1), at a few KB instead of the search index's 290 KB. Prerendered.
 */
export default defineEventHandler(async (event): Promise<RecordDoc[]> => {
  const { game } = useAppConfig() as { game: { bookmarks: string[], routes: Record<string, string | false> } }
  const query = (name: string) => (queryCollection as (e: typeof event, c: string) => { all: () => Promise<Row[]> })(event, contentCollectionName(name)).all()
  const docs: RecordDoc[] = []
  for (const collection of game.bookmarks ?? []) {
    for (const record of await query(collection)) {
      const id = recordId(record)
      docs.push({ id: `${collection}/${id}`, title: String(record.name ?? record.title ?? id), group: collection, collection, to: recordPath(game.routes, collection, record) })
    }
  }
  return docs
})
