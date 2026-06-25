const OVERPASS_URL = "https://overpass-api.de/api/interpreter"
const CACHE_TTL = 24 * 60 * 60 * 1000

export interface FireStation {
  id: number
  name: string
  lat: number
  lng: number
}

const cache = new Map<string, { data: FireStation[]; ts: number }>()

export async function fetchFireStations(): Promise<FireStation[]> {
  const cached = cache.get("valparaiso")
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const query = `
    [out:json];
    area["name"="Región de Valparaíso"]->.a;
    (
      node["amenity"="fire_station"](area.a);
      way["amenity"="fire_station"](area.a);
      relation["amenity"="fire_station"](area.a);
    );
    out center;
  `

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()

    const stations: FireStation[] = []
    const seen = new Set<number>()

    for (const el of json.elements || []) {
      if (el.type === "node") {
        const name = el.tags?.name || el.tags?.operator || "Bomberos"
        if (!seen.has(el.id)) {
          stations.push({ id: el.id, name, lat: el.lat, lng: el.lon })
          seen.add(el.id)
        }
      } else if (el.type === "way" && el.center) {
        const name = el.tags?.name || el.tags?.operator || "Bomberos"
        if (!seen.has(el.id)) {
          stations.push({ id: el.id, name, lat: el.center.lat, lng: el.center.lon })
          seen.add(el.id)
        }
      }
    }

    cache.set("valparaiso", { data: stations, ts: Date.now() })
    return stations
  } catch {
    return []
  }
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function nearestStation(
  lat: number,
  lng: number,
  stations: FireStation[],
): FireStation | null {
  if (stations.length === 0) return null

  let best: FireStation | null = null
  let bestDist = Infinity

  for (const s of stations) {
    const dlat = toRad(s.lat - lat)
    const dlng = toRad(s.lng - lng)
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(toRad(lat)) * Math.cos(toRad(s.lat)) * Math.sin(dlng / 2) ** 2
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    if (dist < bestDist) {
      bestDist = dist
      best = s
    }
  }

  return best
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}
