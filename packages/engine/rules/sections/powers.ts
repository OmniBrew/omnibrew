import { mergeDeep } from '../../schemas/primitives'
import type { Sheet } from '../sheet'
import type { Mech, Rec } from '../types'
import { augmentCard, matchingAugments } from './cards'

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
  return [...sheet.character.powers.map(p => ({ id: p.id, klass: p.class, advancement: p.advancement })), ...granted]
}

const merge = (...parts: Array<Rec | null | undefined>) => parts.reduce<Rec>((a, p) => (p ? mergeDeep(a, p) as Rec : a), {})

export function computePowers(sheet: Sheet): PowerCard[] {
  const out: PowerCard[] = []
  const rules = sheet.rules.powers
  const overrides = sheet.character.overrides
  for (const p of selectedPowers(sheet)) {
    const power = sheet.content.get('powers', p.id)
    if (!power) continue
    const casting: Rec[] = power.casting ?? []
    const base = p.merge ? mergeDeep(structuredClone(casting[0]), structuredClone(p.merge)) as Rec : casting[0]!
    const mod = p.mod || (p.klass ? sheet.powercastingAbilities[p.klass] : undefined) || rules.typeAbility[power.powerType] || false
    const attackMod = base.attack?.mod === 'pc' ? false : base.attack?.mod
    const dcMod = base.dc?.mod === 'pc' ? false : base.dc?.mod
    // A sheet's power attack bonus applies to attacks and save DCs; its power damage bonus replaces a damage roll's own bonus.
    const attack = base.attack ? { ...base.attack, mod: attackMod || mod, bonus: { type: 'flat', value: overrides.attack.power } } : false
    const dc = base.dc ? { ...base.dc, mod: dcMod || mod, bonus: { type: 'flat', value: overrides.attack.power } } : false
    const damage = base.damage
      ? base.damage.map((d: Rec) => (d.mod === 'pc' ? { ...d, mod, bonus: { type: 'flat', value: overrides.damage.power } } : { ...d, bonus: { type: 'flat', value: overrides.damage.power } }))
      : false
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
      for (let i = 0; i <= rules.maxLevel - basePower.level; i++) {
        const level = i + basePower.level
        if (p.castAt && level !== p.castAt) continue
        out.push(merge({ ...basePower, level, upcast: i !== 0 }, i === 0 ? {} : casting[i], advCasting(i)) as PowerCard)
      }
    }
  }

  const asAttacks = sheet.ofType('power-attack')
  const castAsAttack = (p: PowerCard) => asAttacks.some(m => (m.value
    ? m.value === p.id
    : (!m.powerTypes || m.powerTypes.includes(p.type)) && (!m.levels || m.levels.includes(p.level))))
  const atWill = sheet.ofType('power-at-will')
  const asResource = sheet.ofType('power-resource')
  for (const power of out) {
    if (castAsAttack(power)) {
      if (power.altCasting && !power.altCasting.map((a: Rec) => a.unit).includes('attack')) power.altCasting.push({ length: 1, unit: 'attack' })
      else power.altCasting = [{ length: 1, unit: 'attack' }]
    }
    if (atWill.some(m => m.value === power.id && m.levels.includes(power.level))) power.alwaysCastable = power.level
    const res = asResource.find(m => m.value === power.id && m.levels.includes(power.level))
    if (res) {
      power.resource = { ...res.resource, id: `${res.resource.id}-${power.id}` }
      power.isCastableWithoutResource = true
    }
    const augments = matchingAugments(sheet, { attackType: power.attack?.type, model: power.attack?.wp ?? 'power', modelType: power.type, abilityMod: power.mod || undefined })
    Object.assign(power, augmentCard(sheet, power, augments, dieSteps.power))
  }
  return out
}

/** Die steps for "increase the die type": powers skip d2, weapons don't (the live site's two tables). */
export const dieSteps = {
  power: [1, 4, 6, 8, 10, 12],
  weapon: [1, 2, 4, 6, 8, 10, 12],
}

export type { Mech }
