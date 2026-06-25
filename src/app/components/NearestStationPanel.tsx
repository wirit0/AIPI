import { useMemo } from "react"
import { useFireStations } from "./FireStationMarkers"
import { nearestStation, formatDistance } from "../../services/fireStationService"
import { ZONE_COORDS } from "../../services/coordinates"
import type { Zone } from "./RiskMap"

interface NearestStationPanelProps {
  zone: Zone
}

export default function NearestStationPanel({ zone }: NearestStationPanelProps) {
  const { stations, loading } = useFireStations()

  const result = useMemo(() => {
    if (loading || zone.risk === "NORMAL" || zone.risk === "SIN_DATOS") return null
    const coord = ZONE_COORDS.find((z) => z.id === zone.id)
    if (!coord) return null
    return nearestStation(coord.lat, coord.lng, stations)
  }, [zone, stations, loading])

  if (zone.risk === "NORMAL" || zone.risk === "SIN_DATOS") return null

  return (
    <div className="bg-card border rounded-lg p-4" style={{
      borderColor: zone.risk === "CRITICO" ? "#ef444440" : "#f59e0b40",
    }}>
      <div className="flex items-center gap-2 mb-2">
        <span style={{ fontSize: 16 }}>🚒</span>
        <span className="text-xs font-jetbrains text-muted-foreground uppercase tracking-wider">
          Brigada más cercana
        </span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground font-jetbrains">Cargando estaciones…</p>
      ) : result ? (
        <div>
          <p className="text-sm font-rajdhani font-semibold text-foreground">{result.name}</p>
          <p className="text-xs text-muted-foreground font-jetbrains mt-0.5">
            Distancia: {formatDistance(
              haversine(
                ZONE_COORDS.find((z) => z.id === zone.id)!.lat,
                ZONE_COORDS.find((z) => z.id === zone.id)!.lng,
                result.lat,
                result.lng,
              )
            )}
          </p>
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground font-jetbrains">
              {zone.risk === "CRITICO" ? (
                <span style={{ color: "#ef4444" }}>🔴 Notificar a la brigada para atención inmediata</span>
              ) : (
                <span style={{ color: "#d97706" }}>🟠 Alertar a la brigada para supervisión preventiva</span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground font-jetbrains">Sin datos de brigadas disponibles</p>
      )}
    </div>
  )
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = toRad(lat2 - lat1)
  const dlng = toRad(lng2 - lng1)
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dlng / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
