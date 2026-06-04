import type { Client, DailyPlan, VisitDay, CityCoord } from '../types'
import { getDistanceFromHome } from './geo'

// 2-week planning: urgency thresholds based on visit frequency
const URGENT_DAYS = 90    // not visited in 3+ months → top priority
const ATTENTION_DAYS = 45 // not visited in 6 weeks → schedule this week

export function categorizeUrgency(lastVisitDays: number): 'urgent' | 'attention' | 'ok' {
  if (lastVisitDays >= URGENT_DAYS) return 'urgent'
  if (lastVisitDays >= ATTENTION_DAYS) return 'attention'
  return 'ok'
}

export function generatePlan(
  clients: Client[],
  homeCoords: CityCoord,
  visitsPerDay: number = 7
): DailyPlan[] {
  if (!clients.length) return []

  // Recalculate urgency dynamically from lastVisitDays
  const enriched = clients.map(c => ({
    ...c,
    urgency: c.lastVisitDays > 0
      ? categorizeUrgency(c.lastVisitDays)
      : (c.urgency || 'ok'),
  }))

  const urgent     = enriched.filter(c => c.urgency === 'urgent')
  const attention  = enriched.filter(c => c.urgency === 'attention')
  const ok         = enriched.filter(c => c.urgency === 'ok')

  // Within each category: most days since last visit first
  const sortedByPriority: Client[] = [
    ...urgent.sort((a, b) => b.lastVisitDays - a.lastVisitDays),
    ...attention.sort((a, b) => b.lastVisitDays - a.lastVisitDays),
    ...ok.sort((a, b) => b.lastVisitDays - a.lastVisitDays),
  ]

  // Generate working-day time slots (09:00–12:00, 14:00–17:00, skip lunch)
  const generateTimeSlots = (count: number): string[] => {
    const slots: string[] = []
    const morning   = { start: 9,  end: 12 }
    const afternoon = { start: 14, end: 17 }
    const blocks    = [morning, afternoon]
    const total     = (morning.end - morning.start + afternoon.end - afternoon.start) * 60
    const interval  = Math.floor(total / count)

    let minutes = 0
    for (let i = 0; i < count; i++) {
      const m = minutes % 60
      const h = Math.floor(minutes / 60)

      let absH = h
      if (absH >= morning.end - morning.start) {
        absH += afternoon.start - morning.end
      }
      const realH = morning.start + absH

      if (realH < afternoon.end) {
        slots.push(`${String(realH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
      minutes += interval
    }

    return slots.length > 0 ? slots : ['09:00', '14:00']
  }

  // Group clients geographically: fill each day with nearby clients
  const assignClientsTodays = (clientList: Client[], perDay: number): Client[][] => {
    const days: Client[][] = []
    const remaining = [...clientList]

    while (remaining.length > 0) {
      const dayClients: Client[] = []

      if (remaining.length > 0) dayClients.push(remaining.shift()!)

      while (dayClients.length < perDay && remaining.length > 0) {
        let closestIdx = 0
        let minDist = Infinity

        for (let i = 0; i < remaining.length; i++) {
          for (const dc of dayClients) {
            const dist = remaining[i].town === dc.town ? 0 : 1
            if (dist < minDist) { minDist = dist; closestIdx = i }
          }
        }

        dayClients.push(remaining.splice(closestIdx, 1)[0])
      }

      days.push(dayClients)
    }

    return days
  }

  const clientsByDay = assignClientsTodays(sortedByPriority, visitsPerDay)
  const timeSlots    = generateTimeSlots(visitsPerDay)

  // Build 2-week calendar (only Tuesday–Friday)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const plan: DailyPlan[] = []
  let dayIndex = 0

  // Iterate exactly 14 calendar days from today
  for (let i = 0; i < 14; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dow = date.getDay()

    // Only Tuesday (2) → Friday (5)
    if (dow < 2 || dow > 5) continue
    if (dayIndex >= clientsByDay.length) break

    const dateStr    = date.toISOString().split('T')[0]
    const dayClients = clientsByDay[dayIndex]
    const sorted     = sortClientsByProximity(dayClients, homeCoords)

    const visits: VisitDay[] = sorted.map((client, idx) => ({
      id:         `${dateStr}-${idx}`,
      clientName: client.clientName,
      town:       client.town,
      distance:   getDistanceFromHome(client.town, homeCoords),
      urgency:    (client as any).urgency || 'ok',
      timeSlot:   timeSlots[idx % timeSlots.length],
      completed:  false,
      notes:      '',
      quality:    client.quality || 7,
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

// Nearest-neighbour sort within a single day
function sortClientsByProximity(clients: Client[], homeCoords: CityCoord): Client[] {
  if (clients.length <= 1) return clients

  const sorted: Client[] = []
  const remaining = [...clients]

  sorted.push(remaining.shift()!)

  while (remaining.length > 0) {
    let nearestIdx = 0
    let minDist    = Infinity
    const last     = sorted[sorted.length - 1]

    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].town === last.town) { nearestIdx = i; break }
    }

    if (minDist === Infinity) nearestIdx = 0
    sorted.push(remaining.splice(nearestIdx, 1)[0])
  }

  return sorted
}

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
