/**
 * Field-level three-way merge of a record (plan/33 §1.7). When `master` changed a record
 * after a mod opened it, the mod's changes (base → mine) are replayed onto the current
 * record (theirs). Objects merge key by key; arrays, strings and the body are one value
 * each. A value both sides changed differently is a conflict: the merge keeps theirs
 * until the mod picks (`resolveConflicts`).
 */

type Obj = Record<string, unknown>
export type FieldPath = string[]

export interface MergeConflict {
  path: FieldPath
  base: unknown
  mine: unknown
  theirs: unknown
}

export interface MergeResult {
  merged: Obj
  conflicts: MergeConflict[]
}

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Date)

/** Structural equality of YAML values (key order ignored). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => sameValue(v, b[i]))
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter(k => a[k] !== undefined)
    const kb = Object.keys(b).filter(k => b[k] !== undefined)
    return ka.length === kb.length && ka.every(k => sameValue(a[k], b[k]))
  }
  return false
}

function mergeObj(base: Obj, mine: Obj, theirs: Obj, path: FieldPath, conflicts: MergeConflict[]): Obj {
  // Theirs' order first (master's file), then keys only the mod added, in the mod's order.
  const keys = [...new Set([...Object.keys(theirs), ...Object.keys(mine)])]
  const out: Obj = {}
  for (const key of keys) {
    const b = base[key]
    const m = mine[key]
    const t = theirs[key]
    let value: unknown
    if (sameValue(m, b)) value = t
    else if (sameValue(t, b) || sameValue(m, t)) value = m
    else if (isObj(b) && isObj(m) && isObj(t)) value = mergeObj(b, m, t, [...path, key], conflicts)
    else {
      conflicts.push({ path: [...path, key], base: b, mine: m, theirs: t })
      value = t
    }
    if (value !== undefined) out[key] = value
  }
  return out
}

/** Replays base → mine onto theirs. Records are plain objects (fields, `body` as one field). */
export function mergeRecords(base: Obj, mine: Obj, theirs: Obj): MergeResult {
  const conflicts: MergeConflict[] = []
  return { merged: mergeObj(base, mine, theirs, [], conflicts), conflicts }
}

/** The paths base → mine changed (what a mod's edit touched), deepest first per branch. */
export function changedPaths(base: Obj, mine: Obj, path: FieldPath = []): FieldPath[] {
  const out: FieldPath[] = []
  for (const key of new Set([...Object.keys(base), ...Object.keys(mine)])) {
    const b = base[key]
    const m = mine[key]
    if (sameValue(b, m)) continue
    if (isObj(b) && isObj(m)) out.push(...changedPaths(b, m, [...path, key]))
    else out.push([...path, key])
  }
  return out
}

function setPath(target: Obj, path: FieldPath, value: unknown) {
  let node = target
  for (const key of path.slice(0, -1)) {
    if (!isObj(node[key])) node[key] = {}
    node = node[key] as Obj
  }
  const last = path[path.length - 1]!
  if (value === undefined) Reflect.deleteProperty(node, last)
  else node[last] = value
}

/** Applies the mod's picks: `true` at a conflict's index takes mine, otherwise theirs stays. */
export function resolveConflicts(result: MergeResult, takeMine: boolean[]): Obj {
  const out = structuredClone(result.merged)
  result.conflicts.forEach((c, i) => {
    if (takeMine[i]) setPath(out, c.path, structuredClone(c.mine))
  })
  return out
}
