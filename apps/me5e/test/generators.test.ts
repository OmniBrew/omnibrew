import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { describe, expect, it } from 'vitest'
import { me5eDefinition } from '../game/definition'
import { EXCLUDED_GEAR_TYPES, hoardRowText, lootData, lootText, rollLoot, tableRowText, type LootReward, type LootTable } from '../generators/loot'
import { d100Problems } from '../generators/loot-schema'
import { abilityTitle, averageDamage, generateNpc, hitPointAverage, NpcBuilder, ordinal, type Ability, type GeneratedNpc, type NpcBudget, type NpcOptions } from '../generators/npc'
import { npcClassOptions, npcData, npcSpeciesOptions, powerDamage, type Rec, type Records } from '../generators/npc-data'
import { fromLiveNpc, liveTagsToMdc } from '../generators/npc-live'
import { isLeveledPowercasting, npcSheetRefs, powerLevelLines } from '../generators/npc-sheet'
import { speciesTraits } from '../generators/npc-traits'
import { abilityMod, averageDice, cryptoRandom, rollDice, seededRandom } from '../generators/random'

/**
 * The NPC and loot generators (plan 3d) on in-memory records with seeded random numbers,
 * so CI runs them without the content repo. A last block runs them on the real content
 * when the checkout is next to this repo.
 */
const game = createGame(me5eDefinition)
const records = (collections: Record<string, Rec[]>): Records =>
  new Map(Object.entries(collections).map(([name, list]) => [name, new Map(list.map(r => [String(r.id), r]))]))

// The CR table (content/npc-stats): id, cr, normalized, prof, ac, hp, attack, damage, dc, xp.
const STATS: [string, string, number, number, number, number, number, number, number, number][] = [
  ['00000', '0', 1, 2, 12, 3, 2, 1, 9, 10], ['00125', '1/8', 2, 2, 12, 9, 3, 3, 10, 25], ['00250', '1/4', 3, 2, 13, 15, 3, 5, 10, 50],
  ['00500', '1/2', 4, 2, 13, 24, 4, 8, 11, 100], ['01000', '1', 5, 2, 13, 30, 4, 10, 11, 200], ['02000', '2', 6, 2, 13, 45, 5, 15, 12, 450],
  ['03000', '3', 7, 2, 14, 60, 5, 20, 12, 700], ['04000', '4', 8, 2, 14, 75, 6, 25, 13, 1100], ['05000', '5', 9, 3, 14, 90, 6, 30, 13, 1800],
  ['06000', '6', 10, 3, 15, 105, 7, 35, 14, 2300], ['08000', '8', 12, 3, 15, 120, 8, 40, 15, 3900], ['10000', '10', 14, 4, 16, 150, 9, 50, 16, 5900],
  ['12000', '12', 16, 4, 17, 180, 10, 60, 17, 8400], ['15000', '15', 19, 5, 18, 225, 11, 75, 18, 13000], ['17000', '17', 21, 6, 18, 255, 12, 85, 19, 18000],
  ['20000', '20', 24, 6, 19, 300, 14, 100, 21, 25000], ['24000', '24', 28, 7, 21, 360, 16, 120, 23, 62000], ['25000', '25', 29, 8, 21, 375, 16, 125, 23, 75000],
  ['28000', '28', 32, 8, 22, 420, 18, 140, 25, 120000], ['30000', '30', 34, 9, 23, 450, 19, 150, 25, 155000],
]
const npcStats = STATS.map(([id, cr, normalized, profBonus, ac, hp, attack, damage, dc, xp]) => ({ id, cr, normalized, profBonus, ac, hp, attack, damage, dc, xp, save: 0 }))

const perLevel = (f: (level: number) => unknown) => Array.from({ length: 20 }, (_, i) => f(i + 1))
const fullSlots = [[2, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], perLevel(l => (l >= 3 ? 3 : 0)), perLevel(l => (l >= 5 ? 3 : 0)), perLevel(l => (l >= 7 ? 2 : 0)), perLevel(l => (l >= 9 ? 1 : 0))]
const halfSlots = [perLevel(l => (l >= 2 ? 2 : 0)), perLevel(l => (l >= 5 ? 2 : 0)), perLevel(l => (l >= 9 ? 2 : 0))]
const col = (label: string, values: unknown[]) => ({ label, values })
const klass = (id: string, name: string, skills: string[], saves: string[], columns: { label: string, values: unknown[] }[]) => ({
  id, name, profs: { 'skill': { choices: { count: 2, items: skills } }, 'saving-throw': { has: saves } }, progression: { subclass: [3], abi: [4], columns },
})
const barrier = [col('barrier_uses', perLevel(l => Math.ceil(l / 5))), col('barrier_ticks', perLevel(l => 2 + Math.floor(l / 4)))]
const tech = [col('tech_points', perLevel(l => l + 1)), col('tech_point_limit', perLevel(l => Math.min(6, Math.ceil(l / 3))))]
const classes = [
  klass('adept', 'Adept', ['acrobatics', 'insight', 'survival'], ['wis', 'cha'], [...barrier, col('power_slots_by_power_level', fullSlots)]),
  klass('engineer', 'Engineer', ['electronics', 'engineering', 'science'], ['int', 'con'], tech),
  klass('infiltrator', 'Infiltrator', ['stealth', 'perception', 'electronics'], ['dex', 'int'], [col('sneak_attack_damage', perLevel(l => `${Math.ceil(l / 2)}d6`)), col('tactical_cloak_uses', perLevel(l => Math.ceil(l / 4))), ...tech]),
  klass('sentinel', 'Sentinel', ['insight', 'medicine', 'science'], ['wis', 'int'], [...barrier, col('power_slots', perLevel(l => (l < 2 ? 1 : l < 11 ? 2 : 3))), col('power_level', perLevel(l => Math.min(5, Math.ceil(l / 2))))]),
  klass('soldier', 'Soldier', ['athletics', 'intimidation', 'perception'], ['str', 'con'], [col('combat_powers', perLevel(l => Math.ceil(l / 4)))]),
  klass('vanguard', 'Vanguard', ['athletics', 'intimidation', 'survival'], ['str', 'con'], [...barrier, col('power_slots_by_power_level', halfSlots)]),
  // A class the generator doesn't build: never offered.
  klass('musician', 'Musician', ['performance'], ['cha', 'dex'], []),
]

const asi = (ability: string, amount = 1) => ({ type: 'asi', ability, amount })
const TRAIT_SPECIES = ['angara', 'asari', 'batarian', 'drell', 'elcor', 'geth', 'hanar', 'krogan', 'prothean', 'quarian', 'salarian', 'turian', 'volus', 'vorcha']
const species = [
  ...TRAIT_SPECIES.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), mechanics: [asi('dex'), { type: 'speed', speed: 'walk', distance: 30 }] })),
  { id: 'asari', name: 'Asari', subspecies: 'lifestage', mechanics: [asi('wis')] },
  { id: 'lifestage-maiden', name: 'Maiden', type: 'subspecies', species: 'asari', mechanics: [asi('cha', 2)] },
  { id: 'human', name: 'Human', mechanics: [{ type: 'asi-choice', limit: ['str', 'dex'] }, { type: 'asi-choice', total: 2, selections: 2 }] },
  { id: 'human-variant', name: 'Variant Human', type: 'variant', species: 'human', mechanics: [] },
]

const dmg = (dieCount: number, dieType: number, type: string) => ({ dieCount, dieType, type })
const power = (id: string, level: number, powerType: string, classList: string[], damage?: ReturnType<typeof dmg>, upcast = 0) => ({
  id, name: id.replace(/-/g, ' '), level, powerType, classes: classList,
  casting: [{ ...(damage ? { damage: [damage] } : {}) }, ...Array.from({ length: upcast }, (_, i) => ({ damage: [{ dieCount: (damage?.dieCount ?? 0) + i + 1 }] }))],
})
const BIOTIC = ['adept', 'vanguard', 'sentinel']
const TECH = ['engineer', 'infiltrator', 'sentinel']
const powers = [
  power('throw', 0, 'biotic', BIOTIC, dmg(1, 8, 'force'), 3),
  power('lift', 1, 'biotic', BIOTIC),
  power('warp', 1, 'biotic', BIOTIC, dmg(2, 6, 'necrotic'), 4),
  power('shockwave', 2, 'biotic', BIOTIC, dmg(3, 6, 'force'), 3),
  power('singularity', 3, 'biotic', BIOTIC, dmg(4, 6, 'force'), 2),
  power('heal-field', 1, 'biotic', BIOTIC, dmg(2, 8, 'hp'), 4),
  power('flamethrower', 0, 'tech', TECH, dmg(1, 6, 'fire'), 3),
  power('incinerate', 1, 'tech', TECH, dmg(2, 6, 'fire'), 5),
  power('decoy', 1, 'tech', TECH),
  power('cryo-blast', 2, 'tech', TECH, dmg(3, 8, 'cold'), 4),
  power('shocking-grasp', 0, 'tech', ['engineer'], dmg(1, 8, 'lightning'), 3),
  ...['ballistic-blades', 'beehive', 'concussive-shot', 'fortification', 'stimulant-pack', 'trophy-system', 'havoc-strike', 'flak-cannon', 'hawk-missile-launcher'].map(id => power(id, 1, 'combat', ['soldier', 'infiltrator'])),
  power('hex-shield', 1, 'combat', ['engineer']),
  power('nightshade-blades', 1, 'combat', ['infiltrator']),
  power('blade-armor', 1, 'combat', ['vanguard']),
]
const weapon = (id: string, rarity: string, weaponType: string, damage: ReturnType<typeof dmg>, props: string[]) => ({ id, name: id.toUpperCase(), rarity, weaponType, damage, properties: props.map(p => ({ id: p })), range: weaponType === 'melee' ? undefined : { short: 60, long: 180 } })
const weapons = [
  weapon('m-3-predator', 'common', 'heavy_pistol', dmg(1, 6, 'piercing'), ['light', 'double-tap']),
  weapon('m-8-avenger', 'common', 'assault_rifle', dmg(1, 8, 'piercing'), ['two-handed']),
  weapon('combat-knife', 'common', 'melee', dmg(1, 4, 'slashing'), ['light', 'finesse']),
  weapon('m-4-shuriken', 'uncommon', 'smg', dmg(1, 6, 'piercing'), ['light', 'hip-fire']),
  weapon('m-92-mantis', 'rare', 'sniper_rifle', dmg(2, 10, 'piercing'), ['two-handed']),
  weapon('asari-sword', 'very_rare', 'melee', dmg(2, 6, 'slashing'), ['light']),
  weapon('black-widow', 'spectre', 'sniper_rifle', dmg(3, 10, 'piercing'), ['two-handed', 'recoil']),
]
const MARKS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const RARITY_BY_MARK = ['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare', 'very_rare', 'very_rare', 'very_rare', 'spectre']
const grenade = (id: string, name: string, die?: number) => ({
  id, name, rarity: 'varies', gearType: 'grenade',
  marks: MARKS.map((mark, i) => ({ mark, rarity: RARITY_BY_MARK[i], ...(die ? { damage: `${Math.ceil((i + 1) * 0.8)}d${die}` } : {}) })),
  subsets: MARKS.map((mark, i) => ({ id: `${id}-${mark.toLowerCase()}`, name: `${name} ${mark}`, rarity: RARITY_BY_MARK[i] })),
})
const gear = [
  grenade('frag-grenade', 'Frag Grenade', 12),
  grenade('flashbang-grenade', 'Flashbang Grenade'),
  { id: 'smoke-grenade', name: 'Smoke Grenade', rarity: 'common', gearType: 'grenade' },
  { id: 'omni-gel', name: 'Omni-gel', rarity: 'common', gearType: 'omni_gel' },
  { id: 'medi-gel', name: 'Medi-gel', rarity: 'varies', gearType: 'medi_gel', subsets: ['standard', 'enhanced', 'superior', 'ultimate'].map((g, i) => ({ id: `medi-gel-${g}`, name: `${g.charAt(0).toUpperCase()}${g.slice(1)} Medi-gel`, rarity: RARITY_BY_MARK[i * 2] })) },
  { id: 'heavy-weapon-charge', name: 'Heavy Weapon Charge', rarity: 'common', gearType: 'ammo' },
  { id: 'hacking-tools', name: 'Hacking Tools', rarity: 'common', gearType: 'tool' },
  { id: 'm-920-cain', name: 'M-920 Cain', rarity: 'spectre', gearType: 'heavy_weapon' },
  { id: 'primal-tap-exe', name: 'Primal_Tap.exe', rarity: 'varies', gearType: 'omni_tool_program', subsets: [{ id: 'primal-tap-iv-exe', name: 'Primal_Tap IV.exe', rarity: 'very_rare' }] },
  { id: 'mystery-device', name: 'Mystery Device', rarity: 'varies', gearType: 'device' },
]
const SKILLS: [string, Ability][] = [['acrobatics', 'dex'], ['athletics', 'str'], ['deception', 'cha'], ['electronics', 'int'], ['engineering', 'int'], ['insight', 'wis'], ['intimidation', 'cha'], ['investigation', 'int'], ['medicine', 'wis'], ['perception', 'wis'], ['performance', 'cha'], ['persuasion', 'cha'], ['science', 'int'], ['stealth', 'dex'], ['survival', 'wis']]
const skills = SKILLS.map(([id, link]) => ({ id, name: id, link }))
const conditions = ['blinded', 'poisoned', 'prone', 'exhaustion'].map(id => ({ id, name: id }))

const data = npcData(records({ 'npc-stats': npcStats, classes, species, powers, weapons, gear, skills, conditions }))
const valid = (npc: GeneratedNpc) => {
  const r = game.schemas.bestiary!.safeParse(npc)
  return r.success ? true : r.error.issues.map(i => `${i.path.join('.')}: ${i.message}`)
}
const run = (options: NpcOptions, seed: number) => generateNpc(data, { now: 1700000000000, ...options }, seededRandom(seed))
const stat = (id: string) => npcStats.find(s => s.id === id)!
const AC_MODS: Record<number, number[]> = { [-2]: [1, 3], [-1]: [0, 2], 0: [-1, 1], 1: [-2, 0], 2: [-3, -1] }
const PRIMARY: Record<string, Ability> = { adept: 'wis', engineer: 'int', infiltrator: 'dex', sentinel: 'wis', soldier: 'dex', vanguard: 'str' }

describe('random numbers', () => {
  it('repeats a seeded sequence, and rolls dice in range', () => {
    const a = seededRandom(42)
    const b = seededRandom(42)
    expect(Array.from({ length: 5 }, a)).toEqual(Array.from({ length: 5 }, b))
    const crypto = cryptoRandom()
    for (let i = 0; i < 50; i++) {
      const n = crypto()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
    const rolls = rollDice(seededRandom(1), '20d6')
    expect(rolls).toHaveLength(20)
    expect(rolls.every(r => r >= 1 && r <= 6)).toBe(true)
    expect(averageDice(6, 2)).toBe(7)
    expect(abilityMod(15)).toBe(2)
  })
})

describe('NPC generator', () => {
  it('offers the six classes it builds and the base species', () => {
    expect(npcClassOptions(data).map(c => c.id)).toEqual(['adept', 'engineer', 'infiltrator', 'sentinel', 'soldier', 'vanguard'])
    expect(npcSpeciesOptions(data).map(s => s.id)).not.toContain('human-variant')
    expect(npcSpeciesOptions(data).map(s => s.id)).not.toContain('lifestage-maiden')
  })

  it('reads a power\'s damage cast at higher levels from its casting entries', () => {
    const warp = data.powers.find(p => p.id === 'warp')!
    expect(powerDamage(warp)).toEqual({ dieCount: 2, dieType: 6 })
    expect(powerDamage(warp, 2)).toEqual({ dieCount: 4, dieType: 6 })
    expect(powerDamage(warp, 99)).toEqual({ dieCount: 6, dieType: 6 })
    expect(powerDamage(data.powers.find(p => p.id === 'heal-field')!)).toBeUndefined()
    expect(powerDamage(data.powers.find(p => p.id === 'lift')!)).toBeUndefined()
  })

  it('averages damage per round as the live generator did', () => {
    expect(averageDamage([{ type: 'weapon', damage: 10, uses: 5 }])).toBe(10)
    expect(averageDamage([{ type: 'weapon', damage: 10, uses: 5 }, { type: 'bonus', damage: 3, uses: 5 }])).toBe(13)
    expect(averageDamage([{ type: 'weapon', damage: 10, uses: 5 }, { type: 'power', damage: 20, uses: 1 }])).toBe(12)
    expect(averageDamage([{ type: 'weapon', damage: 10, uses: 5 }], [{ type: 'weapon', cost: 1 }])).toBe(10 + Math.ceil(50 / 2))
  })

  const budgets: { npc: GeneratedNpc, budget: NpcBudget }[] = []
  let seed = 1
  for (const s of npcStats) {
    for (const c of ['adept', 'engineer', 'infiltrator', 'sentinel', 'soldier', 'vanguard']) {
      for (const scale of [-2, -1, 0, 1, 2]) {
        const focus = (['powers', 'weapons', 'grenades'] as const)[seed % 3]
        budgets.push(run({ cr: s.id, klass: c, species: 'human', offensiveScale: scale, traits: false, damageFocus: focus, grenades: seed % 4 !== 0 }, seed++))
      }
    }
  }

  it('builds valid bestiary records for every CR, class and offensive scale', () => {
    for (const { npc } of budgets) expect(valid(npc), `${npc.name} CR ${npc.cr}`).toBe(true)
    expect(budgets).toHaveLength(npcStats.length * 6 * 5)
  })

  it('keeps armor class, attack bonus and proficiency to the CR table', () => {
    for (const { npc, budget } of budgets) {
      const cr = stat(npc.cr)
      const [lo, hi] = AC_MODS[budget.offensiveScale]!
      expect(npc.ac).toBeGreaterThanOrEqual(cr.ac + lo!)
      expect(npc.ac).toBeLessThanOrEqual(cr.ac + hi!)
      expect(npc.profBonus).toBe(cr.profBonus)
      const attack = abilityMod(npc.abilityScores[PRIMARY[budget.klass]!]) + npc.profBonus
      expect(attack, `${npc.name} CR ${cr.cr} scale ${budget.offensiveScale}`).toBeGreaterThanOrEqual(budget.attack.min)
      expect(attack).toBeLessThanOrEqual(budget.attack.max)
      expect(budget.attack.min).toBe(cr.attack + Math.min(0, budget.offensiveScale))
      expect(budget.attack.max).toBe(Math.min(19, cr.attack + Math.max(0, budget.offensiveScale)))
    }
  })

  it('gives hit points within the HP budget, net of shields and features', () => {
    for (const { npc, budget } of budgets) {
      const cr = stat(npc.cr)
      const perDie = (npc.hp.dieType + 1) / 2 + abilityMod(npc.abilityScores.con)
      expect(npc.hp.dieType).toBe(8)
      // Enough dice for the minimum; one fewer would fall short (defensive NPCs reach past the maximum).
      expect(npc.hp.dieCount * perDie).toBeGreaterThanOrEqual(budget.hp.min)
      if (budget.offensiveScale >= 0) expect((npc.hp.dieCount - 1) * perDie).toBeLessThan(budget.hp.min)
      else expect(npc.hp.dieCount * perDie).toBeGreaterThanOrEqual(budget.hp.max)
      expect(hitPointAverage(npc)).toBeGreaterThanOrEqual(budget.hp.min - npc.hp.dieCount)
      // The CR's hit points, moved by the scale, less what shields and features add (never below 5).
      const { percent, offensiveScale: scale } = budget
      expect(budget.hp.min).toBe(Math.max(5, Math.floor(cr.hp - cr.hp * (scale >= 0 ? percent : 0) - budget.hp.bonus)))
      expect(budget.hp.max).toBe(Math.ceil(cr.hp + cr.hp * (scale <= 0 ? percent : 0) - budget.hp.bonus))
      if (npc.shields) expect(budget.hp.bonus).toBeGreaterThanOrEqual(npc.shields.capacity)
    }
  })

  it('stays within the damage budget unless no attack is cheap enough (legendary actions: within a sixth over the target)', () => {
    let checked = 0
    for (const { npc, budget } of budgets) {
      const cr = stat(npc.cr)
      const { percent, offensiveScale: scale } = budget
      expect(budget.damage.min).toBe(Math.floor(cr.damage - cr.damage * (scale <= 0 ? percent : 0)))
      expect(budget.damage.max).toBe(Math.floor(cr.damage + cr.damage * (scale >= 0 ? percent : 0)))
      expect(budget.damage.target).toBeGreaterThanOrEqual(cr.damage - Math.floor(percent * cr.damage))
      expect(budget.damage.target).toBeLessThanOrEqual(cr.damage + Math.ceil(percent * cr.damage))
      if (budget.damage.fallback) continue
      const { target, max } = budget.damage
      expect(budget.damage.average, `${npc.name} CR ${cr.cr}`).toBeLessThanOrEqual(npc.entries.legendary ? Math.max(max, target + target / 6) : max)
      checked++
    }
    expect(checked).toBeGreaterThan(budgets.length / 2)
    // Legendary actions only from tier 3.
    for (const { npc, budget } of budgets) if (npc.entries.legendary) expect(budget.metaTier).toBeGreaterThan(2)
    expect(budgets.some(b => b.npc.entries.legendary)).toBe(true)
  })

  it('sets save DCs from proficiency and the casting ability', () => {
    let casters = 0
    for (const { npc } of budgets) {
      const pc = npc.entries.features?.find(f => f.id === 'powercasting')
      if (!pc) continue
      casters++
      const dc = 8 + npc.profBonus + abilityMod(npc.abilityScores[pc.mod!])
      expect(pc.text).toContain(`power save DC ${dc}`)
      expect(pc.text).toContain(abilityTitle(pc.mod!))
      expect(isLeveledPowercasting(pc)).toBe(true)
    }
    expect(casters).toBeGreaterThan(100)
    expect(budgets.filter(b => b.budget.klass === 'soldier').every(b => !b.npc.entries.features?.some(f => f.id === 'powercasting'))).toBe(true)
  })

  it('adds class features, weapons and grenades', () => {
    const ids = (b: typeof budgets[number]) => [...(b.npc.entries.features ?? []), ...(b.npc.entries.actions ?? []), ...(b.npc.entries.reactions ?? [])].map(e => e.id)
    expect(budgets.some(b => ids(b).includes('barrier'))).toBe(true)
    expect(budgets.some(b => ids(b).includes('sneak-attack'))).toBe(true)
    expect(budgets.some(b => ids(b).includes('tactical-cloak'))).toBe(true)
    expect(budgets.some(b => ids(b).includes('summon-drone'))).toBe(true)
    expect(budgets.some(b => ids(b).includes('multiattack'))).toBe(true)
    expect(budgets.some(b => ids(b).some(id => ['beehive', 'ballistic-blades', 'hex-shield', 'fortification'].includes(id!)))).toBe(true)
    const grenades = budgets.flatMap(b => b.npc.entries.features?.filter(f => f.id === 'grenades') ?? [])
    expect(grenades.length).toBeGreaterThan(0)
    expect(grenades.flatMap(g => g.list ?? []).every(i => typeof i === 'object' && ['frag-grenade', 'flashbang-grenade', 'smoke-grenade'].includes(i.id) && (i.uses ?? 0) > 0)).toBe(true)
    for (const b of budgets) {
      for (const a of b.npc.entries.actions ?? []) if (a.ref === 'weapon') expect(weapons.map(w => w.id)).toContain(a.weaponId)
    }
  })

  it('runs every species\' traits, with and without them', () => {
    for (const [i, id] of [...TRAIT_SPECIES, 'human'].entries()) {
      for (const c of ['adept', 'engineer', 'soldier']) {
        for (const traits of [true, false]) {
          for (const cr of ['00500', '10000', '25000']) {
            const { npc } = run({ cr, klass: c, species: id, traits }, 1000 + i * 31 + cr.length)
            expect(valid(npc), `${id} ${c} ${cr}`).toBe(true)
            expect(npc.name.toLowerCase()).toContain(id)
          }
        }
      }
    }
    // Spot checks of what each trait does.
    const withTraits = (id: string, klassId = 'soldier', seedValue = 7) => run({ cr: '05000', klass: klassId, species: id, traits: true, offensiveScale: 0 }, seedValue).npc
    const names = (npc: GeneratedNpc) => [...(npc.entries.features ?? []), ...(npc.entries.actions ?? [])].map(e => e.name)
    expect(withTraits('geth').irv?.damImm).toEqual(['poison', 'psychic'])
    // Never both resistant (or immune) and vulnerable to a damage type.
    for (const [i, id] of TRAIT_SPECIES.entries()) {
      for (let s = 0; s < 20; s++) {
        const { irv } = run({ cr: '05000', klass: 'adept', species: id, traits: true, offensiveScale: 0 }, 500 + i * 20 + s).npc
        for (const d of irv?.vul ?? []) expect([...(irv?.res ?? []), ...(irv?.damImm ?? [])]).not.toContain(d)
      }
    }
    expect(withTraits('geth').irv?.conImm).toContain('poisoned')
    expect(withTraits('geth').type).toBe('synthetic')
    expect(names(withTraits('hanar'))).toContain('Tentacles')
    expect(withTraits('hanar').speed.swim).toBe(30)
    expect(withTraits('prothean').senses?.truesight).toBe(30)
    expect(withTraits('prothean').irv?.res).toEqual(expect.arrayContaining(['cold', 'radiant']))
    expect(withTraits('volus').size).toBe('small')
    expect(withTraits('volus').hp.dieType).toBe(6)
    expect(withTraits('elcor').speed.walk).toBe(20)
    expect(names(withTraits('turian'))).toContain('Esprit de Corps')
    expect(names(withTraits('vorcha'))).toContain('Bite')
    expect(names(withTraits('krogan'))).toContain('Blood Rage')
    expect(withTraits('angara').irv?.res).toContain('lightning')
    expect(withTraits('asari', 'engineer').entries.features?.find(f => f.id === 'innate-powercasting')?.ref).toBe('power')
    expect(withTraits('batarian').skills).toEqual(expect.arrayContaining(['perception']))
    expect(names(withTraits('quarian'))).toContain('Hermetic Suit')
    expect(names(withTraits('salarian'))).toContain('Amphibious')
    expect(names(withTraits('drell'))).toContain('Raw Agility')
    expect(Object.keys(speciesTraits).sort()).toEqual([...TRAIT_SPECIES].sort())
  })

  it('repeats an NPC from the same seed and picks what is left out', () => {
    expect(run({ cr: '05000', klass: 'adept', species: 'asari' }, 99)).toEqual(run({ cr: '05000', klass: 'adept', species: 'asari' }, 99))
    const random = run({}, 5)
    expect(valid(random.npc)).toBe(true)
    expect(random.npc.id).toMatch(/^generated-[a-z\d-]+-1700000000000$/)
  })

  it('applies species and subspecies increases', () => {
    const b = new NpcBuilder(data, seededRandom(3), { cr: stat('05000'), klass: classes[0] as never, species: data.species.find(s => s.id === 'asari')!, offensiveScale: 0, grenades: true, traits: false, damageFocus: 'powers', now: 0 })
    b.setAbilityScores()
    // Adept primary Wisdom 15 + 1 (asari), Charisma 13 + 2 (maiden), within the CR's attack margins.
    expect(b.npc.abilityScores.wis).toBeGreaterThanOrEqual(14)
  })

  it('lists a caster\'s powers by level', () => {
    const t = (key: string, p?: unknown) => (p ? `${key}${JSON.stringify(p)}` : key)
    const refs = npcSheetRefs(records({ powers, 'npc-stats': npcStats, skills, conditions, weapons, gear }))
    const lines = powerLevelLines(t, { ref: 'power', list: ['warp', 'throw', 'shockwave', 'missing'] }, refs.powers)
    expect(lines.map(l => l.links.map(x => x.id))).toEqual([['throw'], ['warp'], ['shockwave']])
    expect(refs.challenge['00500']).toEqual({ cr: '1/2', xp: 100 })
    expect(ordinal(1)).toBe('1st')
    expect(ordinal(12)).toBe('12th')
    expect(ordinal(23)).toBe('23rd')
  })
})

describe('live NPC bookmarks', () => {
  // The live generator's output (old bestiary.json keys), as a migrated bookmark holds it.
  const live = {
    id: 'generated-human engineer-1600000000000',
    name: 'Human Engineer',
    image: false,
    unit: 'archetype',
    type: 'organic',
    alignment: 'cn',
    ac: 14,
    irv: false,
    savingThrows: ['int'],
    senses: false,
    size: 'medium',
    skills: [],
    speed: { walk: 30 },
    profBonus: 3,
    abilityScores: { str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 8 },
    entries: {
      features: [
        { name: 'Powercasting', casterLevel: 5, mod: 'int', text: 'The human engineer is a 5th-level powercaster.\n               Its powercasting ability is Intelligence\n               (power save DC 14, +6 to hit with powers). The human engineer has 6 tech points, from which it can cast the following powers:', id: 'powercasting', list: ['incinerate', 'decoy'], tech: { points: 6, limit: 2 } },
        { name: 'Sneak Attack', uses: 1, perTurn: true, text: 'The human engineer deals an extra 3 (1d6) damage when the target is within <me-distance length="5" /> of an ally.', id: 'sneakAttack' },
        { list: [{ id: 'frag-grenade', mark: 'ii', uses: 2 }], name: 'Grenades', text: 'The human engineer has the following grenades equipped.', id: 'grenades' },
      ],
      actions: [
        { ref: 'weapon', proficient: true, weaponId: 'm-3-predator', id: 'm-3-predator-0' },
        { name: 'Nightshade Blades', uses: 3, attack: 'ranged', hardRange: true, proficient: true, range: 30, dc: false, mod: 'dex', damage: [{ dieCount: 3, dieType: 12, type: 'poison', mod: false }], hit: 'The target must succeed on a DC 11 Constitution saving throw or become <me-condition id="poisoned" /> until it finishes a short rest', target: 'one' },
      ],
      legendary: {},
      reactions: [],
    },
    hp: { dieCount: 12, dieType: 8 },
    shields: { capacity: 10, regen: 5 },
    cr: '05000',
  }

  it('converts a live generated NPC to the bestiary shape', () => {
    const npc = fromLiveNpc(live)
    expect(valid(npc)).toBe(true)
    expect(npc.id).toBe('generated-human-engineer-1600000000000')
    expect(npc.senses).toBeUndefined()
    expect(npc.irv).toBeUndefined()
    expect(npc.skills).toBeUndefined()
    expect(npc.entries.legendary).toBeUndefined()
    expect(npc.entries.reactions).toBeUndefined()
    const [pc, sneak, grenades] = npc.entries.features!
    expect(pc!.ref).toBe('power')
    expect(pc!.text).toBe('The human engineer is a 5th-level powercaster. Its powercasting ability is Intelligence (power save DC 14, +6 to hit with powers). The human engineer has 6 tech points (at most 2 on one power), from which it can cast the following powers:')
    expect(sneak!.text).toBe('Once per turn, the human engineer deals an extra 3 (1d6) damage when the target is within :distance{length="5"} of an ally.')
    expect(sneak!.uses).toBeUndefined()
    expect(grenades!.list).toEqual([{ id: 'frag-grenade', mark: 'ii', uses: 2 }])
    expect(npc.entries.actions![1]!.hit).toContain(':condition{id="poisoned"}')
    expect(npc.entries.actions![1]).not.toHaveProperty('dc')
  })

  it('converts pact casters, old action maps and bound attributes', () => {
    expect(liveTagsToMdc('within <me-distance :length="60" abbr />, then <me-condition id="prone"></me-condition>')).toBe('within :distance{length="60" abbr}, then :condition{id="prone"}')
    const npc = fromLiveNpc({ ...live, senses: { infrared_vision: 30 }, irv: { res: ['fire'], vul: [] }, entries: {
      features: [{ id: 'powercasting', name: 'Powercasting', text: 'Knows:', list: ['warp'], pact: { numSlots: 2, maxLevel: 3 }, casterLevel: '5' }],
      actions: { 'unarmed-strike': { name: 'Unarmed Strike', attack: 'melee', proficient: true, range: 5, mod: 'str', damage: [{ flat: 1, type: 'bludgeoning', mod: true }], target: 'one' } },
      legendary: { text: 'Legendary text.', actions: [{ name: 'Attack', cost: 2, text: 'Attacks.', id: 'attack' }] },
    } })
    expect(valid(npc)).toBe(true)
    expect(npc.senses).toEqual({ 'infrared-vision': 30 })
    expect(npc.irv).toEqual({ res: ['fire'] })
    expect(npc.entries.features![0]!.text).toBe('It has 2 3rd-level power slots. Knows:')
    expect(npc.entries.features![0]!.casterLevel).toBe(5)
    expect(npc.entries.actions![0]!.id).toBe('unarmed-strike')
    expect(npc.entries.legendary?.actions).toHaveLength(1)
  })
})

describe('loot generator', () => {
  const tables: LootTable[] = [
    { id: 'a', name: 'Equipment Table A', rows: [{ min: 1, max: 50, consumable: 'medi-gel-standard', count: '1d6', bonus: 2 }, { min: 51, max: 100, item: 'gear', rarity: 'very_rare' }] },
    { id: 'b', name: 'Equipment Table B', rows: [{ min: 1, max: 100, item: 'armor', rarity: 'spectre' }] },
    { id: 'c', name: 'Equipment Table C', rows: [{ min: 1, max: 100, consumable: 'omni-gel', count: '2d4' }] },
  ]
  const band = (id: string, rolls: LootReward['hoard']['rolls']): LootReward => ({ id, name: id, order: 1, individual: [10, 20, 30], hoard: { credits: 3000, additionalCredits: [0, 1000, 2000], rolls } })
  const rewards = [
    band('a-twice', [{ min: 1, max: 100, table: 'a', times: 2 }]),
    band('a-dice', [{ min: 1, max: 100, table: 'a', times: '1d6' }]),
    band('b-once', [{ min: 1, max: 100, table: 'b' }]),
    band('c-many', [{ min: 1, max: 100, table: 'c', times: 8 }]),
    band('nothing', [{ min: 1, max: 100 }]),
  ]
  const loot = lootData(records({ gear, weapons, 'armor': [], 'mods': [], 'loot-tables': tables as unknown as Rec[], 'loot-rewards': rewards as unknown as Rec[] }))
  const t = (key: string, p?: Record<string, unknown>) => (p ? `${key}${JSON.stringify(p)}` : key)

  it('expands "varies" gear by mark at each mark\'s rarity (live compared "Grenade" and "Varies")', () => {
    const ids = loot.items.gear.map(i => i.id)
    expect(ids).toContain('frag-grenade-vii')
    expect(loot.items.gear.find(i => i.id === 'frag-grenade-vii')).toMatchObject({ rarity: 'very_rare', page: 'frag-grenade', name: 'Frag Grenade VII' })
    expect(ids).toContain('primal-tap-iv-exe')
    expect(ids).not.toContain('frag-grenade')
    // A "varies" item without versions can't be priced: left out.
    expect(ids).not.toContain('mystery-device')
    expect(ids).toContain('smoke-grenade')
    expect(ids).toContain('m-920-cain')
  })

  it('leaves out tools, ammo, omni-gel and medi-gel (live excluded "Tool", "Omni-gel"...: nothing matched)', () => {
    const gearIds = new Set(loot.items.gear.map(i => i.page))
    for (const g of gear.filter(g => EXCLUDED_GEAR_TYPES.includes(g.gearType))) expect(gearIds.has(g.id)).toBe(false)
    expect(gearIds.has('medi-gel')).toBe(false)
    // Their names are still known, for consumable rows.
    expect(loot.gear['medi-gel-standard']).toEqual({ name: 'Standard Medi-gel', page: 'medi-gel' })
  })

  it('rolls very rare gear without failing (live asked for "very rare" and threw)', () => {
    let found = 0
    for (let s = 1; s <= 40; s++) {
      const r = rollLoot(loot, { band: 'a-twice', hoard: true }, seededRandom(s))
      for (const item of r.items.gear) {
        expect(item.rarity).toBe('very_rare')
        found++
      }
    }
    expect(found).toBeGreaterThan(0)
    // A rarity nobody has: logged, nothing added.
    const none = rollLoot(loot, { band: 'b-once', hoard: true }, seededRandom(1))
    expect(none.items.armor).toEqual([])
    expect(none.log.at(-1)!.result).toEqual({ key: 'loot.log.item_none', params: { rarity: { key: 'rarities.spectre' }, kind: { key: 'loot.kinds.armor' } } })
  })

  it('adds medi-gel by grade, with the bonus (live never added medi-gel nor the bonus)', () => {
    let rolled = 0
    for (let s = 1; s <= 40; s++) {
      const r = rollLoot(loot, { band: 'a-twice', hoard: true }, seededRandom(s))
      const medi = r.consumables.find(c => c.id === 'medi-gel-standard')
      const lines = r.log.filter(l => 'key' in l.result && l.result.key === 'loot.log.consumable_result')
      if (!lines.length) continue
      rolled++
      expect(medi?.name).toBe('Standard Medi-gel')
      expect(medi?.page).toBe('medi-gel')
      // Each roll is 1d6 + 2: 3 to 8.
      expect(medi!.count).toBeGreaterThanOrEqual(3 * lines.length)
      expect(medi!.count).toBeLessThanOrEqual(8 * lines.length)
      const sum = lines.reduce((n, l) => n + Number((l.result as unknown as { params: { n: number } }).params.n), 0)
      expect(medi!.count).toBe(sum)
    }
    expect(rolled).toBeGreaterThan(0)
    const omni = rollLoot(loot, { band: 'c-many', hoard: true }, seededRandom(4))
    expect(omni.consumables).toHaveLength(1)
    expect(omni.consumables[0]!.count).toBeGreaterThanOrEqual(16)
  })

  it('rolls a table a fixed number of times, or dice', () => {
    const twice = rollLoot(loot, { band: 'a-twice', hoard: true }, seededRandom(2))
    expect(twice.log.filter(l => 'key' in l.text && l.text.key === 'loot.log.table_roll')).toHaveLength(2)
    const dice = rollLoot(loot, { band: 'a-dice', hoard: true }, seededRandom(2))
    const times = dice.log.find(l => 'key' in l.text && l.text.key === 'loot.log.times_roll')!
    expect(dice.log.filter(l => 'key' in l.text && l.text.key === 'loot.log.table_roll')).toHaveLength(Number((times.result as { text: string }).text))
    const nothing = rollLoot(loot, { band: 'nothing', hoard: true }, seededRandom(2))
    expect(nothing.credits).toBeGreaterThanOrEqual(3000)
    expect(lootText(t, nothing.log.at(-1)!.result)).toContain('loot.nothing')
  })

  it('gives one creature credits from its band', () => {
    for (let s = 1; s < 20; s++) {
      const r = rollLoot(loot, { band: 'a-twice', hoard: false }, seededRandom(s))
      expect([10, 20, 30]).toContain(r.credits)
      expect(r.log).toHaveLength(1)
    }
    expect(rollLoot(loot, { band: 'a-twice', hoard: true }, seededRandom(1))).toEqual(rollLoot(loot, { band: 'a-twice', hoard: true }, seededRandom(1)))
  })

  it('writes the raw tables\' rows', () => {
    expect(lootText(t, tableRowText(loot, tables[0]!.rows[0]!))).toBe('loot.row_consumable{"dice":"1d6 + 2","name":"Standard Medi-gel"}')
    expect(lootText(t, tableRowText(loot, tables[0]!.rows[1]!))).toBe('loot.row_item{"rarity":"rarities.very_rare","kind":"loot.kinds.gear"}')
    expect(lootText(t, hoardRowText(loot, { min: 1, max: 5 }))).toBe('loot.nothing')
    expect(lootText(t, hoardRowText(loot, { min: 1, max: 5, table: 'a' }))).toBe('loot.roll_once{"table":"Equipment Table A"}')
    expect(lootText(t, hoardRowText(loot, { min: 1, max: 5, table: 'a', times: '1d4' }))).toBe('loot.roll_times{"times":"1d4","table":"Equipment Table A"}')
    expect(lootText((k, p) => (k === 'digit_separator' ? ',' : t(k, p)), { key: 'loot.log.credits', params: { n: 150000 } })).toBe('loot.log.credits{"n":"150,000"}')
  })

  it('checks that d100 rows cover 1-100 once (live tables overlapped and had gaps)', () => {
    expect(d100Problems([{ min: 1, max: 50 }, { min: 51, max: 100 }])).toEqual([])
    // Live table A: 16-35 and 35-50.
    expect(d100Problems([{ min: 1, max: 35 }, { min: 35, max: 100 }])).toEqual(['35-100 overlaps the row before it'])
    // Live table B: nothing on 45-54.
    expect(d100Problems([{ min: 1, max: 44 }, { min: 55, max: 100 }])).toEqual(['nothing on 45-54'])
    expect(d100Problems([{ min: 1, max: 99 }])).toEqual(['nothing on 100'])
    expect(d100Problems([{ min: 2, max: 100 }])).toEqual(['nothing on 1'])
    const schema = game.schemas['loot-tables']!
    expect(schema.safeParse({ id: 'a', name: 'A', rows: tables[0]!.rows }).success).toBe(true)
    const bad = schema.safeParse({ id: 'a', name: 'A', rows: [{ min: 1, max: 60, item: 'gear', rarity: 'rare' }, { min: 50, max: 100, consumable: 'omni-gel', count: '1d4' }] })
    expect(bad.success).toBe(false)
    expect(game.schemas['loot-tables']!.safeParse({ id: 'a', name: 'A', rows: [{ min: 1, max: 100, item: 'gear', rarity: 'very rare' }] }).success).toBe(false)
    const reward = game.schemas['loot-rewards']!
    expect(reward.safeParse({ ...rewards[0], hoard: { ...rewards[0]!.hoard, rolls: [{ min: 1, max: 100, times: 2 }] } }).success).toBe(false)
    for (const r of rewards) expect(reward.safeParse(r).success).toBe(true)
  })
})

// The real content, when the checkout is next to this repo (local only).
const contentRoot = join(import.meta.dirname, '../../../../omnibrew-me5e-data')
describe.skipIf(!existsSync(join(contentRoot, 'content')))('generators on the content repo', () => {
  const all = existsSync(join(contentRoot, 'content')) ? loadRecords(contentRoot, me5eDefinition).records : new Map()

  it('has loot tables that cover 1-100 and name tables and gear that exist', () => {
    const real = lootData(all)
    expect(real.rewards.map(r => r.name)).toEqual(['0-4', '5-10', '11-16', '17+'])
    expect(Object.keys(real.tables).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
    for (const table of Object.values(real.tables)) {
      expect(d100Problems(table.rows), table.id).toEqual([])
      for (const row of table.rows) {
        if ('consumable' in row) expect(real.gear[row.consumable], row.consumable).toBeDefined()
        else expect(real.items[row.item].some(i => i.rarity === row.rarity), `${table.id} ${row.item} ${row.rarity}`).toBe(true)
      }
    }
    for (const r of real.rewards) {
      expect(d100Problems(r.hoard.rolls), r.id).toEqual([])
      for (const row of r.hoard.rolls) if (row.table) expect(real.tables[row.table]).toBeDefined()
      for (let s = 0; s < 30; s++) rollLoot(real, { band: r.id, hoard: true }, seededRandom(s))
    }
  })

  it('builds valid NPCs for every class and species', () => {
    const real = npcData(all)
    let s = 1
    for (const k of npcClassOptions(real)) {
      for (const sp of npcSpeciesOptions(real)) {
        for (const cr of ['00000', '05000', '15000', '30000']) {
          const { npc } = generateNpc(real, { cr, klass: k.id, species: sp.id, offensiveScale: (s % 5) - 2, now: 1 }, seededRandom(s++))
          expect(valid(npc), `${npc.name} ${cr}`).toBe(true)
          for (const a of npc.entries.actions ?? []) if (a.weaponId) expect(all.get('weapons')!.has(a.weaponId)).toBe(true)
        }
      }
    }
  })
})
