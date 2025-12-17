# 🍽️ CAFÉ OG BAGERI SYSTEM

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

Bestillingssystemer til café (aftensmad) og bageri (morgenbrød).

---

## 🍽️ CAFÉ SYSTEM

### Admin Side (`/admin/cafe`)

**Funktioner:**

1. **Opret tilbud**
   - Titel (DA/EN/DE)
   - Beskrivelse
   - Billede upload
   - Pris
   - Synlig fra/til dato
   - Bestillingsfrist
   - Timeslots
   - Kapacitet per timeslot

2. **Se bestillinger**
   - Filtrer på tilbud
   - Filtrer på dato
   - Grupér på timeslot
   - Se kundeinfo

3. **Administrer**
   - Rediger tilbud
   - Slet tilbud
   - Slet bestillinger

4. **Print**
   - Print bestillinger til køkken
   - Gruperet på timeslot

### Database

**cafe_offers**
```sql
CREATE TABLE cafe_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_da TEXT NOT NULL,
  title_en TEXT,
  title_de TEXT,
  description_da TEXT,
  description_en TEXT,
  description_de TEXT,
  price DECIMAL NOT NULL,
  image_url TEXT,
  visible_from DATE NOT NULL,
  visible_until DATE NOT NULL,
  order_deadline TIMESTAMPTZ,
  cancel_deadline TIMESTAMPTZ,
  timeslots JSONB DEFAULT '["17:00","17:15","17:30","17:45","18:00"]',
  eat_in_capacity_per_slot INTEGER DEFAULT 12,
  takeaway_capacity_per_slot INTEGER DEFAULT 20,
  total_max_orders INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**cafe_orders**
```sql
CREATE TABLE cafe_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES cafe_offers(id),
  booking_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_type TEXT DEFAULT 'regular',
  order_type TEXT NOT NULL CHECK (order_type IN ('eat_in', 'takeaway')),
  timeslot TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Kapacitetslogik

```typescript
// Tjek kapacitet for timeslot
async function checkCapacity(offerId: string, timeslot: string, orderType: string) {
  const { data: offer } = await supabase
    .from('cafe_offers')
    .select('eat_in_capacity_per_slot, takeaway_capacity_per_slot')
    .eq('id', offerId)
    .single();

  const { count } = await supabase
    .from('cafe_orders')
    .select('*', { count: 'exact' })
    .eq('offer_id', offerId)
    .eq('timeslot', timeslot)
    .eq('order_type', orderType);

  const capacity = orderType === 'eat_in' 
    ? offer.eat_in_capacity_per_slot 
    : offer.takeaway_capacity_per_slot;

  return count < capacity;
}
```

### Gæst Side (`/guest/cafe`)

**Flow:**
1. Se aktive tilbud
2. Vælg tilbud
3. Vælg spis her / takeaway
4. Vælg timeslot (viser ledige)
5. Bekræft (bindende)

**Regler:**
- 1 bestilling per booking per tilbud
- Viser advarsel om bindende bestilling
- Kan annulleres inden cancel_deadline

---

## 🥐 BAGERI SYSTEM

### Admin Side (`/admin/bageri`)

**Funktioner:**

1. **Produktstyring**
   - Opret produkter (navn, pris, billede)
   - Aktiver/deaktiver produkter
   - Sæt tilgængelighed per ugedag

2. **Se bestillinger**
   - Filtrer på dato
   - Se alle bestillinger for dagen
   - Kundeinfo og afhentning

3. **Bestil for gæst**
   - Manuel bestilling
   - Søg på booking

4. **Print bageliste**
   - Liste til bageren
   - Grupperet på produkt
   - Total antal per produkt

### Database

**Bruger plugin_data med module='bakery_products' og module='bakery_orders'**

**Produkt struktur:**
```json
{
  "module": "bakery_products",
  "key": "product_1",
  "data": {
    "name_da": "Rundstykke",
    "name_en": "Roll",
    "name_de": "Brötchen",
    "price": 5,
    "image_url": "https://...",
    "is_active": true,
    "available_days": ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
  }
}
```

**Ordre struktur:**
```json
{
  "module": "bakery_orders",
  "ref_id": "12345",  // booking_id
  "data": {
    "booking_id": 12345,
    "customer_name": "Peter Hansen",
    "pickup_date": "2025-12-17",
    "items": [
      {"product_id": "uuid", "name": "Rundstykke", "quantity": 4, "price": 5},
      {"product_id": "uuid", "name": "Croissant", "quantity": 2, "price": 12}
    ],
    "total": 44,
    "status": "pending",
    "created_at": "2025-12-16T18:00:00Z"
  }
}
```

### Edge Function: bakery-api

**Endpoints:**

```typescript
// GET: Hent produkter
GET /functions/v1/bakery-api?action=products

// GET: Hent ordrer for dato
GET /functions/v1/bakery-api?action=orders&date=2025-12-17

// POST: Opret ordre
POST /functions/v1/bakery-api
{
  "action": "create_order",
  "booking_id": 12345,
  "items": [...]
}

// DELETE: Annuller ordre
DELETE /functions/v1/bakery-api?order_id=uuid
```

### Gæst Side (`/guest/bakery`)

**Flow:**
1. Se tilgængelige produkter
2. Vælg produkter og antal
3. Vælg afhentningsdato
4. Bekræft bestilling

**Regler:**
- Bestilling inden kl. 18:00 for næste dag
- Kan annulleres inden deadline
- Viser egne bestillinger

### Cron: bakery-daily-summary

**Schedule:** Dagligt kl. 05:00

**Funktion:**
- Henter alle bestillinger for dagen
- Genererer bageliste
- Sender til bageri (email eller print)

---

## 📋 FÆLLES FUNKTIONER

### Bestillingsvalidering

```typescript
function validateOrder(bookingId: number, deadline: Date) {
  // Tjek om booking er aktiv
  const booking = await getBooking(bookingId);
  if (!booking || booking.checked_out) {
    throw new Error('Booking ikke aktiv');
  }

  // Tjek deadline
  if (new Date() > deadline) {
    throw new Error('Bestillingsfrist overskredet');
  }

  return true;
}
```

### Annullering

```typescript
function canCancel(order: Order, cancelDeadline: Date) {
  return new Date() < cancelDeadline;
}
```

### Print funktionalitet

```tsx
const handlePrint = () => {
  const printContent = document.getElementById('print-area');
  const printWindow = window.open('', '', 'width=800,height=600');
  printWindow.document.write(`
    <html>
      <head>
        <title>Bestillinger</title>
        <style>
          body { font-family: Arial; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; }
        </style>
      </head>
      <body>${printContent.innerHTML}</body>
    </html>
  `);
  printWindow.print();
  printWindow.close();
};
```

---

## 🔧 OPSÆTNING

### Café

1. Opret tilbud i Admin → Café
2. Sæt datoer og priser
3. Konfigurer timeslots og kapacitet
4. Aktivér tilbud

### Bageri

1. Opret produkter i Admin → Bageri
2. Sæt priser og tilgængelighed
3. Upload billeder
4. Aktivér produkter

### Automatisk email

Konfigurer bageri email i Admin → Indstillinger for at modtage daglig bageliste.
