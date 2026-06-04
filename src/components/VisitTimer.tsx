import React, { useState, useEffect } from 'react'
import { Play, Pause, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type TimerState = 'idle' | 'running' | 'paused'

interface VisitTimerProps {
  visitId: string
  onStateChange: (visitId: string, state: TimerState, elapsed: number, startTime?: number) => void
  state?: TimerState
  elapsed?: number
  startTime?: number
  pausedTime?: number
}

export function VisitTimer({
  visitId,
  onStateChange,
  state = 'idle',
  elapsed = 0,
  startTime,
  pausedTime = 0,
}: VisitTimerProps) {
  const [currentElapsed, setCurrentElapsed] = useState(elapsed)
  const [localStartTime, setLocalStartTime] = useState(startTime)
  const [localPausedTime, setLocalPausedTime] = useState(pausedTime)

  // Timer effect
  useEffect(() => {
    if (state !== 'running' || !localStartTime) return

    const interval = setInterval(() => {
      const now = Date.now()
      const runningTime = Math.floor((now - localStartTime) / 1000)
      const total = localPausedTime + runningTime
      setCurrentElapsed(total)
    }, 1000)

    return () => clearInterval(interval)
  }, [state, localStartTime, localPausedTime])

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const handleStart = () => {
    setLocalStartTime(Date.now())
    setLocalPausedTime(0)
    onStateChange(visitId, 'running', 0, Date.now())
  }

  const handlePause = () => {
    setLocalPausedTime(currentElapsed)
    onStateChange(visitId, 'paused', currentElapsed)
  }

  const handleResume = () => {
    setLocalStartTime(Date.now())
    onStateChange(visitId, 'running', currentElapsed, Date.now())
  }

  const handleStop = () => {
    onStateChange(visitId, 'idle', currentElapsed)
    setCurrentElapsed(0)
    setLocalStartTime(undefined)
    setLocalPausedTime(0)
  }

  return (
    <AnimatePresence mode="wait">
      {state === 'idle' ? (
        <motion.button
          key="start"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleStart}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs rounded-md transition-colors font-semibold"
        >
          <Play className="h-3.5 w-3.5" />
          Start
        </motion.button>
      ) : (
        <motion.div
          key="timer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="flex items-center gap-1.5 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 px-2.5 py-1.5 rounded-md border border-blue-300/30 dark:border-blue-600/30"
        >
          <motion.span
            key={currentElapsed}
            initial={{ scale: 1.05 }}
            animate={{ scale: 1 }}
            className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs min-w-14"
          >
            {formatTime(currentElapsed)}
          </motion.span>

          {state === 'running' ? (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePause}
                className="p-1 hover:bg-blue-500/20 rounded-md transition-colors"
                title="Pause"
              >
                <Pause className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                className="p-1 hover:bg-red-500/20 rounded-md transition-colors"
                title="Stop"
              >
                <Square className="h-3 w-3 text-red-600 dark:text-red-400" />
              </motion.button>
            </>
          ) : (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleResume}
                className="p-1 hover:bg-green-500/20 rounded-md transition-colors"
                title="Resume"
              >
                <Play className="h-3 w-3 text-green-600 dark:text-green-400" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleStop}
                className="p-1 hover:bg-red-500/20 rounded-md transition-colors"
                title="Stop"
              >
                <Square className="h-3 w-3 text-red-600 dark:text-red-400" />
              </motion.button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
