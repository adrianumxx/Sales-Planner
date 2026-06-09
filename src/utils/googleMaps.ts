/**
 * Optional Google Maps integration. When the user provides their own API key
 * (entered in Settings, stored locally), we load the Maps JS SDK and use its
 * client-side Geocoder to resolve full street addresses to precise coordinates
 * — fixing the town-centroid collapse of the offline dataset. Results are cached
 * in localStorage so we geocode each address only once.
 *
 * No key → nothing loads and the app falls back to the offline coordinates.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyWindow = Window & { google?: any }

let loadPromise: Promise<void> | null = null

/** Inject the Maps JS SDK once; resolves when `google.maps` is ready. */
export function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const w = window as AnyWindow
  if (w.google?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise
  loadPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geocoding&loading=async`
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { loadPromise = null; reject(new Error('Google Maps failed to load')) }
    document.head.appendChild(s)
  })
  return loadPromise
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

/** Geocode one address to {lat, lon}; cached. Returns null if unresolved. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lon: number } | null> {
  const key = norm(query)
  if (!key) return null
  const cache = loadCache()
  if (cache[key]) return { lat: cache[key][0], lon: cache[key][1] }

  const w = window as AnyWindow
  if (!w.google?.maps) return null
  if (!geocoder) geocoder = new w.google.maps.Geocoder()

  try {
    const res: any = await geocoder.geocode({ address: query, region: 'be' })
    const loc = res?.results?.[0]?.geometry?.location
    if (loc) {
      const lat = loc.lat(), lon = loc.lng()
      cache[key] = [Number(lat.toFixed(6)), Number(lon.toFixed(6))]
      saveCache(cache)
      return { lat, lon }
    }
  } catch { /* over-query / invalid key / no result */ }
  return null
}
