/**
 * Text for item and vehicle stats: cost, damage dice, range, weight, property
 * values, tags, the rarity-and-type subtitle and filter options. Pure functions
 * over an i18n `t` and the reader's unit formatters (`useUnits`), so the
 * engine's item components, game pages and the tests share them.
 */
import type { Translate } from './powers'

/** A damage roll as items store it: `{ dieCount: 2, dieType: 6, type: 'piercing' }`. */
export interface ItemDamage {
  dieCount?: unknown
  dieType?: unknown
  type?: string
  bonus?: unknown
}

/** A weapon's range in feet: `{ short: 60, long: 180 }`. */
export interface ItemRangeValue {
  short?: number
  long?: number
}

/** A property reference: `{ id: 'reload', value: 16 }`, `{ id: 'versatile', value: { dieCount: 1, dieType: 10 } }`. */
export interface ItemProperty {
  id: string
  value?: number | string | ItemDamage | ItemRangeValue
}

/** `useUnits().distance` / `.weight`: formats feet or pounds in the reader's units. */
export type MeasureFormat = (value: number, opts: { abbr?: boolean, numOnly?: boolean }) => string

/** Content fields Nuxt Content returns as `null` when a record leaves them out. */
type Opt<T> = T | null | undefined

const group = (n: number, separator: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separator)
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "13,500"; 0 or no cost is "-"; a word ("varies", "military") is capitalized. */
export function itemCost(cost: Opt<number | string>, separator = ','): string {
  if (typeof cost === 'string') return cost ? capitalize(cost) : '-'
  return cost ? group(cost, separator) : '-'
}

/** "13,500 credits", or the cost word ("Varies"). */
export function itemCredits(t: Translate, cost: Opt<number | string>, separator = ','): string {
  return typeof cost === 'number' && cost > 0 ? t('credits', { n: group(cost, separator) }, cost) : itemCost(cost, separator)
}

/** Sort value of a cost: the number, or undefined (sorted last) for words. */
export const itemCostValue = (cost: Opt<number | string>) => (typeof cost === 'number' ? cost : undefined)

const BONUS_KINDS = ['flat']

/** "2d6"; a die count or type that is a formula shows as "X", a flat bonus as "1d4 + 2". */
export function itemDice(t: Translate, damage: ItemDamage): string {
  const count = typeof damage.dieCount === 'number' ? damage.dieCount : 'X'
  const type = typeof damage.dieType === 'number' ? damage.dieType : damage.dieType === false ? undefined : 'X'
  const bonus = damage.bonus as Opt<{ type?: string, value?: unknown }>
  const flat = bonus && BONUS_KINDS.includes(bonus.type ?? '') && typeof bonus.value === 'number' ? bonus.value : undefined
  if (type === undefined) return String(flat ?? 0)
  const dice = t('dice', { dieCount: count, dieType: type })
  if (!flat) return dice
  return flat > 0 ? t('dice_formulas.plus', { dice, n: flat }) : t('dice_formulas.minus', { dice, n: -flat })
}

/** "2d6 piercing", plus any extra damage: "1d6 bludgeoning + 1d4 lightning". */
export function itemDamage(t: Translate, damage: Opt<ItemDamage>, additional?: Opt<ItemDamage[]>): string {
  if (!damage) return '-'
  return [damage, ...(additional ?? [])]
    .map(d => [itemDice(t, d), d.type ? t(`damage_types.${d.type}`) : ''].filter(Boolean).join(' '))
    .join(' + ')
}

/** Average roll of the damage dice (sorts the damage column). */
export function itemDamageAverage(damage: Opt<ItemDamage>): number {
  const count = typeof damage?.dieCount === 'number' ? damage.dieCount : 0
  const type = typeof damage?.dieType === 'number' ? damage.dieType : 0
  return count * (type + 1) / 2
}

/** "24/72m" for short/long range, "2m" for reach only. */
export function itemRange(range: Opt<ItemRangeValue>, distance: MeasureFormat): string {
  if (typeof range?.short !== 'number') return '-'
  if (!range.long) return distance(range.short, { abbr: true })
  return `${distance(range.short, { numOnly: true })}/${distance(range.long, { abbr: true })}`
}

/** "8kg"; no weight is "-", and a weight that rounds to nothing "<1kg". */
export function itemWeight(pounds: Opt<number>, weight: MeasureFormat): string {
  if (!pounds) return '-'
  const text = weight(pounds, { abbr: true })
  return /^\d/.test(text) ? text : `<1${text}`
}

/** The ids of an item's properties, without the ones the game shows elsewhere (`hide`). */
export const itemPropertyIds = (properties: Opt<ItemProperty[]>, hide: string[] = []) =>
  (properties ?? []).map(p => p.id).filter(id => !hide.includes(id))

/** The value of the property `id`, if the item has it. */
export const itemPropertyValue = (properties: Opt<ItemProperty[]>, id: string) => properties?.find(p => p.id === id)?.value

/** A property value as text: "16", "1d10" (versatile damage), "30/120m" (a range). */
export function itemPropertyValueText(t: Translate, value: Opt<ItemProperty['value']>, distance: MeasureFormat): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'object') return String(value)
  if ('dieCount' in value || 'dieType' in value) return itemDice(t, value as ItemDamage)
  return itemRange(value as ItemRangeValue, distance)
}

/** "Versatile (1d10)", or the name alone when the property has no value. */
export function itemPropertyText(t: Translate, name: string, value: Opt<ItemProperty['value']>, distance: MeasureFormat): string {
  const text = itemPropertyValueText(t, value, distance)
  return text === undefined ? name : `${name} (${text})`
}

/** The item's tags as a list ("Shield Capacity, Set Bonus"), or "-". */
export function itemTags(t: Translate, tags: Opt<string[]>): string {
  if (!tags?.length) return '-'
  return t(`lists.comma_list[${tags.length}]`, tags.map(tag => t(`tags.${tag}`)))
}

const rarityText = (t: Translate, rarity: Opt<string>) => (rarity ? t(`rarities.${rarity}`) : '')

/** "Uncommon Heavy Pistol". */
export function weaponSubtitle(t: Translate, weapon: { rarity?: Opt<string>, weaponType?: Opt<string> }): string {
  return t('weapon_item_subtitle', { rarity: rarityText(t, weapon.rarity), weaponType: t(`weapon_types.${weapon.weaponType}`, 1) }).trim()
}

/** Where armor goes: a suit covers the body (`body_armor`), a piece its slot. */
export const armorPlacement = (armor: { coverage?: Opt<string>, slot?: Opt<string> }) => (armor.coverage === 'piece' ? armor.slot ?? '' : 'body_armor')

/** "Rare medium armor, arms". */
export function armorSubtitle(t: Translate, armor: { rarity?: Opt<string>, armorType?: Opt<string>, coverage?: Opt<string>, slot?: Opt<string> }): string {
  return t('armor_item_subtitle', {
    rarity: rarityText(t, armor.rarity),
    armorType: t(`armor_types.${armor.armorType}_armor`),
    placement: t(`armor_placements.${armorPlacement(armor)}`),
  }).trim()
}

/** "Tool (Gaming Set)": the gear type and its sub-type. */
export function gearTypeText(t: Translate, gear: { gearType?: Opt<string>, subType?: Opt<string> }): string {
  const type = t(`gear_types.${gear.gearType}`)
  return gear.subType ? `${type} (${t(`gear_types.${gear.subType}`)})` : type
}

/** "Spectre Heavy Weapon". */
export const gearSubtitle = (t: Translate, gear: { rarity?: Opt<string>, gearType?: Opt<string>, subType?: Opt<string> }) =>
  `${rarityText(t, gear.rarity)} ${gearTypeText(t, gear)}`.trim()

/** "Huge Transport (air or space)". */
export function vehicleSubtitle(t: Translate, vehicle: { size?: Opt<string>, type?: Opt<string>, subtype?: Opt<string> }): string {
  const size = vehicle.size ? capitalize(t(`sizes.${vehicle.size}`)) : ''
  const type = vehicle.type ? t(`vehicle_types.${vehicle.type}`) : ''
  return [size, type, vehicle.subtype ? `(${vehicle.subtype})` : ''].filter(Boolean).join(' ')
}

/** A vehicle system's crew line: "Helm: 1 crew", "Combined, Helm / Weapons: 1 crew". */
export function vehicleSystem(t: Translate, system: { type: string, crew: number | string, systems?: Opt<string[]> }): { label: string, crew: string } {
  const label = system.systems?.length ? `${t('vehicles.combined')}, ${system.systems.join(' / ')}` : system.type
  return { label, crew: t('vehicles.system_crew', { n: system.crew }) }
}

/** "min: 2, max: 8". */
export const vehicleCrew = (t: Translate, crew: { min: number, max: number | string }) => t('vehicles.crew_range', { min: crew.min, max: crew.max })

/** "4 tonnes"; a count like "100+" is plural. */
export const vehicleCargo = (t: Translate, cargo: number | string) =>
  t('vehicles.cargo_tonnes', { n: cargo }, typeof cargo === 'number' ? cargo : 2)
