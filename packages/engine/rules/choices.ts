import type { Character, ChoiceValue } from '../character/schema'
import type { OfferedChoice } from './collect'
import type { Sheet } from './sheet'
import type { Rec } from './types'

/**
 * The builder's choices (the live MeCbChoices* pickers): what each offered choice
 * lets the player pick, how many, and whether picks are missing. Pure, so the builder
 * only renders them; every pick is stored with `setChoice` under the choice's path.
 */
export interface ChoiceItem {
  /** A record or skill id, an ability, or a power advancement. */
  value: ChoiceValue
  label: string
  /** Picked elsewhere already (a model picked by another choice), or not allowed now. */
  disabled?: boolean
  /** A group heading (tool types). */
  group?: string
}

export type ChoiceKind = 'pick' | 'asi' | 'hidden'

export interface ChoiceView {
  point: OfferedChoice
  kind: ChoiceKind
  /** Picks wanted (ability points for `asi`). */
  needed: number
  picked: ChoiceValue[]
  /** Picks still missing (0: done). */
  missing: number
  items: ChoiceItem[]
  /** ASI: abilities offered, and the most one ability may take. */
  abilities?: string[]
  max?: number
  label?: string
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const toList = (limit: unknown): string[] | null => (limit === undefined || limit === null ? null : Array.isArray(limit) ? limit.map(String) : [String(limit)])

/** Whether a record passes a model-choice's `limits` (`[{ attr, value }]`, as the live filter). */
export function passesLimits(record: Rec, limits: Array<{ attr: string, value: unknown }> | undefined) {
  if (!limits?.length) return true
  return limits.every(({ attr, value }) => {
    const wanted = Array.isArray(value) ? value : [value]
    const have = record[attr]
    return Array.isArray(have) ? have.some(v => wanted.includes(v)) : wanted.includes(have)
  })
}

function items(sheet: Sheet, point: OfferedChoice, labels: { weapon: (id: string) => string, ability: (id: string) => string }): ChoiceItem[] {
  const m = point.mechanic
  const limit = toList(m.limit)
  const filter = (list: ChoiceItem[]) => (limit ? list.filter(i => limit.includes(String(i.value)) || (i.group && limit.includes(i.group))) : list)
  switch (point.key) {
    case 'skill':
    case 'expertise': {
      const all = sheet.content.list('skills').map(s => ({ value: s.id as string, label: s.name as string }))
      if (point.key === 'expertise' && m.limit === 'acquired') return all.filter(i => sheet.profs.skill.includes(i.value))
      if (m.newIf) {
        const has = sheet.profs.skill.includes(m.newIf) && !(point.choice?.values ?? []).includes(m.newIf)
        return has ? all.filter(i => i.value !== m.newIf) : all.filter(i => i.value === m.newIf)
      }
      return filter(all)
    }
    case 'tool':
      return filter(sheet.content.list('tool-profs').map(r => ({ value: r.id as string, label: r.name as string, group: r.type as string | undefined })))
    case 'weapon':
      return filter((sheet.enums.values.weaponTypes ?? []).map(w => ({ value: w, label: labels.weapon(w) })))
    case 'powercasting':
      return (toList(m.mod) ?? ABILITIES).map(a => ({ value: a, label: labels.ability(a) }))
    case 'advancements': {
      let ids: string[] = []
      if (m.limit?.value) ids = toList(m.limit.value) ?? []
      else if (m.limit?.valueLookup) ids = sheet.valueLookup(m.limit.valueLookup).filter((v): v is string => typeof v === 'string')
      return ids.flatMap((id) => {
        const power = sheet.content.get('powers', id)
        return ((power?.advancements ?? []) as Rec[]).map(a => ({ value: { power: id, advancement: a.id as string }, label: `${power!.name}: ${a.name}` }))
      })
    }
    default: {
      if (m.type !== 'model-choice') return []
      let records = sheet.content.list(point.key).filter(r => passesLimits(r, m.limits))
      if (point.key === 'powers' && m.known) {
        const known = sheet.character.powers.map(p => p.id)
        records = records.filter(r => known.includes(r.id))
      }
      // A record picked by another choice of the same model can't be picked twice (unless `isolated`).
      const elsewhere = m.isolated
        ? new Set<string>()
        : new Set(sheet.offeredChoices.filter(o => o.key === point.key && o.path !== point.path).flatMap(o => o.choice?.values ?? []).filter((v): v is string => typeof v === 'string'))
      return records.map(r => ({ value: r.id as string, label: r.name as string, ...(elsewhere.has(r.id) ? { disabled: true } : {}) }))
    }
  }
}

/** What one offered choice shows in the builder. */
export function choiceView(sheet: Sheet, point: OfferedChoice, labels: { weapon: (id: string) => string, ability: (id: string) => string }): ChoiceView {
  const m = point.mechanic
  const picked = point.choice?.values ?? []
  if (m.hide || point.key === 'prof') return { point, kind: 'hidden', needed: 0, picked, missing: 0, items: [] }
  if (point.key === 'asi') {
    const total = Number(m.total) || Number(m.selections) || 1
    const used = picked.reduce((a, v) => a + (typeof v === 'object' && 'amount' in v ? v.amount : 0), 0)
    // An ASI choice without amounts is the class feature: +2 to one ability or +1 to two.
    const asiFeature = !m.total && !m.selections && !m.max
    const needed = asiFeature ? 2 : total
    return {
      point, kind: 'asi', needed, picked, missing: Math.max(0, needed - used), items: [],
      abilities: toList(m.limit) ?? ABILITIES,
      max: asiFeature ? 2 : Number(m.max) || 1,
      label: m.label,
    }
  }
  const needed = m.set ? (m.set as string[]).length : Number(m.selections) || 1
  return { point, kind: 'pick', needed, picked, missing: Math.max(0, needed - picked.length), items: items(sheet, point, labels), label: m.label }
}

/** Offered choices whose path starts with one of `prefixes` (a builder step: `species/`, `class/`...). */
export function choicesUnder(sheet: Sheet, prefixes: string[]) {
  return sheet.offeredChoices.filter(o => prefixes.some(p => o.path.startsWith(p)))
}

/** Replaces the picks of one choice (no picks: the choice is removed). */
export function setChoice(character: Character, path: string, values: ChoiceValue[]): Character {
  const next = JSON.parse(JSON.stringify(character)) as Character
  next.choices = next.choices.filter(c => c.path !== path)
  if (values.length) next.choices.push({ path, values })
  return next
}

/** Removes stale picks (`sheet.unusedChoices`) by path. */
export function removeChoices(character: Character, paths: string[]): Character {
  const next = JSON.parse(JSON.stringify(character)) as Character
  next.choices = next.choices.filter(c => !paths.includes(c.path))
  return next
}

/** Toggles an ASI pick: +1 to the ability (up to `max`), then off again (the live chip). */
export function toggleAsi(view: ChoiceView, ability: string): ChoiceValue[] {
  const current = view.picked.filter((v): v is { ability: string, amount: number } => typeof v === 'object' && 'ability' in v)
  const total = current.reduce((a, v) => a + v.amount, 0)
  const mine = current.find(v => v.ability === ability)
  if (!mine) return total < view.needed ? [...current, { ability, amount: 1 }] : current
  if (total + 1 <= view.needed && mine.amount < (view.max ?? 1)) return current.map(v => (v === mine ? { ...v, amount: v.amount + 1 } : v))
  return current.filter(v => v !== mine)
}
