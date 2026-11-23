import type { NpcBuilder, NpcEntry, NpcListItem } from './npc'
import { powerDamage, type NpcTrait } from './npc-data'
import { averageDice } from './random'

/**
 * Species traits for generated NPCs (the live Traits.js), applied when "Species traits" is
 * on. What each trait does stays here; its name and text are content (`npc-traits/<species>.md`,
 * `npc-traits-schema.ts`), looked up by id, with `{{ name }}`, `{{ dc }}` and the trait's own
 * values filled in. Traits a species file adds beyond these come along as written.
 */
type Traits = (b: NpcBuilder) => void
type Values = Record<string, string | number>

/** `{{ key }}` → its value; unknown keys stay as they are (the validator refuses them in content). */
export function fillTrait(text: string, values: Values): string {
  return text.replaceAll(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, key: string) => (key in values ? String(values[key]) : m))
}

/** The content entry of a trait: name and text (with values), or undefined if the species file lacks it. */
function text(b: NpcBuilder, id: string, values: Values = {}): Pick<NpcEntry, 'id' | 'name' | 'text'> | undefined {
  const t = b.data.traits.get(b.speciesId)?.find(x => x.id === id)
  if (!t) return undefined
  const filled = t.text ? fillTrait(t.text, { name: b.lcName, dc: b.cr.dc, ...values }) : undefined
  return { id, name: t.name, ...(filled ? { text: filled } : {}) }
}

/** Adds a feature (or action) with its text from content and what it does from `rest`. */
function feature(b: NpcBuilder, id: string, rest: Omit<NpcEntry, 'id' | 'name' | 'text'> = {}, values?: Values) {
  const t = text(b, id, values)
  if (t) b.feature({ ...rest, ...t })
}
function action(b: NpcBuilder, id: string, rest: Omit<NpcEntry, 'id' | 'name' | 'text'> = {}, values?: Values) {
  const t = text(b, id, values)
  if (t) b.action({ ...rest, ...t })
}

const hitText = (b: NpcBuilder, ability: 'cha') => `power save DC ${b.dc(ability)}, +${b.npc.profBonus + b.mod(ability)} to hit with power attacks`

/** Synthetic creatures (geth, unshackled AI): immune to poison and psychic damage and to being poisoned. */
function syntheticImmunities(b: NpcBuilder) {
  const irv = b.npc.irv!
  irv.damImm = ['poison', 'psychic']
  irv.res = irv.res?.filter(d => !irv.damImm!.includes(d))
  irv.vul = irv.vul?.filter(d => !irv.damImm!.includes(d))
  irv.conImm = [...new Set([...(irv.conImm ?? []), 'poisoned'])]
}

export const speciesTraits: Record<string, Traits> = {
  angara(b) {
    const dmg = { type: 'power' as const, damage: 3, uses: 5 }
    if (b.isDamageAddable(dmg)) {
      feature(b, 'innate-powercasting', { mod: 'cha', ref: 'power', list: [{ id: 'shocking-grasp', perDay: 'at_will' }] }, { powercasting: hitText(b, 'cha') })
      b.addDamage(dmg)
    }
    b.npc.ac += 1
    b.addResistances('lightning')
    feature(b, 'bio-electric-ward')
    feature(b, 'solar-dependency')
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
      if (list.length) feature(b, 'innate-powercasting', { mod: 'cha', ref: 'power', list }, { powercasting: hitText(b, 'cha') })
    }
    feature(b, 'mind-meld')
    b.addSkill('persuasion')
  },

  batarian(b) {
    b.addSkill('perception')
    const skills = b.npc.skills!
    if (!skills.includes('insight') && !skills.includes('intimidation')) b.addSkill(b.pick(['insight', 'intimidation'])!)
    else if (!skills.includes('intimidation')) b.addSkill('intimidation')
    else if (!skills.includes('insight')) b.addSkill('insight')
    feature(b, 'four-eyes')
    feature(b, 'saving-face', { recharge: 'short' })
  },

  drell(b) {
    const options = ['athletics', 'perception', 'stealth', 'survival'].filter(s => !b.npc.skills!.includes(s))
    for (let i = 0; i < Math.min(2, options.length); i++) b.addSkill(b.pick(options.filter(s => !b.npc.skills!.includes(s)))!)
    feature(b, 'raw-agility')
  },

  elcor(b) {
    feature(b, 'careful')
    b.addSkill('perception')
    b.addSkill('insight')
    b.npc.ac += 2
  },

  'awakened-collector'(b) {
    // Wings: a short flight (the trait text says it falls at the end of its turn).
    b.npc.speed.fly = 30
    feature(b, 'wings')
    // Seeker Swarm: three swarms of 1d4 + 1 necrotic each, counted like an innate power.
    const dmg = { type: 'power' as const, damage: 3.5, uses: 3 }
    if (b.isDamageAddable(dmg)) {
      action(b, 'seeker-swarm')
      b.addDamage(dmg)
    }
  },

  geth(b) {
    action(b, 'hunter-mode', { recharge: 'long' })
    b.npc.ac += b.pick([1, 2, 3])!
    syntheticImmunities(b)
    const uses = Math.ceil(b.npc.profBonus / 2)
    const bonus = (uses / 2) * 4.5
    if (b.isHpBonusAddable(bonus)) {
      action(b, 'repair-matrix', { uses, perDay: true })
      b.healthBonus += bonus
    }
  },

  hanar(b) {
    b.npc.abilityScores.con -= 1
    feature(b, 'amphibious')
    feature(b, 'bioluminescence')
    b.npc.speed.swim = 30
    feature(b, 'contra-gravitic-levitation')
    // An attack: its content text is what a hit does.
    const tentacles = text(b, 'tentacles')
    if (tentacles) {
      b.action({
        id: tentacles.id,
        name: tentacles.name,
        attack: 'melee',
        proficient: true,
        range: 5,
        mod: 'str',
        damage: [{ dieCount: 1, dieType: 6, mod: true, type: 'bludgeoning' }],
        target: 'one',
        ...(tentacles.text ? { hit: tentacles.text } : {}),
      })
    }
    action(b, 'secrete-toxin')
  },

  kett(b) {
    feature(b, 'exoskeleton')
  },

  krogan(b) {
    b.raise('con')
    const gain = Math.max(1, b.mod('con'))
    feature(b, 'blood-rage', {}, { temporaryHitPoints: `${gain} temporary hit point${gain > 1 ? 's' : ''}` })
    b.addSkill('intimidation')
  },

  prothean(b) {
    b.addSkill('perception')
    b.npc.senses = { ...b.npc.senses, truesight: 30 }
    b.addResistances('cold', 'radiant')
  },

  quarian(b) {
    b.addResistances('necrotic', 'poison')
    feature(b, 'hermetic-suit')
    const skill = (from: string[]) => {
      const options = from.filter(s => !b.npc.skills!.includes(s))
      if (options.length) b.addSkill(b.pick(options)!)
    }
    switch (b.pick(['cerebral', 'muscular', 'ocular', 'visceral'])) {
      case 'cerebral':
        b.raise('int')
        feature(b, 'mind-shielding-unit')
        skill(['electronics', 'engineering', 'investigation', 'science'])
        break
      case 'muscular':
        b.raise('dex')
        feature(b, 'overclock-unit')
        skill(['athletics', 'acrobatics'])
        break
      case 'ocular':
        b.npc.senses = { ...b.npc.senses, darkvision: 60 }
        feature(b, 'clarity-unit')
        feature(b, 'keen-eyesight')
        break
      case 'visceral':
        if (b.npc.abilityScores.con <= 28) b.raise('con', 2)
        feature(b, 'revival-unit', { recharge: 'long' })
        break
    }
  },

  salarian(b) {
    feature(b, 'amphibious')
    for (let i = 0; i < 2; i++) {
      const skill = b.pick(b.data.skills.filter(s => !b.npc.skills!.includes(s.id)))
      if (skill) b.addSkill(skill.id)
    }
  },

  turian(b) {
    feature(b, 'esprit-de-corps')
    b.addSkill('athletics')
    b.addResistances('radiant')
  },

  volus(b) {
    feature(b, 'fury-of-the-small', { recharge: 'long' }, { extraDamage: b.metaLevel })
    feature(b, 'lucky', { uses: 3, perDay: true })
    feature(b, 'hermetic-suit')
    b.addResistances('necrotic', 'poison')
    b.addSkill('persuasion')
  },

  'unshackled-ai'(b) {
    // Synthetic Construct: immune to psychic and poison damage and to being poisoned, as the geth.
    syntheticImmunities(b)
  },

  vorcha(b) {
    feature(b, 'non-differentiated-cells')
    b.addResistances('poison')
    const bite = text(b, 'bite')
    if (bite) b.action({ id: bite.id, name: bite.name, attack: 'melee', proficient: true, range: 5, mod: 'str', damage: [{ dieCount: 1, dieType: 6, mod: true, type: 'piercing' }], target: 'one' })
    switch (b.pick(['aquatic', 'desert', 'frozen', 'high-gravity', 'underground', 'volcanic', 'zero-gravity'])) {
      case 'aquatic':
        feature(b, 'amphibious')
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
        feature(b, 'zero-g-aptitude')
        break
    }
  },

  yahg(b) {
    b.npc.senses = { ...b.npc.senses, darkvision: 60 }
    b.addSkill('insight')
    feature(b, 'hulking-build')
    feature(b, 'tackler')
  },
}

/** Applies a species' traits: the generator's own, then any the species file adds (as written). */
export function applySpeciesTraits(b: NpcBuilder, known: Record<string, Record<string, string[]>>) {
  speciesTraits[b.speciesId]?.(b)
  const own = known[b.speciesId] ?? {}
  for (const t of b.data.traits.get(b.speciesId) ?? [] as NpcTrait[]) {
    if (t.id in own) continue
    const entry = text(b, t.id)
    if (!entry) continue
    if (t.kind === 'action') b.action(entry)
    else b.feature(entry)
  }
}
