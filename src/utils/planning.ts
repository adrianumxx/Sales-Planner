import type { Client, DailyPlan, VisitDay } from '../types'
import { getCityCoordinates, getDistance } from './geo'
import { toDateStr } from './date'

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
function buildPlan(clients: Client[], homeCoords: Pt, visitsPerDay: number): DailyPlan[] {
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

  // 4. Time slots
  const timeSlots = buildTimeSlots(visitsPerDay)

  // 5. Lay out across the next 14 calendar days, Tue–Fri only
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const plan: DailyPlan[] = []
  let dayIndex = 0

  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dow = date.getDay()

    if (dow < 2 || dow > 5) continue   // Tue–Fri only
    if (dayIndex >= clientsByDay.length) break

    const dateStr    = toDateStr(date)
    const dayClients = sortByProximity(clientsByDay[dayIndex], homeCoords)

    const visits: VisitDay[] = dayClients.map((client, idx) => {
      const p = coordOf(client)
      const distance = p ? getDistance(homeCoords.lat, homeCoords.lon, p.lat, p.lon) : 0
      return {
        id:            `${dateStr}-${idx}`,
        clientName:    client.clientName,
        town:          client.town,
        address:       client.address,
        lat:           client.lat,
        lon:           client.lon,
        distance,
        urgency:       client.urgency ?? 'ok',
        timeSlot:      timeSlots[idx % timeSlots.length],
        completed:     false,
        notes:         '',
        quality:       client.quality ?? 7,
        lastVisitDays: client.lastVisitDays,
      }
    })

    if (visits.length > 0) {
      plan.push({
        date:    dateStr,
        visits,
        totalKm: Math.round(visits.reduce((s, v) => s + v.distance, 0) * 10) / 10,
      })
    }

    dayIndex++
  }

  return plan
}

export function generatePlan(
  clients: Client[],
  homeCoords: Pt,
  visitsPerDay: number = 7
): DailyPlan[] {
  return buildPlan(clients, homeCoords, visitsPerDay)
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
  visitsPerDay: number = 7
): { plan: DailyPlan[]; count: number } {
  const inArea = clients.filter(c => {
    const p = coordOf(c)
    return p ? getDistance(center.lat, center.lon, p.lat, p.lon) <= radiusKm : false
  })
  return { plan: buildPlan(inArea, homeCoords, visitsPerDay), count: inArea.length }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Cluster priority-sorted clients into day-sized buckets. Each day is seeded by
 * the highest-priority remaining account, then filled with its nearest
 * geographic neighbours — so you hit the most-overdue client and everyone
 * around it on the same trip.
 */
function groupByDay(clients: Client[], perDay: number): Client[][] {
  const days: Client[][] = []
  const remaining = [...clients]

  while (remaining.length > 0) {
    const seed = remaining.shift()!
    const bucket: Client[] = [seed]
    const ref = coordOf(seed)

    while (bucket.length < perDay && remaining.length > 0) {
      let idx = 0
      if (ref) {
        let best = Infinity
        remaining.forEach((c, i) => {
          const p = coordOf(c)
          if (p) {
            const d = getDistance(ref.lat, ref.lon, p.lat, p.lon)
            if (d < best) { best = d; idx = i }
          }
        })
      }
      bucket.push(remaining.splice(idx, 1)[0])
    }

    days.push(bucket)
  }

  return days
}

/** Nearest-neighbour order within a day, starting from home. */
function sortByProximity(clients: Client[], homeCoords: Pt): Client[] {
  if (clients.length <= 1) return clients

  const remaining = [...clients]
  const ordered: Client[] = []
  let cur: Pt = { lat: homeCoords.lat, lon: homeCoords.lon }

  while (remaining.length > 0) {
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
