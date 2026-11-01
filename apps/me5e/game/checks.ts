import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GameCheckContext } from '@omnibrew/engine/schemas'
import { walkMechanics } from '@omnibrew/engine/validator'
import { parse } from 'yaml'

/** ME5e's content checks (Node only: they read the navigation files). */
export function meChecks({ root, records, report }: GameCheckContext) {
  // A power advancement choice can name the power whose advancements it offers.
  for (const [collection, recs] of records) {
    for (const [id, rec] of recs) {
      walkMechanics(rec, (m, path) => {
        const value = m.type === 'me:advancements-choice' ? (m.limit as { value?: unknown } | undefined)?.value : undefined
        if (typeof value === 'string' && !records.get('powers')?.has(value)) {
          report({ severity: 'error', category: 'reference', collection, id, rule: 'ref-missing', message: `${path}.limit.value: "${value}" is not a powers id` })
        }
      })
    }
  }

  // Manual and guide chapters are listed in navigation files; every leaf needs a page and every page an entry.
  for (const [index, collection] of [['content/navigation/manual.yml', 'manual'], ['content/navigation/guide.yml', 'guide']] as const) {
    const path = join(root, index)
    if (!existsSync(path)) {
      report({ severity: 'error', category: 'reference', collection, file: index, rule: 'navigation-missing', message: `${index} does not exist` })
      continue
    }
    const tree = (parse(readFileSync(path, 'utf8')) as { chapters?: unknown[] } | null)?.chapters ?? []
    const leaves: string[] = []
    const all: string[] = []
    const walk = (nodes: unknown[]) => {
      for (const n of nodes as Array<{ id: string, sections?: unknown[] }>) {
        all.push(n.id)
        if (n.sections?.length) walk(n.sections)
        else leaves.push(n.id)
      }
    }
    walk(tree)
    const pages = records.get(collection) ?? new Map()
    for (const id of leaves) {
      if (!pages.has(id)) report({ severity: 'error', category: 'reference', collection, id, file: index, rule: 'index-entry-missing-page', message: `${index} lists "${id}" but content/${collection}/${id}.md does not exist` })
    }
    for (const id of pages.keys()) {
      if (!all.includes(id)) report({ severity: 'warning', category: 'reference', collection, id, rule: 'page-not-in-index', message: `page is not listed in ${index}, so the site never links to it` })
    }
  }
}
