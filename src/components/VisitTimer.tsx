import React, { useState, useEffect } from 'react'
import { Play, StopCircle, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VisitTimerProps {
  visitId: string
  onStartVisit: (visitId: string) => void
  onEndVisit: (visitId: string, duration: number) => void
  isActive: boolean
  startTime?: number
}

export function VisitTimer({
  visitId,
  onStartVisit,
  onEndVisit,
  isActive,
  startTime,
}: VisitTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  // Timer effect
  useEffect(() => {
    if (!isActive || !startTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const diff = Math.floor((now - startTime) / 1000)
      setElapsed(diff)
    }, 1000)

    return () => clearInterval(interval)
  }, [isActive, startTime])

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleStart = () => {
    onStartVisit(visitId)
  }

  const handleEnd = () => {
    if (startTime) {
      const duration = Math.floor((Date.now() - startTime) / 1000)
      onEndVisit(visitId, duration)
    }
  }

  const timerVariants = {
    initial: { scale: 0.8, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.8, opacity: 0 },
  }

  const pulseVariants = {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.1, 1],
      transition: { duration: 0.6, repeat: Infinity }
    }
  }

  return (
    <div className="flex items-center gap-2">
      <AnimatePresence mode="wait">
        {!isActive ? (
          <motion.button
            key="start"
            variants={timerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleStart}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs rounded-lg hover:shadow-lg hover:shadow-green-500/50 transition-all font-medium"
          >
            <Play className="h-4 w-4" />
            Start Visit
          </motion.button>
        ) : (
          <motion.div
            key="timer"
            variants={timerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 px-4 py-2 rounded-lg border-2 border-blue-300 dark:border-blue-700"
          >
            <motion.div variants={pulseVariants} initial="initial" animate="animate">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </motion.div>
            <motion.span
              key={elapsed}
              initial={{ scale: 1.2 }}
              animate={{ scale: 1 }}
              className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm min-w-16"
            >
              {formatTime(elapsed)}
            </motion.span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleEnd}
              className="flex items-center gap-1 px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg transition-colors font-medium"
            >
              <StopCircle className="h-3 w-3" />
              End
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
