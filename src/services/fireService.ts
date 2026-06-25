const FIRMS_API_KEY = import.meta.env.VITE_FIRMS_API_KEY || ""

const CACHE_TTL = 10 * 60 * 1000

interface CacheEntry {
  data: FireHotspot[]
  ts: number
}

export interface FireHotspot {
  lat: number
  lng: number
  frp: number
  confidence: string
  satellite: string
}

const cache = new Map<string, CacheEntry>()

const REGION_BBOX = "-72.0,-34.0,-70.5,-32.0"

export async function fetchHotspots(): Promise<FireHotspot[]> {
  if (!FIRMS_API_KEY) return []

  const key = "firms"
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  try {
    const sources = ["MODIS_NRT", "VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"]
    const all: FireHotspot[] = []

    for (const source of sources) {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/json/${FIRMS_API_KEY}/${source}/${REGION_BBOX}/1`
      const res = await fetch(url)
      if (!res.ok) continue
      const list: any[] = await res.json()
      for (const item of list) {
        all.push({
          lat: item.latitude,
          lng: item.longitude,
          frp: item.frp || 0,
          confidence: item.confidence || "unknown",
          satellite: item.satellite || source,
        })
      }
    }

    cache.set(key, { data: all, ts: Date.now() })
    return all
  } catch {
    return []
  }
}

export function isFirmsConfigured(): boolean {
  return FIRMS_API_KEY.length > 0
}
