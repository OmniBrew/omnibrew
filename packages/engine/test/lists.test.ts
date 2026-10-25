import { describe, expect, it } from 'vitest'
import { filterRecords, sortRecords, uniqueOptions, type RecordFilter } from '../app/utils/lists'
import { attackText, castingTimeText, commaList, durationText, effectText, powerLevel, type Translate } from '../app/utils/powers'
import { bodyText, inlineText, recordId, recordPath } from '../shared/utils/records'

interface Item { name: string, type?: string, tags?: string[], level?: number }
const items: Item[] = [
  { name: 'Charge', type: 'biotic', tags: ['damage', 'movement'], level: 0 },
  { name: 'Barrier', type: 'biotic', tags: ['protection'], level: 1 },
  { name: 'Overload', type: 'tech', tags: ['damage'], level: 1 },
  { name: 'Adrenaline', type: 'combat', level: 2 },
]

describe('record lists', () => {
  it('lists the distinct values as options, by label or in a given order', () => {
    expect(uniqueOptions(items, i => i.tags, v => v.toUpperCase()).map(o => o.label)).toEqual(['DAMAGE', 'MOVEMENT', 'PROTECTION'])
    expect(uniqueOptions(items, i => i.type, undefined, ['tech', 'combat', 'biotic']).map(o => o.value)).toEqual(['tech', 'combat', 'biotic'])
  })

  it('filters by search text and by every filter with a selection', () => {
    const filters: RecordFilter<Item>[] = [
      { key: 'type', label: 'Type', options: [], value: i => i.type },
      { key: 'tags', label: 'Tags', options: [], value: i => i.tags },
    ]
    const names = (selected: Record<string, string[]>, search = '') => filterRecords(items, search, i => i.name, filters, selected).map(i => i.name)
    expect(names({})).toHaveLength(4)
    expect(names({}, 'ar')).toEqual(['Charge', 'Barrier'])
    expect(names({ type: ['biotic'], tags: ['damage'] })).toEqual(['Charge'])
    expect(names({ tags: ['damage', 'protection'] })).toEqual(['Charge', 'Barrier', 'Overload'])
    expect(names({ type: [] })).toHaveLength(4)
  })

  it('sorts both ways, breaking ties by name and putting missing values last', () => {
    const byLevel = (desc: boolean) => sortRecords(items, i => i.level, desc, i => i.name).map(i => i.name)
    expect(byLevel(false)).toEqual(['Charge', 'Barrier', 'Overload', 'Adrenaline'])
    expect(byLevel(true)).toEqual(['Adrenaline', 'Barrier', 'Overload', 'Charge'])
    expect(sortRecords(items, i => i.tags?.[0], false, i => i.name).map(i => i.name).at(-1)).toBe('Adrenaline')
  })
})

// A stand-in for vue-i18n's `t` over a few ME5e messages.
const messages: Record<string, string> = {
  'none': 'None',
  'cantrip': 'cantrip',
  'ordinal_numbers[3]': '3rd',
  'lists.comma_list[1]': '{0}',
  'lists.comma_list[2]': '{0}, {1}',
  'times.action_title': 'Action',
  'times.bonus_action_title': 'Bonus Action',
  'times.minute': '1 minute | {n} minutes',
  'times.instant': 'Instant',
  'attack_types.ranged': 'Ranged Attack',
  'abilities.dex.abbr': 'DEX',
  'save_text': '{type} Save',
  'tags.damage': 'Damage',
  'tags.control': 'Control',
}
const t = ((key: string, a?: unknown, b?: unknown) => {
  let text = messages[key] ?? key
  const plural = typeof a === 'number' ? a : typeof b === 'number' ? b : undefined
  if (text.includes(' | ')) text = text.split(' | ')[plural === 1 ? 0 : 1]!
  const named = Array.isArray(a) ? Object.fromEntries(a.map((v, i) => [i, v])) : typeof a === 'object' ? a as object : {}
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String((named as Record<string, unknown>)[k]))
}) as Translate

describe('power summaries', () => {
  it('names levels and lists casting times', () => {
    expect(powerLevel(t, 0)).toBe('cantrip')
    expect(powerLevel(t, 3)).toBe('3rd')
    expect(castingTimeText(t, { castingTime: { unit: 'action' }, altCasting: [{ unit: 'bonus_action' }] })).toBe('Action, Bonus Action')
    expect(castingTimeText(t, { castingTime: { length: 10, unit: 'minute' } })).toBe('10 minutes')
    expect(commaList(t, [])).toBe('None')
  })

  it('describes duration, attack and effect, short or in full', () => {
    expect(durationText(t, { duration: { length: 1, unit: 'minute' } })).toBe('1 minute')
    expect(durationText(t, { duration: { unit: 'instant' } })).toBe('Instant')
    const both = { attack: { type: 'ranged' }, dc: { save: 'dex' } }
    expect(attackText(t, both)).toBe('Ranged Attack, DEX Save')
    expect(attackText(t, both, true)).toBe('Ranged Attack (...)')
    expect(attackText(t, { attack: false, dc: false })).toBe('-')
    expect(effectText(t, ['damage', 'control'], true)).toBe('Damage (...)')
    expect(effectText(t, [], true)).toBe('-')
  })
})

describe('record helpers', () => {
  const routes = { conditions: '/appendix/conditions/{id}', traits: '/species/{species.0}#{id}', manual: '/manual/{chapter}#{id}', edges: false as const }

  it('builds a record\'s page from the routes config', () => {
    expect(recordId({ stem: 'powers/charge' })).toBe('charge')
    expect(recordPath(routes, 'powers', { stem: 'powers/charge' })).toBe('/powers/charge')
    expect(recordPath(routes, 'conditions', { stem: 'conditions/primed' })).toBe('/appendix/conditions/primed')
    expect(recordPath(routes, 'traits', { stem: 'traits/wings', species: ['drell', 'yahg'] })).toBe('/species/drell#wings')
    expect(recordPath(routes, 'manual', { stem: 'manual/combat-round' }, 'combat')).toBe('/manual/combat#combat-round')
    expect(recordPath(routes, 'edges', { stem: 'edges/x' })).toBeUndefined()
  })

  it('reads plain text from a body and from MDC in fields', () => {
    const body = { type: 'minimark', value: [['p', {}, 'Push it ', ['distance', { length: '30' }], ' away.'], ['p', {}, 'It is ', ['condition', { id: 'primed' }], '.']] }
    expect(bodyText(body)).toBe('Push it 30 ft away. It is primed.')
    expect(inlineText('Within :distance{length="10" adj} you are **:condition{id="primed" sub="fire"}** :icon{name="x"}')).toBe('Within 10 ft you are primed')
  })
})
