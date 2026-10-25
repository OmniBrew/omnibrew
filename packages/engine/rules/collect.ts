import type { Choice } from '../character/schema'
import { mergeDeep } from '../schemas/primitives'
import type { Sheet } from './sheet'
import type { Mech, MechanicSource, Rec } from './types'

/**
 * Collects a character's mechanics, as the live site's INIT_MECHANICS did:
 * 1. every source (species and traits, classes, background, game sources,
 *    equipment) lists its mechanics under a path;
 * 2. a choice mechanic (`options: true`) is replaced by what the character
 *    picked for it (`choices`, by path); picked records add their own
 *    mechanics under `<path>/<model>/<id>`, recursively;
 * 3. `augment` mechanics merge into the mechanics they name;
 * 4. toggles that are on add their `whenOn` mechanics (and the picked option's);
 * 5. augments apply once more, to the toggled mechanics.
 * Choices nothing asked for are returned as `unused` (auto-learned power advancements read them).
 */
export interface Collected {
  mechanics: Mech[]
  unused: Choice[]
}

/** Choice values as mechanics, the shape the live site stored them in (`{ type: 'skill', value }`). */
export function choiceMechanics(key: string, choice: Choice, model: boolean): Rec[] {
  return choice.values.map((v) => {
    if (typeof v === 'object' && 'ability' in v) return { type: 'asi', ability: v.ability, amount: v.amount }
    if (typeof v === 'object' && 'power' in v) return { type: 'advancement', value: v.advancement, id: v.power }
    if (model) return { type: key, value: v }
    switch (key) {
      case 'skill': return { type: 'skill', value: v, expertise: false }
      case 'expertise': return { type: 'skill', value: v, expertise: true }
      case 'tool': return { type: 'tool', value: v }
      case 'weapon': return { type: 'weapon', value: v }
      default: return { type: key, value: v }
    }
  })
}

export function collectMechanics(sheet: Sheet, sources: MechanicSource[]): Collected {
  const remaining = sheet.character.choices.slice()

  const hydrateChoice = (model: string, choice: Choice, path: string, append: Rec): Mech[] => {
    const base = choiceMechanics(model, choice, true).map(i => ({ ...i, ...append, source: path }) as Mech)
    const ids = choice.values.filter((v): v is string => typeof v === 'string')
    const nested: Mech[] = []
    for (const rec of sheet.content.list(model).filter(r => ids.includes(r.id))) {
      nested.push(...hydrate(rec.mechanics, `${path}/${model}/${rec.id}`))
      // A picked species brings its traits (Exalted Lineage-style picks).
      if (model === 'species') {
        for (const trait of sheet.content.list('traits').filter(t => t.species?.includes(rec.id))) {
          nested.push(...hydrate(trait.mechanics, `${path}/${model}/${rec.id}/${trait.id}`))
        }
      }
    }
    return [...base, ...nested]
  }

  const hydrate = (mechanics: Rec[] | undefined, path: string): Mech[] => {
    const out: Mech[] = []
    for (const m of mechanics ?? []) {
      if (!m.options) {
        out.push({ ...m, source: path } as Mech)
        continue
      }
      const key = sheet.choiceKey(m as Mech)
      const at = remaining.findIndex(s => s.path === `${path}/${key}`)
      if (at < 0) continue
      const [choice] = remaining.splice(at, 1)
      if (m.type === 'model-choice') out.push(...hydrateChoice(key, choice!, path, m.append ?? {}))
      // A casting-ability pick is read by the power section from the choice itself.
      else if (!key.startsWith('powercasting')) out.push(...choiceMechanics(key, choice!, false).map(i => ({ ...i, source: path }) as Mech))
    }
    return out
  }

  const preAugment: Mech[] = []
  for (const s of structuredClone(sources)) preAugment.push(...hydrate(s.mechanics, s.path))
  const preToggle = applyAugments(preAugment)

  const toggles = sheet.character.state.toggles
  for (const { toggle } of preToggle.filter(i => i.toggle)) {
    if (!toggles[toggle.id]) continue
    if (toggle.whenOn) preToggle.push(...(toggle.whenOn as Rec[]).filter(i => i.type !== 'resource').map(i => ({ ...i, toggleId: toggle.id }) as Mech))
    if (toggle.options) {
      const picked = toggles[`${toggle.id}-selection`]
      const option = toggle.options.find((o: Rec) => o.id === picked) ?? toggle.options[0]
      if (option?.whenOn) preToggle.push(...(option.whenOn as Rec[]).filter(i => i.type && i.type !== 'resource').map(i => ({ ...i, toggleId: toggle.id }) as Mech))
    }
  }
  return { mechanics: applyAugments(preToggle), unused: remaining }
}

/**
 * `augment` mechanics deep-merge `merge` into the mechanics of the record they
 * name (`value.model`/`value.id`, matched against each mechanic's source path),
 * optionally only mechanic types in `value.limit` and the n-th matches in `value.instances`.
 */
export function applyAugments(mechanics: Mech[]): Mech[] {
  const augments = mechanics.filter(i => i.type === 'augment')
  const others = mechanics.filter(i => i.type !== 'augment')
  for (const augment of augments) {
    if (!augment.merge || !augment.value) continue
    let match = -1
    for (const [index, target] of others.entries()) {
      if (!target.source?.includes(`${augment.value.model}/${augment.value.id}`)) continue
      if (augment.value.limit && !augment.value.limit.includes(target.type)) continue
      match += 1
      if (augment.value.instances && !augment.value.instances.includes(match)) continue
      others.splice(index, 1, mergeDeep(structuredClone(target), augment.merge) as Mech)
    }
  }
  return others
}
