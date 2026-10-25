import { runtime, util } from '@aws-appsync/utils'

/**
 * ensureProfile, step 2: create the caller's profile (id = their sub) unless step 1
 * (load-profile.js) found it. A conditional put, so it never overwrites a profile and
 * no one can create one under someone else's id.
 */
export function request(ctx) {
  if (ctx.prev.result) runtime.earlyReturn(ctx.prev.result)
  const now = util.time.nowISO8601()
  return {
    operation: 'PutItem',
    key: util.dynamodb.toMapValues({ id: ctx.identity.sub }),
    attributeValues: util.dynamodb.toMapValues({
      __typename: 'Profile',
      owner: `${ctx.identity.sub}::${ctx.identity.username}`,
      maxCharacters: 50,
      createdAt: now,
      updatedAt: now,
    }),
    condition: { expression: 'attribute_not_exists(id)' },
  }
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type)
  return ctx.result
}
