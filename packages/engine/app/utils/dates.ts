/**
 * Dates on news-style records (changelog entries). Content dates are calendar
 * days (`2023-01-01`), so they're read and shown in UTC to avoid shifting a day.
 */
type Dated = { date?: string | Date | null }

const time = (d: Dated['date']) => (d ? new Date(d).getTime() : 0)

/** Newest first; undated records last, ties in `tieBreak` order. */
export function newestFirst<T extends Dated>(items: T[], tieBreak: (item: T) => string = () => ''): T[] {
  return [...items].sort((a, b) => time(b.date) - time(a.date) || tieBreak(b).localeCompare(tieBreak(a)))
}

/** "Sunday, January 1, 2023", or `style` "short" for "Jan 1, 2023". */
export function formatDay(date: Dated['date'], locale: string, style: 'long' | 'short' = 'long'): string {
  if (!date) return ''
  const options: Intl.DateTimeFormatOptions = style === 'long'
    ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }
    : { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
  return new Intl.DateTimeFormat(locale, options).format(new Date(date))
}
