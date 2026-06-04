import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { DailyPlan } from '../types'
import { formatDateLabel, toDateStr } from './date'

export function exportToCSV(plan: DailyPlan[]): void {
  const rows = [['Date', 'Client', 'Town', 'Distance (km)', 'Urgency', 'Time', 'Completed', 'Notes']]

  plan.forEach(day => {
    day.visits.forEach(visit => {
      rows.push([
        day.date,
        visit.clientName,
        visit.town,
        visit.distance.toString(),
        visit.urgency,
        visit.timeSlot,
        visit.completed ? 'Yes' : 'No',
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
      const summary = `Visit: ${visit.clientName} (${visit.town})`
      const desc = `Client: ${visit.clientName}\\nTown: ${visit.town}\\nDistance: ${visit.distance}km\\nUrgency: ${visit.urgency}\\nNotes: ${visit.notes || 'N/A'}`

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

export function exportToPDF(plan: DailyPlan[]): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const totalVisits = plan.reduce((s, d) => s + d.visits.length, 0)
  const totalKm = Math.round(plan.reduce((s, d) => s + d.totalKm, 0) * 10) / 10

  // Title
  doc.setFontSize(18)
  doc.setTextColor(30, 30, 40)
  doc.text('Visit Plan', 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120, 120, 130)
  doc.text(
    `Generated ${new Date().toLocaleDateString('en-GB')}  ·  ${totalVisits} visits  ·  ${totalKm} km`,
    14, 25
  )

  const urgLabel = (u: string) =>
    u === 'urgent' ? 'Urgent' : u === 'attention' ? 'Attention' : 'OK'

  let y = 32

  plan.forEach((day) => {
    if (y > pageH - 30) { doc.addPage(); y = 18 }

    doc.setFontSize(12)
    doc.setTextColor(50, 50, 60)
    doc.text(
      `${formatDateLabel(day.date, { weekday: 'long', day: 'numeric', month: 'long' }, 'en-GB')}   ·   ${day.visits.length} visits · ${day.totalKm} km`,
      14, y
    )

    autoTable(doc, {
      startY: y + 3,
      head: [['Time', 'Client', 'Town', 'Address', 'Km', 'Status', 'Overdue']],
      body: day.visits.map((v) => [
        v.timeSlot,
        v.clientName,
        v.town,
        v.address || '-',
        v.distance ? String(v.distance) : '-',
        urgLabel(v.urgency),
        v.lastVisitDays ? `${v.lastVisitDays}d` : '-',
      ]),
      styles: { fontSize: 8, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 36 },
        2: { cellWidth: 24 },
        3: { cellWidth: 52 },
        4: { cellWidth: 12, halign: 'right' },
        5: { cellWidth: 20 },
        6: { cellWidth: 16, halign: 'right' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const u = day.visits[data.row.index]?.urgency
          if (u === 'urgent') data.cell.styles.textColor = [220, 38, 38]
          else if (u === 'attention') data.cell.styles.textColor = [217, 119, 6]
          else data.cell.styles.textColor = [22, 163, 74]
        }
      },
      margin: { left: 14, right: 14 },
    })

    // @ts-expect-error lastAutoTable is added by the plugin at runtime
    y = (doc.lastAutoTable?.finalY ?? y) + 9
  })

  // Page numbers
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(160, 160, 170)
    doc.text(`Page ${i} / ${pages}`, pageW - 32, pageH - 8)
  }

  doc.save(`visit-plan-${toDateStr(new Date())}.pdf`)
}
