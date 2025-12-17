# 🔗 INTEGRATIONER OG EKSTERNE SERVICES

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

| Service | Formål | Webhook/API |
|---------|--------|-------------|
| **Sirvoy** | Booking system | webhook → Supabase |
| **Stripe** | Betalinger | stripe-webhook |
| **Brevo** | Email | API + brevo-webhook |
| **Axis ANPR** | Nummerplade | axis-anpr-webhook |

---

## 1. SIRVOY INTEGRATION

### Formål
Automatisk synkronisering af bookings fra Sirvoy til Supabase.

### Webhook Konfiguration

**I Sirvoy:**
1. Gå til Settings → Integrations → Webhooks
2. Tilføj ny webhook:
   - URL: `https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/webhook`
   - Events: Booking created, Booking modified, Booking cancelled
   - Format: JSON

**Webhook Payload:**
```json
{
  "event": "booking_created",
  "bookingId": "12345",
  "firstName": "Peter",
  "lastName": "Hansen",
  "email": "peter@example.com",
  "phone": "+4512345678",
  "arrivalDate": "2025-12-20",
  "departureDate": "2025-12-27",
  "roomNumber": "F44",
  "adults": 2,
  "children": 1,
  "licensePlates": "AB12345, CD67890",
  "language": "da",
  "notes": "Arrival after 18:00"
}
```

### Data Flow
```
Sirvoy Booking
  ↓ Webhook POST
webhook Edge Function
  ↓ Parse + validate
regular_customers UPSERT
  ↓ Trigger
approved_plates UPSERT (nummerplader)
  ↓ Trigger (scheduled)
generate-magic-token
  ↓
send-welcome-email
```

### Felter der mappes

| Sirvoy Felt | Database Felt |
|-------------|---------------|
| bookingId | booking_id |
| firstName | first_name |
| lastName | last_name |
| email | email |
| phone | phone |
| arrivalDate | arrival_date |
| departureDate | departure_date |
| roomNumber | pitch_number |
| licensePlates | license_plates[] |
| language | language |

---

## 2. STRIPE INTEGRATION

### Formål
Betaling for strømpakker via Stripe Checkout.

### Konfiguration

**Dashboard:** https://dashboard.stripe.com

**API Keys:**
- Publishable Key: `pk_live_...` (frontend)
- Secret Key: `sk_live_...` (backend, i Supabase Secrets)
- Webhook Secret: `whsec_...` (i Supabase Secrets)

### Webhook Konfiguration

**I Stripe Dashboard:**
1. Developers → Webhooks → Add endpoint
2. URL: `https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/stripe-webhook`
3. Events: `checkout.session.completed`

### Flow: Køb Strømpakke

```
1. Frontend kalder create-checkout
   {
     booking_id: 12345,
     package_type: "running",
     amount: 50,  // kWh
     customer_type: "regular"
   }

2. create-checkout opretter Stripe Session
   - line_items med pris
   - metadata med booking info
   - success_url og cancel_url

3. Stripe returnerer checkout URL
   → Frontend redirecter gæst

4. Gæst betaler på Stripe

5. Stripe sender webhook (checkout.session.completed)
   → stripe-webhook modtager

6. stripe-webhook:
   - Opretter pakke i plugin_data
   - Sender ON kommando til måler
   - Logger betaling

7. Gæst redirectes til success_url
```

### Priser

```javascript
// Prisberegning
const pricePerKwh = 3;  // DKK per kWh
const totalPrice = amount * pricePerKwh * 100;  // Stripe bruger øre

// Eksempel pakker
// 25 kWh = 75 kr
// 50 kWh = 150 kr
// 100 kWh = 300 kr
```

### Metadata

Stripe Session metadata bruges til at identificere købet:

```json
{
  "booking_id": "12345",
  "package_type": "running",
  "amount": "50",
  "customer_type": "regular"
}
```

---

## 3. BREVO INTEGRATION

### Formål
Afsendelse af emails (velkomst, advarsler, rapporter).

### Konfiguration

**Dashboard:** https://app.brevo.com

**API Key:** Gemmes i Supabase Secrets som `BREVO_API_KEY`

### API Endpoint

```bash
POST https://api.brevo.com/v3/smtp/email

Headers:
  Accept: application/json
  Content-Type: application/json
  api-key: YOUR_API_KEY

Body:
{
  "sender": {
    "name": "Jelling Camping",
    "email": "noreply@jellingcamping.dk"
  },
  "to": [
    {
      "email": "guest@example.com",
      "name": "Peter Hansen"
    }
  ],
  "subject": "Velkommen til Jelling Camping",
  "htmlContent": "<html>...</html>"
}
```

### Email Templates

**Velkomst Email:**
```html
<h1>Velkommen, {{first_name}}!</h1>

<p>Vi glæder os til at se dig på Jelling Camping.</p>

<p><strong>Booking:</strong> #{{booking_id}}<br>
<strong>Ankomst:</strong> {{arrival_date}}<br>
<strong>Afrejse:</strong> {{departure_date}}<br>
<strong>Plads:</strong> {{pitch_number}}</p>

<p>Klik her for at åbne din personlige portal:</p>

<a href="{{magic_link}}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
  Åbn Portal
</a>

<p>Her kan du:</p>
<ul>
  <li>Købe strøm</li>
  <li>Se aktiviteter</li>
  <li>Bestille fra bageriet</li>
  <li>Og meget mere!</li>
</ul>
```

**Lav Strøm Advarsel:**
```html
<h1>⚠️ Din strømpakke er ved at løbe tør</h1>

<p>Kære {{first_name}},</p>

<p>Du har kun <strong>{{remaining}} kWh</strong> tilbage på din strømpakke.</p>

<p>Køb mere strøm her:</p>

<a href="{{magic_link}}" style="background: #ca8a04; color: white; padding: 12px 24px;">
  Køb Strøm Nu
</a>
```

### Webhook (Email Tracking)

Brevo kan sende events tilbage via webhook:

**URL:** `https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/brevo-webhook`

**Events:**
- delivered
- opened
- clicked
- bounced
- complaint

---

## 4. AXIS ANPR INTEGRATION

### Formål
Automatisk nummerpladegenkendelse og bom-åbning.

### Hardware

| Parameter | Værdi |
|-----------|-------|
| **Kamera IP** | 152.115.191.134:65471 |
| **Bom IO Port** | Port 2 |
| **Snapshot URL** | /axis-cgi/jpg/image.cgi |
| **IO Control** | /axis-cgi/io/port.cgi |

### Kamera Webhook Konfiguration

**I Axis kamera web interface:**
1. Events → Recipients → Add HTTP
   - URL: `https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/axis-anpr-webhook`
   - Method: POST
   - Content-Type: application/json

2. Events → Rules → Add
   - Condition: License plate detected
   - Action: Send HTTP notification

### Webhook Payload

```json
{
  "plateText": "AB12345",
  "plateUnicode": "AB12345",
  "plateConfidence": 95.5,
  "carState": "new",
  "carMoveDirection": "in",
  "datetime": "2025-12-16T10:30:00Z",
  "camera_info": {
    "SerialNumber": "ACCC8EF12345",
    "IPAddress": "152.115.191.134",
    "ProdShortName": "AXIS P1445-LE"
  },
  "ImageArray": [
    {
      "ImageType": "plate",
      "ImageFormat": "jpg",
      "BinaryImage": "base64..."
    },
    {
      "ImageType": "vehicle", 
      "ImageFormat": "jpg",
      "BinaryImage": "base64..."
    }
  ]
}
```

### Bom Kontrol API

**Åbn bom (puls):**
```bash
# ON pulse
curl "http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%2F"

# Wait 700ms

# OFF pulse
curl "http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%5C"
```

**URL Encoding:**
- `%3A` = `:`
- `%2F` = `/` (ON)
- `%5C` = `\` (OFF)

### Åbningslogik

```javascript
// Betingelser for automatisk åbning
const shouldOpen = 
  plateIsApproved &&                    // I approved_plates
  (source === 'manual' ||               // Altid for manuelle
    (hour >= 7 && hour < 23 &&          // 07:00-23:00
     checkedIn === true &&              // Checked ind
     checkedOut === false)) &&          // Ikke checked ud
  !rateLimited;                         // 15 sek siden sidst
```

---

## 5. MQTT INTEGRATION (Lokal)

### Formål
Kommunikation mellem NAS services og Zigbee målere.

### Broker

| Parameter | Værdi |
|-----------|-------|
| **Host** | 192.168.9.61 |
| **Port** | 1890 (ekstern), 1883 (intern) |
| **Username** | homeassistant |
| **Password** | 7200Grindsted! |

### Topic Struktur

```
zigbee2mqtt/MÅLER_NAVN           # State fra måler
zigbee2mqtt/MÅLER_NAVN/set       # Kommando til måler
zigbee2mqtt/bridge/state         # Online/offline
zigbee2mqtt/bridge/devices       # Device liste
```

### Payload Eksempler

**State (fra måler):**
```json
{
  "state": "ON",
  "energy": 12.45,
  "power": 150,
  "voltage": 231,
  "current": 0.65,
  "linkquality": 120
}
```

**Command (til måler):**
```json
{"state": "ON"}
{"state": "OFF"}
```

---

## 📋 OPSÆTNING TJEKLISTE

### Sirvoy
- [ ] Webhook URL konfigureret
- [ ] Test booking sendt
- [ ] Kunde oprettet i database
- [ ] Nummerplader i approved_plates

### Stripe
- [ ] API keys i Supabase Secrets
- [ ] Webhook endpoint oprettet
- [ ] Webhook secret i Supabase Secrets
- [ ] Test betaling gennemført
- [ ] Pakke oprettet i database

### Brevo
- [ ] API key i Supabase Secrets
- [ ] Afsender email verificeret
- [ ] Test email sendt
- [ ] Webhook (valgfrit) konfigureret

### Axis ANPR
- [ ] Webhook URL konfigureret
- [ ] Test detektion modtaget
- [ ] Bom åbning testet
- [ ] Rate limiting verificeret
