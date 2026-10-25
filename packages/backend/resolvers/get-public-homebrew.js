import { util } from '@aws-appsync/utils'

/** getPublicHomebrew(id): a homebrew that isn't private, or null. */
export function request(ctx) {
  return { operation: 'GetItem', key: util.dynamodb.toMapValues({ id: ctx.args.id }) }
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type)
  return toPublic(ctx.result)
}

// What other users may see of a homebrew row (the same in both public resolvers;
// APPSYNC_JS can't import local files).
function toPublic(item) {
  if (!item || item.status === 'private') return null
  return {
    id: item.id,
    authorId: item.owner ? item.owner.split('::')[0] : null,
    kind: item.kind,
    title: item.title,
    slug: item.slug,
    data: item.data,
    status: item.status,
    official: item.official ?? false,
    usageCount: item.usageCount ?? 0,
    voteCount: item.voteCount ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}
