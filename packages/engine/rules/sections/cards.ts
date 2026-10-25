import type { Sheet } from '../sheet'
import type { AttackAugments, AttackOption, Mech, Rec, SheetCard } from '../types'

/**
 * Sheet cards (actions, attacks, powers): attack augments, and what a card
 * prints, ported from the live site's `CsActions` mixin: hit bonus, save DC,
 * damage text, notes, and `{{ key }}` placeholders in short descriptions and
 * notes (`{{ dc }}`, `{{ damage }}`, `{{ profBonus + 2 }}`, `{{ powercastingMod:adept }}`).
 */
export interface AugmentQuery {
  attackType?: string
  /** `power` or `weapon`. */
  model?: string
  /** Power type or weapon type. */
  modelType?: string
  /** Ability of the attack, for augments that add "your ability modifier". */
  abilityMod?: string
}

export const emptyAugments = (): AttackAugments => ({ hit: 0, damage: 0, dc: 0, range: 0, reroll: 0, crit: 20, dieIncrease: 0, addCritDie: 0, notes: [], addDamage: [], options: [] })

/** An `ask` augment as a roll-dialog option. */
export function attackOption(m: Mech, bonus: number): AttackOption {
  const types = m.augmentTypes as string[]
  return {
    ask: m.ask,
    ...(m.source ? { source: m.source } : {}),
    hit: types.includes('hit') ? bonus : 0,
    damage: types.includes('damage') ? bonus : 0,
    dc: types.includes('dc') ? bonus : 0,
    addDamage: m.addDamage ?? [],
  }
}

/** `attack-augment` mechanics matching an attack (special-attack ones excluded), summed. */
export function matchingAugments(sheet: Sheet, q: AugmentQuery): AttackAugments {
  const out = emptyAugments()
  const matching = sheet.ofType('attack-augment').filter(m => (m.attackLimit?.type ? m.attackLimit.type === q.attackType : true)
    && (m.attackLimit?.model ? m.attackLimit.model === q.model : true)
    && (m.attackLimit?.modelTypes ? m.attackLimit.modelTypes.includes(q.modelType) : true)
    && !m.attackLimit?.special)
  for (const m of matching) {
    const bonus = m.abilityMod ? sheet.formula({ type: 'mod', value: q.abilityMod }) : sheet.formula(m.bonus)
    if (m.ask) {
      out.options.push(attackOption(m, bonus))
      continue
    }
    const reroll = m.rerollIfLessThan || 0
    const dieIncrease = m.dieIncrease || 0
    out.addDamage.push(...m.addDamage ?? [])
    for (const at of m.augmentTypes as Array<keyof AttackAugments>) {
      if (at === 'damage' && (reroll || dieIncrease)) {
        out.reroll = Math.max(reroll, out.reroll)
        out.dieIncrease += dieIncrease
      }
      if (at === 'damage') out.addCritDie += m.addCritDie || 0
      if (typeof out[at] === 'number') (out[at] as number) += bonus
    }
  }
  return out
}

/** Extra damage of augments as add-on rolls: merged into every roll, in the attack's damage type unless they name one. */
export function extraDamage(a: AttackAugments, damage: Rec[]): Rec[] {
  const type = damage.find(d => !d.addTo)?.type
  return a.addDamage.map(d => ({ ...d, type: d.type ?? type, addTo: 'all' }))
}

/**
 * Steps a die up the given die sizes. Past the largest die, each extra step is
 * +1 to the roll instead ("gain +1 if the die is a d12"). A die not in the
 * list doesn't change.
 */
export function dieIncrease(dieType: unknown, steps: number[], increase: number) {
  if (!increase || typeof dieType !== 'number' || !steps.includes(dieType)) return { dieType, overflow: 0 }
  const index = steps.indexOf(dieType) + increase
  if (index >= steps.length) return { dieType: steps.at(-1)!, overflow: index - (steps.length - 1) }
  return { dieType: steps[index]!, overflow: 0 }
}

/** Applies summed augments to a card's attack, DC and damage rolls (healing and add-on rolls excepted). */
export function augmentCard(sheet: Sheet, card: Rec, a: AttackAugments, steps: number[]): Rec {
  const out: Rec = {}
  if (a.hit && card.attack) out.attack = { ...card.attack, bonus: { type: 'flat', value: (card.attack.bonus ? sheet.formula(card.attack.bonus) : 0) + a.hit } }
  if (a.dc && card.dc) out.dc = { ...card.dc, bonus: { type: 'flat', value: (card.dc.bonus ? sheet.formula(card.dc.bonus) : 0) + a.dc } }
  if (card.damage && (a.damage || a.reroll || a.dieIncrease)) {
    const healing = sheet.enums.values.healingTypes ?? []
    out.damage = card.damage.map((d: Rec) => {
      if (healing.includes(d.type) || d.addTo) return d
      const { dieType, overflow } = dieIncrease(d.dieType, steps, a.dieIncrease)
      return { ...d, dieType, bonus: { type: 'flat', value: (d.bonus ? sheet.formula(d.bonus) : 0) + a.damage + overflow }, reroll: a.reroll }
    })
  }
  if (card.damage && a.addDamage.length) out.damage = [...out.damage ?? card.damage, ...extraDamage(a, card.damage)]
  if (a.options.length) out.options = a.options
  return out
}

/** Card mechanics with augments applied (the live `mechanicActions`). */
export function computeActions(sheet: Sheet): SheetCard[] {
  return sheet.ofType('attack', 'action', 'bonus-action', 'reaction', 'other').map((m: Mech) => {
    const augments = matchingAugments(sheet, { attackType: m.attack?.type, model: m.modelType?.model, modelType: m.modelType?.type, abilityMod: m.damage?.[0]?.mod })
    return { ...m, ...augmentCard(sheet, m, augments, [1, 4, 6, 8, 10, 12]), ...(augments.options.length ? { options: augments.options } : {}) }
  })
}

export interface ResolvedDamage {
  /** Dice and bonus per damage type: `{ piercing: { 8: 2, bonus: 3 } }`. */
  types: Record<string, Record<string, number>>
  reroll: number
  label?: string
  text: string
  healing: boolean
}

export interface ResolvedCard {
  /** Total attack bonus and crit range. */
  hit?: { bonus: number, crit: number, proficient: boolean, mod: string | false }
  /** Save DC and the save. */
  dc?: { target: number, save?: string, note?: string }
  range?: { short: number, long: number | null, aoe?: Rec | false }
  damages?: ResolvedDamage[]
  notes: Array<{ type: string, text: string, [k: string]: unknown }>
  /** Short description with placeholders filled. */
  shortDesc?: string
  /** Per-attack options for the roll dialog: the question, and what saying yes adds. */
  options?: Array<{ ask: string, hit?: number, dc?: number, damage?: string }>
}

function damageValues(sheet: Sheet, raw: Rec) {
  const d: Rec = { dieCount: 0, dieType: false, type: false, mod: false, bonus: false, reroll: false, label: false, ...raw }
  const dieType = typeof d.dieType === 'object' && d.dieType ? sheet.formula(d.dieType) : d.dieType
  const dieCount = typeof d.dieCount === 'object' && d.dieCount ? sheet.formula(d.dieCount) : d.dieCount
  const bonus = (d.bonus ? sheet.formula(d.bonus) : 0) + (d.mod ? sheet.abilities[d.mod]?.mod ?? 0 : 0)
  // A plain object, so die sizes print in ascending order before `none` and `bonus`, as on the live sheet.
  const values: Record<string, number> = { [dieType || 'none']: dieCount, bonus }
  return { types: { [d.type || 'damage']: values } as Record<string, Record<string, number>>, reroll: d.reroll || 0, label: d.label }
}

function mergeDamages(base: ReturnType<typeof damageValues>, add: ReturnType<typeof damageValues>) {
  const merged = { label: base.label, types: base.types, reroll: 0 }
  for (const [type, values] of Object.entries(add.types)) {
    if (!merged.types[type]) {
      merged.types[type] = values
      continue
    }
    // A zero entry is replaced, not added to (the live sheet tested truthiness).
    for (const [die, count] of Object.entries(values)) merged.types[type]![die] = merged.types[type]![die] ? merged.types[type]![die]! + (count || 0) : count
  }
  merged.reroll = Math.max(base.reroll, add.reroll)
  return merged
}

/** Dice and bonus of one damage type (`2d6 + 1d10 + 3`): dice ascending, as an object lists them. A flat roll prints its bonus alone ("15", not the live "0 + 15"). */
export function rollText(values: Record<string, number>) {
  let bonus = 0
  const dice: string[] = []
  for (const [die, count] of Object.entries(values)) {
    if (die === 'bonus') bonus = count
    else dice.push(`${count}${die === 'none' ? '' : `d${die}`}`)
  }
  const rolled = dice.filter(d => !/^0(?:d|$)/.test(d))
  return rolled.length ? `${rolled.join(' + ')}${bonus ? ` + ${bonus}` : ''}` : String(bonus || dice[0] || 0)
}

/** A damage roll as the sheet prints it; a roll without a type is "damage" (the live sheet printed "damage damage"). */
export function damageText(types: Record<string, Record<string, number>>) {
  return Object.entries(types).map(([type, values]) => `${rollText(values)}${type === 'damage' ? '' : ` ${type}`} damage`).join(' and ')
}

export function computeCard(sheet: Sheet, item: SheetCard): ResolvedCard {
  const out: ResolvedCard = { notes: [] }
  if (item.dc) {
    const dc = { base: 8, proficient: true, mod: false, save: false, bonus: false, ...item.dc }
    const target = (dc.bonus ? sheet.formula(dc.bonus) : 0) + (dc.mod ? sheet.abilities[dc.mod]?.mod ?? 0 : 0) + dc.base + (dc.proficient ? sheet.profBonus : 0)
    out.dc = { target, ...(dc.save ? { save: dc.save } : {}), ...(dc.note ? { note: dc.note } : {}) }
  }
  if (item.attack) {
    const hit = { mod: false, proficient: false, bonus: false, crit: 20, ...item.attack }
    const bonus = (hit.bonus ? sheet.formula(hit.bonus) : 0) + (hit.mod ? sheet.abilities[hit.mod]?.mod ?? 0 : 0) + (hit.proficient ? sheet.profBonus : 0)
    out.hit = { bonus, crit: hit.crit, proficient: !!hit.proficient, mod: hit.mod }
  }
  if (item.range) out.range = { short: 0, long: null, aoe: false, ...item.range }
  if (item.damage?.length) {
    let damages = item.damage.filter((d: Rec) => !d.addTo).map((d: Rec) => damageValues(sheet, d))
    for (const d of item.damage.filter((x: Rec) => x.addTo)) {
      const add = damageValues(sheet, d)
      if (d.addTo === 'base') damages[0] = mergeDamages(damages[0]!, add)
      else if (d.addTo === 'all') damages = damages.map((x: ReturnType<typeof damageValues>) => mergeDamages(x, add))
    }
    const healing = sheet.enums.values.healingTypes ?? []
    out.damages = damages.map((d: ReturnType<typeof damageValues>) => ({ ...d, text: damageText(d.types), healing: healing.some(h => Object.keys(d.types).includes(h)) }))
  }

  const rerolls = (out.damages ?? []).map(d => d.reroll).filter(Boolean).sort((a, b) => b - a)
  if (rerolls.length) out.notes.push({ type: 'icon', text: rerolls[0] === 3 ? 'Reroll 1s & 2s' : 'Reroll 1s', reroll: rerolls[0] })
  if (out.hit && out.hit.crit < 20) out.notes.push({ type: 'text', text: `Crit: ${out.hit.crit}+` })
  const fill = placeholders(sheet, item, out)
  if (Array.isArray(item.notes)) {
    for (const note of item.notes) {
      if (typeof note === 'string') {
        const text = fill(note)
        out.notes.push({ type: /<.+?>/.test(text) ? 'html' : 'text', text })
      }
      else out.notes.push(note)
    }
  }
  if (item.shortDesc) out.shortDesc = fill(item.shortDesc)
  if (Array.isArray(item.options) && item.options.length) {
    out.options = (item.options as AttackOption[]).map((o) => {
      const extra = [o.damage ? `${o.damage > 0 ? '+' : ''}${o.damage}` : '', ...o.addDamage.map(d => damageText(damageValues(sheet, { ...d, type: d.type ?? item.damage?.[0]?.type }).types))].filter(Boolean)
      return { ask: o.ask, ...(o.hit ? { hit: o.hit } : {}), ...(o.dc ? { dc: o.dc } : {}), ...(extra.length ? { damage: extra.join(' + ') } : {}) }
    })
  }
  return out
}

/** Fills `{{ key }}`, `{{ 2 + key }}` and `{{ formulaKind:value }}` placeholders. Unknown keys stay as written. */
function placeholders(sheet: Sheet, item: SheetCard, card: ResolvedCard) {
  const mod = (a: string) => sheet.abilities[a]?.mod as number
  const values: Record<string, string | number | null | undefined> = {
    dc: card.dc?.target,
    range: card.range?.short ? `:distance{length="${card.range.short}"}` : '',
    profBonus: sheet.profBonus,
    strMod: mod('str'),
    dexMod: mod('dex'),
    conMod: mod('con'),
    wisMod: mod('wis'),
    intMod: mod('int'),
    chaMod: mod('cha'),
    hp: sheet.hp.current,
    level: sheet.level,
    damage: card.damages?.[0]?.text,
    // The first roll without its type ("2d6 + 3"), for texts that name the type themselves (plan/18, B29 proposal).
    roll: card.damages?.[0] ? rollText(Object.values(card.damages[0].types)[0] ?? {}) : undefined,
    ...sheet.rules.placeholders?.(sheet, item),
  }
  const keys = Object.keys(values)
  const pattern = () => new RegExp(`{{ ?([0-9]{1,3}|[+ ]|${keys.join('|')}|powercastingMod:[a-z]+)+ ?}}`, 'g')
  const replacement = (key: string) => {
    if (key.includes(':')) {
      const [type, value] = key.split(':')
      return sheet.formula({ type: type!, value })
    }
    return values[key]
  }
  return (text: string) => text.replace(pattern(), (match) => {
    const key = match.replaceAll(/[{}]/g, '').trim()
    if (!key.includes('+')) return String(replacement(key))
    // Sums left to right; an unknown term resets the sum to 0, as the live sheet did.
    return String(key.split('+').map(s => s.trim()).reduce((acc: number, term) => {
      const n = Number.parseInt(term, 10)
      return Number.isNaN(n) ? (acc + Number.parseInt(String(replacement(term)), 10)) || 0 : acc + n
    }, 0))
  })
}
