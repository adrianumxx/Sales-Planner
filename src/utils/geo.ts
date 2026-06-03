import type { CityCoord } from '../types'

export const cityCoordinates: CityCoord[] = [
  { city: 'Bruxelles', lat: 50.8503, lon: 4.3517 },
  { city: 'Anversa', lat: 51.2194, lon: 4.4025 },
  { city: 'Gand', lat: 51.0537, lon: 3.7167 },
  { city: 'Charleroi', lat: 50.4112, lon: 4.4445 },
  { city: 'Liegi', lat: 50.6292, lon: 5.5749 },
  { city: 'Mons', lat: 50.4501, lon: 3.9525 },
  { city: 'Tournai', lat: 50.6079, lon: 3.3893 },
  { city: 'Namur', lat: 50.4669, lon: 4.8676 },
  { city: 'Arlon', lat: 49.6834, lon: 5.8064 },
  { city: 'Hasselt', lat: 50.9313, lon: 5.3381 },
  { city: 'Bruges', lat: 51.2093, lon: 3.2244 },
]

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

export function getCityCoordinates(town: string): CityCoord | null {
  return cityCoordinates.find(c =>
    c.city.toLowerCase() === town.toLowerCase()
  ) || null
}

export function getDistanceFromHome(town: string, homeCoords: CityCoord): number {
  const destCoords = getCityCoordinates(town)
  if (!destCoords) return 0
  return getDistance(homeCoords.lat, homeCoords.lon, destCoords.lat, destCoords.lon)
}
