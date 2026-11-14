import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { Game } from '@omnibrew/engine/schemas'
import type { Gen1Homebrew } from './gen1'
import { convertHomebrew, type NewHomebrewRow } from './homebrew'

/**
 * Every Gen 1 homebrew row → the new Homebrew table, at once (plan/28 decision 1), so other
 * players' characters, uses and votes find their records before the authors sign in.
 * Re-runnable: a row already there is replaced only while its author hasn't claimed it
 * (`owner` still the Gen 1 username) and the Gen 1 row changed since; claimed rows are the
 * author's now. Gen 1 is only scanned, never written.
 */
type Records = Map<string, Map<string, Record<string, unknown>>>

export interface BulkSummary {
  rows: number
  written: number
  updated: number
  skipped: number
  byStatus: Record<string, number>
  /** Rows made private because they fail `validateRecord`, by their first error. */
  invalid: Record<string, number>
  lowered: number
  notes: Record<string, number>
}

export async function* scanAll<T>(db: DynamoDBDocumentClient, table: string): AsyncGenerator<T> {
  let start: Record<string, unknown> | undefined
  do {
    const page = await db.send(new ScanCommand({ TableName: table, ExclusiveStartKey: start }))
    for (const item of page.Items ?? []) yield item as T
    start = page.LastEvaluatedKey
  } while (start)
}

/** A message without its specifics (ids, values), to count alike errors together. */
export const issueKind = (message: string) => message.replaceAll(/"[^"]*"/g, '"…"').replaceAll(/\d+/g, 'n').slice(0, 120)

export function summarize(rows: NewHomebrewRow[], summary: BulkSummary = { rows: 0, written: 0, updated: 0, skipped: 0, byStatus: {}, invalid: {}, lowered: 0, notes: {} }) {
  for (const row of rows) {
    summary.rows++
    summary.byStatus[row.status] = (summary.byStatus[row.status] ?? 0) + 1
    const first = row.migration.issues?.[0]
    if (first) summary.invalid[issueKind(first.message)] = (summary.invalid[issueKind(first.message)] ?? 0) + 1
    if (row.migration.status) summary.lowered++
    for (const n of row.migration.notes ?? []) summary.notes[n.split(':')[0]!] = (summary.notes[n.split(':')[0]!] ?? 0) + 1
  }
  return summary
}

export async function bulkConvertHomebrew(opts: { db: DynamoDBDocumentClient, gen1Table: string, newTable: string, game: Game, records: Records, write: boolean }): Promise<BulkSummary> {
  const converted: NewHomebrewRow[] = []
  const summary: BulkSummary = { rows: 0, written: 0, updated: 0, skipped: 0, byStatus: {}, invalid: {}, lowered: 0, notes: {} }
  for await (const old of scanAll<Gen1Homebrew>(opts.db, opts.gen1Table)) {
    const row = convertHomebrew(opts.game, opts.records, old)
    converted.push(row)
    if (!opts.write) continue
    const there = (await opts.db.send(new GetCommand({ TableName: opts.newTable, Key: { id: row.id } }))).Item as (NewHomebrewRow & { migration?: { from?: string | null } }) | undefined
    if (there && (there.owner !== old.owner || (there.migration?.from ?? '') >= (old.updatedAt ?? ''))) {
      summary.skipped++
      continue
    }
    await opts.db.send(new PutCommand({
      TableName: opts.newTable,
      Item: { __typename: 'Homebrew', ...row },
      // Never over a row its author claimed meanwhile.
      ...(there ? { ConditionExpression: '#o = :old', ExpressionAttributeNames: { '#o': 'owner' }, ExpressionAttributeValues: { ':old': old.owner } } : { ConditionExpression: 'attribute_not_exists(id)' }),
    }))
    if (there) summary.updated++
    else summary.written++
  }
  return summarize(converted, summary)
}
