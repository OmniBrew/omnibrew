/**
 * A class page's data: the class table (one row per character level, with the
 * features gained and the columns the class's features bring) and the class and
 * subclass feature lists. Pure functions over the class's `progression`, the
 * character progression rows and the class's features, shared by the klass
 * components and the tests (test/progression.test.ts).
 */
import { recordId } from '../../shared/utils/records'
import type { Translate } from './powers'

export interface ClassProgression {
  /** Levels that gain a subclass feature. */
  subclass: number[]
  /** Levels that gain an ability score increase. */
  abi: number[]
}

/** The fields of a class feature record these helpers read. */
export interface ClassFeatureLike {
  stem?: string
  name?: string
  level?: number
  subclass?: string
  noFeatureDisplay?: boolean
  mechanics?: Record<string, unknown>[]
}

/**
 * A class table column a mechanic brings: one of its fields, an array with a
 * value per character level (for a `group`, a record or array of such arrays by
 * power level).
 */
export interface MechanicColumn {
  field: string
  /** Message key of the heading. */
  label: string
  /** The heading when the key has no message. */
  text?: string
  /** A field of the mechanic that, when set, names the column instead (`columnName`). */
  labelField?: string
  /**
   * Where the column goes. Features is at 5; the core columns are cantrips at
   * 14, powers known, points and pact slots at 20, power slots by power level
   * last. Equal orders keep the class features' order.
   */
  order: number
  /** Show 0 as "-". */
  blankZero?: boolean
  /** One column per power level, under this heading. */
  group?: boolean
}

/** The columns one mechanic type brings to the class table. */
export interface MechanicColumns {
  type: string
  columns: MechanicColumn[]
}

const KNOWN: MechanicColumn = { field: 'known', label: 'class_feature_columns.powers_known', text: 'Powers Known', order: 20 }

/**
 * The core power system's columns. A game adds its own mechanics' columns, and
 * renames these (ME5e's "Tech Points"), with `mergeMechanicColumns`.
 */
export const CORE_MECHANIC_COLUMNS: MechanicColumns[] = [
  { type: 'cantrips', columns: [{ field: 'known', label: 'class_feature_columns.cantrips', text: 'Cantrips', labelField: 'columnName', order: 14, blankZero: true }] },
  { type: 'powercasting-slots', columns: [
    KNOWN,
    { field: 'slots', label: 'class_feature_columns.power_slots_by_power_level', text: 'Power Slots by Power Level', order: Infinity, group: true, blankZero: true },
  ] },
  { type: 'powercasting-points', columns: [
    KNOWN,
    { field: 'points', label: 'class_feature_columns.points', text: 'Points', order: 20 },
    { field: 'limit', label: 'class_feature_columns.point_limit', text: 'Point Limit', order: 20 },
  ] },
  { type: 'powercasting-pact', columns: [
    KNOWN,
    { field: 'numSlots', label: 'class_feature_columns.power_slots', text: 'Power Slots', order: 20 },
    { field: 'slotLevel', label: 'class_feature_columns.power_level', text: 'Power Level', order: 20 },
  ] },
]

/** `extra` merged into `base` by mechanic type: a column for the same field replaces the base one, others are added. */
export function mergeMechanicColumns(base: MechanicColumns[], extra: MechanicColumns[] = []): MechanicColumns[] {
  const merged = new Map(base.map(m => [m.type, m.columns]))
  for (const m of extra) {
    const columns = [...(merged.get(m.type) ?? [])]
    for (const c of m.columns) {
      const i = columns.findIndex(x => x.field === c.field)
      if (i >= 0) columns[i] = c
      else columns.push(c)
    }
    merged.set(m.type, columns)
  }
  return [...merged].map(([type, columns]) => ({ type, columns }))
}

export interface ClassTableColumn {
  /** `level`, `profBonus`, `features`, or a unique key for a value column. */
  key: string
  kind: 'level' | 'profBonus' | 'features' | 'value'
  /** Message key of the heading; a group's columns carry the group's. */
  label: string
  /** The heading when the key has no message. */
  text?: string
  /** The key of the group the column is in, and its position there from 1 (the power level). */
  group?: string
  sub?: number
  /** Values by character level (index 0 is level 1). */
  values?: unknown[]
  blankZero?: boolean
}

export interface ClassTableHeaderCell {
  key: string
  label: string
  text?: string
  colspan: number
  rowspan: number
  /** A group's heading, spanning its columns. */
  group: boolean
}

export interface ClassTableRow {
  level: number
  profBonus?: number
  /** Names of what the level gains (empty when nothing). */
  features: string[]
  /** Value columns' text by column key. */
  cells: Record<string, string>
}

/** Names for the Features column's ability score increase and subclass levels. */
export interface ClassLevelLabels {
  abi: string
  subclass: string
}

/** Where a `progressionColumn` without an `order` goes: after the core columns, before the power slots. */
const DEFAULT_ORDER = 21
const FEATURES_ORDER = 5

/** "Sneak Attack Damage" → "class_feature_columns.sneak_attack_damage": the message a free-text heading may have. */
const labelKey = (text: string) => `class_feature_columns.${text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`

/** The class's own features (no subclass, not `noFeatureDisplay`), by level, then id. */
function ownFeatures<T extends ClassFeatureLike>(features: T[]): T[] {
  return features
    .filter(f => !f.subclass && !f.noFeatureDisplay)
    .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || recordId(a).localeCompare(recordId(b)))
}

/** The columns one mechanic brings through its type's `MechanicColumn`s and its `progressionColumn`. */
function mechanicTableColumns(mechanic: Record<string, unknown>, at: string, byType: Map<string, MechanicColumn[]>): { order: number, columns: ClassTableColumn[] }[] {
  const out: { order: number, columns: ClassTableColumn[] }[] = []
  for (const c of byType.get(String(mechanic.type)) ?? []) {
    const value = mechanic[c.field]
    const named = c.labelField ? mechanic[c.labelField] : undefined
    const head = typeof named === 'string' && named ? { label: labelKey(named), text: named } : { label: c.label, text: c.text }
    const key = `${at}.${c.field}`
    // A group's record may come back from the content store as an array indexed by power level.
    if (c.group && value && typeof value === 'object') {
      const rows = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => Array.isArray(v))
        .sort(([a], [b]) => Number(a) - Number(b))
      out.push({ order: c.order, columns: rows.map(([n, v]) => ({ key: `${key}.${n}`, kind: 'value', ...head, group: key, sub: Number(n), values: v as unknown[], blankZero: c.blankZero })) })
    }
    else if (!c.group && Array.isArray(value)) {
      out.push({ order: c.order, columns: [{ key, kind: 'value', ...head, values: value, blankZero: c.blankZero }] })
    }
  }
  const column = mechanic.progressionColumn as { label?: string, order?: number, values?: unknown[] } | undefined
  if (column?.label && Array.isArray(column.values)) {
    out.push({ order: column.order ?? DEFAULT_ORDER, columns: [{ key: `${at}.progressionColumn`, kind: 'value', label: labelKey(column.label), text: column.label, values: column.values }] })
  }
  return out
}

/**
 * The table's columns, built from the mechanics of the class's own features as
 * the live site builds them: Level and Proficiency Bonus, then by `order` the
 * Features column (5), the columns of each mechanic type in `mechanicColumns`
 * (the core power system's by default) and every mechanic's `progressionColumn`.
 * A heading appears once (the first feature's wins), and a field that isn't an
 * array (`known: false`) brings no column.
 */
export function classTableColumns(features: ClassFeatureLike[], mechanicColumns: MechanicColumns[] = CORE_MECHANIC_COLUMNS): ClassTableColumn[] {
  const byType = new Map(mechanicColumns.map(m => [m.type, m.columns]))
  const found: { order: number, columns: ClassTableColumn[] }[] = [
    { order: FEATURES_ORDER, columns: [{ key: 'features', kind: 'features', label: 'class_feature_columns.features', text: 'Features' }] },
  ]
  for (const feature of ownFeatures(features)) {
    for (const [i, mechanic] of (feature.mechanics ?? []).entries()) {
      for (const entry of mechanicTableColumns(mechanic, `${recordId(feature)}.${i}`, byType)) {
        const { label, text } = entry.columns[0] ?? {}
        if (label && !found.some(f => f.columns[0]!.label === label && f.columns[0]!.text === text)) found.push(entry)
      }
    }
  }
  return [
    { key: 'level', kind: 'level', label: 'level_title' },
    { key: 'profBonus', kind: 'profBonus', label: 'class_feature_columns.prof_bonus', text: 'Proficiency Bonus' },
    // Sorted stably: equal orders keep the features' order.
    ...found.map((f, i) => ({ ...f, i })).sort((a, b) => a.order - b.order || a.i - b.i).flatMap(f => f.columns),
  ]
}

/**
 * The table head: one row, or two when some columns form a group. Then the
 * group's heading spans its columns in the first row, their own headings
 * (`sub`) fill the second, and every other column spans both rows.
 */
export function classTableHeader(columns: ClassTableColumn[]): { top: ClassTableHeaderCell[], sub: ClassTableColumn[] } {
  const grouped = columns.some(c => c.group)
  const top: ClassTableHeaderCell[] = []
  for (const c of columns) {
    const last = top.at(-1)
    if (c.group && last?.key === `group:${c.group}`) last.colspan++
    else top.push({ key: c.group ? `group:${c.group}` : c.key, label: c.label, text: c.text, colspan: 1, rowspan: grouped && !c.group ? 2 : 1, group: !!c.group })
  }
  return { top, sub: columns.filter(c => c.group) }
}

/** A value column's text at a character level: "-" when there is none, and for 0 in a `blankZero` column. */
export function classTableCell(column: ClassTableColumn, level: number): string {
  const value = column.values?.[level - 1]
  if (value === undefined || value === null || value === '' || (value === 0 && column.blankZero)) return '-'
  return String(value)
}

/**
 * What a level gains, for the Features column: the class's own features at that
 * level by name (not subclass features or `noFeatureDisplay` ones), then the
 * ability score increase and subclass feature labels on those levels.
 */
export function levelFeatureNames(features: ClassFeatureLike[], progression: ClassProgression, level: number, labels: ClassLevelLabels): string[] {
  const names = features
    .filter(f => f.level === level && !f.subclass && !f.noFeatureDisplay)
    .map(f => f.name ?? recordId(f))
    .sort((a, b) => a.localeCompare(b))
  if (progression.abi.includes(level)) names.push(labels.abi)
  if (progression.subclass.includes(level)) names.push(labels.subclass)
  return names
}

/** The table's rows, one per character progression level, in level order. */
export function classTableRows(levels: { level?: number, profBonus?: number }[], columns: ClassTableColumn[], features: ClassFeatureLike[], progression: ClassProgression, labels: ClassLevelLabels): ClassTableRow[] {
  return levels
    .filter((l): l is { level: number, profBonus?: number } => typeof l.level === 'number')
    .sort((a, b) => a.level - b.level)
    .map(({ level, profBonus }) => ({
      level,
      profBonus,
      features: levelFeatureNames(features, progression, level, labels),
      cells: Object.fromEntries(columns.filter(c => c.kind === 'value').map(c => [c.key, classTableCell(c, level)])),
    }))
}

/** An entry in a feature list: a feature record, or the class's ability score increase (`abi`: the levels it names). */
export interface ClassFeatureEntry<T> {
  id: string
  level: number
  feature?: T
  abi?: number[]
}

export interface ClassFeatureListOptions {
  /** A subclass's features; otherwise the class's own. */
  subclass?: string
  /** Only this level's. */
  level?: number
  /** The class's ability score increase levels, to add the ability score increase entry (class lists only). */
  abi?: number[]
  /** The class's id, for the ability score increase entry's id. */
  klass?: string
}

/**
 * A feature list in the live site's order: by level, then by id descending.
 * Skips `noFeatureDisplay` features. With `abi`, a class list gets one ability
 * score increase entry at the first of those levels (or at `level`, when it is
 * one of them) naming the levels it covers.
 */
export function classFeatureEntries<T extends ClassFeatureLike>(features: T[], options: ClassFeatureListOptions = {}): ClassFeatureEntry<T>[] {
  const { subclass, level, abi = [], klass = '' } = options
  const entries: ClassFeatureEntry<T>[] = features
    .filter(f => (subclass ? f.subclass === subclass : !f.subclass) && (level === undefined || f.level === level) && !f.noFeatureDisplay)
    .map(f => ({ id: recordId(f), level: f.level ?? 0, feature: f }))
  const abiLevels = level === undefined ? abi : abi.filter(l => l === level)
  if (!subclass && abiLevels[0] !== undefined) {
    entries.push({ id: `${klass}-ability-score-increase-${abiLevels[0]}`, level: abiLevels[0], abi: abiLevels })
  }
  return entries.sort((a, b) => a.level - b.level || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
}

/** The ability score increase text: "When you reach 4th level, and again at 8th, … level, you can increase …". */
export function abiText(t: Translate, levels: number[]): string {
  const [first = 0, ...rest] = levels
  const ordinal = (l: number) => t(`ordinal_numbers[${l}]`)
  const level = t('level_nth', { nth: ordinal(first) })
  const atLevel = rest.length
    ? t('abi_feature.at_level', { level, and_list: t(`lists.and_list[${rest.length}]`, rest.map(ordinal)) }, 2)
    : t('abi_feature.at_level', { level }, 1)
  return t('abi_feature.text', { at_level: atLevel })
}

/** The fixed hit points at higher levels instead of a roll: half the die plus one. */
export const hitDieAverage = (die: number) => Math.ceil((die + 1) / 2)

/** The element id a URL hash names ("#barrier" → "barrier"); empty when there is none or it is malformed. */
export function classHashId(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ''))
  }
  catch {
    return ''
  }
}

/**
 * The class page tab holding the element a URL hash names (search links to
 * `/classes/<class>#<id>`): `features` for a class feature, `subclasses` for a
 * subclass or a subclass feature. Undefined for anything else.
 */
export function classHashTab(hash: string, features: ClassFeatureLike[], subclasses: { stem?: string }[]): 'features' | 'subclasses' | undefined {
  const id = classHashId(hash)
  if (!id) return undefined
  if (subclasses.some(s => recordId(s) === id)) return 'subclasses'
  const feature = features.find(f => recordId(f) === id)
  if (feature) return feature.subclass ? 'subclasses' : 'features'
  return /-ability-score-increase-\d+$/.test(id) ? 'features' : undefined
}
