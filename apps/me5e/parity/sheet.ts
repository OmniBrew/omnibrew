/**
 * What the parity test compares: the numbers and texts a character sheet shows,
 * normalized so the old store and the new engine can be diffed field by field.
 * Lists of cards (attacks, actions, powers, resources) are one line per card,
 * sorted, so a diff names the card and the value that differs.
 */
export interface ParityCard {
  name: string
  /** Attack bonus as shown (`+7`), with the crit range when below 20. */
  hit?: string
  /** Save DC and ability (`15 dex`). */
  dc?: string
  /** Damage lines as shown (`2d8 + 4 piercing damage`). */
  damage?: string[]
  /** Short description with `{{ }}` placeholders filled. */
  text?: string
  resource?: string
  range?: string
  extra?: string
}

export interface ParitySheet {
  level: number
  profBonus: number
  abilities: Record<string, string>
  saves: Record<string, string>
  skills: Record<string, string>
  initiative: string
  ac: number
  hp: string
  shields: string
  barrier: string
  speeds: Record<string, number | null>
  senses: Record<string, number>
  defenses: Record<string, string[]>
  profs: Record<string, string[]>
  powercasting: {
    abilities: Record<string, string | false>
    maxes: Record<string, string>
    slots: number[]
    points: string
    pact: string
    stats: string[]
  }
  powers: string[]
  attacks: Record<'attacks' | 'twf' | 'dt' | 'bf', string[]>
  actions: string[]
  resources: string[]
  setBonuses: string[]
  reputation: string[]
  capacities: string
  globalNotes: string[]
  armorPenalties: string
  extraAttacks: number
}

const join = (parts: Array<string | number | false | null | undefined>) => parts.filter(p => p !== undefined && p !== null && p !== false && p !== '').join(' | ')

export function cardLine(prefix: string, c: ParityCard) {
  return join([
    `${prefix}${c.name}`,
    c.hit && `hit ${c.hit}`,
    c.dc && `DC ${c.dc}`,
    c.damage?.length && `dmg ${c.damage.join(' / ')}`,
    c.range && `range ${c.range}`,
    c.resource && `res ${c.resource}`,
    c.text && `text ${c.text}`,
    c.extra,
  ])
}

export const sorted = (list: string[]) => [...list].sort()

/** `+3` / `-1`, as the sheet prints modifiers. */
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`)
