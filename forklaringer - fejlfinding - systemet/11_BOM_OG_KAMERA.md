# 🚗 BOM OG KAMERA SYSTEM

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

**Formål:** Automatisk adgangskontrol via nummerpladegenkendelse (ANPR)

**Hardware:**
- Axis ANPR Kamera (IP: 152.115.191.134:65471)
- Bom controller (samme IP, IO port)

**Software:**
- `axis-anpr-webhook` - Modtager detektioner, åbner bom automatisk
- `gate-open` - Manuel bom åbning (admin/staff)
- `camera-snapshot` - Henter live billede fra kamera
- `verify-plate` - Verificerer nummerplade

---

## 🎥 AXIS KAMERA

### Forbindelsesinfo
| Parameter | Værdi |
|-----------|-------|
| **IP:Port** | 152.115.191.134:65471 |
| **Snapshot URL** | `http://152.115.191.134:65471/axis-cgi/jpg/image.cgi` |
| **IO Control** | `http://152.115.191.134:65471/axis-cgi/io/port.cgi` |

### Kamera Webhook Konfiguration
Kameraet sender webhook til Supabase ved hver nummerplade detektion:

**Webhook URL:**
```
https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/axis-anpr-webhook
```

**Webhook Payload (fra Axis):**
```json
{
  "plateText": "AB12345",
  "plateConfidence": 95.5,
  "carState": "new",
  "carMoveDirection": "in",
  "datetime": "2025-12-16T10:30:00Z",
  "camera_info": {
    "SerialNumber": "CAMERA001",
    "IPAddress": "152.115.191.134"
  },
  "ImageArray": [
    {"ImageType": "plate", "BinaryImage": "base64..."},
    {"ImageType": "vehicle", "BinaryImage": "base64..."}
  ]
}
```

---

## 🚧 BOM CONTROLLER

### Sådan åbnes bommen

Bommen styres via Axis kameraets IO port med en **puls-sekvens**:

1. **ON puls** (åbn relæ)
2. **Vent 700ms**
3. **OFF puls** (luk relæ)
4. **Failsafe OFF** efter 5 sek (ekstra sikkerhed)

### API Kald (direkte til kamera)

**Tænd relæ (ON):**
```
GET http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%2F
```

**Sluk relæ (OFF):**
```
GET http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%5C
```

**Bemærk:** `%3A` = `:` og `%2F` = `/` og `%5C` = `\`
- `2:/` = Port 2 ON
- `2:\` = Port 2 OFF

### Test bom manuelt
```bash
# Åbn bom (ON puls)
curl "http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%2F"

# Vent 700ms og luk igen
sleep 0.7
curl "http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%5C"
```

---

## 🔄 AUTOMATISK BOM ÅBNING

### Flow
```
Bil kører mod bom
  ↓
Axis kamera detekterer nummerplade
  ↓
Kamera sender webhook til Supabase
  ↓
axis-anpr-webhook modtager data
  ↓
Gem i plate_detections tabel
  ↓
Tjek: Er pladen i approved_plates?
  ↓ JA
Tjek: Er det inden for åbningstid (07:00-23:00)?
  ↓ JA
Tjek: Er gæsten checked_in og IKKE checked_out?
  ↓ JA
Tjek: Rate limit (15 sek siden sidste åbning)?
  ↓ OK
→ ÅBN BOM (ON → 700ms → OFF)
  ↓
Log i gate_openings tabel
```

### Betingelser for automatisk åbning

| Kilde | Tidsbegrænsning | Check-in krav |
|-------|-----------------|---------------|
| **manual** (admin) | Ingen (24/7) | Ingen |
| **sirvoy_webhook** (gæst) | 07:00-23:00 | Ja (checked_in=true, checked_out=false) |

### Rate Limiting
- **15 sekunder** mellem åbninger for samme plade
- Forhindrer at bom åbner flere gange hvis bil holder stille

---

## 👆 MANUEL BOM ÅBNING

### Via Edge Function: gate-open

**Kræver:** Admin eller Staff login

**Request:**
```bash
curl -X POST https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/gate-open \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source": "manual_button"}'
```

**Response:**
```json
{
  "ok": true,
  "id": "uuid",
  "message": "Gate opened successfully"
}
```

### Via Frontend
- **Admin:** `/admin/bom`
- **Staff:** `/staff/bom` eller dashboard knap

---

## 📸 KAMERA SNAPSHOT

### Via Edge Function: camera-snapshot

Henter live billede fra kameraet:

```bash
curl https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/camera-snapshot \
  --output snapshot.jpg
```

**Returnerer:** JPEG billede (image/jpeg)

### Direkte fra kamera
```bash
curl "http://152.115.191.134:65471/axis-cgi/jpg/image.cgi" --output snapshot.jpg
```

---

## 🗄️ DATABASE TABELLER

### plate_detections
Alle nummerplader der detekteres (godkendte og ikke-godkendte):

```sql
SELECT * FROM plate_detections ORDER BY created_at DESC LIMIT 10;
```

| Kolonne | Beskrivelse |
|---------|-------------|
| plate_text | Nummerplade tekst |
| plate_confidence | Sikkerhed (0-100%) |
| car_state | new, lost, updated |
| camera_ip | Kamera IP |
| image_plate | Base64 billede af plade |
| image_vehicle | Base64 billede af bil |

### approved_plates
Godkendte nummerplader der må åbne bommen:

```sql
SELECT * FROM approved_plates WHERE plate_text = 'AB12345';
```

| Kolonne | Beskrivelse |
|---------|-------------|
| plate_text | Nummerplade |
| source | 'manual' eller 'sirvoy_webhook' |
| booking_id | Tilknyttet booking |
| checked_in | Er gæsten checked ind? |
| checked_out | Er gæsten checked ud? |

### gate_openings
Log over alle bom åbninger:

```sql
SELECT * FROM gate_openings ORDER BY opened_at DESC LIMIT 10;
```

| Kolonne | Beskrivelse |
|---------|-------------|
| plate_text | Nummerplade |
| success | true/false |
| error_message | Evt. fejl |
| time_restriction_met | Var det inden for åbningstid? |
| checkin_status_met | Var gæsten checked in? |

### access.control_requests
Log over manuelle bom åbninger:

```sql
SELECT * FROM access.control_requests ORDER BY created_at DESC LIMIT 10;
```

---

## 🔧 FEJLSØGNING

### Bom åbner ikke automatisk

**1. Tjek plate_detections:**
```sql
SELECT * FROM plate_detections 
WHERE plate_text = 'AB12345' 
ORDER BY created_at DESC LIMIT 5;
```
→ Kommer detektionerne ind?

**2. Tjek approved_plates:**
```sql
SELECT * FROM approved_plates WHERE plate_text = 'AB12345';
```
→ Er pladen godkendt? Er checked_in=true og checked_out=false?

**3. Tjek gate_openings:**
```sql
SELECT * FROM gate_openings 
WHERE plate_text = 'AB12345' 
ORDER BY opened_at DESC LIMIT 5;
```
→ Hvad er error_message? time_restriction_met? checkin_status_met?

**4. Tjek Edge Function logs:**
- Supabase Dashboard → Edge Functions → axis-anpr-webhook → Logs

### Bom åbner ikke manuelt

**1. Tjek brugerrolle:**
```sql
SELECT * FROM user_roles WHERE user_id = 'USER_ID';
```
→ Har brugeren 'admin' eller 'staff' rolle?

**2. Tjek access.control_requests:**
```sql
SELECT * FROM access.control_requests ORDER BY created_at DESC LIMIT 5;
```
→ Hvad er status? Fejlbesked?

**3. Test kamera/bom direkte:**
```bash
curl "http://152.115.191.134:65471/axis-cgi/io/port.cgi?action=2%3A%2F"
```
→ Får du svar? Åbner bommen fysisk?

### Kamera ikke tilgængeligt

```bash
# Ping kamera
ping 152.115.191.134

# Test HTTP
curl -I "http://152.115.191.134:65471/"
```

---

## 📝 TILFØJ NUMMERPLADE MANUELT

### Via Admin UI
1. Gå til Admin → Bom/ANPR
2. Klik "Tilføj nummerplade"
3. Indtast plade (uden mellemrum/bindestreger)
4. Vælg "Manuel" som kilde
5. Gem

### Via SQL
```sql
INSERT INTO approved_plates (plate_text, source, checked_in, checked_out)
VALUES ('AB12345', 'manual', true, false);
```

---

## 📋 OPSUMMERING

| Funktion | Edge Function | Beskrivelse |
|----------|---------------|-------------|
| **Auto åbning** | axis-anpr-webhook | Modtager webhook, tjekker, åbner |
| **Manuel åbning** | gate-open | Admin/staff knap |
| **Snapshot** | camera-snapshot | Hent live billede |
| **Verificer** | verify-plate | Tjek om plade er godkendt |

**Bom API:**
- ON: `action=2%3A%2F`
- OFF: `action=2%3A%5C`
- Puls: ON → 700ms → OFF
