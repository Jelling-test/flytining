# 🏗️ SYSTEM ARKITEKTUR

**Opdateret:** 16. december 2025

---

## 🎯 FORMÅL

Strømstyringssystem til Jelling Camping med 360+ målere fordelt på 7 Zigbee områder.

### Hovedfunktioner
- ✅ **Strømstyring:** Tænd/sluk af individuelle målere via Zigbee
- ✅ **Forbrugsmåling:** Real-time og historisk forbrugsdata
- ✅ **Pakke-salg:** Kørende (pay-per-kWh) og sæsonpakker via Stripe
- ✅ **Automatisering:** Auto-shutoff ved udløb, advarsler ved lav strøm
- ✅ **Gæsteportal:** Personlige sider med magic link adgang
- ✅ **Booking-integration:** Sirvoy webhook til automatisk kundeoprettelse
- ✅ **Email-service:** Brevo til velkomstmails og advarsler
- ✅ **ANPR:** Automatisk nummerpladegenkendelse til bom

---

## 📊 3-LAGS ARKITEKTUR

### LAG 1: FRONTEND (Bruger Interface)

| App | URL | Formål |
|-----|-----|--------|
| **Admin/Staff Portal** | https://test-af-system.vercel.app | Administration, reception |
| **Gæsteportal** | https://jelling.vercel.app | Gæstesider, strømkøb |

**Teknologi:** React 18 + TypeScript + Vite + TailwindCSS

**Routes Admin/Staff:**
- `/admin/*` - Administrator funktioner
- `/staff/*` - Medarbejder funktioner
- `/` - Kundeflow (vælg måler, køb strøm)

**Routes Gæsteportal:**
- `/m/:bookingId/:token` - Magic link indgang
- `/guest/*` - Gæstesider (strøm, events, bageri)

---

### LAG 2: BACKEND (Cloud - Supabase)

| Komponent | Beskrivelse |
|-----------|-------------|
| **PostgreSQL** | 25+ tabeller, views, RPC funktioner |
| **Edge Functions** | 37 serverless funktioner (Deno) |
| **Cron Jobs** | 13 planlagte opgaver (pg_cron) |
| **Auth** | Brugerautentificering (admin/staff) |
| **Storage** | Billeder til portal |

**Projekt ID:** `jkmqliztlhmfyejhmuil`  
**URL:** https://jkmqliztlhmfyejhmuil.supabase.co

---

### LAG 3: LOKAL INFRASTRUKTUR (NAS)

**Server:** Synology DS224+ på 192.168.9.61

| Container | Port | Funktion |
|-----------|------|----------|
| **mosquitto** | 1890 | MQTT Broker - central kommunikation |
| **zigbee2mqtt** | 8082 | Område 1 (100-serien, ~80 målere) |
| **zigbee2mqtt_area2** | 8083 | Område 2 (Hytter/500, ~40 målere) |
| **zigbee2mqtt_area3** | 8084 | Område 3 (200-serien, ~80 målere) |
| **zigbee2mqtt_area4** | 8085 | Område 4 (400-serien, ~60 målere) |
| **zigbee2mqtt_area5** | 8086 | Område 5 (300-serien, ~100 målere) |
| **zigbee2mqtt_area6** | 8087 | Område 6 (Fremtidig) |
| **zigbee2mqtt_3p** | 8088 | 3-fase målere |
| **device-sync** | - | Synk devices → Supabase |
| **command-processor** | - | Kommandoer fra Supabase → MQTT |
| **telegraf** | - | Målerdata → Supabase |
| **homeassistant** | 8124 | Langtidsstatistik (valgfri) |

---

## 🔗 DATAFLOW

### Flow 1: Måler → Database → Frontend

```
Strømmåler (TS011F Zigbee)
  ↓ Zigbee protokol
SLZB-06M Coordinator
  ↓ TCP/EZSP
Zigbee2MQTT (Docker)
  ↓ MQTT publish: zigbee2mqtt/MÅLER_NAVN
Mosquitto MQTT Broker
  ↓ MQTT subscribe
Telegraf
  ↓ Parse + Insert
Supabase PostgreSQL (meter_readings)
  ↓ Realtime subscription
React Frontend (Dashboard)
```

### Flow 2: Kommando → Måler (ON/OFF)

```
Frontend (Button click)
  ↓ HTTP POST
Edge Function: toggle-power
  ↓ INSERT
meter_commands (status='pending')
  ↓ Poll hvert 2. sekund
command-processor (Python)
  ↓ MQTT publish
Mosquitto MQTT Broker
  ↓ MQTT
Zigbee2MQTT
  ↓ Zigbee
Strømmåler (ON/OFF)
```

### Flow 3: Booking → Kunde

```
Sirvoy Booking System
  ↓ Webhook POST
Edge Function: webhook
  ↓ Parse booking data
regular_customers / seasonal_customers
  ↓ Trigger
Edge Function: generate-magic-token
  ↓ Generate token
Edge Function: send-welcome-email
  ↓ Brevo API
Gæst modtager email med magic link
```

### Flow 4: Betaling

```
Gæst vælger pakke
  ↓ HTTP POST
Edge Function: create-checkout
  ↓ Stripe API
Stripe Checkout Page
  ↓ Betaling gennemført
Stripe Webhook
  ↓ POST
Edge Function: stripe-webhook
  ↓ INSERT
plugin_data (pakke aktiveret)
  ↓ Trigger
Måler tændes automatisk
```

---

## 🔌 EKSTERNE INTEGRATIONER

| Service | Formål | Webhook/API |
|---------|--------|-------------|
| **Stripe** | Betalinger | `stripe-webhook` |
| **Brevo** | Email | `send-email`, `brevo-webhook` |
| **Sirvoy** | Bookings | `webhook` |
| **Axis ANPR** | Nummerplade | `axis-anpr-webhook` |

---

## 📡 ZIGBEE NETVÆRK

### Coordinators (SLZB-06M)

| Område | IP | Base Topic | Port |
|--------|----|-----------| -----|
| 1 (100-serien) | 192.168.0.254 | zigbee2mqtt | 8082 |
| 2 (Hytter/500) | 192.168.1.35 | zigbee2mqtt_area2 | 8083 |
| 3 (200-serien) | 192.168.1.36 | zigbee2mqtt_area3 | 8084 |
| 4 (400-serien) | 192.168.1.37 | zigbee2mqtt_area4 | 8085 |
| 5 (300-serien) | 192.168.1.38 | zigbee2mqtt_area5 | 8086 |
| 6 (Fremtidig) | TBD | zigbee2mqtt_area6 | 8087 |
| 3-fase | 192.168.1.39 | zigbee2mqtt_3p | 8088 |

### Måler Hardware
- **Model:** TS011F (Tuya smart plug med energimåling)
- **Firmware:** Stock Zigbee
- **Kommunikation:** Zigbee 3.0
- **Måling:** Voltage, Current, Power, Energy

---

## 🗄️ DATABASE OVERSIGT

### Kunde Data
- `regular_customers` - Kørende gæster
- `seasonal_customers` - Sæson gæster
- `approved_plates` - ANPR nummerplader

### Strøm Data
- `power_meters` - Måler register
- `meter_readings` - Real-time data
- `meter_readings_history` - Daglige snapshots
- `meter_commands` - Kommando kø
- `meter_identity` - IEEE → Navn mapping

### Pakker og Betalinger
- `plugin_data` - Polymorfisk tabel (pakker, betalinger)
- `daily_package_stats` - Statistik

### ANPR/Bom
- `plate_detections` - Nummerplade scans
- `gate_openings` - Bom åbninger
- `access.control_requests` - Manuelle kommandoer

---

## 🔒 SIKKERHED

### Autentificering
- **Admin/Staff:** Supabase Auth (email/password)
- **Gæster:** Magic link tokens (32 tegn)

### API Sikkerhed
- **Edge Functions:** JWT verification (undtagen webhooks)
- **Webhooks:** IP whitelist + secret headers
- **MQTT:** Username/password authentication

### Secrets (Environment Variables)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BREVO_API_KEY`
- `MQTT_USER` / `MQTT_PASS`
