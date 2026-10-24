/**
 * Enum registry: the closed value lists a content schema can check.
 *
 * The engine ships core 5e values. Each game merges its own values on top
 * (`extend`) or replaces a list outright (`replace`). Schemas never hard-code
 * game values; they ask the registry by name.
 */

export const CORE_ENUMS = {
  abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
  damageTypes: ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'],
  /** Non-damage "damage" rolls: healing and temporary hit points. */
  healingTypes: ['hp', 'temp'],
  sizes: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
  senses: ['darkvision', 'blindsight', 'tremorsense', 'truesight'],
  speeds: ['walk', 'fly', 'swim', 'climb', 'burrow'],
  aoeShapes: ['sphere', 'cone', 'line', 'cube', 'cylinder'],
  timeUnits: ['action', 'bonus_action', 'reaction', 'minute', 'hour', 'day', 'round', 'turn', 'instant'],
  resets: ['short', 'long'],
  resourceDisplays: ['counter', 'checkbox', 'hit-dice'],
  armorTypes: ['light', 'medium', 'heavy'],
  advantageEffects: ['advantage', 'disadvantage', 'bonus', 'die-bonus'],
  rarities: ['common', 'uncommon', 'rare', 'very_rare', 'legendary'],
  powerTypes: [] as string[],
  powerTags: [] as string[],
  weaponTypes: [] as string[],
  creatureTypes: [] as string[],
  alignments: ['lg', 'ng', 'cg', 'ln', 'nn', 'cn', 'le', 'ne', 'ce', 'u'],
  /** Collections a `moreInfo`/`provider`/`model-choice` reference may point at. Filled from the game's content layout. */
  models: [] as string[],
  /** Sub-groups of the edges collection (ME "edge families"; SW lightsaber forms, fighting masteries...). */
  edgeTypes: [] as string[],
  armorSlots: [] as string[],
  gearTypes: [] as string[],
  itemTags: [] as string[],
  toolTypes: [] as string[],
  vehicleSizes: ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'],
  /** Formula (value expression) kinds. Games add namespaced kinds. */
  formulaKinds: ['flat', 'mod', 'level', 'proficiency', 'powercastingMod', 'modComparison', 'progressive', 'multi', 'resource', 'hp', 'speed'],
} satisfies Record<string, string[]>

export type EnumName = keyof typeof CORE_ENUMS

export interface EnumRegistry {
  values: Record<string, string[]>
  /** Renamed values (an error naming the new value): enum → { old: current }. */
  aliases: Record<string, Record<string, string>>
}

export interface EnumOverrides {
  /** Values appended to the core list. */
  extend?: Partial<Record<string, string[]>>
  /** Lists that replace the core list entirely. */
  replace?: Partial<Record<string, string[]>>
  aliases?: Record<string, Record<string, string>>
}

export function buildEnums(overrides: EnumOverrides = {}): EnumRegistry {
  const values: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(CORE_ENUMS)) values[k] = [...v]
  for (const [k, v] of Object.entries(overrides.replace ?? {})) values[k] = [...(v ?? [])]
  for (const [k, v] of Object.entries(overrides.extend ?? {})) {
    values[k] = [...new Set([...(values[k] ?? []), ...(v ?? [])])]
  }
  for (const [k, map] of Object.entries(overrides.aliases ?? {})) {
    for (const canonical of Object.values(map)) {
      if (!values[k]?.includes(canonical)) throw new Error(`alias target "${canonical}" is not a value of enum "${k}"`)
    }
  }
  return { values, aliases: overrides.aliases ?? {} }
}
