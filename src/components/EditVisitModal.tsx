import React, { useState } from 'react'
import { X, Clock, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import type { VisitDay } from '../types'

interface EditVisitModalProps {
  visit: VisitDay
  isOpen: boolean
  onClose: () => void
  onSave: (visit: VisitDay) => void
}

export function EditVisitModal({ visit, isOpen, onClose, onSave }: EditVisitModalProps) {
  const [timeSlot, setTimeSlot] = useState(visit.timeSlot)
  const [notes, setNotes] = useState(visit.notes)

  const handleSave = () => {
    onSave({
      ...visit,
      timeSlot,
      notes,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              {visit.clientName}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {visit.town} • {visit.distance} km
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Time Slot */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Clock className="h-4 w-4" />
              Orario
            </label>
            <input
              type="time"
              value={timeSlot}
              onChange={(e) => setTimeSlot(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <FileText className="h-4 w-4" />
              Note
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi note per questa visita..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Urgency badge */}
          <div className="pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Urgenza</p>
            <span className={`inline-block px-3 py-1 rounded-lg text-sm font-semibold ${
              visit.urgency === 'urgent'
                ? 'bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-100'
                : visit.urgency === 'attention'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
                  : 'bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-100'
            }`}>
              {visit.urgency}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition font-medium"
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
          >
            Salva
          </button>
        </div>
      </motion.div>
    </div>
  )
}
