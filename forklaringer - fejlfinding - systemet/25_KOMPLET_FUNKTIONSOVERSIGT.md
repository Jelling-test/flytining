# 📋 KOMPLET FUNKTIONSOVERSIGT

**Opdateret:** 16. december 2025

Dette dokument beskriver ALLE funktioner i systemet.

---

## 🖥️ ADMIN SIDER (test.af.system)

### Dashboard (`/admin/dashboard`)
- Overblik over systemstatus
- Antal online/offline målere
- Aktive kunder
- Dagens salg
- Quick actions

### Målere (`/admin/maalere`)
- Liste over alle 360+ målere
- Status (online/offline, tændt/slukket)
- Søg og filtrer
- Tænd/sluk individuel måler
- Se tilknyttet kunde
- Se forbrug

### Måler Detaljer (`/admin/maalere/:id`)
- Detaljeret visning af en måler
- Historik over forbrug
- Kommando log
- Tilknytninger

### Kunder (`/admin/kunder`)
- Liste over alle kunder (regular + seasonal)
- Søg på booking, navn, email, telefon
- Se strømforbrug
- Tildel/fjern måler
- Send magic link
- Check in/out
- Se pakker

### Pakker (`/admin/pakker`)
- Aktive strømpakker
- Historik
- Manuel oprettelse af pakke
- Se forbrug per pakke

### Kort (`/admin/kort`) ⭐
- Interaktivt kort over campingpladsen (React Konva)
- Placér og flyt elementer med drag-and-drop:
  - Strømstandere
  - Målere
  - Pladser
  - Hytter
  - Hovedtavler
  - Fordelingstavler
- Zoom ind/ud
- Lås/lås op elementer
- Filtrér visning
- Se online/offline status direkte på kort
- Vælg dato for at se historisk belægning
- Print kortudsnit

### El-Infrastruktur (`/admin/el-infrastruktur`)
- Hovedtavler (Main Boards)
- Fordelingstavler (Distribution Boards)
- Sikringsgrupper (Fuse Groups)
- Forbindelser mellem tavler
- Tildel standere til sikringsgrupper
- Se belastning per gruppe

### Standere (`/admin/standere`)
- Opret/rediger strømstandere
- Tildel målere til stander
- Tildel til sikringsgruppe
- Placér på kort
- Se status for tilknyttede målere

### Pladser (`/admin/pladser`)
- Opret/rediger campingpladser
- Pladstyper (standard/comfort/premium)
- Kundetype (camping/seasonal/cabin)
- Tildel måler
- Placér på kort

### Hytter (`/admin/hytter`)
- Opret/rediger hytter
- Hyttetype (4-person/6-person)
- Inventar og udstyrs liste
- Tildel måler
- Rengøringsstatus

### Parring (`/admin/parring`) ⭐
- Par nye målere til Zigbee2MQTT
- Vælg område (1-6, 3-fase)
- Live status under parring
- Test relæ efter parring
- Navngiv måler

### Manuel Tænd (`/admin/manuel-taend`)
- Tænd målere uden aktiv pakke (admin bypass)
- Kræver begrundelse
- Log over bypass-tændinger

### Bom (`/admin/bom`)
- Manuel bom-åbning
- Se seneste detektioner
- Se åbningslog
- Tilføj/fjern nummerplader
- Kamera snapshot

### Café (`/admin/cafe`)
- Opret måltidstilbud
- Kapacitet per timeslot
- Se bestillinger
- Print bestillinger
- Slet bestillinger

### Bageri (`/admin/bageri`)
- Produktstyring
- Se dagens bestillinger
- Bestil for gæster
- Print bageliste

### Events (`/admin/events`)
- Opret/rediger events
- Multi-sprog (DA/EN/DE)
- Billede upload
- Aktiver/deaktiver

### Attraktioner (`/admin/attractions`)
- Opret/rediger attraktioner
- Åbningstider
- Priser

### Svømmehal (`/admin/pool`)
- Åbningstider
- Regler
- Info tekster

### Legeplads (`/admin/playground`)
- Faciliteter
- Info tekster

### Praktisk Info (`/admin/practical`)
- WiFi info
- Check-in/out tider
- Kontaktinfo
- Generelle regler

### Hytte Info (`/admin/cabin-info`)
- Ankomst checkliste
- Afrejse checkliste
- Rengøringspris
- Inventar

### Gruppe Mails (`/admin/gruppe-mails`)
- Send email til gruppe af kunder
- Filtrer på ankomstdato, sprog
- Brug templates

### Personale (`/admin/personale`)
- Opret staff brugere
- Tildel roller
- Aktiver/deaktiver

### Rapporter (`/admin/rapporter`)
- Daglig rapport
- Salgsrapport (periode)
- Forbrugsrapport
- Pakkehistorik
- Målerhistorik
- Kundestatistik
- Download CSV/PDF

### Indstillinger (`/admin/indstillinger`)
- Campingplads navn
- Email konfiguration (SMTP/Brevo)
- Stripe konfiguration
- Pris per kWh
- Low power threshold
- Test email/betaling

### Priser (`/admin/priser`)
- Pakkepriser
- Strømpris per kWh
- Rabatter

### Dashboard Billeder (`/admin/dashboard-images`)
- Upload billeder til gæsteportal
- Billeder for hver sektion

---

## 👤 STAFF SIDER

### Staff Dashboard (`/staff/dashboard`)
- Simplified admin view
- Kun nødvendige funktioner

### Staff Checkin (`/staff/checkin`)
- Hurtig check-in af gæster
- Scan booking eller søg

### Staff Parring (`/staff/parring`)
- Par nye målere (samme som admin)

### Staff Manuel Tænd (`/staff/manuel-taend`)
- Tænd målere manuelt

---

## 🎫 GÆSTEPORTAL (implentering-af-personligside)

### Magic Link Entry (`/m/:bookingId/:token`)
- Validerer token
- Redirecter til dashboard

### Welcome (`/guest/welcome`)
- Velkomstbesked
- Booking info
- Navigation til funktioner

### Dashboard (`/guest` eller `/guest/dashboard`)
- Kort overblik
- Navigation cards

### Strøm (`/guest/power`) ⭐
- Se aktuel pakke
- Progress bar for forbrug
- Køb ny pakke (Stripe)
- Se måler status
- Tænd/sluk måler
- Forbrugshistorik

### Events (`/guest/events`)
- Se kommende events
- Filtrer på dato
- Multi-sprog

### Bageri (`/guest/bakery`)
- Se produkter
- Bestil til næste dag
- Se egne bestillinger
- Annuller bestilling

### Café (`/guest/cafe`)
- Se aktuelle tilbud
- Vælg timeslot
- Bestil mad
- Se egne bestillinger

### Attraktioner (`/guest/attractions`)
- Se attraktioner
- Åbningstider
- Priser

### Svømmehal (`/guest/pool`)
- Åbningstider
- Regler

### Legeplads (`/guest/playground`)
- Faciliteter
- Lokation

### Praktisk (`/guest/practical`)
- WiFi info
- Check-in/out
- Kontakt
- Regler

### Hytte (`/guest/cabin`)
- Kun for hyttegæster
- Inventar
- Check-ud liste
- Rengøringsinfo

### Payment Success (`/guest/payment-success`)
- Bekræftelse efter betaling

### Departed (`/guest/departed`)
- Vises efter checkout

---

## 📊 DATABASE TABELLER (Manglende i tidligere docs)

### map_spots (Pladser på kort)
```sql
CREATE TABLE map_spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_number TEXT NOT NULL,
  spot_type TEXT DEFAULT 'standard',
  customer_type TEXT DEFAULT 'camping',
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  meter_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### map_cabins (Hytter på kort)
```sql
CREATE TABLE map_cabins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabin_number TEXT NOT NULL,
  cabin_type TEXT,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  color TEXT DEFAULT '#8B4513',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### power_stands (Strømstandere)
```sql
CREATE TABLE power_stands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  fuse_group_id UUID REFERENCES fuse_groups(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### main_boards (Hovedtavler)
```sql
CREATE TABLE main_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#FF0000',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### distribution_boards (Fordelingstavler)
```sql
CREATE TABLE distribution_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  main_board_id UUID REFERENCES main_boards(id),
  name TEXT NOT NULL,
  board_number INTEGER,
  location TEXT,
  map_x DOUBLE PRECISION,
  map_y DOUBLE PRECISION,
  map_locked BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#00FF00',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### fuse_groups (Sikringsgrupper)
```sql
CREATE TABLE fuse_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES distribution_boards(id),
  group_number INTEGER NOT NULL,
  name TEXT,
  fuse_rating TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### board_connections (Forbindelser)
```sql
CREATE TABLE board_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_board_id UUID NOT NULL,
  to_board_id UUID NOT NULL,
  cable_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔌 NAS SERVICES (Manglende)

### maaler-opsaetning (Parringsservice)
**Port:** 3001  
**Formål:** Web UI til parring af nye målere

```javascript
// Endpoints
GET  /api/areas           // Liste over Zigbee områder
POST /api/permit-join     // Start parring mode
GET  /api/new-devices     // Poll for nye devices
POST /api/rename-device   // Omdøb device
POST /api/test-relay      // Test relæ
```

---

## ⚡ EDGE FUNCTIONS (Manglende)

### assign-meter
Tildel måler til kunde.

### delete-meter
Slet måler fra systemet.

### rename-meter
Omdøb måler i Zigbee2MQTT.

### admin-bypass-meter
Tænd måler uden pakke (admin).

### get-guest-power-data
Hent strømdata for gæst.

### get-guest-status
Hent gæst status.

### get-live-data
Hent live booking data.

### monitor-power-usage
Overvåg forbrug og sluk ved overforbrug.

### start-cleaning-power
Tænd rengøringsstrøm (hytter).

### end-cleaning-power
Sluk rengøringsstrøm.

### verify-plate
Verificer nummerplade.

### bakery-api
Bageri produkter og ordrer.

### bakery-daily-summary
Daglig bageliste.

### scheduled-emails
Send planlagte emails.

### send-welcome-email
Send velkomst email.

### send-warning-email
Send advarsel email.

### daily-accounting-report
Send daglig regnskabsrapport.

### daily-package-snapshot
Gem dagligt snapshot af pakker.

### create-admin-user
Opret ny admin bruger.

### update-user-email
Opdater bruger email.
