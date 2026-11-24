import type { Game } from '../schemas/game'
import type { Issue } from '../validator/issues'
import { checkReferences } from '../validator/refs'

type Rec = Record<string, unknown>

/**
 * What the content editor knows of the rest of the content (plan/33 §1.6): every record's
 * fields (no bodies), every collection included, written at build next to the rules bundle
 * and loaded only by editor pages. It is the content of the site's last build; the record
 * being edited always comes fresh from GitHub, and CI checks every PR against `master`.
 */
export interface EditorBundle {
  game: string
  hash: string
  collections: Record<string, Rec[]>
  /** Records a game computes (ME's Exalted Lineages): referenced like any other, never edited. */
  derived: Record<string, string[]>
}

/** The bundle's collections: fields and `id`, no `body`, collections and ids sorted. */
export function editorCollections(records: Map<string, Map<string, Rec>>): Record<string, Rec[]> {
  const out: Record<string, Rec[]> = {}
  for (const [collection, recs] of [...records].sort(([a], [b]) => a.localeCompare(b))) {
    out[collection] = [...recs]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, rec]) => {
        const { body: _body, ...fields } = rec
        return { ...fields, id }
      })
  }
  return out
}

/** The bundle's records, as `validateRecord` takes them. */
export function editorRecords(bundle: Pick<EditorBundle, 'collections'>) {
  const out = new Map<string, Map<string, Rec>>()
  for (const [collection, recs] of Object.entries(bundle.collections)) out.set(collection, new Map(recs.map(r => [r.id as string, r])))
  return out
}

/** Published file name (under `/_rules/`). */
export const editorBundleFile = (game: string, hash: string) => `${game}.${hash}.editor.json`

/**
 * Records whose fields would point at nothing once `id` of `collection` is deleted: the
 * reference issues the validator reports without the record that it didn't report with it
 * (plan/33 §1.8). Bodies aren't in the bundle, so prose links (`:condition{id=…}`) are left
 * to CI, which validates the whole repo on the PR.
 */
export function deleteBlockers(game: Game, records: Map<string, Map<string, Rec>>, collection: string, id: string): Issue[] {
  const files = new Map<string, string | undefined>()
  const key = (i: Issue) => `${i.collection}/${i.id}/${i.path}/${i.rule}/${i.message}`
  const before = new Set(checkReferences(game, records, files).filter(i => i.severity === 'error').map(key))
  const without = new Map(records)
  const rest = new Map(records.get(collection))
  rest.delete(id)
  without.set(collection, rest)
  return checkReferences(game, without, files).filter(i => i.severity === 'error' && !before.has(key(i)))
}
