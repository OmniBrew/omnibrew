import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { Character } from '@omnibrew/engine/character'
import { loadRules } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { UApp } from '#components'
import { defineComponent, h } from 'vue'
import Abilities from '../../../../packages/engine/app/components/sheet/Abilities.vue'
import ActionsTab from '../../../../packages/engine/app/components/sheet/ActionsTab.vue'
import Header from '../../../../packages/engine/app/components/sheet/Header.vue'
import PowersTab from '../../../../packages/engine/app/components/sheet/PowersTab.vue'
import Saves from '../../../../packages/engine/app/components/sheet/Saves.vue'
import Senses from '../../../../packages/engine/app/components/sheet/Senses.vue'
import Skills from '../../../../packages/engine/app/components/sheet/Skills.vue'
import Vitals from '../../../../packages/engine/app/components/sheet/Vitals.vue'
import { me5e } from '../../game'
import { migrateCharacter } from '../../migrate/character'

/**
 * Parity through the page (plan/24 §1.8): every parity fixture, opened in the
 * character store and shown by the sheet's own components; each number the page
 * prints (`data-sheet` keys, roll buttons) must equal the engine's `sheet.*`, so
 * no component computes a rules number of its own. The engine's parity with the
 * live sheet is `parity.test.ts`. Local only (needs the content repo).
 */
const contentDir = resolve(import.meta.dirname, '../../../../../omnibrew-me5e-data')
const fixturesDir = join(import.meta.dirname, '../fixtures/characters')
const game = createGame(me5e)
const rules = loadRules(contentDir, me5e, game)
const fixtures = readdirSync(fixturesDir).filter(f => f.endsWith('.json')).sort()

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`)
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const Page = defineComponent({
  // UApp provides what tooltips and toasts need, as on the site.
  setup: () => () => h(UApp, () => h('div', [h(Header), h(Vitals), h(Abilities), h(Saves), h(Senses), h(Skills), h(ActionsTab), h(PowersTab)])),
})

function open(character: Character) {
  const store = useCharacterStore()
  store.rules = { game, rules }
  store.record = { id: 'fixture', character, local: true, mine: false, revision: null }
  store.character = character
  store.state = 'ready'
  return store.sheet!
}

describe('the sheet page shows the engine\'s numbers', () => {
  it.each(fixtures)('%s', async (file) => {
    const raw = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8')) as Record<string, unknown>
    const { character } = migrateCharacter(raw, { game, content: rules.content })
    const sheet = open(character)
    const page = await mountSuspended(Page)
    const at = (key: string) => page.element.querySelector(`[data-sheet="${key}"]`)

    expect(text(at('ac'))).toBe(String(sheet.ac))
    expect(text(at('profBonus'))).toBe(signed(sheet.profBonus))
    expect(text(at('initiative'))).toBe(signed(sheet.initiative.bonus))
    // The ring (desktop) and the pool row (phones; desktop with more pools) both show hit points.
    if (at('hp.current')) expect(text(at('hp.current'))).toBe(`${sheet.hp.current}/${sheet.hp.max}`)
    expect(text(page.element.querySelector('[data-sheet-pool="hp"] [data-value]'))).toBe(`${sheet.hp.current}/${sheet.hp.max}`)

    for (const [key, a] of Object.entries(sheet.abilities)) {
      const el = at(`abilities.${key}`)
      expect(text(el?.querySelector('[data-roll]')), `${key} mod`).toBe(signed(a.mod ?? 0))
      expect(text(el?.querySelector('span')), `${key} score`).toBe(String(a.total ?? '–'))
    }
    for (const [key, s] of Object.entries(sheet.saves)) expect(text(at(`saves.${key}`)?.querySelector('[data-roll]')), `save ${key}`).toBe(signed(s.mod))
    for (const [key, s] of Object.entries(sheet.skills)) expect(text(at(`skills.${key}`)?.querySelector('[data-roll]')), `skill ${key}`).toBe(signed(s.mod))
    for (const id of ['perception', 'investigation', 'insight']) expect(text(at(`passive.${id}`)?.querySelector('span')), `passive ${id}`).toBe(String(sheet.skills[id]!.passive))

    // Attack cards: hit bonus, save DC and damage, as `sheet.card(card)` resolves them.
    // A weapon's special attacks (burst fire, two-weapon fighting) share its name: a card shows one of them.
    const cards = [...Object.values(sheet.weaponAttacks).flat(), ...sheet.actions]
    for (const el of page.element.querySelectorAll('[data-card]')) {
      const named = cards.filter(c => c.name === (el as HTMLElement).dataset.card).map(c => sheet.card(c))
      if (!named.length) continue
      const name = (el as HTMLElement).dataset.card
      expect(named.map(r => (r.hit ? signed(r.hit.bonus) : '')), `${name} hit`).toContain(text(el.querySelector('[data-sheet-hit]')))
      expect(named.map(r => (r.dc ? `DC ${r.dc.target}` : '')), `${name} DC`).toContain(text(el.querySelector('[data-sheet-dc]')).match(/DC \d+/)?.[0] ?? '')
    }

    // Points and slots left.
    for (const [pool, p] of Object.entries(sheet.powercasting.points).filter(([, p]) => p.max > 0)) {
      expect(text(at(`points.${pool}`)), `points ${pool}`).toContain(`${p.max - p.used}/${p.max}`)
    }
    page.unmount()
  })
})
