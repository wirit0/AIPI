import { useEffect, useMemo, useState } from "react"
import { Marker, Popup } from "react-leaflet"
import L from "leaflet"
import { fetchFireStations, nearestStation, formatDistance } from "../../services/fireStationService"
import { ZONE_COORDS } from "../../services/coordinates"
import type { FireStation } from "../../services/fireStationService"
import type { Zone } from "./RiskMap"

interface FireStationMarkersProps {
  zones: Zone[]
  selectedZoneId: string | null
}

const zoneCoordsMap: Record<string, { lat: number; lng: number }> = {}
ZONE_COORDS.forEach((z) => { zoneCoordsMap[z.id] = { lat: z.lat, lng: z.lng } })

const ICON_DEFAULT = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;background:#1e40af;border:2px solid #60a5fa;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:pointer;"><span style="color:white;font-size:11px;font-weight:bold;line-height:1;">🧯</span></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
})

const ICON_ALERT = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;background:#dc2626;border:2px solid #fca5a5;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(220,38,38,0.7);cursor:pointer;animation:pulse-alert 1.5s infinite;"><span style="color:white;font-size:13px;font-weight:bold;line-height:1;">🚒</span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

export function useFireStations() {
  const [stations, setStations] = useState<FireStation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFireStations().then((s) => {
      setStations(s)
      setLoading(false)
    })
  }, [])

  return { stations, loading }
}

function nearestRiskZone(
  station: FireStation,
  zones: Zone[],
): { zone: Zone; dist: number } | null {
  let best: { zone: Zone; dist: number } | null = null

  for (const z of zones) {
    if (z.risk !== "CRITICO" && z.risk !== "PREVENTIVO") continue
    const c = zoneCoordsMap[z.id]
    if (!c) continue

    const dlat = toRad(c.lat - station.lat)
    const dlng = toRad(c.lng - station.lng)
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(toRad(station.lat)) * Math.cos(toRad(c.lat)) * Math.sin(dlng / 2) ** 2
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    if (!best || dist < best.dist) {
      best = { zone: z, dist }
    }
  }

  return best
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export default function FireStationMarkers({ zones, selectedZoneId }: FireStationMarkersProps) {
  const { stations } = useFireStations()

  const alertStationIds = useMemo(() => {
    const ids = new Set<number>()
    for (const z of zones) {
      if (z.risk !== "CRITICO" && z.risk !== "PREVENTIVO") continue
      const c = zoneCoordsMap[z.id]
      if (!c) continue
      const nearest = nearestStation(c.lat, c.lng, stations)
      if (nearest) ids.add(nearest.id)
    }
    return ids
  }, [zones, stations])

  return (
    <>
      {stations.map((s) => {
        const isAlert = alertStationIds.has(s.id)
        const near = nearestRiskZone(s, zones)

        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={isAlert ? ICON_ALERT : ICON_DEFAULT}
          >
            <Popup>
              <div style={{ fontFamily: "monospace", fontSize: 12, minWidth: 160 }}>
                <strong style={{ fontSize: 13 }}>🚒 {s.name}</strong>
                {near && (
                  <div style={{ marginTop: 6, padding: "4px 0", borderTop: "1px solid #eee" }}>
                    <span style={{ color: near.zone.risk === "CRITICO" ? "#dc2626" : "#d97706" }}>
                      {near.zone.risk === "CRITICO" ? "🔴" : "🟠"} Alerta en {near.zone.name}
                    </span>
                    <br />
                    <span style={{ fontSize: 11, color: "#666" }}>
                      a {formatDistance(near.dist)}
                    </span>
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}
