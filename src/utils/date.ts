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

/** Weekday of a `YYYY-MM-DD` string: 0 = Sunday … 6 = Saturday (local). */
export function weekdayOf(str: string): number {
  return parseLocalDate(str).getDay()
}

/**
 * Field-rep work week: Monday–Friday. Single source of truth — both the
 * planner (date layout) and the calendar (active cells) must agree on this.
 * (Mondays are workdays but are often used for admin — see admin-day marking.)
 */
export function isWorkday(d: Date): boolean {
  const dow = d.getDay()
  return dow >= 1 && dow <= 5
}

/**
 * The next `count` workday date-strings, starting at/after `from` (default today).
 * Dates present in `blocked` (e.g. admin days) are skipped.
 */
export function nextWorkdays(count: number, from: Date = new Date(), blocked?: Set<string>): string[] {
  const out: string[] = []
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const guard = new Date(d)
  guard.setFullYear(guard.getFullYear() + 2) // safety bound
  while (out.length < count && d < guard) {
    if (isWorkday(d)) {
      const s = toDateStr(d)
      if (!blocked || !blocked.has(s)) out.push(s)
    }
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Format a `YYYY-MM-DD` string for display, in local time. */
export function formatDateLabel(
  str: string,
  opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' },
  locale = 'en-US'
): string {
  return parseLocalDate(str).toLocaleDateString(locale, opts)
}
