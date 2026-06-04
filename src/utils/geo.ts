import type { CityCoord } from '../types'
import bePostalRaw from '../data/bePostal.json'
import beCityRaw from '../data/beCity.json'

type LatLon = [number, number]

// Postal code (e.g. "6000") → [lat, lon]. Covers all ~1145 Belgian postal codes.
const POSTAL = bePostalRaw as unknown as Record<string, LatLon>

// City name (accent-stripped, lowercased) → [lat, lon]. Built once at load.
const CITY: Record<string, LatLon> = {}
for (const [k, v] of Object.entries(beCityRaw as unknown as Record<string, LatLon>)) {
  CITY[norm(k)] = v as LatLon
}

// Italian / alternate city names → dataset key (for home address convenience)
const ALIASES: Record<string, string> = {
  anversa: 'antwerpen', anvers: 'antwerpen',
  gand: 'gent',
  liegi: 'liege',
  bruges: 'brugge',
  brussels: 'bruxelles', bruxelles: 'bruxelles',
  malines: 'mechelen',
  louvain: 'leuven',
  ostenda: 'oostende', ostende: 'oostende',
}

export interface Coord { lat: number; lon: number }

/** Common base cities for the home-location picker (any town also resolves). */
export const MAJOR_CITIES = [
  'Bruxelles', 'Charleroi', 'Mons', 'Namur', 'Liège', 'Tournai',
  'La Louvière', 'Nivelles', 'Wavre', 'Soignies', 'Antwerpen', 'Gent',
]

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Haversine distance in km (1-decimal). */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

/** First 4-digit number in a string = Belgian postal code. */
export function extractPostal(s?: string): string | null {
  if (!s) return null
  const m = s.match(/\b(\d{4})\b/)
  return m ? m[1] : null
}

export function coordsForPostal(zip: string): Coord | null {
  const p = POSTAL[zip]
  return p ? { lat: p[0], lon: p[1] } : null
}

// All known Belgian city names (accent-stripped, lowercased), built once.
const CITY_NAMES = Object.keys(CITY)

function titleCaseCity(s: string): string {
  return s.replace(/\b\w/g, ch => ch.toUpperCase())
}

/**
 * Prefix/substring search over the offline Belgian city list, for typeahead.
 * Prefix matches rank first (shorter names — i.e. the well-known cities — first),
 * then substring matches. Returns display-cased names.
 */
export function searchCities(prefix: string, limit = 6): string[] {
  const p = norm(prefix)
  if (!p) return MAJOR_CITIES.slice(0, limit)
  const starts: string[] = []
  const contains: string[] = []
  for (const name of CITY_NAMES) {
    if (name.startsWith(p)) starts.push(name)
    else if (name.includes(p)) contains.push(name)
  }
  starts.sort((a, b) => a.length - b.length || a.localeCompare(b))
  contains.sort((a, b) => a.length - b.length || a.localeCompare(b))
  return [...starts, ...contains].slice(0, limit).map(titleCaseCity)
}

/** Bounded Levenshtein — returns early once it provably exceeds `max`. */
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      cur.push(v)
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev = cur
  }
  return prev[b.length]
}

/** Closest city name to a (probably mistyped) token, within edit distance 2. */
export function nearestCity(token: string): string | null {
  const t = norm(token)
  if (t.length < 4) return null
  if (CITY[t]) return null // already a valid city
  let best: string | null = null
  let bestD = 3
  for (const name of CITY_NAMES) {
    const d = levenshtein(t, name, 2)
    if (d < bestD) { bestD = d; best = name; if (d === 1) break }
  }
  return best ? titleCaseCity(best) : null
}

export function coordsForCity(name: string): Coord | null {
  if (!name) return null
  const n = norm(name)
  const key = CITY[n] ? n : (CITY[ALIASES[n]] ? ALIASES[n] : null)
  if (key) { const c = CITY[key]; return { lat: c[0], lon: c[1] } }
  return null
}

/**
 * Resolve a client's coordinates. Postal code (from address) is the most
 * precise; town name is the fallback. Works offline for any Belgian address.
 */
export function resolveCoords(town: string, address?: string): Coord | null {
  const zip = extractPostal(address)
  if (zip) {
    const c = coordsForPostal(zip)
    if (c) return c
  }
  return coordsForCity(town)
}

// ── Backwards-compatible helpers (used by planning.ts) ──────────────────────────

export function getCityCoordinates(town: string): CityCoord | null {
  const c = coordsForCity(town)
  return c ? { city: town, lat: c.lat, lon: c.lon } : null
}

export function getDistanceFromHome(town: string, homeCoords: CityCoord): number {
  const c = coordsForCity(town)
  if (!c) return 0
  return getDistance(homeCoords.lat, homeCoords.lon, c.lat, c.lon)
}
