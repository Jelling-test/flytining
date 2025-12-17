# 🚀 LOVABLE PROMPTS - Byg Systemet Trin-for-Trin

**Opdateret:** 16. december 2025

---

## 📋 OVERSIGT

Brug disse prompts i rækkefølge for at genopbygge systemet i Lovable.

---

## TRIN 1: PROJECT SETUP

```
Create a React + TypeScript + Vite project with TailwindCSS and shadcn/ui components.

Install dependencies:
- @supabase/supabase-js
- @tanstack/react-query
- react-router-dom
- date-fns
- lucide-react
- recharts (for charts)
- react-konva konva (for interactive map)

Create Supabase client in src/integrations/supabase/client.ts with environment variables:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Set up React Router in App.tsx with these routes:
- / (landing)
- /admin/* (admin routes)
- /staff/* (staff routes)
- /guest/* (guest routes, for separate app)
```

---

## TRIN 2: DATABASE SCHEMA

```
Create these Supabase tables (run SQL in Supabase dashboard):

1. regular_customers - Guest bookings
   - id UUID PRIMARY KEY
   - booking_id INTEGER UNIQUE
   - customer_name TEXT, first_name TEXT, last_name TEXT
   - email TEXT, phone TEXT
   - arrival_date DATE, departure_date DATE
   - meter_id TEXT, pitch_number TEXT
   - checked_in BOOLEAN, checked_out BOOLEAN
   - magic_token TEXT, language TEXT
   - license_plates TEXT[]

2. seasonal_customers - Seasonal guests (same structure + season_start, season_end, kwh_included)

3. power_meters - All power meters
   - id UUID PRIMARY KEY
   - meter_number TEXT UNIQUE
   - ieee_address TEXT, friendly_name TEXT
   - base_topic TEXT, area TEXT
   - status TEXT (available/assigned/maintenance)
   - is_online BOOLEAN, current_energy DECIMAL, current_power DECIMAL

4. meter_readings - Real-time readings (partitioned)
   - id UUID, meter_id TEXT, time TIMESTAMPTZ
   - energy DECIMAL, power DECIMAL, voltage DECIMAL, state TEXT

5. meter_commands - Command queue
   - id UUID, meter_id TEXT, command TEXT (ON/OFF)
   - status TEXT (pending/sent/completed), created_at TIMESTAMPTZ

6. plugin_data - Polymorphic storage for packages
   - id UUID, module TEXT, ref_id TEXT, data JSONB

See 20_DATABASE_SCHEMA_SQL.md for complete SQL.
```

---

## TRIN 3: AUTHENTICATION

```
Create AuthContext for admin/staff login using Supabase Auth.

Features:
- Email/password login
- Check user_roles table for admin/staff role
- Redirect to /admin/dashboard or /staff/dashboard based on role
- Protected routes that require authentication

Create login page at /admin/login with:
- Email input
- Password input
- Login button
- Error message display
- Redirect after successful login
```

---

## TRIN 4: ADMIN SIDEBAR

```
Create AdminSidebar component with navigation links:

- Dashboard (📊)
- Målere (⚡) - Power meters
- Kunder (👥) - Customers
- Pakker (📦) - Packages
- Kort (🗺️) - Interactive map
- El-infrastruktur (🔌)
- Standere (🔋)
- Parring (📡) - Pairing
- Bom (🚗) - Gate/barrier
- Café (🍽️)
- Bageri (🥐)
- Events (📅)
- Rapporter (📈)
- Indstillinger (⚙️)

Use shadcn/ui Sidebar component.
Highlight active route.
Collapsible on mobile.
```

---

## TRIN 5: ADMIN DASHBOARD

```
Create Admin Dashboard page at /admin/dashboard showing:

1. Status cards (grid):
   - Total meters: count from power_meters
   - Online meters: count where is_online = true
   - Active customers: count checked_in = true
   - Today's revenue: sum from today's packages

2. Quick actions:
   - Button: "Tilføj kunde"
   - Button: "Par ny måler"
   - Button: "Åbn bom"

3. Recent activity table:
   - Last 10 meter commands
   - Columns: Time, Meter, Command, Status

Use shadcn Card, Button, Table components.
Fetch data with React Query.
```

---

## TRIN 6: METERS PAGE

```
Create Meters page at /admin/maalere with:

1. Search input (filters by meter_number)
2. Filter dropdown (All/Online/Offline)

3. Table with columns:
   - Måler (meter_number)
   - Status (Badge: green "Online" or red "Offline")
   - Strøm (Badge: "Tændt" or "Slukket")
   - Kunde (booking_id or "-")
   - Forbrug (energy kWh)
   - Effekt (power W)
   - Actions (dropdown: Tænd, Sluk, Detaljer)

4. Pagination (50 per page)

Real-time updates:
- Subscribe to meter_readings table changes
- Update display when new readings arrive

Toggle power:
- Call toggle-power Edge Function
- Show loading state
- Show success/error toast
```

---

## TRIN 7: CUSTOMERS PAGE

```
Create Customers page at /admin/kunder with:

1. Tabs: "Alle" | "Kørende" | "Sæson"

2. Search input (searches name, booking_id, email, phone)

3. Table with columns:
   - Booking
   - Navn
   - Plads
   - Ankomst / Afrejse
   - Måler
   - Status (checked in/out badges)
   - Actions

4. Click row to expand details:
   - Contact info
   - Power usage
   - Package history
   - License plates

5. Actions dropdown:
   - Tildel måler
   - Send magic link
   - Check in/out
   - Rediger
```

---

## TRIN 8: INTERACTIVE MAP

```
Create Map page at /admin/kort using React Konva:

1. Canvas with zoom/pan:
   - Mouse wheel = zoom
   - Drag = pan
   - Zoom buttons (+/-)

2. Elements (shapes on canvas):
   - Main boards: Large red rectangles
   - Distribution boards: Medium green rectangles
   - Stands: Blue triangles
   - Meters: Small circles (green=online, red=offline)
   - Labels: Text showing meter numbers

3. Drag-and-drop:
   - Drag elements to reposition
   - Save position to database on drop
   - Lock/unlock elements

4. Sidebar controls:
   - Filter checkboxes (show/hide element types)
   - Date picker (historical view)
   - Legend

5. Click element:
   - Show details panel
   - Edit/delete options

See 26_KORT_OG_INFRASTRUKTUR.md for database schema.
```

---

## TRIN 9: POWER PACKAGES

```
Create Packages page at /admin/pakker:

1. Tabs: "Aktive" | "Historik"

2. Active packages table:
   - Booking
   - Kunde
   - Pakke (kWh)
   - Forbrugt
   - Tilbage
   - Oprettet
   - Status

3. Click to expand:
   - Usage chart
   - Transaction details

4. Create package button:
   - Modal with form
   - Select customer
   - Enter kWh amount
   - Save to plugin_data with module='pakker'
```

---

## TRIN 10: GATE/BARRIER (BOM)

```
Create Gate page at /admin/bom:

1. Manual controls:
   - "Åbn bom" button (calls gate-open Edge Function)
   - Camera snapshot display

2. Recent detections table:
   - Plate text
   - Confidence
   - Time
   - Result (opened/denied)

3. Approved plates management:
   - List of approved_plates
   - Add new plate
   - Delete plate
   - Toggle active

See 11_BOM_OG_KAMERA.md for details.
```

---

## TRIN 11: GUEST PORTAL SETUP (Separate App)

```
Create separate React app for guest portal (implentering-af-personligside):

1. GuestContext with:
   - Guest data (from magic link validation)
   - Language (da/en/de/nl)
   - Translation function t()

2. Routes:
   - /m/:bookingId/:token (magic link entry)
   - /guest (dashboard)
   - /guest/power
   - /guest/events
   - /guest/bakery
   - /guest/cafe
   - /guest/practical

3. Language selector in header

See 42_GUEST_CONTEXT.md for complete context code with all translations.
```

---

## TRIN 12: GUEST POWER PAGE

```
Create GuestPower page at /guest/power:

1. Package status card:
   - Progress bar (remaining %)
   - "Tilbage: X kWh"
   - "Brugt: X kWh"
   - Warning if < 20%
   - "Køb strøm" button

2. Meter status card:
   - Online/Offline badge
   - ON/OFF badge
   - Current power (W)
   - Toggle buttons

3. Buy power flow:
   - Select package (25/50/100 kWh)
   - Show price
   - "Gå til betaling" button
   - Redirect to Stripe via create-checkout
   - Return to success page

4. Real-time updates:
   - Subscribe to meter_readings
   - Update display live
```

---

## TRIN 13: EDGE FUNCTIONS

```
Deploy these Edge Functions to Supabase:

Core:
- toggle-power: Send ON/OFF command
- assign-meter: Assign meter to customer
- generate-magic-token: Create magic link
- validate-magic-link: Validate and return customer

Payment:
- create-checkout: Create Stripe session
- stripe-webhook: Handle payment confirmation

Portal:
- get-guest-portal-data: Get all guest data
- portal-api: Events, info, meter search

Gate:
- axis-anpr-webhook: Receive plate detections
- gate-open: Manual gate control

See 41_ALLE_EDGE_FUNCTIONS.md for complete code.
```

---

## TRIN 14: CRON JOBS

```
Set up these cron jobs in Supabase:

Every minute:
- Refresh latest_meter_readings materialized view

Every 5 minutes:
- monitor-power-usage: Check usage, turn off if exceeded
- check-low-power: Send warnings

Daily at 09:00:
- scheduled-emails: Send welcome emails

Daily at 23:59:
- daily-package-snapshot: Save statistics
- cleanup-old-readings: Delete old data

See 07_CRON_JOBS.md for complete list.
```

---

## TRIN 15: INTEGRATIONS

```
Set up external integrations:

1. Stripe:
   - Add STRIPE_SECRET_KEY to Supabase secrets
   - Configure webhook endpoint
   - Add STRIPE_WEBHOOK_SECRET

2. Brevo (email):
   - Add BREVO_API_KEY to secrets
   - Configure sender email

3. Sirvoy (booking):
   - Set webhook URL to /functions/v1/webhook
   - Enable booking events

4. Axis ANPR:
   - Configure camera webhook URL
   - Set up IO port for gate control

See 24_INTEGRATIONER.md for details.
```

---

## 📋 OPSUMMERING

Efter at have fulgt alle trin har du:

✅ React frontend med admin, staff, og gæst views
✅ Supabase database med alle tabeller
✅ 37 Edge Functions
✅ Real-time meter updates
✅ Stripe betaling
✅ Email via Brevo
✅ Magic link authentication for guests
✅ Multi-language support (DA/EN/DE/NL)
✅ Interactive map with React Konva
✅ Gate/ANPR integration

---

## 🔗 DOKUMENTATION

Se disse filer for detaljer:
- `20_DATABASE_SCHEMA_SQL.md` - Komplet SQL
- `21_FRONTEND_STRUKTUR.md` - React struktur
- `22_EDGE_FUNCTIONS_KODE.md` - Vigtigste funktioner
- `41_ALLE_EDGE_FUNCTIONS.md` - Alle funktioner
- `42_GUEST_CONTEXT.md` - Multi-sprog context
- `31_TO_REPO_ARKITEKTUR.md` - To repos setup
