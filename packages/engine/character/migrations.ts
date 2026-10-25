import { CHARACTER_VERSION } from './schema'

/**
 * Model migrations: `MIGRATIONS[n]` turns a version-n character into version n+1.
 * A saved character is upgraded step by step to `CHARACTER_VERSION` when read.
 * Version 1 is the first model; there are no steps yet. A step must be pure and
 * re-runnable (the same input gives the same output).
 */
type Raw = Record<string, unknown>
export type ModelMigration = (character: Raw) => Raw

export const MIGRATIONS: Record<number, ModelMigration> = {}

export function upgradeCharacter(character: Raw, steps: Record<number, ModelMigration> = MIGRATIONS, target = CHARACTER_VERSION): Raw {
  let out = character
  let version = out.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new Error(`character has no model version (got ${JSON.stringify(version)})`)
  if (version > target) throw new Error(`character is version ${version}, newer than this engine (${target})`)
  while (version < target) {
    const step = steps[version]
    if (!step) throw new Error(`no migration from character version ${version}`)
    out = { ...step(structuredClone(out)), version: version + 1 }
    version += 1
  }
  return out
}
