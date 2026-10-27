// Weather city picker data — the full China province/city/district catalogue
// shipped by the feed provider (China-City-List), kept as a three-level hierarchy and
// served as a static JSON at `/weather-cities.json`. Each district carries the
// `Province_City_District` key the weather feed expects (e.g.
// `Beijing_Beijing_Haidian`).

export type WeatherDistrict = [cn: string, key: string]
export type WeatherCity = [display: string, districts: WeatherDistrict[]]
export type WeatherProvince = [display: string, cities: WeatherCity[]]

let cache: WeatherProvince[] | null = null

/** Load the province/city/district catalogue once, memoized for the session. */
export async function loadWeatherCities(): Promise<WeatherProvince[]> {
  if (cache) return cache
  const res = await fetch('/weather-cities.json')
  if (!res.ok) {
    throw new Error(`weather-cities.json: HTTP ${res.status}`)
  }
  cache = (await res.json()) as WeatherProvince[]
  return cache
}

/**
 * Resolve a persisted location key (e.g. `Beijing_Beijing_Haidian`) back to its
 * province/city/district indexes so the picker can show the current selection.
 * Returns null when the key isn't in the catalogue (e.g. a manually-typed value
 * from before the picker existed) — callers then fall back to a free-text input.
 */
export function findWeatherLocation(
  provinces: WeatherProvince[],
  locationKey: string
): { province: number; city: number; district: number } | null {
  for (let p = 0; p < provinces.length; p++) {
    const cities = provinces[p][1]
    for (let c = 0; c < cities.length; c++) {
      const districts = cities[c][1]
      for (let d = 0; d < districts.length; d++) {
        if (districts[d][1] === locationKey) {
          return { province: p, city: c, district: d }
        }
      }
    }
  }
  return null
}
