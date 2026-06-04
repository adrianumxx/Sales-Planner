import { useState, useCallback, useEffect } from 'react'
import type { Client, DailyPlan, CityCoord } from '../types'
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
  const [completedVisits, setCompletedVisits] = useState<Set<string>>(new Set())
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [showSettings, setShowSettings] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [visitTimerStates, setVisitTimerStates] = useLocalStorage<Record<string, TimerState>>('visitTimerStates', {})
  const [visitElapsedTimes, setVisitElapsedTimes] = useLocalStorage<Record<string, number>>('visitElapsedTimes', {})
  const [visitStartTimes, setVisitStartTimes] = useLocalStorage<Record<string, number>>('visitStartTimes', {})
  const [visitPausedTimes, setVisitPausedTimes] = useLocalStorage<Record<string, number>>('visitPausedTimes', {})

  const loadClients = useCallback((clients: Client[]) => {
    setData(clients)
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
    setCompletedVisits(prev => {
      const next = new Set(prev)
      if (next.has(visitId)) next.delete(visitId)
      else next.add(visitId)
      return next
    })
  }, [])

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
      setVisitElapsedTimes(prev => {
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
  }, [])

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

  return {
    data,
    plan,
    filter,
    homeAddress,
    visitsPerDay,
    completedVisits,
    notes,
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
  }
}
