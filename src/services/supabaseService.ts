import { supabase, isSupabaseConfigured } from "./supabaseClient"

export interface DBReading {
  id: string
  zone_id: string
  zone_name: string
  timestamp: string
  temp: number | null
  humidity: number | null
  wind: number | null
  valid: boolean
  rejection_reason: string | null
  generated_alert: boolean
  risk: string
}

export interface DBAlert {
  id: string
  timestamp: string
  zone_id: string
  zone_name: string
  risk: string
  temp: number | null
  humidity: number | null
  wind: number | null
  status: string
}

export interface DBEvent {
  id: string
  timestamp: string
  zone_id: string
  zone_name: string
  temp: number | null
  humidity: number | null
  wind: number | null
  risk: string
  alert_type: string
}

export interface DBZone {
  id: string
  name: string
  risk: string
  temp: number | null
  humidity: number | null
  wind: number | null
  last_update: string | null
}

export interface DBHotspot {
  id: string
  lat: number
  lng: number
  brightness: number | null
  acq_date: string | null
  satellite: string | null
  confidence: string | null
}

// ---- Readings ----

export async function saveReading(r: DBReading): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("readings").upsert(r, { onConflict: "id" })
  } catch (e) { console.error("[Supabase] saveReading error:", e) }
}

export async function getReadings(limit = 100): Promise<DBReading[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await supabase
      .from("readings")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit)
    return (data as DBReading[]) || []
  } catch { return [] }
}

// ---- Alerts ----

export async function saveAlert(a: DBAlert): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("alerts").upsert(a, { onConflict: "id" })
  } catch (e) { console.error("[Supabase] saveAlert error:", e) }
}

export async function getAlerts(limit = 50): Promise<DBAlert[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit)
    return (data as DBAlert[]) || []
  } catch (e) { console.error("[Supabase] getAlerts error:", e); return [] }
}

export async function updateAlertStatus(id: string, status: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("alerts").update({ status }).eq("id", id)
  } catch (e) { console.error("[Supabase] updateAlertStatus error:", e) }
}

// ---- Events ----

export async function saveEvent(e: DBEvent): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("events").upsert(e, { onConflict: "id" })
  } catch (err) { console.error("[Supabase] saveEvent error:", err) }
}

export async function getEvents(limit = 200): Promise<DBEvent[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit)
    return (data as DBEvent[]) || []
  } catch (e) { console.error("[Supabase] getEvents error:", e); return [] }
}

// ---- Zones ----

export async function saveZone(z: DBZone): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("zones").upsert(z, { onConflict: "id" })
  } catch (e) { console.error("[Supabase] saveZone error:", e) }
}

export async function saveZones(zones: DBZone[]): Promise<void> {
  if (!isSupabaseConfigured()) return
  for (const z of zones) {
    await saveZone(z)
  }
}

export async function getZones(): Promise<DBZone[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await supabase.from("zones").select("*")
    return (data as DBZone[]) || []
  } catch (e) { console.error("[Supabase] getZones error:", e); return [] }
}

// ---- Hotspots ----

export async function saveHotspots(hotspots: DBHotspot[]): Promise<void> {
  if (!isSupabaseConfigured()) return
  if (hotspots.length === 0) return
  try {
    await supabase.from("hotspots").upsert(hotspots, { onConflict: "id" })
  } catch (e) { console.error("[Supabase] saveHotspots error:", e) }
}

export async function getHotspots(): Promise<DBHotspot[]> {
  if (!isSupabaseConfigured()) return []
  try {
    const { data } = await supabase
      .from("hotspots")
      .select("*")
      .order("acq_date", { ascending: false })
      .limit(100)
    return (data as DBHotspot[]) || []
  } catch (e) { console.error("[Supabase] getHotspots error:", e); return [] }
}
