/**
 * Text for a power's casting summary (casting time, duration, attack, effect),
 * from the first `casting` entry. Pure functions over an i18n `t`, so the
 * engine's power components and the tests share them.
 */
/**
 * The calls these helpers make to vue-i18n's `t`. Separate overloads like
 * vue-i18n's own, so its `t` can be passed in.
 */
/* eslint-disable @typescript-eslint/unified-signatures */
export interface Translate {
  (key: string): string
  (key: string, plural: number): string
  (key: string, list: unknown[]): string
  (key: string, named: Record<string, unknown>, plural?: number): string
}
/* eslint-enable @typescript-eslint/unified-signatures */

export interface CastingTime { length?: number, unit: string, reaction?: string }
export interface Casting {
  castingTime?: CastingTime
  altCasting?: CastingTime[]
  duration?: { length?: number, unit: string }
  concentration?: boolean
  range?: { short?: number, long?: number, aoe?: { type?: string, size?: number } | false }
  attack?: { type?: string } | false
  dc?: { save?: string } | false
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const SINGLE = ['action', 'reaction', 'attack', 'bonus_action']

/** "{0}, {1}" style lists from the `lists.comma_list` messages. */
export const commaList = (t: Translate, items: string[]) => (items.length ? t(`lists.comma_list[${items.length}]`, items) : t('none'))

/** "1st"–"20th"; 0 is "cantrip". */
export const powerLevel = (t: Translate, level: number) => (level === 0 ? t('cantrip') : t(`ordinal_numbers[${level}]`))

export function castingTimeText(t: Translate, c: Casting): string {
  const times = [c.castingTime, ...(c.altCasting ?? [])].filter((x): x is CastingTime => !!x)
  const parts = times.map(x => (SINGLE.includes(x.unit) ? t(`times.${x.unit}_title`) : t(`times.${x.unit}`, { n: x.length ?? 1 }, x.length ?? 1)))
  return parts.length ? commaList(t, parts) : '-'
}

export function durationText(t: Translate, c: Casting): string {
  if (!c.duration) return '-'
  const { unit, length = 1 } = c.duration
  return t(`times.${unit}`, { n: length }, length)
}

/** The attack and/or save; `abbr` keeps the first and adds "(...)", as list rows do. */
export function attackText(t: Translate, c: Casting, abbr = false): string {
  const parts: string[] = []
  if (c.attack && c.attack.type) parts.push(t(`attack_types.${c.attack.type}`))
  if (c.dc && c.dc.save) parts.push(ABILITIES.includes(c.dc.save) ? t('save_text', { type: t(`abilities.${c.dc.save}.abbr`) }) : c.dc.save)
  if (!parts.length) return '-'
  return abbr ? `${parts[0]}${parts.length > 1 ? ' (...)' : ''}` : commaList(t, parts)
}

/** The effect tags (damage, control…), translated with `tags.*`. */
export function effectText(t: Translate, tags: string[] = [], abbr = false): string {
  if (!tags.length) return abbr ? '-' : t('none')
  const names = tags.map(tag => t(`tags.${tag}`))
  return abbr ? `${names[0]}${names.length > 1 ? ' (...)' : ''}` : commaList(t, names)
}

/** The reaction trigger note ("* - which you take when…") of the first timing that has one. */
export const reactionNote = (c: Casting) => [c.castingTime, ...(c.altCasting ?? [])].find(x => x?.reaction)?.reaction

interface DamageEntry { type?: string, dieCount?: unknown, dieType?: unknown, bonus?: unknown }
/** One row of a power's damage by slot level: a damage type and its roll at each level. */
export interface SlotDamageRow { type: string, rolls: string[] }

/** A roll as the table prints it: dice, plus a flat bonus ("3d10", "2d6 + 5"); formulas it can't print read "—". */
export function rollText(d: DamageEntry): string {
  const dice = typeof d.dieCount === 'number' && typeof d.dieType === 'number' && d.dieCount > 0 ? `${d.dieCount}d${d.dieType}` : ''
  const b = d.bonus as { type?: string, value?: unknown } | undefined
  const flat = b && (!b.type || b.type === 'flat') && typeof b.value === 'number' && b.value ? b.value : 0
  if (typeof d.dieCount === 'object' && d.dieCount) return '—'
  return [dice, flat ? String(flat) : ''].filter(Boolean).join(' + ') || '—'
}

/**
 * A leveled power's damage at each slot level it lists: entry 0 is the power at its own level,
 * each later entry the change at one level higher, merged by damage index (as the sheet merges
 * upcast tiers). Null when there is nothing to tabulate (a cantrip, no damage, no upcast, or the
 * same roll at every level).
 */
export function damageBySlot(power: { level?: number, casting?: unknown[] }, maxLevel = 9): { levels: number[], rows: SlotDamageRow[] } | null {
  const level = power.level ?? 0
  const casting = (power.casting ?? []) as Array<{ damage?: DamageEntry[] }>
  const base = casting[0]?.damage ?? []
  if (level < 1 || casting.length < 2 || !base.length) return null
  const levels: number[] = []
  const perLevel: DamageEntry[][] = []
  for (let i = 0; i < casting.length && level + i <= maxLevel; i++) {
    const tier = i === 0 ? [] : casting[i]?.damage ?? []
    levels.push(level + i)
    perLevel.push(base.map((d, j) => ({ ...d, ...(tier[j] ?? {}) })))
  }
  const rows = base.map((d, j) => ({ type: d.type ?? 'damage', rolls: perLevel.map(entries => rollText(entries[j]!)) }))
    .filter(r => r.rolls.some(x => x !== r.rolls[0]))
  return rows.length && levels.length > 1 ? { levels, rows } : null
}
