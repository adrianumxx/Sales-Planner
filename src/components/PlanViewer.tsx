import React, { useMemo, useState } from 'react'
import {
  CheckCircle2, Circle, MapPin, Clock, Edit2, ExternalLink, History,
  ChevronDown, GripVertical, Pencil, Archive, Route, Navigation, Wand2, Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyPlan, VisitDay, OpeningHours } from '../types'
import { getUrgencyBadge } from '../utils/planning'
import { nearestCharger, resolveCoords } from '../utils/geo'
import { formatDateLabel, parseLocalDate, toDateStr, weekdayOf } from '../utils/date'
import { VoiceNoteRecorder } from './VoiceNoteRecorder'

const fmtHM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/**
 * Day header label with a relative prefix: "Today" / "Tomorrow" for the next two
 * days, then the plain weekday + date. The date stays visible for clarity.
 */
function relativeDayLabel(dateStr: string): string {
  const today = toDateStr(new Date())
  const tmr = new Date()
  tmr.setDate(tmr.getDate() + 1)
  const tomorrow = toDateStr(tmr)
  const date = formatDateLabel(dateStr, { weekday: 'short', month: 'short', day: 'numeric' })
  if (dateStr === today) return `Today · ${date}`
  if (dateStr === tomorrow) return `Tomorrow · ${date}`
  return formatDateLabel(dateStr)
}

/**
 * Short opening-hours label for a venue on a given date, e.g. "09:00–18:00"
 * or "Closed". Returns null when hours are unknown (nothing to show).
 */
function hoursLabel(hours: OpeningHours | undefined, dateStr: string): string | null {
  if (!hours) return null
  const iv = hours.days[weekdayOf(dateStr)]
  if (!iv || iv.length === 0) return 'Closed'
  return iv.map(([a, b]) => `${fmtHM(a)}–${fmtHM(b)}`).join(', ')
}

// Charge before hitting empty: trigger a charging stop at 85% of range.
const RANGE_SAFETY = 0.85

interface ChargeStop {
  afterVisitId: string
  town: string
  atKm: number
  name?: string
  lat: number
  lon: number
  distanceKm: number
}

/**
 * Walk a day's route accumulating km; whenever the distance since departure (or
 * since the last charge) crosses the safe range, recommend a charge at the
 * nearest station to that stop, then reset the running distance.
 */
function dayChargeStops(day: DailyPlan, rangeKm: number): ChargeStop[] {
  if (!rangeKm) return []
  const safe = rangeKm * RANGE_SAFETY
  const stops: ChargeStop[] = []
  let cum = 0
  for (const v of day.visits) {
    cum += v.distance || 0
    if (cum >= safe) {
      // Fall back to town/address coords so charging still works on plans saved
      // before per-visit lat/lon existed.
      const p = v.lat != null && v.lon != null ? { lat: v.lat, lon: v.lon } : resolveCoords(v.town, v.address)
      const st = p ? nearestCharger(p.lat, p.lon) : null
      if (st) {
        stops.push({ afterVisitId: v.id, town: v.town, atKm: Math.round(cum), ...st })
        cum = 0
      }
    }
  }
  return stops
}

// Average regional driving speed (km/h) for the day drive-time estimate.
const AVG_SPEED_KMH = 60

/** "≈ 1h 20m" / "≈ 45m" drive-time estimate from total km. */
function driveTimeLabel(km: number): string {
  const mins = Math.round((km / AVG_SPEED_KMH) * 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h === 0 ? `≈ ${m}m` : m === 0 ? `≈ ${h}h` : `≈ ${h}h ${m}m`
}

/**
 * A point Google Maps can route to. We prefer the street ADDRESS, because our
 * stored coordinates are only town-level — so clients in the same town would
 * otherwise collapse to one identical pin. Google geocodes the street precisely.
 */
function mapsPoint(v: VisitDay): string {
  if (v.address) return encodeURIComponent(`${v.clientName}, ${v.address}`)
  if (v.lat != null && v.lon != null) return `${v.lat},${v.lon}`
  return encodeURIComponent(`${v.clientName}, ${v.town}, Belgium`)
}

/**
 * Google Maps turn-by-turn for the whole day. Origin is left to "your current
 * location"; client stops (and any charging stops, inserted in route order)
 * become waypoints; the last point is the destination. Consecutive duplicate
 * points are dropped, and the list is capped at Google's free waypoint limit.
 */
function dayRouteUrl(visits: VisitDay[], charges: ChargeStop[] = []): string {
  if (!visits.length) return '#'
  const pts: string[] = []
  for (const v of visits) {
    pts.push(mapsPoint(v))
    const ch = charges.find(c => c.afterVisitId === v.id)
    if (ch) pts.push(`${ch.lat},${ch.lon}`)   // charging station as a real stop
  }
  // Collapse repeats (e.g. several clients sharing one street address).
  const dedup = pts.filter((p, i) => i === 0 || p !== pts[i - 1])
  const MAX = 10
  const trimmed = dedup.length > MAX ? dedup.slice(0, MAX) : dedup
  const destination = trimmed[trimmed.length - 1]
  const waypoints = trimmed.slice(0, -1).join('|')
  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
  if (waypoints) url += `&waypoints=${waypoints}`
  return url
}

interface PlanViewerProps {
  plan: DailyPlan[]
  completedVisits: Set<string>
  notes: Record<string, string>
  voiceNotes?: Record<string, string>
  onToggleComplete: (visitId: string) => void
  onUpdateNote: (visitId: string, note: string) => void
  onSaveVoiceNote?: (visitId: string, audioData: Blob) => void
  /** When true, visits can be clicked to edit and dragged to move/reorder. */
  editable?: boolean
  onEditVisit?: (visit: VisitDay, date: string) => void
  onMoveVisit?: (visit: VisitDay, fromDate: string, toDate: string) => void
  onReorderVisit?: (date: string, draggedId: string, targetId: string) => void
  onReoptimizeDay?: (date: string) => void
  /** Weeks shown before the rest collapses into a Backlog section. 0 = show all. */
  horizonWeeks?: number
  /** EV starting range in km (0 = combustion / off → no charging suggestions). */
  evRangeKm?: number
}

const BACKLOG_KEY = '__backlog__'

/** Monday (local) of the week a date falls in — used as the week-group key. */
function weekKey(dateStr: string): string {
  const d = parseLocalDate(dateStr)
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toDateStr(monday)
}

interface WeekGroup {
  key: string
  label: string
  days: DailyPlan[]
  visitCount: number
  totalKm: number
  urgentCount: number
}

function buildWeeks(plan: DailyPlan[]): WeekGroup[] {
  const todayMonday = weekKey(toDateStr(new Date()))
  const nm = parseLocalDate(todayMonday)
  nm.setDate(nm.getDate() + 7)
  const nextMonday = toDateStr(nm)

  const map = new Map<string, DailyPlan[]>()
  for (const day of plan) {
    const k = weekKey(day.date)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(day)
  }
  const keys = [...map.keys()].sort()
  return keys.map((key) => {
    const days = map.get(key)!
    const visitCount = days.reduce((s, d) => s + d.visits.length, 0)
    const totalKm = Math.round(days.reduce((s, d) => s + d.totalKm, 0) * 10) / 10
    const urgentCount = days.reduce(
      (s, d) => s + d.visits.filter(v => v.urgency === 'urgent').length, 0,
    )
    const first = days[0].date
    const last = days[days.length - 1].date
    const range = `${formatDateLabel(first, { month: 'short', day: 'numeric' })} – ${formatDateLabel(last, { month: 'short', day: 'numeric' })}`
    // Date range is the unambiguous primary label; a relative tag is added only
    // for the current and next week.
    const rel = key === todayMonday ? 'This week · ' : key === nextMonday ? 'Next week · ' : ''
    return { key, label: `${rel}${range}`, days, visitCount, totalKm, urgentCount }
  })
}

export function PlanViewer({
  plan,
  completedVisits,
  notes,
  voiceNotes = {},
  onToggleComplete,
  onUpdateNote,
  onSaveVoiceNote,
  editable = false,
  onEditVisit,
  onMoveVisit,
  onReorderVisit,
  onReoptimizeDay,
  horizonWeeks = 0,
  evRangeKm = 0,
}: PlanViewerProps) {
  const handleSaveVoiceNote = onSaveVoiceNote ?? (() => {})

  const weeks = useMemo(() => buildWeeks(plan), [plan])

  // EV charging suggestions per day (only when an EV range is set).
  const chargeByDate = useMemo(() => {
    const m: Record<string, ChargeStop[]> = {}
    if (evRangeKm > 0) for (const d of plan) m[d.date] = dayChargeStops(d, evRangeKm)
    return m
  }, [plan, evRangeKm])
  const todayMonday = weekKey(toDateStr(new Date()))

  // Expanded weeks: default to the current week (or the first one).
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const w = buildWeeks(plan)
    if (!w.length) return new Set()
    const initial = w.find(g => g.key === todayMonday) ?? w[0]
    return new Set([initial.key])
  })
  const toggleWeek = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const [dragged, setDragged] = useState<{ visit: VisitDay; fromDate: string } | null>(null)
  const handleDropOn = (targetDate: string, targetVisit: VisitDay) => {
    if (!dragged) return
    if (dragged.fromDate === targetDate) onReorderVisit?.(targetDate, dragged.visit.id, targetVisit.id)
    else onMoveVisit?.(dragged.visit, dragged.fromDate, targetDate)
    setDragged(null)
  }

  if (plan.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-900/30 rounded-2xl p-8 sm:p-16 text-center backdrop-blur-sm border border-slate-200 dark:border-slate-700"
      >
        <div className="text-5xl mb-4">📅</div>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          No visits planned yet. Upload a CSV to get started.
        </p>
      </motion.div>
    )
  }

  const renderWeek = (week: WeekGroup) => {
    const isOpen = expanded.has(week.key)
    return (
      <div
        key={week.key}
        className="rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-700/70 bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm"
      >
        {/* Week header — click to expand/collapse */}
        <button
          onClick={() => toggleWeek(week.key)}
          className="w-full flex items-center justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-indigo-600/10 to-purple-600/10 dark:from-indigo-500/20 dark:to-purple-600/20 hover:from-indigo-600/15 hover:to-purple-600/15 transition-colors"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <motion.span animate={{ rotate: isOpen ? 0 : -90 }} className="flex-shrink-0">
              <ChevronDown className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
            </motion.span>
            <span className="font-bold text-sm sm:text-lg text-slate-900 dark:text-slate-50 truncate">
              {week.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs flex-shrink-0">
            {week.urgentCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg font-semibold bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100">
                {week.urgentCount} urgent
              </span>
            )}
            <span className="px-2 py-0.5 rounded-lg font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-slate-700 dark:text-slate-200">
              {week.visitCount}v
            </span>
            <span className="hidden sm:inline px-2 py-0.5 rounded-lg font-semibold bg-purple-100 dark:bg-purple-900/30 text-slate-700 dark:text-slate-200">
              {week.totalKm}km
            </span>
          </div>
        </button>

        {/* Week body */}
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="p-2 sm:p-3 space-y-3">
                {week.days.map((day) => (
                  <div
                    key={day.date}
                    className="rounded-xl overflow-hidden bg-white/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    {/* Day header */}
                    <div className="flex justify-between items-center gap-2 px-3 sm:px-4 py-2 border-l-4 border-indigo-500 dark:border-cyan-400 bg-slate-50/60 dark:bg-slate-800/40">
                      <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-50 truncate">
                        {relativeDayLabel(day.date)}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 flex-shrink-0">
                        <span className="bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg font-semibold">{day.visits.length}v</span>
                        <span className="bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-lg font-semibold">{day.totalKm}km</span>
                        {evRangeKm > 0 && (
                          (chargeByDate[day.date]?.length ?? 0) > 0 ? (
                            <span className="flex items-center gap-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-lg font-semibold" title="Charging stop(s) recommended on this day">
                              <Zap className="h-3.5 w-3.5" />{chargeByDate[day.date].length} charge
                            </span>
                          ) : (
                            <span className="hidden sm:flex items-center gap-0.5 bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg font-medium" title={`Within range — ${day.totalKm} of ${evRangeKm} km`}>
                              <Zap className="h-3.5 w-3.5" />in range
                            </span>
                          )
                        )}
                        <span className="hidden sm:inline bg-slate-200/70 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg font-medium" title="Estimated driving time (round trip)">
                          {driveTimeLabel(day.totalKm)}
                        </span>
                        {editable && onReoptimizeDay && day.visits.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onReoptimizeDay(day.date) }}
                            className="flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-lg font-semibold transition-colors"
                            title="Re-optimize this day's driving route"
                          >
                            <Wand2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Optimize</span>
                          </button>
                        )}
                        {day.visits.length > 0 && (
                          <a
                            href={dayRouteUrl(day.visits, chargeByDate[day.date])}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded-lg font-semibold transition-colors"
                            title="Navigate the whole day (clients + charging) in Google Maps"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Navigate</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Visits */}
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {day.visits.map((visit) => {
                        const charge = chargeByDate[day.date]?.find(c => c.afterVisitId === visit.id)
                        return (
                          <React.Fragment key={visit.id}>
                            <VisitRow
                              visit={visit}
                              dayDate={day.date}
                              completed={completedVisits.has(visit.id)}
                              noteText={notes[visit.id] || ''}
                              hasVoiceNote={!!voiceNotes[visit.id]}
                              voiceNoteUrl={voiceNotes[visit.id]}
                              editable={editable}
                              isDragging={dragged?.visit.id === visit.id}
                              isDropActive={!!dragged && dragged.visit.id !== visit.id}
                              onToggleComplete={() => onToggleComplete(visit.id)}
                              onUpdateNote={(note) => onUpdateNote(visit.id, note)}
                              onSaveVoiceNote={(audio) => handleSaveVoiceNote(visit.id, audio)}
                              onEdit={() => onEditVisit?.(visit, day.date)}
                              onDragStart={() => setDragged({ visit, fromDate: day.date })}
                              onDragEnd={() => setDragged(null)}
                              onDropOn={() => handleDropOn(day.date, visit)}
                            />
                            {charge && (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${charge.lat},${charge.lon}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-800 dark:text-green-200 transition-colors"
                                title="Open this charging station in Google Maps"
                              >
                                <Zap className="h-4 w-4 flex-shrink-0" />
                                <span className="text-xs sm:text-sm">
                                  <span className="font-semibold">Charge here</span>
                                  {' · '}{charge.name || 'Charging station'}
                                  <span className="opacity-70"> · {charge.distanceKm} km from {charge.town} · ~{charge.atKm} km driven</span>
                                </span>
                                <Navigation className="h-3.5 w-3.5 ml-auto flex-shrink-0 opacity-70" />
                              </a>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // Split the plan into an active horizon and a collapsed backlog.
  const limit = horizonWeeks > 0 ? horizonWeeks : weeks.length
  const horizonList = weeks.slice(0, limit)
  const backlog = weeks.slice(limit)
  const backlogVisits = backlog.reduce((s, w) => s + w.visitCount, 0)
  const backlogKm = Math.round(backlog.reduce((s, w) => s + w.totalKm, 0) * 10) / 10
  const backlogUrgent = backlog.reduce((s, w) => s + w.urgentCount, 0)
  const backlogOpen = expanded.has(BACKLOG_KEY)

  return (
    <div className="space-y-4">
      {horizonList.map(renderWeek)}

      {backlog.length > 0 && (
        <div className="rounded-2xl overflow-hidden border border-slate-300/70 dark:border-slate-600/70 bg-slate-100/50 dark:bg-slate-800/50">
          <button
            onClick={() => toggleWeek(BACKLOG_KEY)}
            className="w-full flex items-center justify-between gap-3 px-3 sm:px-5 py-3 sm:py-4 bg-slate-200/50 dark:bg-slate-700/40 hover:bg-slate-200/80 dark:hover:bg-slate-700/60 transition-colors"
            aria-expanded={backlogOpen}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <motion.span animate={{ rotate: backlogOpen ? 0 : -90 }} className="flex-shrink-0">
                <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </motion.span>
              <Archive className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
              <span className="font-bold text-sm sm:text-lg text-slate-700 dark:text-slate-200 truncate">
                Backlog · {backlog.length} more week{backlog.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs flex-shrink-0">
              {backlogUrgent > 0 && (
                <span className="px-2 py-0.5 rounded-lg font-semibold bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100">
                  {backlogUrgent} urgent
                </span>
              )}
              <span className="px-2 py-0.5 rounded-lg font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                {backlogVisits}v
              </span>
              <span className="hidden sm:inline px-2 py-0.5 rounded-lg font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                {backlogKm}km
              </span>
            </div>
          </button>

          <AnimatePresence initial={false}>
            {backlogOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="p-2 sm:p-3 space-y-4">
                  {backlog.map(renderWeek)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function VisitRow({
  visit,
  dayDate,
  completed,
  noteText,
  hasVoiceNote,
  voiceNoteUrl,
  editable,
  isDragging,
  isDropActive,
  onToggleComplete,
  onUpdateNote,
  onSaveVoiceNote,
  onEdit,
  onDragStart,
  onDragEnd,
  onDropOn,
}: {
  visit: VisitDay
  dayDate: string
  completed: boolean
  noteText: string
  hasVoiceNote: boolean
  voiceNoteUrl?: string
  editable: boolean
  isDragging: boolean
  isDropActive: boolean
  onToggleComplete: () => void
  onUpdateNote: (note: string) => void
  onSaveVoiceNote: (audio: Blob) => void
  onEdit: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDropOn: () => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(noteText)

  const handleSaveNote = () => {
    onUpdateNote(noteValue)
    setEditingNote(false)
  }

  return (
    <div
      onDragOver={(e) => { if (editable && isDropActive) e.preventDefault() }}
      onDrop={(e) => { if (editable && isDropActive) { e.preventDefault(); onDropOn() } }}
      className={`p-3 sm:p-4 transition-all duration-200 ${
        completed ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-slate-100/50 dark:hover:bg-slate-700/30'
      } ${isDragging ? 'opacity-50' : ''} ${editable && isDropActive ? 'ring-1 ring-dashed ring-indigo-300 dark:ring-indigo-600 rounded-lg' : ''}`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Drag handle (move / reorder) */}
        {editable && (
          <button
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="flex-shrink-0 mt-1 cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-400 transition-colors"
            title="Drag to move or reorder"
            aria-label="Drag to move or reorder"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}

        {/* Checkbox */}
        <button
          onClick={onToggleComplete}
          className="flex-shrink-0 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full transition-all hover:scale-110"
        >
          {completed ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 drop-shadow" />
          ) : (
            <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title & urgency */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-3 mb-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <span className="text-lg sm:text-2xl flex-shrink-0">{getUrgencyBadge(visit.urgency)}</span>
              {editable ? (
                <button
                  onClick={onEdit}
                  className={`group flex items-center gap-1.5 font-bold text-sm sm:text-lg truncate text-left hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors ${
                    completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-50'
                  }`}
                  title="Click to edit visit"
                >
                  <span className="truncate">{visit.clientName}</span>
                  <Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                </button>
              ) : (
                <h4 className={`font-bold text-sm sm:text-lg truncate ${
                  completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-50'
                }`}>
                  {visit.clientName}
                </h4>
              )}
            </div>
            <span className={`text-xs font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg whitespace-nowrap flex-shrink-0 ${
              visit.urgency === 'urgent'
                ? 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
                : visit.urgency === 'attention'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
                  : 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
            }`}>
              {visit.urgency}
            </span>
          </div>

          {/* Info row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 text-sm text-slate-600 dark:text-slate-400">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                visit.address ? `${visit.clientName}, ${visit.address}` : `${visit.clientName}, ${visit.town}, Belgium`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 px-3 py-1 rounded-lg transition-colors"
              title="Open in Google Maps"
            >
              <MapPin className="h-4 w-4" />
              <span className="font-medium text-slate-700 dark:text-slate-300">{visit.town}</span>
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>

            {visit.distance > 0 && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 px-3 py-1 rounded-lg" title="Driving distance from the previous stop">
                <Route className="h-4 w-4" />
                {visit.distance} km
              </div>
            )}

            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg ${
              visit.outsideHours
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-purple-50 dark:bg-purple-900/20'
            }`}>
              <Clock className="h-4 w-4" />
              {visit.timeSlot}
            </div>

            {/* Opening hours for this weekday (when known via Google Places) */}
            {(() => {
              const label = hoursLabel(visit.openingHours, dayDate)
              if (!label) return null
              const closed = label === 'Closed'
              return (
                <div
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg ${
                    closed
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
                  } ${visit.openingHours && !visit.openingHours.verified ? 'opacity-70' : ''}`}
                  title={
                    visit.openingHours && !visit.openingHours.verified
                      ? 'Opening hours (unverified match — please double-check)'
                      : 'Opening hours from Google'
                  }
                >
                  <Clock className="h-4 w-4" />
                  {closed ? 'Closed today' : label}
                  {visit.openingHours && !visit.openingHours.verified && <span className="text-[10px]">?</span>}
                </div>
              )
            })()}

            {visit.outsideHours && (
              <div className="flex items-center gap-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-3 py-1 rounded-lg font-semibold" title="This visit falls outside the venue's opening hours">
                <Clock className="h-4 w-4" />
                Outside hours
              </div>
            )}

            {visit.lastVisitDays != null && visit.lastVisitDays > 0 && (
              <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-3 py-1 rounded-lg" title="Days since last visit">
                <History className="h-4 w-4" />
                {visit.lastVisitDays}d ago
              </div>
            )}
          </div>

          {/* Address */}
          {visit.address && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 pl-1 truncate">{visit.address}</p>
          )}

          {/* Notes & voice */}
          <div className="space-y-2">
            {editingNote ? (
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <input
                  type="text"
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveNote()}
                  placeholder="Add a note..."
                  className="w-full sm:flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingNote(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                <Edit2 className="h-3 w-3" />
                {noteText || 'Add note...'}
              </button>
            )}

            <VoiceNoteRecorder
              visitId={visit.id}
              onSaveVoiceNote={(_id, audio) => onSaveVoiceNote(audio)}
              hasVoiceNote={hasVoiceNote}
              voiceNoteUrl={voiceNoteUrl}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
