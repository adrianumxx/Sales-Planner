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

/**
 * Real route metrics for an ordered list of stops: each leg is prev→next
 * (home→first for the first stop), and the total includes the drive back home.
 * `legs[i]` is the distance driven to reach stop i — not the home→stop distance.
 */
function routeFromHome<T extends Located>(items: T[], home: Pt): { legs: number[]; totalKm: number } {
  let prev: Pt = { lat: home.lat, lon: home.lon }
  const legs: number[] = []
  for (const it of items) {
    const p = coordOf(it) ?? prev
    const leg = getDistance(prev.lat, prev.lon, p.lat, p.lon)
    legs.push(Math.round(leg * 10) / 10)
    prev = p
  }
  const back = items.length ? getDistance(prev.lat, prev.lon, home.lat, home.lon) : 0
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
function buildPlan(clients: Client[], homeCoords: Pt, visitsPerDay: number, blocked?: Set<string>): DailyPlan[] {
  if (!clients.length) return []

  // 1. Compute urgency from days-overdue
  const enriched = clients.map(c => ({
    ...c,
    urgency: c.lastVisitDays > 0 ? categorizeUrgency(c.lastVisitDays) : (c.urgency ?? 'ok'),
  })) as Client[]

  // 2. Priority order
  const sorted = prioritize(enriched)

  // 3. Cluster into days (most-overdue account seeds each day, filled by nearest)
  const clientsByDay = groupByDay(sorted, visitsPerDay)

  // 4. Lay each day-bucket onto the next available workdays (Mon–Fri, skipping admin days)
  const dates = nextWorkdays(clientsByDay.length, new Date(), blocked)
  const plan: DailyPlan[] = []

  clientsByDay.forEach((bucket, dayIndex) => {
    const dateStr = dates[dayIndex]
    const ordered = nnOrder(bucket, homeCoords)
    const slots = buildTimeSlots(ordered.length)
    const { legs, totalKm } = routeFromHome(ordered, homeCoords)

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
  reoptimize = false
): { visits: VisitDay[]; totalKm: number } {
  const ordered = reoptimize ? nnOrder(visits, homeCoords) : visits
  const slots = buildTimeSlots(ordered.length)
  const { legs, totalKm } = routeFromHome(ordered, homeCoords)
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
  blocked?: Set<string>
): DailyPlan[] {
  return buildPlan(clients, homeCoords, visitsPerDay, blocked)
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
  blocked?: Set<string>
): { plan: DailyPlan[]; count: number } {
  const inArea = clients.filter(c => {
    const p = coordOf(c)
    return p ? getDistance(center.lat, center.lon, p.lat, p.lon) <= radiusKm : false
  })
  return { plan: buildPlan(inArea, homeCoords, visitsPerDay, blocked), count: inArea.length }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Chunk the already priority-sorted clients into day-sized buckets, strictly in
 * order. The most-overdue clients fill day 1, the next batch day 2, and so on —
 * a low-overdue account never jumps ahead of a more-overdue one just because
 * it's nearby. (Within-day driving order is optimised separately.)
 */
function groupByDay(clients: Client[], perDay: number): Client[][] {
  const days: Client[][] = []
  for (let i = 0; i < clients.length; i += perDay) {
    days.push(clients.slice(i, i + perDay))
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
