import { describe, expect, it } from 'vitest'
import type { Translate } from '../app/utils/powers'
import {
  abiText,
  CORE_MECHANIC_COLUMNS,
  classFeatureEntries,
  classHashTab,
  classTableCell,
  classTableColumns,
  classTableHeader,
  classTableRows,
  hitDieAverage,
  levelFeatureNames,
  mergeMechanicColumns,
  type ClassFeatureLike,
  type ClassProgression,
  type ClassTableColumn,
  type MechanicColumns,
} from '../app/utils/progression'

const levels = Array.from({ length: 20 }, (_, i) => ({ level: i + 1, profBonus: 2 + Math.floor(i / 4) }))
const perLevel = (f: (level: number) => number | string | null) => levels.map(l => f(l.level))
const labelsOf = (columns: ClassTableColumn[]) => columns.map(c => c.label)

// A game's own mechanic (a barrier with uses and ticks) and its names for power points.
const game: MechanicColumns[] = [
  { type: 'game:barrier', columns: [
    { field: 'uses', label: 'class_feature_columns.barrier_uses', order: 10 },
    { field: 'ticks', label: 'class_feature_columns.barrier_ticks', order: 10 },
  ] },
  { type: 'powercasting-points', columns: [
    { field: 'points', label: 'class_feature_columns.tech_points', order: 20 },
    { field: 'limit', label: 'class_feature_columns.tech_point_limit', order: 20 },
  ] },
]
const withGame = mergeMechanicColumns(CORE_MECHANIC_COLUMNS, game)

// An adept-like class: barrier, cantrips, powers known and power slots per power level.
const adept: ClassProgression = { subclass: [2, 6, 10, 14], abi: [4, 8, 12, 16, 19] }
const features: ClassFeatureLike[] = [
  { stem: 'class-features/powercasting', name: 'Powercasting', level: 1, mechanics: [
    { type: 'cantrips', known: perLevel(l => 4 + Math.floor(l / 5)) },
    { type: 'powercasting-slots', known: perLevel(l => (l === 1 ? 0 : l + 2)), slots: { 2: perLevel(l => (l < 5 ? 0 : 2)), 1: perLevel(l => Math.min(l * 2, 7)) } },
  ] },
  { stem: 'class-features/barrier', name: 'Barrier', level: 1, mechanics: [
    { type: 'game:barrier', uses: perLevel(l => 2 + Math.floor(l / 6)), ticks: perLevel(() => 3), dieCount: 1 },
  ] },
  { stem: 'class-features/biotic-recovery', name: 'Biotic Recovery', level: 1 },
  { stem: 'class-features/biotic-aptitude', name: 'Biotic Aptitude', level: 3 },
  { stem: 'class-features/hidden-copy', name: 'Hidden Copy', level: 3, noFeatureDisplay: true, mechanics: [
    { type: 'note', progressionColumn: { label: 'Hidden', values: perLevel(() => 1) } },
  ] },
  { stem: 'class-features/sculpt-biotics', name: 'Sculpt Biotics', level: 2, subclass: 'blackstar', mechanics: [
    { type: 'cantrips', columnName: 'Subclass Cantrips', known: perLevel(() => 1) },
  ] },
  { stem: 'class-features/bend-luck', name: 'Bend Luck', level: 6, subclass: 'blackstar' },
  { stem: 'class-features/fitness', name: 'Fitness', level: 2, subclass: 'commando' },
]
const labels = { abi: 'Ability Score Increase', subclass: 'Subclass Feature' }

// An engineer-like class: power points and a points limit, no powers known.
const engineer: ClassFeatureLike[] = [
  { stem: 'class-features/powercasting-engineer', name: 'Powercasting', level: 1, mechanics: [
    { type: 'powercasting-points', known: false, points: perLevel(l => l * 2), limit: perLevel(l => Math.ceil(l / 4)) },
  ] },
]

// An infiltrator/experiment/tracker-like class: free-text `progressionColumn`s around the features and core columns.
const rogue: ClassFeatureLike[] = [
  { stem: 'class-features/training-regimens', name: 'Training Regimens', level: 2, mechanics: [
    { type: 'model-choice', progressionColumn: { label: 'Training Regimens', order: 21, values: perLevel(l => (l === 1 ? '-' : Math.ceil(l / 2))) } },
  ] },
  { stem: 'class-features/exploits', name: 'Exploits', level: 2, mechanics: [
    { type: 'global-note', progressionColumn: { label: 'Exploit Die', order: 11, values: perLevel(l => (l === 1 ? null : '1d4')) } },
  ] },
  { stem: 'class-features/sneak-attack', name: 'Sneak Attack', level: 1, mechanics: [
    { type: 'global-note', progressionColumn: { label: 'Sneak Attack Damage', order: 2, values: perLevel(l => `${Math.ceil(l / 2)}d6`) } },
  ] },
  { stem: 'class-features/combat-powers', name: 'Combat Powers', level: 2, mechanics: [
    { type: 'cantrips', columnName: 'Combat Powers', known: perLevel(l => (l === 1 ? 0 : 1)) },
  ] },
  { stem: 'class-features/powercasting-rogue', name: 'Powercasting', level: 1, mechanics: [
    { type: 'powercasting-points', known: false, points: perLevel(l => l), limit: perLevel(() => 1) },
  ] },
]

// A sentinel-like class: barrier, cantrips and pact slots.
const sentinel: ClassFeatureLike[] = [
  { stem: 'class-features/powercasting-sentinel', level: 1, mechanics: [
    { type: 'cantrips', known: perLevel(() => 2) },
    { type: 'powercasting-pact', known: perLevel(l => l + 1), numSlots: perLevel(() => 2), slotLevel: perLevel(() => 1) },
  ] },
  { stem: 'class-features/barrier-sentinel', level: 1, mechanics: [{ type: 'game:barrier', uses: perLevel(() => 2), ticks: perLevel(() => 3) }] },
]

describe('class table columns', () => {
  it('builds the columns from the class\'s own features\' mechanics, in order, with a power slot group last', () => {
    const columns = classTableColumns(features, withGame)
    expect(labelsOf(columns)).toEqual([
      'level_title',
      'class_feature_columns.prof_bonus',
      'class_feature_columns.features',
      'class_feature_columns.barrier_uses',
      'class_feature_columns.barrier_ticks',
      'class_feature_columns.cantrips',
      'class_feature_columns.powers_known',
      'class_feature_columns.power_slots_by_power_level',
      'class_feature_columns.power_slots_by_power_level',
    ])
    expect(columns.slice(-2).map(c => c.sub)).toEqual([1, 2])
    // The content store may hand the slots back as an array indexed by power level.
    const stored = [{ stem: 'class-features/x', level: 1, mechanics: [{ type: 'powercasting-slots', known: false, slots: [null, perLevel(() => 2), perLevel(() => 0)] }] }]
    expect(classTableColumns(stored).slice(3).map(c => [c.label, c.sub])).toEqual([
      ['class_feature_columns.power_slots_by_power_level', 1],
      ['class_feature_columns.power_slots_by_power_level', 2],
    ])
    // Subclass and noFeatureDisplay features bring no columns; without the game's mapping, its mechanic brings none.
    expect(labelsOf(classTableColumns(features))).not.toContain('class_feature_columns.barrier_uses')
  })

  it('names power points neutrally unless the game renames them, and skips `known: false`', () => {
    expect(classTableColumns(engineer).slice(3).map(c => [c.label, c.text])).toEqual([
      ['class_feature_columns.points', 'Points'],
      ['class_feature_columns.point_limit', 'Point Limit'],
    ])
    expect(labelsOf(classTableColumns(engineer, withGame).slice(3))).toEqual(['class_feature_columns.tech_points', 'class_feature_columns.tech_point_limit'])
  })

  it('places `progressionColumn`s by their order around Features and the core columns', () => {
    const columns = classTableColumns(rogue, withGame)
    expect(columns.map(c => c.text ?? c.label)).toEqual([
      'level_title', 'Proficiency Bonus', 'Sneak Attack Damage', 'Features', 'Exploit Die', 'Combat Powers',
      'class_feature_columns.tech_points', 'class_feature_columns.tech_point_limit', 'Training Regimens',
    ])
    // A free-text heading carries the message key it may have; `columnName` renames a column.
    expect(columns[2]!.label).toBe('class_feature_columns.sneak_attack_damage')
    expect(columns[5]!.label).toBe('class_feature_columns.combat_powers')
  })

  it('orders pact slots after cantrips and powers known, and keeps a heading once', () => {
    expect(labelsOf(classTableColumns(sentinel, withGame).slice(3))).toEqual([
      'class_feature_columns.barrier_uses', 'class_feature_columns.barrier_ticks', 'class_feature_columns.cantrips',
      'class_feature_columns.powers_known', 'class_feature_columns.power_slots', 'class_feature_columns.power_level',
    ])
    const twice = [...sentinel, { stem: 'class-features/more', level: 2, mechanics: [{ type: 'powercasting-slots', known: perLevel(() => 9), slots: {} }] }]
    expect(labelsOf(classTableColumns(twice, withGame)).filter(l => l === 'class_feature_columns.powers_known')).toHaveLength(1)
  })

  it('lets a game replace a core column by field and keep the rest', () => {
    const points = mergeMechanicColumns(CORE_MECHANIC_COLUMNS, game).find(m => m.type === 'powercasting-points')!
    expect(points.columns.map(c => c.label)).toEqual(['class_feature_columns.powers_known', 'class_feature_columns.tech_points', 'class_feature_columns.tech_point_limit'])
    expect(CORE_MECHANIC_COLUMNS.find(m => m.type === 'powercasting-points')!.columns[1]!.label).toBe('class_feature_columns.points')
  })

  it('heads a group over its columns, other columns spanning both rows', () => {
    const { top, sub } = classTableHeader(classTableColumns(features, withGame))
    expect(top.map(c => [c.label.replace('class_feature_columns.', ''), c.colspan, c.rowspan])).toEqual([
      ['level_title', 1, 2], ['prof_bonus', 1, 2], ['features', 1, 2], ['barrier_uses', 1, 2], ['barrier_ticks', 1, 2],
      ['cantrips', 1, 2], ['powers_known', 1, 2], ['power_slots_by_power_level', 2, 1],
    ])
    expect(sub.map(c => c.sub)).toEqual([1, 2])
    expect(classTableHeader(classTableColumns(engineer)).top.every(c => c.rowspan === 1)).toBe(true)
  })
})

describe('class table rows', () => {
  const columns = classTableColumns(features, withGame)
  const rows = classTableRows([...levels].reverse(), columns, features, adept, labels)
  const cells = (row: number) => columns.filter(c => c.kind === 'value').map(c => rows[row]!.cells[c.key])

  it('has one row per level with its proficiency bonus', () => {
    expect(rows.map(r => r.level)).toEqual(levels.map(l => l.level))
    expect(rows[4]).toMatchObject({ level: 5, profBonus: 3 })
  })

  it('lists the class features of a level by name, then ASI and subclass levels', () => {
    expect(rows[0]!.features).toEqual(['Barrier', 'Biotic Recovery', 'Powercasting'])
    expect(rows[1]!.features).toEqual(['Subclass Feature'])
    expect(rows[2]!.features).toEqual(['Biotic Aptitude'])
    expect(rows[3]!.features).toEqual(['Ability Score Increase'])
    expect(rows[4]!.features).toEqual([])
    expect(levelFeatureNames(features, { subclass: [4], abi: [4] }, 4, labels)).toEqual(['Ability Score Increase', 'Subclass Feature'])
  })

  it('fills values by level, with "-" for none and for 0 in cantrips and power slots', () => {
    // barrier uses, ticks, cantrips, powers known (0 stays), slots 1st, 2nd
    expect(cells(0)).toEqual(['2', '3', '4', '0', '2', '-'])
    expect(cells(19)).toEqual(['5', '3', '8', '22', '7', '2'])
    const rogueColumns = classTableColumns(rogue, withGame)
    const rogueRow = classTableRows(levels, rogueColumns, rogue, adept, labels)[0]!
    expect(rogueColumns.filter(c => c.kind === 'value').map(c => rogueRow.cells[c.key])).toEqual(['1d6', '-', '-', '1', '1', '-'])
    expect(classTableCell({ key: 'x', kind: 'value', label: 'x', values: [0] }, 1)).toBe('0')
    expect(classTableCell({ key: 'x', kind: 'value', label: 'x' }, 1)).toBe('-')
  })
})


describe('class feature lists', () => {
  const ids = (entries: { id: string }[]) => entries.map(e => e.id)

  it('lists the class features by level, then id descending, with one ASI entry at the first ASI level', () => {
    const entries = classFeatureEntries(features, { abi: adept.abi, klass: 'adept' })
    expect(ids(entries)).toEqual(['powercasting', 'biotic-recovery', 'barrier', 'biotic-aptitude', 'adept-ability-score-increase-4'])
    expect(entries.at(-1)).toMatchObject({ level: 4, abi: [4, 8, 12, 16, 19] })
  })

  it('lists one level, with the ASI entry only on an ASI level', () => {
    expect(ids(classFeatureEntries(features, { level: 1, abi: adept.abi, klass: 'adept' }))).toEqual(['powercasting', 'biotic-recovery', 'barrier'])
    expect(classFeatureEntries(features, { level: 8, abi: adept.abi, klass: 'adept' })).toEqual([{ id: 'adept-ability-score-increase-8', level: 8, abi: [8] }])
  })

  it('lists a subclass\'s features, never with an ASI entry', () => {
    expect(ids(classFeatureEntries(features, { subclass: 'blackstar', abi: adept.abi }))).toEqual(['sculpt-biotics', 'bend-luck'])
    expect(ids(classFeatureEntries(features, { subclass: 'blackstar', level: 6 }))).toEqual(['bend-luck'])
  })
})

// A stand-in for vue-i18n's `t` over the ME5e messages these helpers use.
const messages: Record<string, string> = {
  'ordinal_numbers[4]': '4th',
  'ordinal_numbers[8]': '8th',
  'ordinal_numbers[12]': '12th',
  'level_nth': '{nth} level',
  'lists.and_list[2]': '{0} and {1}',
  'abi_feature.at_level': 'When you reach {level}, | When you reach {level}, and again at {and_list} level,',
  'abi_feature.text': '{at_level} you can increase one ability score.',
}
const t = ((key: string, a?: unknown, b?: unknown) => {
  let text = messages[key] ?? key
  const plural = typeof a === 'number' ? a : typeof b === 'number' ? b : undefined
  if (text.includes(' | ')) text = text.split(' | ')[plural === 1 ? 0 : 1]!
  const named = Array.isArray(a) ? Object.fromEntries(a.map((v, i) => [i, v])) : typeof a === 'object' ? a as object : {}
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String((named as Record<string, unknown>)[k]))
}) as Translate

describe('class page text and links', () => {
  it('words the ability score increase for all its levels or one', () => {
    expect(abiText(t, [4, 8, 12])).toBe('When you reach 4th level, and again at 8th and 12th level, you can increase one ability score.')
    expect(abiText(t, [8])).toBe('When you reach 8th level, you can increase one ability score.')
  })

  it('gives the fixed hit points per level', () => {
    expect([6, 8, 10, 12].map(hitDieAverage)).toEqual([4, 5, 6, 7])
  })

  it('finds the tab a search link\'s hash points into', () => {
    const subclasses = [{ stem: 'subclasses/blackstar' }]
    expect(classHashTab('#barrier', features, subclasses)).toBe('features')
    expect(classHashTab('#bend-luck', features, subclasses)).toBe('subclasses')
    expect(classHashTab('#blackstar', features, subclasses)).toBe('subclasses')
    expect(classHashTab('#adept-ability-score-increase-4', features, subclasses)).toBe('features')
    expect(classHashTab('#nothing', features, subclasses)).toBeUndefined()
    expect(classHashTab('', features, subclasses)).toBeUndefined()
    expect(classHashTab('#%E0%A4%A', features, subclasses)).toBeUndefined()
  })
})
