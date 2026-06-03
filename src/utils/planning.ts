import type { Client, DailyPlan, VisitDay, CityCoord } from '../types'
import { getDistanceFromHome } from './geo'

export function generatePlan(
  clients: Client[],
  homeCoords: CityCoord,
  visitsPerDay: number = 7
): DailyPlan[] {
  if (!clients.length) return []

  // Categorize clients
  const urgent = clients.filter(c => c.daysSinceLastVisit > 200)
  const attention = clients.filter(c => c.daysSinceLastVisit >= 130 && c.daysSinceLastVisit <= 200)
  const ok = clients.filter(c => c.daysSinceLastVisit < 130)

  // Sort by priority
  const sorted = [
    ...urgent.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit),
    ...attention.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit),
    ...ok.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit),
  ]

  // Generate dynamic time slots based on visitsPerDay
  const generateTimeSlots = (count: number): string[] => {
    const slots: string[] = []
    const startHour = 9
    const endHour = 17
    const hoursAvailable = endHour - startHour - 1 // -1 for lunch break
    const interval = Math.max(1, Math.floor((hoursAvailable * 60) / Math.max(count, 1)))

    let currentMinutes = 0
    for (let i = 0; i < count; i++) {
      const totalMinutes = startHour * 60 + currentMinutes
      const hour = Math.floor(totalMinutes / 60)
      const minute = totalMinutes % 60

      if (hour >= 12 && hour < 14) {
        currentMinutes += 120 // Skip lunch break
        continue
      }

      slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
      currentMinutes += interval
    }

    return slots.length > 0 ? slots : ['09:00', '14:00']
  }

  // Create 90-day calendar (only Tuesday-Friday)
  const today = new Date()
  const plan: DailyPlan[] = []
  let visitIndex = 0
  const timeSlots = generateTimeSlots(visitsPerDay)

  for (let i = 0; i < 180; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dayOfWeek = date.getDay()

    // Only work Tuesday (2) to Friday (5)
    if (dayOfWeek < 2 || dayOfWeek > 5) continue

    // Stop after 90 days of planning
    if (plan.length >= Math.ceil(sorted.length / visitsPerDay) + 10) break

    const dateStr = date.toISOString().split('T')[0]
    const visits: VisitDay[] = []

    // Add visits for this day
    for (let v = 0; v < visitsPerDay && visitIndex < sorted.length; v++) {
      const client = sorted[visitIndex]
      const distance = getDistanceFromHome(client.town, homeCoords)

      let urgency: 'urgent' | 'attention' | 'ok' = 'ok'
      if (client.daysSinceLastVisit > 200) urgency = 'urgent'
      else if (client.daysSinceLastVisit >= 130) urgency = 'attention'

      visits.push({
        id: `${dateStr}-${v}`,
        clientName: client.customerDetails,
        town: client.town,
        distance,
        urgency,
        timeSlot: timeSlots[v % timeSlots.length],
        completed: false,
        notes: '',
        quality: client.quality,
      })

      visitIndex++
    }

    if (visits.length > 0) {
      const totalKm = visits.reduce((sum, v) => sum + v.distance, 0)
      plan.push({ date: dateStr, visits, totalKm })
    }
  }

  return plan
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'urgent': return 'bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100'
    case 'attention': return 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100'
    default: return 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
  }
}

export function getUrgencyBadge(urgency: string): string {
  switch (urgency) {
    case 'urgent': return '🔴'
    case 'attention': return '🟡'
    default: return '🟢'
  }
}
