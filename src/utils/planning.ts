import type { Client, DailyPlan, VisitDay, OpeningHours } from '../types'
import { getCityCoordinates, getDistance } from './geo'
import { nextWorkdays, weekdayOf } from './date'

// Urgency thresholds (days since last visit)
const URGENT_DAYS    = 90  // 3+ months → top priority
const ATTENTION_DAYS = 45  // 6 weeks   → schedule this cycle

export function categorizeUrgency(lastVisitDays: number): 'urgent' | 'attention' | 'ok' {
  if (lastVisitDays >= URGENT_DAYS)    return 'urgent'
  if (lastVisitDays >= ATTENTION_DAYS) return 'attention'
  return 'ok'
}

interface Pt { lat: number; lon: number }

/** Coordinates of a client/visit: prefer resolved lat/lon, fall back to town. */
function coordOf(item: { lat?: number; lon?: number; town: string }): Pt | null {
  if (item.lat != null && item.lon != null) return { lat: item.lat, lon: item.lon }
  const c = getCityCoordinates(item.town)
  return c ? { lat: c.lat, lon: c.lon } : null
}

type Located = { lat?: number; lon?: number; town: string }

/** Nearest-neighbour visiting order starting from `home` (straight-line). */
function nnOrder<T extends Located>(items: T[], home: Pt): T[] {
  if (items.length <= 1) return [...items]
  const remaining = [...items]
  const ordered: T[] = []
  let cur: Pt = { lat: home.lat, lon: home.lon }
  while (remaining.length) {
    let idx = 0
    let best = Infinity
    remaining.forEach((c, i) => {
      const p = coordOf(c)
      if (p) {
        const d = getDistance(cur.lat, cur.lon, p.lat, p.lon)
        if (d < best) { best = d; idx = i }
      }
    })
    const next = remaining.splice(idx, 1)[0]
    ordered.push(next)
    const np = coordOf(next)
    if (np) cur = np
  }
  return ordered
}

/** Path length: start → stop1 → … → stopN → end (straight-line km). */
function tourKm<T extends Located>(items: T[], start: Pt, end: Pt = start): number {
  let prev: Pt = start
  let sum = 0
  for (const it of items) {
    const p = coordOf(it) ?? prev
    sum += getDistance(prev.lat, prev.lon, p.lat, p.lon)
    prev = p
  }
  if (items.length) sum += getDistance(prev.lat, prev.lon, end.lat, end.lon)
  return sum
}

/**
 * 2-opt improvement: repeatedly reverse route segments while that shortens the
 * start→…→end path. Removes the crossings a greedy nearest-neighbour route
 * leaves behind. Day sizes are small, so the O(n²) sweep is cheap.
 */
function twoOpt<T extends Located>(items: T[], start: Pt, end: Pt = start): T[] {
  if (items.length < 4) return items
  let best = [...items]
  let bestKm = tourKm(best, start, end)
  let improved = true
  let guard = 0
  while (improved && guard++ < 60) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, k + 1).reverse(),
          ...best.slice(k + 1),
        ]
        const km = tourKm(candidate, start, end)
        if (km + 1e-6 < bestKm) { best = candidate; bestKm = km; improved = true }
      }
    }
  }
  return best
}

/** Best route we can cheaply find: nearest-neighbour seed, then 2-opt polish. */
function optimizeRoute<T extends Located>(items: T[], start: Pt, end: Pt = start): T[] {
  return twoOpt(nnOrder(items, start), start, end)
}

/**
 * Real route metrics for an ordered list of stops: each leg is prev→next
 * (start→first for the first stop), and the total includes the final drive to
 * `end` (the evening return point). `legs[i]` is the distance driven to reach
 * stop i — not the start→stop distance.
 */
function routeFromHome<T extends Located>(items: T[], start: Pt, end: Pt = start): { legs: number[]; totalKm: number } {
  let prev: Pt = { lat: start.lat, lon: start.lon }
  const legs: number[] = []
  for (const it of items) {
    const p = coordOf(it) ?? prev
    const leg = getDistance(prev.lat, prev.lon, p.lat, p.lon)
    legs.push(Math.round(leg * 10) / 10)
    prev = p
  }
  const back = items.length ? getDistance(prev.lat, prev.lon, end.lat, end.lon) : 0
  const sum = legs.reduce((s, x) => s + x, 0) + back
  return { legs, totalKm: Math.round(sum * 10) / 10 }
}

const urgencyRank = (u?: string) => (u === 'urgent' ? 0 : u === 'attention' ? 1 : 2)

/** Priority sort: urgent → attention → ok, most overdue first within each tier. */
function prioritize(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => {
    const r = urgencyRank(a.urgency) - urgencyRank(b.urgency)
    if (r !== 0) return r
    return b.lastVisitDays - a.lastVisitDays
  })
}

// ─── Opening-hours awareness ────────────────────────────────────────────────
// Only VERIFIED hours constrain scheduling. Unknown / low-confidence hours are
// treated as "available any day/time" so we never move a visit on bad data.

type HasHours = { openingHours?: OpeningHours }

/** The venue's hours iff trustworthy enough to schedule against, else null. */
function effectiveHours(c: HasHours): OpeningHours | null {
  return c.openingHours && c.openingHours.verified ? c.openingHours : null
}

/** Is this venue open on the given weekday (0=Sun..6=Sat)? Unknown ⇒ yes. */
function openOn(c: HasHours, weekday: number): boolean {
  const h = effectiveHours(c)
  if (!h) return true
  const iv = h.days[weekday]
  return !!iv && iv.length > 0
}

// Field working window the planner schedules within (09:00–17:30).
const WORK_START = 9 * 60
const WORK_END = 17 * 60 + 30

/** Open intervals on a weekday, clamped to the working window ([] = closed then). */
function workingIntervals(h: OpeningHours | null, weekday: number): [number, number][] {
  if (!h) return [[WORK_START, WORK_END]]
  const out: [number, number][] = []
  for (const [a, b] of h.days[weekday] || []) {
    const s = Math.max(a, WORK_START), e = Math.min(b, WORK_END)
    if (e > s) out.push([s, e])
  }
  return out
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Time slots for one day that respect each venue's open window on `weekday`.
 * Walks visits in route order, placing each at the earliest open time ≥ the
 * running cursor. Flags `outside` when a venue is closed during working hours
 * (or the day is too packed to fit it inside its window).
 */
function buildTimeSlotsForDay(clients: HasHours[], weekday: number): { slots: string[]; outside: boolean[] } {
  const n = clients.length
  const step = Math.min(90, Math.max(30, Math.floor((WORK_END - WORK_START) / Math.max(n, 1))))
  let cursor = WORK_START
  const slots: string[] = []
  const outside: boolean[] = []

  for (const c of clients) {
    const ivs = workingIntervals(effectiveHours(c), weekday)
    if (!ivs.length) {
      slots.push(fmtMin(Math.min(cursor, WORK_END - 1)))
      outside.push(true)
      cursor += step
      continue
    }
    let t = -1
    for (const [a, b] of ivs) {
      if (cursor <= a) { t = a; break }
      if (cursor < b) { t = cursor; break }
    }
    if (t === -1) {
      // ran past this venue's window — over-packed day; place at cursor and flag
      slots.push(fmtMin(Math.min(cursor, WORK_END - 1)))
      outside.push(true)
      cursor += step
    } else {
      slots.push(fmtMin(t))
      outside.push(false)
      cursor = t + step
    }
  }
  return { slots, outside }
}

/**
 * Reflow day-buckets so no visit lands on a weekday the venue is (verifiably)
 * closed. Buckets keep their geography; only closed-on-their-day clients are
 * pulled out and re-placed — first back-filled into the earliest existing day
 * they're open on (with spare capacity), otherwise grouped onto new trailing
 * days by compatible weekday. When NO client has verified hours this is a no-op
 * and the output is identical to the legacy bucketing.
 */
function reflowForHours(
  rawBuckets: Client[][],
  from: Date,
  blocked: Set<string> | undefined,
  perDay: number
): { date: string; clients: Client[] }[] {
  const anyHours = rawBuckets.some(b => b.some(c => effectiveHours(c)))
  if (!anyHours) {
    const dates = nextWorkdays(rawBuckets.length, from, blocked)
    return rawBuckets.map((clients, i) => ({ date: dates[i], clients }))
  }

  const total = rawBuckets.reduce((s, b) => s + b.length, 0)
  const dates = nextWorkdays(Math.max(total, rawBuckets.length), from, blocked)

  // Phase 1 — keep clients open on their day; collect the closed-on-day ones.
  type Day = { date: string; clients: Client[] }
  const placed: Day[] = rawBuckets.map((b, i) => ({
    date: dates[i],
    clients: b.filter(c => openOn(c, weekdayOf(dates[i]))),
  }))
  const displaced: Client[] = []
  rawBuckets.forEach((b, i) => {
    const w = weekdayOf(dates[i])
    for (const c of b) if (!openOn(c, w)) displaced.push(c)
  })

  // Phase 2a — back-fill into the nearest existing day with capacity & open weekday.
  const leftover: Client[] = []
  for (const c of displaced) {
    let bestIdx = -1, bestD = Infinity
    for (let i = 0; i < placed.length; i++) {
      if (placed[i].clients.length >= perDay) continue
      if (!openOn(c, weekdayOf(placed[i].date))) continue
      const ref = placed[i].clients.length ? coordOf(placed[i].clients[0]) : null
      const p = coordOf(c)
      const d = ref && p ? getDistance(ref.lat, ref.lon, p.lat, p.lon) : 0
      if (d < bestD) { bestD = d; bestIdx = i }
    }
    if (bestIdx >= 0) placed[bestIdx].clients.push(c)
    else leftover.push(c)
  }

  // Phase 2b — remaining onto new trailing days grouped by compatible weekday.
  let di = rawBuckets.length
  let guard = 0
  while (leftover.length && di < dates.length && guard++ < dates.length + 5) {
    const w = weekdayOf(dates[di])
    const seedIdx = leftover.findIndex(c => openOn(c, w))
    if (seedIdx === -1) { di++; continue }
    const day: Client[] = [leftover.splice(seedIdx, 1)[0]]
    const ref = coordOf(day[0])
    while (day.length < perDay && leftover.length) {
      let idx = -1, best = Infinity
      leftover.forEach((c, i) => {
        if (!openOn(c, w)) return
        const p = coordOf(c)
        const d = ref && p ? getDistance(ref.lat, ref.lon, p.lat, p.lon) : 0
        if (d < best) { best = d; idx = i }
      })
      if (idx === -1) break
      day.push(leftover.splice(idx, 1)[0])
    }
    placed.push({ date: dates[di], clients: day })
    di++
  }

  // Anyone still unplaced opens on no working weekday — schedule (flagged later),
  // never dropped.
  if (leftover.length) {
    if (di < dates.length) placed.push({ date: dates[di], clients: leftover })
    else if (placed.length) placed[placed.length - 1].clients.push(...leftover)
  }

  return placed.filter(d => d.clients.length > 0)
}

/** Core pipeline shared by full-plan and area-coverage generation. */
function buildPlan(
  clients: Client[],
  homeCoords: Pt,
  visitsPerDay: number,
  blocked?: Set<string>,
  maxKmPerDay = 0,
  endCoords: Pt = homeCoords
): DailyPlan[] {
  if (!clients.length) return []

  // 1. Compute urgency from days-overdue
  const enriched = clients.map(c => ({
    ...c,
    urgency: c.lastVisitDays > 0 ? categorizeUrgency(c.lastVisitDays) : (c.urgency ?? 'ok'),
  })) as Client[]

  // 2. Priority order
  const sorted = prioritize(enriched)

  // 3. Cluster into days (most-overdue account seeds each day, filled by nearest,
  //    capped by visits/day and — optionally — a max driving distance per day)
  const clientsByDay = groupByDay(sorted, visitsPerDay, homeCoords, maxKmPerDay, endCoords)

  // 4. Lay buckets onto workdays (Mon–Fri, skipping admin), reflowing any visit
  //    off a weekday its venue is closed (no-op when no verified hours exist).
  const days = reflowForHours(clientsByDay, new Date(), blocked, visitsPerDay)
  const plan: DailyPlan[] = []

  days.forEach(({ date: dateStr, clients: bucket }) => {
    const ordered = optimizeRoute(bucket, homeCoords, endCoords)
    const { legs, totalKm } = routeFromHome(ordered, homeCoords, endCoords)

    // Open-aware time slots only when the day has verified-hours venues; otherwise
    // the legacy 09–12 / 14–17 distribution (keeps existing plans byte-identical).
    const weekday = weekdayOf(dateStr)
    const hasHours = ordered.some(c => effectiveHours(c))
    const { slots, outside } = hasHours
      ? buildTimeSlotsForDay(ordered, weekday)
      : { slots: buildTimeSlots(ordered.length), outside: ordered.map(() => false) }

    const visits: VisitDay[] = ordered.map((client, idx) => ({
      id:            `${dateStr}-${idx}`,
      clientName:    client.clientName,
      town:          client.town,
      address:       client.address,
      lat:           client.lat,
      lon:           client.lon,
      distance:      legs[idx] ?? 0,
      urgency:       client.urgency ?? 'ok',
      timeSlot:      slots[idx] ?? slots[idx % Math.max(slots.length, 1)] ?? '09:00',
      completed:     false,
      notes:         '',
      quality:       client.quality ?? 7,
      lastVisitDays: client.lastVisitDays,
      openingHours:  client.openingHours,
      outsideHours:  outside[idx] ?? false,
    }))

    if (visits.length > 0) {
      plan.push({ date: dateStr, visits, totalKm })
    }
  })

  return plan
}

/**
 * Recompute a day's derived fields after a manual edit (reorder / move / remove):
 * re-sequence time slots, recompute per-leg distances and the day's total km.
 * `reoptimize` re-routes the day from home (used when a visit is moved in);
 * leave it false to preserve a manual ordering. Visit ids are kept intact so
 * notes / completion / voice notes stay linked.
 */
export function recomputeDay(
  visits: VisitDay[],
  homeCoords: Pt,
  reoptimize = false,
  endCoords: Pt = homeCoords,
  weekday?: number
): { visits: VisitDay[]; totalKm: number } {
  const ordered = reoptimize ? optimizeRoute(visits, homeCoords, endCoords) : visits
  const { legs, totalKm } = routeFromHome(ordered, homeCoords, endCoords)

  // Open-aware slots when we know the weekday and a venue has verified hours;
  // otherwise the legacy distribution (unchanged behaviour for existing callers).
  const hasHours = weekday != null && ordered.some(v => effectiveHours(v))
  const { slots, outside } = hasHours
    ? buildTimeSlotsForDay(ordered, weekday!)
    : { slots: buildTimeSlots(ordered.length), outside: [] as boolean[] }

  const out = ordered.map((v, i) => ({
    ...v,
    timeSlot: slots[i] ?? slots[i % Math.max(slots.length, 1)] ?? '09:00',
    distance: legs[i] ?? 0,
    outsideHours: hasHours ? (outside[i] ?? false) : v.outsideHours,
  }))
  return { visits: out, totalKm }
}

/**
 * Re-date a saved plan onto upcoming workdays, preserving day grouping, visit
 * order and ids (i.e. manual edits). Used to "roll forward" a plan whose dates
 * have drifted into the past, and to reflow around admin days (`blocked`).
 */
export function rollForwardDates(plan: DailyPlan[], from: Date = new Date(), blocked?: Set<string>): DailyPlan[] {
  if (!plan.length) return plan
  const dates = nextWorkdays(plan.length, from, blocked)
  return plan.map((day, i) => ({ ...day, date: dates[i] }))
}

export function generatePlan(
  clients: Client[],
  homeCoords: Pt,
  visitsPerDay: number = 7,
  blocked?: Set<string>,
  maxKmPerDay = 0,
  endCoords: Pt = homeCoords
): DailyPlan[] {
  return buildPlan(clients, homeCoords, visitsPerDay, blocked, maxKmPerDay, endCoords)
}

/**
 * Area coverage ("dintorni"): every client within `radiusKm` of a city centre,
 * priority-sorted and laid out as an optimised multi-day route. This is the
 * core objective — name a city, cover it and its surrounding towns efficiently.
 */
export function planAreaCoverage(
  clients: Client[],
  center: Pt,
  radiusKm: number,
  homeCoords: Pt,
  visitsPerDay: number = 7,
  blocked?: Set<string>,
  maxKmPerDay = 0,
  endCoords: Pt = homeCoords
): { plan: DailyPlan[]; count: number } {
  const inArea = clients.filter(c => {
    const p = coordOf(c)
    return p ? getDistance(center.lat, center.lon, p.lat, p.lon) <= radiusKm : false
  })
  return { plan: buildPlan(inArea, homeCoords, visitsPerDay, blocked, maxKmPerDay, endCoords), count: inArea.length }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Group clients into day-sized buckets that are BOTH priority-correct and
 * geographically tight — the core need for a rep who drives a lot.
 *
 * Clients are split into urgency tiers (urgent → attention → ok) which are
 * filled in strict order, so a low-tier account can never be scheduled before
 * a higher-tier one. WITHIN each tier, every day is seeded by the most-overdue
 * remaining client and filled with its nearest geographic neighbours — so each
 * day is a compact zone instead of stops scattered across the region.
 */
function groupByDay(clients: Client[], perDay: number, home: Pt, maxKm = 0, end: Pt = home): Client[][] {
  const tiers: Record<string, Client[]> = { urgent: [], attention: [], ok: [] }
  for (const c of clients) (tiers[c.urgency ?? 'ok'] ?? tiers.ok).push(c)

  const days: Client[][] = []
  for (const tier of ['urgent', 'attention', 'ok'] as const) {
    // pool stays in overdue order, so each new seed is the most-overdue left
    const pool = tiers[tier]
    while (pool.length > 0) {
      const seed = pool.shift()!
      const bucket: Client[] = [seed]
      const ref = coordOf(seed)

      while (bucket.length < perDay && pool.length > 0) {
        let idx = 0
        if (ref) {
          let best = Infinity
          pool.forEach((c, i) => {
            const p = coordOf(c)
            if (p) {
              const d = getDistance(ref.lat, ref.lon, p.lat, p.lon)
              if (d < best) { best = d; idx = i }
            }
          })
        }
        // Driving-distance cap: stop filling the day if the nearest remaining
        // client would push the day's route past the limit. The seed always
        // stays (a single visit is never dropped, even if it's a long haul).
        if (maxKm > 0) {
          const projected = tourKm(nnOrder([...bucket, pool[idx]], home), home, end)
          if (projected > maxKm) break
        }
        bucket.push(pool.splice(idx, 1)[0])
      }
      days.push(bucket)
    }
  }
  return days
}

/** Time slots across 09–12 and 14–17, distributed evenly */
function buildTimeSlots(count: number): string[] {
  const totalMin = 360
  const interval = Math.floor(totalMin / Math.max(count, 1))
  const slots: string[] = []

  let elapsed = 0
  for (let i = 0; i < count; i++) {
    const blockMin = elapsed
    let h: number
    let m: number

    if (blockMin < 180) {
      h = 9 + Math.floor(blockMin / 60)
      m = blockMin % 60
    } else {
      const pm = blockMin - 180
      h = 14 + Math.floor(pm / 60)
      m = pm % 60
    }

    if (h < 17) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }

    elapsed += interval
  }

  return slots.length > 0 ? slots : ['09:00', '11:00', '14:00', '16:00']
}

/**
 * Re-orders a day's visits using nearest-neighbour routing starting from a
 * given point (e.g. "I'm in Charleroi — optimise from here").
 */
export function rerouteDayFromCity(visits: VisitDay[], startCoords: Pt): VisitDay[] {
  if (visits.length <= 1) return visits

  const remaining = [...visits]
  const ordered: VisitDay[] = []
  let cur: Pt = { lat: startCoords.lat, lon: startCoords.lon }

  while (remaining.length > 0) {
    let nearestIdx = 0
    let nearestDist = Infinity

    remaining.forEach((v, i) => {
      const p = coordOf(v)
      if (p) {
        const d = getDistance(cur.lat, cur.lon, p.lat, p.lon)
        if (d < nearestDist) { nearestDist = d; nearestIdx = i }
      }
    })

    const next = remaining.splice(nearestIdx, 1)[0]
    ordered.push(next)
    const np = coordOf(next)
    if (np) cur = np
  }

  const slots = buildTimeSlots(ordered.length)
  return ordered.map((v, i) => ({ ...v, timeSlot: slots[i % slots.length] }))
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'urgent':    return 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'
    case 'attention': return 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
    default:          return 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
  }
}

export function getUrgencyBadge(urgency: string): string {
  switch (urgency) {
    case 'urgent':    return '🔴'
    case 'attention': return '🟡'
    default:          return '🟢'
  }
}
