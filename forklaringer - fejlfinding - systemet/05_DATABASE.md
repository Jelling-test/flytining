# 💾 DATABASE STRUKTUR

**Opdateret:** 16. december 2025  
**Database:** PostgreSQL 17 (Supabase)

---

## 📊 TABEL OVERSIGT

### Kunde Data
| Tabel | Formål |
|-------|--------|
| `regular_customers` | Kørende gæster |
| `seasonal_customers` | Sæson gæster |
| `approved_plates` | Godkendte nummerplader (ANPR) |

### Strøm Data
| Tabel | Formål |
|-------|--------|
| `power_meters` | Måler register |
| `meter_readings` | Real-time målinger |
| `meter_readings_history` | Daglige snapshots |
| `meter_commands` | Kommando kø |
| `meter_identity` | IEEE → Navn mapping backup |

### Pakker og Betalinger
| Tabel | Formål |
|-------|--------|
| `plugin_data` | Polymorfisk (pakker, betalinger, ordrer) |
| `daily_package_stats` | Statistik |

### ANPR/Bom
| Tabel | Formål |
|-------|--------|
| `plate_detections` | Nummerplade scans |
| `gate_openings` | Bom åbninger |
| `access.control_requests` | Manuelle bom kommandoer |

### Portal/Email
| Tabel | Formål |
|-------|--------|
| `camp_events` | Camping events |
| `portal_info` | Praktisk info til portal |
| `email_templates` | Email skabeloner |
| `email_logs` | Sendte emails |
| `brevo_email_events` | Brevo tracking |

### Admin
| Tabel | Formål |
|-------|--------|
| `profiles` | Bruger profiler |
| `user_roles` | Roller |
| `organizations` | Organisationer |

---

## 📋 VIGTIGE TABELLER

### regular_customers
```sql
CREATE TABLE regular_customers (
  id UUID PRIMARY KEY,
  booking_id INTEGER UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  meter_id TEXT,
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  checked_in BOOLEAN DEFAULT false,
  magic_token TEXT,
  license_plates TEXT[],
  language TEXT DEFAULT 'da',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### power_meters
```sql
CREATE TABLE power_meters (
  id UUID PRIMARY KEY,
  meter_number TEXT UNIQUE NOT NULL,
  mqtt_topic TEXT,
  base_topic TEXT,
  ieee_address TEXT,
  status TEXT DEFAULT 'available',
  area TEXT,
  is_seasonal BOOLEAN DEFAULT false,
  current_energy DECIMAL,
  last_seen TIMESTAMPTZ
);
```

### meter_readings
```sql
CREATE TABLE meter_readings (
  id UUID PRIMARY KEY,
  meter_id TEXT NOT NULL,
  energy DECIMAL,
  power DECIMAL,
  voltage DECIMAL,
  current DECIMAL,
  state TEXT,
  time TIMESTAMPTZ DEFAULT NOW()
);
```

### meter_commands
```sql
CREATE TABLE meter_commands (
  id UUID PRIMARY KEY,
  meter_id TEXT NOT NULL,
  command TEXT NOT NULL,  -- 'ON' eller 'OFF'
  status TEXT DEFAULT 'pending',  -- pending, sent, completed, failed
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);
```

### plugin_data (polymorfisk)
```sql
CREATE TABLE plugin_data (
  id UUID PRIMARY KEY,
  module TEXT NOT NULL,  -- 'pakker', 'pakke_typer', 'betalinger', 'bakery_orders'
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Eksempel: Strømpakke
{
  "module": "pakker",
  "data": {
    "booking_nummer": 12345,
    "enheder": 50,
    "enheder_tilbage": 35.5,
    "status": "aktiv",
    "type": "running"
  }
}
```

---

## 🔍 VIGTIGE VIEWS

### latest_meter_readings
Materialized view med seneste reading per måler.

```sql
SELECT * FROM latest_meter_readings WHERE meter_id = 'F44';
```

### meter_with_customer
View der joiner målere med tilknyttede kunder.

```sql
SELECT * FROM meter_with_customer WHERE meter_number = 'F44';
```

---

## ⚡ RPC FUNKTIONER

### toggle_meter_power
```sql
SELECT toggle_meter_power('F44', 'ON', 'admin');
```

### get_customer_power_data
```sql
SELECT * FROM get_customer_power_data(12345);
```

### cleanup_expired_customers
```sql
SELECT cleanup_expired_customers();
```

### refresh_latest_meter_readings
```sql
SELECT refresh_latest_meter_readings();
```

### auto_shutoff_meters_without_package
```sql
SELECT auto_shutoff_meters_without_package();
```

---

## 📊 CRON JOBS (pg_cron)

Se alle jobs:
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Se seneste kørsler:
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 🔧 NYTTIGE QUERIES

### Find kunde på booking
```sql
SELECT * FROM regular_customers WHERE booking_id = 12345;
```

### Find måler med seneste data
```sql
SELECT m.*, r.energy, r.power, r.time 
FROM power_meters m
LEFT JOIN latest_meter_readings r ON m.meter_number = r.meter_id
WHERE m.meter_number = 'F44';
```

### Find aktive pakker for kunde
```sql
SELECT * FROM plugin_data 
WHERE module = 'pakker' 
AND data->>'booking_nummer' = '12345'
AND data->>'status' = 'aktiv';
```

### Find pending kommandoer
```sql
SELECT * FROM meter_commands 
WHERE status = 'pending' 
ORDER BY created_at DESC;
```

### Se strømforbrug sidste 24 timer
```sql
SELECT meter_id, 
       MAX(energy) - MIN(energy) as forbrug_kwh
FROM meter_readings 
WHERE time > NOW() - INTERVAL '24 hours'
GROUP BY meter_id
ORDER BY forbrug_kwh DESC;
```

---

## 🗑️ OPRYDNING

### Slet gamle readings (holdes af cron)
```sql
DELETE FROM meter_readings 
WHERE time < NOW() - INTERVAL '48 hours';
```

### Clear stuck kommandoer
```sql
UPDATE meter_commands 
SET status = 'failed', error = 'Manual clear' 
WHERE status = 'pending' 
AND created_at < NOW() - INTERVAL '10 minutes';
```

---

## 🔐 RLS (Row Level Security)

Vigtige tabeller har RLS aktiveret:
- `regular_customers` - Kun authenticated users
- `power_meters` - Kun authenticated users
- `plugin_data` - Baseret på module og brugerrolle

Service role key bypasser RLS (brug kun i backend).
