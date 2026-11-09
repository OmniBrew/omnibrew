/**
 * Homebrew forms as data (plan/26 §1.3): which record kinds players write, the fields
 * each kind's form shows, and the effects (mechanics) "Add effect" offers, each a small
 * form in plain words. Players never see YAML. The engine renders any of these; a game
 * lists its kinds and effects in `GameDefinition.homebrew` (the core templates below plus
 * its own), so the engine names none of a game's fields or mechanics.
 *
 * Labels are i18n keys. Paths are dot paths into the record or mechanic (`casting.0.range.short`).
 */

export type FieldInput =
  | { kind: 'text', long?: boolean, placeholder?: string }
  /** Prose in markdown with the game's MDC components (the record's body, advancement texts). */
  | { kind: 'markdown' }
  | { kind: 'number', min?: number, max?: number, step?: number }
  | { kind: 'boolean' }
  /** One or more values of an enum in the game's registry (`damageTypes`). */
  | { kind: 'enum', enum: string, multiple?: boolean, labels?: string }
  /** Fixed options (`melee`, `ranged`); `labels` is the i18n prefix of their names. */
  | { kind: 'choice', options: Array<string | number>, multiple?: boolean, labels?: string }
  /** Ids of records of a collection (classes, conditions, weapon properties). */
  | { kind: 'record', collection: string, multiple?: boolean }
  /** A value formula: a number, the proficiency bonus, an ability modifier or the level. */
  | { kind: 'formula' }
  /** Damage rolls: dice, type and a flat bonus. */
  | { kind: 'damage-list', max?: number }
  /** Item properties with their values (`{ id, value }`). */
  | { kind: 'properties', collection: string }
  /** Uses of a card: how many and when they come back. */
  | { kind: 'resource' }
  /** An attack roll: none, melee or ranged. */
  | { kind: 'attack' }
  /** A saving throw: none, or the ability saved with. */
  | { kind: 'save' }
  /** The record's effects (`mechanics`), from the game's effect templates. */
  | { kind: 'effects' }
  /** A power's upcast entries (the damage of each higher level). */
  | { kind: 'upcasts' }
  /** A power's advancements (name and text). */
  | { kind: 'advancements' }

export interface FieldDef {
  path: string
  /** i18n key of the label; `help` an optional key of a help line. */
  label: string
  help?: string
  input: FieldInput
  required?: boolean
  /** Shown only when another field has one of these values. */
  when?: { path: string, is: unknown[] }
}

export interface FieldGroup {
  /** i18n key of the tab or section title. */
  title: string
  fields: FieldDef[]
}

export interface HomebrewKindDef {
  /** The collection the records join (`weapons`). */
  collection: string
  icon: string
  /** A new record's fields. */
  defaults: () => Record<string, unknown>
  /** The form, tab by tab. */
  groups: FieldGroup[]
}

export interface EffectTemplate {
  /** The mechanic type it writes. */
  type: string
  /** i18n key of its name in "Add effect" and of a one-line help. */
  label: string
  help?: string
  /** A section of the "Add effect" list (`defenses`, `attacks`...), an i18n key. */
  group: string
  fields: FieldDef[]
  /** Values a new effect starts with. */
  defaults?: () => Record<string, unknown>
}

export interface HomebrewDefinition {
  kinds: HomebrewKindDef[]
  /** The effects "Add effect" offers, in order. */
  effects: EffectTemplate[]
}

const f = (path: string, label: string, input: FieldInput, extra: Partial<FieldDef> = {}): FieldDef => ({ path, label, input, ...extra })
/** A mechanic type as an i18n key segment (`me:shields` → `me_shields`). */
export const effectKey = (type: string) => type.replaceAll(':', '_')
const L = (type: string, field: string) => `homebrew.effects.${effectKey(type)}.${field}`
const effect = (type: string, group: string, fields: FieldDef[], defaults?: () => Record<string, unknown>): EffectTemplate =>
  ({ type, label: `homebrew.effects.${effectKey(type)}.title`, help: `homebrew.effects.${effectKey(type)}.help`, group, fields, ...(defaults ? { defaults } : {}) })

const flat = (value: number) => ({ type: 'flat', value })
const card = (type: string) => effect(type, 'homebrew.effect_groups.cards', [
  f('name', 'homebrew.fields.name', { kind: 'text' }, { required: true }),
  f('shortDesc', 'homebrew.fields.short_desc', { kind: 'text', long: true }),
  f('resource', 'homebrew.fields.uses', { kind: 'resource' }),
  f('attack', 'homebrew.fields.attack', { kind: 'attack' }),
  f('dc', 'homebrew.fields.save', { kind: 'save' }),
  f('range.short', 'homebrew.fields.range', { kind: 'number', min: 0, step: 5 }),
  f('damage', 'homebrew.fields.damage', { kind: 'damage-list', max: 3 }),
], () => ({ name: '' }))

/** Effects every 5e game offers. Labels: `homebrew.effects.<type>.*`. */
export const CORE_EFFECTS: EffectTemplate[] = [
  effect('asi', 'homebrew.effect_groups.abilities', [f('ability', L('asi', 'ability'), { kind: 'enum', enum: 'abilities', labels: 'abilities.{v}.title' }, { required: true }), f('amount', L('asi', 'amount'), { kind: 'number', min: -5, max: 5 }, { required: true })], () => ({ ability: 'str', amount: 1 })),
  effect('ac', 'homebrew.effect_groups.defenses', [f('bonus', L('ac', 'bonus'), { kind: 'formula' }, { required: true }), f('limit', L('ac', 'limit'), { kind: 'enum', enum: 'armorTypes', multiple: true, labels: 'armor_types.{v}' })], () => ({ bonus: flat(1) })),
  effect('hp', 'homebrew.effect_groups.defenses', [f('bonus', L('hp', 'bonus'), { kind: 'formula' }, { required: true })], () => ({ bonus: { type: 'level' } })),
  effect('resistance', 'homebrew.effect_groups.defenses', [f('value', L('resistance', 'value'), { kind: 'enum', enum: 'damageTypes', labels: 'damage_types.{v}' }, { required: true })], () => ({ value: 'fire' })),
  effect('immunity', 'homebrew.effect_groups.defenses', [f('value', L('immunity', 'value'), { kind: 'enum', enum: 'damageTypes', labels: 'damage_types.{v}' }, { required: true })], () => ({ value: 'poison' })),
  effect('vulnerability', 'homebrew.effect_groups.defenses', [f('value', L('vulnerability', 'value'), { kind: 'enum', enum: 'damageTypes', labels: 'damage_types.{v}' }, { required: true })], () => ({ value: 'fire' })),
  effect('condition-immunity', 'homebrew.effect_groups.defenses', [f('value', L('condition-immunity', 'value'), { kind: 'record', collection: 'conditions' }, { required: true })]),
  effect('saving-throw', 'homebrew.effect_groups.proficiencies', [
    f('value', L('saving-throw', 'value'), { kind: 'enum', enum: 'abilities', multiple: true, labels: 'abilities.{v}.title' }, { required: true }),
    f('effect.type', L('saving-throw', 'effect'), { kind: 'enum', enum: 'advantageEffects', labels: 'homebrew.advantage.{v}' }, { help: L('saving-throw', 'effect_help') }),
    f('effect.bonus', L('saving-throw', 'bonus'), { kind: 'formula' }, { when: { path: 'effect.type', is: ['bonus'] } }),
  ], () => ({ value: ['dex'] })),
  effect('skill', 'homebrew.effect_groups.proficiencies', [f('value', L('skill', 'value'), { kind: 'record', collection: 'skills' }, { required: true }), f('expertise', L('skill', 'expertise'), { kind: 'boolean' })]),
  effect('skill-check', 'homebrew.effect_groups.proficiencies', [
    f('value', L('skill-check', 'value'), { kind: 'record', collection: 'skills', multiple: true }, { required: true }),
    f('effect.type', L('skill-check', 'effect'), { kind: 'enum', enum: 'advantageEffects', labels: 'homebrew.advantage.{v}' }, { required: true }),
    f('effect.bonus', L('skill-check', 'bonus'), { kind: 'formula' }, { when: { path: 'effect.type', is: ['bonus'] } }),
  ], () => ({ value: [], effect: { type: 'advantage' } })),
  effect('initiative', 'homebrew.effect_groups.proficiencies', [f('bonus', L('initiative', 'bonus'), { kind: 'formula' }, { required: true })], () => ({ bonus: flat(2) })),
  effect('speed', 'homebrew.effect_groups.movement', [f('speed', L('speed', 'speed'), { kind: 'enum', enum: 'speeds', labels: 'speeds.{v}.title' }, { required: true }), f('distance', L('speed', 'distance'), { kind: 'number', min: 0, step: 5 }, { required: true })], () => ({ speed: 'fly', distance: 30 })),
  effect('speed-bonus', 'homebrew.effect_groups.movement', [f('value', L('speed-bonus', 'value'), { kind: 'enum', enum: 'speeds', multiple: true, labels: 'speeds.{v}.title' }, { required: true }), f('bonus', L('speed-bonus', 'bonus'), { kind: 'formula' }, { required: true })], () => ({ value: ['walk'], bonus: flat(5) })),
  effect('sense', 'homebrew.effect_groups.movement', [f('sense', L('sense', 'sense'), { kind: 'enum', enum: 'senses', labels: 'senses.{v}_title' }, { required: true }), f('distance', L('sense', 'distance'), { kind: 'number', min: 0, step: 5 }, { required: true })], () => ({ sense: 'darkvision', distance: 60 })),
  effect('critical-immunity', 'homebrew.effect_groups.defenses', []),
  effect('evasion', 'homebrew.effect_groups.defenses', []),
  effect('attack-augment', 'homebrew.effect_groups.attacks', [
    f('attackLimit.model', L('attack-augment', 'model'), { kind: 'choice', options: ['weapon', 'power'], labels: 'homebrew.attack_model.{v}' }),
    f('attackLimit.type', L('attack-augment', 'type'), { kind: 'choice', options: ['melee', 'ranged'], labels: 'homebrew.attack_type.{v}' }),
    f('augmentTypes', L('attack-augment', 'augment_types'), { kind: 'choice', options: ['hit', 'damage', 'dc'], multiple: true, labels: 'homebrew.augment.{v}' }, { required: true }),
    f('bonus', L('attack-augment', 'bonus'), { kind: 'formula' }),
    f('addDamage', L('attack-augment', 'add_damage'), { kind: 'damage-list', max: 2 }),
    f('ask', L('attack-augment', 'ask'), { kind: 'text' }, { help: L('attack-augment', 'ask_help') }),
  ], () => ({ augmentTypes: ['hit'], bonus: flat(1) })),
  effect('adjust-weapon-props', 'homebrew.effect_groups.attacks', [f('add', L('adjust-weapon-props', 'add'), { kind: 'record', collection: 'weapon-properties', multiple: true }), f('remove', L('adjust-weapon-props', 'remove'), { kind: 'record', collection: 'weapon-properties', multiple: true })], () => ({ add: [] })),
  card('action'),
  card('bonus-action'),
  card('reaction'),
  card('other'),
]

/** A core effect template by type, for a game's list. */
export const coreEffect = (type: string) => {
  const t = CORE_EFFECTS.find(e => e.type === type)
  if (!t) throw new Error(`no core effect "${type}"`)
  return t
}

export const homebrewField = f
export const homebrewEffect = effect
