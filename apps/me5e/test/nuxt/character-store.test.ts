import { resolve } from 'node:path'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { newCharacter } from '@omnibrew/engine/character'
import { loadRules } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { me5e } from '../../game'

/**
 * The open character between pages: the router mounts the new page (which opens the
 * character) before the old one unmounts (which lets it go), so moving between the
 * builder and the sheet must keep it loaded. Local only (needs the content repo).
 */
const contentDir = resolve(import.meta.dirname, '../../../../../omnibrew-me5e-data')
const game = createGame(me5e)
const rules = loadRules(contentDir, me5e, game)

mockNuxtImport('useRules', () => () => Promise.resolve({ game, rules }))

describe('the character store', () => {
  it('keeps the character open while another page holds it', async () => {
    const local = useLocalCharacters()
    const { id } = local.create(newCharacter(me5e, 'Tester'))
    const store = useCharacterStore()
    const builder = Symbol('builder')
    const sheet = Symbol('sheet')

    await store.open(id, builder)
    expect(store.state).toBe('ready')

    // Builder → sheet: the sheet opens, then the builder unmounts.
    await store.open(id, sheet)
    await store.release(builder)
    expect(store.state).toBe('ready')
    expect(store.character?.name).toBe('Tester')

    // Sheet → builder, the other way round.
    await store.open(id, builder)
    await store.release(sheet)
    expect(store.state).toBe('ready')

    // Leaving for the list: nothing holds it any more.
    await store.release(builder)
    expect(store.state).toBe('idle')
    expect(store.character).toBeNull()
    local.remove(id)
  })
})
