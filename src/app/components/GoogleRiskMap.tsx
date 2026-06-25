import { useEffect, useMemo, useState, useCallback } from "react"
import { LoadScriptNext, GoogleMap, Polygon, InfoWindow } from "@react-google-maps/api"
import type { GeoJsonObject, Feature, Polygon as GeoPolygon, MultiPolygon } from "geojson"
import geoDataUrl from "../../assets/valparaiso-comunas.geojson?url"

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""

type RiskLevel = "NORMAL" | "PREVENTIVO" | "CRITICO" | "SIN_DATOS"

interface Zone {
  id: string
  name: string
  risk: RiskLevel
}

interface GoogleRiskMapProps {
  zones: Zone[]
  selectedZoneId: string | null
  onSelect: (id: string | null) => void
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

const mapContainerStyle = { width: "100%", height: "100%" }
const center = { lat: -33.05, lng: -71.3 }

interface CommuneShape {
  name: string
  paths: Array<Array<{ lat: number; lng: number }>>
}

function toLatLng(coords: number[][]): Array<{ lat: number; lng: number }> {
  return coords.map(([lng, lat]) => ({ lat, lng }))
}

function Legend() {
  const items: { label: string; color: string }[] = [
    { label: "Sin riesgo", color: RISK_COLORS.NORMAL },
    { label: "Preventivo", color: RISK_COLORS.PREVENTIVO },
    { label: "Crítico", color: RISK_COLORS.CRITICO },
    { label: "Sin datos", color: RISK_COLORS.SIN_DATOS },
  ]
  return (
    <div
      style={{
        position: "absolute",
        bottom: 24,
        right: 16,
        zIndex: 1000,
        background: "rgba(7,12,18,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 8,
        padding: "10px 12px",
        backdropFilter: "blur(8px)",
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 6,
        }}
      >
        Riesgo
      </div>
      {items.map(({ label, color }) => (
        <div
          key={label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 3,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: color,
              opacity: 0.7,
            }}
          />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}

function riskStyle(risk: RiskLevel | null, isSelected: boolean) {
  if (!risk) {
    return {
      strokeColor: "rgba(255,255,255,0.06)",
      strokeWeight: 0.5,
      fillColor: "rgba(255,255,255,0.02)",
      fillOpacity: 0.3,
    }
  }
  const color = RISK_COLORS[risk]
  return {
    strokeColor: isSelected ? "#ffffff" : "rgba(255,255,255,0.35)",
    strokeWeight: isSelected ? 2.5 : 1,
    fillColor: color,
    fillOpacity: isSelected ? 0.5 : risk === "SIN_DATOS" ? 0.15 : 0.3,
  }
}

export default function GoogleRiskMap({ zones, selectedZoneId, onSelect }: GoogleRiskMapProps) {
  const [geoData, setGeoData] = useState<GeoJsonObject | null>(null)
  const [hoveredCommune, setHoveredCommune] = useState<string | null>(null)
  const [hoveredPosition, setHoveredPosition] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    fetch(geoDataUrl)
      .then((r) => r.json())
      .then((data) => setGeoData(data))
      .catch(() => {})
  }, [])

  const zoneMap = useMemo(() => {
    const m: Record<string, Zone> = {}
    zones.forEach((z) => {
      m[z.id] = z
    })
    return m
  }, [zones])

  const shapes = useMemo(() => {
    if (!geoData) return []
    const features = (geoData as any).features as Feature<GeoPolygon | MultiPolygon>[]
    const result: CommuneShape[] = []
    features.forEach((f) => {
      const name = f.properties?.Comuna || f.properties?.comuna || ""
      if (f.geometry.type === "Polygon") {
        result.push({
          name,
          paths: [toLatLng(f.geometry.coordinates[0])],
        })
      } else if (f.geometry.type === "MultiPolygon") {
        const paths = f.geometry.coordinates.map((ring) => toLatLng(ring[0]))
        result.push({ name, paths })
      }
    })
    return result
  }, [geoData])

  const getRiskForCommune = useCallback(
    (name: string): RiskLevel | null => {
      const zid = COMMUNE_TO_ZONE[name]
      if (!zid) return null
      const zone = zoneMap[zid]
      return zone ? zone.risk : "SIN_DATOS"
    },
    [zoneMap],
  )

  const handleMouseOver = useCallback(
    (name: string, e: google.maps.MapMouseEvent) => {
      setHoveredCommune(name)
      if (e.latLng) {
        setHoveredPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })
      }
    },
    [],
  )

  const handleMouseOut = useCallback(() => {
    setHoveredCommune(null)
    setHoveredPosition(null)
  }, [])

  const handleClick = useCallback(
    (name: string) => {
      const zid = COMMUNE_TO_ZONE[name]
      if (zid) onSelect(zid)
    },
    [onSelect],
  )

  if (!API_KEY) {
    return (
      <div
        style={{
          width: "100%",
          height: 520,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 8,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "monospace",
          fontSize: 13,
        }}
      >
        Define VITE_GOOGLE_MAPS_API_KEY en .env
      </div>
    )
  }

  return (
    <div
      style={{
        width: "100%",
        height: 520,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        position: "relative",
      }}
    >
      <LoadScriptNext googleMapsApiKey={API_KEY} loadingElement={<div style={{ height: "100%" }} />}>
        <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={9} options={{ minZoom: 8, maxZoom: 14 }}>
          {shapes.map((shape) => {
            const risk = getRiskForCommune(shape.name)
            const zid = COMMUNE_TO_ZONE[shape.name]
            const isSelected = zid === selectedZoneId
            const style = riskStyle(risk, isSelected)
            const isHovered = hoveredCommune === shape.name

            return (
              <Polygon
                key={shape.name}
                paths={shape.paths}
                options={{
                  ...style,
                  fillOpacity: isHovered ? Math.min(style.fillOpacity + 0.15, 0.7) : style.fillOpacity,
                  zIndex: isHovered || isSelected ? 2 : 1,
                }}
                onMouseOver={(e) => handleMouseOver(shape.name, e)}
                onMouseOut={handleMouseOut}
                onClick={() => handleClick(shape.name)}
              />
            )
          })}

          {hoveredCommune && hoveredPosition && (
            <InfoWindow position={hoveredPosition} onCloseClick={handleMouseOut} options={{ disableAutoPan: true }}>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#111",
                  padding: "2px 0",
                }}
              >
                {hoveredCommune}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
        <Legend />
      </LoadScriptNext>
    </div>
  )
}
