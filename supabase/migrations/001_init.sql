-- Tabla de zonas (comunas)
CREATE TABLE IF NOT EXISTS zones (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  risk        TEXT NOT NULL DEFAULT 'SIN_DATOS',
  temp        DECIMAL(6,2),
  humidity    DECIMAL(5,2),
  wind        DECIMAL(6,2),
  last_update TIMESTAMPTZ
);

-- Tabla de lecturas de sensores
CREATE TABLE IF NOT EXISTS readings (
  id               TEXT PRIMARY KEY,
  zone_id          TEXT NOT NULL REFERENCES zones(id),
  zone_name        TEXT NOT NULL,
  timestamp        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temp             DECIMAL(6,2),
  humidity         DECIMAL(5,2),
  wind             DECIMAL(6,2),
  valid            BOOLEAN NOT NULL DEFAULT FALSE,
  rejection_reason TEXT,
  generated_alert  BOOLEAN NOT NULL DEFAULT FALSE,
  risk             TEXT NOT NULL DEFAULT 'SIN_DATOS'
);

CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_readings_zone_id   ON readings(zone_id);

-- Tabla de alertas
CREATE TABLE IF NOT EXISTS alerts (
  id        TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zone_id   TEXT NOT NULL REFERENCES zones(id),
  zone_name TEXT NOT NULL,
  risk      TEXT NOT NULL,
  temp      DECIMAL(6,2),
  humidity  DECIMAL(5,2),
  wind      DECIMAL(6,2),
  status    TEXT NOT NULL DEFAULT 'nueva'
);

CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status    ON alerts(status);

-- Tabla de eventos históricos
CREATE TABLE IF NOT EXISTS events (
  id        TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zone_id   TEXT NOT NULL REFERENCES zones(id),
  zone_name TEXT NOT NULL,
  temp      DECIMAL(6,2),
  humidity  DECIMAL(5,2),
  wind      DECIMAL(6,2),
  risk      TEXT NOT NULL,
  alert_type TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

-- Tabla de focos de calor (NASA FIRMS)
CREATE TABLE IF NOT EXISTS hotspots (
  id          TEXT PRIMARY KEY,
  lat         DECIMAL(8,5) NOT NULL,
  lng         DECIMAL(8,5) NOT NULL,
  brightness  DECIMAL(8,2),
  acq_date    TEXT,
  satellite   TEXT,
  confidence  TEXT
);

CREATE INDEX IF NOT EXISTS idx_hotspots_acq_date ON hotspots(acq_date DESC);

-- Row Level Security (opcional, deshabilitado por defecto)
ALTER TABLE zones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE readings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotspots  ENABLE ROW LEVEL SECURITY;

-- Política: permitir todo a usuarios anónimos (para prototipo)
CREATE POLICY "Allow all on zones"     ON zones     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on readings"  ON readings  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on alerts"    ON alerts    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on events"    ON events    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hotspots"  ON hotspots  FOR ALL USING (true) WITH CHECK (true);
