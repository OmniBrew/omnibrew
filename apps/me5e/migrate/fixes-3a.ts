import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseFrontMatter, stringifyRecord, toCrlf } from '@omnibrew/engine/content'
import { walkMechanics } from '@omnibrew/engine/validator'

/**
 * Content fixes Phase 3a found (plan/04 Q16). Re-runnable.
 * - Power choices filtered on `attr: type`; powers have `powerType` since the content migration (plan/04 R6).
 * - VI Response's initiative bonus sat under `effect.value` (+0 on the live sheet).
 * - The Reckoner-Knight Armorsuit's reroll named melee weapons in `weaponTypes`, which nothing reads.
 * - `prof-choice` (never offered by the live builder) is the skill choice its text describes.
 * - Two power advancements changed `damage` as an object instead of the first roll (Nova's Improved Damage, Justice's Neutralise), so they never applied.
 *
 *   corepack pnpm tsx apps/me5e/migrate/fixes-3a.ts ../omnibrew-me5e-data
 */
type Rec = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- record front-matter

const FIXES: Array<(m: Rec) => void> = [
  (m) => {
    if (m.type !== 'model-choice' || m.model !== 'powers') return
    for (const l of m.limits ?? []) if (l.attr === 'type') l.attr = 'powerType'
  },
  (m) => {
    if (m.type === 'initiative' && m.effect?.type === 'bonus' && m.effect.value && !m.effect.bonus) {
      m.effect.bonus = m.effect.value
      delete m.effect.value
    }
  },
  (m) => {
    if (m.type === 'attack-augment' && m.attackLimit?.weaponTypes && !m.attackLimit.modelTypes) {
      m.attackLimit.modelTypes = m.attackLimit.weaponTypes
      delete m.attackLimit.weaponTypes
    }
  },
  (m) => {
    if (m.type === 'prof-choice') m.type = 'skill-choice'
  },
]

export function convert(root: string) {
  const changed: string[] = []
  const dir = join(root, 'content')
  for (const collection of readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)) {
    for (const name of readdirSync(join(dir, collection)).filter(f => f.endsWith('.md'))) {
      const file = join(dir, collection, name)
      const { attributes, body } = parseFrontMatter(readFileSync(file, 'utf8'))
      const next = structuredClone(attributes) as Rec
      walkMechanics(next, m => FIXES.forEach(fix => fix(m)))
      for (const adv of (next.advancements ?? []) as Rec[]) {
        for (const c of adv.casting ?? []) if (c?.damage && !Array.isArray(c.damage) && typeof c.damage === 'object') c.damage = [c.damage]
      }
      if (JSON.stringify(next) === JSON.stringify(attributes)) continue
      writeFileSync(file, toCrlf(stringifyRecord(next, body)))
      changed.push(`${collection}/${name}`)
    }
  }
  return changed
}

if (process.argv[1]?.endsWith('fixes-3a.ts')) {
  const changed = convert(resolve(process.argv[2] ?? '../omnibrew-me5e-data'))
  console.log(`${changed.length} records changed:\n${changed.join('\n')}`)
}
