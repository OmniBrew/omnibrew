import type { DamageUse, NpcBuilder, NpcEntry } from './npc'
import { averageDice } from './random'

/**
 * Combat powers as NPC entries (the live CombatPowers.js): each power the generator knows,
 * its entry with dice that grow by tier, the stat block section it goes in, and its
 * damage for the budget. Powers not listed here are never picked.
 */
export interface CombatPowerEntry {
  id: string
  group: 'actions' | 'features' | 'reactions'
  entry: NpcEntry
  dmg: DamageUse
}

type Make = (b: NpcBuilder) => Omit<CombatPowerEntry, 'id' | 'dmg'> & { damage: number }

const POWERS: Record<string, Make> = {
  'ballistic-blades': (b) => {
    const dieCount = b.tierDieCount(2, 2)
    return {
      damage: averageDice(12, dieCount),
      group: 'actions',
      entry: { name: 'Ballistic Blades', uses: 1, attack: 'ranged', proficient: true, range: 30, mod: 'dex', damage: [{ dieCount, dieType: 12, type: 'piercing', mod: false }], target: 'one' },
    }
  },
  'beehive': (b) => {
    const dieCount = b.tierDieCount(3, 2)
    return {
      damage: averageDice(6, dieCount),
      group: 'actions',
      entry: { name: 'Beehive', uses: 1, text: `The ${b.lcName} shoots shrapnel in a :distance{length="15" adj} cone. Each creature in the area must make a DC ${b.dc('dex')} Dexterity saving throw, taking ${b.damageText(dieCount, 6)} piercing damage on a failed save, or half as much damage on a successful one.` },
    }
  },
  'concussive-shot': (b) => {
    const dieCount = b.tierDieCount(1, 1)
    return {
      damage: averageDice(8, dieCount),
      group: 'features',
      entry: { name: 'Concussive Shot', uses: 3, text: `The ${b.lcName} may activate concussive shot with a bonus action. The next ranged weapon attack that hits deals an extra ${b.damageText(dieCount, 8)} bludgeoning damage, and the target must succeed on a DC ${b.dc('dex')} Strength saving throw or be knocked :condition{id="prone"}.` },
    }
  },
  'flak-cannon': (b) => {
    const dieCount = b.tierDieCount(2, 2)
    return {
      damage: averageDice(6, dieCount),
      group: 'actions',
      entry: { name: 'Flak Cannon', uses: 3, text: `The ${b.lcName} targets an area within :distance{length="30"}. Each creature in a :distance{length="10" adj}-radius sphere centered on the target must make a DC ${b.dc('dex')} Dexterity saving throw, taking ${b.damageText(dieCount, 6)} piercing damage on a failed save, or half as much damage on a successful one.` },
    }
  },
  'fortification': b => ({
    damage: 0,
    group: 'reactions',
    entry: { name: 'Fortification', uses: 1, text: `When the ${b.lcName} is targeted by an attack it can see, it gains +5 AC until the start of its next turn.` },
  }),
  'havoc-strike': (b) => {
    const dieCount = b.tierDieCount(2, 2)
    return {
      damage: averageDice(8, dieCount),
      group: 'actions',
      entry: { name: 'Havoc Strike', uses: 2, text: `The ${b.lcName} moves to an unoccupied space within :distance{length="20"}. Each creature within :distance{length="5"} of where its movement ends must make a DC ${b.dc('str')} Dexterity saving throw, taking ${b.damageText(dieCount, 8)} piercing damage on a failed save, or half as much damage on a successful one.` },
    }
  },
  'hawk-missile-launcher': (b) => {
    const dieCount = b.tierDieCount(3, 3)
    return {
      damage: averageDice(6, dieCount),
      group: 'actions',
      entry: { name: 'Hawk Missile Launcher', uses: 1, text: `The ${b.lcName} targets a creature or object it can see within :distance{length="150"}. The target takes ${b.damageText(dieCount, 6)} thunder damage.` },
    }
  },
  'hex-shield': b => ({
    damage: 0,
    group: 'actions',
    entry: { name: 'Hex Shield', uses: 1, text: `The ${b.lcName} creates a free-standing shield with 5 AC and 50 shield points within :distance{length="5"}. The shield provides full cover until it has no shield points remaining.` },
  }),
  'nightshade-blades': (b) => {
    const dieCount = b.tierDieCount(1, 2)
    return {
      damage: averageDice(12, dieCount),
      group: 'actions',
      entry: {
        name: 'Nightshade Blades',
        uses: 3,
        attack: 'ranged',
        proficient: true,
        range: 30,
        mod: 'dex',
        damage: [{ dieCount, dieType: 12, type: 'poison', mod: false }],
        hit: `The target must succeed on a DC ${8 + b.npc.profBonus} Constitution saving throw or be :condition{id="poisoned"} until it finishes a short rest`,
        target: 'one',
      },
    }
  },
  'stimulant-pack': b => ({
    damage: 0,
    group: 'features',
    entry: { name: 'Stimulant Pack', uses: 1, text: `As a bonus action, the ${b.lcName} adds 1d4 to its attack rolls and saving throws for the next minute.` },
  }),
  'trophy-system': b => ({
    damage: 0,
    group: 'reactions',
    entry: { name: 'Trophy System', uses: 1, text: `When a grenade or a missile from a heavy weapon comes within :distance{length="15"} of the ${b.lcName}, it may detonate it immediately. If the detonation would make the ${b.lcName} make a Dexterity saving throw, it has advantage on the roll.` },
  }),
}

/** The power as an entry, or undefined when the generator doesn't know it. */
export function combatPower(b: NpcBuilder, id: string): CombatPowerEntry | undefined {
  const make = POWERS[id]
  if (!make) return undefined
  const { damage, group, entry } = make(b)
  // Concussive shot adds to a weapon attack: bonus damage, like sneak attack.
  const type = id === 'concussive-shot' ? 'bonus' : 'combat'
  return { id, group, entry: { id, ...entry }, dmg: { type, damage, uses: entry.uses ?? 1 } }
}
