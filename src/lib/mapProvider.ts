import type { MapProvider } from '@/types'

/** Builds a maps URL for the given provider from a raw location string. */
export function buildMapUrl(provider: MapProvider, location: string): string {
  const query = encodeURIComponent(location)
  switch (provider) {
    case 'apple':
      return `https://maps.apple.com/?q=${query}`
    case 'osm':
      return `https://www.openstreetmap.org/search?query=${query}`
    case 'mapy':
      return `https://mapy.com/en/zakladni?q=${query}`
    case 'geo':
      return `geo:0,0?q=${query}`
    case 'google':
    default:
      return `https://www.google.com/maps/search/?api=1&query=${query}`
  }
}
