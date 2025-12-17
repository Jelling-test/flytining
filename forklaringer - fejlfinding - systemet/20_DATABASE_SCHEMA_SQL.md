# 💾 KOMPLET DATABASE SCHEMA - SQL

**Opdateret:** 16. december 2025  
**Database:** PostgreSQL 17 (Supabase)  
**Projekt:** jkmqliztlhmfyejhmuil

---

## 📋 OPSÆTNING

Kør disse SQL statements i Supabase SQL Editor for at oprette hele databasen.

---

## 1. EXTENSIONS

```sql
-- Nødvendige extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
```

---

## 2. KUNDE TABELLER

### regular_customers (Kørende gæster)
```sql
CREATE TABLE public.regular_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  meter_id TEXT,
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  pitch_number TEXT,
  checked_in BOOLEAN DEFAULT false,
  checked_out BOOLEAN DEFAULT false,
  magic_token TEXT,
  license_plates TEXT[],
  language TEXT DEFAULT 'da',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_regular_customers_booking_id ON regular_customers(booking_id);
CREATE INDEX idx_regular_customers_meter_id ON regular_customers(meter_id);
CREATE INDEX idx_regular_customers_magic_token ON regular_customers(magic_token);
CREATE INDEX idx_regular_customers_arrival ON regular_customers(arrival_date);
CREATE INDEX idx_regular_customers_departure ON regular_customers(departure_date);
```

### seasonal_customers (Sæsongæster)
```sql
CREATE TABLE public.seasonal_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id INTEGER UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  meter_id TEXT,
  season_start DATE NOT NULL,
  season_end DATE NOT NULL,
  pitch_number TEXT,
  checked_in BOOLEAN DEFAULT true,
  checked_out BOOLEAN DEFAULT false,
  magic_token TEXT,
  license_plates TEXT[],
  language TEXT DEFAULT 'da',
  kwh_included INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_seasonal_customers_booking_id ON seasonal_customers(booking_id);
CREATE INDEX idx_seasonal_customers_meter_id ON seasonal_customers(meter_id);
```

---

## 3. STRØM TABELLER

### power_meters (Målere)
```sql
CREATE TABLE public.power_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_number TEXT UNIQUE NOT NULL,
  mqtt_topic TEXT,
  base_topic TEXT DEFAULT 'zigbee2mqtt',
  ieee_address TEXT,
  friendly_name TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'maintenance', 'offline')),
  area TEXT,
  is_seasonal BOOLEAN DEFAULT false,
  is_cabin BOOLEAN DEFAULT false,
  cabin_number TEXT,
  current_energy DECIMAL,
  current_power DECIMAL,
  voltage DECIMAL,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_power_meters_meter_number ON power_meters(meter_number);
CREATE INDEX idx_power_meters_status ON power_meters(status);
CREATE INDEX idx_power_meters_base_topic ON power_meters(base_topic);
CREATE INDEX idx_power_meters_ieee_address ON power_meters(ieee_address);
```

### meter_readings (Real-time målinger)
```sql
CREATE TABLE public.meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id TEXT NOT NULL,
  energy DECIMAL,
  power DECIMAL,
  voltage DECIMAL,
  current DECIMAL,
  state TEXT,
  linkquality INTEGER,
  time TIMESTAMPTZ DEFAULT NOW()
);

-- Partitionering kan tilføjes for performance
CREATE INDEX idx_meter_readings_meter_id ON meter_readings(meter_id);
CREATE INDEX idx_meter_readings_time ON meter_readings(time DESC);
CREATE INDEX idx_meter_readings_meter_time ON meter_readings(meter_id, time DESC);
```

### meter_readings_history (Daglige snapshots)
```sql
CREATE TABLE public.meter_readings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id TEXT NOT NULL,
  energy DECIMAL,
  power DECIMAL,
  snapshot_date DATE NOT NULL,
  snapshot_hour INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_meter_history_unique ON meter_readings_history(meter_id, snapshot_date, snapshot_hour);
CREATE INDEX idx_meter_history_date ON meter_readings_history(snapshot_date);
```

### meter_commands (Kommando kø)
```sql
CREATE TABLE public.meter_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id TEXT NOT NULL,
  command TEXT NOT NULL CHECK (command IN ('ON', 'OFF')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed')),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX idx_meter_commands_status ON meter_commands(status);
CREATE INDEX idx_meter_commands_created ON meter_commands(created_at DESC);
```

### meter_identity (IEEE → Navn backup)
```sql
CREATE TABLE public.meter_identity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ieee_address TEXT NOT NULL,
  meter_number TEXT NOT NULL,
  base_topic TEXT NOT NULL,
  friendly_name TEXT,
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meter_identity_ieee ON meter_identity(ieee_address);
CREATE INDEX idx_meter_identity_date ON meter_identity(snapshot_date);
```

---

## 4. PAKKER OG BETALINGER

### plugin_data (Polymorfisk tabel)
```sql
CREATE TABLE public.plugin_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  module TEXT NOT NULL,
  ref_id TEXT,
  key TEXT,
  scope TEXT DEFAULT 'tenant' CHECK (scope IN ('tenant', 'organization', 'platform')),
  data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plugin_data_module ON plugin_data(module);
CREATE INDEX idx_plugin_data_ref_id ON plugin_data(ref_id);
CREATE INDEX idx_plugin_data_module_key ON plugin_data(module, key);
CREATE INDEX idx_plugin_data_data_gin ON plugin_data USING GIN (data);
```

**Pakke eksempel (module='pakker'):**
```json
{
  "booking_nummer": 12345,
  "enheder": 50,
  "enheder_tilbage": 35.5,
  "pris": 150,
  "status": "aktiv",
  "type": "running",
  "kunde_type": "regular",
  "stripe_session_id": "cs_xxx",
  "oprettet": "2025-12-16T10:00:00Z",
  "advarsel_sendt": false
}
```

### daily_package_stats (Statistik)
```sql
CREATE TABLE public.daily_package_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_packages INTEGER DEFAULT 0,
  active_packages INTEGER DEFAULT 0,
  total_units_sold DECIMAL DEFAULT 0,
  total_revenue DECIMAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_daily_stats_date ON daily_package_stats(date);
```

---

## 5. ANPR/BOM TABELLER

### approved_plates (Godkendte nummerplader)
```sql
CREATE TABLE public.approved_plates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_text TEXT NOT NULL,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'sirvoy_webhook')),
  booking_id INTEGER,
  customer_type TEXT,
  customer_id UUID,
  checked_in BOOLEAN DEFAULT false,
  checked_out BOOLEAN DEFAULT false,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approved_plates_text ON approved_plates(plate_text);
CREATE INDEX idx_approved_plates_booking ON approved_plates(booking_id);
```

### plate_detections (Alle detektioner)
```sql
CREATE TABLE public.plate_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_text TEXT NOT NULL,
  plate_unicode TEXT,
  plate_country TEXT,
  plate_region TEXT,
  plate_region_code TEXT,
  plate_confidence DECIMAL,
  car_state TEXT,
  car_direction TEXT,
  car_id TEXT,
  vehicle_type TEXT,
  vehicle_color TEXT,
  vehicle_view TEXT,
  plate_list TEXT,
  plate_list_mode TEXT,
  plate_list_description TEXT,
  capture_timestamp BIGINT,
  frame_timestamp BIGINT,
  datetime TEXT,
  camera_serial TEXT,
  camera_model TEXT,
  camera_ip TEXT,
  camera_mac TEXT,
  plate_coordinates TEXT,
  geotag TEXT,
  image_plate TEXT,
  image_vehicle TEXT,
  image_format TEXT DEFAULT 'jpeg',
  full_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plate_detections_text ON plate_detections(plate_text);
CREATE INDEX idx_plate_detections_created ON plate_detections(created_at DESC);
```

### gate_openings (Bom åbninger)
```sql
CREATE TABLE public.gate_openings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plate_text TEXT,
  approved_plate_id UUID REFERENCES approved_plates(id),
  detection_id UUID REFERENCES plate_detections(id),
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  source TEXT,
  time_restriction_met BOOLEAN,
  checkin_status_met BOOLEAN,
  camera_ip TEXT,
  rate_limit_key TEXT,
  opened_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gate_openings_plate ON gate_openings(plate_text);
CREATE INDEX idx_gate_openings_opened ON gate_openings(opened_at DESC);
```

### access.control_requests (Manuel bom kontrol)
```sql
CREATE SCHEMA IF NOT EXISTS access;

CREATE TABLE access.control_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('open', 'close')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  camera_serial TEXT,
  source TEXT,
  meta JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  executed_at TIMESTAMPTZ
);
```

---

## 6. PORTAL TABELLER

### camp_events (Events)
```sql
CREATE TABLE public.camp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_da TEXT NOT NULL,
  title_en TEXT,
  title_de TEXT,
  description_da TEXT,
  description_en TEXT,
  description_de TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_camp_events_date ON camp_events(event_date);
CREATE INDEX idx_camp_events_active ON camp_events(is_active);
```

### portal_info (Praktisk info)
```sql
CREATE TABLE public.portal_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  title_da TEXT,
  title_en TEXT,
  title_de TEXT,
  content_da TEXT,
  content_en TEXT,
  content_de TEXT,
  icon TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. EMAIL TABELLER

### email_templates
```sql
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  subject_da TEXT,
  subject_en TEXT,
  subject_de TEXT,
  body_da TEXT,
  body_en TEXT,
  body_de TEXT,
  variables TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### email_logs
```sql
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  booking_id INTEGER,
  subject TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'failed', 'bounced')),
  error TEXT,
  brevo_message_id TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_logs_booking ON email_logs(booking_id);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
```

---

## 8. ADMIN TABELLER

### user_roles
```sql
CREATE TABLE public.user_roles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  PRIMARY KEY (user_id, role)
);
```

### profiles
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 9. VIEWS

### latest_meter_readings (Materialized)
```sql
CREATE MATERIALIZED VIEW latest_meter_readings AS
SELECT DISTINCT ON (meter_id)
  meter_id,
  energy,
  power,
  voltage,
  current,
  state,
  linkquality,
  time
FROM meter_readings
ORDER BY meter_id, time DESC;

CREATE UNIQUE INDEX idx_latest_readings_meter ON latest_meter_readings(meter_id);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_latest_meter_readings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY latest_meter_readings;
END;
$$ LANGUAGE plpgsql;
```

---

## 10. RPC FUNKTIONER

### toggle_meter_power
```sql
CREATE OR REPLACE FUNCTION toggle_meter_power(
  p_meter_id TEXT,
  p_state TEXT,
  p_source TEXT DEFAULT 'api'
)
RETURNS UUID AS $$
DECLARE
  v_command_id UUID;
BEGIN
  INSERT INTO meter_commands (meter_id, command, source, status)
  VALUES (p_meter_id, p_state, p_source, 'pending')
  RETURNING id INTO v_command_id;
  
  RETURN v_command_id;
END;
$$ LANGUAGE plpgsql;
```

### auto_shutoff_meters_without_package
```sql
CREATE OR REPLACE FUNCTION auto_shutoff_meters_without_package()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_meter RECORD;
BEGIN
  -- Find målere der er tændt men ikke har aktiv pakke
  FOR v_meter IN
    SELECT DISTINCT pm.meter_number
    FROM power_meters pm
    JOIN regular_customers rc ON rc.meter_id = pm.meter_number
    LEFT JOIN plugin_data pd ON 
      pd.module = 'pakker' 
      AND pd.data->>'booking_nummer' = rc.booking_id::TEXT
      AND pd.data->>'status' = 'aktiv'
    WHERE pd.id IS NULL
    AND rc.checked_in = true
    AND rc.checked_out = false
  LOOP
    -- Send sluk kommando
    PERFORM toggle_meter_power(v_meter.meter_number, 'OFF', 'auto_shutoff');
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;
```

### cleanup_old_readings
```sql
CREATE OR REPLACE FUNCTION cleanup_old_readings(hours_to_keep INTEGER DEFAULT 48)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM meter_readings
  WHERE time < NOW() - (hours_to_keep || ' hours')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. CRON JOBS

```sql
-- Refresh materialized view every minute
SELECT cron.schedule(
  'refresh-latest-readings-every-minute',
  '* * * * *',
  $$SELECT refresh_latest_meter_readings()$$
);

-- Auto shutoff every 5 minutes
SELECT cron.schedule(
  'auto-shutoff-meters-every-5min',
  '*/5 * * * *',
  $$SELECT auto_shutoff_meters_without_package()$$
);

-- Cleanup old readings daily
SELECT cron.schedule(
  'cleanup-old-readings-daily',
  '0 3 * * *',
  $$SELECT cleanup_old_readings(48)$$
);
```

---

## 12. RLS POLICIES

```sql
-- Enable RLS on tables
ALTER TABLE regular_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonal_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE plugin_data ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users
CREATE POLICY "Authenticated can read regular_customers"
  ON regular_customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can read power_meters"
  ON power_meters FOR SELECT
  TO authenticated
  USING (true);

-- Service role can do everything
CREATE POLICY "Service role full access"
  ON regular_customers FOR ALL
  TO service_role
  USING (true);
```

---

## 📋 OPSUMMERING

| Tabel | Formål | Rækker (ca.) |
|-------|--------|--------------|
| regular_customers | Kørende gæster | 50-200 |
| seasonal_customers | Sæsongæster | 20-50 |
| power_meters | Målere | 360+ |
| meter_readings | Real-time data | 50.000+ |
| meter_readings_history | Snapshots | 10.000+ |
| meter_commands | Kommando kø | 100-500 |
| plugin_data | Pakker, ordrer | 300+ |
| approved_plates | Godkendte plader | 100-300 |
| plate_detections | Alle detektioner | 1.000+ |
| gate_openings | Bom log | 500+ |
| camp_events | Events | 10-50 |
| portal_info | Praktisk info | 10-20 |
