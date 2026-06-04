import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, X, GripVertical, Briefcase } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VisitDay } from '../types'
import { toDateStr, todayStr as getTodayStr, formatDateLabel, isWorkday as isWorkdayDate } from '../utils/date'

interface CalendarViewProps {
  plan: any[]
  onDateSelect: (date: string) => void
  selectedDate: string | null
  visitsByDate: Record<string, VisitDay[]>
  onRemoveVisit: (date: string, visitId: string) => void
  onVisitClick?: (visit: VisitDay, date: string) => void
  onMoveVisit?: (visit: VisitDay, fromDate: string, toDate: string) => void
  onReorderVisit?: (date: string, draggedId: string, targetId: string) => void
  onUpdateVisit?: (visit: VisitDay) => void
  visitsPerDay?: number
  adminDays?: Set<string>
  onToggleAdminDay?: (date: string) => void
}

export function CalendarView({
  plan,
  onDateSelect,
  selectedDate,
  visitsByDate,
  onRemoveVisit,
  onVisitClick,
  onMoveVisit,
  onReorderVisit,
  onUpdateVisit,
  visitsPerDay = 7,
  adminDays,
  onToggleAdminDay,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth())
  })
  const [draggedVisit, setDraggedVisit] = useState<{ visit: VisitDay; fromDate: string } | null>(null)

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
    return toDateStr(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))
  }

  const todayStr = getTodayStr()

  const isWorkday = (day: number) =>
    isWorkdayDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))

  const isPast = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    date.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const isToday = (day: number) => {
    return getDateString(day) === todayStr
  }

  // A day is interactive if it's a workday, not in the past, and has visits OR is today
  const isActive = (day: number) => {
    if (!isWorkday(day)) return false
    if (isPast(day)) return false
    return true
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
      className="bg-gradient-to-br from-white/50 to-slate-50/50 dark:from-slate-800/50 dark:to-slate-900/50 rounded-2xl p-3 sm:p-6 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-50"
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
      <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-1 sm:py-2"
          >
            <span className="sm:hidden">{day}</span>
            <span className="hidden sm:inline">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-7 gap-1 sm:gap-2"
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
          const active = isActive(day)
          const today = isToday(day)
          const past = isPast(day)
          const workday = isWorkday(day)

          // Visit summary for the day badge
          const urgentN = visits.filter(v => v.urgency === 'urgent').length
          const attentionN = visits.filter(v => v.urgency === 'attention').length
          const okN = visits.length - urgentN - attentionN
          const worst = urgentN > 0 ? 'urgent' : attentionN > 0 ? 'attention' : 'ok'
          const over = visits.length > visitsPerDay
          const isAdmin = !!adminDays?.has(dateStr)
          const isDropTarget = !!draggedVisit && draggedVisit.fromDate !== dateStr && active && !isAdmin
          const badgeColor =
            worst === 'urgent' ? 'bg-red-500' : worst === 'attention' ? 'bg-amber-500' : 'bg-green-500'
          const breakdown =
            `${visits.length} visit${visits.length === 1 ? '' : 's'}` +
            (urgentN ? ` · ${urgentN} urgent` : '') +
            (attentionN ? ` · ${attentionN} attention` : '') +
            (okN ? ` · ${okN} ok` : '') +
            (over ? ` · over capacity (${visitsPerDay}/day)` : '')

          return (
            <motion.button
              key={day}
              variants={dayVariants}
              whileHover={active ? { scale: 1.05 } : {}}
              whileTap={active ? { scale: 0.95 } : {}}
              onClick={() => active && onDateSelect(dateStr)}
              onDragOver={(e) => { if (isDropTarget) e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedVisit && onMoveVisit && draggedVisit.fromDate !== dateStr) {
                  onMoveVisit(draggedVisit.visit, draggedVisit.fromDate, dateStr)
                  setDraggedVisit(null)
                }
              }}
              className={`relative p-1 sm:p-3 rounded-lg transition-all duration-300 min-h-[36px] sm:min-h-0 ${
                isSelected
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/50'
                  : isAdmin && active
                    ? 'bg-slate-200 dark:bg-slate-600/50 text-slate-500 dark:text-slate-400 cursor-pointer'
                    : today
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 ring-2 ring-indigo-500 text-indigo-900 dark:text-indigo-100'
                      : active
                        ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-50 cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-700 cursor-default'
              } ${isDropTarget ? 'ring-2 ring-dashed ring-indigo-400' : ''} ${
                over && !isAdmin ? 'ring-2 ring-amber-400' : ''
              }`}
              disabled={!active}
              title={isAdmin ? 'Admin day — no visits scheduled' : visits.length > 0 ? breakdown : undefined}
            >
              <div className="text-xs sm:text-sm font-bold mb-0.5 sm:mb-1">{day}</div>

              {/* Admin day marker */}
              {isAdmin && (
                <span className="inline-flex items-center justify-center px-1.5 h-[18px] sm:h-5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wide bg-slate-400/30 dark:bg-slate-500/30 text-slate-600 dark:text-slate-300">
                  Admin
                </span>
              )}

              {/* Visit count badge — colour reflects the most urgent visit that day */}
              {!isAdmin && visits.length > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center justify-center gap-1"
                >
                  <span
                    className={`inline-flex items-center justify-center min-w-[18px] sm:min-w-[20px] h-[18px] sm:h-5 px-1 rounded-full text-[10px] sm:text-xs font-bold text-white ${badgeColor}`}
                  >
                    {visits.length}
                  </span>
                  {over && (
                    <span className="text-[10px] sm:text-xs font-bold text-amber-500 leading-none">!</span>
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
            className="mt-4 sm:mt-6 p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl w-full"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="font-bold text-slate-900 dark:text-slate-50">
                {formatDateLabel(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              {onToggleAdminDay && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onToggleAdminDay(selectedDate)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                    adminDays?.has(selectedDate)
                      ? 'bg-slate-600 text-white hover:bg-slate-700'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                  title="Admin days are skipped by the planner"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  {adminDays?.has(selectedDate) ? 'Admin day ✓' : 'Mark as admin'}
                </motion.button>
              )}
            </div>

            {adminDays?.has(selectedDate) && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                🗂️ Admin day — no visits are scheduled here. The planner reflows
                visits onto the other workdays.
              </p>
            )}

            {(visitsByDate[selectedDate] || []).length > 0 ? (
              <div className="space-y-2">
                {(visitsByDate[selectedDate] || []).map((visit) => (
                  <motion.div
                    key={visit.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    draggable
                    onDragStart={() => setDraggedVisit({ visit, fromDate: selectedDate })}
                    onDragEnd={() => setDraggedVisit(null)}
                    onDragOver={(e) => {
                      // Allow dropping only when reordering within the same day
                      if (draggedVisit && draggedVisit.fromDate === selectedDate) {
                        e.preventDefault()
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (
                        draggedVisit &&
                        draggedVisit.fromDate === selectedDate &&
                        onReorderVisit
                      ) {
                        onReorderVisit(selectedDate, draggedVisit.visit.id, visit.id)
                      }
                      setDraggedVisit(null)
                    }}
                    className={`flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg text-sm cursor-grab active:cursor-grabbing transition-all ${
                      draggedVisit?.visit.id === visit.id
                        ? 'opacity-50'
                        : draggedVisit?.fromDate === selectedDate
                          ? 'ring-1 ring-dashed ring-indigo-300 dark:ring-indigo-600'
                          : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1">
                      <GripVertical className="h-4 w-4 text-slate-400" />
                      <button
                        onClick={() => onVisitClick?.(visit, selectedDate)}
                        className="flex-1 text-left hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <span className="font-medium text-slate-900 dark:text-slate-50">
                          {visit.clientName.substring(0, 25)}
                        </span>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {visit.timeSlot} • {visit.distance}km
                        </div>
                      </button>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onRemoveVisit(selectedDate, visit.id)}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
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
