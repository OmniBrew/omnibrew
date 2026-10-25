import { util } from '@aws-appsync/utils'

/** ensureProfile, step 1: the caller's profile, if it exists. */
export function request(ctx) {
  return { operation: 'GetItem', key: util.dynamodb.toMapValues({ id: ctx.identity.sub }), consistentRead: true }
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type)
  return ctx.result ?? null
}
