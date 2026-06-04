import type { Client, DailyPlan, VisitDay, CityCoord } from '../types'
import { getDistanceFromHome, getCityCoordinates, getDistance } from './geo'

// Urgency thresholds (days since last visit)
const URGENT_DAYS    = 90  // 3+ months → top priority
const ATTENTION_DAYS = 45  // 6 weeks   → schedule this cycle

export function categorizeUrgency(lastVisitDays: number): 'urgent' | 'attention' | 'ok' {
  if (lastVisitDays >= URGENT_DAYS)    return 'urgent'
  if (lastVisitDays >= ATTENTION_DAYS) return 'attention'
  return 'ok'
}

export function generatePlan(
  clients: Client[],
  homeCoords: CityCoord,
  visitsPerDay: number = 7
): DailyPlan[] {
  if (!clients.length) return []

  // 1. Enrich each client with computed urgency from lastVisitDays
  const enriched = clients.map(c => ({
    ...c,
    urgency: c.lastVisitDays > 0
      ? categorizeUrgency(c.lastVisitDays)
      : (c.urgency ?? 'ok'),
  })) as Client[]

  // 2. Sort: urgent first → attention → ok, then most overdue within each group
  const urgent    = enriched.filter(c => c.urgency === 'urgent')
                            .sort((a, b) => b.lastVisitDays - a.lastVisitDays)
  const attention = enriched.filter(c => c.urgency === 'attention')
                            .sort((a, b) => b.lastVisitDays - a.lastVisitDays)
  const ok        = enriched.filter(c => c.urgency === 'ok')
                            .sort((a, b) => b.lastVisitDays - a.lastVisitDays)

  const sorted = [...urgent, ...attention, ...ok]

  // 3. Group into days, clustering nearby towns together
  const clientsByDay = groupByDay(sorted, visitsPerDay)

  // 4. Generate time slots (09–12, 14–17, lunch excluded)
  const timeSlots = buildTimeSlots(visitsPerDay)

  // 5. Build plan across next 14 calendar days, Tue–Fri only
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const plan: DailyPlan[] = []
  let dayIndex = 0

  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dow = date.getDay()

    if (dow < 2 || dow > 5) continue   // skip Mon, Sat, Sun
    if (dayIndex >= clientsByDay.length) break

    const dateStr    = date.toISOString().split('T')[0]
    const dayClients = sortByProximity(clientsByDay[dayIndex])

    const visits: VisitDay[] = dayClients.map((client, idx) => ({
      id:         `${dateStr}-${idx}`,
      clientName: client.clientName,
      town:       client.town,
      distance:   getDistanceFromHome(client.town, homeCoords),
      urgency:    client.urgency ?? 'ok',
      timeSlot:   timeSlots[idx % timeSlots.length],
      completed:  false,
      notes:      '',
      quality:    client.quality ?? 7,
    }))

    if (visits.length > 0) {
      plan.push({
        date:    dateStr,
        visits,
        totalKm: visits.reduce((s, v) => s + v.distance, 0),
      })
    }

    dayIndex++
  }

  return plan
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Cluster sorted clients into day-sized buckets, grouping same-town clients */
function groupByDay(clients: Client[], perDay: number): Client[][] {
  const days: Client[][] = []
  const remaining = [...clients]

  while (remaining.length > 0) {
    const bucket: Client[] = []
    bucket.push(remaining.shift()!)          // seed: next highest priority

    while (bucket.length < perDay && remaining.length > 0) {
      // Prefer same town as any client already in bucket
      let idx = remaining.findIndex(r => bucket.some(b => b.town === r.town))
      if (idx === -1) idx = 0               // fallback: next in priority order
      bucket.push(remaining.splice(idx, 1)[0])
    }

    days.push(bucket)
  }

  return days
}

/** Within a single day, order by town proximity (same town adjacent) */
function sortByProximity(clients: Client[]): Client[] {
  if (clients.length <= 1) return clients

  const sorted: Client[]    = []
  const remaining: Client[] = [...clients]

  sorted.push(remaining.shift()!)

  while (remaining.length > 0) {
    const last = sorted[sorted.length - 1]
    const sameIdx = remaining.findIndex(r => r.town === last.town)
    const idx = sameIdx !== -1 ? sameIdx : 0
    sorted.push(remaining.splice(idx, 1)[0])
  }

  return sorted
}

/** Time slots across 09–12 and 14–17, distributed evenly */
function buildTimeSlots(count: number): string[] {
  // Working minutes: 3h morning + 3h afternoon = 360 min
  const totalMin = 360
  const interval = Math.floor(totalMin / Math.max(count, 1))
  const slots: string[] = []

  let elapsed = 0
  for (let i = 0; i < count; i++) {
    const blockMin = elapsed
    let h: number
    let m: number

    if (blockMin < 180) {
      // morning block: offset from 09:00
      h = 9  + Math.floor(blockMin / 60)
      m = blockMin % 60
    } else {
      // afternoon block: offset from 14:00
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
 * Re-orders a day's visits using nearest-neighbour routing starting from
 * a given city (e.g. "I'm in Charleroi today — optimise my route from here").
 * Also reassigns time slots to match the new order.
 */
export function rerouteDayFromCity(visits: VisitDay[], startCoords: CityCoord): VisitDay[] {
  if (visits.length <= 1) return visits

  const remaining = [...visits]
  const ordered: VisitDay[] = []
  let curLat = startCoords.lat
  let curLon = startCoords.lon

  while (remaining.length > 0) {
    // Find the visit whose town is geographically closest to current position
    let nearestIdx = 0
    let nearestDist = Infinity

    remaining.forEach((v, i) => {
      const coords = getCityCoordinates(v.town)
      if (coords) {
        const d = getDistance(curLat, curLon, coords.lat, coords.lon)
        if (d < nearestDist) { nearestDist = d; nearestIdx = i }
      }
    })

    const next = remaining.splice(nearestIdx, 1)[0]
    ordered.push(next)

    const nextCoords = getCityCoordinates(next.town)
    if (nextCoords) { curLat = nextCoords.lat; curLon = nextCoords.lon }
  }

  // Reassign time slots to match new order
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
