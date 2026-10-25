/**
 * Text summaries of core 5e mechanics (`asi`, `asi-choice`, `speed`, `sense`,
 * `resistance`, `immunity`, `skill`...), as species, traits and their options
 * show them. Pure functions over an i18n `t` and a distance formatter, so the
 * engine's mechanic components and the tests share them.
 */
import { commaList, type Translate } from './powers'

/** One mechanic as content stores it (`{ type: 'asi', ability: 'dex', amount: 1 }`). */
export interface ContentMechanic {
  type: string
  [field: string]: unknown
}

/** Formats a distance stored in feet ("9 meters", "30 feet"); `useUnits().distance` in components. */
export type FormatFeet = (feet: number) => string

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const list = (value: unknown): ContentMechanic[] => (Array.isArray(value) ? value.filter((m): m is ContentMechanic => typeof (m as ContentMechanic)?.type === 'string') : [])

/** The mechanics of the given types, in content order. */
export const mechanicsOfType = (mechanics: unknown, ...types: string[]) => list(mechanics).filter(m => types.includes(m.type))

const many = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : [value].flat() as T[])
const number = (t: Translate, n: number) => (n >= 0 && n < 10 ? t(`string_numbers[${n}]`) : String(n))
const orList = (t: Translate, items: string[]) => t(`lists.or_list[${items.length}]`, items)
const andList = (t: Translate, items: string[]) => t(`lists.and_list[${items.length}]`, items)
const abilityName = (t: Translate, ability: string) => t(`abilities.${ability}.title`)
const withNote = (text: string, note: unknown) => (typeof note === 'string' && note ? `${text} (${note})` : text)

/**
 * Ability score increases: fixed ones ("+2 Charisma, +1 Constitution", or
 * "+1 to all ability scores") then choices ("+1 to your choice of Strength or
 * Dexterity", "+1 to two different ability scores of your choice"). Increases
 * to the same ability add up (a subspecies' and its species'). Empty when
 * there are none.
 */
export function summarizeAsi(t: Translate, mechanics: unknown): string {
  const fixed = new Map<string, number>()
  for (const m of mechanicsOfType(mechanics, 'asi')) fixed.set(String(m.ability), (fixed.get(String(m.ability)) ?? 0) + Number(m.amount ?? 1))
  const allOnes = fixed.size === 6 && ABILITIES.every(a => fixed.get(a) === 1)
  const parts = allOnes
    ? [t('ability_bonus_all')]
    : [...fixed].map(([ability, amount]) => `${amount < 0 ? '' : '+'}${amount} ${abilityName(t, ability)}`)
  for (const m of mechanicsOfType(mechanics, 'asi-choice')) {
    const count = Number(m.selections ?? 1)
    // `total` points spread `max` per ability, or `amount` to each pick.
    const amount = Number(m.max ?? m.amount ?? (m.total ? Number(m.total) / count : 1))
    const limit = many(m.limit as string | string[] | undefined).filter(a => ABILITIES.includes(a))
    if (limit.length) {
      const names = limit.map(a => abilityName(t, a))
      parts.push(t('mechanics.asi_choice_limit', { amount, number: number(t, count), abilities: count === 1 ? orList(t, names) : andList(t, names) }, count))
    }
    else {
      parts.push(t('mechanics.asi_choice_any', { amount, number: number(t, count) }, count))
    }
  }
  return parts.length ? commaList(t, parts) : ''
}

/** Whether two records give the same ability score increases (fixed and choices), in any order. */
export function sameAsi(a: unknown, b: unknown): boolean {
  const key = (m: ContentMechanic) => [m.type, m.ability ?? '', m.amount ?? '', many(m.limit as string[] | undefined).toSorted().join('+'), m.selections ?? '', m.max ?? '', m.total ?? ''].join('|')
  const keys = (mechanics: unknown) => list(mechanics).filter(m => m.type.startsWith('asi')).map(key).toSorted()
  return keys(a).join(',') === keys(b).join(',')
}

/** Whether two records have the same speeds (kind and distance), in any order. */
export function sameSpeeds(a: unknown, b: unknown): boolean {
  const keys = (mechanics: unknown) => mechanicsOfType(mechanics, 'speed').map(m => `${m.speed}:${m.distance}`).toSorted()
  return keys(a).join(',') === keys(b).join(',')
}

/**
 * Speeds. As sentences, the species trait ("Your base walking speed is 9
 * meters."), or short ("Flying 9 meters (note)") for summaries. Speed notes
 * without a distance (`speed-note`) follow as they are.
 */
export function summarizeSpeeds(t: Translate, mechanics: unknown, distance: FormatFeet, sentences = false): string[] {
  const speeds = mechanicsOfType(mechanics, 'speed').map((m) => {
    const kind = String(m.speed)
    const length = distance(Number(m.distance ?? 0))
    if (!sentences) return withNote(`${t(`speeds.${kind}.title`)} ${length}`, m.note)
    const values = { type: t(`speeds.${kind}.text`), distance: length, note: m.note }
    return m.note ? t('mechanics.speed_note', values) : t('speed_trait', values)
  })
  return [...speeds, ...mechanicsOfType(mechanics, 'speed-note').map(m => String(m.note ?? ''))].filter(Boolean)
}

/** Senses: "darkvision 18 m", "truesight (when you take the Search action…)". */
export function summarizeSenses(t: Translate, mechanics: unknown, distance: FormatFeet): string[] {
  return mechanicsOfType(mechanics, 'sense').map((m) => {
    const names = many(m.sense as string | string[]).map(s => t(`senses.${s.replaceAll('-', '_')}`))
    const text = commaList(t, names)
    return withNote(m.distance === undefined ? text : `${text} ${distance(Number(m.distance))}`, m.note)
  })
}

/** Damage resistances, with falling damage when a `fall-damage` mechanic halves it. */
export function summarizeResistances(t: Translate, mechanics: unknown): string[] {
  return mechanicsOfType(mechanics, 'resistance', 'fall-damage')
    .filter(m => m.type === 'resistance' || m.resistance === true)
    .map(m => withNote(m.type === 'fall-damage' ? t('mechanics.falling_damage') : String(m.label ?? t(`damage_types.${m.value}`)), m.note))
}

/** Damage and condition immunities. Conditions show their id ("poisoned"), as the `:condition` prose component does. */
export function summarizeImmunities(t: Translate, mechanics: unknown): string[] {
  return mechanicsOfType(mechanics, 'immunity', 'condition-immunity').map((m) => {
    const name = m.type === 'condition-immunity'
      ? String(m.value)
      : String(m.label ?? (m.value ? t(`damage_types.${m.value}`) : m.id ?? ''))
    return withNote(name, m.note)
  })
}

/**
 * Skill proficiencies: fixed ones by name, choices as "Perception or Insight"
 * or "two skills of your choice". `name` turns a skill id into its name.
 */
export function summarizeSkills(t: Translate, mechanics: unknown, name: (id: string) => string): string[] {
  return mechanicsOfType(mechanics, 'skill', 'skill-choice').map((m) => {
    const count = Number(m.selections ?? 1)
    if (m.type === 'skill' && typeof m.value === 'string') return `${name(m.value)}${m.expertise ? ` (${t('mechanics.expertise')})` : ''}`
    const limit = many(m.limit as string | string[] | undefined)
    if (!limit.length) return t('mechanics.skill_choice_any', { number: number(t, count) }, count)
    const names = limit.map(name)
    return count === 1 ? orList(t, names) : t('mechanics.skill_choice_limit', { number: number(t, count), skills: andList(t, names) })
  })
}

export interface MechanicSummaryLine {
  /** Which summary: `asi`, `speeds`, `senses`, `resistances`, `immunities`, `skills`. */
  key: string
  /** i18n key of its label. */
  label: string
  text: string
}

/**
 * Everything the summaries above say about a list of mechanics, one line per
 * kind that has something, in a fixed order. Lists are comma-separated.
 */
export function summarizeMechanics(t: Translate, mechanics: unknown, distance: FormatFeet, skillName: (id: string) => string = id => id): MechanicSummaryLine[] {
  const lines: MechanicSummaryLine[] = [
    { key: 'asi', label: 'ability_score_increase_title', text: summarizeAsi(t, mechanics) },
    { key: 'speeds', label: 'speed_title', text: joined(t, summarizeSpeeds(t, mechanics, distance)) },
    { key: 'senses', label: 'senses_title', text: joined(t, summarizeSenses(t, mechanics, distance)) },
    { key: 'resistances', label: 'npc.damage_resistances', text: joined(t, summarizeResistances(t, mechanics)) },
    { key: 'immunities', label: 'mechanics.immunities_title', text: joined(t, summarizeImmunities(t, mechanics)) },
    { key: 'skills', label: 'skills_title', text: joined(t, summarizeSkills(t, mechanics, skillName)) },
  ]
  return lines.filter(l => l.text)
}

const joined = (t: Translate, items: string[]) => (items.length ? commaList(t, items) : '')
