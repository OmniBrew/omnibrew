import { validateRecord } from '@omnibrew/engine/validator/record'
import type { HomebrewIssue } from '@omnibrew/engine/data'

/** `casting[0].range.short` → `casting.0.range.short`, the editor's field paths. */
export const dotPath = (path: string | undefined) => (path ?? '').replaceAll(/\[(\d+)\]/g, '.$1').replace(/^\./, '')

/**
 * Checks homebrew as the editor and the data layer need it (plan/26 §1.3): `validateRecord`
 * against content plus the player's collection. `check` gives errors only (what blocks
 * sharing); `byPath` groups messages by the editor's field paths.
 */
export function useHomebrewValidation() {
  const hb = useHomebrewRules()

  async function check(kind: string, data: Record<string, unknown>, id: string): Promise<HomebrewIssue[]> {
    await hb.load()
    if (!hb.game || !hb.records) return [{ message: 'rules not loaded' }]
    const { body, ...rest } = data
    const record = { ...rest, ...(typeof body === 'string' && body ? { body } : {}), id }
    return validateRecord(hb.game, kind, record, hb.records)
      .filter(i => i.severity === 'error')
      .map(i => ({ path: dotPath(i.path), message: i.message }))
  }

  function byPath(issues: HomebrewIssue[]): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const i of issues) (out[i.path ?? ''] ??= []).push(i.message)
    return out
  }

  return { check, byPath }
}
