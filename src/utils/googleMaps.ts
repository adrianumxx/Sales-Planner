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
// `null` is a *negative* cache entry: Google has no match, so we never pay to
// look the same address up again.
const CACHE_KEY = 'salesPlanner.geocodeCache'

function loadCache(): Record<string, [number, number] | null> {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') } catch { return {} }
}
function saveCache(c: Record<string, [number, number] | null>): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* quota */ }
}
const norm = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ')

let geocoder: any = null

/**
 * Geocode one address to {lat, lon}; cached (positive AND negative, so a miss is
 * never re-charged). Returns null if unresolved or if the API key isn't set.
 */
export async function geocodeAddress(query: string): Promise<{ lat: number; lon: number } | null> {
  if (!MAPS_API_KEY) return null // No key configured, fall back to offline
  const key = norm(query)
  if (!key) return null
  const cache = loadCache()
  if (key in cache) { const v = cache[key]; return v ? { lat: v[0], lon: v[1] } : null }

  try {
    await loadGoogleMapsSDK()
  } catch {
    return null // SDK load failed, fall back to offline
  }

  const w = window as AnyWindow
  if (!w.google?.maps) return null
  if (!geocoder) geocoder = new w.google.maps.Geocoder()

  const res: any = await withTimeout(geocoder.geocode({ address: query, region: 'be' }), 8000)
  if (res === null) return null // timeout / transient error — don't poison the cache
  const loc = res?.results?.[0]?.geometry?.location
  if (loc) {
    const lat = loc.lat(), lon = loc.lng()
    cache[key] = [Number(lat.toFixed(6)), Number(lon.toFixed(6))]
    saveCache(cache)
    return { lat, lon }
  }
  cache[key] = null // negative cache: Google genuinely has no match
  saveCache(cache)
  return null
}

// ── Place info: opening hours + operating status (Places API) ────────────────
// Same-town sanity check: the search is biased with the (coarse) offline postal
// centroid, which can sit a couple of km from the actual address, so we only
// distrust a match when the returned venue is in a clearly different area (a
// wrong-city same-name match). Within this radius the match is trusted and its
// hours are used to constrain scheduling.
const HOURS_MATCH_RADIUS_KM = 6
const PLACE_CACHE_KEY = 'salesPlanner.placeCache.v2'

/** Wipe the cached Places results so the next pass re-fetches fresh hours. */
export function clearPlaceCache(): void {
  try { localStorage.removeItem(PLACE_CACHE_KEY) } catch { /* ignore */ }
}

export interface PlaceInfo {
  /** Precise venue coordinates from Places — only set on a high-confidence match,
   *  so a single Places call can also serve as the geocoder (no separate call). */
  location: { lat: number; lon: number } | null
  openingHours: OpeningHours | null
  businessStatus: BusinessStatus | null
}

function loadPlaceCache(): Record<string, PlaceInfo> {
  try { return JSON.parse(localStorage.getItem(PLACE_CACHE_KEY) || '{}') } catch { return {} }
}
function savePlaceCache(c: Record<string, PlaceInfo>): void {
  try { localStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(c)) } catch { /* quota */ }
}

// Last error from a Places call, surfaced in the UI so a misconfigured key /
// disabled "Places API (New)" is diagnosable without opening the console.
let lastPlacesError: string | null = null
export function getLastPlacesError(): string | null { return lastPlacesError }

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

  const lib = await getPlacesLib().catch((e) => { lastPlacesError = (e as Error)?.message || String(e); return null })
  const Place = lib?.Place
  if (!Place) {
    if (!lastPlacesError) lastPlacesError = 'Places library failed to load (is "Places API (New)" enabled?)'
    return null
  }

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
    if (res === null) return null // timeout / transient — retry later, don't cache
    lastPlacesError = null // a response came back → the API is working
    const place = res?.places?.[0]
    if (!place) {
      // Negative cache: Google has no such venue — never re-charge for it.
      const empty: PlaceInfo = { location: null, openingHours: null, businessStatus: null }
      cache[cacheKey] = empty
      savePlaceCache(cache)
      return empty
    }

    let verified = true
    if (near && place.location) {
      const d = getDistance(near.lat, near.lon, place.location.lat(), place.location.lng())
      if (d > HOURS_MATCH_RADIUS_KM) verified = false
    }
    const periods = place.regularOpeningHours?.periods
    const status = VALID_STATUS.includes(place.businessStatus) ? (place.businessStatus as BusinessStatus) : null
    const info: PlaceInfo = {
      // Trust the precise location only on a confident match (else geocoding fills in).
      location: verified && place.location
        ? { lat: place.location.lat(), lon: place.location.lng() }
        : null,
      openingHours: periods?.length ? { days: periodsToDays(periods), verified } : null,
      businessStatus: status && (verified || status === 'OPERATIONAL') ? status : null,
    }
    cache[cacheKey] = info
    savePlaceCache(cache)
    return info
  } catch (e) {
    lastPlacesError = (e as Error)?.message || String(e)
  }
  return null
}
