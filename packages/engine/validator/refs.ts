import type { Game } from '../schemas/game'
import type { Issue } from './issues'

/**
 * Cross-reference checks. Ids in content are plain strings, so nothing else
 * catches a typo like `omni-hamer` or a feature pointing at a deleted subclass.
 */
type Rec = Record<string, unknown>
type Records = Map<string, Map<string, Rec>>

interface FieldRef { collection: string, path: string, target: string[], when?: (parent: Rec) => boolean }

const ITEMS = ['weapons', 'armor', 'gear', 'mods']

const FIELD_REFS: FieldRef[] = [
  { collection: 'class-features', path: 'klass', target: ['classes'] },
  { collection: 'class-features', path: 'subclass', target: ['subclasses'] },
  { collection: 'subclasses', path: 'klass', target: ['classes'] },
  { collection: 'powers', path: 'classes[]', target: ['classes'] },
  { collection: 'powers', path: 'prerequisite', target: ['powers'] },
  { collection: 'traits', path: 'species[]', target: ['species'] },
  { collection: 'species', path: 'species', target: ['species'] },
  { collection: 'species', path: 'subspecies', target: ['subspecies'] },
  { collection: 'subspecies', path: 'species', target: ['species'] },
  { collection: 'classes', path: 'startingEquipment[].has[]', target: ITEMS },
  { collection: 'classes', path: 'startingEquipment[].choices.items[]', target: ITEMS },
  { collection: 'classes', path: 'profs.skill.has[]', target: ['skills'] },
  { collection: 'classes', path: 'profs.skill.choices.items[]', target: ['skills'] },
  { collection: 'classes', path: 'profs.tool.has[]', target: ['tool-profs'] },
  { collection: 'classes', path: 'profs.tool.choices.items[]', target: ['tool-profs'] },
  { collection: 'armor', path: 'set', target: ['set-bonuses'] },
  { collection: 'armor', path: 'properties[].id', target: ['armor-properties'] },
  { collection: 'weapons', path: 'properties[].id', target: ['weapon-properties'] },
  { collection: 'bestiary', path: 'entries.actions[].weaponId', target: ['weapons'] },
  { collection: 'bestiary', path: 'skills[]', target: ['skills'] },
  { collection: 'bestiary', path: 'irv.conImm[]', target: ['conditions'] },
  { collection: 'feats', path: 'prereq[].limit[]', target: ['species'], when: p => p.type === 'species' },
]

/** Old singular model names the legacy site tolerated. */
const SINGULAR: Record<string, string> = { edge: 'edges', mod: 'mods', trait: 'traits', power: 'powers', subclass: 'subclasses', weapon: 'weapons', feat: 'feats', class: 'classes' }

function isObj(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)
}

/** Resolves `a.b[].c` to every value found, with the concrete path and the parent object. */
export function select(obj: unknown, path: string): Array<{ value: unknown, path: string, parent: Rec }> {
  const parts = path.split('.')
  let cur: Array<{ value: unknown, path: string, parent: Rec }> = [{ value: obj, path: '', parent: {} }]
  for (const part of parts) {
    const many = part.endsWith('[]')
    const key = many ? part.slice(0, -2) : part
    const next: typeof cur = []
    for (const c of cur) {
      if (!isObj(c.value)) continue
      const v = c.value[key]
      const p = c.path ? `${c.path}.${key}` : key
      if (v === undefined || v === null || v === false) continue
      if (many) {
        if (Array.isArray(v)) v.forEach((x, i) => next.push({ value: x, path: `${p}[${i}]`, parent: c.value as Rec }))
      } else next.push({ value: v, path: p, parent: c.value as Rec })
    }
    cur = next
  }
  return cur
}

/** Visits every mechanic (any object with a string `type` inside a mechanics-like array), at any depth. */
export function walkMechanics(value: unknown, visit: (m: Rec, path: string) => void, path = '') {
  if (Array.isArray(value)) {
    value.forEach((v, i) => walkMechanics(v, visit, `${path}[${i}]`))
    return
  }
  if (!isObj(value)) return
  for (const [k, v] of Object.entries(value)) {
    const p = path ? `${path}.${k}` : k
    if (/^(?:mechanics|whenOn|whenOff)$/.test(k) && Array.isArray(v)) {
      v.forEach((m, i) => {
        if (isObj(m) && typeof m.type === 'string') visit(m, `${p}[${i}]`)
      })
    }
    walkMechanics(v, visit, p)
  }
}

export function checkReferences(game: Game, records: Records, files: Map<string, string | undefined>): Issue[] {
  const issues: Issue[] = []
  const has = (collection: string, id: string) => records.get(collection)?.has(id) ?? false
  const edgeTypes = new Set(game.enums.values.edgeTypes)
  const edgesOfType = (type: string) => [...(records.get('edges')?.values() ?? [])].filter(e => e.type === type)

  const report = (collection: string, id: string, path: string, rule: string, message: string, severity: Issue['severity'] = 'error') => {
    issues.push({ severity, category: 'reference', collection, id, file: files.get(`${collection}/${id}`), rule, message, path })
  }

  /** Where a `model` string points: a collection, an edge family, or (augments) a class's features. */
  const resolveModel = (model: string, collection: string, id: string, path: string): { ids: Set<string>, label: string } | undefined => {
    if (records.has(model)) return { ids: new Set(records.get(model)!.keys()), label: model }
    if (SINGULAR[model] && records.has(SINGULAR[model])) {
      report(collection, id, path, 'model-singular', `model "${model}" should be "${SINGULAR[model]}"`, 'warning')
      return { ids: new Set(records.get(SINGULAR[model]!)!.keys()), label: SINGULAR[model]! }
    }
    if (edgeTypes.has(model)) return { ids: new Set(edgesOfType(model).map(e => e.id as string)), label: `edges (type ${model})` }
    // Augments match on the source path, so `model` may also be the feature that made the choice (`tactical-focus`).
    if (has('class-features', model)) return undefined
    if (has('classes', model)) {
      const feats = [...(records.get('class-features')?.values() ?? [])].filter(f => f.klass === model)
      return { ids: new Set(feats.map(f => f.id as string)), label: `class-features of ${model}` }
    }
    if (game.def.sources[model] === undefined && !(game.enums.values.models ?? []).includes(model)) {
      report(collection, id, path, 'model-unknown', `model "${model}" is not a collection, edge family or class`)
    }
    return undefined
  }

  const refId = (collection: string, id: string, path: string, target: string[], value: unknown) => {
    if (typeof value !== 'string') return
    const known = target.filter(t => records.has(t))
    if (!known.length) return
    if (!known.some(t => has(t, value))) report(collection, id, path, 'ref-missing', `"${value}" is not a ${known.join(' / ')} id`)
  }

  const refModel = (collection: string, id: string, path: string, model: unknown, target: unknown) => {
    if (typeof model !== 'string') return
    const resolved = resolveModel(model, collection, id, `${path}.model`)
    if (resolved && typeof target === 'string' && !resolved.ids.has(target)) {
      report(collection, id, `${path}.id`, 'ref-missing', `"${target}" is not in ${resolved.label}`)
    }
  }

  for (const [collection, recs] of records) {
    for (const [id, rec] of recs) {
      for (const ref of FIELD_REFS.filter(r => r.collection === collection)) {
        for (const hit of select(rec, ref.path)) {
          if (ref.when && !ref.when(hit.parent)) continue
          refId(collection, id, hit.path, ref.target, hit.value)
        }
      }

      // A property marked `takesValue` needs a value (`reload 16`), and one marked false takes none.
      const propCollection = collection === 'weapons' ? 'weapon-properties' : collection === 'armor' ? 'armor-properties' : undefined
      if (propCollection && Array.isArray(rec.properties)) {
        rec.properties.forEach((p, i) => {
          if (!isObj(p) || typeof p.id !== 'string') return
          const def = records.get(propCollection)?.get(p.id)
          if (def && typeof def.takesValue === 'boolean' && def.takesValue !== (p.value !== undefined)) {
            report(collection, id, `properties[${i}]`, 'property-value', `property "${p.id}" ${def.takesValue ? 'needs a value' : 'takes no value'}`)
          }
        })
      }

      walkMechanics(rec, (m, path) => {
        const more = m.moreInfo
        const moreRefs = Array.isArray(more) ? more : isObj(more) ? [more, ...([] as unknown[]).concat(more.additional ?? [])] : []
        moreRefs.forEach((r, i) => {
          if (isObj(r) && r.model) refModel(collection, id, `${path}.moreInfo${i ? `.additional[${i - 1}]` : ''}`, r.model, r.id)
        })
        for (const key of ['valueLookup', 'provider'] as const) {
          const v = m[key]
          if (isObj(v)) refModel(collection, id, `${path}.${key}`, v.model, v.id)
        }
        if (isObj(m.limit) && isObj(m.limit.valueLookup)) refModel(collection, id, `${path}.limit.valueLookup`, m.limit.valueLookup.model, m.limit.valueLookup.id)
        switch (m.type) {
          case 'model-choice': {
            if (typeof m.model !== 'string') break
            const resolved = resolveModel(m.model, collection, id, `${path}.model`)
            if (!resolved) break
            for (const [i, lim] of (Array.isArray(m.limits) ? m.limits : []).entries()) {
              if (!isObj(lim)) continue
              const values = ([] as unknown[]).concat(lim.value ?? [])
              if (lim.attr === 'id') values.forEach(v => typeof v === 'string' && !resolved.ids.has(v) && report(collection, id, `${path}.limits[${i}]`, 'ref-missing', `"${v}" is not in ${resolved.label}`))
              if (lim.attr === 'classes') values.forEach(v => refId(collection, id, `${path}.limits[${i}]`, ['classes'], v))
              if (lim.attr === 'species') values.forEach(v => refId(collection, id, `${path}.limits[${i}]`, ['species'], v))
            }
            for (const v of Array.isArray(m.set) ? m.set : []) {
              if (typeof v === 'string' && !resolved.ids.has(v)) report(collection, id, `${path}.set`, 'ref-missing', `"${v}" is not in ${resolved.label}`)
            }
            if (m.limit !== undefined) report(collection, id, `${path}.limit`, 'choice-limit-drift', 'model-choice uses `limit`; the builder only reads `limits`', 'warning')
            break
          }
          case 'augment':
            if (isObj(m.value)) refModel(collection, id, `${path}.value`, m.value.model, m.value.id)
            break
          case 'powers':
            refId(collection, id, `${path}.value`, ['powers'], m.value)
            refId(collection, id, `${path}.klass`, ['classes'], m.klass)
            break
          case 'skill':
          case 'skill-or-expertise':
          case 'passive':
            for (const v of ([] as unknown[]).concat(m.value ?? [])) refId(collection, id, `${path}.value`, ['skills'], v)
            break
          case 'skill-choice':
          case 'expertise-choice':
            for (const v of Array.isArray(m.limit) ? m.limit : []) refId(collection, id, `${path}.limit`, ['skills'], v)
            break
          case 'tool':
            refId(collection, id, `${path}.value`, ['tool-profs'], m.value)
            break
          case 'tool-choice':
            for (const v of ([] as unknown[]).concat(m.limit ?? [])) {
              if (typeof v === 'string' && !(game.enums.values.toolTypes ?? []).includes(v)) refId(collection, id, `${path}.limit`, ['tool-profs'], v)
            }
            break
          case 'condition-immunity':
            refId(collection, id, `${path}.value`, ['conditions'], m.value)
            break
          case 'saving-throw':
            for (const v of ([] as unknown[]).concat(m.against ?? [])) refId(collection, id, `${path}.against`, ['conditions'], v)
            break
          case 'adjust-weapon-props':
            for (const key of ['add', 'remove']) for (const v of ([] as unknown[]).concat(m[key] ?? [])) refId(collection, id, `${path}.${key}`, ['weapon-properties'], v)
            break
          case 'use-class-for-power-list':
          case 'use-class-for-cantrip-list':
          case 'override-weapon-attack-mod':
            refId(collection, id, `${path}.klass`, ['classes'], m.klass)
            break
        }
      })
    }
  }
  return issues
}
