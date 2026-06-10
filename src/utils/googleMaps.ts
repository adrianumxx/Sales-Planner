/**
 * Optional Google Maps integration. When VITE_GOOGLE_MAPS_API_KEY is set in .env,
 * we load the Maps JS SDK and use its client-side Geocoder to resolve full street
 * addresses to precise coordinates — fixing the town-centroid collapse of the
 * offline dataset — and the Places API to extract real opening hours. Results are
 * cached in localStorage so we call Google for each client only once.
 *
 * No key → nothing loads and the app falls back to the offline coordinates with
 * no opening-hours data.
 */

import { getDistance } from './geo'
import type { OpeningHours, BusinessStatus } from '../types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWindow = Window & { google?: any }

let loadPromise: Promise<void> | null = null

// Read the API key from build-time environment; never exposed at runtime unless set.
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

/** Whether the Maps/Places integration is configured (key present at build time). */
export const MAPS_ENABLED = !!MAPS_API_KEY

/** Inject the Maps JS SDK once; resolves when `google.maps` is ready. */
function loadGoogleMapsSDK(): Promise<void> {
  if (!MAPS_API_KEY) return Promise.reject(new Error('Google Maps API key not configured'))
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const w = window as AnyWindow
  if (w.google?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    // Only the core + geocoding here; the (heavier, separately-billed) places
    // library is loaded on demand via importLibrary so it can never slow down or
    // break geocoding.
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(MAPS_API_KEY)}&libraries=geocoding&loading=async`
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { loadPromise = null; reject(new Error('Google Maps failed to load')) }
    document.head.appendChild(s)
  })
  return loadPromise
}

/** Resolve to null if `p` doesn't settle within `ms` — so one hung Google call
 *  can never stall a whole batch (the cause of geocoding freezing mid-run). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ])
}

// ── Address → coords cache (survives reloads & re-uploads of the same clients) ──
const CACHE_KEY = 'salesPlanner.geocodeCache'

function loadCache(): Record<string, [number, number]> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(c: Record<string, [number, number]>): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* quota */ }
}
const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

let geocoder: any = null

/**
 * Geocode one address to {lat, lon}; cached. Returns null if unresolved or if
 * the API key is not configured. Safe to call: if MAPS_API_KEY is not set,
 * returns null gracefully.
 */
export async function geocodeAddress(query: string): Promise<{ lat: number; lon: number } | null> {
  if (!MAPS_API_KEY) return null // No key configured, fall back to offline
  const key = norm(query)
  if (!key) return null
  const cache = loadCache()
  if (cache[key]) return { lat: cache[key][0], lon: cache[key][1] }

  try {
    await loadGoogleMapsSDK()
  } catch {
    return null // SDK load failed, fall back to offline
  }

  const w = window as AnyWindow
  if (!w.google?.maps) return null
  if (!geocoder) geocoder = new w.google.maps.Geocoder()

  const res: any = await withTimeout(geocoder.geocode({ address: query, region: 'be' }), 8000)
  const loc = res?.results?.[0]?.geometry?.location
  if (loc) {
    const lat = loc.lat(), lon = loc.lng()
    cache[key] = [Number(lat.toFixed(6)), Number(lon.toFixed(6))]
    saveCache(cache)
    return { lat, lon }
  }
  return null
}

// ── Place info: opening hours + operating status (Places API) ────────────────
// If the matched venue sits further than this from the client's known location,
// the match is treated as low-confidence: hours are shown but never used to
// constrain scheduling (see OpeningHours.verified).
const HOURS_MATCH_RADIUS_KM = 0.6
// v2: cache now also holds businessStatus, so use a fresh key.
const PLACE_CACHE_KEY = 'salesPlanner.placeCache.v2'

export interface PlaceInfo {
  openingHours: OpeningHours | null
  businessStatus: BusinessStatus | null
}

function loadPlaceCache(): Record<string, PlaceInfo> {
  try { return JSON.parse(localStorage.getItem(PLACE_CACHE_KEY) || '{}') } catch { return {} }
}
function savePlaceCache(c: Record<string, PlaceInfo>): void {
  try { localStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(c)) } catch { /* quota */ }
}

let placesLib: any = null
async function getPlacesLib(): Promise<any> {
  await loadGoogleMapsSDK()
  const w = window as AnyWindow
  if (!w.google?.maps?.importLibrary) return null
  if (!placesLib) placesLib = await w.google.maps.importLibrary('places')
  return placesLib
}

/** Convert Google `regularOpeningHours.periods` into our weekday→intervals map. */
function periodsToDays(periods: any[]): Record<number, [number, number][]> {
  const days: Record<number, [number, number][]> = {}
  for (const p of periods || []) {
    const od = p?.open?.day
    if (od == null) continue
    const openMin = (p.open.hour ?? 0) * 60 + (p.open.minute ?? 0)
    // No close → open all day. Close on a later day (overnight) → cap at midnight.
    const sameDay = p?.close && p.close.day === od
    const closeMin = p?.close
      ? (sameDay ? (p.close.hour ?? 0) * 60 + (p.close.minute ?? 0) : 1440)
      : 1440
    if (closeMin <= openMin) continue
    ;(days[od] ??= []).push([openMin, closeMin])
  }
  return days
}

const VALID_STATUS: BusinessStatus[] = ['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY']

/**
 * Fetch a venue's opening hours AND operating status via the Places API, matched
 * by name + address and biased to its known coordinates. Cached. Returns null
 * when the key is missing or no venue is found. `openingHours.verified` is false
 * when the match looks unreliable (far from `near`); a permanently/temporarily
 * closed venue is reported via `businessStatus` even when it has no hours.
 */
export async function fetchPlaceInfo(
  name: string,
  address: string | undefined,
  near?: { lat: number; lon: number }
): Promise<PlaceInfo | null> {
  if (!MAPS_API_KEY) return null
  const cacheKey = norm(`${name} ${address ?? ''}`)
  if (!cacheKey) return null
  const cache = loadPlaceCache()
  if (cache[cacheKey]) return cache[cacheKey]

  const lib = await getPlacesLib().catch(() => null)
  const Place = lib?.Place
  if (!Place) return null

  try {
    const req: any = {
      textQuery: `${name}${address ? ', ' + address : ''}`,
      fields: ['location', 'regularOpeningHours', 'businessStatus'],
      maxResultCount: 1,
      region: 'be',
      language: 'en',
    }
    if (near) req.locationBias = { lat: near.lat, lng: near.lon }
    const res: any = await withTimeout(Place.searchByText(req), 8000)
    const place = res?.places?.[0]
    if (!place) return null

    let verified = true
    if (near && place.location) {
      const d = getDistance(near.lat, near.lon, place.location.lat(), place.location.lng())
      if (d > HOURS_MATCH_RADIUS_KM) verified = false
    }
    const periods = place.regularOpeningHours?.periods
    const status = VALID_STATUS.includes(place.businessStatus) ? (place.businessStatus as BusinessStatus) : null
    const info: PlaceInfo = {
      openingHours: periods?.length ? { days: periodsToDays(periods), verified } : null,
      // Only trust a "closed" verdict when the match is reliable.
      businessStatus: status && (verified || status === 'OPERATIONAL') ? status : null,
    }
    cache[cacheKey] = info
    savePlaceCache(cache)
    return info
  } catch { /* over-query / no result / API not enabled */ }
  return null
}
