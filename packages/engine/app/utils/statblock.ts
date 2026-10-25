/**
 * Text for a creature's 5e stat block (the bestiary): ability modifiers, hit
 * points, saves, skills, senses, challenge, and its entries (features, attacks,
 * weapon attacks, power and item lists). Pure functions over an i18n `t`, shared
 * by the statblock components and the tests. The maths follow the ME5e site's
 * stat blocks (its MeNpc* components and NpcHelpers).
 */
import { commaList, type Translate } from './powers'

export interface StatDamage {
  dieCount?: number | string
  dieType?: number | string | false
  type?: string
  /** Add the attack's ability modifier. */
  mod?: boolean | string
}

export interface StatRange { short?: number, long?: number }

export interface StatDc {
  save?: string
  base?: number
  proficient?: boolean
  mod?: string
  bonus?: number | string
}

/** A power or item in a feature's list: an id, or the id with its uses. */
export interface StatListItem {
  id: string
  /** Cast at a higher level. */
  level?: number
  /** Item variant (grenade mark). */
  mark?: string
  perDay?: number | string
  uses?: number
}

/** A feature, action, reaction or legendary action. */
export interface StatEntry {
  id?: string
  name?: string
  text?: string
  hit?: string
  miss?: string
  target?: string
  attack?: string
  mod?: string
  proficient?: boolean
  range?: number | StatRange
  damage?: StatDamage[]
  dc?: StatDc | false
  save?: string
  recharge?: string | string[]
  perDay?: boolean | number | string
  perTurn?: boolean
  uses?: number
  cost?: number
  ref?: string
  weaponId?: string
  casterLevel?: number | string
  list?: (string | StatListItem)[]
  /** Weapon properties shown after the name: "M-8 Avenger (two-handed)". */
  props?: string[]
}

export interface StatEntries {
  features?: StatEntry[]
  actions?: StatEntry[]
  reactions?: StatEntry[]
  legendary?: { text?: string, actions?: StatEntry[] }
}

/** The bestiary record fields a stat block reads. */
export interface StatBlockData {
  path?: string
  name?: string
  size?: string
  type?: string
  alignment?: string
  ac?: number
  acNote?: string
  hp?: { dieCount: number, dieType: number }
  speed?: Record<string, number | string | undefined>
  abilityScores?: Record<string, number>
  savingThrows?: string[]
  skills?: string[]
  senses?: Record<string, number>
  irv?: { res?: string[], damImm?: string[], vul?: string[], conImm?: string[] }
  cr?: string
  profBonus?: number
  image?: string
  entries?: Record<string, unknown>
}

export interface StatWeapon {
  name?: string
  weaponType?: string
  damage?: StatDamage
  /** Property ids, or `{ id, value }` refs. */
  properties?: unknown[]
  range?: StatRange
}

/** How a game turns a weapon into a stat-block attack. */
export interface StatBlockRules {
  /** Weapon properties named after the attack's name. */
  titleProperties?: string[]
  /** Properties that let a weapon attack use the better of Str and Dex (default: finesse). */
  finesseProperties?: string[]
  /** Whether a weapon makes ranged attacks (default: it has a long range). */
  rangedWeapon?: (weapon: StatWeapon) => boolean
}

/** Records a stat block links to, by id. */
export interface StatBlockRefs {
  /** Challenge ratings (npc-stats), by id ("00500"). */
  challenge: Record<string, { cr: string, xp: number }>
  skills: Record<string, { name: string, link: string }>
  /** Condition names. */
  conditions: Record<string, string>
  weapons: Record<string, StatWeapon>
  powers: Record<string, { name: string, level: number }>
  /** Item (gear) names. */
  items: Record<string, string>
}

/** A labelled line of linked powers or items: "3/Day: decoy, overload (as a 2nd-level power)". */
export interface StatListLine {
  label: string
  links: { id: string, text: string, note?: string }[]
}

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** The modifier for an ability score: 12 → 1, 7 → -2 (0 when missing). */
export const abilityModifier = (score: number | string | undefined) =>
  score === undefined ? 0 : Math.floor((Number.parseInt(String(score), 10) - 10) / 2)

/** A modifier with its sign: "+1", "+0", "-2". */
export const modifierText = (n: number) => (n >= 0 ? `+${n}` : String(n))

/** A score with its modifier: "12 (+1)". */
export const abilityScoreText = (score: number) => `${score} (${modifierText(abilityModifier(score))})`

/** The six abilities in stat-block order, with the creature's scores. */
export const abilityScoreList = (scores?: Record<string, number> | null) =>
  ABILITY_ORDER.filter(a => scores?.[a] !== undefined).map(a => ({ ability: a, score: scores![a]! }))

/** The average of `dieCount` dice of `dieType`, rounded down. */
export function averageRoll(dieType: number | string | false | undefined, dieCount: number | string | undefined): number {
  const type = Number.parseInt(String(dieType), 10) || 0
  const count = Number.parseInt(String(dieCount), 10) || 0
  return Math.floor(count * ((type + 1) / 2))
}

/** Dice plus or minus a flat modifier: "2d6 + 1", "2d6 - 1", "2d6". */
export function diceFormula(t: Translate, dice: string, modifier: number): string {
  const type = modifier === 0 ? 'base' : modifier > 0 ? 'plus' : 'minus'
  return t(`dice_formulas.${type}`, { dice, n: Math.abs(modifier) })
}

/** Hit points from the hit dice and Constitution: "52 (8d8 + 16)". */
export function hitPointsText(t: Translate, hp: { dieCount: number, dieType: number }, con: number | undefined): string {
  const modifier = abilityModifier(con) * hp.dieCount
  const avg = averageRoll(hp.dieType, hp.dieCount) + modifier
  const dice = t('dice', { dieType: hp.dieType, dieCount: hp.dieCount })
  return t('dice_average', { avg, formula: diceFormula(t, dice, modifier) })
}

/** Armor class and what it's made of: "12 (natural armor)". */
export const armorClassText = (ac: number | undefined, note?: string) => `${ac ?? ''}${note ? ` (${note})` : ''}`

/** "Medium synthetic, lawful evil". */
export function creatureKindText(t: Translate, c: { size?: string, type?: string, alignment?: string }): string {
  const text = [c.size && t(`sizes.${c.size}`), c.type && t(`npc.types.${c.type}`).toLowerCase()].filter(Boolean).join(' ')
  const full = c.alignment ? `${text}, ${t(`alignments.${c.alignment}`)}` : text
  return full.charAt(0).toUpperCase() + full.slice(1)
}

/** Proficient saving throws, never below +0: "DEX +5, WIS +0". */
export function savingThrowsText(t: Translate, saves: string[], scores: Record<string, number>, profBonus: number): string {
  return commaList(t, saves.map(a => `${t(`abilities.${a}.abbr`)} +${Math.max(0, abilityModifier(scores[a]) + profBonus)}`))
}

/** Proficient skills; a trailing `*` doubles the proficiency bonus (expertise): "Perception +4". */
export function skillsText(t: Translate, skills: string[], scores: Record<string, number>, profBonus: number, info: StatBlockRefs['skills']): string {
  return commaList(t, skills.map((key) => {
    const id = key.replace('*', '')
    const skill = info[id]
    const bonus = profBonus * (key.includes('*') ? 2 : 1) + abilityModifier(skill ? scores[skill.link] : undefined)
    return `${skill?.name ?? id} ${modifierText(bonus)}`
  }))
}

/** 10 + Wisdom modifier, plus proficiency (doubled with expertise) in Perception. */
export function passivePerception(scores: Record<string, number>, profBonus: number, skills?: string[] | null): number {
  let bonus = 0
  if (skills?.includes('perception')) bonus = profBonus
  if (skills?.includes('perception*')) bonus = profBonus * 2
  return 10 + abilityModifier(scores.wis) + bonus
}

/** "Passive Perception 14, Infrared Vision 12m"; `distance` formats feet. */
export function sensesText(t: Translate, passive: number, senses: Record<string, number> | null | undefined, distance: (feet: number) => string): string {
  const parts = [`${t('passive_perception_title')} ${passive}`]
  for (const [key, feet] of Object.entries(senses ?? {})) parts.push(`${t(`senses.${key.replaceAll('-', '_')}_title`)} ${distance(feet)}`)
  return commaList(t, parts)
}

/** "12m, burrow 6m"; walking speed has no label, `note` is MDC (`:distance`), shown as written. */
export function speedText(t: Translate, speed: Record<string, number | string | undefined>, distance: (feet: number) => string): string {
  const parts = Object.entries(speed)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => (key === 'note' ? String(value) : [key === 'walk' ? '' : t(`speeds.${key}.label`), distance(Number(value))].filter(Boolean).join(' ')))
  return commaList(t, parts)
}

/** "Poison, Psychic". */
export const damageTypesText = (t: Translate, types: string[]) => commaList(t, types.map(d => t(`damage_types.${d}_title`)))

/** Condition names, in id order: "Charmed, Frightened". */
export const conditionsText = (t: Translate, ids: string[], names: Record<string, string>) => commaList(t, [...ids].sort().map(id => names[id] ?? id))

/** 120000 → "120,000". */
export const groupDigits = (n: number, separator: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, separator)

/** "1/2 (100 xp)". */
export function challengeText(t: Translate, row: { cr: string, xp: number } | undefined): string {
  return row ? t('npc.cr_text', { n: row.cr, xp: groupDigits(row.xp, t('digit_separator')) }) : ''
}

/** What limits an entry: "2/Day", "Recharge 5-6", "Costs 2 Actions", or the weapon properties. */
export function entryLimitation(t: Translate, e: StatEntry): string | undefined {
  if (e.uses) {
    if (e.perDay) return t('npc.uses_per_day', { amount: e.uses })
    if (e.perTurn) return t('npc.uses_per_turn', { amount: e.uses })
    return t('npc.uses', e.uses)
  }
  if (e.recharge) {
    if (e.recharge === 'short' || e.recharge === 'long') return t(`npc.rest_recharge.${e.recharge}`)
    const rolls = [e.recharge].flat()
    return t(`npc.recharges[${rolls.length}]`, rolls)
  }
  if (e.props?.length) return commaList(t, e.props)
  if (e.cost && e.cost > 1) return t('npc.legendary_cost', { n: e.cost })
  return undefined
}

/** An entry's name with its limitation, as a sentence: "Barrier (2/Day)." */
export function entryTitle(t: Translate, e: StatEntry): string {
  const name = e.name ?? ''
  const limitation = entryLimitation(t, e)
  return t('lists.sentences[1]', [limitation ? t('npc.feature_w_limitation', { name, limitation }) : name])
}

/** "+5 to hit", "-1 to hit". */
export const toHitText = (t: Translate, bonus: number) => t(`npc.to_hit.${bonus < 0 ? 'negative' : 'positive'}`, { n: Math.abs(bonus) })

/** One damage roll with its average: "8 (2d6 + 1)"; the modifier is added when the roll has `mod`. */
export function damageRollText(t: Translate, d: StatDamage, modifier: number): string {
  const added = d.mod ? modifier : 0
  const dice = t('dice', { dieType: d.dieType, dieCount: d.dieCount })
  return t('dice_average', { avg: averageRoll(d.dieType, d.dieCount) + added, formula: diceFormula(t, dice, added) })
}

/** A saving throw DC: `base` (default 8) + proficiency (unless `proficient: false`) + the ability modifier. */
export function saveDc(dc: StatDc, scores: Record<string, number>, profBonus: number): number {
  const bonus = Number(dc.bonus ?? 0) || 0
  return (dc.base ?? 8) + (dc.proficient === false ? 0 : profBonus) + (dc.mod ? abilityModifier(scores[dc.mod]) : 0) + bonus
}

/** "DC 13 Strength saving throw" for an entry with a `dc` or `save`, else undefined. */
export function entrySaveText(t: Translate, e: StatEntry, scores: Record<string, number>, profBonus: number): string | undefined {
  const dc: StatDc = { mod: e.mod, save: e.save, ...(e.dc || {}) }
  if (!dc.save) return undefined
  return t('npc.save_dc', { dc: saveDc(dc, scores, profBonus), ability: t(`abilities.${dc.save}.title`) })
}

const mdcLabel = (t: Translate, key: string) => `*${t('markdown_label', { label: t(`npc.${key}`) })}*`

/**
 * An attack's description as an MDC string (the entry's hit and miss texts are
 * MDC; see inlineTokens): "*Melee Weapon Attack:* +3 to hit, reach 2m, one target. *Hit:* 8
 * (2d6 + 1) bludgeoning damage." The to-hit bonus is the `mod` ability's
 * modifier plus proficiency (`proficient`); `range` is a reach (melee) or a
 * short range whose long range is 3x, unless a weapon gives both. `distance`
 * formats feet in the reader's units.
 */
export function attackDescription(t: Translate, e: StatEntry, scores: Record<string, number>, profBonus: number, distance: (feet: number | undefined) => string): string {
  const modifier = abilityModifier(e.mod ? scores[e.mod] : undefined)
  const short = typeof e.range === 'object' ? e.range.short : e.range
  const long = typeof e.range === 'object' ? e.range.long : e.range === undefined ? undefined : e.range * 3
  const reach = e.attack === 'melee'
    ? t('npc.range_types.reach', { range: distance(short) })
    : t('npc.range_types.range', { short: distance(short), long: distance(long) })
  // `target` is a target type key ("one") or written out.
  const target = e.target && /^[\w-]+$/.test(e.target) ? t(`npc.target_types.${e.target}`) : e.target
  const parts = [toHitText(t, modifier + (e.proficient ? profBonus : 0)), reach, target].filter((p): p is string => !!p)
  const sentences = [`${mdcLabel(t, `attack_types.${e.attack}`)} ${commaList(t, parts)}`]

  const damage = (e.damage ?? []).map(d => `${damageRollText(t, d, modifier)} ${t(`damage_types.${d.type}_damage`)}`)
  if (damage.length) {
    sentences.push(`${mdcLabel(t, 'hit_title')} ${t(`lists.and_list[${damage.length}]`, damage)}`)
    if (e.hit) sentences.push(e.hit.trim())
  }
  else if (e.hit) {
    sentences.push(`${mdcLabel(t, 'hit_title')} ${e.hit.trim()}`)
  }
  if (e.miss) sentences.push(`${mdcLabel(t, 'miss_title')} ${e.miss.trim()}`)
  const save = entrySaveText(t, e, scores, profBonus)
  if (save) sentences.push(save)
  return t(`lists.sentences[${sentences.length}]`, sentences)
}

const propertyId = (p: unknown) => (typeof p === 'string' ? p : String((p as { id?: unknown }).id ?? ''))

/**
 * A weapon action (`ref: weapon`) as an attack entry: the weapon's name, range
 * and damage (plus the ability modifier), and its notable properties. The
 * ability is the entry's `mod`, else the better of Str and Dex for finesse
 * weapons, else Str for melee and Dex for ranged.
 */
export function weaponAttackEntry(e: StatEntry, weapon: StatWeapon, scores: Record<string, number>, rules: StatBlockRules = {}): StatEntry {
  const props = (weapon.properties ?? []).map(propertyId)
  const ranged = rules.rangedWeapon ? rules.rangedWeapon(weapon) : weapon.range?.long !== undefined
  const attack = ranged ? 'ranged' : 'melee'
  let mod = e.mod
  if (!mod) {
    const finesse = rules.finesseProperties ?? ['finesse']
    if (props.some(p => finesse.includes(p))) mod = abilityModifier(scores.str) > abilityModifier(scores.dex) ? 'str' : 'dex'
    else mod = ranged ? 'dex' : 'str'
  }
  const shown = props.filter(p => rules.titleProperties?.includes(p))
  return {
    id: e.id,
    name: weapon.name,
    attack,
    props: shown.length ? shown : undefined,
    range: weapon.range,
    proficient: e.proficient,
    damage: weapon.damage ? [{ ...weapon.damage, mod: true }] : [],
    mod,
    target: 'one',
    hit: e.hit,
    miss: e.miss,
  }
}

/** The entries to show: unnamed entries are left out unless they point at a weapon. */
export const shownEntries = (entries: StatEntry[] = []) => entries.filter(e => e.name || (e.ref === 'weapon' && e.weaponId))

/** Actions with Multiattack first. */
export const sortActions = (actions: StatEntry[] = []) => [...actions.filter(a => a.id === 'multiattack'), ...actions.filter(a => a.id !== 'multiattack')]

/** Legendary actions by cost, then name. */
export const sortLegendary = (actions: StatEntry[] = []) => [...actions].sort((a, b) => {
  const cost = (a.cost ?? 1) - (b.cost ?? 1)
  if (cost) return cost
  const [an, bn] = [a.name ?? '', b.name ?? '']
  return an === bn ? 0 : an > bn ? 1 : -1
})

/**
 * What a feature's `list` holds: with `ref: power`, `leveled` powers (plain
 * ids, cast with slots) or `innate` powers (with uses per day); without it,
 * `items` (with uses: grenades).
 */
export function entryListKind(e: StatEntry): 'leveled' | 'innate' | 'items' | undefined {
  if (!e.list?.length) return undefined
  if (e.ref !== 'power') return 'items'
  return e.list.every(i => typeof i === 'string') ? 'leveled' : 'innate'
}

const listItems = (e: StatEntry): StatListItem[] => (e.list ?? []).map(i => (typeof i === 'string' ? { id: i } : i))

/** Innate powers grouped by uses per day ("At Will:", "3/Day:"), with higher-level casts noted. */
export function innatePowerLines(t: Translate, e: StatEntry, powers: StatBlockRefs['powers']): StatListLine[] {
  const groups = new Map<string, StatListLine['links']>()
  for (const item of listItems(e)) {
    const power = powers[item.id]
    if (!power) continue
    const key = String(item.perDay)
    const note = item.level
      ? `(${t('npc.higher_power_level', { level_adj: t('level_adj', { nth: t(`ordinal_numbers[${item.level}]`) }) })})`
      : undefined
    groups.set(key, [...(groups.get(key) ?? []), { id: item.id, text: power.name.toLowerCase(), note }])
  }
  const order = (key: string) => (key === 'at_will' ? 0 : Number(key))
  return [...groups.entries()]
    .sort(([a], [b]) => order(a) - order(b))
    .map(([key, links]) => ({ label: t('markdown_label', { label: key === 'at_will' ? t('npc.at_will') : t('npc.uses_per_day', { amount: key }) }), links }))
}

/**
 * Powers cast with slots: cantrips at will, then one line per power level the
 * caster has slots for. `slots[level - 1][casterLevel - 1]` is the slot count
 * (a full caster's progression).
 */
export function leveledPowerLines(t: Translate, e: StatEntry, powers: StatBlockRefs['powers'], slots: number[][] = []): StatListLine[] {
  const known = listItems(e).map(i => i.id).filter(id => powers[id]).sort()
  if (!known.length) return []
  const link = (id: string) => ({ id, text: powers[id]!.name.toLowerCase() })
  const lines: StatListLine[] = []
  const cantrips = known.filter(id => powers[id]!.level === 0)
  if (cantrips.length) lines.push({ label: t('markdown_label', { label: `${t('class_feature_columns.cantrips')} (${t('npc.at_will')})` }), links: cantrips.map(link) })
  const casterLevel = Number.parseInt(String(e.casterLevel ?? 0), 10) || 0
  slots.forEach((row, index) => {
    const count = row[casterLevel - 1] ?? 0
    if (!count) return
    const level = index + 1
    const name = t('level_nth', { nth: t(`ordinal_numbers[${level}]`) })
    lines.push({
      label: t('markdown_label', { label: t('npc.feature_w_limitation', { name, limitation: t('npc.slots', count) }) }),
      links: known.filter(id => powers[id]!.level === level).map(link),
    })
  })
  return lines
}

/** Items grouped by uses ("2 uses:"), named with their mark: "frag grenade III". */
export function itemUseLines(t: Translate, e: StatEntry, items: StatBlockRefs['items']): StatListLine[] {
  const groups = new Map<number, StatListLine['links']>()
  for (const item of listItems(e)) {
    const name = items[item.id]
    if (!name) continue
    const uses = item.uses ?? 0
    const text = `${name.toLowerCase()}${item.mark ? ` ${t(`marks.${item.mark}`)}` : ''}`
    groups.set(uses, [...(groups.get(uses) ?? []), { id: item.id, text }])
  }
  return [...groups.entries()].sort(([a], [b]) => a - b).map(([uses, links]) => ({ label: `${t('npc.uses', uses)}:`, links }))
}

/** A record's entries, typed. */
export const statEntries = (stats: StatBlockData) => (stats.entries ?? {}) as StatEntries

/** Every entry of a stat block, legendary actions included. */
export function allEntries(stats: StatBlockData): StatEntry[] {
  const e = statEntries(stats)
  return [...(e.features ?? []), ...(e.actions ?? []), ...(e.reactions ?? []), ...(e.legendary?.actions ?? [])]
}

/** The weapons, powers and items a stat block refers to, by id. */
export function statBlockRefIds(stats: StatBlockData): { weapons: string[], powers: string[], items: string[] } {
  const ids = { weapons: new Set<string>(), powers: new Set<string>(), items: new Set<string>() }
  for (const e of allEntries(stats)) {
    if (e.ref === 'weapon' && e.weaponId) ids.weapons.add(e.weaponId)
    const kind = entryListKind(e)
    if (kind) for (const item of listItems(e)) (kind === 'items' ? ids.items : ids.powers).add(item.id)
  }
  return { weapons: [...ids.weapons], powers: [...ids.powers], items: [...ids.items] }
}

export type InlineToken =
  | { type: 'text' | 'em' | 'strong', value: string }
  | { type: 'component', name: string, props: Record<string, string | true> }

const attributes = (attrs: string): Record<string, string | true> =>
  Object.fromEntries([...attrs.matchAll(/([\w-]+)(?:="([^"]*)"|=(\S+))?/g)].map(m => [m[1]!, m[2] ?? m[3] ?? true]))

/**
 * Splits a stat-block string (MDC) into text, `*emphasis*`, `**strong**` and
 * inline prose components (`:distance{length="10" adj}`), so it renders without
 * the markdown parser. Undefined when the string uses any other markdown.
 */
export function inlineTokens(text: string): InlineToken[] | undefined {
  const tokens: InlineToken[] = []
  let last = 0
  for (const m of text.matchAll(/\*\*([^*]+)\*\*|\*([^*]+)\*|:([a-z][\w-]*)\{([^}]*)\}/gi)) {
    if (m.index > last) tokens.push({ type: 'text', value: text.slice(last, m.index) })
    if (m[1] !== undefined) tokens.push({ type: 'strong', value: m[1] })
    else if (m[2] !== undefined) tokens.push({ type: 'em', value: m[2] })
    else tokens.push({ type: 'component', name: m[3]!, props: attributes(m[4]!) })
    last = m.index + m[0].length
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) })
  const plain = tokens.every(t => t.type !== 'text' || !/[*_`[\]<>#|\\]|\n\s*\n/.test(t.value))
  return plain ? tokens : undefined
}

/** Damage immunities (`damImm`). */
export const damageImmunities = (irv?: StatBlockData['irv'] | null) => irv?.damImm ?? []
