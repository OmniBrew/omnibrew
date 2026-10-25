/**
 * ME5e changelog conventions: entries are named after the version they
 * describe (`1-4-4` is v1.4.4), and the April Fools' posts stay off the list.
 */
interface Entry { stem: string, title?: string, date?: string | Date | null }

export const isJoke = (id: string) => id.startsWith('april')

/** The title of the newest release entry ("v1.4.4"), for the manual's title page. */
export function latestVersion(entries: Entry[]): string {
  const releases = entries.filter(e => /^\d+-\d+-\d+/.test(e.stem.split('/').pop() ?? ''))
  const time = (e: Entry) => (e.date ? new Date(e.date).getTime() : 0)
  const newest = releases.sort((a, b) => time(b) - time(a) || b.stem.localeCompare(a.stem))[0]
  return newest?.title ?? ''
}
