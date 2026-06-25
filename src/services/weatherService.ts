const BASE = "https://api.open-meteo.com/v1/forecast"
const CACHE_TTL = 5 * 60 * 1000

interface CacheEntry {
  data: WeatherResult
  ts: number
}

interface WeatherResult {
  temp: number | null
  humidity: number | null
  wind: number | null
}

const cache = new Map<string, CacheEntry>()

export async function fetchWeather(lat: number, lng: number): Promise<WeatherResult> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data
  }

  try {
    const url = `${BASE}?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const c = json.current
    const data: WeatherResult = {
      temp: c?.temperature_2m ?? null,
      humidity: c?.relative_humidity_2m ?? null,
      wind: c?.wind_speed_10m ?? null,
    }
    cache.set(key, { data, ts: Date.now() })
    return data
  } catch {
    return { temp: null, humidity: null, wind: null }
  }
}

export function clearWeatherCache() {
  cache.clear()
}
