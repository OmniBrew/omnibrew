import { util } from '@aws-appsync/utils'

/** First step of setHomebrewUse / setHomebrewVote: the homebrew, into the stash. */
export function request(ctx) {
  return { operation: 'GetItem', key: util.dynamodb.toMapValues({ id: ctx.args.homebrewId }) }
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type)
  if (!ctx.result) util.error('Homebrew not found', 'NotFound')
  ctx.stash.homebrew = ctx.result
  return ctx.result
}
