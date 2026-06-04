import React, { useState, useRef, useCallback } from 'react'
import { Sparkles, X, ChevronRight, Navigation } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { DailyPlan } from '../types'
import { getCityCoordinates } from '../utils/geo'
import { rerouteDayFromCity } from '../utils/planning'

export interface CommandResult {
  label: string
  description?: string   // shown in banner instead of raw label
  days: DailyPlan[]
  totalVisits: number
  type?: 'filter' | 'reroute'
}

interface CommandBarProps {
  plan: DailyPlan[]
  onResult: (result: CommandResult | null) => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TODAY    = new Date().toISOString().split('T')[0]
const TOMORROW = new Date(Date.now() + 86400000).toISOString().split('T')[0]

const DAY_NAMES: Record<string, number> = {
  domenica: 0, sunday: 0, dim: 0,
  lunedi: 1, lundi: 1, monday: 1, mon: 1,
  martedi: 2, mardi: 2, tuesday: 2, tue: 2,
  mercoledi: 3, mercredi: 3, wednesday: 3, wed: 3,
  giovedi: 4, jeudi: 4, thursday: 4, thu: 4,
  venerdi: 5, vendredi: 5, friday: 5, fri: 5,
  sabato: 6, samedi: 6, saturday: 6, sat: 6,
}

// ── Text normalisation ─────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

// ── Re-route intent detection ──────────────────────────────────────────────────
// Detects patterns like "sono su/a/in [city]", "parto da [city]", "starting from [city]"

function extractRerouteCity(q: string): string | null {
  const patterns = [
    /sono (?:su|a|in) ([a-z]+)/,
    /parto (?:da|di) ([a-z]+)/,
    /partendo (?:da|di) ([a-z]+)/,
    /starting from ([a-z]+)/,
    /je suis a ([a-z]+)/,
    /je pars de ([a-z]+)/,
  ]
  for (const pat of patterns) {
    const m = q.match(pat)
    if (m) return m[1]
  }
  return null
}

// ── Main query parser ──────────────────────────────────────────────────────────

function parseQuery(raw: string, plan: DailyPlan[]): CommandResult | null {
  if (!raw.trim()) return null
  const q = normalize(raw)
  const words = q.split(/\s+/)

  let days = [...plan]

  // ── 1. Date filter ────────────────────────────────────────────────────────
  if (words.some(w => ['oggi', "aujourd", 'today'].includes(w))) {
    days = days.filter(d => d.date === TODAY)
  } else if (words.some(w => ['domani', 'demain', 'tomorrow'].includes(w))) {
    days = days.filter(d => d.date === TOMORROW)
  } else if (words.some(w => ['settimana', 'semaine', 'week'].includes(w))) {
    const weekEnd = new Date(TODAY)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    days = days.filter(d => d.date >= TODAY && d.date <= weekEndStr)
  } else {
    for (const word of words) {
      if (word in DAY_NAMES) {
        const targetDow = DAY_NAMES[word]
        days = days.filter(d => new Date(d.date).getDay() === targetDow)
        break
      }
    }
  }

  // ── 2. Urgency filter ─────────────────────────────────────────────────────
  const urgentWords = ['urgenti', 'urgent', 'priorita', 'priority', 'critici']
  const attentWords = ['attenzione', 'attention', 'warning']
  const okWords     = ['ok', 'ontrack', 'track', 'normali']

  const filterVisits = (pred: (v: import('../types').VisitDay) => boolean) =>
    days.map(d => ({ ...d, visits: d.visits.filter(pred) })).filter(d => d.visits.length > 0)

  if (words.some(w => urgentWords.includes(w))) {
    days = filterVisits(v => v.urgency === 'urgent')
  } else if (words.some(w => attentWords.includes(w))) {
    days = filterVisits(v => v.urgency === 'attention')
  } else if (words.some(w => okWords.includes(w))) {
    days = filterVisits(v => v.urgency === 'ok')
  }

  // ── 3. Re-route intent ────────────────────────────────────────────────────
  // "oggi sono su charleroi fammi plan" → re-order today's visits from Charleroi
  const rerouteCity = extractRerouteCity(q)
  if (rerouteCity) {
    const startCoords = getCityCoordinates(rerouteCity)
    if (startCoords && days.length > 0) {
      days = days.map(d => {
        const reordered = rerouteDayFromCity(d.visits, startCoords)
        return {
          ...d,
          visits: reordered,
          totalKm: Math.round(reordered.reduce((s, v) => s + v.distance, 0) * 10) / 10,
        }
      })

      const totalVisits = days.reduce((s, d) => s + d.visits.length, 0)
      const cityDisplay = rerouteCity.charAt(0).toUpperCase() + rerouteCity.slice(1)
      return {
        label: raw.trim(),
        description: `ottimizzate partendo da ${cityDisplay}`,
        days,
        totalVisits,
        type: 'reroute',
      }
    }
    // City not in database → fall through to regular city-name filter
  }

  // ── 4. City / client name filter ──────────────────────────────────────────
  const STOPWORDS = new Set([
    'le', 'la', 'les', 'di', 'da', 'a', 'su', 'per', 'in', 'con',
    'delle', 'della', 'del', 'dei', 'gli', 'il', 'lo', 'un', 'una',
    'visite', 'visita', 'visit', 'fammi', 'mostra', 'show', 'dammi', 'give',
    'tutte', 'tutti', 'all', 'quelli', 'quelle', 'questa', 'questo',
    'urgenti', 'urgent', 'priorita', 'attenzione', 'attention',
    'oggi', 'domani', 'settimana', 'today', 'tomorrow', 'week',
    'cliente', 'client', 'clienti', 'sono', 'parto', 'partendo', 'plan',
    'ottimizza', 'route', 'pianifica', 'percorso', ...Object.keys(DAY_NAMES),
  ])

  const searchTokens = words.filter(w => w.length >= 3 && !STOPWORDS.has(w))

  for (const token of searchTokens) {
    const matchingTown   = days.some(d => d.visits.some(v => normalize(v.town).includes(token)))
    const matchingClient = days.some(d => d.visits.some(v => normalize(v.clientName).includes(token)))

    if (matchingTown || matchingClient) {
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

// ── Example prompts ────────────────────────────────────────────────────────────

const EXAMPLES = [
  { text: 'visite di oggi', icon: '📅' },
  { text: 'urgenti questa settimana', icon: '🔴' },
  { text: 'oggi sono su Charleroi fammi plan', icon: '📍' },
  { text: 'urgenti domani', icon: '⚡' },
  { text: 'visite a Namur', icon: '🗺️' },
]

// ── Component ──────────────────────────────────────────────────────────────────

export function CommandBar({ plan, onResult }: CommandBarProps) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const run = useCallback((q: string) => {
    onResult(parseQuery(q, plan))
  }, [plan, onResult])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setQuery(v)
    if (!v.trim()) { onResult(null); return }
    run(v)
  }

  const handleExample = (ex: string) => {
    setQuery(ex)
    run(ex)
    inputRef.current?.focus()
  }

  const clear = () => {
    setQuery('')
    onResult(null)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full space-y-2">
      {/* Input */}
      <div className={`relative flex items-center gap-2 bg-white dark:bg-slate-800 rounded-2xl border-2 transition-all duration-200 shadow-sm ${
        focused
          ? 'border-indigo-500 shadow-indigo-500/20 shadow-lg'
          : 'border-slate-200 dark:border-slate-700'
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
          placeholder='Es: "urgenti oggi", "sono su Charleroi fammi plan", "visite a Namur"'
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
