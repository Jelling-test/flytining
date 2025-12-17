# 🔌 PARRING OG MÅLER SETUP

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

Komplet guide til parring af nye målere og opsætning af målerinfrastruktur.

---

## 🔧 PARRING VIA WEB UI (`/admin/parring`)

### Forudsætninger
- NAS kører (192.168.9.61)
- maaler-opsaetning service kører på port 3001
- Zigbee coordinator er online
- Fysisk adgang til måler

### Trin-for-trin

**1. Åbn parringsside**
- Gå til Admin → Parring
- Eller Staff → Parring

**2. Vælg område**
```
Område 1 (100-serien)  → zigbee2mqtt      → Port 8082
Område 2 (Hytter/500)  → zigbee2mqtt_area2 → Port 8083
Område 3 (200-serien)  → zigbee2mqtt_area3 → Port 8084
Område 4 (400-serien)  → zigbee2mqtt_area4 → Port 8085
Område 5 (300-serien)  → zigbee2mqtt_area5 → Port 8086
3-fase                 → zigbee2mqtt_3p    → Port 8088
```

**3. Start parring**
- Klik "Start parring"
- System aktiverer permit-join mode (255 sek)

**4. Sæt måler i parringsmode**
- TS011F: Hold knap 5 sek ELLER tryk 5x hurtigt
- LED blinker = klar til parring

**5. Vent på device**
- UI viser "Venter på enhed..."
- Når fundet: Viser IEEE adresse og model

**6. Interview**
- System interviewer device automatisk
- Viser progress (10-30 sek)

**7. Navngiv måler**
- Indtast pladsnummer (f.eks. "F44", "212,2")
- Følg navngivningskonvention

**8. Test relæ**
- Klik "Test tænd/sluk"
- Bekræft at måler fysisk tænder/slukker

**9. Færdig**
- Måler er parret og synkroniseret til Supabase
- Kan nu bruges i systemet

---

## 🖥️ MAALER-OPSAETNING SERVICE

### Konfiguration
```yaml
# docker-compose.yml
maaler-opsaetning:
  container_name: maaler-opsaetning
  build: ./maaler-opsaetning
  ports:
    - "3001:3000"
  environment:
    - MQTT_HOST=mosquitto
    - MQTT_PORT=1883
    - MQTT_USER=homeassistant
    - MQTT_PASS=7200Grindsted!
  depends_on:
    - mosquitto
```

### API Endpoints

**GET /api/areas**
Liste over alle Zigbee2MQTT områder.

```json
{
  "areas": [
    {"id": "1", "name": "Område 1", "baseTopic": "zigbee2mqtt", "port": 8082},
    {"id": "2", "name": "Område 2", "baseTopic": "zigbee2mqtt_area2", "port": 8083}
  ]
}
```

**POST /api/permit-join**
Start parring mode.

```json
// Request
{"area_id": "1", "duration": 255}

// Response
{"success": true, "expires_at": "2025-12-16T10:30:00Z"}
```

**GET /api/new-devices**
Poll for nye devices (under parring).

```json
{
  "devices": [
    {
      "ieee_address": "0xdc8e95fffe93c5e2",
      "friendly_name": "0xdc8e95fffe93c5e2",
      "model": "TS011F",
      "vendor": "Tuya",
      "interview_completed": true
    }
  ]
}
```

**POST /api/rename-device**
Omdøb device.

```json
// Request
{
  "area_id": "1",
  "ieee_address": "0xdc8e95fffe93c5e2",
  "new_name": "F44"
}

// Response
{"success": true}
```

**POST /api/test-relay**
Test tænd/sluk.

```json
// Request
{
  "area_id": "1",
  "device_name": "F44",
  "action": "toggle"
}

// Response
{"success": true, "new_state": "ON"}
```

---

## 📝 NAVNGIVNINGSKONVENTION

| Type | Format | Eksempler |
|------|--------|-----------|
| Standard plads | Nummer | `101`, `202`, `315` |
| Flex plads | F + nummer | `F44`, `F52`, `F67` |
| Hytte | H + nummer | `H01`, `H15`, `H28` |
| Sæsonplads | S + nummer | `S01`, `S25` |
| 3-fase | 3F + nummer | `3F01`, `3F02` |
| Komma-pladser | Nummer,nr | `212,2`, `315,1` |

**Regler:**
- Brug IKKE mellemrum
- Brug IKKE special tegn (undtagen komma)
- Hold det kort og genkendeligt
- Match fysisk skiltning

---

## 🔄 MANUEL PARRING VIA Z2M UI

Hvis web UI ikke virker:

**1. Åbn Zigbee2MQTT UI**
```
http://192.168.9.61:808X
```
(X = område nummer)

**2. Aktiver permit join**
- Klik "Permit join (All)" øverst
- Timer starter

**3. Par måler**
- Sæt måler i parringsmode
- Vent på at den dukker op

**4. Omdøb**
- Klik på device
- Ændre "Friendly name"
- Klik "Rename device"

**5. Synkronisering**
- device-sync synkroniserer automatisk til Supabase
- Tjek efter 1-2 minutter

---

## 🔧 FEJLSØGNING

### Måler parrer ikke

**Tjek:**
1. Er coordinator online?
   ```bash
   ping 192.168.0.254  # Område 1
   ```

2. Er Zigbee2MQTT kørende?
   ```bash
   ssh jc@192.168.9.61
   sudo docker ps | grep zigbee2mqtt
   ```

3. Er permit join aktiv?
   - Tjek Z2M UI
   - Tjek logs: `sudo docker logs zigbee2mqtt --tail 50`

**Løsning:**
- Genstart coordinator (træk stik, vent 10 sek)
- Genstart Z2M container
- Prøv at resette måler (hold knap 10+ sek)

### Interview fejler

**Symptom:** Device dukker op men "Interview failed"

**Løsning:**
1. Klik "Reconfigure" i Z2M UI
2. Vent 30 sek
3. Hvis stadig fejl: Slet device og genpar

### Måler synkroniserer ikke til database

**Tjek:**
1. device-sync kører?
   ```bash
   sudo docker logs device-sync --tail 50
   ```

2. MQTT beskeder?
   ```bash
   sudo docker exec -it mosquitto mosquitto_sub -t 'zigbee2mqtt/bridge/devices' -u homeassistant -P '7200Grindsted!' -C 1
   ```

**Løsning:**
- Genstart device-sync: `sudo docker restart device-sync`
- Trigger sync ved at omdøbe i Z2M

---

## ⚡ ADMIN BYPASS (`/admin/manuel-taend`)

Tænd måler uden aktiv pakke (f.eks. til test eller nødsituation).

### Brug
1. Åbn Admin → Manuel Tænd
2. Søg på målernummer
3. Klik "Tænd"
4. **Indtast begrundelse** (påkrævet)
5. Bekræft

### Hvad sker der
- Måler tændes via toggle-power
- `admin_bypass = true` sættes på måler
- Logges i system

### Sluk bypass
- Find måler i listen
- Klik "Sluk bypass"
- Måler slukkes og bypass fjernes

---

## 📊 MÅLER DETALJER (`/admin/maalere/:id`)

Detaljeret visning af en måler.

### Information
- IEEE adresse
- Friendly name
- Base topic
- Område
- Online/offline status
- Sidst set

### Tilknytninger
- Tilknyttet kunde
- Tilknyttet stander
- Tilknyttet plads

### Historik
- Forbrugshistorik (graf)
- Kommando log
- Status ændringer

### Handlinger
- Tænd/sluk
- Omdøb
- Flyt til andet område
- Slet
