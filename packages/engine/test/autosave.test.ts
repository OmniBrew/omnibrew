import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaver, type SaveState } from '../app/utils/autosave'
import { createLocalCharacters, isLocalId } from '../app/utils/local-characters'
import { newCharacter } from '../character'

class Conflict extends Error {}

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function setup(save = vi.fn(async (_v: number) => {})) {
    const states: SaveState[] = []
    const saver = createSaver<number>({ save, isConflict: e => e instanceof Conflict, onState: s => states.push(s), delay: 1500, backoff: [100, 200] })
    return { saver, save, states }
  }

  it('saves the last change after the delay', async () => {
    const { saver, save, states } = setup()
    saver.change(1)
    saver.change(2)
    await vi.advanceTimersByTimeAsync(1000)
    saver.change(3)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1500)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(3)
    expect(saver.state).toBe('saved')
    expect(states.at(-2)).toBe('saving')
  })

  it('flushes at once and saves a change made while saving', async () => {
    let finish!: () => void
    const save = vi.fn(() => new Promise<void>((r) => {
      finish = r
    }))
    const { saver } = setup(save)
    saver.change(1)
    const first = saver.flush()
    saver.change(2)
    expect(saver.dirty).toBe(true)
    finish()
    await first
    expect(saver.state).toBe('pending')
    await vi.advanceTimersByTimeAsync(1500)
    finish()
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenLastCalledWith(2)
    expect(saver.state).toBe('saved')
  })

  it('retries failures with backoff', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const { saver } = setup(save)
    saver.change(1)
    await saver.flush()
    expect(saver.state).toBe('error')
    await vi.advanceTimersByTimeAsync(100)
    expect(save).toHaveBeenCalledTimes(2)
    expect(saver.state).toBe('saved')
  })

  it('stops on a conflict until it is resolved', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Conflict()).mockResolvedValue(undefined)
    const { saver } = setup(save)
    saver.change(1)
    await saver.flush()
    expect(saver.state).toBe('conflict')
    saver.change(2)
    await vi.advanceTimersByTimeAsync(5000)
    expect(save).toHaveBeenCalledTimes(1)
    await saver.resolve('mine', 5)
    expect(save).toHaveBeenLastCalledWith(5)
    expect(saver.state).toBe('saved')
    saver.change(6)
    await saver.flush()
    expect(save).toHaveBeenLastCalledWith(6)
  })

  it('drops the change when the newer version wins', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Conflict())
    const { saver } = setup(save)
    saver.change(1)
    await saver.flush()
    await saver.resolve('theirs')
    expect(saver.state).toBe('saved')
    expect(saver.dirty).toBe(false)
  })
})

describe('local characters', () => {
  const memory = () => {
    const data = new Map<string, string>()
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
  }

  it('keeps characters per game', () => {
    const storage = memory()
    let t = 0
    const local = createLocalCharacters(storage, 'test', () => `2026-01-0${++t}`)
    const a = local.create(newCharacter({ id: 'test' }, 'A'))
    const b = local.create(newCharacter({ id: 'test' }, 'B'))
    expect(isLocalId(a.id)).toBe(true)
    expect(isLocalId('abc')).toBe(false)
    local.update(a.id, { ...a.character, name: 'A2' })
    expect(local.list().map(c => c.character.name)).toEqual(['A2', 'B'])
    expect(createLocalCharacters(storage, 'other').list()).toEqual([])
    local.remove(b.id)
    expect(local.get(b.id)).toBeNull()
    expect(() => local.update(b.id, b.character)).toThrow()
  })

  it('survives broken or missing storage', () => {
    const local = createLocalCharacters({ getItem: () => '{not json', setItem: () => {} }, 'test')
    expect(local.list()).toEqual([])
    expect(createLocalCharacters(null, 'test').available).toBe(false)
  })
})
