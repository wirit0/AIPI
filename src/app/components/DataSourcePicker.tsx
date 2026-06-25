export type DataSource = "simulado" | "openmeteo" | "firms"

interface Props {
  value: DataSource
  onChange: (v: DataSource) => void
}

const OPTIONS: { value: DataSource; label: string; desc: string }[] = [
  { value: "simulado", label: "Simulado", desc: "Datos generados aleatoriamente" },
  { value: "openmeteo", label: "Open-Meteo", desc: "Clima real (sin API key)" },
  { value: "firms", label: "Open-Meteo + FIRMS", desc: "Clima real + focos de calor NASA" },
]

export default function DataSourcePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-muted-foreground font-jetbrains uppercase tracking-wider">
        Fuente:
      </span>
      {OPTIONS.map(({ value: v, label, desc }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`text-xs px-3 py-1.5 rounded border font-jetbrains transition-colors ${
            value === v
              ? "bg-green-500/15 text-green-400 border-green-500/40"
              : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          }`}
          title={desc}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
