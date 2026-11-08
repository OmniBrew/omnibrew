import { resolve } from 'node:path'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { createRules } from '@omnibrew/engine/rules'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { UApp } from '#components'
import BookmarkButton from '../../../../packages/engine/app/components/BookmarkButton.vue'
import HomebrewEffects from '../../../../packages/engine/app/components/homebrew/Effects.vue'
import HomebrewForm from '../../../../packages/engine/app/components/homebrew/Form.vue'
import HomebrewPreview from '../../../../packages/engine/app/components/homebrew/Preview.vue'
import { me5e } from '../../game'

/**
 * Homebrew and bookmarks in the real components (plan/26 §1.11). Local only: needs the
 * content repo. The rules come from the checkout, as the rules bundle would give them.
 */
const contentDir = resolve(import.meta.dirname, '../../../../../omnibrew-me5e-data')
const game = createGame(me5e)
const { records } = loadRecords(contentDir, me5e)
const rules = createRules(game, records)
mockNuxtImport('useRules', () => () => Promise.resolve({ game, rules, records, withRecords: (r: typeof records) => createRules(game, r) }))

const weapons = me5e.homebrew!.kinds.find(k => k.collection === 'weapons')!
const inApp = (inner: () => ReturnType<typeof h>) => defineComponent({ setup: () => () => h(UApp, inner) })

async function ready() {
  await useHomebrewRules().load()
  await flushPromises()
}

describe('the homebrew preview', () => {
  it('shows a homebrew weapon as a new attack on the sample soldier', async () => {
    await ready()
    const record = { ...weapons.defaults(), name: 'Test Hand Cannon', damage: { dieCount: 2, dieType: 10, type: 'fire' } }
    const wrapper = await mountSuspended(inApp(() => h(HomebrewPreview, { collection: 'weapons', record })))
    await flushPromises()
    const change = wrapper.find('[data-change="attack.Test Hand Cannon"]')
    expect(change.exists()).toBe(true)
    expect(change.text()).toMatch(/2d10/)
  })

  it('updates as the draft changes: a feat’s AC bonus', async () => {
    await ready()
    const record = ref<Record<string, unknown>>({ name: 'Tough', mechanics: [] })
    const wrapper = await mountSuspended(inApp(() => h(HomebrewPreview, { collection: 'feats', record: record.value })))
    await flushPromises()
    expect(wrapper.find('[data-change="ac"]').exists()).toBe(false)
    record.value = { name: 'Tough', mechanics: [{ type: 'ac', bonus: { type: 'flat', value: 2 } }] }
    await flushPromises()
    expect(wrapper.find('[data-change="ac"]').text()).toMatch(/→/)
  })
})

describe('the effects list', () => {
  it('shows an effect with no template as kept, and an offered one as its form', async () => {
    await ready()
    const wrapper = await mountSuspended(inApp(() => h(HomebrewEffects, { modelValue: [{ type: 'resistance', value: 'fire' }, { type: 'me:barrier', dieCount: 1 }] })))
    const effects = wrapper.findAll('[data-effect]')
    expect(effects).toHaveLength(2)
    expect(effects[0]!.find('[data-field="value"]').exists()).toBe(true)
    expect(effects[1]!.text()).toContain('me:barrier')
  })
})

describe('the homebrew form', () => {
  it('writes a field through its path and shows errors under it', async () => {
    await ready()
    const updates: Array<Record<string, unknown>> = []
    const record = { ...weapons.defaults(), name: 'X' }
    const wrapper = await mountSuspended(inApp(() => h(HomebrewForm, { kind: weapons, record, errors: { name: ['Name is required'] }, onUpdate: (r: Record<string, unknown>) => updates.push(r) })))
    const name = wrapper.find('[data-field="name"]')
    expect(name.text()).toContain('Name is required')
    await name.find('input').setValue('Hand Cannon')
    expect(updates.at(-1)).toMatchObject({ name: 'Hand Cannon', weaponType: 'heavy_pistol' })
  })
})

describe('the bookmark button', () => {
  it('keeps a signed-out reader’s bookmark in this browser', async () => {
    localStorage.clear()
    const wrapper = await mountSuspended(inApp(() => h(BookmarkButton, { type: 'powers', recordId: 'warp' })))
    await flushPromises()
    const button = wrapper.find('[data-bookmark]')
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem('omnibrew:me5e:bookmarks') ?? '[]')).toEqual([{ type: 'powers', recordId: 'warp' }])
    expect(wrapper.find('[data-bookmark]').attributes('aria-pressed')).toBe('true')
  })
})
