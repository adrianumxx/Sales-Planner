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

  // Create 90-day calendar (skip weekends)
  const today = new Date()
  const plan: DailyPlan[] = []
  let visitIndex = 0
  let timeSlotIndex = 0
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'
  ]

  for (let i = 0; i < 90; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue

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
        timeSlot: timeSlots[timeSlotIndex % timeSlots.length],
        completed: false,
        notes: '',
        quality: client.quality,
      })

      timeSlotIndex++
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
