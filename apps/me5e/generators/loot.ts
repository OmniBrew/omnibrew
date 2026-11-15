import { LOOT_ITEM_KINDS } from './loot-schema'
import { pick, rollDice, rollDie, type Random } from './random'

/**
 * The loot generator (the live /generators/loot): credits for one creature, or a hoard
 * (credits, then a d100 roll that sends you to the equipment tables A to H), by challenge
 * rating band. The tables are content (`loot-rewards`, `loot-tables`; see loot-schema.ts).
 *
 * Fixed from the live page: gear is matched on the data's real values (`grenade`,
 * `varies`, `omni_gel`...), so grenades and other "varies" gear come in at each mark's
 * rarity (their `subsets`) and tools, ammo, omni-gel and medi-gel stay out; rarities are
 * `very_rare` as in the data, and a rarity with no items logs that instead of failing;
 * consumables (medi-gel of each grade too) are counted, with their bonus added.
 *
 * Text is returned as message keys (`LootMsg`), translated by `lootText`.
 */
type Rec = Record<string, unknown>
export type LootKind = typeof LOOT_ITEM_KINDS[number]

export type LootMsg = { key: string, params?: Record<string, unknown> } | { text: string }

export interface ItemRow { min: number, max: number, item: LootKind, rarity: string }
export interface ConsumableRow { min: number, max: number, consumable: string, count: string, bonus?: number }
export type TableRow = ItemRow | ConsumableRow
export interface HoardRow { min: number, max: number, table?: string, times?: number | string }

export interface LootTable { id: string, name: string, rows: TableRow[] }
export interface LootReward {
  id: string
  name: string
  order: number
  individual: number[]
  hoard: { credits: number, additionalCredits: number[], rolls: HoardRow[] }
}

/** Something the loot can hold: an item or a consumable, named, with the record whose page shows it. */
export interface LootItem { id: string, name: string, rarity?: string, kind: LootKind, page: string }

export interface LootData {
  rewards: LootReward[]
  tables: Record<string, LootTable>
  items: Record<LootKind, LootItem[]>
  /** Gear and gear subsets by id: their name and page (the gear record). */
  gear: Record<string, { name: string, page: string }>
}

export interface LootResult {
  band: string
  hoard: boolean
  credits: number
  consumables: { id: string, name: string, page?: string, count: number }[]
  items: Record<LootKind, LootItem[]>
  log: { text: LootMsg, result: LootMsg }[]
}

/** Gear types that are never loot items: tools and ammo, and the consumables the tables count. */
export const EXCLUDED_GEAR_TYPES = ['tool', 'omni_gel', 'medi_gel', 'ammo']

const records = (all: Map<string, Map<string, Rec>>, collection: string) => [...(all.get(collection)?.values() ?? [])]

/** The generator's data from the rules bundle's records. */
export function lootData(all: Map<string, Map<string, Rec>>): LootData {
  const items = Object.fromEntries(LOOT_ITEM_KINDS.map(k => [k, [] as LootItem[]])) as Record<LootKind, LootItem[]>
  const gear: LootData['gear'] = {}
  for (const kind of LOOT_ITEM_KINDS) {
    for (const r of records(all, kind)) {
      const id = String(r.id)
      const name = String(r.name ?? id)
      const subsets = Array.isArray(r.subsets) ? r.subsets as Rec[] : []
      if (kind === 'gear') {
        gear[id] = { name, page: id }
        for (const s of subsets) gear[String(s.id)] = { name: String(s.name ?? s.id), page: id }
        if (EXCLUDED_GEAR_TYPES.includes(String(r.gearType))) continue
      }
      // "Varies" items come in at each version's rarity.
      if (r.rarity === 'varies') {
        for (const s of subsets) if (typeof s.rarity === 'string') items[kind].push({ id: String(s.id), name: String(s.name ?? s.id), rarity: s.rarity, kind, page: id })
      }
      else if (typeof r.rarity === 'string') items[kind].push({ id, name, rarity: r.rarity, kind, page: id })
    }
    items[kind].sort((a, b) => a.name.localeCompare(b.name))
  }
  const tables = Object.fromEntries(records(all, 'loot-tables').map(r => [String(r.id), r as unknown as LootTable]))
  const rewards = records(all, 'loot-rewards').map(r => r as unknown as LootReward).sort((a, b) => a.order - b.order)
  return { rewards, tables, items, gear }
}

const isItemRow = (row: TableRow): row is ItemRow => 'item' in row

/** "1d4 + 2" */
const diceText = (count: string, bonus?: number) => (bonus ? `${count} + ${bonus}` : count)

/** What an equipment table row gives: "1 rare weapon", "1d6 + 2 Standard Medi-gel". */
export function tableRowText(data: LootData, row: TableRow): LootMsg {
  if (isItemRow(row)) return { key: 'loot.row_item', params: { rarity: { key: `rarities.${row.rarity}` }, kind: { key: `loot.kinds.${row.item}` } } }
  return { key: 'loot.row_consumable', params: { dice: diceText(row.count, row.bonus), name: data.gear[row.consumable]?.name ?? row.consumable } }
}

/** What a hoard's d100 row does: nothing more, or rolls on a table. */
export function hoardRowText(data: LootData, row: HoardRow): LootMsg {
  if (!row.table) return { key: 'loot.nothing' }
  const table = data.tables[row.table]?.name ?? row.table
  if (row.times === undefined || row.times === 1) return { key: 'loot.roll_once', params: { table } }
  return { key: 'loot.roll_times', params: { times: row.times, table } }
}

/** "1-15", or "100". */
export const rangeText = (row: { min: number, max: number }) => (row.min === row.max ? String(row.min) : `${row.min}-${row.max}`)

const findRow = <T extends { min: number, max: number }>(rows: T[], roll: number) => rows.find(r => r.min <= roll && r.max >= roll)

/** Rolls loot for a band (`loot-rewards` id): one creature's credits, or a hoard. */
export function rollLoot(data: LootData, options: { band: string, hoard: boolean }, random: Random): LootResult {
  const band = data.rewards.find(r => r.id === options.band)
  const result: LootResult = {
    band: options.band,
    hoard: options.hoard,
    credits: 0,
    consumables: [],
    items: Object.fromEntries(LOOT_ITEM_KINDS.map(k => [k, []])) as unknown as Record<LootKind, LootItem[]>,
    log: [],
  }
  if (!band) return result
  const log = (text: LootMsg, outcome: LootMsg) => result.log.push({ text, result: outcome })
  const randomCredits = (list: number[]) => {
    const credits = pick(random, list) ?? 0
    log({ key: 'loot.log.random_credits', params: { min: Math.min(...list), max: Math.max(...list) } }, { key: 'loot.log.credits', params: { n: credits } })
    result.credits += credits
  }

  if (!options.hoard) {
    randomCredits(band.individual)
    return result
  }

  result.credits += band.hoard.credits
  log({ key: 'loot.log.base_credits' }, { key: 'loot.log.credits', params: { n: band.hoard.credits } })
  randomCredits(band.hoard.additionalCredits)

  const hoardRoll = rollDie(random, 100)
  const row = findRow(band.hoard.rolls, hoardRoll)
  log({ key: 'loot.log.hoard_roll' }, { key: 'loot.log.roll_result', params: { roll: hoardRoll, text: row ? hoardRowText(data, row) : { key: 'loot.log.no_row' } } })
  if (!row?.table) return result
  const table = data.tables[row.table]
  if (!table) {
    log({ key: 'loot.log.missing_table', params: { table: row.table } }, { text: '' })
    return result
  }

  let times = 1
  if (typeof row.times === 'number') times = row.times
  else if (typeof row.times === 'string') {
    times = rollDice(random, row.times).reduce((a, b) => a + b, 0)
    log({ key: 'loot.log.times_roll', params: { dice: row.times } }, { text: String(times) })
  }

  for (let i = 1; i <= times; i++) {
    const roll = rollDie(random, 100)
    const reward = findRow(table.rows, roll)
    log({ key: 'loot.log.table_roll', params: { n: i, table: table.name } }, { key: 'loot.log.roll_result', params: { roll, text: reward ? tableRowText(data, reward) : { key: 'loot.log.no_row' } } })
    if (!reward) continue
    if (isItemRow(reward)) {
      const item = pick(random, data.items[reward.item].filter(it => it.rarity === reward.rarity))
      const what = { rarity: { key: `rarities.${reward.rarity}` }, kind: { key: `loot.kinds.${reward.item}` } }
      if (item) result.items[reward.item].push(item)
      log({ key: 'loot.log.item_roll', params: what }, item ? { text: item.name } : { key: 'loot.log.item_none', params: what })
    }
    else {
      const rolls = rollDice(random, reward.count)
      const count = rolls.reduce((a, b) => a + b, 0) + (reward.bonus ?? 0)
      const gear = data.gear[reward.consumable]
      const name = gear?.name ?? reward.consumable
      const existing = result.consumables.find(c => c.id === reward.consumable)
      if (existing) existing.count += count
      else result.consumables.push({ id: reward.consumable, name, page: gear?.page, count })
      log(
        { key: 'loot.log.consumable_roll', params: { dice: diceText(reward.count, reward.bonus) } },
        { key: 'loot.log.consumable_result', params: { rolls: [...rolls, ...(reward.bonus ? [reward.bonus] : [])].join(' + '), n: count, name } },
      )
    }
  }
  return result
}

type Translate = (key: string, params?: Record<string, unknown>) => string

/** 120000 → "120,000". */
export const groupDigits = (n: number, separator: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separator)

/** A message as text: nested messages are translated first, numbers grouped ("1,000"). */
export function lootText(t: Translate, msg: LootMsg): string {
  if ('text' in msg) return msg.text
  if (!msg.params) return t(msg.key)
  const params = Object.fromEntries(Object.entries(msg.params).map(([k, v]) => [
    k,
    v && typeof v === 'object' && ('key' in v || 'text' in v) ? lootText(t, v as LootMsg) : typeof v === 'number' && v >= 1000 ? groupDigits(v, t('digit_separator')) : v,
  ]))
  return t(msg.key, params)
}
