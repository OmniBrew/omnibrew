import type { Mech, MechanicHandler } from './types'

/**
 * Handlers of the core mechanics (`schemas/mechanics/core.ts` and the power
 * system's). A game adds handlers for its own types (`me:*`) in its rules.
 * `describe` names the sheet section that reads the type.
 */
const h = (type: string, describe: string, extra: Partial<MechanicHandler> = {}): MechanicHandler => ({ type, describe, ...extra })

/** The key a choice's picks are stored under: the type without namespace and `-choice`, or a model-choice's model. */
export const defaultChoiceKey = (m: Mech) => (m.type === 'model-choice' ? String(m.model) : m.type.replace(/^[\w-]+:/, '').replace(/-choice$/, ''))
const choice = (type: string, describe: string) => h(type, describe, { choiceKey: defaultChoiceKey })

export const coreHandlers: MechanicHandler[] = [
  h('action', 'actions: a card in Actions'),
  h('bonus-action', 'actions: a card in Bonus Actions'),
  h('reaction', 'actions: a card in Reactions'),
  h('other', 'actions: a card in Other'),
  h('attack', 'actions: a card in Attacks'),
  h('global-note', 'notes: a note on the sheet (defenses, actions, powers)'),

  h('asi', 'abilities: adds to a score'),
  choice('asi-choice', 'choice: picks become `asi`'),
  h('asi-maximum', 'not computed: no score cap on the live sheet either (rules text)'),
  h('asi-minimum', 'abilities: a score is at least this'),

  h('ac', 'ac: adds a bonus, optionally only with listed armor types or under a condition'),
  h('natural-armor', 'ac: base + ability, used when better than armor'),
  h('hp', 'hp: adds to maximum hit points'),
  h('resistance', 'defenses: resistances'),
  h('vulnerability', 'defenses: vulnerabilities'),
  h('immunity', 'defenses: immunities'),
  h('condition-immunity', 'defenses: condition immunities'),
  h('saving-throw', 'saves: proficiency, bonus, or advantage notes'),
  h('fall-damage', 'defenses: "Falling Damage" resistance (when `resistance`)'),
  h('critical-immunity', 'defenses: listed as a special defense'),
  h('evasion', 'defenses: listed as a special defense'),
  h('regain-all-hit-dice', 'rest: a long rest restores every hit die (rest menu, Phase 3c)'),
  h('min-hit-die-roll', 'rest: minimum hit die roll (rest menu, Phase 3c)'),
  h('nullify-armor-str-restriction', 'speeds: armor strength penalty ignored', { flags: ['ignore-armor-strength'] }),

  h('speed', 'speeds: highest of each kind'),
  h('speed-bonus', 'speeds: adds to listed speeds'),
  h('speed-note', 'notes: movement rule shown with speeds'),
  h('sense', 'senses: highest distance of each sense'),
  h('initiative', 'initiative: bonus, advantage or disadvantage'),

  h('skill', 'profs: skill proficiency (or expertise)'),
  choice('skill-choice', 'choice: picks become `skill`'),
  h('skill-or-expertise', 'skills: proficiency, or expertise if already proficient'),
  choice('expertise-choice', 'choice: picks become `skill` with expertise'),
  choice('prof-choice', 'choice: never offered by the live builder; kept for content'),
  h('half-proficiency', 'skills: half proficiency on unproficient skills'),
  h('skill-check', 'skills: bonus or advantage notes on checks'),
  h('passive', 'skills: adds to a passive score'),
  h('tool', 'profs: tool proficiency'),
  choice('tool-choice', 'choice: picks become `tool`'),
  h('armor', 'profs: armor proficiency'),
  h('weapon', 'profs: weapon proficiency'),
  choice('weapon-choice', 'choice: picks become `weapon`'),

  h('extra-attack', 'actions: attacks per Attack action (highest)'),
  h('extra-attack-add', 'actions: one more attack per Attack action'),
  h('dual-wielder', 'not computed: Dual Wielder is rules text on the live sheet too'),
  h('attack-augment', 'attacks: hit, damage, DC, range, crit or reroll bonus on matching attacks'),
  h('adjust-weapon-props', 'attacks: adds or removes weapon properties'),
  h('override-weapon-attack-mod', 'attacks: another ability for weapon attacks, when better'),
  h('natural-weapon', 'attacks: a natural weapon, or a better unarmed strike'),
  h('companion', 'companions: grants a companion (the companion is a free-form stat block)'),

  h('resource', 'toggles: sets or adds to a resource when a toggle turns on (sheet action, Phase 3c)'),
  h('augment', 'collection: merged into other mechanics'),
  choice('model-choice', 'choice: picks are records whose mechanics apply'),

  h('powers', 'powers: grants a power'),
  h('power-attack', 'powers: castable in place of an attack (the power, or powers of the listed types and levels)'),
  h('power-at-will', 'powers: castable at will at the listed levels (a model-choice `append` type)'),
  h('power-resource', 'powers: castable from its own resource at the listed levels (a model-choice `append` type)'),
  h('cantrips', 'powers: cantrips known per level'),
  h('additional-cantrips', 'powers: more cantrips known'),
  h('use-class-for-power-list', 'powers: another class list to learn from (power picker, Phase 3c)'),
  h('use-class-for-cantrip-list', 'powers: another class cantrip list (power picker, Phase 3c)'),
  h('power-resource-recovery', 'rest: recover slots or points (rest menu, Phase 3c)'),
  choice('powercasting-slots', 'powers: slot casting; as a choice, picks the casting ability'),
  choice('powercasting-points', 'powers: point casting; as a choice, picks the casting ability'),
  choice('powercasting-pact', 'powers: pact casting; as a choice, picks the casting ability'),
]

export class HandlerRegistry {
  private readonly byType = new Map<string, MechanicHandler>()

  constructor(handlers: MechanicHandler[]) {
    for (const handler of [...coreHandlers, ...handlers]) {
      if (this.byType.has(handler.type)) throw new Error(`mechanic handler "${handler.type}" registered twice`)
      this.byType.set(handler.type, handler)
    }
  }

  get(type: string) {
    return this.byType.get(type)
  }

  types() {
    return [...this.byType.keys()]
  }

  flags(type: string): string[] {
    return this.byType.get(type)?.flags ?? []
  }

  choiceKey(m: Mech): string {
    return (this.byType.get(m.type)?.choiceKey ?? defaultChoiceKey)(m)
  }
}
