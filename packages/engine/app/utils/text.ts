/**
 * Plain text from HTML or markdown, for tooltips and for HTML a player wrote (custom
 * features from the old sheet's editor). A shared sheet shows another player's text,
 * so it is never rendered as HTML.
 */
export function htmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
