/**
 * The Gen 1 migration's tools (plan/28), run from omnibrew/ with `corepack pnpm tsx`:
 *
 *   apps/me5e/migrate/gen1-cli.ts scan --out <dir>            read-only copy of the six Gen 1 tables
 *                                                              and the picture keys (outside every repo)
 *   apps/me5e/migrate/gen1-cli.ts dry-run --from <dir> [--out <file>]
 *                                                              every user's migration, offline: counts only
 *   apps/me5e/migrate/gen1-cli.ts homebrew --new-table <name> [--write]
 *                                                              every Gen 1 homebrew → the new table (decision 1);
 *                                                              without --write it only reports
 *
 * Options: --profile (default `default`), --region (us-east-1), --suffix (the Gen 1 tables'
 * `ftks2bjjx5clvpa3j7hk2danwi-production`), --bucket, --content (the content repo).
 * Gen 1 is only read (Scan, ListObjectsV2). Never commit what `scan` writes: it is real user data.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { bundleRecords, createRules, splitBundle } from '@omnibrew/engine/rules'
import { loadRecords } from '@omnibrew/engine/rules/load'
import { createGame } from '@omnibrew/engine/schemas'
import { me5e } from '../game'
import { me5eDefinition } from '../game/definition'
import { contentRoot } from '../paths'
import { rulesBundleOptions } from '../rules-bundle'
import { GEN1_MODELS, type Gen1Bookmark, type Gen1Character, type Gen1Homebrew, type Gen1Profile, type Gen1Tally } from './gen1'
import { convertHomebrew } from './homebrew'
import { bulkConvertHomebrew, issueKind, scanAll, summarize } from './homebrew-bulk'
import { migrateUser, type ExistingHomebrew } from './user'

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    'out': { type: 'string' },
    'from': { type: 'string' },
    'new-table': { type: 'string' },
    'write': { type: 'boolean', default: false },
    'profile': { type: 'string', default: 'default' },
    'region': { type: 'string', default: 'us-east-1' },
    'suffix': { type: 'string', default: 'ftks2bjjx5clvpa3j7hk2danwi-production' },
    'bucket': { type: 'string', default: 'me5estorage194957-production' },
    'content': { type: 'string' },
  },
})
process.env.AWS_PROFILE = values.profile
process.env.AWS_REGION = values.region

/** The same records the Lambda gets (the rules bundle's, no prose). */
function content() {
  const { records } = loadRecords(values.content ?? contentRoot, me5e)
  const recs = bundleRecords(splitBundle(records, { ...rulesBundleOptions, keepBody: [] }))
  const game = createGame(me5eDefinition)
  return { game, records: recs, rules: createRules(game, recs) }
}

const db = () => DynamoDBDocumentClient.from(new DynamoDBClient({ region: values.region }))
const table = (model: string) => `${model}-${values.suffix}`

async function scan() {
  const out = values.out
  if (!out) throw new Error('--out <dir> (outside every repo)')
  mkdirSync(out, { recursive: true })
  const client = db()
  for (const model of GEN1_MODELS) {
    const rows: unknown[] = []
    for await (const item of scanAll(client, table(model))) rows.push(item)
    writeFileSync(join(out, `${model}.json`), JSON.stringify(rows))
    console.info(`${model}: ${rows.length}`)
  }
  const keys: string[] = []
  const s3 = new S3Client({ region: values.region })
  let token: string | undefined
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: values.bucket, Prefix: 'public/', ContinuationToken: token }))
    keys.push(...(page.Contents ?? []).map(o => o.Key!))
    token = page.NextContinuationToken
  } while (token)
  writeFileSync(join(out, 'pictures.json'), JSON.stringify(keys))
  console.info(`pictures: ${keys.length}`)
}

const inc = (o: Record<string, number>, k: string, n = 1) => (o[k] = (o[k] ?? 0) + n)

async function dryRun() {
  const dir = values.from
  if (!dir) throw new Error('--from <dir> (what `scan` wrote)')
  const read = <T>(model: string) => JSON.parse(readFileSync(join(dir, `${model}.json`), 'utf8')) as T[]
  const profiles = read<Gen1Profile>('Profile')
  const characters = read<Gen1Character>('Character')
  const bookmarks = read<Gen1Bookmark>('Bookmark')
  const homebrew = read<Gen1Homebrew>('Homebrew')
  const uses = read<Gen1Tally>('HomebrewUse')
  const votes = read<Gen1Tally>('HomebrewVote')
  const pictures = new Set(JSON.parse(readFileSync(join(dir, 'pictures.json'), 'utf8')) as string[])
  const { game, records, rules } = content()

  // Decision 1: every homebrew converted first, as the bulk run does.
  const converted = homebrew.map(h => convertHomebrew(game, records, h))
  const bulk = summarize(converted)
  const brew = new Map<string, ExistingHomebrew>(converted.map(h => [h.id, { id: h.id, owner: h.owner, kind: h.kind, title: h.title, data: h.data, updatedAt: h.updatedAt, migration: h.migration }]))

  const group = <T extends { owner: string }>(rows: T[]) => {
    const m = new Map<string, T[]>()
    for (const r of rows) m.set(r.owner, [...m.get(r.owner) ?? [], r])
    return m
  }
  const byOwner = { characters: group(characters), bookmarks: group(bookmarks), homebrew: group(homebrew), uses: group(uses), votes: group(votes) }
  const profileById = new Map(profiles.map(p => [p.id, p]))
  const users = new Set([...profileById.keys(), ...byOwner.characters.keys(), ...byOwner.bookmarks.keys(), ...byOwner.homebrew.keys()])

  const s = {
    users: users.size, withoutProfile: 0,
    characters: { total: characters.length, migrated: 0, failed: 0, failedBy: {} as Record<string, number>, unknownIds: 0, renamed: 0, dropped: 0, withHomebrew: 0, missingHomebrew: 0 },
    bookmarks: { total: bookmarks.length, migrated: 0, dropped: 0, byType: {} as Record<string, number> },
    homebrew: { ...bulk, claimedLater: 0 },
    uses: { total: uses.length, migrated: 0 }, votes: { total: votes.length, migrated: 0 },
    profile: { names: 0, preferences: 0, webhooks: 0, webhookUsers: 0, pictures: 0, picturesMissing: 0 },
    overLimit: { users: 0, raisedTo: {} as Record<string, number> },
    largest: { characters: 0, bookmarks: 0 },
    ms: { total: 0, slowestUser: 0 },
  }
  const unknownIds: Record<string, number> = {}
  let n = 0
  for (const username of users) {
    const gen1 = {
      profile: profileById.get(username) ?? null,
      characters: byOwner.characters.get(username) ?? [],
      bookmarks: byOwner.bookmarks.get(username) ?? [],
      homebrew: byOwner.homebrew.get(username) ?? [],
      uses: byOwner.uses.get(username) ?? [],
      votes: byOwner.votes.get(username) ?? [],
    }
    if (!gen1.profile) s.withoutProfile++
    const t0 = performance.now()
    const m = migrateUser({
      game, content: rules.content, records, caller: { sub: `sub-${n}`, username }, gen1,
      existing: { profile: { maxCharacters: 50 }, characterIds: new Set(), characterCount: 0, bookmarkKeys: new Set(), useIds: new Set(), voteIds: new Set() },
      homebrew: brew, authorName: () => null, now: new Date().toISOString(), newId: () => `id-${n++}`,
    })
    const ms = performance.now() - t0
    s.ms.total += ms
    s.ms.slowestUser = Math.max(s.ms.slowestUser, Math.round(ms))
    s.characters.migrated += m.report.characters.migrated
    s.characters.failed += m.report.characters.failed.length
    for (const f of m.report.characters.failed) inc(s.characters.failedBy, issueKind(f.message))
    for (const c of m.characters) {
      const r = c.migration as { unknown: Array<{ collection?: string, id?: string }>, renamed: unknown[], dropped: unknown[], homebrew: unknown[] }
      s.characters.unknownIds += r.unknown.length
      for (const u of r.unknown) inc(unknownIds, `${u.collection}:${u.id}`)
      s.characters.renamed += r.renamed.length
      s.characters.dropped += r.dropped.length
      if (r.homebrew.length) s.characters.withHomebrew++
    }
    s.characters.missingHomebrew += m.report.missingHomebrew.length
    s.bookmarks.migrated += m.bookmarks.length
    s.bookmarks.dropped += m.report.bookmarks.dropped
    for (const b of m.bookmarks) inc(s.bookmarks.byType, b.type)
    s.homebrew.claimedLater += m.claims.length
    s.uses.migrated += m.uses.length
    s.votes.migrated += m.votes.length
    if (m.profile.username) s.profile.names++
    if (m.profile.preferences) s.profile.preferences++
    if (m.profile.webhooks?.length) {
      s.profile.webhookUsers++
      s.profile.webhooks += m.profile.webhooks.length
    }
    if (m.picture) {
      if (pictures.has(m.picture)) s.profile.pictures++
      else s.profile.picturesMissing++
    }
    if (m.report.maxCharacters) {
      s.overLimit.users++
      inc(s.overLimit.raisedTo, String(m.report.maxCharacters))
    }
    s.largest.characters = Math.max(s.largest.characters, gen1.characters.length)
    s.largest.bookmarks = Math.max(s.largest.bookmarks, gen1.bookmarks.length)
  }
  s.ms.total = Math.round(s.ms.total)
  // Ids only content-side (collection:id), never user text.
  const top = Object.entries(unknownIds).sort((a, b) => b[1] - a[1]).slice(0, 25)
  const report = JSON.stringify({ ...s, unknownIdsTop: Object.fromEntries(top) }, null, 2)
  if (values.out) writeFileSync(values.out, report)
  console.info(report)
}

async function homebrew() {
  const newTable = values['new-table']
  if (!newTable) throw new Error('--new-table <Homebrew-<api id>-NONE>')
  const { game, records } = content()
  const summary = await bulkConvertHomebrew({ db: db(), gen1Table: table('Homebrew'), newTable, game, records, write: values.write })
  console.info(JSON.stringify(summary, null, 2))
}

const commands: Record<string, () => Promise<void>> = { 'scan': scan, 'dry-run': dryRun, 'homebrew': homebrew }
const command = commands[positionals[0] ?? '']
if (!command) {
  console.error('usage: gen1-cli.ts scan|dry-run|homebrew …')
  process.exit(1)
}
await command()
