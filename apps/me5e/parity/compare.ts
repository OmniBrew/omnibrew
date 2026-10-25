import { legacyTagsToMdc } from '../migrate/mdc'
import type { ParitySheet } from './sheet'

/**
 * Field-by-field comparison of two parity sheets.
 *
 * `normalize` removes differences of form, not of numbers: prose components
 * (`<me-distance>` became `:distance`, by the content migration's own rewrite), save abilities written upper-case in
 * the live data, and the `heat`/`versatile` property tooltips (the content
 * migration made them weapon properties, plan/04 B8).
 *
 * `KNOWN` lists the differences that are deliberate: live-site bugs the engine
 * fixes and content fixed since the live data. Each names its reason; the
 * phase report (plan/18) lists them. A difference matching none fails the test.
 */
export interface KnownContext {
  /** The old-format character the two sheets came from. */
  character: Record<string, unknown>
}

export interface Known {
  id: string
  reason: string
  /** Matches one diff line of a character. */
  test: (line: string, ctx: KnownContext) => boolean
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
const bonuses = (s: string) => [...s.matchAll(/d12 \+ (-?\d+)/g)].map(x => Number(x[1]))
/** A changed card line whose old text, with `from` replaced by `to`, is the new text. */
const changed = (line: string, from: string | RegExp, to: string) => {
  const p = pair(line)
  return !!p && p[0] !== p[0].replace(from, to) && p[0].replace(from, to) === p[1]
}

export const KNOWN: Known[] = [
  // --- live-site bugs the engine fixes ---
  {
    id: 'die-increase-past-d12',
    reason: 'Live bug: "increase the die type" past a d12 kept the d12 and subtracted the extra steps from the roll; the rule (Empowered Hunter Mode, weapon mods) says +1 per step. The engine adds.',
    test: (line) => {
      const p = pair(line)
      if (!p) return false
      const [a, b] = [bonuses(p[0]), bonuses(p[1])]
      return a.length > 0 && a.length === b.length && a.every((n, i) => b[i]! > n) && p[0].replaceAll(/d12 \+ -?\d+/g, '') === p[1].replaceAll(/d12 \+ -?\d+/g, '')
    },
  },
  {
    id: 'die-increase-without-die',
    reason: 'Live bug: "increase the die type" on a roll without dice (flat damage, temporary hit points) gave it a d1 ("0d1 + 30 cold damage"). The engine leaves it as a flat roll.',
    test: line => changed(line, /(\d+)d1 /g, '$1 '),
  },
  {
    id: 'double-tap-hit',
    reason: 'Live bug: the hit bonus of a double tap attack read a property of `true` and printed NaN. The engine adds the double tap attack augments.',
    test: line => line.startsWith('.attacks.dt ~') && (pair(line)?.[0].includes('hit NaN') ?? false),
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
    reason: 'Live bug: a natural weapon replacing the unarmed strike took `Math.max` of two range objects (NaN), so the card lost its range (kett Tentacles). The engine keeps the longer reach.',
    test: line => /^\.attacks\.attacks ~ /.test(line) && changed(line, / \| notes /, ' | range 5 | notes '),
  },
  {
    id: 'engi-knight-source',
    reason: 'Live hack: powers granted by the Engi Knight subclass showed "soldier" as their source (a hard-coded id in the old store). The engine shows the name of the granting record.',
    test: (line, ctx) => uses(ctx, 'engi-knight') && changed(line, ' src soldier ', ' src Engi Knight '),
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
    test: line => /^\.attacks\.attacks ~ attacks Ruzad /.test(line) && changed(line, /(dmg 2d8 \+ (-?\d+) piercing damage)/, '$1 / 1d10 + $2 slashing damage'),
  },
  {
    id: 'content-terminus-helmet',
    reason: 'Content: the Terminus Assault Helmet\'s +1 AC had `type: 1` (counted 0 on the live site); the validation fixes made it `flat`.',
    test: (line, ctx) => {
      const m = line.match(/^\.ac: (\d+) → (\d+)$/)
      return !!m && uses(ctx, 'terminus-assault-helmet') && Number(m[2]) - Number(m[1]) === 1
    },
  },
  {
    id: 'content-cain',
    reason: 'Content (plan/04 Q12): the Cain\'s action was named "M-560 Hydra"; it is "M-920 Cain".',
    test: (line, ctx) => uses(ctx, 'm-920-cain') && /^\.actions [-+] "action\[Heavy Weapons\] M-(?:560 Hydra|920 Cain) \|/.test(line),
  },
  {
    id: 'content-special-saves',
    reason: 'Content (plan/08 R5): no `Special` saves; a DC with no save and a note (Damping).',
    test: line => changed(line, ' Special |', ' |'),
  },
  {
    id: 'content-disease',
    reason: 'Content (plan/08 R3): "immune to disease" is a global note until a disease rule exists (hermetic and pressurized suits).',
    test: line => /^\.defenses\.condition-immunity - "disease /.test(line) || /^\.globalNotes \+ "defenses: Immune to disease /.test(line),
  },
  {
    id: 'content-validation-fixes',
    reason: 'Content fixed by the validation report (plan/08): typos that made the live sheet drop a value: `tpe` (Experimental Barrier Generator damage type), `type: type` (Tank Through is a reaction), `sense` for `value` (Loki hardware\'s Deception), `model: subclass` (Cardinal powers\' source), `type: poison` for `resistance` (Toxic Resistance), `type: reaction` for `augment` (Reflecting Barricade joins the Tech Barricade toggle).',
    test: (line, ctx) => (uses(ctx, 'experimental-barrier-generator-exe') && changed(line, 'dmg 5d4 damage damage', 'dmg 5d4 force damage'))
      || (uses(ctx, 'nanobreaker') && line === '.actions + "reaction Tank Through | text Halve an attack\'s damage aimed against you."')
      || (uses(ctx, 'hardware-loki') && line === '.profs.skill - "undefined"')
      || (uses(ctx, 'cardinal') && changed(line, ' src undefined ', ' src Cardinal '))
      || (uses(ctx, 'toxic-resistance') && line === '.defenses.resistance + "poison"')
      || (uses(ctx, 'warleader') && line.startsWith('.actions ~ reaction Reflecting Barricade => reaction Reflecting Barricade | text ')),
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
    // Card lines that changed are paired by their name (the text before the first ` | `).
    const key = (x: unknown) => (typeof x === 'string' ? x.split(' | ')[0] : undefined)
    const out: string[] = []
    for (const x of removed) {
      const k = key(x)
      const matches = added.filter(y => k !== undefined && key(y) === k)
      if (k !== undefined && matches.length === 1 && removed.filter(r => key(r) === k).length === 1) {
        out.push(`${path} ~ ${String(x)} => ${String(matches[0])}`)
        added.splice(added.indexOf(matches[0]), 1)
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

export function compare(legacy: ParitySheet, engine: ParitySheet, ctx: KnownContext, known: Known[] = KNOWN): Comparison {
  const out: Comparison = { unexplained: [], known: {} }
  for (const line of diff(normalize(legacy), normalize(engine))) {
    const k = known.find(x => x.test(line, ctx))
    if (k) (out.known[k.id] ??= []).push(line)
    else out.unexplained.push(line)
  }
  return out
}

