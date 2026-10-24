import type { z } from 'zod'

export type Severity = 'error' | 'warning' | 'info'
export type Category = 'schema' | 'reference' | 'legacy' | 'prose' | 'backlog'

export interface Issue {
  severity: Severity
  category: Category
  collection: string
  id?: string
  file?: string
  /** Stable rule key used for grouping (`invalid_type`, `ref-missing`...). */
  rule: string
  message: string
  path?: string
}

type ZIssue = z.core.$ZodIssue & { params?: Record<string, unknown>, errors?: z.core.$ZodIssue[][] }

export function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)), '')
}

/**
 * Flattens zod issues into validator issues.
 * Union failures are unwrapped to the branch that got furthest, so `dc: { save: 'Special' }`
 * reports the bad `save` instead of "Invalid input".
 */
export function fromZod(issues: z.core.$ZodIssue[], base: Pick<Issue, 'collection' | 'id' | 'file'>, prefix: PropertyKey[] = []): Issue[] {
  const out: Issue[] = []
  for (const raw of issues as ZIssue[]) {
    const path = [...prefix, ...raw.path]
    const params = raw.params ?? {}
    // Unions arrive directly, or forwarded from a nested mechanic as custom issues.
    const branches = raw.errors ?? (params.rule === 'invalid_union' ? params.errors as z.core.$ZodIssue[][] | undefined : undefined)
    if (branches?.length) {
      const best = pickBranch(branches)
      if (best) {
        out.push(...fromZod(best, base, path))
        continue
      }
      out.push({ ...base, severity: 'error', category: 'schema', rule: 'invalid_value', message: describeAlternatives(branches), path: formatPath(path) || undefined })
      continue
    }
    const severity = (params.severity as Severity | undefined) ?? (raw.code === 'unrecognized_keys' ? 'warning' : 'error')
    const rule = (params.rule as string | undefined) ?? raw.code
    const category: Category = rule.includes('legacy') ? 'legacy' : 'schema'
    out.push({ ...base, severity, category, rule, message: raw.message, path: formatPath(path) || undefined })
  }
  return out
}

/** "expected one of a|b|c, or false" from a union where every branch failed at the root. */
function describeAlternatives(branches: z.core.$ZodIssue[][]): string {
  const values = new Set<string>()
  const types = new Set<string>()
  const visit = (issues: ZIssue[]) => {
    for (const i of issues) {
      const nested = i.errors ?? (i.params?.rule === 'invalid_union' ? i.params.errors as z.core.$ZodIssue[][] | undefined : undefined)
      if (nested) nested.forEach(b => visit(b as ZIssue[]))
      else if (i.code === 'invalid_value') (i as unknown as { values: unknown[] }).values.forEach(v => values.add(JSON.stringify(v)))
      else if (i.code === 'invalid_type') types.add((i as unknown as { expected: string }).expected)
      else {
        const m = i.message.match(/expected one of (.+)$/)
        if (m) m[1]!.split('|').forEach(v => values.add(v))
        else types.add(i.message)
      }
    }
  }
  branches.forEach(b => visit(b as ZIssue[]))
  const parts = [values.size ? `one of ${[...values].join('|')}` : '', ...types].filter(Boolean)
  return `Invalid value: expected ${parts.join(', or ')}`
}

function depth(issues: ZIssue[]): number {
  return Math.max(0, ...issues.map(i => i.path.length + (i.code === 'invalid_union' || i.params?.rule === 'invalid_union' ? 1 : 0)))
}

/** The branch whose issues sit deepest (it matched the shape best); ties go to fewer issues. */
function pickBranch(branches: z.core.$ZodIssue[][]): z.core.$ZodIssue[] | undefined {
  const scored = branches
    .map(b => ({ b, d: depth(b as ZIssue[]), n: b.length }))
    .filter(x => x.d > 0)
    .sort((x, y) => y.d - x.d || x.n - y.n)
  return scored[0]?.b
}
