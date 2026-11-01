import { critNotation, damageNotation, isDice, roll as rollDice, withAdvantage, type DiceTerm, type RollResult } from '../utils/dice'

/** A damage roll's dice per damage type, as the rules engine resolves them (`ResolvedDamage`). */
export interface DamageSpec {
  label?: string | false
  types: Record<string, Record<string, number>>
  reroll?: number
}

/** What the sheet asks to roll. */
export interface RollRequest {
  /** What rolled: an attack, power, skill ("Athletics"). */
  label: string
  /** i18n key under `sheet.roll.kind` (attack, damage, check, save, initiative, custom...). */
  kind: string
  notation: string
  advantage?: 'advantage' | 'disadvantage' | null
  /** Damage to offer after an attack roll (the live "Roll Damage" follow-up). */
  damage?: { damages: DamageSpec[], crit?: number, addCritDie?: number }
}

export interface RollEntry {
  id: string
  at: string
  label: string
  kind: string
  notation: string
  total: number
  /** Each die, for the log's breakdown. */
  dice: Array<{ sides: number, value: number, dropped?: boolean }>
  advantage?: 'advantage' | 'disadvantage'
  /** A natural roll at or above the crit range, or a natural 1. */
  crit?: boolean
  fumble?: boolean
  /** Damage parts (damage rolls). */
  parts?: Array<{ type: string, notation: string, total: number }>
  damage?: RollRequest['damage']
}

/** Rolls kept per character in this browser (the live site's logs, capped). */
export const ROLL_LOG_LIMIT = 200

/** Called after every roll (Discord webhooks hook in here in 3c-2). */
export type RollListener = (entry: RollEntry, characterId: string | null) => void

function toEntry(request: RollRequest, result: RollResult, extra: Partial<RollEntry> = {}): RollEntry {
  return {
    id: globalThis.crypto.randomUUID(),
    at: new Date().toISOString(),
    label: request.label,
    kind: request.kind,
    notation: result.notation,
    total: result.total,
    dice: result.terms.flatMap(t => (isDice(t.term) ? t.dice.map(d => ({ sides: (t.term as DiceTerm).sides, value: d.value, ...(d.dropped ? { dropped: true } : {}) })) : [])),
    ...(request.advantage ? { advantage: request.advantage } : {}),
    ...extra,
  }
}

/**
 * The sheet's dice (plan/24 §1.5): rolls, the log of the open character, and the
 * follow-up damage roll. Rolls work on view-only sheets too.
 */
export const useRollStore = defineStore('rolls', () => {
  const { $characterGame } = useNuxtApp()
  const characterId = ref<string | null>(null)
  const log = ref<RollEntry[]>([])
  const latest = ref<RollEntry | null>(null)
  const listeners: RollListener[] = []

  const key = (id: string) => `omnibrew:${$characterGame.id}:rolls:${id}`

  function read(id: string): RollEntry[] {
    try {
      return JSON.parse(localStorage.getItem(key(id)) ?? '[]') as RollEntry[]
    }
    catch {
      return []
    }
  }

  function write() {
    if (!characterId.value) return
    try {
      localStorage.setItem(key(characterId.value), JSON.stringify(log.value))
    }
    catch {
      // Storage full or blocked: the log stays for this visit.
    }
  }

  function use(id: string | null) {
    characterId.value = id
    log.value = id ? read(id) : []
    latest.value = null
  }

  function record(entry: RollEntry) {
    log.value = [entry, ...log.value].slice(0, ROLL_LOG_LIMIT)
    latest.value = entry
    write()
    for (const listener of listeners) listener(entry, characterId.value)
    return entry
  }

  /** Rolls a check, save, attack or custom notation. `crit` is the attack's crit range (20 by default). */
  function roll(request: RollRequest, crit = 20): RollEntry {
    const result = rollDice(withAdvantage(request.notation, request.advantage))
    const natural = result.natural
    return record(toEntry(request, result, {
      ...(natural !== undefined && request.damage && natural >= crit ? { crit: true } : {}),
      ...(natural === 1 && request.damage ? { fumble: true } : {}),
      ...(request.damage ? { damage: request.damage } : {}),
    }))
  }

  /** Rolls damage: every type of every damage spec; a crit doubles the dice (plus `addCritDie`). */
  function rollDamage(label: string, damages: DamageSpec[], options: { crit?: boolean, addCritDie?: number } = {}): RollEntry {
    const parts: NonNullable<RollEntry['parts']> = []
    const dice: RollEntry['dice'] = []
    let first = true
    for (const d of damages) {
      for (const [type, values] of Object.entries(d.types)) {
        let notation = damageNotation(values, d.reroll ?? 0)
        if (options.crit) notation = critNotation(notation, first ? options.addCritDie ?? 0 : 0)
        first = false
        const result = rollDice(notation)
        parts.push({ type, notation, total: result.total })
        dice.push(...toEntry({ label, kind: 'damage', notation }, result).dice)
      }
    }
    return record({
      id: globalThis.crypto.randomUUID(),
      at: new Date().toISOString(),
      label,
      kind: options.crit ? 'crit_damage' : 'damage',
      notation: parts.map(p => p.notation).join(' + '),
      total: parts.reduce((a, p) => a + p.total, 0),
      dice,
      parts,
    })
  }

  function clear() {
    log.value = []
    latest.value = null
    write()
  }

  function onRoll(listener: RollListener) {
    listeners.push(listener)
    return () => listeners.splice(listeners.indexOf(listener), 1)
  }

  return { characterId, log, latest, use, roll, rollDamage, clear, onRoll }
})
