import React, { useState, useRef, useCallback } from 'react'
import { Sparkles, X, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyPlan, VisitDay, Client } from '../types'
import { coordsForCity } from '../utils/geo'
import { planAreaCoverage } from '../utils/planning'
import { toDateStr, parseLocalDate } from '../utils/date'

export interface CommandResult {
  label: string
  description?: string
  days: DailyPlan[]
  totalVisits: number
  type?: 'filter' | 'area'
}

interface CommandBarProps {
  plan: DailyPlan[]
  clients: Client[]
  homeCoords: { lat: number; lon: number }
  visitsPerDay: number
  onResult: (result: CommandResult | null) => void
}

const TODAY    = toDateStr(new Date())
const TOMORROW = toDateStr(new Date(Date.now() + 86400000))

const DAY_NAMES: Record<string, number> = {
  domenica: 0, sunday: 0, dim: 0,
  lunedi: 1, lundi: 1, monday: 1, mon: 1,
  martedi: 2, mardi: 2, tuesday: 2, tue: 2,
  mercoledi: 3, mercredi: 3, wednesday: 3, wed: 3,
  giovedi: 4, jeudi: 4, thursday: 4, thu: 4,
  venerdi: 5, vendredi: 5, friday: 5, fri: 5,
  sabato: 6, samedi: 6, saturday: 6, sat: 6,
}

const RADII = [10, 20, 30, 50]

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '').trim()
}

const STOPWORDS = new Set([
  'le', 'la', 'les', 'di', 'da', 'a', 'su', 'per', 'in', 'con', 'e', 'el',
  'delle', 'della', 'del', 'dei', 'gli', 'il', 'lo', 'un', 'una', 'sur',
  'visite', 'visita', 'visit', 'fammi', 'mostra', 'show', 'dammi', 'give',
  'tutte', 'tutti', 'all', 'quelli', 'quelle', 'questa', 'questo',
  'urgenti', 'urgent', 'priorita', 'attenzione', 'attention',
  'oggi', 'domani', 'settimana', 'today', 'tomorrow', 'week', 'semaine',
  'cliente', 'client', 'clienti', 'sono', 'parto', 'partendo', 'plan',
  'ottimizza', 'route', 'pianifica', 'percorso', 'zona', 'zone', 'dintorni',
  'intorno', 'around', 'vicino', 'km', ...Object.keys(DAY_NAMES),
])

/** Find the first Belgian city named in the query (prefers two-word names). */
function findCity(words: string[]): { name: string; coord: { lat: number; lon: number } } | null {
  // Two-word names first (e.g. "la louviere")
  for (let i = 0; i < words.length - 1; i++) {
    const bg = `${words[i]} ${words[i + 1]}`
    const c = coordsForCity(bg)
    if (c) return { name: bg, coord: c }
  }
  for (const w of words) {
    if (w.length < 3 || STOPWORDS.has(w)) continue
    const c = coordsForCity(w)
    if (c) return { name: w, coord: c }
  }
  return null
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, ch => ch.toUpperCase())
}

function parseQuery(
  raw: string,
  plan: DailyPlan[],
  clients: Client[],
  homeCoords: { lat: number; lon: number },
  visitsPerDay: number,
  radiusState: number
): CommandResult | null {
  if (!raw.trim()) return null
  const q = normalize(raw)
  const words = q.split(/\s+/)

  // ── Date scope (applies to both modes) ──────────────────────────────────────
  const wantToday = words.some(w => ['oggi', 'aujourd', 'today'].includes(w))
  const wantTomorrow = words.some(w => ['domani', 'demain', 'tomorrow'].includes(w))
  const wantWeek = words.some(w => ['settimana', 'semaine', 'week'].includes(w))

  // ── AREA COVERAGE: a city is named → cover it + its dintorni ─────────────────
  const city = findCity(words)
  if (city) {
    const radiusMatch = q.match(/(\d{1,3})\s*km/)
    const radiusKm = radiusMatch ? parseInt(radiusMatch[1]) : radiusState

    const { plan: areaPlan, count } = planAreaCoverage(
      clients, city.coord, radiusKm, homeCoords, visitsPerDay
    )

    let days = areaPlan
    if (wantToday) days = areaPlan.slice(0, 1)
    else if (wantTomorrow) days = areaPlan.slice(1, 2)
    else if (wantWeek) days = areaPlan.slice(0, 5)

    const totalVisits = days.reduce((s, d) => s + d.visits.length, 0)
    const scope = wantToday ? ' · today' : wantTomorrow ? ' · tomorrow' : wantWeek ? ' · this week' : ''
    return {
      label: raw.trim(),
      description: `${count} clients within ${radiusKm}km of ${titleCase(city.name)}${scope}`,
      days,
      totalVisits,
      type: 'area',
    }
  }

  // ── FILTER MODE (no city named) ─────────────────────────────────────────────
  let days = [...plan]

  if (wantToday) days = days.filter(d => d.date === TODAY)
  else if (wantTomorrow) days = days.filter(d => d.date === TOMORROW)
  else if (wantWeek) {
    const weekEnd = parseLocalDate(TODAY)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = toDateStr(weekEnd)
    days = days.filter(d => d.date >= TODAY && d.date <= weekEndStr)
  } else {
    for (const word of words) {
      if (word in DAY_NAMES) {
        days = days.filter(d => parseLocalDate(d.date).getDay() === DAY_NAMES[word])
        break
      }
    }
  }

  const filterVisits = (pred: (v: VisitDay) => boolean) =>
    days.map(d => ({ ...d, visits: d.visits.filter(pred) })).filter(d => d.visits.length > 0)

  if (words.some(w => ['urgenti', 'urgent', 'priorita', 'priority', 'critici'].includes(w))) {
    days = filterVisits(v => v.urgency === 'urgent')
  } else if (words.some(w => ['attenzione', 'attention', 'warning'].includes(w))) {
    days = filterVisits(v => v.urgency === 'attention')
  } else if (words.some(w => ['ok', 'ontrack', 'track', 'normali'].includes(w))) {
    days = filterVisits(v => v.urgency === 'ok')
  }

  // Free-text client/town name match
  const searchTokens = words.filter(w => w.length >= 3 && !STOPWORDS.has(w))
  for (const token of searchTokens) {
    const hit = days.some(d => d.visits.some(
      v => normalize(v.town).includes(token) || normalize(v.clientName).includes(token)
    ))
    if (hit) {
      days = days
        .map(d => ({
          ...d,
          visits: d.visits.filter(
            v => normalize(v.town).includes(token) || normalize(v.clientName).includes(token)
          ),
        }))
        .filter(d => d.visits.length > 0)
    }
  }

  const totalVisits = days.reduce((s, d) => s + d.visits.length, 0)
  return { label: raw.trim(), days, totalVisits, type: 'filter' }
}

const EXAMPLES = [
  { text: 'Charleroi', icon: '📍' },
  { text: 'Mons area 30km', icon: '🗺️' },
  { text: "today I'm in Namur", icon: '🚗' },
  { text: 'urgent this week', icon: '🔴' },
]

export function CommandBar({ plan, clients, homeCoords, visitsPerDay, onResult }: CommandBarProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [radius, setRadius] = useState(20)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback((q: string, r: number) => {
    onResult(parseQuery(q, plan, clients, homeCoords, visitsPerDay, r))
  }, [plan, clients, homeCoords, visitsPerDay, onResult])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (!v.trim()) { onResult(null); return }
    run(v, radius)
  }

  const handleRadius = (r: number) => {
    setRadius(r)
    if (query.trim()) run(query, r)
  }

  const handleExample = (ex: string) => {
    setQuery(ex)
    run(ex, radius)
    inputRef.current?.focus()
  }

  const clear = () => {
    setQuery('')
    onResult(null)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full space-y-2">
      <div className={`relative flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all duration-200 shadow-sm ${
        focused ? 'border-indigo-500 shadow-indigo-500/20 shadow-lg' : 'border-slate-200 dark:border-slate-700'
      }`}>
        <div className="pl-4 flex items-center gap-2 text-indigo-500 shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder='Type a city ("Charleroi", "Mons area 30km") or a filter ("urgent today")'
          className="flex-1 py-3 bg-transparent text-sm text-slate-900 dark:text-slate-50 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clear}
              className="pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Radius selector — used when you name a city */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <MapPin className="h-3 w-3" /> Coverage radius:
        </span>
        {RADII.map(r => (
          <button
            key={r}
            onClick={() => handleRadius(r)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              radius === r
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40'
            }`}
          >
            {r}km
          </button>
        ))}
      </div>

      {/* Example chips */}
      <AnimatePresence>
        {!query && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-wrap gap-2"
          >
            {EXAMPLES.map(ex => (
              <button
                key={ex.text}
                onClick={() => handleExample(ex.text)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <span>{ex.icon}</span>
                {ex.text}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
