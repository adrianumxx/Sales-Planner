import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { Client, DailyPlan, VisitDay } from '../types'
import { generatePlan, recomputeDay, rollForwardDates } from '../utils/planning'
import { getCityCoordinates } from '../utils/geo'
import { loadGoogleMaps, geocodeAddress } from '../utils/googleMaps'
import { getAllVoiceNotes, putVoiceNote, deleteVoiceNote } from '../utils/voiceStore'
import { uploadVoiceNote, deleteVoiceNoteCloud, listVoiceNotes, downloadVoiceNote } from '../utils/voiceCloud'
import { useLocalStorage } from './useLocalStorage'
import { supabase } from '../lib/supabase'

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

export function useSalesPlanner(userId?: string) {
  migrateLegacyState()

  // Persistent core state — survives reloads (incl. manual plan edits)
  const [data, setData] = useLocalStorage<Client[]>('salesPlanner.data', [])
  const [plan, setPlan] = useLocalStorage<DailyPlan[]>('salesPlanner.plan', [])
  const [homeAddress, setHomeAddress] = useLocalStorage('salesPlanner.homeAddress', 'Bruxelles')
  // Evening return point; empty = round trip back to the start.
  const [returnAddress, setReturnAddress] = useLocalStorage('salesPlanner.returnAddress', '')
  const [visitsPerDay, setVisitsPerDay] = useLocalStorage('salesPlanner.visitsPerDay', 7)
  const [darkMode, setDarkMode] = useLocalStorage('salesPlanner.darkMode', false)
  // List-view horizon (weeks shown before the rest collapses into "Backlog"); 0 = all.
  const [planHorizonWeeks, setPlanHorizonWeeks] = useLocalStorage('salesPlanner.planHorizonWeeks', 4)
  // Max driving distance per day (round trip, km); 0 = no cap.
  const [maxKmPerDay, setMaxKmPerDay] = useLocalStorage('salesPlanner.maxKmPerDay', 0)

  // Vehicle: combustion vs electric. For EVs, evRangeKm drives mid-day charging
  // suggestions along each day's route. carModel is informational.
  const [vehicleType, setVehicleType] = useLocalStorage<'combustion' | 'electric'>('salesPlanner.vehicleType', 'combustion')
  const [evRangeKm, setEvRangeKm] = useLocalStorage('salesPlanner.evRangeKm', 300)
  const [carModel, setCarModel] = useLocalStorage('salesPlanner.carModel', '')

  // Optional Google Maps key (kept on this device only — not synced to cloud).
  // When set, client addresses are geocoded to precise street-level coordinates.
  const [mapsApiKey, setMapsApiKey] = useLocalStorage('salesPlanner.mapsApiKey', '')
  const [geoProgress, setGeoProgress] = useState<{ done: number; total: number } | null>(null)

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
      const end = (returnAddress && getCityCoordinates(returnAddress)) || homeCoords
      const newPlan = generatePlan(clients, homeCoords, visitsPerDay, adminDays, maxKmPerDay, end)
      setPlan(newPlan)
    }
  }, [homeAddress, returnAddress, visitsPerDay, adminDays, maxKmPerDay])

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
        if (homeCoords) {
          const end = (returnAddress && getCityCoordinates(returnAddress)) || homeCoords
          setPlan(generatePlan(data, homeCoords, visitsPerDay, adminDays, maxKmPerDay, end))
        }
      } else if (plan.length > 0) {
        // Refresh a restored plan: always re-date its buckets onto the canonical
        // Mon–Fri workday sequence (so the work-week rule + admin days are applied
        // uniformly, not just when dates drifted into the past), and recompute
        // route metrics. Bucket grouping, order and ids — i.e. manual edits — kept.
        const homeCoords = getCityCoordinates(homeAddress)
        const end = (returnAddress && getCityCoordinates(returnAddress)) || homeCoords
        setPlan(prev => {
          let next = rollForwardDates(prev, new Date(), adminDays)
          if (homeCoords) {
            next = next.map(day => {
              const r = recomputeDay(day.visits, homeCoords, false, end || homeCoords)
              return { ...day, visits: r.visits, totalKm: r.totalKm }
            })
          }
          return next
        })
      }
      return
    }
    if (data.length > 0) {
      const homeCoords = getCityCoordinates(homeAddress)
      if (homeCoords) {
        const end = (returnAddress && getCityCoordinates(returnAddress)) || homeCoords
        const newPlan = generatePlan(data, homeCoords, visitsPerDay, adminDays, maxKmPerDay, end)
        setPlan(newPlan)
      }
    }
  }, [homeAddress, returnAddress, visitsPerDay, maxKmPerDay])

  const regeneratePlan = useCallback(() => {
    const homeCoords = getCityCoordinates(homeAddress)
    if (homeCoords && data.length > 0) {
      const end = (returnAddress && getCityCoordinates(returnAddress)) || homeCoords
      const newPlan = generatePlan(data, homeCoords, visitsPerDay, adminDays, maxKmPerDay, end)
      setPlan(newPlan)
    }
  }, [data, homeAddress, returnAddress, visitsPerDay, adminDays, maxKmPerDay])

  // Precise geocoding pass (only when a Google Maps key is set). Resolves each
  // client's street address to exact coordinates, caches them, then regenerates
  // the plan so routing/distances reflect the real locations. Each client is
  // attempted once (geocoded flag), so this is a no-op after the first pass.
  useEffect(() => {
    if (!mapsApiKey) return
    const pending = data.filter(c => !c.geocoded && (c.address || c.town))
    if (pending.length === 0) return

    let cancelled = false
    ;(async () => {
      try { await loadGoogleMaps(mapsApiKey) } catch { return }
      if (cancelled) return
      setGeoProgress({ done: 0, total: pending.length })

      const byId = new Map(data.map(c => [c.id, c]))
      let done = 0
      for (const c of pending) {
        if (cancelled) return
        const p = await geocodeAddress(c.address ? `${c.address}, Belgium` : `${c.town}, Belgium`)
        const cur = byId.get(c.id)!
        byId.set(c.id, p ? { ...cur, lat: p.lat, lon: p.lon, geocoded: true } : { ...cur, geocoded: true })
        done++
        if (done % 5 === 0) setGeoProgress({ done, total: pending.length })
      }
      if (cancelled) return

      const updated = data.map(c => byId.get(c.id)!)
      setData(updated)
      const homeCoords = getCityCoordinates(homeAddress)
      if (homeCoords) {
        const end = (returnAddress && getCityCoordinates(returnAddress)) || homeCoords
        setPlan(generatePlan(updated, homeCoords, visitsPerDay, adminDays, maxKmPerDay, end))
      }
      setGeoProgress(null)
    })()
    return () => { cancelled = true }
  }, [mapsApiKey, data])

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
      // Empty blob signals deletion (local IndexedDB + cloud Storage)
      deleteVoiceNote(visitId).catch(() => {})
      if (userId) deleteVoiceNoteCloud(userId, visitId).catch(() => {})
      setVoiceNotes(prev => {
        const next = { ...prev }
        if (next[visitId]) URL.revokeObjectURL(next[visitId])
        delete next[visitId]
        return next
      })
      return
    }
    putVoiceNote(visitId, blob).catch(() => {})
    if (userId) uploadVoiceNote(userId, visitId, blob).catch(() => {})
    const url = URL.createObjectURL(blob)
    setVoiceNotes(prev => {
      if (prev[visitId]) URL.revokeObjectURL(prev[visitId])
      return { ...prev, [visitId]: url }
    })
  }, [userId])

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
      const end = (returnAddress && getCityCoordinates(returnAddress)) || home || undefined
      const apply = (day: DailyPlan, visits: VisitDay[], reoptimize: boolean): DailyPlan => {
        if (!home) return { ...day, visits }
        const r = recomputeDay(visits, home, reoptimize, end || home)
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
  }, [homeAddress, returnAddress])

  const removeVisit = useCallback((date: string, visitId: string) => {
    const home = getCityCoordinates(homeAddress)
    const end = (returnAddress && getCityCoordinates(returnAddress)) || home
    setPlan(prev =>
      prev.map(day => {
        if (day.date !== date) return day
        const visits = day.visits.filter(v => v.id !== visitId)
        if (!home) return { ...day, visits }
        const r = recomputeDay(visits, home, false, end || home)
        return { ...day, visits: r.visits, totalKm: r.totalKm }
      })
    )
  }, [homeAddress, returnAddress])

  // Reorder a visit within the same day by dropping it onto another visit's slot.
  const reorderVisit = useCallback((date: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return
    const home = getCityCoordinates(homeAddress)
    const end = (returnAddress && getCityCoordinates(returnAddress)) || home
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
        const r = recomputeDay(visits, home, false, end || home)
        return { ...day, visits: r.visits, totalKm: r.totalKm }
      })
    )
  }, [homeAddress, returnAddress])

  // Re-optimise a single day's driving route (nearest-neighbour + 2-opt) after
  // manual edits. Visit ids are preserved, so notes/completion/voice stay linked.
  const reoptimizeDay = useCallback((date: string) => {
    const home = getCityCoordinates(homeAddress)
    if (!home) return
    const end = (returnAddress && getCityCoordinates(returnAddress)) || home
    setPlan(prev =>
      prev.map(day => {
        if (day.date !== date) return day
        const r = recomputeDay(day.visits, home, true, end)
        return { ...day, visits: r.visits, totalKm: r.totalKm }
      })
    )
  }, [homeAddress, returnAddress])

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

  // ── Cloud sync (Supabase, per-user) ───────────────────────────────────────────
  // The full app state (minus voice audio, which stays in IndexedDB) is mirrored
  // to a single per-user row so it follows the rep across devices. Last-write-wins
  // by `updated_at`; localStorage stays the offline source of truth.
  const cloudState = useMemo(() => ({
    v: 1,
    data,
    plan,
    homeAddress,
    returnAddress,
    visitsPerDay,
    maxKmPerDay,
    vehicleType,
    evRangeKm,
    carModel,
    darkMode,
    adminDays: adminDaysArr,
    completed: completedVisitsArr,
    notes,
  }), [data, plan, homeAddress, returnAddress, visitsPerDay, maxKmPerDay, vehicleType, evRangeKm, carModel, darkMode, adminDaysArr, completedVisitsArr, notes])

  const cloudStateRef = useRef(cloudState)
  useEffect(() => { cloudStateRef.current = cloudState }, [cloudState])

  const hydratingRef = useRef(false)
  const pulledRef = useRef(false)

  const pushCloud = useCallback(async () => {
    if (!userId) return
    const updated_at = new Date().toISOString()
    try {
      const { error } = await supabase
        .from('planner_state')
        .upsert({ user_id: userId, state: cloudStateRef.current, updated_at })
      if (!error) window.localStorage.setItem('salesPlanner.cloudAt', updated_at)
    } catch {
      /* offline / RLS — keep working locally */
    }
  }, [userId])

  // Pull on login: apply remote if newer, otherwise push local up.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: row, error } = await supabase
          .from('planner_state')
          .select('state, updated_at')
          .eq('user_id', userId)
          .maybeSingle()
        if (cancelled || error) return
        const localAt = window.localStorage.getItem('salesPlanner.cloudAt') || ''
        if (row?.updated_at && row.updated_at > localAt && row.state) {
          hydratingRef.current = true
          const s = row.state as Record<string, any>
          if (Array.isArray(s.data)) setData(s.data)
          if (Array.isArray(s.plan)) setPlan(s.plan)
          if (typeof s.homeAddress === 'string') setHomeAddress(s.homeAddress)
          if (typeof s.returnAddress === 'string') setReturnAddress(s.returnAddress)
          if (typeof s.visitsPerDay === 'number') setVisitsPerDay(s.visitsPerDay)
          if (typeof s.maxKmPerDay === 'number') setMaxKmPerDay(s.maxKmPerDay)
          if (s.vehicleType === 'electric' || s.vehicleType === 'combustion') setVehicleType(s.vehicleType)
          if (typeof s.evRangeKm === 'number') setEvRangeKm(s.evRangeKm)
          if (typeof s.carModel === 'string') setCarModel(s.carModel)
          if (typeof s.darkMode === 'boolean') setDarkMode(s.darkMode)
          if (Array.isArray(s.adminDays)) setAdminDaysArr(s.adminDays)
          if (Array.isArray(s.completed)) setCompletedVisitsArr(s.completed)
          if (s.notes && typeof s.notes === 'object') setNotes(s.notes)
          window.localStorage.setItem('salesPlanner.cloudAt', row.updated_at)
          setTimeout(() => { hydratingRef.current = false }, 0)
        } else {
          await pushCloud()
        }
        pulledRef.current = true
      } catch {
        /* ignore — offline */
      }
    })()
    return () => { cancelled = true }
    // Run once per login. Setters from useLocalStorage aren't memoised, so they
    // are intentionally excluded to avoid re-pulling on every render.
  }, [userId])

  // Debounced push whenever the state changes (after the initial pull).
  useEffect(() => {
    if (!userId || !pulledRef.current || hydratingRef.current) return
    const id = setTimeout(() => { pushCloud() }, 800)
    return () => clearTimeout(id)
  }, [cloudState, userId, pushCloud])

  // Reconcile voice-note audio with Supabase Storage on login: pull notes that
  // exist only in the cloud into the local IndexedDB cache, and push local-only
  // notes up. (Audio is mirrored separately from the JSON state above.)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const [cloudIds, local] = await Promise.all([listVoiceNotes(userId), getAllVoiceNotes()])
        if (cancelled) return
        for (const id of cloudIds) {
          if (!local[id]) {
            const blob = await downloadVoiceNote(userId, id)
            if (blob && !cancelled) {
              await putVoiceNote(id, blob)
              const u = URL.createObjectURL(blob)
              setVoiceNotes(prev => (prev[id] ? prev : { ...prev, [id]: u }))
            }
          }
        }
        for (const id of Object.keys(local)) {
          if (!cloudIds.includes(id)) {
            await uploadVoiceNote(userId, id, local[id]).catch(() => {})
          }
        }
      } catch {
        /* offline — local cache still works */
      }
    })()
    return () => { cancelled = true }
  }, [userId])

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
    planHorizonWeeks,
    setPlanHorizonWeeks,
    maxKmPerDay,
    setMaxKmPerDay,
    vehicleType,
    setVehicleType,
    evRangeKm,
    setEvRangeKm,
    carModel,
    setCarModel,
    mapsApiKey,
    setMapsApiKey,
    geoProgress,
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
    returnAddress,
    setReturnAddress,
    setVisitsPerDay,
    setShowSettings,
    setDarkMode,
    getFilteredPlan,
    getTotalMetrics,
    moveVisit,
    removeVisit,
    reorderVisit,
    reoptimizeDay,
    updateVisit,
  }
}
