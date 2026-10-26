/**
 * Sheet colors: which of the game theme's accents a character sheet uses. The
 * sheet sets it as `data-accent` on <html> (useSheetAccent), and the game's CSS
 * swaps the primary palette for it. Pure, so it is tested without Nuxt
 * (test/accent.test.ts).
 */
export interface SheetTheme {
  /** The accents the game's CSS defines (`data-accent` values). */
  accents: string[]
  /** The accent when the character has neither a pick nor a class with an accent. */
  defaultAccent: string
}

/**
 * The player's pick (`sheetColor`) when the theme has it, else the first class's
 * id when that is an accent ("Match my class"), else the theme's default.
 * Undefined when the theme has no accents: the sheet keeps the site's primary.
 */
export function sheetAccent(character: { sheetColor?: string, classes?: { id: string }[] }, theme: SheetTheme): string | undefined {
  if (!theme.accents.length) return undefined
  const known = (id?: string) => (id && theme.accents.includes(id) ? id : undefined)
  return known(character.sheetColor) ?? known(character.classes?.[0]?.id) ?? known(theme.defaultAccent) ?? theme.accents[0]
}
