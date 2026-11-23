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
  return changed
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('backlog-global-notes.ts')) {
  const root = resolve(process.argv[2] ?? '../omnibrew-me5e-data')
  const changed = convert(root)
  console.log(`${changed.length} records changed:\n${changed.join('\n')}`)
}
