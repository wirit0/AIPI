import type { Zone } from "./RiskMap"

const fmt = (d: Date | null | undefined) => {
  if (!d) return "—"
  return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export default function MapValuesPanel({ selected, topRisk }: { selected: Zone | null; topRisk: Zone | null }) {
  const zone = selected || topRisk
  if (!zone) return null

  return (
    <div className="leaflet-top leaflet-left" style={{ zIndex: 1000 }}>
      <div
        style={{
          background: "rgba(7,12,18,0.92)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 8,
          padding: "10px 12px",
          margin: "12px 0 0 12px",
          backdropFilter: "blur(8px)",
          minWidth: 180,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
          {zone.name}
        </div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 6 }}>
          {fmt(zone.lastUpdate)}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 2 }}>TEMP</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: zone.temp != null && zone.temp > 35 ? "#ef4444" : zone.temp != null && zone.temp > 28 ? "#f59e0b" : "#22c55e" }}>
              {zone.temp != null ? `${zone.temp.toFixed(1)}°` : "—"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 2 }}>HUM</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: zone.humidity != null && zone.humidity < 25 ? "#ef4444" : zone.humidity != null && zone.humidity < 40 ? "#f59e0b" : "#22c55e" }}>
              {zone.humidity != null ? `${zone.humidity.toFixed(0)}%` : "—"}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginBottom: 2 }}>VTO</div>
            <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: zone.wind != null && zone.wind > 50 ? "#ef4444" : zone.wind != null && zone.wind > 30 ? "#f59e0b" : "#22c55e" }}>
              {zone.wind != null ? `${zone.wind.toFixed(0)}k` : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
