// The type of content.json, which resource.ts writes at deploy (git-ignored), so the
// handler type-checks without it.
declare const content: { collections: Record<string, Array<Record<string, unknown>>> }
export default content
