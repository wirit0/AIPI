import { useState, useEffect, useCallback, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity, AlertTriangle, Thermometer, Droplets, Wind,
  MapPin, Clock, Bug, Play, Pause, Zap, Database, Shield,
  CheckCircle, XCircle, Info, Send, Radio, FileText, BarChart2,
} from "lucide-react";
import RiskMap from "./components/RiskMap";
import NearestStationPanel from "./components/NearestStationPanel";
import DataSourcePicker from "./components/DataSourcePicker";
import type { DataSource } from "./components/DataSourcePicker";
import { fetchWeather } from "../services/weatherService";
import { fetchHotspots, isFirmsConfigured } from "../services/fireService";
import { ZONE_COORDS } from "../services/coordinates";
import subZones, { getSubZonesByParent } from "../data/subZones";
import { saveReading, saveAlert, saveEvent, saveZone } from "../services/supabaseService";

// =============================== Types ===============================

type RiskLevel = "NORMAL" | "PREVENTIVO" | "CRITICO" | "SIN_DATOS";
type AlertStatus = "nueva" | "en_revision" | "atendida";
type BugStatus = "pendiente" | "revisado" | "resuelto";

interface Zone {
  id: string; name: string;
  x: number; y: number;
  risk: RiskLevel;
  temp: number | null; humidity: number | null; wind: number | null;
  lastUpdate: Date | null;
}

interface Reading {
  id: string;
  zoneId: string; zoneName: string;
  timestamp: Date;
  temp: number | null; humidity: number | null; wind: number | null;
  valid: boolean; rejectionReason?: string;
  generatedAlert: boolean; risk: RiskLevel;
}

interface Alert {
  id: string; timestamp: Date;
  zoneId: string; zoneName: string;
  risk: RiskLevel;
  temp: number; humidity: number; wind: number;
  status: AlertStatus;
}

interface HistoricalEvent {
  id: string; timestamp: Date;
  zoneId: string; zoneName: string;
  temp: number; humidity: number; wind: number;
  risk: RiskLevel; alertType: string;
}

interface BugReport {
  id: string; timestamp: Date;
  title: string; description: string;
  status: BugStatus;
}

// ============================= Constants =============================

const ZONE_DEFS = [
  { id: "z1", name: "La Ligua",       x: 128, y: 55  },
  { id: "z2", name: "Petorca",        x: 215, y: 75  },
  { id: "z3", name: "Viña del Mar",   x: 72,  y: 153 },
  { id: "z4", name: "Valparaíso",     x: 55,  y: 180 },
  { id: "z5", name: "Quilpué",        x: 162, y: 170 },
  { id: "z6", name: "Villa Alemana",  x: 232, y: 163 },
  { id: "z7", name: "Casablanca",     x: 172, y: 257 },
  { id: "z8", name: "San Antonio",    x: 100, y: 308 },
];

const RISK_HEX: Record<RiskLevel, string> = {
  NORMAL:     "#22c55e",
  PREVENTIVO: "#f59e0b",
  CRITICO:    "#ef4444",
  SIN_DATOS:  "#475569",
};

const RISK_CLASS: Record<RiskLevel, string> = {
  NORMAL:     "bg-green-500/15 text-green-400 border-green-500/25",
  PREVENTIVO: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  CRITICO:    "bg-red-500/15 text-red-400 border-red-500/25",
  SIN_DATOS:  "bg-slate-600/15 text-slate-400 border-slate-600/25",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  NORMAL: "Normal", PREVENTIVO: "Preventivo", CRITICO: "Crítico", SIN_DATOS: "Sin datos",
};

let _uid = 300;
const uid = () => `${++_uid}_${Date.now().toString(36)}`;

const fmt = (d: Date) =>
  d.toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const fmtT = (d: Date) =>
  d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// =================== Simulation & Validation Logic ===================

function validate(t: number | null, h: number | null, w: number | null): { ok: boolean; reason?: string } {
  if (t === null || h === null || w === null || isNaN(t as number) || isNaN(h as number) || isNaN(w as number))
    return { ok: false, reason: "Valor nulo o no numérico detectado en sensor" };
  if ((t as number) < -10 || (t as number) > 60)
    return { ok: false, reason: `Temperatura fuera de rango: ${t}°C (esperado: -10 a 60°C)` };
  if ((h as number) < 0 || (h as number) > 100)
    return { ok: false, reason: `Humedad inválida: ${h}% (esperado: 0—100%)` };
  if ((w as number) < 0 || (w as number) > 200)
    return { ok: false, reason: `Velocidad de viento inválida: ${w} km/h (esperado: 0—200)` };
  return { ok: true };
}

function classify(t: number, h: number, w: number): RiskLevel {
  if (t > 38 || h < 25 || w > 50) return "CRITICO";
  if (t > 32 || h < 40 || w > 30) return "PREVENTIVO";
  return "NORMAL";
}

const rnd = (a: number, b: number, dp = 1) =>
  parseFloat((Math.random() * (b - a) + a).toFixed(dp));

function simValues(scenario: string): { t: number | null; h: number | null; w: number | null } {
  switch (scenario) {
    case "normal":     return { t: rnd(14, 29), h: rnd(55, 82), w: rnd(4, 22) };
    case "preventivo": return { t: rnd(33, 37), h: rnd(26, 39), w: rnd(31, 49) };
    case "critico":    return { t: rnd(39, 47), h: rnd(8,  24), w: rnd(51, 88) };
    case "error": {
      const e = Math.floor(Math.random() * 4);
      if (e === 0) return { t: null,  h: rnd(50, 75), w: rnd(8, 22) };
      if (e === 1) return { t: 9999,  h: rnd(50, 75), w: rnd(8, 22) };
      if (e === 2) return { t: rnd(22, 35), h: -99,   w: rnd(8, 22) };
      return             { t: rnd(22, 35), h: rnd(50, 75), w: 999   };
    }
    default: {
      const r = Math.random();
      return simValues(r < 0.55 ? "normal" : r < 0.80 ? "preventivo" : r < 0.95 ? "critico" : "error");
    }
  }
}

// ============================= Seed Data =============================

const T0 = Date.now();

const SEED_READINGS: Reading[] = [
  { id: "r1", zoneId: "z4", zoneName: "Valparaíso",    timestamp: new Date(T0 - 300000), temp: 41.2, humidity: 18.5, wind: 62.0, valid: true,  generatedAlert: true,  risk: "CRITICO"    },
  { id: "r2", zoneId: "z7", zoneName: "Casablanca",    timestamp: new Date(T0 - 240000), temp: 34.8, humidity: 32.1, wind: 38.5, valid: true,  generatedAlert: true,  risk: "PREVENTIVO" },
  { id: "r3", zoneId: "z3", zoneName: "Viña del Mar",  timestamp: new Date(T0 - 190000), temp: 22.3, humidity: 68.0, wind: 15.2, valid: true,  generatedAlert: false, risk: "NORMAL"     },
  { id: "r4", zoneId: "z5", zoneName: "Quilpué",       timestamp: new Date(T0 - 155000), temp: 9999, humidity: 55.0, wind: 18.0, valid: false, rejectionReason: "Temperatura fuera de rango: 9999°C (esperado: -10 a 60°C)", generatedAlert: false, risk: "SIN_DATOS" },
  { id: "r5", zoneId: "z1", zoneName: "La Ligua",      timestamp: new Date(T0 - 120000), temp: 28.5, humidity: 45.2, wind: 25.0, valid: true,  generatedAlert: false, risk: "NORMAL"     },
  { id: "r6", zoneId: "z6", zoneName: "Villa Alemana", timestamp: new Date(T0 -  92000), temp: 35.1, humidity: 36.8, wind: 42.3, valid: true,  generatedAlert: true,  risk: "PREVENTIVO" },
  { id: "r7", zoneId: "z2", zoneName: "Petorca",       timestamp: new Date(T0 -  60000), temp: null, humidity: 60.0, wind: 20.0, valid: false, rejectionReason: "Valor nulo o no numérico detectado en sensor",             generatedAlert: false, risk: "SIN_DATOS" },
];

function seedZones(): Zone[] {
  const init: Record<string, Partial<Zone>> = {
    z3: { risk: "NORMAL",     temp: 22.3, humidity: 68.0, wind: 15.2, lastUpdate: new Date(T0 - 190000) },
    z4: { risk: "CRITICO",    temp: 41.2, humidity: 18.5, wind: 62.0, lastUpdate: new Date(T0 - 300000) },
    z6: { risk: "PREVENTIVO", temp: 35.1, humidity: 36.8, wind: 42.3, lastUpdate: new Date(T0 -  92000) },
    z7: { risk: "PREVENTIVO", temp: 34.8, humidity: 32.1, wind: 38.5, lastUpdate: new Date(T0 - 240000) },
    z1: { risk: "NORMAL",     temp: 28.5, humidity: 45.2, wind: 25.0, lastUpdate: new Date(T0 - 120000) },
  };
  return ZONE_DEFS.map(z => ({
    ...z,
    risk: "SIN_DATOS" as RiskLevel,
    temp: null, humidity: null, wind: null, lastUpdate: null,
    ...(init[z.id] || {}),
  }));
}

const SEED_ALERTS: Alert[] = [
  { id: "a1", timestamp: new Date(T0 - 300000), zoneId: "z4", zoneName: "Valparaíso",    risk: "CRITICO",    temp: 41.2, humidity: 18.5, wind: 62.0, status: "nueva"      },
  { id: "a2", timestamp: new Date(T0 - 240000), zoneId: "z7", zoneName: "Casablanca",    risk: "PREVENTIVO", temp: 34.8, humidity: 32.1, wind: 38.5, status: "en_revision" },
  { id: "a3", timestamp: new Date(T0 -  92000), zoneId: "z6", zoneName: "Villa Alemana", risk: "PREVENTIVO", temp: 35.1, humidity: 36.8, wind: 42.3, status: "nueva"      },
  { id: "a4", timestamp: new Date(T0 - 86400000), zoneId: "z4", zoneName: "Valparaíso", risk: "CRITICO",    temp: 43.0, humidity: 15.0, wind: 71.0, status: "atendida"    },
];

const SEED_EVENTS: HistoricalEvent[] = [
  { id: "e1", timestamp: new Date(T0 - 86400000 * 5),  zoneId: "z4", zoneName: "Valparaíso",   temp: 43.0, humidity: 14.0, wind: 75.0, risk: "CRITICO",    alertType: "Incendio forestal mayor"       },
  { id: "e2", timestamp: new Date(T0 - 86400000 * 12), zoneId: "z7", zoneName: "Casablanca",   temp: 38.5, humidity: 22.0, wind: 58.0, risk: "CRITICO",    alertType: "Alerta crítica activada"       },
  { id: "e3", timestamp: new Date(T0 - 86400000 * 20), zoneId: "z1", zoneName: "La Ligua",     temp: 36.2, humidity: 28.0, wind: 44.0, risk: "PREVENTIVO", alertType: "Alerta preventiva activada"    },
  { id: "e4", timestamp: new Date(T0 - 86400000 * 30), zoneId: "z8", zoneName: "San Antonio",  temp: 40.1, humidity: 19.0, wind: 63.0, risk: "CRITICO",    alertType: "Incendio forestal controlado"  },
  { id: "e5", timestamp: new Date(T0 - 86400000 * 45), zoneId: "z5", zoneName: "Quilpué",      temp: 33.8, humidity: 31.0, wind: 38.0, risk: "PREVENTIVO", alertType: "Alerta preventiva activada"    },
];

const SEED_BUGS: BugReport[] = [
  { id: "b1", timestamp: new Date(T0 - 7200000),       title: "Sensor Quilpué sin transmisión válida",   description: "El sensor en Quilpué lleva 2 horas enviando valores fuera de rango. Verificar calibración del dispositivo y conexión MQTT.",                                status: "en_revision" },
  { id: "b2", timestamp: new Date(T0 - 86400000 * 2),  title: "Alerta duplicada en zona Casablanca",     description: "Se generaron dos alertas simultáneas para la misma lectura en Casablanca. Posible condición de carrera en el procesador de eventos del backend.", status: "resuelto"    },
];

// ========================= Helper Components =========================

function RiskBadge({ risk, small }: { risk: RiskLevel; small?: boolean }) {
  return (
    <span className={`${small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"} rounded border font-jetbrains font-medium ${RISK_CLASS[risk]}`}>
      {RISK_LABELS[risk]}
    </span>
  );
}

function EmptyState({ icon: Icon, message, color }: { icon: LucideIcon; message: string; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon className={`w-9 h-9 ${color} mb-2 opacity-60`} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number | string; icon: LucideIcon; color: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-jetbrains uppercase tracking-wider">{label}</span>
        <Icon className={`w-4 h-4 ${color} opacity-70`} />
      </div>
      <div className={`text-3xl font-rajdhani font-bold leading-none ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground font-jetbrains">{sub}</div>}
    </div>
  );
}

function SensorCard({ label, value, unit, icon: Icon, thresholds, invert }: {
  label: string; value: number | null; unit: string;
  icon: LucideIcon; thresholds: { warn: number; crit: number }; invert?: boolean;
}) {
  const isCrit = value !== null && (invert ? value < thresholds.crit : value > thresholds.crit);
  const isWarn = !isCrit && value !== null && (invert ? value < thresholds.warn : value > thresholds.warn);
  const col = isCrit ? "text-red-400" : isWarn ? "text-amber-400" : "text-green-400";
  const bg  = isCrit ? "border-red-500/25 bg-red-500/5" : isWarn ? "border-amber-500/25 bg-amber-500/5" : "border-green-500/25 bg-green-500/5";
  return (
    <div className={`bg-card border rounded-lg p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${col}`} />
        <span className="text-[11px] text-muted-foreground font-jetbrains uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-4xl font-rajdhani font-bold leading-none ${col}`}>
        {value !== null ? value : "—"}
        <span className="text-lg ml-1 font-medium opacity-70">{unit}</span>
      </div>
      <div className="text-[10px] text-muted-foreground font-jetbrains mt-2">
        Prev: {invert ? "<" : ">"}{thresholds.warn}{unit} · Crítico: {invert ? "<" : ">"}{thresholds.crit}{unit}
      </div>
    </div>
  );
}

function AlertCard({ alert, onUpdate }: { alert: Alert; onUpdate: (id: string, s: AlertStatus) => void }) {
  const isCrit = alert.risk === "CRITICO";
  return (
    <div className={`border rounded-lg p-3 ${isCrit ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${isCrit ? "bg-red-400 animate-pulse" : "bg-amber-400"}`} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground leading-tight">{alert.zoneName}</div>
            <div className="text-[11px] text-muted-foreground font-jetbrains mt-0.5">{fmt(alert.timestamp)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <RiskBadge risk={alert.risk} small />
          <select
            value={alert.status}
            onChange={e => onUpdate(alert.id, e.target.value as AlertStatus)}
            className="text-[11px] bg-card border border-border rounded px-1.5 py-1 text-foreground focus:outline-none focus:border-green-500/50 cursor-pointer"
          >
            <option value="nueva">Nueva</option>
            <option value="en_revision">En revisión</option>
            <option value="atendida">Atendida</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-[11px] font-jetbrains text-muted-foreground">
        <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" />{alert.temp}°C</span>
        <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{alert.humidity}%</span>
        <span className="flex items-center gap-1"><Wind className="w-3 h-3" />{alert.wind} km/h</span>
      </div>
    </div>
  );
}

function ZoneRow({ zone, selected, onClick }: { zone: Zone; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-2 rounded border text-left transition-colors hover:bg-muted/30 ${selected ? "border-green-500/40 bg-green-500/5" : `border-border ${RISK_CLASS[zone.risk].split(" ")[0]}`}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: RISK_HEX[zone.risk] }} />
        <span className="text-sm text-foreground">{zone.name}</span>
      </div>
      <div className="flex items-center gap-2">
        {zone.temp !== null && <span className="text-[11px] font-jetbrains text-muted-foreground">{zone.temp}°C</span>}
        <RiskBadge risk={zone.risk} small />
      </div>
    </button>
  );
}

function ZoneDetail({ zone, onClose }: { zone: Zone; onClose: () => void }) {
  const col = RISK_HEX[zone.risk];
  return (
    <div className="bg-card border rounded-lg p-4" style={{ borderColor: `${col}40` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-rajdhani font-semibold text-foreground text-base">{zone.name}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground w-6 h-6 flex items-center justify-center rounded text-lg leading-none">&times;</button>
      </div>
      <div className="mb-3"><RiskBadge risk={zone.risk} /></div>
      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        {[
          { label: "Temperatura", val: zone.temp,     unit: "°C"   },
          { label: "Humedad",     val: zone.humidity, unit: "%"    },
          { label: "Viento",      val: zone.wind,     unit: "km/h" },
        ].map(({ label, val, unit }) => (
          <div key={label} className="bg-muted/30 rounded p-2">
            <div className="text-[10px] text-muted-foreground font-jetbrains mb-1">{label}</div>
            <div className="font-rajdhani font-bold text-foreground text-lg leading-none">
              {val !== null ? val : "—"}
              <span className="text-xs ml-0.5 font-normal opacity-60">{unit}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground font-jetbrains">
        Última actualización: {zone.lastUpdate ? fmt(zone.lastUpdate) : "Sin datos recibidos"}
      </div>
    </div>
  );
}

// =========================== Zone SVG Map ===========================

function ZoneMap({ zones, selectedZoneId, onSelect }: { zones: Zone[]; selectedZoneId: string | null; onSelect: (id: string) => void }) {
  const W = 550; const H = 380;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: "#070c12" }}>
      <defs>
        <pattern id="mapgrid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5" />
        </pattern>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glowsoft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="seaGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0a1929" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#070c12" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Background grid */}
      <rect width={W} height={H} fill="url(#mapgrid)" />

      {/* Sea area (west/left) */}
      <path d="M 0,0 L 42,0 C 38,40 28,80 38,115 C 48,145 33,168 40,195 C 48,222 32,248 40,278 C 48,308 32,340 40,380 L 0,380 Z" fill="url(#seaGrad)" />

      {/* Coastline */}
      <path d="M 42,0 C 38,40 28,80 38,115 C 48,145 33,168 40,195 C 48,222 32,248 40,278 C 48,308 32,340 40,380"
        fill="none" stroke="rgba(59,130,246,0.35)" strokeWidth="1.5" strokeDasharray="5,4" />

      {/* Mountain range (east) */}
      <path d="M 395,0 L 415,28 L 398,58 L 425,88 L 408,118 L 438,148 L 418,178 L 448,208 L 428,238 L 458,268 L 438,298 L 468,328 L 448,380 L 550,380 L 550,0 Z"
        fill="rgba(255,255,255,0.018)" />
      <path d="M 395,0 L 415,28 L 398,58 L 425,88 L 408,118 L 438,148 L 418,178 L 448,208 L 428,238 L 458,268 L 438,298 L 468,328 L 448,380"
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

      {/* Terrain contour lines */}
      {[105, 195, 285].map(y => (
        <path key={y} d={`M 50,${y} Q 110,${y - 12} 175,${y - 2} Q 240,${y + 10} 310,${y - 8} Q 370,${y - 18} 400,${y - 5}`}
          fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
      ))}

      {/* Region labels */}
      <text x="14" y="210" fontSize="8" fill="rgba(59,130,246,0.4)" fontFamily="monospace"
        transform="rotate(-90 14 210)">OC—ANO PACÍFICO</text>
      <text x="422" y="38" fontSize="7.5" fill="rgba(255,255,255,0.18)" fontFamily="monospace">CORDILLERA</text>
      <text x="422" y="49" fontSize="7" fill="rgba(255,255,255,0.1)" fontFamily="monospace">DE LOS ANDES</text>

      {/* Connection edges */}
      {zones.map((z, i) =>
        zones.slice(i + 1).map(z2 => {
          const d = Math.hypot(z.x - z2.x, z.y - z2.y);
          return d < 135 ? (
            <line key={`${z.id}-${z2.id}`}
              x1={z.x} y1={z.y} x2={z2.x} y2={z2.y}
              stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
          ) : null;
        })
      )}

      {/* Zone markers */}
      {zones.map(zone => {
        const col = RISK_HEX[zone.risk];
        const isSel  = selectedZoneId === zone.id;
        const isCrit = zone.risk === "CRITICO";
        const isPrev = zone.risk === "PREVENTIVO";
        return (
          <g key={zone.id} onClick={() => onSelect(zone.id)} style={{ cursor: "pointer" }}>
            {/* Outer pulse for critical */}
            {isCrit && (
              <circle cx={zone.x} cy={zone.y} r={14} fill="none" stroke={col} strokeWidth="1" opacity="0.5">
                <animate attributeName="r"       values="10;20;10" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2.2s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Mid ring for preventive */}
            {isPrev && (
              <circle cx={zone.x} cy={zone.y} r={12} fill="none" stroke={col} strokeWidth="0.8" opacity="0.3">
                <animate attributeName="r"       values="9;16;9" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Selection ring */}
            {isSel && (
              <circle cx={zone.x} cy={zone.y} r={15} fill="none" stroke="white" strokeWidth="1.5" opacity="0.8" />
            )}
            {/* Glow halo */}
            <circle cx={zone.x} cy={zone.y} r={11} fill={col} opacity="0.12" />
            {/* Main dot */}
            <circle cx={zone.x} cy={zone.y} r={7} fill={col} opacity="0.92"
              filter={isCrit || isPrev ? "url(#glowsoft)" : undefined} />
            {/* Inner dot */}
            <circle cx={zone.x} cy={zone.y} r={3} fill="rgba(255,255,255,0.6)" />
            {/* Label */}
            <text x={zone.x} y={zone.y - 13} textAnchor="middle"
              fontSize={isSel ? "9.5" : "9"} fontWeight={isSel ? "bold" : "normal"}
              fill={isSel ? "white" : "rgba(255,255,255,0.72)"} fontFamily="monospace">
              {zone.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ========================== Tab Components ==========================

function DashboardTab({ zones, alerts, readings, totalReadings, rejectedCount, simRunning, simScenario, dataSource, hotspots, onToggleSim, onScenario, onForce, onUpdateAlert, lastUpdate, onDataSource }: {
  zones: Zone[]; alerts: Alert[]; readings: Reading[];
  totalReadings: number; rejectedCount: number;
  simRunning: boolean; simScenario: string;
  dataSource: DataSource; hotspots: number;
  onToggleSim: () => void; onScenario: (s: string) => void;
  onForce: (s: string) => void; onUpdateAlert: (id: string, s: AlertStatus) => void;
  lastUpdate: Date | null; onDataSource: (v: DataSource) => void;
}) {
  const active   = alerts.filter(a => a.status !== "atendida");
  const critAlts = active.filter(a => a.risk === "CRITICO");
  const critZones = zones.filter(z => z.risk === "CRITICO").length;
  const prevZones = zones.filter(z => z.risk === "PREVENTIVO").length;
  const normZones = zones.filter(z => z.risk === "NORMAL").length;
  const noDataZ   = zones.filter(z => z.risk === "SIN_DATOS").length;
  const latestV   = readings.find(r => r.valid);

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Lecturas totales"  value={totalReadings} icon={Activity}       color="text-blue-400"   sub="acumuladas en sesión" />
        <StatCard label="Lecturas rechazadas" value={rejectedCount} icon={XCircle}      color="text-red-400"    sub="validación fallida" />
        <StatCard label="Alertas activas"   value={active.length}  icon={AlertTriangle} color="text-amber-400"  sub={`${critAlts.length} crítica${critAlts.length !== 1 ? "s" : ""}`} />
        <StatCard label="Zonas críticas"    value={critZones}       icon={Zap}          color="text-red-400"    sub="requieren intervención" />
      </div>

      {/* Zone status pills */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Sin riesgo",  count: normZones,  risk: "NORMAL"     as RiskLevel },
          { label: "Preventivo",  count: prevZones,  risk: "PREVENTIVO" as RiskLevel },
          { label: "Crítico",     count: critZones,  risk: "CRITICO"    as RiskLevel },
          { label: "Sin datos",   count: noDataZ,    risk: "SIN_DATOS"  as RiskLevel },
        ].map(({ label, count, risk }) => (
          <div key={risk} className={`rounded-lg p-3 border ${RISK_CLASS[risk]} text-center`}>
            <div className="text-[11px] font-jetbrains mb-1">{label}</div>
            <div className="text-2xl font-rajdhani font-bold" style={{ color: RISK_HEX[risk] }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Latest sensor values */}
      {latestV && (
        <div>
          <h2 className="font-rajdhani font-semibold text-foreground text-base mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            Última lectura válida
            <span className="text-[11px] text-muted-foreground font-jetbrains font-normal ml-1">— {latestV.zoneName} · {fmtT(latestV.timestamp)}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SensorCard label="Temperatura" value={latestV.temp}     unit="°C"    icon={Thermometer} thresholds={{ warn: 32, crit: 38 }} />
            <SensorCard label="Humedad"     value={latestV.humidity} unit="%"     icon={Droplets}    thresholds={{ warn: 40, crit: 25 }} invert />
            <SensorCard label="Viento"      value={latestV.wind}     unit="km/h"  icon={Wind}        thresholds={{ warn: 30, crit: 50 }} />
          </div>
        </div>
      )}

      {/* Alerts + Zones split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts panel */}
        <div>
          <h2 className="font-rajdhani font-semibold text-foreground text-base mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Panel de Alertas Institucionales
            {active.length > 0 && (
              <span className={`ml-1 text-[11px] font-jetbrains px-1.5 py-0.5 rounded border ${critAlts.length > 0 ? RISK_CLASS.CRITICO : RISK_CLASS.PREVENTIVO}`}>
                {active.length} activa{active.length !== 1 ? "s" : ""}
              </span>
            )}
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin pr-1">
            {active.length === 0
              ? <EmptyState icon={CheckCircle} message="Sin alertas activas" color="text-green-400" />
              : active.map(a => <AlertCard key={a.id} alert={a} onUpdate={onUpdateAlert} />)
            }
          </div>
        </div>

        {/* Zone overview */}
        <div>
          <h2 className="font-rajdhani font-semibold text-foreground text-base mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            Estado de Zonas
          </h2>
          <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
            {zones.map(z => (
              <ZoneRow key={z.id} zone={z} selected={false} onClick={() => {}} />
            ))}
          </div>
        </div>
      </div>

      {/* Simulator */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-rajdhani font-semibold text-foreground text-base mb-4 flex items-center gap-2">
          <Radio className={`w-4 h-4 ${simRunning ? "text-green-400 animate-pulse" : "text-muted-foreground"}`} />
          Simulador IoT — Generador de Lecturas
        </h2>
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <DataSourcePicker value={dataSource} onChange={onDataSource} />
          {dataSource !== "simulado" && hotspots > 0 && (
            <span className="text-[11px] font-jetbrains text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              {hotspots} foco{hotspots !== 1 ? "s" : ""} de calor activo{hotspots !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={onToggleSim}
            className={`flex items-center gap-2 px-4 py-2 rounded border font-medium text-sm transition-colors ${simRunning
              ? "bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25"
              : "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25"}`}
          >
            {simRunning ? <><Pause className="w-4 h-4" />Detener simulador</> : <><Play className="w-4 h-4" />Iniciar simulador</>}
          </button>
          <select
            value={simScenario}
            onChange={e => onScenario(e.target.value)}
            className="bg-card border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-green-500/50 cursor-pointer"
          >
            <option value="mixed">Mixto (aleatorio)</option>
            <option value="normal">Escenario normal</option>
            <option value="preventivo">Escenario preventivo</option>
            <option value="critico">Escenario crítico</option>
            <option value="error">Errores / Anomalías</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[11px] text-muted-foreground font-jetbrains">Forzar lectura puntual:</span>
          {(["normal", "preventivo", "critico", "error"] as const).map(sc => (
            <button key={sc} onClick={() => onForce(sc)}
              className={`text-xs px-3 py-1.5 rounded border font-jetbrains transition-colors ${
                sc === "normal"     ? "border-green-500/30 text-green-400 hover:bg-green-500/10"  :
                sc === "preventivo" ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10"  :
                sc === "critico"    ? "border-red-500/30   text-red-400   hover:bg-red-500/10"    :
                                     "border-slate-500/30 text-slate-400 hover:bg-slate-500/10"
              }`}
            >{sc}</button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground font-jetbrains">
          {simRunning
            ? (dataSource !== "simulado" ? "— Consultando Open-Meteo cada 10 s" : "— Generando lecturas cada 3 s")
            : "— Detenido"} · Recibidas: <span className="text-foreground">{totalReadings}</span> · Rechazadas: <span className="text-red-400">{rejectedCount}</span> · Tasa de rechazo: <span className="text-foreground">{totalReadings > 0 ? ((rejectedCount / totalReadings) * 100).toFixed(1) : "0.0"}%</span>
        </p>
      </div>

      {/* Recent readings mini table */}
      <div>
        <h2 className="font-rajdhani font-semibold text-foreground text-base mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          Últimas lecturas recibidas
        </h2>
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto scrollbar-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Hora", "Zona", "°C", "%", "km/h", "Estado", "Riesgo"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-jetbrains text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 12).map(r => (
                  <tr key={r.id} className={`border-b border-border/40 hover:bg-muted/15 transition-colors ${!r.valid ? "opacity-55" : ""}`}>
                    <td className="px-4 py-2 font-jetbrains text-[11px] text-muted-foreground whitespace-nowrap">{fmtT(r.timestamp)}</td>
                    <td className="px-4 py-2 text-xs text-foreground">{r.zoneName}</td>
                    <td className="px-4 py-2 font-jetbrains text-xs">{r.temp !== null ? r.temp : <span className="text-red-400/70">null</span>}</td>
                    <td className="px-4 py-2 font-jetbrains text-xs">{r.humidity !== null ? r.humidity : <span className="text-red-400/70">null</span>}</td>
                    <td className="px-4 py-2 font-jetbrains text-xs">{r.wind !== null ? r.wind : <span className="text-red-400/70">null</span>}</td>
                    <td className="px-4 py-2">
                      {r.valid
                        ? <span className="text-[11px] text-green-400 font-jetbrains flex items-center gap-1"><CheckCircle className="w-3 h-3" />OK</span>
                        : <span className="text-[11px] text-red-400 font-jetbrains flex items-center gap-1 cursor-default" title={r.rejectionReason}><XCircle className="w-3 h-3" />Rechazada</span>
                      }
                    </td>
                    <td className="px-4 py-2"><RiskBadge risk={r.risk} small /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {readings.some(r => !r.valid) && (
          <div className="mt-2 flex items-start gap-2 text-[11px] text-muted-foreground font-jetbrains">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-blue-400/60" />
            <span>Las lecturas rechazadas no modifican el estado de la zona. Pasa el cursor sobre "Rechazada" para ver el motivo.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// —"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?

function MapTab({ zones, selectedZoneId, onSelect, activeSubZones }: { zones: Zone[]; selectedZoneId: string | null; onSelect: (id: string | null) => void; activeSubZones: Record<string, string> }) {
  let selected = zones.find(z => z.id === selectedZoneId) || null
  let selectedSubZoneName: string | null = null
  if (!selected && selectedZoneId && selectedZoneId.includes("_")) {
    const subZone = subZones.find(sz => sz.id === selectedZoneId)
    if (subZone) {
      selected = zones.find(z => z.id === subZone.parentZoneId) || null
      selectedSubZoneName = subZone.name
    }
  }
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-rajdhani font-semibold text-foreground text-base mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-400" />
            Mapa de Riesgo — Región de Valparaíso
          </h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <RiskMap zones={zones} selectedZoneId={selectedZoneId} onSelect={onSelect} activeSubZones={activeSubZones} />
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-5 mt-3">
            {(["NORMAL", "PREVENTIVO", "CRITICO", "SIN_DATOS"] as RiskLevel[]).map(r => (
              <div key={r} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_HEX[r] }} />
                <span className="text-[11px] text-muted-foreground font-jetbrains">{RISK_LABELS[r]}</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-400/60 border border-dashed border-blue-400/40" />
              <span className="text-[11px] text-muted-foreground font-jetbrains">Costa / Río</span>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-3">
          {selected
            ? (
              <>
                {selectedSubZoneName && (
                  <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-2">
                    <span style={{ fontSize: 14 }}>📍</span>
                    <div>
                      <div className="text-[10px] text-muted-foreground font-jetbrains uppercase tracking-wider">Sector específico</div>
                      <div className="text-sm font-rajdhani font-semibold text-foreground">{selectedSubZoneName}</div>
                    </div>
                  </div>
                )}
                <ZoneDetail zone={selected} onClose={() => onSelect(null)} />
                <NearestStationPanel zone={selected} />
              </>
            ) : (
              <div className="bg-card border border-border rounded-lg p-5 text-center">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">Selecciona una zona en el mapa para ver sus detalles</p>
              </div>
            )
          }
          <div className="space-y-1.5">
            {zones.map(z => {
              const isSubSelected = selectedZoneId?.includes("_") && subZones.some(sz => sz.id === selectedZoneId && sz.parentZoneId === z.id)
              return (
                <ZoneRow key={z.id} zone={z} selected={selectedZoneId === z.id || isSubSelected} onClick={() => onSelect(z.id)} />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// —"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?

function HistoryTab({ readings, events }: { readings: Reading[]; events: HistoricalEvent[] }) {
  const [subtab, setSubtab] = useState<"lecturas" | "eventos">("lecturas");
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[
          { id: "lecturas" as const, label: `Lecturas (${readings.length})`, icon: Activity },
          { id: "eventos"  as const, label: `Eventos históricos (${events.length})`, icon: Database },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubtab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-colors ${subtab === id ? "bg-green-500/15 text-green-400 border-green-500/30" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {subtab === "lecturas" && (
        <div>
          <p className="text-[11px] text-muted-foreground font-jetbrains mb-3">
            Registro completo de todas las lecturas recibidas por el backend —" válidas, rechazadas y las que dispararon alertas. Los datos persisten en la base de datos del sistema.
          </p>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto scrollbar-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Timestamp", "Zona", "Temp", "Humedad", "Viento", "Válida", "Motivo rechazo", "Alerta", "Riesgo"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[11px] font-jetbrains text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {readings.map(r => (
                    <tr key={r.id} className={`border-b border-border/40 hover:bg-muted/15 transition-colors ${!r.valid ? "opacity-60" : ""}`}>
                      <td className="px-3 py-2 font-jetbrains text-[11px] text-muted-foreground whitespace-nowrap">{fmt(r.timestamp)}</td>
                      <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{r.zoneName}</td>
                      <td className="px-3 py-2 font-jetbrains text-xs">{r.temp !== null ? `${r.temp}°C` : <span className="text-red-400/70">null</span>}</td>
                      <td className="px-3 py-2 font-jetbrains text-xs">{r.humidity !== null ? `${r.humidity}%` : <span className="text-red-400/70">null</span>}</td>
                      <td className="px-3 py-2 font-jetbrains text-xs">{r.wind !== null ? `${r.wind} km/h` : <span className="text-red-400/70">null</span>}</td>
                      <td className="px-3 py-2">
                        {r.valid
                          ? <span className="text-[11px] text-green-400 font-jetbrains">—o" OK</span>
                          : <span className="text-[11px] text-red-400 font-jetbrains">—o- NO</span>
                        }
                      </td>
                      <td className="px-3 py-2 text-[11px] text-red-400/70 font-jetbrains max-w-[200px] truncate" title={r.rejectionReason}>
                        {r.rejectionReason || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.generatedAlert
                          ? <span className="text-[11px] text-amber-400 font-jetbrains">—s— Sí</span>
                          : <span className="text-[11px] text-muted-foreground font-jetbrains">—"</span>
                        }
                      </td>
                      <td className="px-3 py-2"><RiskBadge risk={r.risk} small /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subtab === "eventos" && (
        <div>
          <div className="mb-3 p-3 bg-blue-500/8 border border-blue-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground font-jetbrains leading-relaxed">
                <span className="text-blue-400 font-medium">Registro histórico de eventos preventivos y críticos.</span> Esta tabla es la base de datos preparada para futuros análisis de patrones, modelos predictivos e identificación de comportamientos repetidos por zona, temporada o condición climática.
              </p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto scrollbar-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    {["Fecha / Hora", "Zona", "Tipo de evento", "Temperatura", "Humedad", "Viento", "Nivel"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-[11px] font-jetbrains text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id} className="border-b border-border/40 hover:bg-muted/15 transition-colors">
                      <td className="px-3 py-2 font-jetbrains text-[11px] text-muted-foreground whitespace-nowrap">{fmt(e.timestamp)}</td>
                      <td className="px-3 py-2 text-xs text-foreground whitespace-nowrap">{e.zoneName}</td>
                      <td className="px-3 py-2 text-xs text-foreground">{e.alertType}</td>
                      <td className="px-3 py-2 font-jetbrains text-xs">{e.temp}°C</td>
                      <td className="px-3 py-2 font-jetbrains text-xs">{e.humidity}%</td>
                      <td className="px-3 py-2 font-jetbrains text-xs">{e.wind} km/h</td>
                      <td className="px-3 py-2"><RiskBadge risk={e.risk} small /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// —"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?—"?

function BugsTab({ bugs, bugTitle, bugDesc, bugMsg, onTitle, onDesc, onSubmit, onUpdateStatus }: {
  bugs: BugReport[]; bugTitle: string; bugDesc: string; bugMsg: string;
  onTitle: (v: string) => void; onDesc: (v: string) => void;
  onSubmit: () => void; onUpdateStatus: (id: string, s: BugStatus) => void;
}) {
  const pending  = bugs.filter(b => b.status === "pendiente").length;
  const reviewed = bugs.filter(b => b.status === "revisado").length;
  const resolved = bugs.filter(b => b.status === "resuelto").length;
  const statusClass: Record<BugStatus, string> = {
    pendiente: "bg-red-500/15 text-red-400 border-red-500/25",
    revisado:  "bg-amber-500/15 text-amber-400 border-amber-500/25",
    resuelto:  "bg-green-500/15 text-green-400 border-green-500/25",
  };
  const statusLabel: Record<BugStatus, string> = { pendiente: "Pendiente", revisado: "Revisado", resuelto: "Resuelto" };
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div>
          <h2 className="font-rajdhani font-semibold text-foreground text-base mb-1 flex items-center gap-2">
            <Bug className="w-4 h-4 text-amber-400" />
            Reportar Error del Sistema
          </h2>
          <p className="text-[11px] text-muted-foreground font-jetbrains mb-4">
            Este módulo centraliza el control técnico del sistema. Los reportes se persisten en la base de datos del backend y son visibles para todos los actores institucionales (CONAF, SENAPRED, Municipalidad).
          </p>
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-jetbrains text-muted-foreground uppercase tracking-wider mb-1.5">
                Título del error <span className="text-red-400">*</span>
              </label>
              <input
                value={bugTitle}
                onChange={e => onTitle(e.target.value)}
                placeholder="Ej: Sensor sin transmisión, Alerta duplicada——"
                className="w-full bg-muted/30 border border-border rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-jetbrains text-muted-foreground uppercase tracking-wider mb-1.5">Descripción</label>
              <textarea
                value={bugDesc}
                onChange={e => onDesc(e.target.value)}
                placeholder="Describe el comportamiento observado, zona afectada, condiciones en que ocurrió——"
                rows={4}
                className="w-full bg-muted/30 border border-border rounded px-3 py-2 text-sm text-foreground placeholder-muted-foreground/40 focus:outline-none focus:border-green-500/50 transition-colors resize-none"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-jetbrains text-muted-foreground">
                Estado inicial: <span className="text-red-400">pendiente</span>
              </span>
              <button
                onClick={onSubmit}
                className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded text-sm font-medium transition-colors"
              >
                <Send className="w-4 h-4" />Enviar reporte
              </button>
            </div>
            {bugMsg && (
              <div className={`text-[11px] font-jetbrains px-3 py-2 rounded border ${bugMsg.includes("obligatorio") || bugMsg.includes("inválido") ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>
                {bugMsg}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div>
          <h2 className="font-rajdhani font-semibold text-foreground text-base mb-3">Estado del Control Técnico</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Pendientes", count: pending,  col: "text-red-400",   bg: "bg-red-500/10 border-red-500/20"   },
              { label: "Revisados",  count: reviewed, col: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
              { label: "Resueltos",  count: resolved, col: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
            ].map(({ label, count, col, bg }) => (
              <div key={label} className={`border rounded-lg p-3 text-center ${bg}`}>
                <div className={`text-2xl font-rajdhani font-bold ${col}`}>{count}</div>
                <div className="text-[11px] text-muted-foreground font-jetbrains">{label}</div>
              </div>
            ))}
          </div>
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-medium text-blue-400 mb-1">Mitigación de riesgo técnico</div>
                <p className="text-[11px] text-muted-foreground font-jetbrains leading-relaxed">
                  Este módulo es parte de la estrategia de control técnico de AIPI. Permite identificar, registrar y hacer seguimiento de fallos del sistema, reduciendo el riesgo de errores no detectados en operación real.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bug list */}
      <div>
        <h2 className="font-rajdhani font-semibold text-foreground text-base mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          Historial de reportes ({bugs.length})
        </h2>
        {bugs.length === 0
          ? <EmptyState icon={CheckCircle} message="No hay reportes de errores registrados" color="text-green-400" />
          : (
            <div className="space-y-3">
              {bugs.map(bug => (
                <div key={bug.id} className={`bg-card border rounded-lg p-4 ${bug.status === "pendiente" ? "border-red-500/20" : bug.status === "revisado" ? "border-amber-500/20" : "border-green-500/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <span className={`text-[11px] px-2 py-0.5 rounded border font-jetbrains ${statusClass[bug.status]}`}>
                          {statusLabel[bug.status]}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-jetbrains">{fmt(bug.timestamp)}</span>
                      </div>
                      <h3 className="text-sm font-medium text-foreground leading-snug">{bug.title}</h3>
                      {bug.description && (
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{bug.description}</p>
                      )}
                    </div>
                    <select
                      value={bug.status}
                      onChange={e => onUpdateStatus(bug.id, e.target.value as BugStatus)}
                      className="text-[11px] bg-card border border-border rounded px-2 py-1.5 text-foreground focus:outline-none flex-shrink-0 cursor-pointer"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="revisado">Revisado</option>
                      <option value="resuelto">Resuelto</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

// ========================== Root Component ==========================

export default function App() {
  type Tab = "dashboard" | "mapa" | "historial" | "reportes";
  const [tab, setTab]               = useState<Tab>("dashboard");
  const [zones, setZones]           = useState<Zone[]>(seedZones());
  const [readings, setReadings]     = useState<Reading[]>(SEED_READINGS);
  const [alerts, setAlerts]         = useState<Alert[]>(SEED_ALERTS);
  const [events, setEvents]         = useState<HistoricalEvent[]>(SEED_EVENTS);
  const [bugs, setBugs]             = useState<BugReport[]>(SEED_BUGS);
  const [simRunning, setSimRunning] = useState(false);
  const [simScenario, setSimScenario] = useState("mixed");
  const [dataSource, setDataSource] = useState<DataSource>("simulado");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [totalReadings, setTotalReadings] = useState(SEED_READINGS.length);
  const [rejectedCount, setRejectedCount] = useState(2);
  const [bugTitle, setBugTitle]     = useState("");
  const [bugDesc, setBugDesc]       = useState("");
  const [bugMsg, setBugMsg]         = useState("");
  const [activeSubZones, setActiveSubZones] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    const risky = seedZones().filter(z => z.risk === "CRITICO" || z.risk === "PREVENTIVO")
    for (const z of risky) {
      const subs = getSubZonesByParent(z.id)
      if (subs.length > 0) init[z.id] = subs[Math.floor(Math.random() * subs.length)].id
    }
    return init
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realDataIndexRef = useRef(0)

  // Persist seed data to Supabase on mount
  useEffect(() => {
    const zs = seedZones()
    for (const z of zs) saveZone({ id: z.id, name: z.name, risk: z.risk, temp: z.temp, humidity: z.humidity, wind: z.wind, last_update: z.lastUpdate?.toISOString() || null })
    for (const a of SEED_ALERTS) saveAlert(toDbAlert(a))
    for (const e of SEED_EVENTS) saveEvent(toDbEvent(e))
  }, [])

  // Persist to Supabase (fire-and-forget)
  const toDbReading = (r: Reading) => ({
    id: r.id, zone_id: r.zoneId, zone_name: r.zoneName,
    timestamp: r.timestamp.toISOString(), temp: r.temp, humidity: r.humidity, wind: r.wind,
    valid: r.valid, rejection_reason: r.rejectionReason || null,
    generated_alert: r.generatedAlert, risk: r.risk,
  })
  const toDbAlert = (a: Alert) => ({
    id: a.id, timestamp: a.timestamp.toISOString(), zone_id: a.zoneId, zone_name: a.zoneName,
    risk: a.risk, temp: a.temp, humidity: a.humidity, wind: a.wind, status: a.status,
  })
  const toDbEvent = (e: HistoricalEvent) => ({
    id: e.id, timestamp: e.timestamp.toISOString(), zone_id: e.zoneId, zone_name: e.zoneName,
    temp: e.temp, humidity: e.humidity, wind: e.wind, risk: e.risk, alert_type: e.alertType,
  })
  const toDbZone = (z: Zone) => ({
    id: z.id, name: z.name, risk: z.risk,
    temp: z.temp, humidity: z.humidity, wind: z.wind,
    last_update: z.lastUpdate?.toISOString() || null,
  })

  const pickSubZone = useCallback((parentId: string): string | null => {
    const subs = getSubZonesByParent(parentId)
    if (subs.length === 0) return null
    return subs[Math.floor(Math.random() * subs.length)].id
  }, [])

  const processOne = useCallback(async (scenarioOverride?: string) => {
    if (dataSource !== "simulado") {
      const coords = ZONE_COORDS[realDataIndexRef.current % ZONE_COORDS.length]
      realDataIndexRef.current++
      const zd = ZONE_DEFS.find(z => z.id === coords.id)
      if (!zd) return

      const weather = await fetchWeather(coords.lat, coords.lng)
      const { temp: t, humidity: h, wind: w } = weather
      const now = new Date()

      if (t === null || h === null || w === null) {
        const reading: Reading = {
          id: uid(), zoneId: zd.id, zoneName: zd.name,
          timestamp: now, temp: null, humidity: null, wind: null,
          valid: false, rejectionReason: "Sin datos del sensor climático",
          generatedAlert: false, risk: "SIN_DATOS",
        }
        setReadings(prev => [reading, ...prev].slice(0, 100))
        setTotalReadings(c => c + 1)
        setRejectedCount(c => c + 1)
        setLastUpdate(now)
        saveReading(toDbReading(reading))
        return
      }

      const v = validate(t, h, w)
      const risk = v.ok ? classify(t, h, w) : "SIN_DATOS" as RiskLevel

      const reading: Reading = {
        id: uid(), zoneId: zd.id, zoneName: zd.name,
        timestamp: now, temp: t, humidity: h, wind: w,
        valid: v.ok, rejectionReason: v.reason,
        generatedAlert: v.ok && risk !== "NORMAL", risk,
      }

      if (v.ok) {
        if (risk !== "NORMAL") {
          const newAlert: Alert = { id: uid(), timestamp: now, zoneId: zd.id, zoneName: zd.name, risk, temp: t, humidity: h, wind: w, status: "nueva" }
          setAlerts(prev => [newAlert, ...prev].slice(0, 50))
          const newEvent: HistoricalEvent = { id: uid(), timestamp: now, zoneId: zd.id, zoneName: zd.name, temp: t, humidity: h, wind: w, risk, alertType: risk === "CRITICO" ? "Alerta crítica activada" : "Alerta preventiva activada" }
          setEvents(prev => [newEvent, ...prev].slice(0, 200))
          saveAlert(toDbAlert(newAlert))
          saveEvent(toDbEvent(newEvent))
          const picked = pickSubZone(zd.id)
          if (picked) setActiveSubZones(prev => ({ ...prev, [zd.id]: picked }))
        } else {
          setActiveSubZones(prev => { const n = { ...prev }; delete n[zd.id]; return n })
        }
        setZones(prev => prev.map(z => z.id === zd.id ? { ...z, risk, temp: t, humidity: h, wind: w, lastUpdate: now } : z))
      } else {
        setRejectedCount(c => c + 1)
      }

      saveZone({ id: zd.id, name: zd.name, risk, temp: t ?? null, humidity: h ?? null, wind: w ?? null, last_update: now.toISOString() })

      setReadings(prev => [reading, ...prev].slice(0, 100))
      setTotalReadings(c => c + 1)
      setLastUpdate(now)
      saveReading(toDbReading(reading))
      return
    }

    const zd = ZONE_DEFS[Math.floor(Math.random() * ZONE_DEFS.length)]
    const sc = scenarioOverride || simScenario
    const { t, h, w } = simValues(sc)
    const v = validate(t, h, w)
    const now = new Date()

    const reading: Reading = {
      id: uid(), zoneId: zd.id, zoneName: zd.name,
      timestamp: now, temp: t, humidity: h, wind: w,
      valid: v.ok, rejectionReason: v.reason,
      generatedAlert: false, risk: "SIN_DATOS",
    }

    if (v.ok && t !== null && h !== null && w !== null) {
      const risk = classify(t, h, w)
      reading.risk = risk
      if (risk !== "NORMAL") {
        reading.generatedAlert = true
        const newAlert: Alert = { id: uid(), timestamp: now, zoneId: zd.id, zoneName: zd.name, risk, temp: t, humidity: h, wind: w, status: "nueva" }
        setAlerts(prev => [newAlert, ...prev].slice(0, 50))
        const newEvent: HistoricalEvent = { id: uid(), timestamp: now, zoneId: zd.id, zoneName: zd.name, temp: t, humidity: h, wind: w, risk, alertType: risk === "CRITICO" ? "Alerta crítica activada" : "Alerta preventiva activada" }
        setEvents(prev => [newEvent, ...prev].slice(0, 200))
        saveAlert(toDbAlert(newAlert))
        saveEvent(toDbEvent(newEvent))
        const picked = pickSubZone(zd.id)
        if (picked) setActiveSubZones(prev => ({ ...prev, [zd.id]: picked }))
      } else {
        setActiveSubZones(prev => { const n = { ...prev }; delete n[zd.id]; return n })
      }
      setZones(prev => prev.map(z => z.id === zd.id ? { ...z, risk, temp: t, humidity: h, wind: w, lastUpdate: now } : z))
      saveZone({ id: zd.id, name: zd.name, risk, temp: t, humidity: h, wind: w, last_update: now.toISOString() })
    } else {
      setRejectedCount(c => c + 1)
    }

    setReadings(prev => [reading, ...prev].slice(0, 100))
    setTotalReadings(c => c + 1)
    setLastUpdate(now)
    saveReading(toDbReading(reading))
  }, [simScenario, dataSource, pickSubZone])

  useEffect(() => {
    if (simRunning && dataSource !== "simulado") {
      intervalRef.current = setInterval(() => processOne(), 10000)
    } else if (simRunning) {
      intervalRef.current = setInterval(() => processOne(), 3000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [simRunning, processOne, dataSource])

  const [hotspots, setHotspots] = useState<number>(0)

  useEffect(() => {
    if (dataSource !== "firms" || !isFirmsConfigured()) {
      setHotspots(0)
      return
    }
    let active = true
    const run = () => {
      fetchHotspots().then(h => { if (active) setHotspots(h.length) })
    }
    run()
    const id = setInterval(run, 10 * 60 * 1000)
    return () => { active = false; clearInterval(id) }
  }, [dataSource])

  const updateAlertStatus = (id: string, status: AlertStatus) =>
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a));

  const updateBugStatus = (id: string, status: BugStatus) =>
    setBugs(prev => prev.map(b => b.id === id ? { ...b, status } : b));

  const submitBug = () => {
    if (!bugTitle.trim()) { setBugMsg("El título es obligatorio."); return; }
    setBugs(prev => [{
      id: uid(), timestamp: new Date(),
      title: bugTitle.trim(), description: bugDesc.trim(), status: "pendiente",
    }, ...prev]);
    setBugTitle(""); setBugDesc("");
    setBugMsg("Reporte registrado correctamente.");
    setTimeout(() => setBugMsg(""), 3000);
  };

  const activeAlerts = alerts.filter(a => a.status !== "atendida");
  const critAlerts   = activeAlerts.filter(a => a.risk === "CRITICO");
  const sysStatus    = critAlerts.length > 0 ? "CRÍTICO" : activeAlerts.length > 0 ? "PREVENTIVO" : "OPERACIONAL";
  const sysBg        = sysStatus === "CRÍTICO" ? "bg-red-500/10 border-red-500/30 text-red-400" : sysStatus === "PREVENTIVO" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-green-500/10 border-green-500/30 text-green-400";

  const TABS = [
    { id: "dashboard" as Tab, label: "Panel General",      icon: BarChart2  },
    { id: "mapa"      as Tab, label: "Mapa de Riesgo",     icon: MapPin     },
    { id: "historial" as Tab, label: "Historial",          icon: Database   },
    { id: "reportes"  as Tab, label: "Reporte de Errores", icon: Bug        },
  ];

  return (
    <div className="min-h-screen bg-background font-inter">
      {/* ===== Header ===== */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-green-700/80 flex items-center justify-center flex-shrink-0">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="leading-tight">
              <span className="font-rajdhani font-bold text-lg text-foreground tracking-wider">AIPI</span>
              <span className="text-muted-foreground text-xs ml-2 hidden sm:inline font-jetbrains">Apoyo Preventivo · Incendios Forestales</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-jetbrains font-medium ${sysBg}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${sysStatus === "CRÍTICO" ? "bg-red-400 animate-pulse" : sysStatus === "PREVENTIVO" ? "bg-amber-400 animate-pulse" : "bg-green-400"}`} />
              {sysStatus}
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-muted-foreground font-jetbrains">
              <Clock className="w-3 h-3" />
              {lastUpdate ? fmtT(lastUpdate) : "--:--:--"}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-jetbrains">
              <Radio className={`w-3.5 h-3.5 ${simRunning ? "text-green-400 animate-pulse" : ""}`} />
              <span className="hidden sm:inline">{simRunning ? "EN LÍNEA" : "OFFLINE"}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ===== Institutional bar ===== */}
      <div className="bg-card/60 border-b border-border/50">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-1 flex items-center gap-3 text-[11px] text-muted-foreground font-jetbrains">
          <span className="text-green-400/70">CONAF</span>
          <span className="opacity-30">·</span>
          <span className="text-blue-400/70">SENAPRED</span>
          <span className="opacity-30">·</span>
          <span className="text-amber-400/70">MUNICIPALIDAD</span>
          <span className="ml-auto hidden sm:block">Región de Valparaíso — Chile</span>
        </div>
      </div>

      {/* ===== Nav tabs ===== */}
      <nav className="bg-card/90 border-b border-border sticky top-14 z-40 backdrop-blur">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex items-center">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-sm border-b-2 transition-colors ${tab === id ? "border-green-500 text-green-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          {activeAlerts.length > 0 && (
            <div className="ml-auto">
              <span className={`text-[11px] font-jetbrains px-2 py-1 rounded border ${critAlerts.length > 0 ? "bg-red-500/15 text-red-400 border-red-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/25"}`}>
                {activeAlerts.length} alerta{activeAlerts.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </nav>

      {/* ===== Main content ===== */}
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
        {tab === "dashboard" && (
          <DashboardTab
            zones={zones} alerts={alerts} readings={readings}
            totalReadings={totalReadings} rejectedCount={rejectedCount}
            simRunning={simRunning} simScenario={simScenario}
            dataSource={dataSource} hotspots={hotspots}
            onToggleSim={() => setSimRunning(r => !r)}
            onScenario={setSimScenario}
            onForce={(sc) => processOne(sc)}
            onUpdateAlert={updateAlertStatus}
            lastUpdate={lastUpdate}
            onDataSource={setDataSource}
          />
        )}
        {tab === "mapa" && (
          <MapTab zones={zones} selectedZoneId={selectedZoneId} onSelect={setSelectedZoneId} activeSubZones={activeSubZones} />
        )}
        {tab === "historial" && (
          <HistoryTab readings={readings} events={events} />
        )}
        {tab === "reportes" && (
          <BugsTab
            bugs={bugs} bugTitle={bugTitle} bugDesc={bugDesc} bugMsg={bugMsg}
            onTitle={setBugTitle} onDesc={setBugDesc}
            onSubmit={submitBug} onUpdateStatus={updateBugStatus}
          />
        )}
      </main>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border mt-16 py-4">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground font-jetbrains">
          <span>AIPI v0.1.0-demo · Sistema de Apoyo Preventivo para Incendios Forestales</span>
          <span className="text-muted-foreground/50">Datos simulados — No utilizar en operaciones reales</span>
        </div>
      </footer>
    </div>
  );
}
"lucide-react";
