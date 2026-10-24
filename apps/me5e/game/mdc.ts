/**
 * Rewrites the legacy Vue tags embedded in ME5e prose into MDC inline components,
 * so Nuxt Content can render today's files unchanged:
 *
 *   <me-distance length="30" abbr />            →  :distance{length="30" abbr}
 *   <me-condition id="primed" sub="necrotic"/>  →  :condition{id="primed" sub="necrotic"}
 *
 * The same function can later rewrite the files for real (Phase 1 "convert embedded Vue tags").
 */
const TAGS: Record<string, string> = {
  'me-distance': 'distance',
  'me-condition': 'condition',
}

const TAG = new RegExp(`<(${Object.keys(TAGS).join('|')})\\b([^>]*)>(?:\\s*</\\1>)?`, 'g')

export function legacyTagsToMdc(markdown: string): string {
  return markdown.replace(TAG, (_, tag: string, attrs: string) => {
    const props = attrs.replace(/\/$/, '').trim().replace(/\s+/g, ' ')
    return `:${TAGS[tag]}${props ? `{${props}}` : ''}`
  })
}
