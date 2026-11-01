/**
 * Dice for the character sheet (plan/24 §1.5): a small parser in place of the live
 * site's rpg-dice-roller. Notation: terms joined by `+` or `-`, each a flat number or
 * `NdM` with optional `khK`/`klK` (keep highest/lowest K), `ro<X` (reroll a die below X
 * once) and `minX` (a die below X counts as X): `1d20+5`, `2d20kh1+3`, `2d6ro<3`,
 * `3d8min2`, `2d6+1d4-1`. Pure apart from the
 * random source, which tests replace.
 */
export type RandomInt = (sides: number) => number

/** A uniform roll from 1 to `sides` (rejection sampling over crypto random bytes). */
export const cryptoDie: RandomInt = (sides) => {
  if (sides <= 1) return 1
  const limit = Math.floor(0x1_0000_0000 / sides) * sides
  const buf = new Uint32Array(1)
  do globalThis.crypto.getRandomValues(buf)
  while (buf[0]! >= limit)
  return (buf[0]! % sides) + 1
}

export interface DiceTerm {
  sign: 1 | -1
  count: number
  sides: number
  keep?: { highest: boolean, n: number }
  /** Reroll once a die below this. */
  reroll?: number
  min?: number
}

export interface FlatTerm {
  sign: 1 | -1
  value: number
}

export type Term = DiceTerm | FlatTerm

export const isDice = (t: Term): t is DiceTerm => 'sides' in t

const TERM = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?(?:ro<(\d+))?(?:min(\d+))?$/i

/** Parses a notation; throws on anything else. */
export function parseNotation(notation: string): Term[] {
  const src = notation.replace(/\s+/g, '')
  if (!src) throw new Error('empty dice notation')
  const parts = src.match(/[+-]?[^+-]+/g) ?? []
  if (parts.join('') !== src) throw new Error(`bad dice notation: ${notation}`)
  return parts.map((part) => {
    const sign = part.startsWith('-') ? -1 : 1
    const body = part.replace(/^[+-]/, '')
    if (/^\d+$/.test(body)) return { sign, value: Number(body) }
    const m = TERM.exec(body)
    if (!m) throw new Error(`bad dice notation: ${notation}`)
    const count = m[1] ? Number(m[1]) : 1
    const sides = Number(m[2])
    if (count < 1 || count > 100 || sides < 1 || sides > 1000) throw new Error(`dice out of range: ${part}`)
    const term: DiceTerm = { sign, count, sides }
    if (m[3]) term.keep = { highest: m[3].toLowerCase() === 'kh', n: Math.min(Number(m[4]), count) }
    if (m[5]) term.reroll = Number(m[5])
    if (m[6]) term.min = Number(m[6])
    return term
  })
}

/** Whether a notation parses. */
export function isNotation(notation: string) {
  try {
    parseNotation(notation)
    return true
  }
  catch {
    return false
  }
}

export interface DieResult {
  value: number
  /** Dropped by keep highest/lowest. */
  dropped?: boolean
  /** Raised to the `min`. */
  raised?: boolean
  /** Rerolled (`ro<X`): the first roll. */
  rerolledFrom?: number
}

export interface TermResult {
  term: Term
  dice: DieResult[]
  total: number
}

export interface RollResult {
  notation: string
  terms: TermResult[]
  total: number
  /** The kept d20 of a lone `1d20`/`2d20kh1` term: 20 is a crit, 1 a fumble. */
  natural?: number
}

export function roll(notation: string, random: RandomInt = cryptoDie): RollResult {
  const terms = parseNotation(notation).map((term): TermResult => {
    if (!isDice(term)) return { term, dice: [], total: term.sign * term.value }
    const dice: DieResult[] = Array.from({ length: term.count }, () => {
      const first = random(term.sides)
      const value = term.reroll && first < term.reroll ? random(term.sides) : first
      const out: DieResult = term.min && value < term.min ? { value: term.min, raised: true } : { value }
      if (value !== first || (term.reroll && first < term.reroll)) out.rerolledFrom = first
      return out
    })
    if (term.keep) {
      const order = dice.map((d, i) => ({ d, i })).sort((a, b) => (term.keep!.highest ? b.d.value - a.d.value : a.d.value - b.d.value))
      order.slice(term.keep.n).forEach(({ d }) => (d.dropped = true))
    }
    return { term, dice, total: term.sign * dice.filter(d => !d.dropped).reduce((a, d) => a + d.value, 0) }
  })
  const d20 = terms.filter(t => isDice(t.term) && t.term.sides === 20)
  const natural = d20.length === 1 && d20[0]!.dice.filter(d => !d.dropped).length === 1 ? d20[0]!.dice.find(d => !d.dropped)!.value : undefined
  return { notation, terms, total: terms.reduce((a, t) => a + t.total, 0), ...(natural !== undefined ? { natural } : {}) }
}

/** `1d20+5` with advantage (`2d20kh1+5`) or disadvantage (`2d20kl1+5`). */
export function withAdvantage(notation: string, mode: 'advantage' | 'disadvantage' | null | undefined) {
  if (!mode) return notation
  return notation.replace(/^1?d20(?![\dk])/i, mode === 'advantage' ? '2d20kh1' : '2d20kl1')
}

/** Doubles every die count (a critical hit's damage). */
export function critNotation(notation: string, extraDice = 0) {
  let added = false
  return parseNotation(notation).map((t, i) => {
    const sign = t.sign < 0 ? '-' : (i ? '+' : '')
    if (!isDice(t)) return `${sign}${t.value}`
    const extra = !added && extraDice ? extraDice : 0
    added ||= extra > 0
    return `${sign}${t.count * 2 + extra}d${t.sides}${t.keep ? `${t.keep.highest ? 'kh' : 'kl'}${t.keep.n}` : ''}${t.reroll ? `ro<${t.reroll}` : ''}${t.min ? `min${t.min}` : ''}`
  }).join('')
}

/** `+3`, `-1`, `+0`: a bonus as printed after a die. */
export const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`)

/**
 * Notation of one damage type's dice as the rules engine gives them
 * (`ResolvedDamage.types[type]`: die size → count, `none` → flat, `bonus`).
 */
export function damageNotation(values: Record<string, number>, reroll = 0) {
  const parts: string[] = []
  for (const [die, count] of Object.entries(values)) {
    if (die === 'bonus' || die === 'none' || !(count > 0)) continue
    parts.push(`${count}d${die}${reroll > 1 ? `ro<${reroll}` : ''}`)
  }
  // A flat amount (no die, as unarmed strikes) prints before the bonus, as on the live sheet: `1+2`.
  if (values.none) parts.push(String(values.none))
  const bonus = Number(values.bonus) || 0
  if (bonus || !parts.length) parts.push(parts.length ? signed(bonus) : String(bonus))
  return parts.join('+').replace(/\+(?=[+-])/g, '')
}
