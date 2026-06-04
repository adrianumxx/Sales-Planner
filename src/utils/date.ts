/**
 * Timezone-safe date helpers.
 *
 * `Date.prototype.toISOString()` converts to UTC, which shifts the calendar
 * date backwards for any timezone ahead of UTC (e.g. Belgium, UTC+1/+2).
 * That made the planner label every visit one day too early. These helpers
 * always work in the browser's LOCAL timezone.
 */

/** Format a Date as a local `YYYY-MM-DD` string (no UTC conversion). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a `YYYY-MM-DD` string into a local-midnight Date (not UTC). */
export function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Today's date as a local `YYYY-MM-DD` string. */
export function todayStr(): string {
  return toDateStr(new Date())
}

/** Format a `YYYY-MM-DD` string for display, in local time. */
export function formatDateLabel(
  str: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' },
  locale = 'en-US'
): string {
  return parseLocalDate(str).toLocaleDateString(locale, opts)
}
