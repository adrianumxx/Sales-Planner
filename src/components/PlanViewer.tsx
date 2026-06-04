import React, { useMemo, useState } from 'react'
import {
  CheckCircle2, Circle, MapPin, Clock, Edit2, ExternalLink, History,
  ChevronDown, GripVertical, Pencil,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyPlan, VisitDay } from '../types'
import { getUrgencyBadge } from '../utils/planning'
import { formatDateLabel, parseLocalDate, toDateStr } from '../utils/date'
import { VoiceNoteRecorder } from './VoiceNoteRecorder'

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
}

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
}: PlanViewerProps) {
  const handleSaveVoiceNote = onSaveVoiceNote ?? (() => {})

  const weeks = useMemo(() => buildWeeks(plan), [plan])
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

  return (
    <div className="space-y-4">
      {weeks.map((week) => {
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
                        <div className="flex justify-between items-center px-3 sm:px-4 py-2 border-l-4 border-indigo-500 dark:border-cyan-400 bg-slate-50/60 dark:bg-slate-800/40">
                          <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-slate-50">
                            {formatDateLabel(day.date)}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 flex-shrink-0">
                            <span className="bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg font-semibold">{day.visits.length}v</span>
                            <span className="bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-lg font-semibold">{day.totalKm}km</span>
                          </div>
                        </div>

                        {/* Visits */}
                        <div className="divide-y divide-slate-200 dark:divide-slate-700">
                          {day.visits.map((visit) => (
                            <VisitRow
                              key={visit.id}
                              visit={visit}
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
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

function VisitRow({
  visit,
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
              {visit.distance > 0 && <span className="opacity-60">({visit.distance} km)</span>}
              <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </a>

            <div className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-lg">
              <Clock className="h-4 w-4" />
              {visit.timeSlot}
            </div>

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
