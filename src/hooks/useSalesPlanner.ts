import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Client, DailyPlan, VisitDay } from '../types'
import { generatePlan } from '../utils/planning'
import { getCityCoordinates } from '../utils/geo'
import { useLocalStorage } from './useLocalStorage'

// One-time migration from the legacy combined 'salesPlannerState' blob to the
// per-key persistence below. Runs before the hook reads localStorage.
let legacyMigrated = false
function migrateLegacyState() {
  if (legacyMigrated) return
  legacyMigrated = true
  try {
    if (window.localStorage.getItem('salesPlanner.data')) return
    const legacy = window.localStorage.getItem('salesPlannerState')
    if (!legacy) return
    const s = JSON.parse(legacy)
    if (s?.data?.length) window.localStorage.setItem('salesPlanner.data', JSON.stringify(s.data))
    if (s?.homeAddress) window.localStorage.setItem('salesPlanner.homeAddress', JSON.stringify(s.homeAddress))
    if (s?.visitsPerDay != null) window.localStorage.setItem('salesPlanner.visitsPerDay', JSON.stringify(s.visitsPerDay))
    if (typeof s?.darkMode === 'boolean') window.localStorage.setItem('salesPlanner.darkMode', JSON.stringify(s.darkMode))
  } catch {
    // ignore malformed legacy state
  }
}

export function useSalesPlanner() {
  migrateLegacyState()

  // Persistent core state — survives reloads (incl. manual plan edits)
  const [data, setData] = useLocalStorage<Client[]>('salesPlanner.data', [])
  const [plan, setPlan] = useLocalStorage<DailyPlan[]>('salesPlanner.plan', [])
  const [homeAddress, setHomeAddress] = useLocalStorage('salesPlanner.homeAddress', 'Bruxelles')
  const [visitsPerDay, setVisitsPerDay] = useLocalStorage('salesPlanner.visitsPerDay', 7)
  const [darkMode, setDarkMode] = useLocalStorage('salesPlanner.darkMode', false)

  const [filter, setFilter] = useState<'all' | 'urgent' | 'attention' | 'ok'>('all')
  const [showSettings, setShowSettings] = useState(false)

  // Persistent per-visit state — auto-saved to localStorage
  const [completedVisitsArr, setCompletedVisitsArr] = useLocalStorage<string[]>('completedVisits', [])
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('visitNotes', {})
  const [voiceNotes, setVoiceNotes] = useLocalStorage<Record<string, string>>('voiceNotes', {})

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

  // Clear all loaded clients and the plan (also wipes persisted copies).
  const clearAll = useCallback(() => {
    setData([])
    setPlan([])
    setFilter('all')
  }, [setData, setPlan])

  // Auto-regenerate plan when routing settings change — but NOT on mount,
  // so a restored plan (with manual reorder/remove edits) is preserved.
  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      // On restore: only (re)generate if we have clients but no saved plan
      // (fresh data, migrated legacy state, or a cleared plan).
      if (data.length > 0 && plan.length === 0) {
        const homeCoords = getCityCoordinates(homeAddress)
        if (homeCoords) setPlan(generatePlan(data, homeCoords, visitsPerDay))
      }
      return
    }
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

  const removeVisit = useCallback((date: string, visitId: string) => {
    setPlan(prev =>
      prev.map(day =>
        day.date === date
          ? { ...day, visits: day.visits.filter(v => v.id !== visitId) }
          : day
      )
    )
  }, [])

  // Reorder a visit within the same day by dropping it onto another visit's slot.
  const reorderVisit = useCallback((date: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    setPlan(prev =>
      prev.map(day => {
        if (day.date !== date) return day
        const visits = [...day.visits]
        const from = visits.findIndex(v => v.id === draggedId)
        const to = visits.findIndex(v => v.id === targetId)
        if (from === -1 || to === -1) return day
        const [moved] = visits.splice(from, 1)
        visits.splice(to, 0, moved)
        return { ...day, visits }
      })
    )
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
    loadClients,
    clearAll,
    regeneratePlan,
    toggleComplete,
    updateNote,
    saveVoiceNote,
    setFilter,
    setHomeAddress,
    setVisitsPerDay,
    setShowSettings,
    setDarkMode,
    getFilteredPlan,
    getTotalMetrics,
    moveVisit,
    removeVisit,
    reorderVisit,
    updateVisit,
  }
}
