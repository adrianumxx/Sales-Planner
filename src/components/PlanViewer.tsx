import React from 'react'
import { CheckCircle2, Circle, MapPin, Clock } from 'lucide-react'
import type { DailyPlan, VisitDay } from '../types'
import { getUrgencyColor, getUrgencyBadge } from '../utils/planning'

interface PlanViewerProps {
  plan: DailyPlan[]
  completedVisits: Set<string>
  notes: Record<string, string>
  onToggleComplete: (visitId: string) => void
  onUpdateNote: (visitId: string, note: string) => void
}

export function PlanViewer({
  plan,
  completedVisits,
  notes,
  onToggleComplete,
  onUpdateNote,
}: PlanViewerProps) {
  if (plan.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">No visits planned yet. Upload a CSV to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {plan.map(day => (
        <div key={day.date} className="bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-slate-50 dark:bg-slate-700 px-6 py-3 border-l-4 border-indigo-600">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-slate-900 dark:text-slate-50">
                {new Date(day.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </h3>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {day.visits.length} visit{day.visits.length !== 1 ? 's' : ''} • {day.totalKm} km
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {day.visits.map(visit => (
              <VisitRow
                key={visit.id}
                visit={visit}
                completed={completedVisits.has(visit.id)}
                notes={notes[visit.id] || ''}
                onToggleComplete={() => onToggleComplete(visit.id)}
                onUpdateNote={(note) => onUpdateNote(visit.id, note)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function VisitRow({
  visit,
  completed,
  notes,
  onToggleComplete,
  onUpdateNote,
}: {
  visit: VisitDay
  completed: boolean
  notes: string
  onToggleComplete: () => void
  onUpdateNote: (note: string) => void
}) {
  const [editingNote, setEditingNote] = React.useState(false)
  const [noteValue, setNoteValue] = React.useState(notes)

  const handleSaveNote = () => {
    onUpdateNote(noteValue)
    setEditingNote(false)
  }

  return (
    <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition">
      <div className="flex items-start gap-4">
        <button
          onClick={onToggleComplete}
          className="flex-shrink-0 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
        >
          {completed ? (
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getUrgencyBadge(visit.urgency)}</span>
              <h4 className={`font-semibold ${completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-50'}`}>
                {visit.clientName}
              </h4>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${getUrgencyColor(visit.urgency)}`}>
              {visit.urgency}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 mb-3 text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {visit.town} ({visit.distance} km)
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {visit.timeSlot}
            </div>
          </div>

          {editingNote ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-3 py-1 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button
                onClick={handleSaveNote}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingNote(true)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
            >
              {notes || 'Add note...'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
