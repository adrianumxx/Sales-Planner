import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Sparkles, X, MapPin, Search, User, Building2, CornerDownLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyPlan, VisitDay, Client } from '../types'
import { coordsForCity, resolveCoords, getDistance, searchCities, nearestCity } from '../utils/geo'
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

const WEEKDAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const RADII = [5, 10, 20, 30, 50]

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

type Scope = 'today' | 'tomorrow' | 'week' | 'all'

interface Intent {
  raw: string
  mode: 'area' | 'filter'
  scope: Scope
  city: { name: string; coord: { lat: number; lon: number } } | null
  radiusKm: number
  urgency: 'urgent' | 'attention' | 'ok' | null
  weekday: number | null
  textTokens: string[]
  didYouMean: string | null
}

/** Cheap, routing-free parse of a query into a structured intent. */
function analyze(raw: string, radiusState: number): Intent | null {
  if (!raw.trim()) return null
  const q = normalize(raw)
  const words = q.split(/\s+/)

  const scope: Scope =
    words.some(w => ['oggi', 'aujourd', 'today'].includes(w)) ? 'today'
    : words.some(w => ['domani', 'demain', 'tomorrow'].includes(w)) ? 'tomorrow'
    : words.some(w => ['settimana', 'semaine', 'week'].includes(w)) ? 'week'
    : 'all'

  const city = findCity(words)
  const radiusMatch = q.match(/(\d{1,3})\s*km/)
  const radiusKm = radiusMatch ? parseInt(radiusMatch[1]) : radiusState

  const urgency =
    words.some(w => ['urgenti', 'urgent', 'priorita', 'priority', 'critici'].includes(w)) ? 'urgent'
    : words.some(w => ['attenzione', 'attention', 'warning'].includes(w)) ? 'attention'
    : words.some(w => ['ok', 'ontrack', 'track', 'normali'].includes(w)) ? 'ok'
    : null

  let weekday: number | null = null
  for (const w of words) { if (w in DAY_NAMES) { weekday = DAY_NAMES[w]; break } }

  const cityWords = city ? city.name.split(' ') : []
  const textTokens = words.filter(w => w.length >= 3 && !STOPWORDS.has(w) && !cityWords.includes(w))

  // Did-you-mean only when no city matched: test the longest free token.
  let didYouMean: string | null = null
  if (!city && textTokens.length) {
    const candidate = [...textTokens].sort((a, b) => b.length - a.length)[0]
    didYouMean = nearestCity(candidate)
  }

  return {
    raw: raw.trim(),
    mode: city ? 'area' : 'filter',
    scope, city, radiusKm, urgency, weekday, textTokens, didYouMean,
  }
}

/** Apply date / urgency / text filters to the existing plan (cheap, no routing). */
function filterDays(intent: Intent, plan: DailyPlan[]): DailyPlan[] {
  let days = [...plan]

  if (intent.scope === 'today') days = days.filter(d => d.date === TODAY)
  else if (intent.scope === 'tomorrow') days = days.filter(d => d.date === TOMORROW)
  else if (intent.scope === 'week') {
    const weekEnd = parseLocalDate(TODAY)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = toDateStr(weekEnd)
    days = days.filter(d => d.date >= TODAY && d.date <= weekEndStr)
  } else if (intent.weekday != null) {
    days = days.filter(d => parseLocalDate(d.date).getDay() === intent.weekday)
  }

  const filterVisits = (pred: (v: VisitDay) => boolean) =>
    days.map(d => ({ ...d, visits: d.visits.filter(pred) })).filter(d => d.visits.length > 0)

  if (intent.urgency) days = filterVisits(v => v.urgency === intent.urgency)

  for (const token of intent.textTokens) {
    const match = (v: VisitDay) =>
      normalize(v.town).includes(token) || normalize(v.clientName).includes(token)
    if (days.some(d => d.visits.some(match))) {
      days = days
        .map(d => ({ ...d, visits: d.visits.filter(match) }))
        .filter(d => d.visits.length > 0)
    }
  }

  return days
}

/** Count clients within a radius of a centre (cheap — used for the live preview). */
function countInArea(clients: Client[], center: { lat: number; lon: number }, radiusKm: number): number {
  let n = 0
  for (const c of clients) {
    const p = c.lat != null && c.lon != null
      ? { lat: c.lat, lon: c.lon }
      : resolveCoords(c.town, c.address)
    if (p && getDistance(center.lat, center.lon, p.lat, p.lon) <= radiusKm) n++
  }
  return n
}

function scopeSuffix(scope: Scope): string {
  return scope === 'today' ? ' · today' : scope === 'tomorrow' ? ' · tomorrow' : scope === 'week' ? ' · this week' : ''
}

interface Preview {
  type: 'area' | 'filter'
  text: string
  count: number
  empty: boolean
}

/** Human-readable description of what a query will do, with a live count. */
function describe(intent: Intent, plan: DailyPlan[], clients: Client[]): Preview {
  if (intent.mode === 'area' && intent.city) {
    const count = countInArea(clients, intent.city.coord, intent.radiusKm)
    return {
      type: 'area',
      text: `${titleCase(intent.city.name)} + surroundings · ${intent.radiusKm} km${scopeSuffix(intent.scope)}`,
      count,
      empty: count === 0,
    }
  }
  const days = filterDays(intent, plan)
  const count = days.reduce((s, d) => s + d.visits.length, 0)
  const parts: string[] = []
  if (intent.urgency) parts.push(intent.urgency)
  if (intent.scope !== 'all') parts.push(intent.scope === 'week' ? 'this week' : intent.scope)
  if (intent.weekday != null) parts.push(WEEKDAY_LABEL[intent.weekday])
  for (const t of intent.textTokens) parts.push(`"${t}"`)
  return {
    type: 'filter',
    text: parts.length ? parts.join(' · ') : 'all visits',
    count,
    empty: count === 0,
  }
}

function buildResult(
  intent: Intent,
  plan: DailyPlan[],
  clients: Client[],
  homeCoords: { lat: number; lon: number },
  visitsPerDay: number
): CommandResult {
  if (intent.mode === 'area' && intent.city) {
    const { plan: areaPlan, count } = planAreaCoverage(
      clients, intent.city.coord, intent.radiusKm, homeCoords, visitsPerDay
    )
    let days = areaPlan
    if (intent.scope === 'today') days = areaPlan.slice(0, 1)
    else if (intent.scope === 'tomorrow') days = areaPlan.slice(1, 2)
    else if (intent.scope === 'week') days = areaPlan.slice(0, 5)

    const totalVisits = days.reduce((s, d) => s + d.visits.length, 0)
    return {
      label: intent.raw,
      description: `${count} clients within ${intent.radiusKm}km of ${titleCase(intent.city.name)}${scopeSuffix(intent.scope)}`,
      days,
      totalVisits,
      type: 'area',
    }
  }

  const days = filterDays(intent, plan)
  const totalVisits = days.reduce((s, d) => s + d.visits.length, 0)
  return { label: intent.raw, days, totalVisits, type: 'filter' }
}

function parseQuery(
  raw: string,
  plan: DailyPlan[],
  clients: Client[],
  homeCoords: { lat: number; lon: number },
  visitsPerDay: number,
  radiusState: number
): CommandResult | null {
  const intent = analyze(raw, radiusState)
  return intent ? buildResult(intent, plan, clients, homeCoords, visitsPerDay) : null
}

// ── Typeahead suggestions ──────────────────────────────────────────────────────
type Suggestion =
  | { kind: 'city'; value: string }
  | { kind: 'client'; value: string; sub: string }
  | { kind: 'town'; value: string }

function buildSuggestions(query: string, clients: Client[]): Suggestion[] {
  const t = query.trim()
  if (t.length < 2) return []
  const n = normalize(t)

  const cities: Suggestion[] = searchCities(t, 5).map(value => ({ kind: 'city', value }))

  const seenClient = new Set<string>()
  const seenTown = new Set<string>()
  const clientHits: Suggestion[] = []
  const townHits: Suggestion[] = []
  for (const c of clients) {
    if (clientHits.length < 4 && !seenClient.has(c.clientName) && normalize(c.clientName).includes(n)) {
      seenClient.add(c.clientName)
      clientHits.push({ kind: 'client', value: c.clientName, sub: c.town })
    }
    if (townHits.length < 3 && !seenTown.has(c.town) && normalize(c.town).includes(n)) {
      seenTown.add(c.town)
      townHits.push({ kind: 'town', value: c.town })
    }
  }

  // De-dupe a town that is already shown as a city suggestion.
  const cityNames = new Set(cities.map(c => normalize(c.value)))
  const towns = townHits.filter(t2 => !cityNames.has(normalize(t2.value)))

  return [...cities, ...clientHits, ...towns].slice(0, 8)
}

const EXAMPLES = [
  { text: 'Charleroi', icon: '📍' },
  { text: 'Mons area 30km', icon: '🗺️' },
  { text: "today I'm in Namur", icon: '🚗' },
  { text: 'urgent this week', icon: '🔴' },
]

export function CommandBar({ plan, clients, homeCoords, visitsPerDay, onResult }: CommandBarProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [focused, setFocused] = useState(false)
  const [radius, setRadius] = useState(20)
  const [showSug, setShowSug] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounce the heavy parse so area-coverage doesn't run on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 180)
    return () => clearTimeout(id)
  }, [query])

  // Emit the parsed result (area coverage is heavy, hence the debounced input).
  useEffect(() => {
    if (!debounced.trim()) { onResult(null); return }
    onResult(parseQuery(debounced, plan, clients, homeCoords, visitsPerDay, radius))
  }, [debounced, radius, plan, clients, homeCoords, visitsPerDay, onResult])

  // Live, routing-free interpretation for the inline preview + radius visibility.
  const intent = useMemo(() => analyze(debounced, radius), [debounced, radius])
  const preview = useMemo(
    () => (intent ? describe(intent, plan, clients) : null),
    [intent, plan, clients]
  )

  const suggestions = useMemo(() => buildSuggestions(query, clients), [query, clients])
  const showRadius = !query.trim() || intent?.mode === 'area'

  // Close suggestions on outside click.
  useEffect(() => {
    if (!showSug) return
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setShowSug(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showSug])

  const apply = useCallback((value: string) => {
    setQuery(value)
    setShowSug(false)
    setActiveIdx(-1)
    inputRef.current?.focus()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowSug(true)
    setActiveIdx(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSug && suggestions.length) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => (i <= 0 ? suggestions.length - 1 : i - 1))
        return
      }
      if (e.key === 'Enter' && activeIdx >= 0) {
        e.preventDefault()
        apply(suggestions[activeIdx].value)
        return
      }
    }
    if (e.key === 'Enter') setShowSug(false)
    if (e.key === 'Escape') {
      if (showSug) setShowSug(false)
      else clear()
    }
  }

  const handleRadius = (r: number) => setRadius(r)

  const clear = () => {
    setQuery('')
    setShowSug(false)
    setActiveIdx(-1)
    onResult(null)
    inputRef.current?.focus()
  }

  return (
    <div ref={boxRef} className="w-full space-y-2">
      <div className="relative">
        <div className={`relative flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all duration-200 shadow-sm ${
          focused ? 'border-indigo-500 shadow-indigo-500/20 shadow-lg' : 'border-slate-200 dark:border-slate-700'
        }`}>
          <div className="pl-4 flex items-center text-indigo-500 shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showSug && suggestions.length > 0}
            aria-autocomplete="list"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { setFocused(true); setShowSug(true) }}
            onBlur={() => setFocused(false)}
            placeholder='Type a city ("Charleroi") or a filter ("urgent this week")'
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
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Typeahead suggestions */}
        <AnimatePresence>
          {showSug && suggestions.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.14 }}
              role="listbox"
              className="absolute left-0 right-0 mt-2 z-50 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden max-h-72 overflow-y-auto"
            >
              {suggestions.map((s, i) => {
                const active = i === activeIdx
                const Icon = s.kind === 'city' ? MapPin : s.kind === 'client' ? User : Building2
                const tag = s.kind === 'city' ? 'Coverage area' : s.kind === 'client' ? 'Client' : 'Town'
                return (
                  <li key={`${s.kind}-${s.value}`} role="option" aria-selected={active}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); apply(s.value) }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-700/60'
                      }`}
                    >
                      <Icon className={`h-4 w-4 flex-shrink-0 ${s.kind === 'city' ? 'text-indigo-500' : 'text-slate-400'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900 dark:text-slate-50 truncate">
                          {s.value}
                          {s.kind === 'client' && (
                            <span className="font-normal text-slate-400"> · {s.sub}</span>
                          )}
                        </span>
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 flex-shrink-0">
                        {tag}
                      </span>
                    </button>
                  </li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Live intent preview — shows what the query will do, before you commit */}
      <AnimatePresence mode="wait">
        {query.trim() && preview && (
          <motion.div
            key={`${preview.type}-${preview.text}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="flex flex-wrap items-center gap-2 text-xs"
          >
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium ${
              preview.type === 'area'
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
            }`}>
              {preview.type === 'area'
                ? <MapPin className="h-3 w-3" />
                : <Search className="h-3 w-3" />}
              {preview.type === 'area' ? 'Coverage' : 'Filter'}
            </span>
            <span className="text-slate-600 dark:text-slate-300">{preview.text}</span>
            <span className={`font-semibold ${preview.empty ? 'text-rose-500' : 'text-slate-900 dark:text-slate-100'}`}>
              → {preview.count} {preview.type === 'area' ? 'clients' : 'visits'}
            </span>

            {/* Did-you-mean for a likely mistyped city */}
            {intent?.didYouMean && preview.empty && (
              <button
                onMouseDown={(e) => { e.preventDefault(); apply(intent.didYouMean!) }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
              >
                Did you mean <span className="font-semibold">{intent.didYouMean}</span>?
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Coverage radius — only relevant when an area (city) is targeted */}
      <AnimatePresence initial={false}>
        {showRadius && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 flex-wrap overflow-hidden"
          >
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
          </motion.div>
        )}
      </AnimatePresence>

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
                onClick={() => apply(ex.text)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                <span>{ex.icon}</span>
                {ex.text}
              </button>
            ))}
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 px-1">
              <CornerDownLeft className="h-3 w-3" /> pick a suggestion or press Enter
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
