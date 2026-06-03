import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VisitDay } from '../types'

interface CalendarViewProps {
  plan: any[]
  onDateSelect: (date: string) => void
  selectedDate: string | null
  visitsByDate: Record<string, VisitDay[]>
  onRemoveVisit: (date: string, visitId: string) => void
}

export function CalendarView({
  plan,
  onDateSelect,
  selectedDate,
  visitsByDate,
  onRemoveVisit,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 5)) // June 2026

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  }

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDay = getFirstDayOfMonth(currentMonth)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const getDateString = (day: number) => {
    return new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
      .toISOString()
      .split('T')[0]
  }

  const isWorkday = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const dayOfWeek = date.getDay()
    return dayOfWeek >= 2 && dayOfWeek <= 5 // Tuesday to Friday
  }

  const getVisitsForDate = (day: number) => {
    const dateStr = getDateString(day)
    return visitsByDate[dateStr] || []
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { staggerChildren: 0.05 },
    },
  }

  const dayVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1 },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl p-6 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-bold text-slate-900 dark:text-slate-50"
        >
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </motion.h2>
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePrevMonth}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-7 gap-2"
      >
        {/* Empty days */}
        {emptyDays.map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {/* Calendar days */}
        {days.map((day) => {
          const dateStr = getDateString(day)
          const visits = getVisitsForDate(day)
          const isSelected = selectedDate === dateStr
          const isWorkday_ = isWorkday(day)

          return (
            <motion.button
              key={day}
              variants={dayVariants}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onDateSelect(dateStr)}
              className={`relative p-3 rounded-lg transition-all duration-300 ${
                isSelected
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/50'
                  : isWorkday_
                    ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-50'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
              }`}
              disabled={!isWorkday_}
            >
              <div className="text-sm font-bold mb-1">{day}</div>

              {/* Visit indicators */}
              {visits.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex flex-wrap gap-1"
                >
                  {visits.slice(0, 3).map((visit, idx) => (
                    <motion.div
                      key={visit.id}
                      whileHover={{ scale: 1.2 }}
                      className={`w-1.5 h-1.5 rounded-full ${
                        visit.urgency === 'urgent'
                          ? 'bg-red-500'
                          : visit.urgency === 'attention'
                            ? 'bg-amber-500'
                            : 'bg-green-500'
                      }`}
                      title={visit.clientName}
                    />
                  ))}
                  {visits.length > 3 && (
                    <span className="text-xs opacity-60">+{visits.length - 3}</span>
                  )}
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </motion.div>

      {/* Selected Date Details */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl"
          >
            <h3 className="font-bold text-slate-900 dark:text-slate-50 mb-3">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h3>

            {getVisitsForDate(parseInt(selectedDate.split('-')[2])).length > 0 ? (
              <div className="space-y-2">
                {getVisitsForDate(parseInt(selectedDate.split('-')[2])).map((visit) => (
                  <motion.div
                    key={visit.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg text-sm"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-50">
                      {visit.clientName.substring(0, 30)}...
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onRemoveVisit(selectedDate, visit.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                    >
                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No visits scheduled for this day
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
