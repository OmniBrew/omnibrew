import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFrontMatter, stringifyRecord, toCrlf } from '@omnibrew/engine/content'

/**
 * Backlog conversions (plan/09, plan/04 R8): `global-note` mechanics whose
 * written rule maps exactly onto engine mechanics. Re-runnable: a record
 * already converted is left alone. The notes this does not convert are listed
 * by kind in plan/18.
 *
 *   corepack pnpm tsx apps/me5e/migrate/backlog-global-notes.ts ../omnibrew-me5e-data
 */
type Rec = Record<string, unknown>
type Edit = (mechanics: Rec[], record: Rec) => Rec[]

const isNote = (value?: string) => (m: Rec) => m.type === 'global-note' && (value === undefined || m.value === value)

/** Replaces the note (matched by its value) with the given mechanics, in place. */
const replaceNote = (value: string | undefined, ...next: Rec[]): Edit => (mechanics) => {
  const i = mechanics.findIndex(isNote(value))
  if (i < 0) return mechanics
  return [...mechanics.slice(0, i), ...next, ...mechanics.slice(i + 1)]
}

/** A lasting situational bonus (this round, while hovering) as a sheet toggle, the live site's convention for modes. */
const toggle = (id: string, shortDesc: string, whenOn: Rec[]): Rec => ({ type: 'other', shortDesc, toggle: { id, whenOn } })

/**
 * A bonus that depends on the target or the moment of one attack: asked when the
 * attack is rolled (`ask`), not toggled (plan/04 Q19). Replaces the note, or the
 * toggle card an earlier run of this script wrote.
 */
const ask = (note: string, toggleId: string, ...augments: Rec[]): Edit => (mechanics) => {
  const i = mechanics.findIndex(m => isNote(note)(m) || (m.toggle as Rec | undefined)?.id === toggleId || m.ask === augments[0]?.ask)
  if (i < 0) return mechanics
  return [...mechanics.slice(0, i), ...augments, ...mechanics.slice(i + 1)]
}

const SNEAK_DICE = { 1: 1, 3: 2, 5: 3, 7: 4, 9: 5, 11: 6, 13: 7, 15: 8, 17: 9, 19: 10 }

export const CONVERSIONS: Record<string, Edit> = {
  // Null Critical / Critical Immunity: "any critical hit against you becomes a normal hit".
  'armor/kett-chestplate': replaceNote('Null Critical', { type: 'critical-immunity' }),
  'armor/predator-armor': replaceNote('Null Critical', { type: 'critical-immunity' }),
  'armor/securitel-helmet': replaceNote('Null Critical', { type: 'critical-immunity' }),
  'mods/reactive-kinetic-compensator': replaceNote('Null Critical', { type: 'critical-immunity' }),
  'edges/AA_plating': replaceNote('Critical Immunity', { type: 'critical-immunity' }),
  'class-features/evasion': replaceNote('Evasion', { type: 'evasion' }),

  // Powers cast in place of an attack.
  'class-features/enlightened-fist': replaceNote('Biotic Punch', { type: 'power-attack', value: 'biotic-punch' }),
  'class-features/extra-attack-commando': replaceNote('Cantrip Attack', { type: 'power-attack', powerTypes: ['biotic'], levels: [0] }),
  'class-features/extra-attack-sentinel': replaceNote('Cantrip Attack', { type: 'power-attack', powerTypes: ['biotic'], levels: [0] }),
  'class-features/biotic-harmony': replaceNote('1st-level Power Attack', { type: 'power-attack', powerTypes: ['biotic'], levels: [1] }),

  // Brutal Critical: extra crit dice with melee attacks (1, then 2 at 13th, 3 at 17th).
  'class-features/brutal-critical-1': replaceNote('Brutal Critical', { type: 'attack-augment', attackLimit: { type: 'melee' }, augmentTypes: ['damage'], addCritDie: 1 }),
  'class-features/brutal-critical-2': () => [{ type: 'augment', value: { model: 'vanguard', id: 'brutal-critical-1', limit: ['attack-augment'] }, merge: { addCritDie: 2 } }],
  'class-features/brutal-critical-3': () => [{ type: 'augment', value: { model: 'vanguard', id: 'brutal-critical-1', limit: ['attack-augment'] }, merge: { addCritDie: 3 } }],

  // Fixed extra damage.
  'armor/batarian-talon-gauntlets': replaceNote('+1 slashing dmg', { type: 'attack-augment', attackLimit: { type: 'melee' }, augmentTypes: ['damage'], addDamage: [{ type: 'slashing', bonus: { type: 'flat', value: 1 } }] }),

  // Situational bonuses as toggles.
  'edges/FS_sniper': ask('Sniper', 'FS_sniper',
    { type: 'attack-augment', ask: 'No hostile creature within :distance{length="30"}?', attackLimit: { model: 'weapon', modelTypes: ['sniper_rifle'] }, augmentTypes: ['damage'], bonus: { type: 'flat', value: 2 } },
  ),
  'edges/FS_the-free-hand': replaceNote('Free Hand', toggle('FS_the-free-hand', 'Holding no more than one light, non-two-handed weapon: +2 to hit with ranged power attacks.', [
    { type: 'attack-augment', attackLimit: { model: 'power', type: 'ranged' }, augmentTypes: ['hit'], bonus: { type: 'flat', value: 2 } },
  ])),
  'mods/aerial-performance-optimizer': replaceNote(undefined, toggle('aerial-performance-optimizer', 'Hovering (jump jets) or flying (jetpack): +2 to all attack and damage rolls.', [
    { type: 'attack-augment', augmentTypes: ['hit', 'damage'], bonus: { type: 'flat', value: 2 } },
  ])),
  'class-features/blood-trail': ask('Blood Trail', 'blood-trail',
    { type: 'attack-augment', ask: 'Did the target take damage since the end of your last turn?', attackLimit: { model: 'weapon', type: 'ranged' }, augmentTypes: ['hit'], bonus: { type: 'flat', value: 2 }, addDamage: [{ dieCount: 1, dieType: 8 }] },
  ),
  'class-features/lock-on': replaceNote('Lock On', toggle('lock-on', 'Using Hold Your Ground or attacking with an SMG: +1 to hit and +1d4 damage on all your attacks this round.', [
    { type: 'attack-augment', augmentTypes: ['hit'], bonus: { type: 'flat', value: 1 } },
    { type: 'attack-augment', augmentTypes: ['damage'], addDamage: [{ dieCount: 1, dieType: 4 }] },
  ])),
  'class-features/soft-spots': ask('Soft Spots', 'soft-spots',
    { type: 'attack-augment', ask: 'Is the target marked by your Tactical Sweep?', augmentTypes: ['damage'], bonus: { type: 'mod', value: 'int', min: 1 } },
  ),

  // Once-per-turn extra dice as a card with the dice for the character's level.
  'class-features/power-from-pain': replaceNote('Power from Pain', { type: 'other', damage: [{ dieCount: { type: 'progressive', limit: 'soldier', value: { 3: 1, 7: 2, 10: 3, 15: 4, 18: 5 } }, dieType: 6 }] }),
  'class-features/sneak-attack': (mechanics) => {
    const note = mechanics.find(isNote('Sneak Attack'))
    if (!note) return mechanics
    return replaceNote('Sneak Attack', {
      type: 'other',
      damage: [{ dieCount: { type: 'progressive', limit: 'infiltrator', value: SNEAK_DICE }, dieType: 6 }],
      progressionColumn: note.progressionColumn,
    })(mechanics, {})
  },
  'class-features/up-close-and-personal': () => [{ type: 'augment', value: { model: 'infiltrator', id: 'sneak-attack', limit: ['other'] }, merge: { notes: ['d8 dice with a melee weapon'] } }],
  'class-features/killshot': () => [{ type: 'augment', value: { model: 'infiltrator', id: 'sneak-attack', limit: ['other'] }, merge: { notes: ['+3d6 with a sniper rifle'] } }],
}

/** The Exploit die: d4 at 2nd Experiment level up to d12 at 17th (Exploits; plan/04 B148). */
const EXPLOIT_DIE = { type: 'progressive', limit: 'experiment', value: { 1: 4, 5: 6, 9: 8, 13: 10, 17: 12 } }

/** Removes a mechanic matching `test` and puts `next` in its place (none: just removes it). Re-runnable: no match, no change. */
const replaceWhere = (test: (m: Rec) => boolean, ...next: Rec[]): Edit => (mechanics) => {
  const i = mechanics.findIndex(test)
  if (i < 0) return mechanics
  return [...mechanics.slice(0, i), ...next, ...mechanics.slice(i + 1)]
}
/** A card with its own name (when the record already has a card named after it). */
const named = (name: string, card: Rec): Rec => ({ name, ...card })
const all = (...edits: Edit[]): Edit => (mechanics, record) => edits.reduce((m, e) => e(m, record), mechanics)

/**
 * Phase 4 (plan/31 §1.2, piece 4): notes an existing mechanic type covers. A card
 * without dice or uses still beats a note: it sits in its action type on the
 * Actions tab, where the player looks at the table. Re-runnable.
 */
export const PHASE4_CONVERSIONS: Record<string, Edit> = {
  // Notes that repeat a card in the same record.
  'class-features/biotic-split': replaceNote('Biotic Split'),
  'class-features/overwatch': replaceNote('Overwatch'),
  'class-features/remote-detonation': all(
    replaceNote('Remote Detonation'),
    mechanics => mechanics.map(m => (m.type === 'bonus-action' && !m.notes ? { ...m, notes: ['No heat cost; your weapon\'s heat must be above 0'] } : m)),
  ),

  // Immunities and save effects as structured defenses.
  'class-features/blast-zone': replaceNote('Blast Zone',
    { type: 'immunity', id: 'detonations', label: 'Detonations you trigger' },
    { type: 'reaction', name: 'Blast Zone', shortDesc: 'Add your Wisdom modifier to a detonation you triggered with a power you Furycast.' },
  ),
  'class-features/riot-strike': replaceNote('Riot Strike', { type: 'immunity', id: 'detonations', label: 'Detonations from your Havoc Strike' }),
  'class-features/divine-health': replaceNote('Divine Health', { type: 'saving-throw', effect: { type: 'advantage', note: 'on death saving throws and against the effects of detonations' } }),
  'class-features/master-in-the-saddle': replaceNote('Mount/Dismount',
    { type: 'saving-throw', effect: { type: 'advantage', note: 'on saving throws to avoid falling off your mount' } },
    { type: 'speed-note', note: 'Mount or dismount with :distance{length="5"} of movement; after a fall of :distance{length="10"} or less from your mount, land on your feet unless incapacitated.' },
  ),
  'gear/trace-signal-jammer-exe': replaceNote('Signal Jammer', { type: 'saving-throw', effect: { type: 'advantage', note: 'on saving throws against heavy weapons that need Targeting' } }),

  // Lasting states as toggles (B58; plan/31 decision 3e).
  'class-features/acceleration': all(
    replaceNote('Acceleration', toggle('acceleration', 'Moved at least half your speed this turn: +1 AC.', [{ type: 'ac', bonus: { type: 'flat', value: 1 } }])),
    // "Your movement speed increases by half" (the text wins, plan/31 decision 2): half your walking speed, not a flat 15 ft.
    replaceWhere(m => m.type === 'speed-bonus' && (m.bonus as Rec | undefined)?.type === 'flat', { type: 'speed-bonus', value: ['walk'], bonus: { type: 'speed', value: 'walk', multiplier: 0.5 } }),
  ),
  'class-features/momentum': replaceNote('Momentum', toggle('momentum', 'Moved at least half your speed this turn: attack twice when you take the Attack action.', [{ type: 'extra-attack', value: 2 }])),
  'class-features/peak-performance': replaceNote('Peak Performance', toggle('peak-performance', 'Attacking with Intelligence: attack twice when you take the Attack action.', [{ type: 'extra-attack', value: 2 }])),
  'class-features/event-horizon': all(
    replaceNote('Event Horizon'),
    replaceWhere(m => m.type === 'saving-throw' && (m.effect as Rec | undefined)?.type === 'bonus', toggle('event-horizon', 'Wearing no armor: add your Charisma modifier to all your saving throws.', [
      { type: 'saving-throw', value: ['str', 'dex', 'con', 'int', 'wis', 'cha'], effect: { type: 'bonus', bonus: { type: 'mod', value: 'cha' } } },
    ])),
  ),
  'class-features/ride-on': all(
    replaceNote('Ride On (1d8)', {
      type: 'other',
      name: 'Ride On!',
      damage: [{ dieCount: { type: 'progressive', limit: 'tracker', value: { 3: 1, 7: 2, 14: 3 } }, dieType: 8 }],
      shortDesc: 'While mounted: once per turn, a hit by you or by your beast deals {{ roll }} extra damage.',
    }),
    replaceWhere(m => m.type === 'initiative', named('Ride On! (mounted)', toggle('ride-on-mounted', 'Mounted: add your Charisma modifier to initiative.', [
      { type: 'initiative', effect: { type: 'bonus', bonus: { type: 'mod', value: 'cha' } } },
    ]))),
  ),
  'class-features/strike-first': replaceNote('Strike First', toggle('strike-first', 'Your first turn of combat (and any surprise round): your power attack rolls have advantage.', [
    { type: 'attack-augment', attackLimit: { model: 'power' }, augmentTypes: ['notes'], notes: ['Advantage (first turn)'] },
  ])),

  // Bonuses that always apply to matching attacks.
  'class-features/dark-biotics': replaceNote('Dark Biotics', { type: 'attack-augment', attackLimit: { model: 'power', modelTypes: ['biotic'] }, augmentTypes: ['dc'], bonus: { type: 'proficiency' } }),
  'class-features/ballista': replaceNote('Ballista', { type: 'augment', value: { model: 'engineer', id: 'omni-bow', limit: ['powers'] }, merge: { merge: { damage: [{}, { bonus: { type: 'proficiency' }, label: 'Engineer\'s Efficiency element' }] } } }),
  'edges/FS_close-quarters-shooter': replaceNote('Close-Quarters Shooter', { type: 'attack-augment', attackLimit: { type: 'ranged' }, augmentTypes: ['notes'], notes: ['No disadvantage within :distance{length="5"} of a hostile creature; ignore half cover within :distance{length="30"}'] }),
  'class-features/biotic-furor': replaceNote('Biotic Furor', { type: 'power-attack', powerTypes: ['biotic'], levels: [0] }),

  // A condition of one attack, asked when it's rolled (B62).
  'class-features/unlimited-power': replaceNote('Unlimited Power', { type: 'attack-augment', ask: 'Spend a barrier tick (target within :distance{length="5"})?', augmentTypes: ['damage'], addDamage: [{ dieCount: 2, dieType: 8, type: 'force' }] }),

  // Cards with their dice, DC or uses.
  'class-features/exploits': (mechanics) => {
    const note = mechanics.find(isNote('Exploits'))
    if (!note) return mechanics
    return replaceNote('Exploits', {
      type: 'other',
      name: 'Exploit Die',
      damage: [{ dieCount: 1, dieType: EXPLOIT_DIE, label: 'Exploit Die' }],
      dc: { base: 8, proficient: true, mod: 'con' },
      shortDesc: 'Your class features roll this die when they call for an Exploit Die; their saving throws use this DC.',
      progressionColumn: note.progressionColumn,
    })(mechanics, {})
  },
  'edges/PA_processor': replaceNote('Primal Processor', { type: 'other', name: 'Primal Processor', damage: [{ dieCount: 1, dieType: EXPLOIT_DIE, type: 'psychic' }], shortDesc: 'A creature that deals you psychic damage takes {{ roll }}.' }),
  'edges/SA_plating': replaceNote('Supercharge Plating', { type: 'other', name: 'Supercharged Plating', damage: [{ dieCount: 1, dieType: EXPLOIT_DIE, type: 'lightning', bonus: { type: 'level', value: 'experiment' } }], shortDesc: 'An enemy that hits you in melee takes {{ roll }}.' }),
  'edges/AA_processor': replaceNote('Apex Processor', { type: 'other', name: 'Apex Processor', damage: [{ type: 'hp', mod: 'con', bonus: { type: 'flat', value: 5 } }], shortDesc: 'At the start of each of your turns, while you have at least 1 hit point and are below half your maximum: regain {{ roll }}.' }),
  // Improved and Expert Commander grew the note's die (d10 at 10th, d12 at 14th); the card's die grows with Tracker levels.
  'class-features/improved-commander': replaceWhere(m => m.type === 'augment' && ((m.value as Rec).id === 'give-command')),
  'class-features/expert-commander': replaceWhere(m => m.type === 'augment' && ((m.value as Rec).id === 'give-command')),
  // Ride On! 2 and 3 renamed the note (2d8, 3d8); the card's dice already grow with Tracker levels.
  'class-features/ride-on-2': replaceWhere(m => m.type === 'augment' && ((m.value as Rec).id === 'ride-on')),
  'class-features/ride-on-3': replaceWhere(m => m.type === 'augment' && ((m.value as Rec).id === 'ride-on')),
  'class-features/give-command': replaceNote('Command Dice (1d8)', { type: 'other', name: 'Command Dice', damage: [{ dieCount: 1, dieType: { type: 'progressive', limit: 'tracker', value: { 3: 8, 10: 10, 14: 12 } }, label: 'Command Die' }], resource: { id: 'command-dice', reset: 'short', max: { type: 'flat', value: 4 } }, shortDesc: 'Spend one on a Command you know.' }),
  'class-features/death-strike': replaceNote('Death Strike', { type: 'other', name: 'Death Strike', dc: { base: 8, proficient: true, mod: 'dex', save: 'con' }, shortDesc: 'When you hit a surprised creature, it makes a {{ dc }} Constitution saving throw: on a failure, double the damage of your attack.' }),
  'class-features/shock-cavalry': replaceNote('Shock Cavalry', { type: 'other', name: 'Shock Cavalry', dc: { base: 8, proficient: true, mod: 'wis', save: 'wis' }, shortDesc: 'You or your beast hit a creature after moving at least :distance{length="20"}, from within :distance{length="15"} of it: it makes a {{ dc }} Wisdom saving throw or is :condition{id="frightened"} for 1 minute (it retries at the end of each of its turns).' }),
  'class-features/intangible': replaceNote('Intangible', { type: 'reaction', name: 'Intangible', damage: [{ dieCount: 1, dieType: 6, label: 'd6' }], shortDesc: 'When you are the target of an attack and moved at least half your speed on your last turn: roll a d6, and on 3 or lower the attack misses you (after the attack roll).' }),
  'class-features/death-blossom': replaceNote('Death Blossom', { type: 'bonus-action', name: 'Death Blossom', shortDesc: 'When you take the Attack action: one extra attack with your off-hand weapon per attack you make.' }),
  'class-features/five-round-rapid': replaceNote('Five Round Rapid', { type: 'action', name: 'Five Round Rapid', shortDesc: 'Attack action with a heavy pistol: fire {{ profBonus }} shots at one or several targets (Sneak Attack once on each). The pistol then jams until you reload it with an action on your next turn.' }),
  'class-features/start-blastin': replaceNote('Start Blastin\'', { type: 'action', name: 'Start Blastin\'', shortDesc: 'Attack action: fire your heavy pistol twice at two different targets (Sneak Attack on each that qualifies).' }),
  'class-features/total-combat': replaceNote('Total Combat', { type: 'bonus-action', name: 'Total Combat', shortDesc: 'When you use Hold Your Ground or attack with an SMG: use a grenade.' }),
  'class-features/true-explorer': replaceNote('True Explorer', { type: 'reaction', name: 'True Explorer', shortDesc: 'When you detonate a primed target: prime it again with the same type.' }),
  // Kalahira's devotion is one of True Devotion's toggle options.
  'class-features/true-devotion': mechanics => mechanics.map((m) => {
    const options = (m.toggle as Rec | undefined)?.options as Rec[] | undefined
    if (!options) return m
    return {
      ...m,
      toggle: {
        ...(m.toggle as Rec),
        options: options.map(o => (o.id === 'devotee-true-devotion-kalahira'
          ? { ...o, whenOn: replaceNote('Kalahira Devotion', { type: 'other', name: 'Kalahira Devotion', damage: [{ dieCount: 1, dieType: 4, mod: 'wis', type: 'shields' }], shortDesc: 'An enemy within :distance{length="50"} dies: regain {{ roll }} points (temporary hit points until your next short rest if your shields are full).' })((o.whenOn ?? []) as Rec[], {}) }
          : o)),
      },
    }
  }),
}

/** Replaces the note inside the second option of the Tech Armor toggle an augment merges (Tech Cannon, Assault Mastery), keeping its index. */
const inTechCannonOption = (note: string, ...next: Rec[]): Edit => mechanics => mechanics.map((m) => {
  const toggle = (m.merge as Rec | undefined)?.toggle as Rec | undefined
  const options = toggle?.options as Rec[] | undefined
  if (!options?.[1]) return m
  const whenOn = (options[1].whenOn ?? []) as Rec[]
  const i = whenOn.findIndex(isNote(note))
  if (i < 0) return m
  const nextOptions = [...options]
  nextOptions[1] = { ...options[1], whenOn: [...whenOn.slice(0, i), ...next, ...whenOn.slice(i + 1)] }
  return { ...m, merge: { ...(m.merge as Rec), toggle: { ...toggle, options: nextOptions } } }
})

/** Drops augments aimed at another record's note (the note is gone, so they would change nothing). */
const dropNoteAugments = (id: string): Edit => mechanics => mechanics.filter(m => !(m.type === 'augment' && (m.value as Rec).id === id && ((m.value as Rec).limit as string[] | undefined)?.includes('global-note')))

/** A Reaper feature's "You become Indoctrinated N": its augment sets Reaper Scar's minimum instead of a flat bonus, and its note augments go. */
const indoctrinatedAtLeast: Edit = (mechanics, record) => all(
  dropNoteAugments('reaper-scar'),
  ms => ms.map((m) => {
    const level = ((m.merge as Rec | undefined)?.bonus as Rec | undefined)?.value
    return m.type === 'augment' && (m.value as Rec).id === 'reaper-scar' && typeof level === 'number' ? { ...m, merge: { bonus: { min: level } } } : m
  }),
)(mechanics, record)

/**
 * Phase 4 piece 5 (plan/31 §1.6): power modifiers as `power-augment`, and Reaper Scar's bonus as
 * the tracked Indoctrinated level (`me:indoctrination`, at least the level its features name). Re-runnable.
 */
export const POWER_AUGMENT_CONVERSIONS: Record<string, Edit> = {
  // Tech Cannon: slots count one level higher; cantrips roll one more damage die. Only while the cannon is on (its toggle option).
  'class-features/tech-cannon': mechanics => inTechCannonOption('Tech Cannon',
    { type: 'power-augment', castLevelBonus: 1 },
    { type: 'power-augment', levels: [0], dieCount: 1 },
  )(mechanics, {}),
  // Assault Mastery: two levels higher in all (Tech Cannon's one, plus one). Its once-per-rest double cast stays text.
  'class-features/assault-mastery': inTechCannonOption('Assault Mastery', { type: 'power-augment', castLevelBonus: 1 }),
  // Atomic Powers: + proficiency to powers that deal radiant damage (choosing Atomic versions stays text).
  'class-features/atomic-powers': replaceNote('Atomic Powers', { type: 'power-augment', damageTypes: ['radiant'], damageBonus: { type: 'proficiency' } }),
  // Radiation Poisoning: powers that deal radiant damage prime (radiant).
  'class-features/radiation-poisoning': replaceNote('Primed: Radiant', { type: 'power-augment', damageTypes: ['radiant'], merge: { primes: 'radiant' } }),
  // Deep Biotics: biotic cantrips roll one die size up; a d12 instead adds +2 per die.
  'class-features/deep-biotics': replaceNote('Deep Biotics', { type: 'power-augment', powerTypes: ['biotic'], levels: [0], dieIncrease: 1, overflowPerDie: 2 }),
  // Exploit: Pound: cantrips add the Exploit die to their damage, in their own damage type.
  'class-features/exploit-pound': replaceNote('Exploit: Pound', { type: 'power-augment', levels: [0], addDamage: [{ dieCount: 1, dieType: EXPLOIT_DIE }] }),
  // Tools of Destruction: combat cantrips have twice their uses.
  'class-features/tools-of-destruction': replaceNote('2x Cantrip Charges', { type: 'power-augment', powerTypes: ['combat'], levels: [0], usesMultiplier: 2 }),
  // Biotic Control: a rider on each of four powers.
  'class-features/biotic-control': replaceNote('Biotic Control',
    { type: 'power-augment', powers: ['lift'], notes: ['Biotic Control: both advancement options'] },
    { type: 'power-augment', powers: ['pull'], notes: ['Biotic Control: two targets, an attack roll for each'] },
    { type: 'power-augment', powers: ['singularity'], notes: ['Biotic Control: affects Large or smaller creatures and objects'] },
    { type: 'power-augment', powers: ['stasis'], notes: ['Biotic Control: targets have disadvantage on the save'] },
  ),
  // Reaper Scar: + your Indoctrinated level to attack and damage rolls; you are at least Indoctrinated 1, then 2 (Aura of Dominance) and 4 (Feeblemind).
  'class-features/reaper-scar': all(
    replaceNote('Reaper Scar'),
    mechanics => mechanics.map(m => (m.type === 'attack-augment' && (m.bonus as Rec | undefined)?.type === 'flat' ? { ...m, bonus: { type: 'me:indoctrination', min: 1 } } : m)),
  ),
  // Aura of Dominance, Exploit: Torture, Feeblemind and Apex Augments: "You become Indoctrinated 2/3/4/5" is the bonus's minimum.
  'class-features/aura-of-dominance': indoctrinatedAtLeast,
  'class-features/exploit-torture': indoctrinatedAtLeast,
  'class-features/feeblemind': indoctrinatedAtLeast,
  'class-features/apex-augments': indoctrinatedAtLeast,
}

/** The musician's Inspiration die: d6, d8 at 5th, d10 at 10th, d12 at 15th (Musician's Inspiration 1–4). */
const INSPIRATION_DIE = { type: 'progressive', limit: 'musician', value: { 1: 6, 5: 8, 10: 10, 15: 12 } }
/** The Beast Master's Command die: d8, d10 at 10th, d12 at 14th (Give Command, Improved and Expert Commander). */
const COMMAND_DIE = { type: 'progressive', limit: 'tracker', value: { 3: 8, 10: 10, 14: 12 } }
/** A Command's save: 8 + proficiency + Int for a synthetic beast, Cha for an organic one (plan/31 decision 3b: both, no computed DC). */
const COMMAND_DC_NOTE = 'Save DC {{ 8 + profBonus + intMod }} (synthetic beast) or {{ 8 + profBonus + chaMod }} (organic beast)'
/** A Sneak Toxin's save: the Poisoner's power save DC (plan/31 decision 3a). */
const TOXIN_DC = { base: 8, proficient: true, mod: 'int' }

/** Merges `fields` into the mechanics matching `test` (all of them, or the `nth` match). Re-runnable: fields already there change nothing. */
const patch = (test: (m: Rec) => boolean, fields: Rec, nth?: number): Edit => (mechanics) => {
  let n = -1
  return mechanics.map((m) => {
    if (!test(m)) return m
    n++
    return nth === undefined || n === nth ? { ...m, ...fields } : m
  })
}
const ofType = (...types: string[]) => (m: Rec) => types.includes(m.type as string)
/** A resource's cost per use (`increment`), keeping the rest of it. */
const costs = (test: (m: Rec) => boolean, increment: number, nth?: number): Edit => (mechanics) => {
  let n = -1
  return mechanics.map((m) => {
    if (!test(m)) return m
    n++
    return nth === undefined || n === nth ? { ...m, resource: { ...(m.resource as Rec), increment } } : m
  })
}
const commandCard = (fields: Rec = {}): Edit => patch(ofType('other', 'bonus-action', 'reaction'), { damage: [{ dieCount: 1, dieType: COMMAND_DIE, label: 'Command die' }], ...fields })
const toxin = (shortDesc: string): Edit => patch(ofType('other'), { dc: TOXIN_DC, shortDesc })

/**
 * Phase 4 piece 6 (plan/31 §1.2, `text-action` and the small `speed`/`rider`/`prose` conversions):
 * cards get the dice, DC, range, uses or cost their text states. Re-runnable.
 */
export const CARD_CONVERSIONS: Record<string, Edit> = {
  // Costs per use (barrier ticks, Fuel, Focus Points, omni-gel).
  'class-features/afterburner': costs(ofType('reaction'), 2),
  'class-features/biotic-ghost': costs(ofType('bonus-action'), 3),
  'class-features/cabal-cloak': costs(ofType('action'), 2),
  'class-features/heavy-weapon-hack': costs(ofType('action'), 2),
  'class-features/teleporting-dodge': costs(ofType('reaction'), 2),
  'edges/NMB_heightened-power': costs(ofType('other'), 3),
  'edges/NMB_quickened-power': costs(ofType('other'), 2),
  'class-features/quick-burn': patch(ofType('bonus-action'), { resource: { reset: 'short', id: 'armiger-fuel', max: { type: 'resource', value: 'armiger-fuel', useMax: true } } }),
  'feats/synthetic-healer': patch(m => m.type === 'action' && m.name === 'Create epoxy', { resource: { displayType: 'omni-gel', reset: 'off', label: 'omni-gel' } }),
  // Not by my Hand: one pool for both uses ("a number of times equal to your Charisma modifier, minimum once").
  'edges/REP_not-by-my-hand': patch(ofType('other', 'action'), { resource: { id: 'REP_not-by-my-hand', max: { type: 'mod', value: 'cha', min: 1 } } }),
  'edges/FS_protection': patch(ofType('reaction'), {
    resource: { reset: 'off', displayType: 'barrier-ticks', label: 'Barrier Ticks' },
    damage: [{ dieCount: { type: 'me:barrier-die-count' }, dieType: { type: 'me:barrier-die-type' }, label: 'Damage reduced' }],
  }),

  // Dice the text rolls.
  'armor/archon-visor': patch(ofType('action'), { damage: [{ dieCount: 1, dieType: 4, label: 'Power slot levels or tech points' }] }),
  'class-features/feedback': patch(ofType('reaction'), { damage: [{ dieCount: 1, dieType: INSPIRATION_DIE, label: 'Subtracted from the roll' }] }),
  'class-features/inspire-the-revolution': patch(ofType('action'), { damage: [{ dieCount: 1, dieType: INSPIRATION_DIE, label: 'AC reduction' }], shortDesc: 'Every creature you consider an enemy in a :distance{length="25"} radius has its AC reduced by {{ roll }}. This effect lasts {{ chaMod }} rounds. Using Inspiration this way consumes 2 uses of Inspiration per use.' }),
  'class-features/soothing-music': patch(ofType('other'), { damage: [{ dieCount: 1, dieType: INSPIRATION_DIE, type: 'hp' }] }),
  'edges/REP_convince': patch(ofType('other'), { damage: [{ dieCount: 1, dieType: 6, label: 'Added to the check' }] }),
  'feats/fake-it-til-you-make-it': patch(ofType('other'), { damage: [{ dieCount: 1, dieType: 4, label: 'Added to the roll' }], shortDesc: 'When you fail an ability check or saving throw or miss with an attack roll, spend a hit die to add {{ roll }} to the roll.' }),
  'traits/aspiration': patch(ofType('other'), { damage: [{ dieCount: 1, dieType: 4, label: 'Added to the roll' }] }),
  'traits/leadership': patch(ofType('reaction'), { damage: [{ dieCount: 1, dieType: 4, label: 'Added to the roll' }] }),
  'species/avatar-sacrifice': patch(ofType('reaction'), { damage: [{ dieCount: 1, dieType: 10, bonus: { type: 'proficiency' }, label: 'Damage reduced' }] }),
  'traits/fury-of-the-small': patch(ofType('other'), { damage: [{ bonus: { type: 'level' }, label: 'Extra damage' }] }),
  'class-features/barbed-strikes': patch(ofType('bonus-action'), { damage: [{ dieCount: { type: 'progressive', value: { 1: 1, 5: 2, 11: 3, 17: 4 } }, dieType: 6, type: 'piercing' }] }),
  'class-features/nanite-apotheosis': patch(m => m.type === 'other' && m.name === 'Nanite Apotheosis (regen)', { damage: [{ type: 'hp', mod: 'con', bonus: { type: 'flat', value: 5 } }] }),

  // DCs, ranges and damage the text states.
  'class-features/judgement': patch(ofType('reaction'), { dc: { base: 8, proficient: true, mod: 'con', save: 'wis' }, shortDesc: 'Whenever another creature makes an attack roll against you and misses, you may use your reaction to force the attacking creature to make a {{ dc }} Wisdom saving throw. On a failed save, the creature becomes frightened of you for 1 minute. The affected creature may roll another Wisdom saving throw at the end of each of their next turns. On a success, they\'re no longer frightened.' }),
  'feats/poison-skin': patch(ofType('bonus-action'), { damage: [{ dieCount: 1, dieType: 4, type: 'poison' }], dc: { base: 13, proficient: false, save: 'con' }, shortDesc: 'Coat a weapon with your skin\'s poison. A creature that takes piercing or slashing damage from it takes {{ roll }} and must succeed on a DC 13 Constitution saving throw or be poisoned for 1 hour.' }),
  'class-features/supply-pylon': patch(ofType('other'), {
    name: 'Supply Pylon',
    resource: { reset: 'long' },
    range: { short: 10 },
    // The engineer's power save DC (plan/31 decision 3d); the creature saves with advantage.
    dc: { base: 8, proficient: true, mod: 'int', save: 'dex' },
    damage: [{ dieCount: 4, dieType: 8, type: 'bludgeoning' }],
    shortDesc: 'Call a supply pylon to a point within :distance{length="10"}; it lands at the start of your next turn. A creature in that spot makes a {{ dc }} Dexterity saving throw with advantage, or takes {{ roll }} and is knocked :condition{id="prone"}. It holds 5 resources you choose (restock with 5 omni-gel).',
  }),
  'gear/smoke-grenade': patch(ofType('action'), { range: { short: 30, aoe: { type: 'cube', size: 10 } }, shortDesc: 'Smoke heavily obscures a :distance{length="10" adj} cube centered on a point within range for 30 seconds (a moderate wind disperses it after 1 round).' }),
  'class-features/injection': patch(ofType('bonus-action'), {
    range: { short: 30 },
    damage: [{ dieCount: { type: 'progressive', limit: 'infiltrator', value: SNEAK_DICE }, dieType: 6, type: 'poison' }],
    shortDesc: 'If you haven\'t used your Sneak Attack this round, use your Cunning Action to fire a dart of poison at an enemy within :distance{length="30"}: {{ roll }}, and a Toxin if you choose. Targets hit have disadvantage on saving throws against Toxin effects.',
  }),
  // Half the Sneak Attack dice (rounded down), from 9th level.
  'class-features/grab-and-toss': patch(ofType('reaction'), { damage: [{ dieCount: { type: 'progressive', limit: 'infiltrator', value: { 9: 2, 11: 3, 15: 4, 19: 5 } }, dieType: 6 }] }),

  // Beast Master Commands: the Command die (and the save DC for the beast's kind).
  'edges/BMCD_ambush': commandCard(),
  'edges/BMCD_bait-and-switch': commandCard(),
  'edges/BMCD_brace': commandCard(),
  'edges/BMCD_commanding-presence': commandCard(),
  'edges/BMCD_disarming-strike': commandCard({ notes: [COMMAND_DC_NOTE] }),
  'edges/BMCD_distracting-strike': commandCard(),
  'edges/BMCD_evasive-maneuvers': commandCard(),
  'edges/BMCD_feinting-attack': commandCard(),
  'edges/BMCD_grappling-strike': commandCard(),
  'edges/BMCD_lunging-attack': commandCard(),
  'edges/BMCD_maneuvering-attack': commandCard(),
  'edges/BMCD_menacing-attack': commandCard({ notes: [COMMAND_DC_NOTE] }),
  'edges/BMCD_pushing-attack': commandCard({ notes: [COMMAND_DC_NOTE] }),
  'edges/BMCD_rally': patch(ofType('bonus-action'), { damage: [{ dieCount: 1, dieType: COMMAND_DIE, mod: 'cha', type: 'temp' }] }),
  'edges/BMCD_trip-attack': commandCard({ notes: [COMMAND_DC_NOTE] }),

  // Sneak Toxins: the Poisoner's power save DC, and what each does.
  'edges/ST_death-toxin': patch(ofType('other'), { shortDesc: 'Forgo all your Sneak Attack dice: the target rolls a d20, and on 10 or under it drops to -1 hit points. It is immune to this toxin for 24 hours.' }),
  'edges/ST_halucinating-toxin': toxin('Forgo any number of Sneak Attack dice: on a failed save, the target has disadvantage on attack rolls, skill checks and Wisdom saving throws for that many rounds.'),
  'edges/ST_hindering-toxin': toxin('Forgo any number of Sneak Attack dice: on a failed save, the target\'s speed drops by :distance{length="5"} per die.'),
  'edges/ST_mind-addling-toxin': toxin('Forgo any number of Sneak Attack dice: on a failed save, the target has disadvantage on concentration checks for that many rounds.'),
  'edges/ST_neural-toxin': toxin('Forgo any number of Sneak Attack dice: on a failed save, a target that casts tech powers loses that many tech points.'),
  'edges/ST_paralyzing-toxin': toxin('Forgo any number of Sneak Attack dice: on a failed save, the target is :condition{id="paralyzed"} for that many rounds.'),
  'edges/ST_polonium-toxin': toxin('Forgo any number of Sneak Attack dice: on a failed save, a target that casts biotic powers loses one power slot of a level equal to half the dice forgone.'),
  'edges/ST_vulnerability-toxin': toxin('Forgo half your Sneak Attack dice: on a failed save, the target is vulnerable to the next attack it takes.'),

  // Rules for attacks (B58 toggles, B62 questions), in place of description-only cards.
  'armor/delumcore-overlay': replaceWhere(ofType('other'), { type: 'attack-augment', attackLimit: { model: 'weapon', type: 'ranged' }, augmentTypes: ['damage'], addCritDie: 1 }),
  'armor/kuwashii-visor': (mechanics) => {
    if (mechanics.some(m => m.type === 'attack-augment')) return mechanics
    return [...mechanics, { type: 'attack-augment', ask: 'Is the target marked by your Kuwashii Visor?', attackLimit: { model: 'weapon' }, augmentTypes: ['damage'], addDamage: [{ dieCount: 1, dieType: 6 }] }]
  },
  'class-features/biotic-bull-rush': (mechanics) => {
    if (mechanics.some(m => m.type === 'attack-augment')) return mechanics
    return [...mechanics, { type: 'attack-augment', ask: 'Bonus action attack after casting Charge?', attackLimit: { model: 'weapon' }, augmentTypes: ['damage'], bonus: { type: 'flat', value: 5 } }]
  },
  'feats/charger': (mechanics) => {
    if (mechanics.some(m => m.type === 'attack-augment')) return mechanics
    return [...mechanics, { type: 'attack-augment', ask: 'After a Dash of more than :distance{length="10"} in a straight line?', attackLimit: { type: 'melee' }, augmentTypes: ['damage'], bonus: { type: 'flat', value: 5 } }]
  },
  'class-features/prayer': (mechanics) => {
    if (mechanics.some(m => m.type === 'attack-augment')) return mechanics
    return [...mechanics, { type: 'attack-augment', ask: 'A critical hit on a turn you prayed to Amonkira?', augmentTypes: ['damage'], bonus: { type: 'level' } }]
  },
  'traits/savage-attacks': mechanics => (mechanics.length ? mechanics : [{ type: 'attack-augment', attackLimit: { model: 'weapon', type: 'melee' }, augmentTypes: ['damage'], addCritDie: 1 }]),
  'traits/rally-point': mechanics => (mechanics.length ? mechanics : [toggle('rally-point', 'Speed reduced to 0 at the start of your turn: +proficiency to the DC of your next Burst Fire this turn.', [
    { type: 'attack-augment', attackLimit: { model: 'weapon', special: 'bf' }, augmentTypes: ['dc'], bonus: { type: 'proficiency' } },
  ])]),

  // Uses and descriptions the cards lacked.
  'class-features/advanced-weapon-holsters': mechanics => (mechanics.length ? mechanics : [{ type: 'me:weapon-slots', value: 2 }]),
  'class-features/diagnostic-drone': mechanics => (mechanics.length ? mechanics : [{
    type: 'other',
    name: 'Diagnostic Drone',
    resource: { reset: 'long', max: { type: 'progressive', limit: 'explorer', value: { 10: 1, 20: 2 } } },
    shortDesc: 'When you take a short rest: recover half your expended power slots, split evenly between biotic and tech.',
  }]),
  'class-features/hologram': all(
    patch(ofType('bonus-action'), { shortDesc: 'Create a hologram of yourself within :distance{length="15"} (AC {{ 14 + profBonus }}, 1 hit point, immune to conditions and priming). It moves :distance{length="25"} on your turn (no action). Your attacks and aimed combat powers can come from its position, as lightning damage.' }),
    (mechanics) => {
      if (mechanics.some(m => m.type === 'reaction')) return mechanics
      return [...mechanics, {
        type: 'reaction',
        name: 'Hologram Opportunity Attack',
        shortDesc: 'A creature moves through your hologram\'s threatened area: a melee attack from the hologram.',
        attack: { type: 'melee', proficient: true, bonus: { type: 'modComparison', value: ['str', 'dex'] } },
        range: { short: 5 },
        damage: [{ dieCount: 1, dieType: 6, type: 'lightning', bonus: { type: 'modComparison', value: ['str', 'dex'] } }],
      }]
    },
  ),
  'traits/blood-rage': patch(ofType('other'), { resource: { reset: 'long' }, shortDesc: 'Reduced to 0 hit points but not killed: rage for 1 minute instead of falling unconscious (Attack or Dash only; immune to charmed and frightened; death saves continue).' }),
  'traits/body-and-soul': patch(ofType('other'), { resource: { reset: 'long' }, shortDesc: 'After 10 minutes of prayer: the next time you drop to 0 hit points, you have advantage on death saving throws until you are stable or regain hit points.' }),
  'traits/psychometry': patch(ofType('other'), { resource: { reset: 'long' }, shortDesc: 'Touch a creature or object and concentrate for 1 minute: learn basic facts about it and the events within :distance{length="30"} of it in the past 24 hours.' }),
  'traits/saving-face': patch(ofType('other'), { shortDesc: 'When you miss an attack or fail an ability check or saving throw: add the number of allies you can see (at most +5).' }),

  // Plasma Charge System: its splash hits the creatures around the target, not the target (the text wins, plan/31 decision 2).
  'mods/plasma-charge-system': mechanics => mechanics.map((m) => {
    if (m.type !== 'me:weapon-augment' || !m.addDamage) return m
    const { addDamage: _, ...rest } = m
    return rest
  }),
}

/** Set bonuses keep mechanics per threshold. */
const SET_BONUSES: Record<string, (bonuses: Rec[]) => Rec[]> = {
  'set-bonuses/pathfinder': bonuses => bonuses.map(b => ({ ...b, mechanics: replaceNote('Null Critical', { type: 'critical-immunity' })((b.mechanics ?? []) as Rec[], b) })),
}

export function convert(root: string) {
  const changed: string[] = []
  const write = (rel: string, fn: (attributes: Rec) => Rec) => {
    const file = join(root, 'content', `${rel}.md`)
    const raw = readFileSync(file, 'utf8')
    const { attributes, body } = parseFrontMatter(raw)
    const next = fn(structuredClone(attributes))
    if (JSON.stringify(next) === JSON.stringify(attributes)) return
    // Keys keep their place; `mechanics` is added after the record's leading fields when new.
    writeFileSync(file, toCrlf(stringifyRecord(next, body)))
    changed.push(rel)
  }
  for (const [rel, edit] of Object.entries(CONVERSIONS)) {
    write(rel, (a) => {
      const mechanics = (a.mechanics ?? []) as Rec[]
      // Prose-only records gain mechanics; a converted record has no matching note left.
      const asked = ['edges/FS_sniper', 'class-features/blood-trail', 'class-features/soft-spots'].includes(rel)
      if (!mechanics.length || mechanics.some(isNote()) || asked || rel.startsWith('class-features/brutal-critical-')) return { ...a, mechanics: edit(mechanics, a) }
      return a
    })
  }
  for (const [rel, edit] of Object.entries(SET_BONUSES)) write(rel, a => ({ ...a, bonuses: edit((a.bonuses ?? []) as Rec[]) }))
  for (const [rel, edit] of Object.entries(PHASE4_CONVERSIONS)) write(rel, a => ({ ...a, mechanics: edit((a.mechanics ?? []) as Rec[], a) }))
  for (const [rel, edit] of Object.entries(POWER_AUGMENT_CONVERSIONS)) write(rel, a => ({ ...a, mechanics: edit((a.mechanics ?? []) as Rec[], a) }))
  for (const [rel, edit] of Object.entries(CARD_CONVERSIONS)) write(rel, a => ({ ...a, mechanics: edit((a.mechanics ?? []) as Rec[], a) }))
  // Maverick's set bonuses: one more crit die, then crits on 18–20, with weapon attacks.
  write('set-bonuses/maverick', a => ({ ...a, bonuses: ((a.bonuses ?? []) as Rec[]).map(b => (b.threshold === 2
    ? { ...b, mechanics: replaceWhere(ofType('other'), { type: 'attack-augment', attackLimit: { model: 'weapon' }, augmentTypes: ['damage'], addCritDie: 1 })((b.mechanics ?? []) as Rec[], b) }
    : b.threshold === 4
      ? { ...b, mechanics: replaceWhere(ofType('other'), { type: 'attack-augment', attackLimit: { model: 'weapon' }, augmentTypes: ['hit'], crit: 18 })((b.mechanics ?? []) as Rec[], b) }
      : b)) }))
  return changed
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('backlog-global-notes.ts')) {
  const root = resolve(process.argv[2] ?? '../omnibrew-me5e-data')
  const changed = convert(root)
  console.log(`${changed.length} records changed:\n${changed.join('\n')}`)
}
