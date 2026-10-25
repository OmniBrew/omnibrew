import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFrontMatter, stringifyRecord, toCrlf } from '@omnibrew/engine/content'

/**
 * `{{ damage }}` texts that name the damage type (or the amount's unit) themselves
 * use `{{ roll }}` (dice and bonus only) instead, so the sheet doesn't print
 * "9 psychic damage psychic damage" (plan/04 Q15). Texts where the roll is the
 * whole phrase keep `{{ damage }}`. Re-runnable.
 *
 *   corepack pnpm tsx apps/me5e/migrate/placeholders-roll.ts ../omnibrew-me5e-data
 */
const ROLL: Array<[string, string]> = [['{{ damage }}', '{{ roll }}']]
const WHOLE_PHRASE: Array<[string, string]> = [['{{ damage }} damage .', '{{ damage }}.'], ['{{ damage }} damage', '{{ damage }}']]

export const EDITS: Record<string, Array<[string, string]>> = {
  'class-features/destructive-charging': ROLL,
  'class-features/exploit-excruciate': ROLL,
  'class-features/fearsome-reputation': ROLL,
  'class-features/fighting-spirit': ROLL,
  'class-features/tireless-spirit': ROLL,
  'class-features/steady-aim': ROLL,
  'class-features/tech-annihilation': ROLL,
  'class-features/tech-onslaught': ROLL,
  'class-features/vengeance': ROLL,
  'class-features/wont-quit': [['regenerate {{ damage }}.', 'regenerate {{ roll }} hit points.']],
  'edges/BMM_sweeping-attack': [['{{ damage }} force</strong>damage', '{{ roll }} force</strong> damage']],
  'edges/PRIME_fire': WHOLE_PHRASE,
  'edges/PRIME_force': WHOLE_PHRASE,
  'edges/PRIME_lightning': WHOLE_PHRASE,
  'edges/PRIME_necrotic': WHOLE_PHRASE,
  'edges/PRIME_radiant': WHOLE_PHRASE,
  // Weapon of Choice adds a die to a roll or to AC.
  'edges/WOC_assault-rifles': ROLL,
  'edges/WOC_heavy-pistols': ROLL,
  'edges/WOC_melee-weapons': ROLL,
  'edges/WOC_shotguns': ROLL,
  'edges/WOC_smgs': ROLL,
  'edges/WOC_sniper-rifles': ROLL,
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value)
  if (Array.isArray(value)) return value.map(v => mapStrings(v, fn))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]))
  return value
}

export function convert(root: string) {
  const changed: string[] = []
  for (const [rel, edits] of Object.entries(EDITS)) {
    const file = join(root, 'content', `${rel}.md`)
    const { attributes, body } = parseFrontMatter(readFileSync(file, 'utf8'))
    const next = mapStrings(attributes, s => edits.reduce((acc, [from, to]) => acc.replaceAll(from, to), s)) as Record<string, unknown>
    if (JSON.stringify(next) === JSON.stringify(attributes)) continue
    writeFileSync(file, toCrlf(stringifyRecord(next, body)))
    changed.push(rel)
  }
  return changed
}

if (process.argv[1]?.endsWith('placeholders-roll.ts')) {
  const changed = convert(resolve(process.argv[2] ?? '../omnibrew-me5e-data'))
  console.log(`${changed.length} records changed:\n${changed.join('\n')}`)
}
