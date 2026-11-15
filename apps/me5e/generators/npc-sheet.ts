import type { NpcEntry } from './npc'
import type { Records } from './npc-data'

/**
 * What a generated NPC's stat block looks up, from the rules bundle instead of Nuxt Content
 * queries (the engine's StatblockSheet queries the content database, which the generator
 * pages never load): challenge ratings, skills, conditions, weapons, powers and gear, by id.
 */
type Rec = Record<string, unknown>
type Translate = (key: string, params?: unknown) => string

export interface NpcSheetRefs {
  challenge: Record<string, { cr: string, xp: number }>
  skills: Record<string, { name: string, link: string }>
  conditions: Record<string, string>
  weapons: Record<string, { name?: string, weaponType?: string, damage?: { dieCount?: number, dieType?: number | false, type?: string }, properties?: unknown[], range?: { short?: number, long?: number } }>
  powers: Record<string, { name: string, level: number }>
  items: Record<string, string>
}

const each = (records: Records, collection: string) => [...(records.get(collection)?.values() ?? [])]
const index = <T>(records: Records, collection: string, value: (r: Rec) => T) => Object.fromEntries(each(records, collection).map(r => [String(r.id), value(r)]))

export function npcSheetRefs(records: Records): NpcSheetRefs {
  return {
    challenge: index(records, 'npc-stats', r => ({ cr: String(r.cr ?? ''), xp: Number(r.xp ?? 0) })),
    skills: index(records, 'skills', r => ({ name: String(r.name ?? r.id), link: String(r.link ?? '') })),
    conditions: index(records, 'conditions', r => String(r.name ?? r.id)),
    weapons: index(records, 'weapons', r => ({ name: r.name as string, weaponType: r.weaponType as string, damage: r.damage as NpcSheetRefs['weapons'][string]['damage'], properties: r.properties as unknown[], range: r.range as NpcSheetRefs['weapons'][string]['range'] })),
    powers: index(records, 'powers', r => ({ name: String(r.name ?? r.id), level: Number(r.level ?? 0) })),
    items: index(records, 'gear', r => String(r.name ?? r.id)),
  }
}

/** A leveled powercasting entry (`ref: power`, a list of ids): its powers are listed by level here. */
export const isLeveledPowercasting = (e: NpcEntry) => e.ref === 'power' && !!e.list?.length && e.list.every(i => typeof i === 'string')

/**
 * A generated NPC's known powers by level ("Cantrips (at will): throw", "1st level: lift,
 * pull"). The slots or tech points are in the feature's text: generated casters use their
 * own class's resources, not the adept's slots the bestiary's powercasting lines assume.
 */
export function powerLevelLines(t: Translate, e: NpcEntry, powers: NpcSheetRefs['powers']) {
  const known = (e.list ?? []).filter((id): id is string => typeof id === 'string' && !!powers[id]).sort()
  const byLevel = new Map<number, string[]>()
  for (const id of known) byLevel.set(powers[id]!.level, [...(byLevel.get(powers[id]!.level) ?? []), id])
  return [...byLevel.entries()].sort(([a], [b]) => a - b).map(([level, ids]) => ({
    label: t('markdown_label', { label: level === 0 ? `${t('class_feature_columns.cantrips')} (${t('npc.at_will')})` : t('level_nth', { nth: t(`ordinal_numbers[${level}]`) }) }),
    links: ids.map(id => ({ id, text: powers[id]!.name.toLowerCase() })),
  }))
}
