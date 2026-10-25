/**
 * Helpers for record list pages (RecordList): filter options, filtering and sorting.
 * Pure functions, so they are tested without Nuxt (test/lists.test.ts).
 */
export interface ListOption {
  value: string
  label: string
}

export interface RecordColumn<T> {
  key: string
  label: string
  /** Sort value; a column without one can't be sorted. */
  sort?: (item: T) => string | number | undefined
  /** Classes for the header and cells, e.g. `hidden md:table-cell` to hide on narrow screens. */
  class?: string
}

export interface RecordFilter<T> {
  key: string
  label: string
  options: ListOption[]
  /** The record's value(s); a record matches when any of them is selected. */
  value: (item: T) => string | string[] | undefined
}

/**
 * The distinct values `value` takes across `items`, labelled and sorted by
 * label, or by their position in `order` when given.
 */
export function uniqueOptions<T>(items: T[], value: (item: T) => string | string[] | undefined, label: (value: string) => string = v => v, order?: string[]): ListOption[] {
  const values = [...new Set(items.flatMap(i => [value(i) ?? []].flat()).filter(v => v !== ''))]
  const options = values.map(v => ({ value: v, label: label(v) }))
  return order
    ? options.sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value))
    : options.sort((a, b) => a.label.localeCompare(b.label))
}

/** Records matching the search text (case-insensitive, on `text`) and every filter with a selection. */
export function filterRecords<T>(items: T[], search: string, text: (item: T) => string, filters: RecordFilter<T>[], selected: Record<string, string[]>): T[] {
  const needle = search.trim().toLowerCase()
  return items.filter((item) => {
    if (needle && !text(item).toLowerCase().includes(needle)) return false
    return filters.every((f) => {
      const chosen = selected[f.key]
      if (!chosen?.length) return true
      const values = [f.value(item) ?? []].flat()
      return values.some(v => chosen.includes(v))
    })
  })
}

/** Sorted copy; ties keep a stable order by `tieBreak` (the record name or id). */
export function sortRecords<T>(items: T[], value: (item: T) => string | number | undefined, desc: boolean, tieBreak: (item: T) => string): T[] {
  const dir = desc ? -1 : 1
  const norm = (v: string | number | undefined) => (typeof v === 'string' ? v.toUpperCase() : v)
  return [...items].sort((a, b) => {
    const av = norm(value(a))
    const bv = norm(value(b))
    if (av === bv || av === undefined || bv === undefined) {
      if (av === undefined && bv !== undefined) return 1
      if (bv === undefined && av !== undefined) return -1
      return tieBreak(a).localeCompare(tieBreak(b))
    }
    return (av < bv ? -1 : 1) * dir
  })
}
