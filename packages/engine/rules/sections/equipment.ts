import type { EquipmentEntry } from '../../character/schema'
import type { Sheet } from '../sheet'
import type { Mech, MechanicSource, Rec } from '../types'

/** An owned weapon: the record with the character's overrides, its property ids and its mods' mechanics. */
export interface OwnedWeapon {
  entry: EquipmentEntry
  data: Rec
  /** Property ids of the record (or the typed ones), before mods and features adjust them. */
  baseProperties: string[]
  /** `adjust-weapon-props` of the weapon's mods. */
  adjust: Mech[]
  /** Property ids after the mods' adjustments (features add theirs in the attack section). */
  properties: string[]
  /** Value of a valued property (heat, versatile damage) of the weapon. */
  propertyValues: Record<string, unknown>
  slots: number
  mechanics: Mech[]
}

export interface OwnedItem {
  entry: EquipmentEntry
  data: Rec
  /** Record and mod mechanics (armor). */
  mechanics: Mech[]
}

export interface ActiveSetBonus {
  id: string
  name: string
  max?: number
  count: number
  items: Array<{ uuid: string, name: string }>
  bonuses: Rec[]
}

export interface EquipmentView {
  weapons: OwnedWeapon[]
  armor: OwnedItem[]
  gear: OwnedItem[]
  equippedWeapons: OwnedWeapon[]
  equippedArmor: OwnedItem[]
  equippedGear: OwnedItem[]
  setBonuses: ActiveSetBonus[]
  /** Mechanic sources of equipped items, in the live order: weapons, armor, set bonuses, gear. */
  sources: MechanicSource[]
}

const byUuid = <T extends { entry: EquipmentEntry }>(a: T, b: T) => (a.entry.uuid > b.entry.uuid ? 1 : -1)

/** Gear records, with each `subsets` entry (grenade tiers) as its own record. */
export function gearRecords(sheet: Sheet): Rec[] {
  const out: Rec[] = []
  for (const g of sheet.content.list('gear')) {
    out.push(g)
    for (const s of g.subsets ?? []) out.push({ ...g, ...s })
  }
  return out
}

function propertyIds(list: unknown): { ids: string[], values: Record<string, unknown> } {
  const ids: string[] = []
  const values: Record<string, unknown> = {}
  for (const p of Array.isArray(list) ? list : []) {
    const id = typeof p === 'string' ? p : (p as Rec).id
    ids.push(id)
    if (typeof p === 'object' && 'value' in (p as Rec)) values[id] = (p as Rec).value
  }
  return { ids, values }
}

function ownWeapon(sheet: Sheet, entry: EquipmentEntry): OwnedWeapon | null {
  const weapon = sheet.content.get('weapons', entry.id)
  if (!weapon) return null
  const modIds = (entry.mods ?? []).map(m => m.id)
  const mods = sheet.content.list('mods').filter(m => modIds.includes(m.id))
  const modMechanics: Mech[] = mods.flatMap(m => m.mechanics ?? [])
  const { heat, properties: typedProps, damage, ...overrides } = entry.overrides ?? {}
  const data: Rec = { ...weapon, ...overrides, damage: { ...weapon.damage, ...(damage as Rec | undefined) } }
  const base = propertyIds(weapon.properties)
  const values = { ...base.values }
  if (heat !== undefined) values.heat = heat
  // A typed property list replaces the record's; valued properties keep their values.
  const baseProperties = typedProps ? [...propertyIds(typedProps).ids, ...base.ids.filter(id => id in base.values && !propertyIds(typedProps).ids.includes(id))] : base.ids
  const adjust = modMechanics.filter(m => m.type === 'adjust-weapon-props')
  return { entry, data, baseProperties, adjust, properties: adjustProperties(baseProperties, adjust), propertyValues: values, slots: data.slots, mechanics: modMechanics.filter(m => m.type !== 'adjust-weapon-props') }
}

/** Applies `adjust-weapon-props`: adds, then removes. Adding light to a heavy weapon removes heavy instead. */
export function adjustProperties(properties: string[], adjust: Mech[]): string[] {
  if (!adjust.length) return properties
  const remove = adjust.flatMap(m => m.remove ?? [])
  let add = adjust.flatMap(m => m.add ?? [])
  if (add.includes('light') && properties.includes('heavy')) {
    remove.push('heavy')
    add = add.filter(p => p !== 'light')
  }
  return [...new Set([...properties, ...add].filter(p => !remove.includes(p)))]
}

export function computeEquipment(sheet: Sheet): EquipmentView {
  const owned = sheet.character.equipment
  const weapons = owned.filter(e => e.kind === 'weapon').map(e => ownWeapon(sheet, e)).filter((w): w is OwnedWeapon => !!w).sort(byUuid)

  const armorMods = (entry: EquipmentEntry) => {
    const ids = (entry.mods ?? []).map(m => m.id)
    return sheet.content.list('mods').filter(m => ids.includes(m.id) && m.modType === 'armor').flatMap(m => m.mechanics ?? [])
  }
  const armor: OwnedItem[] = owned.filter(e => e.kind === 'armor').map((entry) => {
    const data = entry.custom ? { ...entry.custom } : sheet.content.get('armor', entry.id) ?? { id: entry.id, armorType: 'none', mechanics: [] }
    return { entry, data, mechanics: [...data.mechanics ?? [], ...entry.equipped ? armorMods(entry) : []] }
  }).sort(byUuid)
  const gearList = gearRecords(sheet)
  const gear: OwnedItem[] = owned.filter(e => e.kind === 'gear').map((entry) => {
    const data = gearList.find(g => g.id === entry.id) ?? { id: entry.id, mechanics: [] }
    return { entry, data, mechanics: data.mechanics ?? [] }
  }).sort(byUuid)

  const equippedWeapons = weapons.filter(w => w.entry.equipped)
  const equippedArmor = armor.filter(a => a.entry.equipped)
  const equippedGear = gear.filter(g => g.entry.equipped)

  const sets = new Map<string, { count: number, items: Array<{ uuid: string, name: string }> }>()
  for (const a of equippedArmor) {
    if (!a.data.set) continue
    const s = sets.get(a.data.set) ?? { count: 0, items: [] }
    s.count += 1
    s.items.push({ uuid: a.entry.uuid, name: a.data.name })
    sets.set(a.data.set, s)
  }
  const setBonuses: ActiveSetBonus[] = []
  for (const [id, s] of sets) {
    const set = sheet.content.get('set-bonuses', id)
    if (!set) continue
    const bonuses = (set.bonuses ?? []).filter((b: Rec) => b.threshold <= s.count)
    if (bonuses.length) setBonuses.push({ id, name: set.name ?? id, max: set.max, count: s.count, items: s.items, bonuses })
  }

  const weaponOnly = ['attack-augment', 'adjust-weapon-props', ...sheet.rules.weapons.weaponOnly]
  const sources: MechanicSource[] = [
    ...equippedWeapons.map(w => ({
      path: `weapon/${w.data.id}`,
      mechanics: w.mechanics.filter(m => !weaponOnly.includes(m.type)).map(m => ({ ...m, equipmentId: w.entry.uuid })),
    })),
    ...equippedArmor.filter(a => !a.entry.custom).map(a => ({
      path: `armor/${a.data.id}`,
      mechanics: a.mechanics.map(m => ({ ...m, resource: m.resource ? { ...m.resource, id: a.entry.uuid } : undefined, equipmentId: a.entry.uuid, moreInfo: { equipment: a.entry.uuid } })),
    })),
    ...setBonuses.map(s => ({
      path: `armor-set-bonus/${s.id}`,
      mechanics: s.bonuses.flatMap(b => (b.mechanics ?? []).map((m: Rec) => ({ ...m, setBonusId: `${s.id}-${b.threshold}` }))),
    })),
    {
      path: 'gear',
      mechanics: equippedGear.flatMap(g => g.mechanics.map(m => ({ ...m, resource: m.resource ? { ...m.resource, id: g.entry.uuid } : undefined, equipmentId: g.entry.uuid, moreInfo: { equipment: g.entry.uuid } }))),
    },
  ]
  return { weapons, armor, gear, equippedWeapons, equippedArmor, equippedGear, setBonuses, sources }
}
