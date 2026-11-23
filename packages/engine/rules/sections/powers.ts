import { mergeDeep } from '../../schemas/primitives'
import type { Sheet } from '../sheet'
import type { Mech, Rec } from '../types'
import { augmentCard, dieIncrease, matchingAugments } from './cards'

export interface ClassPowercasting {
  numPowers: number
  maxPowerLevel: number
  numCantrips: number
  /** Powers are learned (known) rather than prepared. */
  learned: boolean
  /** `slots` or `points`. */
  powercastingType: 'slots' | 'points' | null
}

export interface Powercasting {
  /** Casting ability per class (`false`: the class has none). */
  abilities: Record<string, string | false>
  byClass: Record<string, ClassPowercasting>
  /** Slots per slot level (`"1"`...). */
  slots: Record<string, { max: number, used: number }>
  /** Points per points pool (`points:tech`): max, used and the most one casting may spend. */
  points: Record<string, { max: number, used: number, limit: number }>
  pact: { slotLevel: number, numSlots: number }
}

/** A power the character can cast, at one level (leveled powers list every level they upcast to). */
export interface PowerCard extends Rec {
  id: string
  name: string
  level: number
  upcast: boolean
  mod: string | false
  source?: string
}

interface ClassFeature { klassId: string, powercasting: Rec }

/** Each class's powercasting mechanic (its first feature with one, subclass features included). */
function castingFeatures(sheet: Sheet): ClassFeature[] {
  const out: ClassFeature[] = []
  for (const klass of sheet.classes) {
    const feature = klass.features.find(f => (f.mechanics ?? []).some((m: Rec) => m.type.startsWith('powercasting')))
    if (feature) out.push({ klassId: feature.klass, powercasting: feature.mechanics.find((m: Rec) => m.type.startsWith('powercasting')) })
  }
  return out
}

/** Multiclass caster level for one casting kind: Σ class levels × conversion, rounded down. */
function multiclassLevel(sheet: Sheet, features: ClassFeature[], type: string) {
  return Math.floor(features.filter(f => f.powercasting.type === type).reduce((a, f) => a + sheet.classLevels(f.klassId) * f.powercasting.multiclassConversion, 0))
}

export function computePowercasting(sheet: Sheet): Powercasting {
  const tables = sheet.rules.powers.multiclass
  const features = castingFeatures(sheet)
  const multiclassed = sheet.classes.length > 1
  const level = sheet.level
  const state = sheet.character.state

  const pools = sheet.powerSystem.pools
  const pointsPool = (m: Rec) => m.pool ?? pools.find(p => p.kind === 'points')?.id ?? 'points'
  const points: Powercasting['points'] = {}
  for (const pool of pools.filter(p => p.kind === 'points')) points[pool.id] = { max: 0, used: state.pointsUsed[pool.id] ?? 0, limit: 0 }
  if (multiclassed) {
    const mcLevel = multiclassLevel(sheet, features, 'powercasting-points')
    if (mcLevel > 0) {
      const id = pointsPool(features.find(f => f.powercasting.type === 'powercasting-points')!.powercasting)
      points[id] = { used: points[id]?.used ?? 0, max: tables.points[mcLevel - 1] ?? 0, limit: tables.pointLimit[mcLevel - 1] ?? 0 }
    }
  }
  else {
    const f = features.find(i => i.powercasting.type === 'powercasting-points')
    if (f) {
      const id = pointsPool(f.powercasting)
      points[id] = { used: state.pointsUsed[id] ?? 0, max: f.powercasting.points[level - 1], limit: f.powercasting.limit?.[level - 1] }
    }
  }

  const pact = { slotLevel: 0, numSlots: 0 }
  if (multiclassed) {
    const mcLevel = multiclassLevel(sheet, features, 'powercasting-pact')
    if (mcLevel > 0) {
      pact.slotLevel = tables.pactSlotLevel[mcLevel - 1] ?? 0
      pact.numSlots = tables.pactSlots[mcLevel - 1] ?? 0
    }
  }
  else {
    const f = features.find(i => i.powercasting.type === 'powercasting-pact')
    if (f) {
      pact.slotLevel = f.powercasting.slotLevel[level - 1]
      pact.numSlots = f.powercasting.numSlots[level - 1]
    }
  }

  const slots: Powercasting['slots'] = {}
  const slotLevels = tables.slots.map((_, i) => i + 1)
  for (const l of slotLevels) slots[l] = { max: 0, used: state.slotsUsed[l] ?? 0 }
  if (multiclassed) {
    const mcLevel = multiclassLevel(sheet, features, 'powercasting-slots')
    if (mcLevel > 0) for (const l of slotLevels) slots[l]!.max = tables.slots[l - 1]![mcLevel - 1] ?? 0
  }
  else {
    const f = features.find(i => i.powercasting.type === 'powercasting-slots')
    if (f) for (const l of slotLevels) if (f.powercasting.slots[l]) slots[l]!.max = f.powercasting.slots[l][level - 1]
  }
  if (pact.slotLevel > 0) slots[pact.slotLevel] = { used: slots[pact.slotLevel]?.used ?? 0, max: (slots[pact.slotLevel]?.max ?? 0) + pact.numSlots }

  // Casting ability: typed on the sheet, else picked, else the subclass's, else the class's.
  const abilities: Record<string, string | false> = {}
  const picks = sheet.character.choices.filter(c => c.path.includes('powercasting'))
  for (const klass of sheet.classes) {
    const typed = sheet.character.overrides.powercasting[klass.id]
    const picked = picks.find(c => c.path.includes(klass.id))?.values[0]
    let subclass: string | undefined
    if (klass.subclass) {
      const f = klass.features.filter(i => i.subclass === klass.subclass).find(i => (i.mechanics ?? []).some((m: Rec) => m.type.startsWith('powercasting')))
      subclass = f?.mechanics.find((m: Rec) => m.type.startsWith('powercasting'))?.mod
    }
    abilities[klass.id] = typed || (typeof picked === 'string' ? picked : undefined) || subclass || sheet.rules.powers.classAbility[klass.id] || false
  }

  const byClass: Record<string, ClassPowercasting> = {}
  for (const klass of sheet.classes) {
    const out: ClassPowercasting = { numPowers: 0, maxPowerLevel: -1, numCantrips: 0, learned: true, powercastingType: null }
    const n = klass.levels - 1
    const pc = klass.features.find(f => f.klass === klass.id && f.mechanics?.some((m: Rec) => m.type.startsWith('powercasting')))?.mechanics.find((m: Rec) => m.type.startsWith('powercasting'))
    if (pc) {
      if (pc.known) out.numPowers = pc.known[n]
      if (pc.prepared) {
        let num = Math.floor(pc.prepared.levelMultiplier * klass.levels)
        if (pc.prepared.modBonus) {
          const ability = abilities[klass.id]
          num += ability ? sheet.abilities[ability]?.mod ?? 0 : Number.NaN
        }
        out.numPowers = Math.max(1, num)
        out.learned = false
      }
      if (pc.type.endsWith('pact')) {
        out.maxPowerLevel = pc.slotLevel[n]
        out.powercastingType = 'slots'
      }
      if (pc.type.endsWith('points')) {
        out.maxPowerLevel = pc.limit?.[n] ?? pc.maxPowerLevel?.[n]
        out.powercastingType = 'points'
      }
      if (pc.type.endsWith('slots')) {
        out.maxPowerLevel = Math.max(...Object.entries(pc.slots as Record<string, number[]>).filter(([, v]) => v[n]! > 0).map(([k]) => Number.parseInt(k, 10)))
        out.powercastingType = 'slots'
      }
    }
    const cantrips = klass.features.find(f => f.klass === klass.id && f.mechanics?.some((m: Rec) => m.type === 'cantrips'))?.mechanics.find((m: Rec) => m.type === 'cantrips')
    if (cantrips) {
      out.numCantrips = cantrips.known[n] + sheet.ofType('additional-cantrips').reduce((a, m) => a + sheet.formula(m.bonus), 0)
    }
    byClass[klass.id] = out
  }
  return { abilities, byClass, slots, points, pact }
}

interface SelectedPower extends Rec {
  id: string
  klass?: string
  advancement?: string | null
  source?: string
}

/** Learned powers, plus powers granted by mechanics (with the advancement picked for them, if any). */
export function selectedPowers(sheet: Sheet): SelectedPower[] {
  const unusedAdvancements = sheet.unusedChoices.flatMap(c => c.values).filter((v): v is { power: string, advancement: string } => typeof v === 'object' && 'power' in v).map(v => ({ id: v.power, value: v.advancement }))
  const advancements = [...sheet.ofType('advancement'), ...unusedAdvancements]
  const granted = sheet.ofType('powers').map((m): SelectedPower => {
    const advancement = advancements.find(a => m.value === a.id)
    const provider = m.provider ? sheet.content.get(m.provider.model, m.provider.id) : undefined
    return { ...m, id: m.value, path: m.source, source: provider?.name ?? '', advancement: advancement?.value }
  })
  return [...sheet.character.powers.map(p => ({ id: p.id, klass: p.class ?? undefined, advancement: p.advancement })), ...granted]
}


/** A bonus plus a sheet override: two flat bonuses sum; anything else becomes a `multi` formula. A bonus an upcast entry wrote without a type is flat. */
export function addBonus(bonus: unknown, n: number): Rec {
  const own = bonus && typeof bonus === 'object' ? ((bonus as Rec).type ? bonus as Rec : { type: 'flat', ...(bonus as Rec) }) : undefined
  if (!own) return { type: 'flat', value: n }
  if (!n) return own
  if (own.type === 'flat' && typeof own.value === 'number') return { type: 'flat', value: own.value + n }
  return { type: 'multi', value: [own, { type: 'flat', value: n }] }
}

const merge = (...parts: Array<Rec | null | undefined>) => parts.reduce<Rec>((a, p) => (p ? mergeDeep(a, p) as Rec : a), {})

export function computePowers(sheet: Sheet): PowerCard[] {
  const out: PowerCard[] = []
  const rules = sheet.rules.powers
  const overrides = sheet.character.overrides
  const powerAugments = sheet.ofType('power-augment')
  const augmentsById = new Map<string, Mech[]>()
  for (const p of selectedPowers(sheet)) {
    const power = sheet.content.get('powers', p.id)
    if (!power) continue
    const casting: Rec[] = power.casting ?? []
    let base = p.merge ? mergeDeep(structuredClone(casting[0]), structuredClone(p.merge)) as Rec : casting[0]!
    // `power-augment`s matching this power: their merges join the casting before anything reads it.
    const augmenting = powerAugments.filter(m => matchesPower(m, power, base))
    for (const m of augmenting) if (m.merge) base = mergeDeep(structuredClone(base), structuredClone(m.merge)) as Rec
    if (augmenting.length) augmentsById.set(power.id, augmenting)
    const mod = p.mod || (p.klass ? sheet.powercastingAbilities[p.klass] : undefined) || rules.typeAbility[power.powerType] || false
    const attackMod = base.attack?.mod === 'pc' ? false : base.attack?.mod
    const dcMod = base.dc?.mod === 'pc' ? false : base.dc?.mod
    // The power's own attack, DC and damage bonuses stay on the card; the sheet's power overrides
    // are added once every upcast tier is merged (Q27: live replaced the power's own bonus).
    const attack = base.attack ? { ...base.attack, mod: attackMod || mod } : false
    const dc = base.dc ? { ...base.dc, mod: dcMod || mod } : false
    const damage = base.damage ? base.damage.map((d: Rec) => (d.mod === 'pc' ? { ...d, mod } : d)) : false
    const advancement = p.advancement ? (power.advancements ?? []).find((a: Rec) => a.id === p.advancement) : undefined
    const basePower: PowerCard = {
      id: power.id,
      name: power.name,
      level: power.level,
      model: 'power',
      effect: (power.tags ?? []).filter((t: string) => t !== 'damage'),
      source: p.source || p.klass,
      advancement: advancement ?? false,
      type: power.powerType,
      mod,
      upcast: false,
      alwaysCastable: p.alwaysCastable,
      ...base,
      resource: p.resource || base.resource,
      attack,
      dc,
      damage,
    }
    const advCasting = (i: number) => (advancement?.casting ? advancement.casting[i] || advancement.casting[0] : null)
    if (basePower.level === 0) {
      const levels = sheet.hasFlag('cantrip-upcast-early') ? rules.cantripLevels.early : rules.cantripLevels.normal
      const tier = levels.filter(l => sheet.level >= l).length
      out.push(merge(basePower, tier > 0 ? casting[tier] : null, advCasting(tier)) as PowerCard)
    }
    else {
      // "Counts as N levels higher": a slot of level L casts the power's tier for L + N, at most its highest listed tier.
      // Without a shift, a slot above the listed tiers casts the base power, as live.
      const shift = augmenting.reduce((a, m) => a + (m.castLevelBonus || 0), 0)
      const tierOf = (i: number) => (shift && i < casting.length ? Math.min(i + shift, casting.length - 1) : i)
      for (let i = 0; i <= rules.maxLevel - basePower.level; i++) {
        const level = i + basePower.level
        if (p.castAt && level !== p.castAt) continue
        const tier = tierOf(i)
        out.push(merge({ ...basePower, level, upcast: i !== 0 }, tier === 0 ? {} : casting[tier], advCasting(tier)) as PowerCard)
      }
    }
  }
  for (const card of out) {
    if (card.attack) card.attack = { ...card.attack, bonus: addBonus(card.attack.bonus, overrides.attack.power) }
    if (card.dc) card.dc = { ...card.dc, bonus: addBonus(card.dc.bonus, overrides.attack.power) }
    if (Array.isArray(card.damage)) card.damage = card.damage.map((d: Rec) => ({ ...d, bonus: addBonus(d.bonus, overrides.damage.power) }))
  }

  const asAttacks = sheet.ofType('power-attack')
  const castAsAttack = (p: PowerCard) => asAttacks.some(m => (m.value
    ? m.value === p.id
    : (!m.powerTypes || m.powerTypes.includes(p.type)) && (!m.levels || m.levels.includes(p.level))))
  const atWill = sheet.ofType('power-at-will')
  const asResource = sheet.ofType('power-resource')
  for (const power of out) {
    if (castAsAttack(power)) {
      // A copy: merged power entries share their arrays with the content record.
      if (power.altCasting && !power.altCasting.map((a: Rec) => a.unit).includes('attack')) power.altCasting = [...power.altCasting, { length: 1, unit: 'attack' }]
      else if (!power.altCasting) power.altCasting = [{ length: 1, unit: 'attack' }]
    }
    if (atWill.some(m => m.value === power.id && m.levels.includes(power.level))) power.alwaysCastable = power.level
    const res = asResource.find(m => m.value === power.id && m.levels.includes(power.level))
    if (res) {
      power.resource = { ...res.resource, id: `${res.resource.id}-${power.id}` }
      power.isCastableWithoutResource = true
    }
    applyPowerAugments(sheet, power, augmentsById.get(power.id) ?? [])
    const augments = matchingAugments(sheet, { attackType: power.attack?.type, model: power.attack?.wp ?? 'power', modelType: power.type, abilityMod: power.mod || undefined })
    for (const m of augmentsById.get(power.id) ?? []) {
      if (m.damageBonus) augments.damage += sheet.formula(m.damageBonus)
      if (m.addDamage) augments.addDamage.push(...m.addDamage)
    }
    Object.assign(power, augmentCard(sheet, power, augments, dieSteps.power))
  }
  return rules.card ? out.map(c => rules.card!(c, sheet) as PowerCard) : out
}

/** A `power-augment` matches a power by id, power type, the power's own level and the damage types its casting deals. */
function matchesPower(m: Mech, power: Rec, casting: Rec): boolean {
  return (!m.powers || m.powers.includes(power.id))
    && (!m.powerTypes || m.powerTypes.includes(power.powerType))
    && (!m.levels || m.levels.includes(power.level))
    && (!m.damageTypes || ((casting.damage || []) as Rec[]).some(d => m.damageTypes.includes(d.type)))
}

/**
 * What `power-augment`s change on a built power card besides its tier and casting merge:
 * dice on the main damage roll, bigger dice (past the largest, `overflowPerDie` per die, else +1),
 * uses, and notes. Damage bonuses and extra damage go through the card's attack augments.
 */
function applyPowerAugments(sheet: Sheet, card: Rec, augmenting: Mech[]) {
  if (!augmenting.length) return
  const healing = sheet.enums.values.healingTypes ?? []
  const main = Array.isArray(card.damage) ? (card.damage as Rec[]).findIndex(d => !d.addTo && !healing.includes(d.type)) : -1
  for (const m of augmenting) {
    if (main >= 0 && (m.dieCount || m.dieIncrease)) {
      card.damage = (card.damage as Rec[]).map((d, i) => {
        if (d.addTo || healing.includes(d.type)) return d
        let next = { ...d }
        if (m.dieCount && i === main) next.dieCount = typeof d.dieCount === 'number' ? d.dieCount + m.dieCount : { type: 'multi', value: [d.dieCount ?? { type: 'flat', value: 0 }, { type: 'flat', value: m.dieCount }] }
        if (m.dieIncrease) {
          const { dieType, overflow } = dieIncrease(d.dieType, dieSteps.power, m.dieIncrease)
          const dice = typeof next.dieCount === 'number' ? next.dieCount : sheet.formula(next.dieCount)
          const extra = overflow * (m.overflowPerDie ? m.overflowPerDie * dice : 1)
          next = { ...next, dieType, ...(extra ? { bonus: addBonus(d.bonus, extra) } : {}) }
        }
        return next
      })
    }
    if (m.usesMultiplier && card.resource?.max) card.resource = { ...card.resource, max: { ...card.resource.max, multiplier: (card.resource.max.multiplier ?? 1) * m.usesMultiplier } }
    if (m.notes?.length) card.notes = [...(Array.isArray(card.notes) ? card.notes : []), ...m.notes]
  }
}

/** Die steps for "increase the die type": powers skip d2, weapons don't (the live site's two tables). */
export const dieSteps = {
  power: [1, 4, 6, 8, 10, 12],
  weapon: [1, 2, 4, 6, 8, 10, 12],
}

export type { Mech }
