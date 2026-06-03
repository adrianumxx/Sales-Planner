import { useState, useCallback, useEffect } from 'react'
import type { Client, DailyPlan, CityCoord } from '../types'
import { generatePlan } from '../utils/planning'
import { getCityCoordinates } from '../utils/geo'

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
    loadClients,
    regeneratePlan,
    toggleComplete,
    updateNote,
    setFilter,
    setHomeAddress,
    setVisitsPerDay,
    setShowSettings,
    setDarkMode,
    getFilteredPlan,
    getTotalMetrics,
  }
}
