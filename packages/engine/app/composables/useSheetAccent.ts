import type { MaybeRefOrGetter } from 'vue'
import type { SheetTheme } from '../utils/accent'

/**
 * Colors a character sheet: puts the character's accent (utils/accent.ts) on <html>
 * as `data-accent` while the calling page is open, so menus and modals teleported
 * to <body> take it too. Leaving the page removes it. Returns the accent.
 */
export function useSheetAccent(character: MaybeRefOrGetter<{ sheetColor?: string, classes?: { id: string }[] } | null | undefined>) {
  const { game } = useAppConfig()
  const accent = computed(() => {
    const c = toValue(character)
    return c ? sheetAccent(c, game.theme as SheetTheme) : undefined
  })
  useHead({ htmlAttrs: { 'data-accent': accent } })
  return accent
}
