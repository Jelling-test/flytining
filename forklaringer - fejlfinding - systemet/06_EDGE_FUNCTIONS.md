# ⚡ EDGE FUNCTIONS

**Opdateret:** 16. december 2025  
**Antal:** 37 funktioner

---

## 📊 OVERSIGT

| Kategori | Antal | Beskrivelse |
|----------|-------|-------------|
| Webhooks | 4 | Eksterne integrationer (Sirvoy, Stripe, ANPR, Brevo) |
| API | 15 | Frontend API endpoints |
| Cron | 10 | Planlagte automatiske opgaver |
| Email | 4 | Email-relaterede funktioner |
| Utility | 4 | Hjælpefunktioner |

---

## 🔗 WEBHOOKS (verify_jwt: FALSE)

Disse funktioner modtager data fra eksterne systemer og **kræver IKKE authentication**.

| Funktion | Kilde | Formål |
|----------|-------|--------|
| `webhook` | Sirvoy | Booking oprettelse/ændring |
| `stripe-webhook` | Stripe | Betalingsbekræftelse |
| `axis-anpr-webhook` | Axis kamera | Nummerplade → bom åbning |
| `brevo-webhook` | Brevo | Email event tracking |

---

## 🔐 API FUNKTIONER (verify_jwt: TRUE)

Disse funktioner kaldes fra frontend og **kræver authentication**.

### Strømstyring
| Funktion | Formål |
|----------|--------|
| `toggle-power` | Tænd/sluk måler |
| `assign-meter` | Tildel måler til kunde |
| `delete-meter` | Slet måler fra system |
| `rename-meter` | Omdøb måler i Zigbee2MQTT |

### Pakker og Betaling
| Funktion | Formål |
|----------|--------|
| `create-checkout` | Opret Stripe checkout session |
| `get-guest-power-data` | Hent gæstens strømdata |

### Gæsteportal
| Funktion | Formål |
|----------|--------|
| `generate-magic-token` | Generer magic link til gæst |
| `validate-magic-link` | Valider magic link token |
| `portal-api` | Gæsteportal events og info |
| `get-guest-portal-data` | Hent komplet gæstedata |
| `get-guest-status` | Hent gæst status |
| `get-live-data` | Hent live booking data |

### Bom/Gate
| Funktion | Formål |
|----------|--------|
| `gate-open` | Manuel åbning af bom |
| `verify-plate` | Verificer nummerplade |
| `camera-snapshot` | Hent kamera billede |

### Admin
| Funktion | Formål |
|----------|--------|
| `admin-bypass-meter` | Admin override af måler |

---

## ⏰ CRON FUNKTIONER

Disse funktioner køres automatisk via pg_cron.

| Funktion | Schedule | Formål |
|----------|----------|--------|
| `check-low-power` | */5 min | Advarsel ved lav strøm |
| `monitor-power-usage` | */5 min | Overforbrug → auto-shutoff |
| `archive-meter-readings` | Hver time | Arkiver + ryd op i readings |
| `cleanup-expired-customers` | Hver time | Ryd udløbne kunder |
| `cleanup-old-readings` | Dagligt | Slet gamle meter readings |
| `start-cleaning-power` | 09:00 UTC | Tænd hytte-strøm |
| `end-cleaning-power` | 14:00 UTC | Sluk hytte-strøm |
| `daily-accounting-report` | 23:59 UTC | Daglig regnskabsrapport |
| `daily-package-snapshot` | 23:59 UTC | Pakke statistik snapshot |
| `scheduled-emails` | 08:00 UTC | Send planlagte emails |
| `bakery-daily-summary` | Dagligt | Bageri bage-liste |

---

## 📧 EMAIL FUNKTIONER

| Funktion | Formål |
|----------|--------|
| `send-email` | Generisk email afsendelse |
| `send-email-brevo` | Direkte Brevo API |
| `send-welcome-email` | Velkomst email med magic link |
| `send-low-power-warning` | Advarsel om lav strøm |
| `send-warning-email` | Generisk advarsel |

---

## 🔧 UTILITY FUNKTIONER

| Funktion | Formål |
|----------|--------|
| `bakery-api` | Bageri produkter og ordrer |
| `create-admin-user` | Opret admin bruger |
| `update-user-email` | Opdater bruger email |

---

## 📋 DETALJERET DOKUMENTATION

### toggle-power
**Formål:** Tænd/sluk strøm på en måler

**Input:**
```json
{
  "meter_id": "F44",
  "state": "ON",
  "source": "admin"
}
```

**Flow:**
1. Validerer input
2. Finder måler i `power_meters`
3. Indsætter kommando i `meter_commands`
4. command-processor henter og sender til MQTT

---

### create-checkout
**Formål:** Opret Stripe betaling for strømpakke

**Input:**
```json
{
  "booking_id": 12345,
  "package_type": "running",
  "amount": 50,
  "customer_type": "regular"
}
```

**Flow:**
1. Opretter Stripe Checkout Session
2. Returnerer checkout URL
3. Gæst betaler på Stripe
4. `stripe-webhook` aktiverer pakke

---

### generate-magic-token
**Formål:** Generer unik login link til gæst

**Input:**
```json
{
  "booking_id": 12345
}
```

**Output:**
```json
{
  "magic_link": "https://jelling.vercel.app/m/12345/abc123..."
}
```

**Flow:**
1. Genererer 32-tegns random token
2. Gemmer i `magic_token` felt på kunde
3. Returnerer komplet URL

---

### axis-anpr-webhook
**Formål:** Håndter nummerplade detection fra Axis kamera

**Input (fra kamera):**
```json
{
  "plate": "AB12345",
  "confidence": 0.95,
  "timestamp": "2025-12-16T10:30:00Z"
}
```

**Flow:**
1. Logger detection i `plate_detections`
2. Tjekker om plate er i `approved_plates`
3. Hvis godkendt + inden for check-in periode → åbn bom
4. Rate limiting (15 sek mellem åbninger)

---

## 🔍 FEJLSØGNING

### Se Edge Function logs
1. Gå til Supabase Dashboard
2. Edge Functions → Vælg funktion
3. Klik "Logs" fanen

### Almindelige fejl

**"SUPABASE_SERVICE_ROLE_KEY not set"**
- Gå til Project Settings → Secrets
- Tilføj manglende secret

**"Function invocation failed"**
- Tjek logs for stack trace
- Verificer input format

**"Timeout"**
- Funktion tager for lang tid
- Optimer kode eller opdel i mindre dele
