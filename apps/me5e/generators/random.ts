/**
 * Random numbers for the generators: a source returning [0, 1), injected so tests are
 * seeded. The browser uses `crypto.getRandomValues`; tests use `seededRandom`.
 */
export type Random = () => number

/** The browser's (or Node's) cryptographic random numbers. */
export function cryptoRandom(): Random {
  const buffer = new Uint32Array(1)
  return () => {
    globalThis.crypto.getRandomValues(buffer)
    return buffer[0]! / 2 ** 32
  }
}

/** A repeatable source (mulberry32) for tests. */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

/** One item at random; undefined from an empty list. */
export function pick<T>(random: Random, list: readonly T[]): T | undefined {
  return list.length ? list[Math.floor(random() * list.length)] : undefined
}

/** One die: 1 to `sides`. */
export const rollDie = (random: Random, sides: number) => Math.floor(random() * sides) + 1

/** `1d6` → `{ count: 1, sides: 6 }`. */
export function parseDice(dice: string): { count: number, sides: number } | undefined {
  const m = /^(\d+)d(\d+)$/.exec(dice.trim())
  return m ? { count: Number(m[1]), sides: Number(m[2]) } : undefined
}

/** Rolls dice written as `2d4`: each die. */
export function rollDice(random: Random, dice: string): number[] {
  const d = parseDice(dice)
  return d ? Array.from({ length: d.count }, () => rollDie(random, d.sides)) : []
}

/** The average of `count` dice of `sides` (2d6 → 7), not rounded. */
export const averageDice = (sides: number | string | undefined, count: number | string | undefined) =>
  (Number.parseInt(String(count), 10) || 0) * (((Number.parseInt(String(sides), 10) || 0) + 1) / 2)

/** 5e ability modifier. */
export const abilityMod = (score: number | undefined) => Math.floor(((score ?? 10) - 10) / 2)
