import type { GameRules, Mech, MechanicHandler, Rec, Sheet, SheetCard, WeaponContext, AttackAugments } from '@omnibrew/engine/rules'
import { defaultChoiceKey, dieIncrease, dieSteps } from '@omnibrew/engine/rules'
import { customArmor } from './custom-armor'

/**
 * Mass Effect 5e's rules for the engine: the tables and ME-only behavior the
 * live site hard-coded in its Vuex store (`store/character/*.js`), as data and
 * hooks. The engine never asks which game it runs; it calls these.
 */
const h = (type: string, describe: string, extra: Partial<MechanicHandler> = {}): MechanicHandler => ({ type, describe, ...extra })

export const meHandlers: MechanicHandler[] = [
  h('me:shields', 'ME shields: a shield source (gear, class features, armor and set bonuses); the best one counts'),
  h('me:barrier', 'ME barrier: dice, ticks and uses per level (multiclass table when multiclassed)'),
  h('me:tech-armor', 'not computed: tech armor HP is tracked by the player (sheet health panel)'),
  h('me:primer-detonation', 'not computed: detonation tiers show on the primer edge (Phase 3c card)'),
  h('me:thermal-clip-capacity', 'ME capacities: thermal clips carried'),
  h('me:grenade-capacity', 'ME capacities: grenades carried'),
  h('me:medi-gel-capacity', 'ME capacities: medi-gel carried'),
  h('me:weapon-slots', 'ME capacities: weapon slots beyond 4'),
  h('me:weapon-heat-increase', 'weapons: heat capacity of the modded weapon'),
  h('me:weapon-augment', 'weapons: an ammo or weapon mode (damage type, DC, extra damage, range, heat use)'),
  h('me:shoulder-mounts', 'weapons: shoulder-mounted weapons attack with Int'),
  h('me:gradient-condition-increase', 'not computed: condition steps (conditions panel, Phase 3c)'),
  h('me:advancements-choice', 'choice: picks a power advancement (stored under `advancements`)', { choiceKey: defaultChoiceKey }),
  h('me:prevent-advancements', 'not computed: the power picker offers no advancements (Phase 3c)'),
  h('me:cantrip-boost', 'powers: cantrips upcast at levels 1, 5 and 11', { flags: ['cantrip-upcast-early'] }),
  h('me:featherlight', 'not computed: rules text on the live sheet too'),
  h('me:melee-gunner', 'not computed: rules text on the live sheet too'),
  h('me:gun-strike-augment', 'weapons: improves the gun strike'),
  h('me:avatars-inspiration', 'not computed: the inspiration die is rules text'),
  h('me:improved-avatars-inspiration', 'cards: `{{ avatarsDie }}` becomes d8'),
  h('me:advanced-medigel-application', 'not computed: medi-gel use (rest and consumables, Phase 3c)'),
  h('me:emitter-hp', 'not computed: hologram emitter HP is tracked by the player'),
  h('me:ardat-yakshi-addiction-dc', 'resources: an Ardat-Yakshi tracker'),
  h('me:ardat-yakshi-addiction-level', 'resources: an Ardat-Yakshi tracker'),
  h('me:ardat-yakshi-mating', 'resources: an Ardat-Yakshi tracker'),
  h('me:ardat-yakshi-stave-off', 'resources: an Ardat-Yakshi tracker'),
]

// --- live tables (store/character/hp.js, powers.js, klasses.js) ---
const MC_BARRIER_TICKS = [3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 9, 10]
const MC_BARRIER_USES = [2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6]
const REPUTATION_THRESHOLDS = [15, 30, 60, 100]

export interface Barrier {
  dieType: number
  dieCount: number
  ticks: { max: number, used: number }
  uses: { max: number, used: number }
}

/** Barrier (the live `barrier` getter). Multiclassed: ticks by Σ levels × conversion, uses by total barrier class levels. */
export function barrier(sheet: Sheet): Barrier {
  const used = (sheet.character.state.game.barrier ?? {}) as { used?: number, ticksUsed?: number }
  const out: Barrier = { dieType: 0, dieCount: 0, ticks: { max: 0, used: used.ticksUsed ?? 0 }, uses: { max: 0, used: used.used ?? 0 } }
  if (sheet.classes.length > 1) {
    let tickLevel = 0
    let useLevel = 0
    let classTicks = 0
    for (const klass of sheet.classes) {
      const m = klass.features.flatMap(f => f.mechanics ?? []).find((x: Rec) => x.type === 'me:barrier')
      if (!m) continue
      tickLevel += klass.levels * m.multiclassConversion
      useLevel += klass.levels
      classTicks = Math.max(classTicks, m.ticks[klass.levels - 1])
      out.dieType = Math.max(out.dieType, m.dieType)
      out.dieCount = Math.max(out.dieCount, m.dieCount)
    }
    tickLevel = Math.floor(tickLevel)
    if (tickLevel > 0 && useLevel > 0) {
      out.ticks.max = Math.max(MC_BARRIER_TICKS[tickLevel - 1]!, classTicks)
      out.uses.max = MC_BARRIER_USES[useLevel - 1]!
    }
    else {
      out.dieType = 0
      out.dieCount = 0
    }
  }
  else {
    const m = sheet.ofType('me:barrier')[0]
    if (m) {
      out.ticks.max = m.ticks[sheet.level - 1]
      out.uses.max = m.uses[sheet.level - 1]
      out.dieType = m.dieType
      out.dieCount = m.dieCount
    }
  }
  return out
}

export interface ShieldSource { id: string, name: string, capacity: number, regen: number }

/**
 * Shield sources (the live `shieldSources`): each equipped gear item and class
 * feature with `me:shields`, and the armor (all equipped armor and set bonus
 * shields added up). Best capacity first, then best regen.
 */
export function shieldSources(sheet: Sheet): ShieldSource[] {
  const out: ShieldSource[] = []
  for (const g of sheet.equipment.equippedGear) {
    const m = g.mechanics.find((x: Rec) => x.type === 'me:shields')
    if (m) out.push({ id: g.entry.uuid, name: g.data.name, capacity: sheet.formula(m.capacity), regen: sheet.formula(m.regen) })
  }
  for (const klass of sheet.classes) {
    for (const f of klass.features) {
      const m = (f.mechanics ?? []).find((x: Rec) => x.type === 'me:shields')
      if (m) out.push({ id: f.klass, name: f.name, capacity: sheet.formula(m.capacity), regen: sheet.formula(m.regen) })
    }
  }
  const armor: ShieldSource = { id: 'armor', name: 'Armor', capacity: 0, regen: 0 }
  const armorMechanics = [
    ...sheet.equipment.equippedArmor.filter(a => !a.entry.custom).flatMap(a => a.mechanics),
    ...sheet.equipment.setBonuses.flatMap(s => s.bonuses.flatMap(b => b.mechanics ?? [])),
  ].filter((m: Rec) => m.type === 'me:shields')
  for (const m of armorMechanics) {
    armor.capacity += sheet.formula(m.capacity)
    armor.regen += sheet.formula(m.regen)
  }
  out.push(armor)
  return out.sort((a, b) => (a.capacity === b.capacity ? b.regen - a.regen : b.capacity - a.capacity))
}

export function shields(sheet: Sheet) {
  const typed = sheet.character.overrides.game as { shields?: number | null, regen?: number | null, shieldSource?: string }
  const sources = shieldSources(sheet)
  const source = (typed.shieldSource && sources.find(s => s.id === typed.shieldSource)) || sources[0]!
  const max = Number(typed.shields) || source.capacity
  const lost = Number((sheet.character.state.game as { shieldsLost?: number }).shieldsLost) || 0
  return { max, current: Math.max(max - lost, 0), regen: Number(typed.regen) || source.regen, source: source.id }
}

/** Reputation thresholds reached, with the benefits available at each (the live `reputation/thresholds`). */
export function reputation(sheet: Sheet) {
  const game = sheet.character.state.game as { paragon?: number, renegade?: number }
  const rep = { paragon: game.paragon || 0, renegade: game.renegade || 0, total: (game.paragon || 0) + (game.renegade || 0) }
  const available = (b: Rec) => {
    if (rep.total < b.threshold) return false
    const stats = b.prereq?.paragon || b.prereq?.renegade
    if (!stats) return true
    if (stats.within) {
      const renegadeWithin = rep.renegade <= rep.paragon + stats.within && rep.renegade >= rep.paragon - stats.within
      const paragonWithin = rep.paragon <= rep.renegade + stats.within && rep.paragon >= rep.renegade - stats.within
      return renegadeWithin || paragonWithin
    }
    const which = b.prereq.paragon ? 'paragon' : 'renegade'
    const other = b.prereq.paragon ? 'renegade' : 'paragon'
    return rep[which] >= stats.min && rep[which] >= rep[other]
  }
  const benefits = sheet.content.list('benefits')
  return REPUTATION_THRESHOLDS.filter(t => rep.total >= t).map((threshold) => {
    const pick = sheet.character.choices.find(c => c.path.startsWith(`reputation/${threshold}/`))?.values[0]
    const selected = typeof pick === 'string' ? pick : null
    const benefit = selected ? benefits.find(b => b.id === selected) : undefined
    return {
      threshold,
      options: benefits.filter(b => b.threshold === threshold).map(b => ({ id: b.id, name: b.name, available: available(b) })),
      selected,
      needsAttention: benefit ? !available(benefit) : false,
    }
  })
}

/** Carrying limits; a limit turned off in the character's options is unlimited (99). */
export function capacities(sheet: Sheet) {
  const options = sheet.character.options.game as Record<string, boolean | undefined>
  const sum = (type: string) => sheet.ofType(type).reduce((a, m) => a + m.value, 0)
  return {
    grenades: options.grenadeSlots ? sum('me:grenade-capacity') : 99,
    mediGel: options.medigelSlots ? sum('me:medi-gel-capacity') : 99,
    thermalClips: options.thermalClips ? sum('me:thermal-clip-capacity') : 99,
    weaponSlots: options.weaponSlots ? sum('me:weapon-slots') + 4 : 99,
  }
}

export function thermalClips(sheet: Sheet) {
  const clips = sheet.equipment.gear.filter(g => g.data.id === 'thermal-clip')
  return {
    max: capacities(sheet).thermalClips,
    equipped: clips.reduce((a, c) => a + (c.entry.equippedAmount || 0), 0),
    available: clips.reduce((a, c) => a + (c.entry.uses || 0), 0),
  }
}

/** The six-melee-weapon blender (`{{ tentacleBlender }}`, the kett's Tentacles): equipped melee dice, the rest 1d4. */
function tentacleBlender(sheet: Sheet) {
  const slots: Array<[number, number, string]> = Array.from({ length: 6 }, () => [1, 4, 'poison'])
  sheet.equipment.equippedWeapons.forEach((w, i) => {
    slots[i] = w.data.weaponType === 'melee' ? [w.data.damage.dieCount, w.data.damage.dieType, w.data.damage.type] : [1, 4, 'bludgeoning']
  })
  const total: Record<string, { dieCount: number, dieType: number, type: string }> = {}
  for (const [count, die, type] of slots) {
    const key = `${die}-${type}`
    if (total[key]) total[key]!.dieCount += count
    else total[key] = { dieCount: count, dieType: die, type }
  }
  return Object.values(total).map(d => `${d.dieCount}d${d.dieType} ${d.type}`).join(' + ')
}

// --- weapons ---

interface WeaponMode {
  on: boolean
  mechanic?: Rec
}

/** The weapon's ammo or mode mod (`me:weapon-augment`): on unless it is a toggle the player turned off. */
function weaponMode(weapon: WeaponContext, sheet: Sheet): WeaponMode {
  const m = weapon.mechanics.find(x => x.type === 'me:weapon-augment')
  if (!m) return { on: false }
  return { on: m.toggle ? !!sheet.character.state.toggles[weapon.entry.uuid] : true, mechanic: m }
}

function weaponAttack(card: SheetCard, weapon: WeaponContext, sheet: Sheet): SheetCard {
  const { on, mechanic: t } = weaponMode(weapon, sheet)
  const out: SheetCard = { ...card }
  if (t?.toggle) out.toggle = { id: weapon.entry.uuid, showLabel: true, name: t.name }

  const heat = weapon.data.propertyValues?.heat ?? weapon.data.heat
  if (heat) {
    const fromSheet = sheet.ofType('me:weapon-heat-increase')
    const fromMods = weapon.mechanics.filter(m => m.type === 'me:weapon-heat-increase')
    const scaled = [...fromSheet, ...fromMods.filter(m => m.multiplier)].reduce((a, m) => a + Math.max(Math.floor(heat * m.multiplier), 1), 0)
    const flat = fromMods.filter(m => m.value).reduce((a, m) => a + m.value, 0)
    out.resource = {
      displayType: 'heat',
      reset: 'manual',
      vented: weapon.properties.includes('vented'),
      max: { type: 'flat', value: heat + scaled + flat, min: 0 },
      increment: on ? t?.heatConsumption : 1,
      id: weapon.entry.uuid,
    }
  }

  if (on && t) {
    const range = { ...out.range }
    if (t.shortRangeMultiplier) range.short *= t.shortRangeMultiplier
    if (t.longRangeMultiplier && range.long) range.long *= t.longRangeMultiplier
    if (t.shortRangeMax) range.short = Math.min(range.short, t.shortRangeMax)
    if (t.longRangeMax && range.long) range.long = Math.min(range.long, t.longRangeMax)
    if (t.addAoe) range.aoe = t.addAoe
    if (t.onlyShortRange) range.long = null
    out.range = range
    const augmentNotes = (card.augments as Record<string, AttackAugments>).base!.notes.length
    const notes = [...card.notes]
    notes.splice(notes.length - augmentNotes, 0, ...t.notes ?? [])
    if (t.primes) notes.unshift({ type: 'tooltip', tooltipText: `Primes ${t.primes} ${t.primesLength || 'until the start of your next turn'}`, text: `P: ${t.primes}` })
    if (t.detonates) notes.unshift({ type: 'icon', text: 'Detonates', icon: 'mdi-alert-octagram', color: 'red darken-4' })
    out.notes = notes
  }
  return out
}

const withoutMod = (damage: Rec[], a: AttackAugments, always: boolean) => damage.map((d) => {
  const plain = { ...d, mod: false }
  if (!always && !(a.damage > 0)) return plain
  const { dieType, overflow } = dieIncrease(d.dieType, dieSteps.weapon, a.dieIncrease)
  return { ...plain, dieType: dieType || d.dieType, bonus: { type: 'flat', value: (d.bonus?.value || 0) + a.damage + overflow }, reroll: a.reroll || d.reroll }
})

/** Burst fire: a DC 8 + Dex save in a 10-foot cube, costing 2 more heat. */
function burstFire(card: SheetCard, weapon: WeaponContext, a: AttackAugments, sheet: Sheet): SheetCard {
  const proficient = sheet.profs.weapon.includes(card.weaponType)
  return {
    ...card,
    attack: null,
    range: { short: card.range.short + a.range, aoe: { type: 'cube', size: 10 } },
    damage: card.damage.map((d: Rec) => {
      const { dieType, overflow } = dieIncrease(d.dieType, dieSteps.weapon, a.dieIncrease)
      return { ...d, dieType: dieType || d.dieType, bonus: { type: 'flat', value: (d.bonus?.value || 0) + a.damage + overflow }, reroll: a.reroll || d.reroll }
    }),
    resource: card.resource ? { ...card.resource, increment: card.resource.increment + 2 } : card.resource,
    dc: { base: 8 + a.dc, proficient, mod: 'dex', save: 'dex' },
    properties: [...card.properties, 'Burst Fire'],
  }
}

/** Double tap: a second attack without the ability modifier on damage. */
function doubleTap(card: SheetCard, _w: WeaponContext, a: AttackAugments): SheetCard | null {
  if (!card.attack) return null
  return {
    ...card,
    attack: { ...card.attack, bonus: { type: 'flat', value: card.attack.bonus.value + a.hit } },
    damage: withoutMod(card.damage, a, false),
    properties: [...card.properties, 'Double Tap'],
  }
}

const GUN_STRIKE: Rec = {
  type: 'gun-strike',
  name: 'Gun Strike',
  damage: { dieCount: 1, dieType: 4, type: 'bludgeoning' },
  range: { short: 5 },
  properties: [],
  notes: [],
}

const UNARMED: Rec = {
  type: 'natural-melee',
  name: 'Unarmed Strike',
  damage: { dieCount: 1, dieType: null, type: 'bludgeoning' },
  range: { short: 5 },
  properties: [],
  notes: [],
}

function gunStrike(sheet: Sheet): Rec[] {
  if (!sheet.equipment.equippedWeapons.some(w => w.data.weaponType !== 'melee')) return []
  const strike = structuredClone(GUN_STRIKE)
  for (const m of sheet.ofType('me:gun-strike-augment')) {
    const v = m.value
    if (v.damage?.dieCount) strike.damage.dieCount = Math.max(strike.damage.dieCount, v.damage.dieCount)
    if (v.damage?.dieType) strike.damage.dieType = Math.max(strike.damage.dieType, v.damage.dieType)
    if (v.notes) strike.notes = [...strike.notes, ...v.notes]
  }
  return [strike]
}

export const meRules: GameRules = {
  handlers: meHandlers,
  formulas: {
    'me:barrier-die-count': (_, s) => barrier(s).dieCount,
    'me:barrier-die-type': (_, s) => barrier(s).dieType,
    'me:barrier-ticks': (f, s) => {
      const b = barrier(s)
      return f.value === 'current' ? b.ticks.max - b.ticks.used : b.ticks.max
    },
  },
  armor: {
    base: 10,
    bonus: {
      suit: { light: 1, medium: 4, heavy: 7 },
      chest: { light: 1, medium: 2, heavy: 3 },
      arms: { light: 0, medium: 1, heavy: 2 },
      legs: { light: 0, medium: 1, heavy: 2 },
    },
    suitPieces: 3,
    maxDex: { heavy: 0, medium: 2 },
    strength: [
      { type: 'heavy', pieces: 3, str: 16 },
      { type: 'heavy', pieces: 2, str: 15 },
      { type: 'heavy', pieces: 1, str: 13 },
      { type: 'medium', pieces: 3, str: 13 },
      { type: 'medium', pieces: 2, str: 12 },
    ],
    strengthPenalty: 10,
    proficiencyPenalty: { disadvantage: 2, noPowercasting: 4 },
  },
  powers: {
    classAbility: { adept: 'wis', vanguard: 'wis', engineer: 'int', sentinel: 'wis', infiltrator: 'int', explorer: 'int', tracker: 'wis', musician: 'cha', soldier: false, experiment: false },
    typeAbility: { tech: 'int', biotic: 'wis', combat: 'dex' },
    multiclass: {
      slots: [
        [2, 4, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7],
        [0, 0, 0, 0, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 3, 3, 4, 5, 5],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 3],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      ],
      points: [2, 4, 5, 7, 11, 13, 15, 17, 20, 23, 26, 26, 30, 30, 34, 34, 39, 42, 45, 50],
      pointLimit: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6],
      pactSlotLevel: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      pactSlots: [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4],
    },
    cantripLevels: { normal: [5, 11, 17], early: [0, 5, 11] },
    maxLevel: 6,
  },
  multiclassProfs: {
    adept: { weapon: { has: ['smg'] } },
    engineer: { armor: { has: ['medium'] }, weapon: { has: ['assault_rifle'] } },
    infiltrator: { weapon: { has: ['sniper_rifle', 'melee'] } },
    sentinel: { armor: { has: ['medium', 'heavy'] }, weapon: { choices: { items: ['assault_rifle', 'melee', 'shotgun', 'smg'], count: 1 }, text: 'Choose one from Assault Rifles, Melee, Shotguns, or SMGs' } },
    soldier: { armor: { has: ['medium', 'heavy'] }, weapon: { choices: { items: ['assault_rifle', 'heavy_pistol', 'melee', 'shotgun', 'smg', 'sniper_rifle'], count: 2 }, text: 'Choose two from Assault Rifles, Heavy Pistols, Melee, Shotguns, SMGs, or Sniper Rifles' } },
    vanguard: { armor: { has: ['medium'] }, weapon: { has: ['shotgun'] } },
    tracker: { armor: { has: ['medium'] }, skill: { has: ['perception'] } },
    explorer: {},
    musician: {},
    experiment: {},
  },
  builtins: {
    species: [{
      id: 'custom',
      name: 'Custom Species',
      bodyImg: '/images/species/custom_species.png',
      mechanics: [
        { type: 'asi-choice', options: true, selections: 3, max: 2, total: 3 },
        { type: 'speed', speed: 'walk', distance: 30 },
      ],
    }],
    backgrounds: [{ id: 'custom-background', name: 'Custom Background', mechanics: [] }],
    armor: customArmor(),
  },
  families: { collection: 'edges', field: 'type' },
  sources: sheet => reputation(sheet).map(t => ({ path: `reputation/${t.threshold}`, mechanics: [{ type: 'model-choice', model: 'benefits', options: true }] })),
  conditions: {
    'barrier-active': (sheet) => {
      const b = barrier(sheet)
      return b.ticks.max - b.ticks.used > 0
    },
  },
  placeholders: sheet => ({
    avatarsDie: sheet.ofType('me:improved-avatars-inspiration').length ? 'd8' : 'd4',
    tentacleBlender: tentacleBlender(sheet),
    shieldRegen: shields(sheet).regen,
  }),
  sections: {
    shields,
    shieldSources,
    barrier,
    reputation,
    capacities,
    thermalClips,
  },
  noteText: (note: Mech, sheet: Sheet) => {
    // The live sheet computed Sneak Attack dice in its note component (plan/09 backlog).
    if (note.value !== 'Sneak Attack') return note.value
    const infiltrator = sheet.classes.find(k => k.id === 'infiltrator')
    if (!infiltrator) return note.value
    const dice = Math.floor((infiltrator.levels + 1) / 2) || 1
    const shadow = infiltrator.subclass === 'shadow' ? ' (d8 w/ melee)' : ''
    const sniper = infiltrator.subclass === 'sniper' && infiltrator.levels >= 17 ? ` (${dice + 3}d6 w/ sniper rifles)` : ''
    return `Sneak Attack: ${dice}d6${shadow}${sniper}`
  },
  actions: (sheet) => {
    const b = barrier(sheet)
    if (b.uses.max === 0) return []
    return [{
      name: 'Barrier',
      type: 'bonus-action',
      shortDesc: `Gain ${b.ticks.max} barrier ticks (to a maximum of ${b.ticks.max})`,
      resource: { displayType: 'barrier', reset: 'short', id: 'barrier' },
      moreInfo: { model: 'class-features', id: 'barrier-vanguard' },
    }]
  },
  weapons: {
    meleeTypes: ['melee', 'gun-strike', 'natural-melee'],
    alwaysProficient: ['natural-melee', 'natural-ranged', 'gun-strike'],
    finesse: ['finesse', 'recoil'],
    weaponOnly: ['me:weapon-heat-increase'],
    modSlots: type => (type === 'melee' ? ['grip', 'strike'] : ['magazine', 'body', 'ammo', 'barrel']),
    unarmed: UNARMED,
    extraAttacks: gunStrike,
    ability: (weapon, sheet) => {
      const mounted = ((sheet.character.state.game as { shoulderMounts?: string[] }).shoulderMounts ?? []).includes(weapon.entry.uuid)
      return mounted && sheet.ofType('me:shoulder-mounts').length ? 'int' : undefined
    },
    mode: (weapon, sheet) => {
      const { on, mechanic: t } = weaponMode(weapon, sheet)
      return on && t ? { dc: t.dc, hitBonus: t.hitBonus, damageType: t.damageType, damageMultiplier: t.damageMultiplier, addDamage: t.addDamage } : undefined
    },
    attack: weaponAttack,
    special: {
      bf: { property: 'burst-fire', build: burstFire },
      dt: { property: 'double-tap', build: doubleTap },
    },
  },
}
