import React, { useState } from 'react'
import { CheckCircle2, Circle, MapPin, Clock, Trash2, Edit2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyPlan, VisitDay } from '../types'
import { getUrgencyColor, getUrgencyBadge } from '../utils/planning'
import { VoiceNoteRecorder } from './VoiceNoteRecorder'
import { VisitTimer } from './VisitTimer'

interface PlanViewerProps {
  plan: DailyPlan[]
  completedVisits: Set<string>
  notes: Record<string, string>
  voiceNotes?: Record<string, Blob>
  onToggleComplete: (visitId: string) => void
  onUpdateNote: (visitId: string, note: string) => void
  onSaveVoiceNote?: (visitId: string, audioData: Blob) => void
}

export function PlanViewer({
  plan,
  completedVisits,
  notes,
  voiceNotes = {},
  activeVisit,
  visitStartTimes = {},
  visitDurations = {},
  onToggleComplete,
  onUpdateNote,
  onSaveVoiceNote = (() => {}) as any,
  onStartVisit = (() => {}) as any,
  onEndVisit = (() => {}) as any,
}: PlanViewerProps) {
  if (plan.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50/50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-900/30 rounded-2xl p-16 text-center backdrop-blur-sm border border-slate-200 dark:border-slate-700"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 100 }}
          className="text-5xl mb-4"
        >
          📅
        </motion.div>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          No visits planned yet. Upload a CSV to get started.
        </p>
      </motion.div>
    )
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  const dayVariants = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 },
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-4"
    >
      <AnimatePresence mode="popLayout">
        {plan.map((day) => (
          <motion.div
            key={day.date}
            variants={dayVariants}
            layout
            className="bg-gradient-to-br from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50"
          >
            {/* Day Header */}
            <motion.div
              whileHover={{ x: 4 }}
              className="bg-gradient-to-r from-indigo-600/10 to-purple-600/10 dark:from-indigo-500/20 dark:to-purple-600/20 px-6 py-4 border-l-4 border-indigo-600 dark:border-cyan-400"
            >
              <div className="flex justify-between items-center">
                <motion.h3
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-bold text-lg text-slate-900 dark:text-slate-50"
                >
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </motion.h3>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300"
                >
                  <span className="bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1 rounded-lg font-semibold">
                    {day.visits.length} visit{day.visits.length !== 1 ? 's' : ''}
                  </span>
                  <span className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-lg font-semibold">
                    {day.totalKm} km
                  </span>
                </motion.div>
              </div>
            </motion.div>

            {/* Visits */}
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              <AnimatePresence>
                {day.visits.map((visit) => (
                  <VisitRow
                    key={visit.id}
                    visit={visit}
                    completed={completedVisits.has(visit.id)}
                    notes={notes[visit.id] || ''}
                    hasVoiceNote={!!voiceNotes[visit.id]}
                    isActiveVisit={activeVisit === visit.id}
                    visitStartTime={visitStartTimes[visit.id]}
                    visitDuration={visitDurations[visit.id]}
                    onToggleComplete={() => onToggleComplete(visit.id)}
                    onUpdateNote={(note) => onUpdateNote(visit.id, note)}
                    onSaveVoiceNote={(audio) => onSaveVoiceNote(visit.id, audio)}
                    onStartVisit={() => onStartVisit(visit.id)}
                    onEndVisit={(duration) => onEndVisit(visit.id, duration)}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}

function VisitRow({
  visit,
  completed,
  notes,
  hasVoiceNote,
  isActiveVisit,
  visitStartTime,
  visitDuration,
  onToggleComplete,
  onUpdateNote,
  onSaveVoiceNote,
  onStartVisit,
  onEndVisit,
}: {
  visit: VisitDay
  completed: boolean
  notes: string
  hasVoiceNote: boolean
  isActiveVisit: boolean
  visitStartTime?: number
  visitDuration?: number
  onToggleComplete: () => void
  onUpdateNote: (note: string) => void
  onSaveVoiceNote: (audio: Blob) => void
  onStartVisit: () => void
  onEndVisit: (duration: number) => void
}) {
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState(notes)

  const handleSaveNote = () => {
    onUpdateNote(noteValue)
    setEditingNote(false)
  }

  const rowVariants = {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 },
  }

  return (
    <motion.div
      variants={rowVariants}
      layout
      className={`p-4 transition-all duration-300 ${
        completed ? 'bg-green-50/30 dark:bg-green-900/10' : 'hover:bg-slate-100/50 dark:hover:bg-slate-700/30'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <motion.button
          onClick={onToggleComplete}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="flex-shrink-0 mt-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full transition-all"
        >
          <AnimatePresence mode="wait">
            {completed ? (
              <motion.div
                key="checked"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 drop-shadow-lg" />
              </motion.div>
            ) : (
              <motion.div
                key="unchecked"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600 hover:text-slate-400" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

        <div className="flex-1 min-w-0">
          {/* Title & Urgency & Timer */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 flex-1">
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-2xl"
              >
                {getUrgencyBadge(visit.urgency)}
              </motion.span>
              <h4
                className={`font-bold text-lg ${
                  completed
                    ? 'line-through text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {visit.clientName}
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <VisitTimer
                visitId={visit.id}
                onStartVisit={onStartVisit}
                onEndVisit={onEndVisit}
                isActive={isActiveVisit}
                startTime={visitStartTime}
              />
              <motion.span
                whileHover={{ scale: 1.05 }}
                className={`text-xs font-bold px-3 py-1 rounded-lg whitespace-nowrap ${
                  visit.urgency === 'urgent'
                    ? 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
                    : visit.urgency === 'attention'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
                      : 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
                }`}
              >
                {visit.urgency}
              </motion.span>
            </div>
          </div>

          {/* Info Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-4 mb-3 text-sm text-slate-600 dark:text-slate-400"
          >
            <div className="flex items-center gap-1 bg-blue-50/50 dark:bg-blue-900/20 px-3 py-1 rounded-lg">
              <MapPin className="h-4 w-4" />
              {visit.town} ({visit.distance} km)
            </div>
            <div className="flex items-center gap-1 bg-purple-50/50 dark:bg-purple-900/20 px-3 py-1 rounded-lg">
              <Clock className="h-4 w-4" />
              {visit.timeSlot}
            </div>
          </motion.div>

          {/* Notes Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="space-y-2"
          >
            {/* Text Notes */}
            {editingNote ? (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value)}
                  placeholder="Add a text note..."
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveNote}
                  className="px-4 py-2 text-xs bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  Save
                </motion.button>
              </motion.div>
            ) : (
              <motion.button
                whileHover={{ x: 2 }}
                onClick={() => setEditingNote(true)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-cyan-400 transition-colors flex items-center gap-1"
              >
                <Edit2 className="h-3 w-3" />
                {notes || 'Add text note...'}
              </motion.button>
            )}

            {/* Voice Notes */}
            <VoiceNoteRecorder
              visitId={visit.id}
              onSaveVoiceNote={onSaveVoiceNote}
              hasVoiceNote={hasVoiceNote}
            />
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
