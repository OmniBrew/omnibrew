import type { NpcBuilder, NpcListItem } from './npc'
import { powerDamage } from './npc-data'
import { averageDice } from './random'

/**
 * Species traits for generated NPCs (the live Traits.js): hand-written per species, applied
 * when "Species traits" is on. Species without an entry get none.
 */
type Traits = (b: NpcBuilder) => void

const amphibious = (b: NpcBuilder) => b.feature({ name: 'Amphibious', text: `The ${b.lcName} can breathe both air and water.`, id: 'amphibious' })
const hitText = (b: NpcBuilder, ability: 'cha') => `power save DC ${b.dc(ability)}, +${b.npc.profBonus + b.mod(ability)} to hit with power attacks`
const doubleSpeed = (b: NpcBuilder, name: string, id: string) => b.feature({
  name,
  text: `When the ${b.lcName} moves on its turn in combat, it can double its speed until the end of the turn. Once it uses this ability, the ${b.lcName} can't use it again until it spends one of its turns without moving.`,
  id,
})

export const speciesTraits: Record<string, Traits> = {
  angara(b) {
    const dmg = { type: 'power' as const, damage: 3, uses: 5 }
    if (b.isDamageAddable(dmg)) {
      b.feature({
        mod: 'cha',
        ref: 'power',
        list: [{ id: 'shocking-grasp', perDay: 'at_will' }],
        name: 'Bio-Electric Focus',
        text: `The ${b.lcName}'s innate powercasting ability is Charisma (${hitText(b, 'cha')}). It can innately cast the following at 1st level:`,
        id: 'innate-powercasting',
      })
      b.addDamage(dmg)
    }
    b.npc.ac += 1
    b.addResistances('lightning')
    b.feature({ name: 'Bio-Electric Ward', text: `The ${b.lcName}'s lightning resistance does not apply to its shields.`, id: 'bio-electric-ward' })
    b.feature({ name: 'Solar Dependency', text: `If the ${b.lcName} fails to immerse itself in sunlight for at least 1 hour during a day, it suffers one level of :condition{id="exhaustion"}.`, id: 'solar-dependency' })
    b.addSkill('survival')
  },

  asari(b) {
    // Innate biotics for the classes without biotic powers.
    if (['engineer', 'infiltrator', 'soldier'].includes(b.klassId)) {
      const options = b.data.powers.filter(p => p.classes?.includes('adept') && p.powerType !== 'combat' && (p.level === 0 || p.level === 1)).map((power) => {
        const d = powerDamage(power)
        return { power, dmg: { type: 'power' as const, damage: d ? averageDice(d.dieType, d.dieCount) : 0, uses: power.level === 0 ? 5 : 1 } }
      })
      const list: NpcListItem[] = []
      for (let i = 0; i < 2; i++) {
        const cantrip = b.pick(options.filter(o => o.power.level === 0 && !list.some(l => l.id === o.power.id) && b.isDamageAddable(o.dmg)))
        if (!cantrip) continue
        list.push({ id: cantrip.power.id, perDay: 'at_will' })
        b.addDamage(cantrip.dmg)
      }
      const power = b.pick(options.filter(o => o.power.level === 1 && b.isDamageAddable(o.dmg)))
      if (power) list.push({ id: power.power.id, perDay: 1 })
      if (list.length) {
        b.feature({
          mod: 'cha',
          ref: 'power',
          list,
          name: 'Innate Biotics',
          text: `The ${b.lcName}'s innate powercasting ability is Charisma (${hitText(b, 'cha')}). It can innately cast the following:`,
          id: 'innate-powercasting',
        })
      }
    }
    b.feature({ name: 'Mind Meld', text: `The ${b.lcName} can transfer and receive thoughts from a willing, intelligent creature. If the creature is unwilling, the thoughts become jumbled and disjointed.`, id: 'mind-meld' })
    b.addSkill('persuasion')
  },

  batarian(b) {
    b.addSkill('perception')
    const skills = b.npc.skills!
    if (!skills.includes('insight') && !skills.includes('intimidation')) b.addSkill(b.pick(['insight', 'intimidation'])!)
    else if (!skills.includes('intimidation')) b.addSkill('intimidation')
    else if (!skills.includes('insight')) b.addSkill('insight')
    b.feature({ name: 'Four Eyes', text: `The ${b.lcName} can take the Search action as a bonus action on each of its turns.`, id: 'four-eyes' })
    b.feature({ name: 'Saving Face', recharge: 'short', text: `When the ${b.lcName} misses with an attack roll or fails an ability check or saving throw, it may gain a bonus to the roll equal to the number of allies it can see (maximum +5).`, id: 'saving-face' })
  },

  drell(b) {
    const options = ['athletics', 'perception', 'stealth', 'survival'].filter(s => !b.npc.skills!.includes(s))
    for (let i = 0; i < Math.min(2, options.length); i++) b.addSkill(b.pick(options.filter(s => !b.npc.skills!.includes(s)))!)
    doubleSpeed(b, 'Raw Agility', 'raw-agility')
  },

  elcor(b) {
    b.feature({ name: 'Careful', text: `The ${b.lcName} has disadvantage on initiative rolls.`, id: 'careful' })
    b.addSkill('perception')
    b.addSkill('insight')
    b.npc.ac += 2
  },

  geth(b) {
    b.action({ name: 'Hunter Mode', recharge: 'long', text: `The ${b.lcName}'s speed increases by :distance{length="5"} and it gains a +1 bonus to weapon attack rolls for 1 minute.`, id: 'hunter-mode' })
    b.npc.ac += b.pick([1, 2, 3])!
    const irv = b.npc.irv!
    irv.damImm = ['poison', 'psychic']
    irv.res = irv.res?.filter(d => !irv.damImm!.includes(d))
    irv.vul = irv.vul?.filter(d => !irv.damImm!.includes(d))
    irv.conImm = [...new Set([...(irv.conImm ?? []), 'poisoned'])]
    const uses = Math.ceil(b.npc.profBonus / 2)
    const bonus = (uses / 2) * 4.5
    if (b.isHpBonusAddable(bonus)) {
      b.action({ name: 'Repair Matrix', uses, perDay: true, text: `The ${b.lcName} regains 1d8 hit points.`, id: 'repair-matrix' })
      b.healthBonus += bonus
    }
  },

  hanar(b) {
    b.npc.abilityScores.con -= 1
    amphibious(b)
    b.feature({ name: 'Bioluminescence', text: `The ${b.lcName} can shed dim light in a :distance{length="30" adj} radius.`, id: 'bioluminescence' })
    b.npc.speed.swim = 30
    b.feature({
      name: 'Contra-Gravitic Levitation',
      text: `When the ${b.lcName} suffers a critical hit, roll a d20. On a roll of 1 or 2, its contra-gravitic levitation device fails and its walking speed becomes 0. It can use its action to make a DC 15 Intelligence (Engineering) check to repair the device.`,
      id: 'contra-gravitic-levitation',
    })
    b.action({
      name: 'Tentacles',
      attack: 'melee',
      proficient: true,
      range: 5,
      mod: 'str',
      damage: [{ dieCount: 1, dieType: 6, mod: true, type: 'bludgeoning' }],
      target: 'one',
      hit: `The target must succeed on a DC ${b.cr.dc} Strength saving throw or be :condition{id="grappled"}. The ${b.lcName} can have up to six targets grappled at once`,
      id: 'tentacles',
    })
    b.action({ name: 'Secrete Toxin', text: `One creature grappled by the ${b.lcName} must make a DC ${b.cr.dc} Constitution saving throw or be :condition{id="poisoned"} for 1 hour.`, id: 'secrete-toxin' })
  },

  krogan(b) {
    b.raise('con')
    const gain = Math.max(1, b.mod('con'))
    b.feature({
      name: 'Blood Rage',
      text: `When the ${b.lcName} reduces an enemy's hit points to 0, it may enter a blood rage, gaining ${gain} temporary hit point${gain > 1 ? 's' : ''} at the start of each of its turns and becoming immune to being charmed or frightened. While raging, it can't concentrate on powers. The rage lasts 1 minute, and the ${b.lcName} loses any remaining temporary hit points when it ends.`,
      id: 'blood-rage',
    })
    b.addSkill('intimidation')
  },

  prothean(b) {
    b.addSkill('perception')
    b.npc.senses = { ...b.npc.senses, truesight: 30 }
    b.addResistances('cold', 'radiant')
  },

  quarian(b) {
    b.addResistances('necrotic', 'poison')
    b.feature({
      name: 'Hermetic Suit',
      text: `When the ${b.lcName} suffers a critical hit that deals piercing or slashing damage, it suffers 1 level of :condition{id="exhaustion"} every hour until it patches its suit. It may patch its suit using an action and expending an omni-gel.`,
      id: 'hermetic-suit',
    })
    const skill = (from: string[]) => {
      const options = from.filter(s => !b.npc.skills!.includes(s))
      if (options.length) b.addSkill(b.pick(options)!)
    }
    switch (b.pick(['cerebral', 'muscular', 'ocular', 'visceral'])) {
      case 'cerebral':
        b.raise('int')
        b.feature({ name: 'Mind Shielding Unit', text: `The ${b.lcName} has advantage on saving throws against being charmed or frightened, or against an effect that would make it confused, compelled or put to sleep. Its mind can't be read by an asari's mind meld.`, id: 'mind-shielding-unit' })
        skill(['electronics', 'engineering', 'investigation', 'science'])
        break
      case 'muscular':
        b.raise('dex')
        doubleSpeed(b, 'Overclock Unit', 'overclock-unit')
        skill(['athletics', 'acrobatics'])
        break
      case 'ocular':
        b.npc.senses = { ...b.npc.senses, darkvision: 60 }
        b.feature({ name: 'Clarity Unit', text: `The ${b.lcName} has advantage on saving throws against being blinded.`, id: 'clarity-unit' })
        b.feature({
          name: 'Keen Eyesight',
          text: `The ${b.lcName} has advantage on Wisdom (Perception) checks that rely on sight. It can see in a lightly obscured area within :distance{length="30"} as if it were unobscured, and in a heavily obscured area within :distance{length="15"} as if it were lightly obscured.`,
          id: 'keen-eyesight',
        })
        break
      case 'visceral':
        if (b.npc.abilityScores.con <= 28) b.raise('con', 2)
        b.feature({ name: 'Revival Unit', recharge: 'long', text: `The first time the ${b.lcName} drops to 0 hit points, it drops to 1 hit point instead.`, id: 'revival-unit' })
        break
    }
  },

  salarian(b) {
    amphibious(b)
    for (let i = 0; i < 2; i++) {
      const skill = b.pick(b.data.skills.filter(s => !b.npc.skills!.includes(s.id)))
      if (skill) b.addSkill(skill.id)
    }
  },

  turian(b) {
    b.feature({ name: 'Esprit de Corps', text: `The ${b.lcName} has advantage on attack rolls against a creature if at least one of its allies is within :distance{length="5"} of the creature and the ally isn't incapacitated.`, id: 'esprit-de-corps' })
    b.addSkill('athletics')
    b.addResistances('radiant')
  },

  volus(b) {
    b.feature({ name: 'Fury of the Small', recharge: 'long', text: `When the ${b.lcName} damages a creature that is at least one size larger than itself, it can deal ${b.metaLevel} extra damage.`, id: 'fury-of-the-small' })
    b.feature({ name: 'Lucky', uses: 3, perDay: true, text: `The ${b.lcName} gains advantage on an attack roll, saving throw, or ability check, or imposes disadvantage on an attack roll that targets it.`, id: 'lucky' })
    b.feature({
      name: 'Hermetic Suit',
      text: `When the ${b.lcName} suffers a critical hit that deals piercing or slashing damage, it takes 7 (2d6) poison and 3 (1d6) slashing damage at the end of each of its turns until the suit is patched. It may patch its suit using an action and expending an omni-gel.`,
      id: 'hermetic-suit',
    })
    b.addResistances('necrotic', 'poison')
    b.addSkill('persuasion')
  },

  vorcha(b) {
    b.feature({ name: 'Non-Differentiated Cells', text: `The ${b.lcName} has advantage on saving throws against being poisoned.`, id: 'non-differentiated-cells' })
    b.addResistances('poison')
    b.action({ name: 'Bite', attack: 'melee', proficient: true, range: 5, mod: 'str', damage: [{ dieCount: 1, dieType: 6, mod: true, type: 'piercing' }], target: 'one', id: 'bite' })
    switch (b.pick(['aquatic', 'desert', 'frozen', 'high-gravity', 'underground', 'volcanic', 'zero-gravity'])) {
      case 'aquatic':
        amphibious(b)
        b.npc.speed.swim = 30
        break
      case 'desert':
        b.raise('con')
        break
      case 'frozen':
        b.addResistances('cold')
        break
      case 'high-gravity':
        b.raise('str')
        break
      case 'underground':
        b.npc.senses = { ...b.npc.senses, darkvision: 60, blindsight: 30 }
        break
      case 'volcanic':
        b.addResistances('fire')
        break
      case 'zero-gravity':
        b.feature({ name: 'Zero-G Aptitude', text: `While the ${b.lcName} is :condition{id="lifted"}, its speed is :distance{length="5"} and it doesn't have disadvantage on attack rolls.`, id: 'zero-g-aptitude' })
        break
    }
  },
}
