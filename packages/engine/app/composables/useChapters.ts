import type { Chapter } from '../types/site'

/**
 * Chapters of a navigation file in the content repo (`manual` →
 * content/navigation/manual.yml): `{ id, title, sections }`, where `title` is an
 * i18n key and sections nest. Game apps define a `navigation` data collection
 * over content/navigation (see apps/me5e/content.config.ts).
 */
export function useChapters(name: string) {
  return useAsyncData(`chapters:${name}`, async () => {
    const files = await queryCollection('navigation').all()
    const file = files.find(f => f.stem.split('/').pop() === name)
    return (file?.chapters ?? []) as Chapter[]
  }, { default: () => [] as Chapter[] })
}

/** The leaf section ids of a chapter, in reading order. */
export function chapterSections(chapter: Chapter): string[] {
  return (chapter.sections ?? []).flatMap(s => (s.sections?.length ? chapterSections(s) : [s.id]))
}
