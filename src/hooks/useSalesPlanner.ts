import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Client, DailyPlan, VisitDay } from '../types'
import { generatePlan, recomputeDay, rollForwardDates } from '../utils/planning'
import { getCityCoordinates } from '../utils/geo'
import { todayStr } from '../utils/date'
import { getAllVoiceNotes, putVoiceNote, deleteVoiceNote } from '../utils/voiceStore'
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

  // Admin days: workdays the rep spends on admin — no visits are scheduled there.
  const [adminDaysArr, setAdminDaysArr] = useLocalStorage<string[]>('salesPlanner.adminDays', [])
  const adminDays = useMemo(() => new Set(adminDaysArr), [adminDaysArr])

  // Persistent per-visit state — auto-saved to localStorage
  const [completedVisitsArr, setCompletedVisitsArr] = useLocalStorage<string[]>('completedVisits', [])
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('visitNotes', {})

  // Voice notes: audio blobs live in IndexedDB; this map holds object URLs for
  // playback (visitId → blob: URL), rebuilt on mount.
  const [voiceNotes, setVoiceNotes] = useState<Record<string, string>>({})

  // Expose completedVisits as a Set for efficient .has() checks
  const completedVisits = useMemo(() => new Set(completedVisitsArr), [completedVisitsArr])

  // Load voice notes from IndexedDB on mount (migrating any legacy base64 notes
  // out of localStorage first). Object URLs are revoked on unmount.
  useEffect(() => {
    const urls: string[] = []
    let cancelled = false
    ;(async () => {
      try {
        const legacy = window.localStorage.getItem('voiceNotes')
        if (legacy) {
          const map = JSON.parse(legacy) as Record<string, string>
          for (const [id, dataUrl] of Object.entries(map)) {
            try {
              const blob = await (await fetch(dataUrl)).blob()
              await putVoiceNote(id, blob)
            } catch { /* skip bad entry */ }
          }
          window.localStorage.removeItem('voiceNotes')
        }
      } catch { /* ignore */ }

      try {
        const blobs = await getAllVoiceNotes()
        if (cancelled) return
        const next: Record<string, string> = {}
        for (const [id, blob] of Object.entries(blobs)) {
          const u = URL.createObjectURL(blob)
          urls.push(u)
          next[id] = u
        }
        setVoiceNotes(next)
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true; urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [])

  const loadClients = useCallback((clients: Client[]) => {
    setData(clients)
    setFilter('all')
    const homeCoords = getCityCoordinates(homeAddress)
    if (homeCoords) {
      const newPlan = generatePlan(clients, homeCoords, visitsPerDay, adminDays)
      setPlan(newPlan)
    }
  }, [homeAddress, visitsPerDay, adminDays])

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
        if (homeCoords) setPlan(generatePlan(data, homeCoords, visitsPerDay, adminDays))
      } else if (plan.length > 0) {
        // Refresh a restored plan: roll dates forward if they've drifted into
        // the past, and recompute route metrics (so older saved plans pick up
        // real leg distances). Order and ids — i.e. manual edits — are kept.
        const homeCoords = getCityCoordinates(homeAddress)
        const drifted = plan[0].date < todayStr()
        if (drifted || homeCoords) {
          setPlan(prev => {
            let next = drifted ? rollForwardDates(prev, new Date(), adminDays) : prev
            if (homeCoords) {
              next = next.map(day => {
                const r = recomputeDay(day.visits, homeCoords, false)
                return { ...day, visits: r.visits, totalKm: r.totalKm }
              })
            }
            return next
          })
        }
      }
      return
    }
    if (data.length > 0) {
      const homeCoords = getCityCoordinates(homeAddress)
      if (homeCoords) {
        const newPlan = generatePlan(data, homeCoords, visitsPerDay, adminDays)
        setPlan(newPlan)
      }
    }
  }, [homeAddress, visitsPerDay])

  const regeneratePlan = useCallback(() => {
    const homeCoords = getCityCoordinates(homeAddress)
    if (homeCoords && data.length > 0) {
      const newPlan = generatePlan(data, homeCoords, visitsPerDay, adminDays)
      setPlan(newPlan)
    }
  }, [data, homeAddress, visitsPerDay, adminDays])

  // Mark/unmark a day as admin. Visits reflow onto the next free workdays,
  // preserving order, ids and manual edits (no full regeneration).
  const toggleAdminDay = useCallback((date: string) => {
    const set = new Set(adminDaysArr)
    if (set.has(date)) set.delete(date)
    else set.add(date)
    setAdminDaysArr(Array.from(set))
    setPlan(prev => rollForwardDates(prev, new Date(), set))
  }, [adminDaysArr, setAdminDaysArr, setPlan])

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
      deleteVoiceNote(visitId).catch(() => {})
      setVoiceNotes(prev => {
        const next = { ...prev }
        if (next[visitId]) URL.revokeObjectURL(next[visitId])
        delete next[visitId]
        return next
      })
      return
    }
    putVoiceNote(visitId, blob).catch(() => {})
    const url = URL.createObjectURL(blob)
    setVoiceNotes(prev => {
      if (prev[visitId]) URL.revokeObjectURL(prev[visitId])
      return { ...prev, [visitId]: url }
    })
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
      totalKm += day.totalKm   // real per-day route km (incl. return home)
      day.visits.forEach(v => {
        totalVisits++
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

      const home = getCityCoordinates(homeAddress)
      const apply = (day: DailyPlan, visits: VisitDay[], reoptimize: boolean): DailyPlan => {
        if (!home) return { ...day, visits }
        const r = recomputeDay(visits, home, reoptimize)
        return { ...day, visits: r.visits, totalKm: r.totalKm }
      }

      return prev.map(day => {
        if (day.date === fromDate) {
          return apply(day, day.visits.filter(v => v.id !== visitId), false)
        }
        if (day.date === toDate) {
          // Re-optimise the destination day so the inserted visit lands in route order.
          return apply(day, [...day.visits, visitToMove!], true)
        }
        return day
      })
    })
  }, [homeAddress])

  const removeVisit = useCallback((date: string, visitId: string) => {
    const home = getCityCoordinates(homeAddress)
    setPlan(prev =>
      prev.map(day => {
        if (day.date !== date) return day
        const visits = day.visits.filter(v => v.id !== visitId)
        if (!home) return { ...day, visits }
        const r = recomputeDay(visits, home, false)
        return { ...day, visits: r.visits, totalKm: r.totalKm }
      })
    )
  }, [homeAddress])

  // Reorder a visit within the same day by dropping it onto another visit's slot.
  const reorderVisit = useCallback((date: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const home = getCityCoordinates(homeAddress)
    setPlan(prev =>
      prev.map(day => {
        if (day.date !== date) return day
        const visits = [...day.visits]
        const from = visits.findIndex(v => v.id === draggedId)
        const to = visits.findIndex(v => v.id === targetId)
        if (from === -1 || to === -1) return day
        const [moved] = visits.splice(from, 1)
        visits.splice(to, 0, moved)
        // Keep the user's chosen order, just re-sequence times/distances.
        if (!home) return { ...day, visits }
        const r = recomputeDay(visits, home, false)
        return { ...day, visits: r.visits, totalKm: r.totalKm }
      })
    )
  }, [homeAddress])

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
    adminDays,
    toggleAdminDay,
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
