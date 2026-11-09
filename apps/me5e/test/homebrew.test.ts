import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRules, placeRecord, sampleCharacter, sheetSummary, type Rec } from '@omnibrew/engine/rules'
import { createGame, type FieldDef } from '@omnibrew/engine/schemas'
import { validateRecord } from '@omnibrew/engine/validator/record'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { meHomebrewParts as client } from '../game/homebrew-preview'
import { me5eDefinition } from '../game/definition'

/**
 * ME5e homebrew (plan/26 §1.3): every kind's new record and every offered effect validate
 * against the content schemas, the validator rejects what it should, the preview places
 * records on a sample, and (locally, with the content repo) every label has a string.
 */
const game = createGame(me5eDefinition)
const hb = me5eDefinition.homebrew!
const recs = (collections: Record<string, Rec[]>) => new Map(Object.entries(collections).map(([c, list]) => [c, new Map(list.map(r => [r.id, r]))]))
const perLevel = (f: (l: number) => number) => Array.from({ length: 20 }, (_, i) => f(i + 1))
const records = recs({
  'classes': [
    { id: 'adept', name: 'Adept', hitDie: 6, profs: {}, progression: { abi: [4], subclass: [3] } },
    { id: 'soldier', name: 'Soldier', hitDie: 10, profs: { 'saving-throw': { has: ['str', 'con'] } }, progression: { abi: [4], subclass: [3] } },
  ],
  'class-features': [{ id: 'pc-adept', name: 'Powercasting', klass: 'adept', level: 1, mechanics: [{ type: 'powercasting-slots', slots: perLevel(() => 2), known: perLevel(() => 4), multiclassConversion: 1, mod: 'wis' }] }],
  'conditions': [{ id: 'primed', name: 'Primed' }, { id: 'lifted', name: 'Lifted' }],
  'skills': [{ id: 'stealth', name: 'Stealth', link: 'dex' }, { id: 'perception', name: 'Perception', link: 'wis' }],
  'weapon-properties': [{ id: 'heat', name: 'Heat', takesValue: true }, { id: 'light', name: 'Light' }],
  'species': [{ id: 'human', name: 'Human', mechanics: [] }],
  'weapons': [{ id: 'm-3-predator', name: 'Predator', kind: 'weapon', weaponType: 'heavy_pistol', damage: { dieCount: 1, dieType: 8, type: 'piercing' }, range: { short: 60, long: 180 }, properties: [{ id: 'heat', value: 15 }] }],
  'armor': [{ id: 'colossus-chestplate', name: 'Colossus', kind: 'armor', coverage: 'piece', slot: 'chest', armorType: 'heavy', mechanics: [{ type: 'ac', bonus: { type: 'flat', value: 2 } }] }],
  'feats': [],
  'powers': [],
  'gear': [],
  'mods': [],
  'actions': [],
  'edges': [],
})
const errors = (collection: string, record: Rec) => validateRecord(game, collection, record, records).filter(i => i.severity === 'error')
const ID = '3f0f6a2e-1c5d-4c1e-9a43-0d6f2b1a7c11'

describe('homebrew kinds', () => {
  it('offers weapons, armor, gear, mods, powers and feats', () => {
    expect(hb.kinds.map(k => k.collection)).toEqual(['weapons', 'armor', 'gear', 'mods', 'powers', 'feats'])
  })

  for (const kind of hb.kinds) {
    it(`a new ${kind.collection} record validates`, () => {
      expect(errors(kind.collection, { ...kind.defaults(), name: 'Test', id: ID })).toEqual([])
    })
  }

  it('every form field path is one the schema knows', () => {
    for (const kind of hb.kinds) {
      for (const f of kind.groups.flatMap(g => g.fields)) {
        if (['effects', 'upcasts', 'advancements'].includes(f.input.kind)) continue
        expect(f.path, `${kind.collection}.${f.path}`).toMatch(/^[\w.]+$/)
      }
    }
  })
})

describe('homebrew effects', () => {
  for (const e of hb.effects) {
    it(`a new "${e.type}" effect validates on a feat`, () => {
      const filled: Rec = { type: e.type, ...e.defaults?.() }
      // Required fields without defaults get a value of their kind.
      for (const f of e.fields.filter((x: FieldDef) => x.required && filled[x.path.split('.')[0]!] === undefined)) {
        if (f.input.kind === 'record') filled[f.path] = f.input.collection === 'conditions' ? 'primed' : f.input.collection === 'skills' ? 'stealth' : 'light'
        if (f.input.kind === 'text') filled[f.path] = 'Something'
      }
      if (['action', 'bonus-action', 'reaction', 'other'].includes(e.type)) filled.name = 'Do it'
      expect(errors('feats', { id: ID, name: 'Test', mechanics: [filled] })).toEqual([])
    })
  }

  it('every effect is a registered mechanic type', () => {
    for (const e of hb.effects) expect(game.mechanicTypes, e.type).toContain(e.type)
  })
})

describe('validating homebrew', () => {
  it('reports schema errors by path', () => {
    const issues = errors('weapons', { ...hb.kinds[0]!.defaults(), name: 'Bad', id: ID, damage: { dieCount: 1, dieType: 7, type: 'piercing' } })
    expect(issues.map(i => i.path)).toContain('damage.dieType')
  })

  it('reports references that do not exist', () => {
    const issues = errors('powers', { ...hb.kinds[4]!.defaults(), name: 'Bad', id: ID, classes: ['wizard'] })
    expect(issues.some(i => i.category === 'reference' && i.message.includes('wizard'))).toBe(true)
  })

  it('rejects raw HTML and unknown prose components, accepts MDC components', () => {
    const base = { ...hb.kinds[5]!.defaults(), name: 'Feat', id: ID }
    expect(errors('feats', { ...base, body: 'Hello <script>alert(1)</script>' }).map(i => i.rule)).toContain('raw-html')
    expect(errors('feats', { ...base, body: 'Hi :sparkle{x=1}' }).map(i => i.rule)).toContain('mdc-unknown-component')
    expect(errors('feats', { ...base, body: 'Move :distance{length=30} and become :condition{id=primed}.' })).toEqual([])
  })
})

describe('the preview', () => {
  const rulesWith = (collection: string, record: Rec) => {
    const all = new Map(records)
    all.set(collection, new Map([...(records.get(collection) ?? []), [ID, record]]))
    return createRules(game, all)
  }
  const soldier = client.samples.find(s => s.id === 'soldier')!
  const diff = (collection: string, record: Rec) => {
    const rules = rulesWith(collection, record)
    const base = sampleCharacter(soldier, rules.content, me5eDefinition, 5)
    const placed = placeRecord(base, collection, record, rules.content) ?? client.place!(base, collection, record, rules.content)
    expect(placed).not.toBeNull()
    const before = new Map(sheetSummary(rules.sheet(base)).map(l => [l.key, l.value]))
    const after = new Map(sheetSummary(rules.sheet(placed!)).map(l => [l.key, l.value]))
    return { before, after }
  }

  it('shows a homebrew weapon as a new attack', () => {
    const { before, after } = diff('weapons', { ...hb.kinds[0]!.defaults(), id: ID, kind: 'weapon', name: 'Hand Cannon', damage: { dieCount: 2, dieType: 10, type: 'fire' } })
    expect(before.has('attack.Hand Cannon')).toBe(false)
    expect(after.get('attack.Hand Cannon')).toMatch(/2d10.*fire/)
  })

  it('shows a feat’s resistance and AC bonus', () => {
    const { before, after } = diff('feats', { id: ID, name: 'Tough Hide', mechanics: [{ type: 'resistance', value: 'fire' }, { type: 'ac', bonus: { type: 'flat', value: 1 } }] })
    expect(Number(after.get('ac'))).toBe(Number(before.get('ac')) + 1)
    expect(after.get('defense.resistance')).toBe('fire')
  })

  it('puts a weapon mod on a weapon it fits', () => {
    const { after } = diff('mods', { id: ID, name: 'Hot Barrel', kind: 'mod', modType: 'weapon', placement: 'barrel', availability: ['heavy_pistol'], mechanics: [{ type: 'attack-augment', augmentTypes: ['hit'], bonus: { type: 'flat', value: 2 } }] })
    expect([...after.keys()].some(k => k.startsWith('attack.'))).toBe(true)
  })
})

const messages = resolve(__dirname, '../../../../omnibrew-me5e-data/messages/en.yml')
describe.skipIf(!existsSync(messages))('homebrew strings (local)', () => {
  // vitest runs a skipped describe's body to collect its tests, so guard the read too
  const en = existsSync(messages) ? parse(readFileSync(messages, 'utf8')) : {}
  const has = (key: string) => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Rec)[k] : undefined), en) !== undefined

  it('every form, effect and sample label has a string', () => {
    const keys = [
      ...hb.kinds.flatMap(k => [`homebrew.kinds.${k.collection}`, ...k.groups.flatMap(g => [g.title, ...g.fields.flatMap(f => [f.label, ...(f.help ? [f.help] : [])])])]),
      ...hb.effects.flatMap(e => [e.label, e.group, ...(e.help ? [e.help] : []), ...e.fields.flatMap(f => [f.label, ...(f.help ? [f.help] : [])])]),
      ...client.samples.map(s => s.label),
    ]
    expect([...new Set(keys)].filter(k => !has(k))).toEqual([])
  })

  it('every string compiles in vue-i18n (braces only for placeholders or literals)', () => {
    const bad: string[] = []
    const walk = (v: unknown, path: string) => {
      if (typeof v === 'string') {
        for (const m of v.matchAll(/\{('[^']*'|[^}]*)\}/g)) if (!/^\s*(?:[a-z_]\w*|\d+|'[^']*')\s*$/i.test(m[1]!)) bad.push(`${path}: ${m[0]}`)
      }
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k)
    }
    walk(en, '')
    expect(bad).toEqual([])
  })
})
