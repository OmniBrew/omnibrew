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
  return changed
}

if (import.meta.url === `file:///${process.argv[1]?.replaceAll('\\', '/')}` || process.argv[1]?.endsWith('backlog-global-notes.ts')) {
  const root = resolve(process.argv[2] ?? '../omnibrew-me5e-data')
  const changed = convert(root)
  console.log(`${changed.length} records changed:\n${changed.join('\n')}`)
}
