import type { DailyPlan } from '../types'

export function exportToCSV(plan: DailyPlan[]): void {
  const rows = [['Data', 'Cliente', 'Città', 'Distanza (km)', 'Urgenza', 'Ora', 'Completato', 'Note']]

  plan.forEach(day => {
    day.visits.forEach(visit => {
      rows.push([
        day.date,
        visit.clientName,
        visit.town,
        visit.distance.toString(),
        visit.urgency,
        visit.timeSlot,
        visit.completed ? 'Sì' : 'No',
        visit.notes,
      ])
    })
  })

  const csv = rows.map(row =>
    row.map(cell => `"${cell}"`).join(',')
  ).join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `sales-plan-${new Date().toISOString().split('T')[0]}.csv`)
  link.click()
}

export function exportToICalendar(plan: DailyPlan[]): void {
  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Sales Planner//NONSGML v1.0//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Sales Plan
X-WR-TIMEZONE:Europe/Brussels
X-WR-CALDESC:Sales visits planning calendar
`

  plan.forEach(day => {
    day.visits.forEach((visit, idx) => {
      const [year, month, date] = day.date.split('-')
      const [hour, minute] = visit.timeSlot.split(':')
      const startDt = `${year}${month}${date}T${hour}${minute}00`
      const endDt = `${year}${month}${date}T${String(parseInt(hour) + 1).padStart(2, '0')}${minute}00`
      const uid = `${day.date}-${visit.id}@salesplanner.local`
      const summary = `Visita: ${visit.clientName} (${visit.town})`
      const desc = `Cliente: ${visit.clientName}\\nCittà: ${visit.town}\\nDistanza: ${visit.distance}km\\nUrgenza: ${visit.urgency}\\nNote: ${visit.notes || 'N/A'}`

      ical += `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${startDt}
DTEND:${endDt}
SUMMARY:${summary}
DESCRIPTION:${desc}
LOCATION:${visit.town}
CATEGORIES:${visit.urgency}
STATUS:${visit.completed ? 'COMPLETED' : 'CONFIRMED'}
END:VEVENT
`
    })
  })

  ical += `END:VCALENDAR`

  const blob = new Blob([ical], { type: 'text/calendar;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `sales-plan-${new Date().toISOString().split('T')[0]}.ics`)
  link.click()
}
