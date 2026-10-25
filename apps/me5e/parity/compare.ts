import { legacyTagsToMdc } from '../migrate/mdc'
import type { ParitySheet } from './sheet'

/**
 * Field-by-field comparison of two parity sheets.
 *
 * `normalize` removes differences of form, not of numbers: prose components
 * (`<me-distance>` became `:distance`, by the content migration's own rewrite),
 * save abilities written upper-case in the live data, and the `heat` and
 * `versatile` property tooltips (the content migration made them weapon
 * properties, plan/04 B8).
 *
 * `KNOWN` lists the differences that are deliberate: live-site bugs the engine
 * fixes, content fixed since the live data, and the mechanics backlog
 * conversions. Each names its reason; plan/18 lists them. A changed card line
 * is explained when the known `fix`es, applied together to the live text, give
 * the engine's text (one line can carry several causes); any other line needs
 * a known `test`. A difference nothing explains fails the test.
 */
export interface KnownContext {
  /** The old-format character the two sheets came from. */
  character: Record<string, unknown>
  /** Equipment uuids of weapons with more than one `me:weapon-augment` mod. */
  multiModWeapons?: string[]
}

export interface Known {
  id: string
  reason: string
  /** Rewrites the live text of a changed card line toward the engine's (`next`); returns it unchanged when it doesn't apply. */
  fix?: (text: string, ctx: KnownContext, next: string) => string
  /** Explains one whole diff line on its own. */
  test?: (line: string, ctx: KnownContext) => boolean
}

/** Old and new text of one changed card line (`<path> ~ <old> => <new>`). */
export function pair(line: string): [string, string] | null {
  const m = line.match(/^\S+ ~ (.*) => (.*)$/)
  return m ? [m[1]!, m[2]!] : null
}

/** The character uses a record (equipment, choice, power, species or subclass id anywhere in it). */
const uses = (ctx: KnownContext, ...ids: string[]) => {
  const json = JSON.stringify(ctx.character)
  return ids.some(id => json.includes(`"${id}"`))
}
/** Global notes the backlog conversion replaced (their `value`). */
const BACKLOG_NOTES = [
  'Null Critical', 'Critical Immunity', 'Evasion', 'Biotic Punch', 'Cantrip Attack', '1st-level Power Attack', 'Brutal Critical', '+1 slashing dmg',
  'Sniper', 'Free Hand', '+2 w/ Jump Jet or Jetpack', 'Blood Trail', 'Lock On', 'Soft Spots', 'Power from Pain', 'Sneak Attack',
]
/** Cards whose texts moved to `{{ roll }}` (apps/me5e/migrate/placeholders-roll.ts), as `<group> <name>`. */
const ROLL_CARDS = [
  'Exploit: Excruciate', 'Destructive Charging', 'Fearsome Reputation', 'Fighting Spirit', 'Tireless Spirit', 'Steady Aim', 'Tech Annihilation', 'Tech Onslaught', 'Vengeance', 'Won\'t Quit', 'Sweeping Attack',
  ...['Assault Rifles', 'Heavy Pistols', 'Melee Weapons', 'SMGs', 'Shotguns', 'Sniper Rifles'].flatMap(w => [w, `Weapon of Choice: ${w}`]), 'Assault Rifle (parry)', 'Heavy Pistol (parry)', 'Melee Weapon (parry)', 'SMG (parry)', 'Shotgun (parry)', 'Sniper Rifle (parry)',
].flatMap(n => ['action', 'bonus-action', 'reaction', 'other', 'attack'].flatMap(t => [`${t} ${n}`, `${t}[Weapon of Choice] ${n}`]))
const d12Bonuses =(s: string) => [...s.matchAll(/d12 \+ (-?\d+)/g)].map(x => Number(x[1]))
const segment = (s: string, prefix: string) => s.split(' | ').find(x => x.startsWith(prefix))
const withSegment = (s: string, prefix: string, value: string | undefined) => s.split(' | ').map(x => (x.startsWith(prefix) && value ? value : x)).join(' | ')

export const KNOWN: Known[] = [
  // --- live-site bugs the engine fixes ---
  {
    id: 'die-increase-past-d12',
    reason: 'Live bug: "increase the die type" past a d12 kept the d12 and subtracted the extra steps from the roll; the rule (Empowered Hunter Mode, weapon mods) says +1 per step. The engine adds.',
    fix: (text, _, next) => {
      const [a, b] = [d12Bonuses(text), d12Bonuses(next)]
      if (!a.length || a.length !== b.length || !a.every((n, i) => b[i]! > n)) return text
      let i = 0
      return text.replaceAll(/d12 \+ -?\d+/g, () => `d12 + ${b[i++]}`)
    },
  },
  {
    id: 'die-increase-without-die',
    reason: 'Live bug: "increase the die type" on a roll without dice (flat damage, temporary hit points) gave it a d1 ("0d1 + 30 cold damage"). The engine leaves it as a flat roll.',
    fix: text => text.replaceAll(/(\d+)d1 /g, '$1 '),
  },
  {
    id: 'flat-damage-text',
    reason: 'Live display: a roll with no dice printed "0 + 15 temp damage"; the engine prints "15 temp damage".',
    fix: text => text.replaceAll(/\b0 \+ (?=\d)/g, ''),
  },
  {
    id: 'typeless-damage-text',
    reason: 'Live display bug: a damage roll without a type printed "damage damage" ("8d6 damage damage", also inside `{{ damage }}` texts). The engine prints "8d6 damage".',
    fix: text => text.replaceAll(' damage damage', ' damage'),
  },
  {
    id: 'double-tap-hit',
    reason: 'Live bug: the hit bonus of a double tap attack read a property of `true` and printed NaN. The engine adds the double tap attack augments.',
    fix: (text, _, next) => (text.includes('| hit NaN') && segment(next, 'hit ') ? withSegment(text, 'hit NaN', segment(next, 'hit ')) : text),
  },
  {
    id: 'sense-without-distance',
    reason: 'Live bug: a sense with no distance (truesight "until your Search action resolves") made the sense NaN. The engine shows 0 and keeps the note.',
    test: line => /^\.senses\.[\w-]+: null → 0$/.test(line),
  },
  {
    id: 'sense-list',
    reason: 'Live bug: a `sense` mechanic listing senses (`sense: [darkvision]`, Maverick and Partisan helmets) was ignored. The engine reads the list.',
    test: (line, ctx) => /^\.senses\.darkvision: 0 → \d+$/.test(line) && uses(ctx, 'maverick-visor', 'partisan-helmet'),
  },
  {
    id: 'natural-weapon-range',
    reason: 'Live bug: a natural weapon replacing the unarmed strike took `Math.max` of two range objects (NaN), so the strike lost its range or kept the base 5 (kett Tentacles). The engine keeps the longer reach.',
    fix: (text, _, next) => {
      const range = segment(next, 'range ')
      if (!range || !/^(?:attacks|twf) (?:Unarmed Strike|Tentacles|[^|]*) \| hit/.test(text) || segment(text, 'range ') === range) return text
      if (segment(text, 'range ')) return withSegment(text, 'range ', range)
      const parts = text.split(' | ')
      const at = parts.findIndex(p => p.startsWith('notes ') || p.startsWith('res '))
      parts.splice(at < 0 ? parts.length : at, 0, range)
      return parts.join(' | ')
    },
  },
  {
    id: 'text-ability-scores',
    reason: 'Live bug: ability scores saved as text ("15") were joined, not added, to bonuses, so the sheet showed 1500 (+745) and every roll from it. The migration stores numbers.',
    test: (line, ctx) => Object.values((ctx.character.abilityScores ?? {}) as Record<string, { value?: unknown }>).some(a => typeof a?.value === 'string')
    // `ac` also matches `.actions`.
      && /^\.(?:abilities|saves|skills|initiative|ac|hp|powers|attacks|powercasting|resources)/.test(line),
  },
  {
    id: 'engi-knight-source',
    reason: 'Live hack: powers granted by the Engi Knight subclass showed "soldier" as their source (a hard-coded id in the old store). The engine shows the name of the granting record.',
    fix: (text, ctx, next) => (uses(ctx, 'engi-knight') && next.includes(' src Engi Knight ') ? text.replace(' src soldier ', ' src Engi Knight ') : text),
  },
  {
    id: 'weapon-mods-all-apply',
    reason: 'Plan/04 Q18: every mod effect of a weapon applies (one mod per slot, so one ammo mod at most). The live sheet applied only the first, so a scope or barrel hid the ammo mod (damage type, priming, detonation) and vice versa.',
    fix: (text, ctx, next) => ((ctx.multiModWeapons ?? []).some(uuid => text.includes(`res resource ${uuid} `)) ? next : text),
  },
  {
    id: 'burst-fire-heat',
    reason: 'Live bug: burst fire costs 2 more heat than a shot of the weapon, but a weapon whose mod had no heat cost added 2 to nothing (NaN, shown blank). The engine shows +3.',
    fix: (text, _, next) => (text.startsWith('bf ') && next.includes('manual heat +3') ? text.replace(/manual heat(?= \||$)/, 'manual heat +3') : text),
  },
  // --- the mechanics backlog (plan/09): notes made mechanics in Phase 3a (apps/me5e/migrate/backlog-global-notes.ts) ---
  {
    id: 'backlog-global-notes',
    reason: 'Plan/04 R8: global notes converted to mechanics. The note leaves the sheet; its rule shows as a special defense (critical immunity, evasion), powers castable as attacks, a toggle card with its bonus, or a card with its dice (Sneak Attack, Power from Pain).',
    fix: (text, _, next) => {
      if (next.includes(' alt attack time ') && !text.includes(' alt ')) return text.replace(' time ', ' alt attack time ')
      return text.replace(/ alt ([\w,]+) time /, (m, units: string) => (next.includes(` alt ${units},attack time `) ? ` alt ${units},attack time ` : m))
    },
    test: (line) => {
      const note = line.match(/^\.globalNotes - "\w*: (.*)"$/)?.[1]
      if (note) return BACKLOG_NOTES.some(n => note === n || note.startsWith(`${n}:`))
      if (/^\.resources \+ "toggle (?:FS_sniper|FS_the-free-hand|aerial-performance-optimizer|blood-trail|lock-on|soft-spots)"$/.test(line)) return true
      return /^\.actions \+ "other (?:Sniper|The Free Hand|Aerial Performance Optimizer|Blood Trail|Lock On|Soft Spots|Power from Pain|Sneak Attack) \|/.test(line)
    },
  },
  {
    id: 'backlog-talon-gauntlets',
    reason: 'Plan/04 R8: the "+1 slashing damage to all melee damage rolls" of the Batarian Talon Gauntlets is extra damage on every melee attack (weapons, strikes and melee power attacks), merged into a slashing roll.',
    fix: (text, ctx, next) => (uses(ctx, 'batarian-talon-gauntlets') ? withSegment(text, 'dmg ', segment(next, 'dmg ')) : text),
  },
  {
    id: 'content-roll-placeholders',
    reason: 'Content (plan/04 Q15): texts that named the damage type after `{{ damage }}` use `{{ roll }}` ("they take 9 psychic damage", not "9 psychic damage psychic damage"); Weapon of Choice adds a die, not "1d4 damage", to a roll or AC.',
    fix: (text, _, next) => (ROLL_CARDS.some(n => text.startsWith(`${n} `) || text === n) ? withSegment(text, 'text ', segment(next, 'text ')) : text),
  },
  // --- old saved formats the migration reads as the player meant them ---
  {
    id: 'migrated-feat-picks',
    reason: 'Live bug: the 1.0.2 migration stored the feat pick of an old character as a list inside the pick (`value: ["alert"]`), so the feat never applied. The migration flattens it (Alert: +5 initiative).',
    test: (line, ctx) => line.startsWith('.initiative:') && JSON.stringify(ctx.character).includes('"value":["alert"]'),
  },
  {
    id: 'migrated-advancement-index',
    reason: 'Live bug: an advancement stored by index (older characters) showed its name but never applied its effect. The migration stores the advancement id.',
    test: (line, ctx) => line.startsWith('.powers ~') && JSON.stringify(ctx.character).includes('"advancement":1'),
  },
  {
    id: 'migrated-sense-key',
    reason: 'Plan/04 B20: senses typed on the sheet before 1.0.2 used `infrared_vision`; the live sheet read `infrared-vision` and showed NaN. The migration renames the key.',
    test: (line, ctx) => line === `.senses.infrared-vision: null → ${(ctx.character.settings as { senses?: Record<string, number> })?.senses?.infrared_vision}`,
  },
  // --- content fixed since the live data (plan/08 R1–R5, plan/04 Q11–Q12, the validator) ---
  {
    id: 'content-terminus-helmet',
    reason: 'Content: the +1 AC of the Terminus Assault Helmet had `type: 1` (counted 0 on the live site); the validation fixes made it `flat`.',
    test: (line, ctx) => {
      const m = line.match(/^\.ac: (\d+) → (\d+)$/)
      return !!m && uses(ctx, 'terminus-assault-helmet') && Number(m[2]) - Number(m[1]) === 1
    },
  },
  {
    id: 'content-cain',
    reason: 'Content (plan/04 Q12): the action of the Cain was named "M-560 Hydra"; it is "M-920 Cain".',
    test: (line, ctx) => uses(ctx, 'm-920-cain') && /^\.actions [-+] "action\[Heavy Weapons\] M-(?:560 Hydra|920 Cain) \|/.test(line),
  },
  {
    id: 'content-special-saves',
    reason: 'Content (plan/08 R5): no `Special` saves; a DC with no save and a note (Damping).',
    fix: text => text.replace(' Special |', ' |'),
  },
  {
    id: 'content-disease',
    reason: 'Content (plan/08 R3): "immune to disease" is a global note until a disease rule exists (hermetic and pressurized suits).',
    test: line => /^\.defenses\.condition-immunity - "disease /.test(line) || /^\.globalNotes \+ "defenses: Immune to disease /.test(line),
  },
  {
    id: 'content-fall-damage',
    reason: 'Content (plan/08 R2): falling damage is the `fall-damage` mechanic; a reduction ("reduce by 4d6...") is no longer listed as a resistance.',
    test: line => /^\.defenses\.resistance - "fall \(reduce /.test(line),
  },
  {
    id: 'content-exalted-lineages',
    reason: 'Content (plan/04 Q11): Exalted Lineages pass on condition immunities, and a subspecies lineage takes its parent species traits.',
    test: (line, ctx) => /^\.defenses\.[\w-]+ \+ /.test(line) && JSON.stringify(ctx.character).includes('"EXL_'),
  },
  {
    id: 'content-versatile-property',
    reason: 'Content (plan/04 B8): the `versatile` damage of a weapon became the value of the versatile property. The live sheet only rolled versatile damage for weapons listing the property, so the bayonet of the Ruzad (1d10 slashing) never showed; it does now (plan/18 asks whether it should).',
    fix: text => (/^(?:attacks|twf|dt) Ruzad /.test(text) ? text.replace(/(dmg \d+d\d+ \+ (-?\d+) piercing damage)/, '$1 / 1d10 + $2 slashing damage') : text),
  },
  {
    id: 'content-validation-fixes',
    reason: 'Content fixed by the validation report (plan/08): typos that made the live sheet drop a value: `tpe` (Experimental Barrier Generator damage type), `type: type` (Tank Through is a reaction), `sense` for `value` (Deception of Loki hardware), `model: subclass` (source of the Cardinal powers), `type: poison` for `resistance` (Toxic Resistance), `type: reaction` for `augment` (Reflecting Barricade joins the Tech Barricade toggle), advancements that changed `damage` as an object, so the live site never applied them (Nova: Improved Damage, Justice: Neutralise), `walking` for `walk` (Plains), and the plan/04 Q16 fixes (VI Response adds Intelligence to initiative; the Reckoner-Knight reroll is for melee weapons only).',
    fix: (text, ctx, next) => {
      let out = text
      if (uses(ctx, 'experimental-barrier-generator-exe')) out = out.replace('dmg 5d4 damage damage', 'dmg 5d4 force damage')
      if (uses(ctx, 'cardinal')) out = out.replace(' src undefined ', ' src Cardinal ')
      if (uses(ctx, 'reckoner-knight-armorsuit') && !next.includes('Reroll 1s & 2s')) out = out.replace('notes Reroll 1s & 2s; ', 'notes ')
      if (uses(ctx, 'warleader') && out === 'reaction Reflecting Barricade' && next.startsWith('reaction Reflecting Barricade | text ')) out = next
      return out
    },
    test: (line, ctx) => (uses(ctx, 'nanobreaker') && line === '.actions + "reaction Tank Through | text Halve an attack\'s damage aimed against you."')
      || (uses(ctx, 'hardware-loki') && (line === '.profs.skill - "undefined"' || line === '.profs.skill + "deception"' || /^\.skills\.deception: /.test(line)))
      || /^\.powers ~ power (?:nova|justice)@/.test(line)
      || (uses(ctx, 'TA_plains') && /^\.speeds\.walk: \d+ → \d+$/.test(line))
      || (line.startsWith('.initiative:') && ((ctx.character.classes ?? []) as Array<{ subclass?: string, levels?: number }>).some(k => k.subclass === 'armorer' && (k.levels ?? 0) >= 14))
      || (uses(ctx, 'toxic-resistance') && line === '.defenses.resistance + "poison"'),
  },
]

export function normalize(sheet: ParitySheet): ParitySheet {
  const text = (s: string) => s
    // Prose tags as the content migration rewrote them (plan/04 B15).
    .replaceAll(/<me-[\w-][^>]*\/>/g, tag => legacyTagsToMdc(tag))
    .replaceAll(/ DC (\d+) (STR|DEX|CON|INT|WIS|CHA)\b/g, (_, n: string, a: string) => ` DC ${n} ${a.toLowerCase()}`)
    .split(' | ')
    .map(part => (part.startsWith('notes ') ? `notes ${part.slice(6).split('; ').filter(n => n !== 'Heat' && n !== 'Versatile').join('; ')}` : part))
    .filter(part => part !== 'notes ')
    .join(' | ')
  const list = (l: string[]) => l.map(text).sort()
  return {
    ...sheet,
    powers: list(sheet.powers),
    attacks: { attacks: list(sheet.attacks.attacks), twf: list(sheet.attacks.twf), dt: list(sheet.attacks.dt), bf: list(sheet.attacks.bf) },
    actions: list(sheet.actions),
    globalNotes: list(sheet.globalNotes),
  }
}

export function diff(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return []
  if (Array.isArray(a) && Array.isArray(b)) {
    const removed = a.filter(x => !b.some(y => JSON.stringify(y) === JSON.stringify(x)))
    const added = b.filter(y => !a.some(x => JSON.stringify(x) === JSON.stringify(y)))
    // Card lines that changed are paired by their name (the text before the first ` | `) and the item they belong to;
    // when that is ambiguous (one power learned from two classes), by their casting ability and source too.
    const key1 = (x: unknown) => (typeof x === 'string' ? `${x.split(' | ')[0]}${x.match(/res resource (\S+)/)?.[1] ?? ''}` : undefined)
    const key2 = (x: unknown) => (typeof x === 'string' ? `${key1(x)}${x.match(/ mod \S+ src [^|]*?(?= alt | time )/)?.[0] ?? ''}` : undefined)
    const out: string[] = []
    for (const x of removed) {
      let match: unknown
      for (const key of [key1, key2]) {
        const k = key(x)
        const matches = added.filter(y => k !== undefined && key(y) === k)
        if (k !== undefined && matches.length === 1 && removed.filter(r => key(r) === k).length === 1) {
          match = matches[0]
          break
        }
      }
      if (match !== undefined) {
        out.push(`${path} ~ ${String(x)} => ${String(match)}`)
        added.splice(added.indexOf(match), 1)
      }
      else out.push(`${path} - ${JSON.stringify(x)}`)
    }
    for (const y of added) out.push(`${path} + ${JSON.stringify(y)}`)
    return out
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].flatMap(k => diff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`))
  }
  return [`${path}: ${JSON.stringify(a)} → ${JSON.stringify(b)}`]
}

export interface Comparison {
  /** Differences no known reason explains. */
  unexplained: string[]
  /** Known differences by id. */
  known: Record<string, string[]>
}

/** Fixes run specific first: content and conversions, then the generic text fixes of live bugs. */
const GENERIC = ['die-increase-past-d12', 'die-increase-without-die', 'flat-damage-text', 'typeless-damage-text']
const byFixOrder = (known: Known[]) => [...known.filter(k => !GENERIC.includes(k.id)), ...known.filter(k => GENERIC.includes(k.id))]

export function compare(legacy: ParitySheet, engine: ParitySheet, ctx: KnownContext, known: Known[] = KNOWN): Comparison {
  const out: Comparison = { unexplained: [], known: {} }
  const count = (id: string, line: string) => (out.known[id] ??= []).push(line)
  for (const line of diff(normalize(legacy), normalize(engine))) {
    const p = pair(line)
    if (p) {
      let text = p[0]
      const applied: string[] = []
      for (const k of byFixOrder(known)) {
        const next = k.fix?.(text, ctx, p[1])
        if (next !== undefined && next !== text) {
          applied.push(k.id)
          text = next
        }
      }
      if (text === p[1] && applied.length) {
        for (const id of applied) count(id, line)
        continue
      }
    }
    const k = known.find(x => x.test?.(line, ctx))
    if (k) count(k.id, line)
    else out.unexplained.push(line)
  }
  return out
}
