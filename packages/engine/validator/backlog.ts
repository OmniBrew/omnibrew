import type { Issue } from './issues'
import { walkMechanics } from './refs'

/**
 * Finds rules that exist only as text: features whose effect was written as a
 * note instead of a mechanic. Each hit is an info issue in the `backlog`
 * category; together they are the worklist for turning notes into real
 * character-sheet mechanics.
 *
 * Kinds, roughly from most to least deliberate:
 * - `global-note`: a sheet note standing in for the feature (`value` + `moreInfo`).
 * - `speed-note`: movement rules written as text.
 * - `text-action`: an action, bonus action, reaction or `other` with only a name,
 *   description and maybe a use counter: no damage, DC, attack, range or toggle.
 * - `rider-note`: hit/save riders in `notes` ("Hit: CON save or stunned").
 * - `prose-only`: a feature, trait, feat or edge with a description but no mechanics.
 */
type Rec = Record<string, unknown>

export const BACKLOG_KINDS = ['global-note', 'speed-note', 'text-action', 'rider-note', 'prose-only'] as const

const ACTION_TYPES = new Set(['action', 'bonus-action', 'reaction', 'other'])
const STRUCTURED = ['damage', 'dc', 'attack', 'range', 'toggle', 'progressionColumn']
const FEATURE_COLLECTIONS = new Set(['class-features', 'traits', 'feats', 'edges'])

const clip = (s: unknown, n = 140) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

function riderNotes(notes: unknown): string[] {
  return (Array.isArray(notes) ? notes : [])
    .map(n => (typeof n === 'string' ? n : n && typeof n === 'object' ? ((n as Rec).tooltipText ?? (n as Rec).text) : undefined))
    .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
}

export function findBacklog(records: Map<string, Map<string, Rec>>, files: Map<string, string | undefined>): Issue[] {
  const issues: Issue[] = []
  for (const [collection, recs] of records) {
    for (const [id, rec] of recs) {
      const file = files.get(`${collection}/${id}`)
      const add = (kind: typeof BACKLOG_KINDS[number], path: string | undefined, message: string) =>
        issues.push({ severity: 'info', category: 'backlog', collection, id, file, rule: `note-only:${kind}`, path, message })

      let mechanicCount = 0
      walkMechanics(rec, (m, path) => {
        mechanicCount++
        if (m.type === 'global-note') add('global-note', path, `${m.subType ?? 'note'}: ${clip(m.value)}`)
        else if (m.type === 'speed-note') add('speed-note', path, clip(m.note))
        else if (typeof m.type === 'string' && ACTION_TYPES.has(m.type) && !STRUCTURED.some(k => k in m)) {
          add('text-action', path, `${m.type}${m.name ? ` "${clip(m.name, 60)}"` : ''}: ${clip(m.shortDesc) || '(no description)'}`)
        }
        const riders = riderNotes(m.notes)
        if (riders.length) add('rider-note', `${path}.notes`, riders.map(r => clip(r, 80)).join(' | '))
      })

      // Power casting entries and advancements carry riders too.
      if (collection === 'powers') {
        for (const [i, entry] of (Array.isArray(rec.casting) ? rec.casting : []).entries()) {
          const riders = riderNotes((entry as Rec)?.notes)
          if (riders.length) add('rider-note', `casting[${i}].notes`, riders.map(r => clip(r, 80)).join(' | '))
        }
      }

      if (FEATURE_COLLECTIONS.has(collection) && mechanicCount === 0 && typeof rec.body === 'string' && rec.body.trim() && !rec.noFeatureDisplay) {
        add('prose-only', undefined, clip(rec.body))
      }
    }
  }
  return issues
}
