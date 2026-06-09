import type { Client, DailyPlan, VisitDay } from '../types'
import { getCityCoordinates, getDistance } from './geo'
import { nextWorkdays } from './date'

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

  // 4. Lay each day-bucket onto the next available workdays (Mon–Fri, skipping admin days)
  const dates = nextWorkdays(clientsByDay.length, new Date(), blocked)
  const plan: DailyPlan[] = []

  clientsByDay.forEach((bucket, dayIndex) => {
    const dateStr = dates[dayIndex]
    const ordered = optimizeRoute(bucket, homeCoords, endCoords)
    const slots = buildTimeSlots(ordered.length)
    const { legs, totalKm } = routeFromHome(ordered, homeCoords, endCoords)

    const visits: VisitDay[] = ordered.map((client, idx) => ({
      id:            `${dateStr}-${idx}`,
      clientName:    client.clientName,
      town:          client.town,
      address:       client.address,
      lat:           client.lat,
      lon:           client.lon,
      distance:      legs[idx] ?? 0,
      urgency:       client.urgency ?? 'ok',
      timeSlot:      slots[idx % slots.length],
      completed:     false,
      notes:         '',
      quality:       client.quality ?? 7,
      lastVisitDays: client.lastVisitDays,
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
  endCoords: Pt = homeCoords
): { visits: VisitDay[]; totalKm: number } {
  const ordered = reoptimize ? optimizeRoute(visits, homeCoords, endCoords) : visits
  const slots = buildTimeSlots(ordered.length)
  const { legs, totalKm } = routeFromHome(ordered, homeCoords, endCoords)
  const out = ordered.map((v, i) => ({
    ...v,
    timeSlot: slots[i % slots.length],
    distance: legs[i] ?? 0,
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
