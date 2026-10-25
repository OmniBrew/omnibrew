import { util } from '@aws-appsync/utils'

/** listPublicHomebrew(kind, status, limit, nextToken): published (default) or in-development homebrew of a kind. */
export function request(ctx) {
  const status = ctx.args.status ?? 'published'
  if (status === 'private') util.unauthorized()
  return {
    operation: 'Query',
    index: 'byKind',
    query: {
      expression: '#kind = :kind AND #status = :status',
      expressionNames: { '#kind': 'kind', '#status': 'status' },
      expressionValues: util.dynamodb.toMapValues({ ':kind': ctx.args.kind, ':status': status }),
    },
    limit: Math.min(ctx.args.limit ?? 100, 100),
    nextToken: ctx.args.nextToken,
  }
}

export function response(ctx) {
  if (ctx.error) util.error(ctx.error.message, ctx.error.type)
  return {
    items: ctx.result.items.map(toPublic).filter(item => item !== null),
    nextToken: ctx.result.nextToken,
  }
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
