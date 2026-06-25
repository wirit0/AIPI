import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet"
import L from "leaflet"
import type { GeoJsonObject, Feature, Polygon, MultiPolygon } from "geojson"
import geoDataUrl from "../../assets/valparaiso-comunas.geojson?url"
import FireStationMarkers from "./FireStationMarkers"
import SubZoneLayer from "./SubZoneLayer"
import MapValuesPanel from "./MapValuesPanel"

export type RiskLevel = "NORMAL" | "PREVENTIVO" | "CRITICO" | "SIN_DATOS"

export interface Zone {
  id: string
  name: string
  risk: RiskLevel
  temp?: number | null
  humidity?: number | null
  wind?: number | null
  lastUpdate?: Date | null
}

interface RiskMapProps {
  zones: Zone[]
  selectedZoneId: string | null
  onSelect: (id: string | null) => void
  activeSubZones?: Record<string, string>
}

const COMMUNE_TO_ZONE: Record<string, string> = {
  "La Ligua": "z1",
  "Petorca": "z2",
  "Viña del Mar": "z3",
  "Valparaíso": "z4",
  "Quilpué": "z5",
  "Villa Alemana": "z6",
  "Casablanca": "z7",
  "San Antonio": "z8",
}

const RISK_COLORS: Record<RiskLevel, string> = {
  NORMAL: "#22c55e",
  PREVENTIVO: "#f59e0b",
  CRITICO: "#ef4444",
  SIN_DATOS: "#475569",
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Sin riesgo", color: RISK_COLORS.NORMAL },
    { label: "Preventivo", color: RISK_COLORS.PREVENTIVO },
    { label: "Crítico", color: RISK_COLORS.CRITICO },
    { label: "Sin datos", color: RISK_COLORS.SIN_DATOS },
  ]
  return (
    <div className="leaflet-bottom leaflet-right" style={{ zIndex: 1000 }}>
      <div className="leaflet-control leaflet-bar" style={{ background: "rgba(7,12,18,0.92)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px 12px", margin: "0 12px 12px 0", backdropFilter: "blur(8px)" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Riesgo</div>
        {items.map(({ label, color }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: color, opacity: 0.7 }} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontFamily: "monospace" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RiskMap({ zones, selectedZoneId, onSelect, activeSubZones = {} }: RiskMapProps) {
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null)

  useEffect(() => {
    fetch(geoDataUrl)
      .then((r) => r.json())
      .then((data) => setGeoData(data))
      .catch(() => {})
  }, [])

  const zoneMap = useMemo(() => {
    const m: Record<string, Zone> = {}
    zones.forEach((z) => { m[z.id] = z })
    return m
  }, [zones])

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) || null,
    [zones, selectedZoneId],
  )

  const topRiskZone = useMemo(() => {
    const withData = zones.filter((z) => z.temp != null && z.risk !== "SIN_DATOS")
    if (withData.length === 0) return null
    const order: Record<string, number> = { CRITICO: 0, PREVENTIVO: 1, NORMAL: 2, SIN_DATOS: 3 }
    return withData.sort((a, b) => (order[a.risk] ?? 9) - (order[b.risk] ?? 9))[0]
  }, [zones])

  const commZoneMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [commune, zid] of Object.entries(COMMUNE_TO_ZONE)) {
      m[commune] = zid
    }
    return m
  }, [])

  function getRiskForCommune(communeName: string): RiskLevel | null {
    const zid = commZoneMap[communeName]
    if (!zid) return null
    const zone = zoneMap[zid]
    return zone ? zone.risk : "SIN_DATOS"
  }

  function styleFeature(_feature: Feature<Polygon | MultiPolygon>) {
    return {
      color: "rgba(255,255,255,0.15)",
      weight: 0.8,
      fillColor: "rgba(255,255,255,0.02)",
      fillOpacity: 0.1,
    }
  }

  function onEachFeature(feature: Feature<Polygon | MultiPolygon>, layer: L.Layer) {
    const name = feature.properties?.Comuna || feature.properties?.comuna || ""
    const zid = commZoneMap[name]

    layer.on({
      click: () => {
        if (zid) onSelect(zid)
      },
      mouseover: (e) => {
        const target = e.target as L.Path
        target.setStyle({ weight: 1.5, color: "rgba(255,255,255,0.35)" })
        if (name) {
          target.bindTooltip(name, {
            permanent: false,
            direction: "center",
            className: "risk-tooltip",
          }).openTooltip()
        }
      },
      mouseout: (e) => {
        const target = e.target as L.Path
        target.resetStyle()
        target.unbindTooltip()
      },
    })
  }

  return (
    <div style={{ width: "100%", height: 520, borderRadius: 8, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      <MapContainer
        center={[-33.05, -71.3]}
        zoom={9}
        minZoom={8}
        maxZoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {geoData && (
          <GeoJSON
            key={selectedZoneId || "none"}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
        <SubZoneLayer zones={zones} selectedZoneId={selectedZoneId} onSelect={onSelect} activeSubZones={activeSubZones} />
        <MapValuesPanel selected={selectedZone} topRisk={topRiskZone} />
        <FireStationMarkers zones={zones} selectedZoneId={selectedZoneId} />
        <Legend />
      </MapContainer>
    </div>
  )
}
