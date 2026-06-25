import { useMemo } from "react"
import { Polygon, Tooltip } from "react-leaflet"
import subZones from "../../data/subZones"
import type { SubZone } from "../../data/subZones"
import type { Zone } from "./RiskMap"

interface SubZoneLayerProps {
  zones: Zone[]
  selectedZoneId: string | null
  onSelect: (id: string | null) => void
  activeSubZones?: Record<string, string>
}

const NEUTRAL_FILL = "rgba(255,255,255,0.02)"
const NEUTRAL_STROKE = "rgba(255,255,255,0.08)"

const RISK_COLORS = {
  NORMAL: "#22c55e",
  PREVENTIVO: "#f59e0b",
  CRITICO: "#ef4444",
  SIN_DATOS: "#475569",
}

export default function SubZoneLayer({ zones, selectedZoneId, onSelect, activeSubZones = {} }: SubZoneLayerProps) {
  const zoneMap = useMemo(() => {
    const m: Record<string, Zone> = {}
    zones.forEach((z) => { m[z.id] = z })
    return m
  }, [zones])

  return (
    <>
      {subZones.map((sz) => {
        const parentZone = zoneMap[sz.parentZoneId]
        const parentRisk = parentZone?.risk ?? "SIN_DATOS"
        const isActiveSubZone = activeSubZones[sz.parentZoneId] === sz.id
        const isSelected = selectedZoneId === sz.id
        const hasRisk = parentRisk === "CRITICO" || parentRisk === "PREVENTIVO"
        const isActive = hasRisk && isActiveSubZone

        let fillColor: string
        let strokeColor: string
        let fillOpacity: number
        let weight: number

        if (isSelected) {
          fillColor = RISK_COLORS[parentRisk]
          strokeColor = "white"
          weight = 2.5
          fillOpacity = 0.55
        } else if (isActive) {
          fillColor = RISK_COLORS[parentRisk]
          strokeColor = RISK_COLORS[parentRisk]
          weight = 1.5
          fillOpacity = 0.35
        } else {
          fillColor = NEUTRAL_FILL
          strokeColor = NEUTRAL_STROKE
          weight = 0.8
          fillOpacity = 0.1
        }

        return (
          <Polygon
            key={sz.id}
            positions={sz.coords}
            pathOptions={{
              color: strokeColor,
              weight,
              fillColor,
              fillOpacity,
            }}
            eventHandlers={{
              click: () => onSelect(sz.id),
              mouseover: (e) => {
                const target = e.target
                target.setStyle({
                  weight: 2.5,
                  color: "white",
                  fillOpacity: isActive ? 0.5 : 0.2,
                })
                target.bringToFront()
                const pz = zoneMap[sz.parentZoneId]
                const hasData = pz && pz.temp != null
                const label = isActive
                  ? `${sz.name} — ${parentRisk}`
                  : `${sz.name}`
                if (isActive && hasData) {
                  const html = `<div style="font-family:monospace;font-size:11px"><b>${sz.name}</b><br/><span style="color:${parentRisk === 'CRITICO' ? '#ef4444' : '#f59e0b'}">${parentRisk}</span><br/>${pz.temp}°C · ${pz.humidity}% · ${pz.wind} km/h</div>`
                  target.bindTooltip(html, {
                    permanent: false,
                    direction: "center",
                    className: "risk-tooltip",
                  }).openTooltip()
                  return
                }
                target.bindTooltip(label, {
                  permanent: false,
                  direction: "center",
                  className: "risk-tooltip",
                }).openTooltip()
              },
              mouseout: (e) => {
                const target = e.target
                target.setStyle({
                  color: strokeColor,
                  weight,
                  fillOpacity,
                })
                target.unbindTooltip()
              },
            }}
          />
        )
      })}
    </>
  )
}
