/**
 * What the NPC generator reads, from the rules bundle's records (new record shapes,
 * plan/04 R6): the CR table (`npc-stats`), classes, species, powers, weapons, gear and
 * skills. Plain records; the generator never changes them.
 */
export type Rec = Record<string, unknown>
export type Records = Map<string, Map<string, Rec>>

export interface NpcStat {
  id: string
  cr: string
  normalized: number
  profBonus: number
  ac: number
  hp: number
  attack: number
  damage: number
  dc: number
  xp: number
}

export interface NpcClass {
  id: string
  name: string
  profs?: { 'skill'?: { has?: string[], choices?: { items: string[] } }, 'saving-throw'?: { has?: string[] } }
  progression?: { columns?: { label: string, values?: unknown[] }[] }
}

export interface NpcMechanic { type: string, ability?: string | string[], amount?: number, limit?: string[], total?: number, selections?: number }

export interface NpcSpecies {
  id: string
  name: string
  type?: string
  species?: string
  subspecies?: string
  mechanics?: NpcMechanic[]
}

export interface NpcDamageRoll { dieCount?: number, dieType?: number | false, type?: string }

export interface NpcPower {
  id: string
  name: string
  level: number
  powerType: string
  classes?: string[]
  casting?: { damage?: NpcDamageRoll[] }[]
}

export interface NpcWeapon {
  id: string
  name: string
  rarity?: string
  weaponType?: string
  damage?: NpcDamageRoll
  properties?: ({ id: string, value?: unknown } | string)[]
}

export interface NpcGear {
  id: string
  name: string
  gearType?: string
  marks?: { mark: string, rarity?: string, damage?: string }[]
}

export interface NpcSkill { id: string, name: string, link: string }

export interface NpcData {
  stats: NpcStat[]
  classes: NpcClass[]
  species: NpcSpecies[]
  powers: NpcPower[]
  weapons: NpcWeapon[]
  gear: NpcGear[]
  skills: NpcSkill[]
}

/** The classes the generator builds (each has stat priorities and features below). */
export const NPC_CLASSES = ['adept', 'engineer', 'infiltrator', 'sentinel', 'soldier', 'vanguard'] as const

const list = <T>(records: Records, collection: string) => [...(records.get(collection)?.values() ?? [])].map(r => r as T)

export function npcData(records: Records): NpcData {
  return {
    stats: list<NpcStat>(records, 'npc-stats').sort((a, b) => a.normalized - b.normalized),
    classes: list<NpcClass>(records, 'classes'),
    species: list<NpcSpecies>(records, 'species'),
    powers: list<NpcPower>(records, 'powers'),
    weapons: list<NpcWeapon>(records, 'weapons'),
    gear: list<NpcGear>(records, 'gear'),
    skills: list<NpcSkill>(records, 'skills'),
  }
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

/** Classes to choose from: those the generator knows. */
export const npcClassOptions = (data: NpcData) =>
  data.classes.filter(c => (NPC_CLASSES as readonly string[]).includes(c.id)).sort(byName)

/** Species to choose from: base species (not subspecies or variants). */
export const npcSpeciesOptions = (data: NpcData) => data.species.filter(s => !s.type).sort(byName)

/** A progression column's value at a level (1-based). */
export function progressionValue(klass: NpcClass | undefined, label: string, level: number): unknown {
  return klass?.progression?.columns?.find(c => c.label === label)?.values?.[level - 1]
}

/** A progression column of rows per power level (`power_slots_by_power_level`). */
export function progressionRows(klass: NpcClass | undefined, label: string): number[][] {
  const values = klass?.progression?.columns?.find(c => c.label === label)?.values ?? []
  return values.filter((row): row is number[] => Array.isArray(row))
}

const HEALING = new Set(['hp', 'temp', 'shields'])

/**
 * A power's damage dice cast `extra` levels higher: the base casting's first damage roll,
 * with each later casting entry's changes up to that level (casting[n] is the power cast n
 * levels higher, listing only what changes). Undefined for powers that deal no damage.
 */
export function powerDamage(power: NpcPower, extra = 0): { dieCount: number, dieType: number } | undefined {
  const casting = power.casting ?? []
  const base = casting[0]?.damage?.[0]
  if (!base || typeof base.dieType !== 'number' || (base.type && HEALING.has(base.type))) return undefined
  let dieCount = base.dieCount ?? 0
  let dieType = base.dieType
  for (let i = 1; i <= Math.min(extra, casting.length - 1); i++) {
    const d = casting[i]?.damage?.[0]
    if (typeof d?.dieCount === 'number') dieCount = d.dieCount
    if (typeof d?.dieType === 'number') dieType = d.dieType
  }
  return dieCount > 0 ? { dieCount, dieType } : undefined
}

export const propertyIds = (w: NpcWeapon) => (w.properties ?? []).map(p => (typeof p === 'string' ? p : p.id))
