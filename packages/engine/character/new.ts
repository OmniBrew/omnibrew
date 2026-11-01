import { ABILITY_KEYS, CHARACTER_VERSION, type Character, type CharacterExtension } from './schema'

const abilities = () => Object.fromEntries(ABILITY_KEYS.map(a => [a, null])) as Character['abilityScores']['base']

/** The live builder's characteristics, in its order (the Details step's fields). */
export const CHARACTERISTICS = ['alignment', 'personality_traits', 'ideal', 'bond', 'flaw', 'gender', 'place_of_birth', 'age', 'height', 'weight', 'hair', 'eyes', 'skin', 'appearance', 'backstory'] as const

/** A new, empty character of a game (the live `characterTemplate`). */
export function newCharacter(game: { id: string, character?: CharacterExtension }, name = ''): Character {
  const parts = game.character?.defaults?.() ?? { state: {}, options: {}, overrides: {} }
  return {
    version: CHARACTER_VERSION,
    game: game.id,
    name,
    experience: { points: 0, milestone: 1, useMilestone: false },
    species: null,
    background: null,
    classes: [],
    abilityScores: { method: 'standard', base: abilities(), bonus: abilities(), override: abilities() },
    choices: [],
    powers: [],
    equipment: [],
    companions: [],
    customFeatures: [],
    details: { characteristics: {}, notes: '' },
    state: {
      hitPointsLost: 0,
      tempHp: { max: 0, value: 0 },
      hitDiceUsed: {},
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
      conditions: [],
      exhaustion: 0,
      credits: 0,
      pointsUsed: {},
      slotsUsed: {},
      resources: {},
      toggles: {},
      game: parts.state,
    },
    overrides: {
      hp: null,
      ac: null,
      acBonus: 0,
      speeds: {},
      senses: {},
      attack: { all: 0, melee: 0, ranged: 0, power: 0 },
      damage: { all: 0, melee: 0, ranged: 0, power: 0 },
      defenses: { resistance: [], immunity: [], vulnerability: [], conditionImmunity: [] },
      profs: { skill: [], expertise: [], savingThrow: [], armor: [], weapon: [], tool: [] },
      powercasting: {},
      game: parts.overrides,
    },
    options: { tashas: false, armorSpeedPenalty: true, armorProficiencyPenalty: true, abilityScoreOnTop: false, game: parts.options },
    meta: {},
  }
}
