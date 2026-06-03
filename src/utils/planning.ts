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

  // Sort by priority within each category
  const sortedByPriority = [
    ...urgent.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit),
    ...attention.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit),
    ...ok.sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit),
  ]

  // Generate dynamic time slots based on visitsPerDay
  const generateTimeSlots = (count: number): string[] => {
    const slots: string[] = []
    const startHour = 9
    const endHour = 17
    const lunchStart = 12
    const lunchEnd = 14

    let currentHour = startHour
    let minuteOffset = 0

    for (let i = 0; i < count; i++) {
      if (currentHour >= lunchStart && currentHour < lunchEnd) {
        currentHour = lunchEnd
      }

      if (currentHour >= endHour) break

      slots.push(`${String(currentHour).padStart(2, '0')}:${String(minuteOffset).padStart(2, '0')}`)

      // Increment time based on visits per day
      const minutesPerVisit = Math.floor((endHour - startHour - 2) * 60 / count)
      minuteOffset += minutesPerVisit

      if (minuteOffset >= 60) {
        currentHour += Math.floor(minuteOffset / 60)
        minuteOffset = minuteOffset % 60
      }
    }

    return slots.length > 0 ? slots : ['09:00', '14:00']
  }

  // Intelligent routing: group clients by proximity
  const assignClientsIntelligently = (clientList: Client[], perDay: number): Client[][] => {
    const days: Client[][] = []
    const remaining = [...clientList]

    while (remaining.length > 0) {
      const dayClients: Client[] = []

      // Start with first client in remaining
      if (remaining.length > 0) {
        dayClients.push(remaining.shift()!)
      }

      // Add closest clients to current selection
      while (dayClients.length < perDay && remaining.length > 0) {
        let closestIdx = 0
        let minDistance = Infinity

        // Find client closest to any client in current day
        for (let i = 0; i < remaining.length; i++) {
          for (const dayClient of dayClients) {
            // Calculate distance between towns (simplified: same town = 0, different = 1)
            const distance = remaining[i].town === dayClient.town ? 0 : 1

            if (distance < minDistance) {
              minDistance = distance
              closestIdx = i
            }
          }
        }

        dayClients.push(remaining.splice(closestIdx, 1)[0])
      }

      days.push(dayClients)
    }

    return days
  }

  // Assign clients intelligently to days
  const clientsByDay = assignClientsIntelligently(sortedByPriority, visitsPerDay)

  // Create 90-day calendar (only Tuesday-Friday)
  const today = new Date()
  const plan: DailyPlan[] = []
  const timeSlots = generateTimeSlots(visitsPerDay)
  let dayIndex = 0

  for (let i = 0; i < 180; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dayOfWeek = date.getDay()

    // Only work Tuesday (2) to Friday (5)
    if (dayOfWeek < 2 || dayOfWeek > 5) continue

    if (dayIndex >= clientsByDay.length) break

    const dateStr = date.toISOString().split('T')[0]
    const visits: VisitDay[] = []
    const dayClients = clientsByDay[dayIndex]

    // Sort day's clients by proximity within the day (nearest neighbor)
    const sortedDayClients = sortClientsByProximity(dayClients, homeCoords)

    // Create visits for this day
    sortedDayClients.forEach((client, visitIdx) => {
      const distance = getDistanceFromHome(client.town, homeCoords)

      let urgency: 'urgent' | 'attention' | 'ok' = 'ok'
      if (client.daysSinceLastVisit > 200) urgency = 'urgent'
      else if (client.daysSinceLastVisit >= 130) urgency = 'attention'

      visits.push({
        id: `${dateStr}-${visitIdx}`,
        clientName: client.customerDetails,
        town: client.town,
        distance,
        urgency,
        timeSlot: timeSlots[visitIdx % timeSlots.length],
        completed: false,
        notes: '',
        quality: client.quality,
      })
    })

    if (visits.length > 0) {
      const totalKm = visits.reduce((sum, v) => sum + v.distance, 0)
      plan.push({ date: dateStr, visits, totalKm })
    }

    dayIndex++
  }

  return plan
}

// Helper: Sort clients for a day by proximity (nearest neighbor)
function sortClientsByProximity(clients: Client[], homeCoords: CityCoord): Client[] {
  if (clients.length <= 1) return clients

  const sorted: Client[] = []
  const remaining = [...clients]

  // Start with first client
  sorted.push(remaining.shift()!)

  // Greedily add nearest neighbor
  while (remaining.length > 0) {
    let nearestIdx = 0
    let minDistance = Infinity

    const lastClient = sorted[sorted.length - 1]

    for (let i = 0; i < remaining.length; i++) {
      // Same town = highest priority (distance 0)
      if (remaining[i].town === lastClient.town) {
        nearestIdx = i
        minDistance = 0
        break
      }
    }

    // If no same town, take first remaining
    if (minDistance === Infinity) {
      nearestIdx = 0
    }

    sorted.push(remaining.splice(nearestIdx, 1)[0])
  }

  return sorted
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
