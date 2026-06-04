import { useState, useCallback, useEffect, useMemo } from 'react'
import type { Client, DailyPlan, VisitDay } from '../types'
import { generatePlan } from '../utils/planning'
import { getCityCoordinates } from '../utils/geo'
import { useLocalStorage } from './useLocalStorage'

type TimerState = 'idle' | 'running' | 'paused'

export function useSalesPlanner() {
  const [data, setData] = useState<Client[]>([])
  const [plan, setPlan] = useState<DailyPlan[]>([])
  const [homeAddress, setHomeAddress] = useState('Bruxelles')
  const [visitsPerDay, setVisitsPerDay] = useState(7)
  const [filter, setFilter] = useState<'all' | 'urgent' | 'attention' | 'ok'>('all')
  const [showSettings, setShowSettings] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  // Persistent state — auto-saved to localStorage
  const [completedVisitsArr, setCompletedVisitsArr] = useLocalStorage<string[]>('completedVisits', [])
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('visitNotes', {})
  const [voiceNotes, setVoiceNotes] = useLocalStorage<Record<string, string>>('voiceNotes', {})
  const [visitTimerStates, setVisitTimerStates] = useLocalStorage<Record<string, TimerState>>('visitTimerStates', {})
  const [visitElapsedTimes, setVisitElapsedTimes] = useLocalStorage<Record<string, number>>('visitElapsedTimes', {})
  const [visitStartTimes, setVisitStartTimes] = useLocalStorage<Record<string, number>>('visitStartTimes', {})
  const [visitPausedTimes, setVisitPausedTimes] = useLocalStorage<Record<string, number>>('visitPausedTimes', {})

  // Expose completedVisits as a Set for efficient .has() checks
  const completedVisits = useMemo(() => new Set(completedVisitsArr), [completedVisitsArr])

  const loadClients = useCallback((clients: Client[]) => {
    setData(clients)
    setFilter('all')
    const homeCoords = getCityCoordinates(homeAddress)
    if (homeCoords) {
      const newPlan = generatePlan(clients, homeCoords, visitsPerDay)
      setPlan(newPlan)
    }
  }, [homeAddress, visitsPerDay])

  // Auto-regenerate plan when settings change
  useEffect(() => {
    if (data.length > 0) {
      const homeCoords = getCityCoordinates(homeAddress)
      if (homeCoords) {
        const newPlan = generatePlan(data, homeCoords, visitsPerDay)
        setPlan(newPlan)
      }
    }
  }, [homeAddress, visitsPerDay])

  const regeneratePlan = useCallback(() => {
    const homeCoords = getCityCoordinates(homeAddress)
    if (homeCoords && data.length > 0) {
      const newPlan = generatePlan(data, homeCoords, visitsPerDay)
      setPlan(newPlan)
    }
  }, [data, homeAddress, visitsPerDay])

  const toggleComplete = useCallback((visitId: string) => {
    setCompletedVisitsArr(prev => {
      const set = new Set(prev)
      if (set.has(visitId)) set.delete(visitId)
      else set.add(visitId)
      return Array.from(set)
    })
  }, [setCompletedVisitsArr])

  const updateTimerState = useCallback((visitId: string, state: TimerState, elapsed: number, startTime?: number) => {
    setVisitTimerStates(prev => ({ ...prev, [visitId]: state }))
    setVisitElapsedTimes(prev => ({ ...prev, [visitId]: elapsed }))

    if (state === 'running' && startTime) {
      setVisitStartTimes(prev => ({ ...prev, [visitId]: startTime }))
      setVisitPausedTimes(prev => {
        const next = { ...prev }
        delete next[visitId]
        return next
      })
    } else if (state === 'paused') {
      setVisitPausedTimes(prev => ({ ...prev, [visitId]: elapsed }))
    } else if (state === 'idle') {
      // Keep elapsed time so the user can see how long the visit took
      setVisitStartTimes(prev => {
        const next = { ...prev }
        delete next[visitId]
        return next
      })
      setVisitPausedTimes(prev => {
        const next = { ...prev }
        delete next[visitId]
        return next
      })
    }
  }, [setVisitTimerStates, setVisitElapsedTimes, setVisitStartTimes, setVisitPausedTimes])

  const startVisit = useCallback((visitId: string) => {
    updateTimerState(visitId, 'running', 0, Date.now())
  }, [updateTimerState])

  const endVisit = useCallback((visitId: string) => {
    const elapsed = visitElapsedTimes[visitId] || 0
    updateTimerState(visitId, 'idle', elapsed)
  }, [visitElapsedTimes, updateTimerState])

  const updateNote = useCallback((visitId: string, note: string) => {
    setNotes(prev => ({ ...prev, [visitId]: note }))
  }, [setNotes])

  const saveVoiceNote = useCallback((visitId: string, blob: Blob) => {
    if (!blob.size) {
      // Empty blob signals deletion
      setVoiceNotes(prev => {
        const next = { ...prev }
        delete next[visitId]
        return next
      })
      return
    }
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setVoiceNotes(prev => ({ ...prev, [visitId]: base64 }))
    }
    reader.readAsDataURL(blob)
  }, [setVoiceNotes])

  const getFilteredPlan = useCallback((): DailyPlan[] => {
    if (filter === 'all') return plan
    return plan.map(day => ({
      ...day,
      visits: day.visits.filter(v => v.urgency === filter)
    })).filter(day => day.visits.length > 0)
  }, [plan, filter])

  const getTotalMetrics = useCallback(() => {
    let totalVisits = 0
    let totalKm = 0
    let urgentCount = 0
    let attentionCount = 0

    plan.forEach(day => {
      day.visits.forEach(v => {
        totalVisits++
        totalKm += v.distance
        if (v.urgency === 'urgent') urgentCount++
        else if (v.urgency === 'attention') attentionCount++
      })
    })

    return { totalVisits, totalKm: Math.round(totalKm * 10) / 10, urgentCount, attentionCount }
  }, [plan])

  const moveVisit = useCallback((fromDate: string, toDate: string, visitId: string) => {
    setPlan(prev => {
      let visitToMove: VisitDay | null = null

      for (const day of prev) {
        if (day.date === fromDate) {
          const visit = day.visits.find(v => v.id === visitId)
          if (visit) {
            visitToMove = visit
            break
          }
        }
      }

      if (!visitToMove) return prev

      return prev.map(day => {
        if (day.date === fromDate) {
          return { ...day, visits: day.visits.filter(v => v.id !== visitId) }
        }
        if (day.date === toDate) {
          return { ...day, visits: [...day.visits, visitToMove!] }
        }
        return day
      })
    })
  }, [])

  const updateVisit = useCallback((date: string, updatedVisit: VisitDay) => {
    setPlan(prev =>
      prev.map(day => {
        if (day.date === date) {
          return {
            ...day,
            visits: day.visits.map(v => v.id === updatedVisit.id ? updatedVisit : v)
          }
        }
        return day
      })
    )
  }, [])

  return {
    data,
    plan,
    filter,
    homeAddress,
    visitsPerDay,
    completedVisits,
    notes,
    voiceNotes,
    showSettings,
    darkMode,
    visitTimerStates,
    visitElapsedTimes,
    visitStartTimes,
    visitPausedTimes,
    loadClients,
    regeneratePlan,
    toggleComplete,
    updateNote,
    saveVoiceNote,
    updateTimerState,
    startVisit,
    endVisit,
    setFilter,
    setHomeAddress,
    setVisitsPerDay,
    setShowSettings,
    setDarkMode,
    getFilteredPlan,
    getTotalMetrics,
    moveVisit,
    updateVisit,
  }
}
