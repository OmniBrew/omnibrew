import { util } from '@aws-appsync/utils'

/**
 * Second step of setHomebrewUse / setHomebrewVote (replaces the Gen 1 tallies Lambda):
 * adds or removes the caller's use/vote row and moves the homebrew's count in one
 * transaction. The row id `<sub>#<homebrewId>` makes it idempotent: a repeated call
 * fails the row's condition, cancels the transaction and changes nothing.
 */
export function request(ctx) {
  const vote = ctx.info.fieldName === 'setHomebrewVote'
  const homebrew = ctx.stash.homebrew
  const sub = ctx.identity.sub
  const mine = ownerSub(homebrew.owner) === sub || ownerSub(homebrew.owner) === ctx.identity.username
  if (homebrew.status === 'private' && !mine) util.unauthorized()
  if (vote && (mine || homebrew.status !== 'published')) {
    util.error('Only published homebrew by someone else can be voted for', 'InvalidVote')
  }

  const active = ctx.args.active
  const table = tableName(ctx, vote ? 'HomebrewVote' : 'HomebrewUse')
  const key = util.dynamodb.toMapValues({ id: `${sub}#${homebrew.id}` })
  const now = util.time.nowISO8601()
  const row = active
    ? {
        table,
        operation: 'PutItem',
        key,
        attributeValues: util.dynamodb.toMapValues({
          __typename: vote ? 'HomebrewVote' : 'HomebrewUse',
          owner: `${sub}::${ctx.identity.username}`,
          homebrewId: homebrew.id,
          createdAt: now,
          updatedAt: now,
        }),
        condition: { expression: 'attribute_not_exists(id)' },
      }
    : { table, operation: 'DeleteItem', key, condition: { expression: 'attribute_exists(id)' } }

  ctx.stash.vote = vote
  return {
    operation: 'TransactWriteItems',
    transactItems: [
      row,
      {
        table: tableName(ctx, 'Homebrew'),
        operation: 'UpdateItem',
        key: util.dynamodb.toMapValues({ id: homebrew.id }),
        update: {
          expression: 'SET #count = if_not_exists(#count, :zero) + :delta, #updatedAt = :now',
          expressionNames: { '#count': vote ? 'voteCount' : 'usageCount', '#updatedAt': 'updatedAt' },
          expressionValues: util.dynamodb.toMapValues({ ':zero': 0, ':delta': active ? 1 : -1, ':now': now }),
        },
        condition: { expression: 'attribute_exists(id)' },
      },
    ],
  }
}

export function response(ctx) {
  // A cancelled transaction means the row was already there (or already gone).
  const changed = !ctx.error
  if (ctx.error && ctx.error.type !== 'DynamoDB:TransactionCanceledException') util.error(ctx.error.message, ctx.error.type)
  const homebrew = ctx.stash.homebrew
  const delta = changed ? (ctx.args.active ? 1 : -1) : 0
  return {
    homebrewId: homebrew.id,
    usageCount: Math.max(0, (homebrew.usageCount ?? 0) + (ctx.stash.vote ? 0 : delta)),
    voteCount: Math.max(0, (homebrew.voteCount ?? 0) + (ctx.stash.vote ? delta : 0)),
    active: ctx.args.active,
  }
}

/** The owner's sub, from `<sub>::<username>` (a Gen 1 row may hold just one of them). */
function ownerSub(owner) {
  return owner ? owner.split('::')[0] : null
}

/**
 * A model's table, as Gen 2 names it: `<Model>-<api id>-NONE` on every deployment (the
 * stash's `amplifyApiEnvironmentName` is the branch, not part of table names).
 * `configureData` grants the same tables.
 */
function tableName(ctx, model) {
  return `${model}-${ctx.stash.awsAppsyncApiId}-NONE`
}
