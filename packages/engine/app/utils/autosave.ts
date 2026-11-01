/**
 * Saving a character while it is played (plan/24 §1.6): each change marks it dirty,
 * and the save runs `delay` ms after the last change, or at once on `flush` (page
 * hidden, route left). A failed save retries with backoff and keeps the change; a
 * conflict stops until the page resolves it. Pure apart from timers, so tests drive it
 * with fake ones.
 */
export type SaveState = 'saved' | 'pending' | 'saving' | 'error' | 'conflict'

export interface SaverOptions<T> {
  save: (value: T) => Promise<void>
  /** Whether an error is a conflict (no retry). */
  isConflict?: (error: unknown) => boolean
  onState?: (state: SaveState, error?: unknown) => void
  delay?: number
  /** Retry delays after failures; the last repeats. */
  backoff?: number[]
}

export function createSaver<T>({ save, isConflict = () => false, onState = () => {}, delay = 1500, backoff = [2000, 5000, 15000, 30000] }: SaverOptions<T>) {
  let state: SaveState = 'saved'
  let latest: T | undefined
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | null = null
  let running: Promise<void> | null = null
  let failures = 0

  const set = (next: SaveState, error?: unknown) => {
    state = next
    onState(next, error)
  }

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  function schedule(ms: number) {
    clear()
    timer = setTimeout(() => void run(), ms)
  }

  async function run(): Promise<void> {
    clear()
    if (running) {
      // One save at a time; the newest value goes once this one ends.
      await running
      if (dirty && state !== 'conflict') return run()
      return
    }
    if (!dirty || state === 'conflict') return
    const value = latest as T
    dirty = false
    set('saving')
    running = (async () => {
      try {
        await save(value)
        failures = 0
        set(dirty ? 'pending' : 'saved')
        if (dirty) schedule(delay)
      }
      catch (error) {
        dirty = true
        if (isConflict(error)) {
          set('conflict', error)
          return
        }
        set('error', error)
        schedule(backoff[Math.min(failures, backoff.length - 1)]!)
        failures++
      }
    })()
    try {
      await running
    }
    finally {
      running = null
    }
  }

  return {
    get state() {
      return state
    },
    get dirty() {
      return dirty || state === 'saving'
    },
    /** A new value to save. */
    change(value: T) {
      latest = value
      dirty = true
      if (state === 'conflict') return
      set('pending')
      schedule(delay)
    },
    /** Saves now, if anything is waiting. */
    flush: () => run(),
    /** After a conflict: drop the waiting change (`theirs`) or save it anyway (`mine`, with `value` rebased). */
    resolve(choice: 'theirs' | 'mine', value?: T) {
      clear()
      failures = 0
      if (choice === 'theirs') {
        dirty = false
        set('saved')
        return Promise.resolve()
      }
      if (value !== undefined) latest = value
      dirty = true
      set('pending')
      return run()
    },
    /** Forget everything (the page closed the character). */
    reset() {
      clear()
      dirty = false
      latest = undefined
      set('saved')
    },
  }
}

export type Saver<T> = ReturnType<typeof createSaver<T>>
