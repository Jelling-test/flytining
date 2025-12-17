# ➕ TILFØJ NY MÅLER

**Opdateret:** 16. december 2025

---

## 📋 FORUDSÆTNINGER

- Adgang til Zigbee2MQTT Web UI
- Fysisk adgang til måleren
- Viden om hvilket område måleren skal tilhøre

---

## 🔧 TRIN FOR TRIN

### Trin 1: Identificer korrekt Zigbee2MQTT instans

| Pladstype | Område | Z2M UI |
|-----------|--------|--------|
| 100-serien | 1 | http://192.168.9.61:8082 |
| Hytter/500 | 2 | http://192.168.9.61:8083 |
| 200-serien | 3 | http://192.168.9.61:8084 |
| 400-serien | 4 | http://192.168.9.61:8085 |
| 300-serien | 5 | http://192.168.9.61:8086 |
| 3-fase | 3p | http://192.168.9.61:8088 |

### Trin 2: Aktiver parringstilstand

1. Åbn korrekt Zigbee2MQTT Web UI
2. Klik på **"Permit join (All)"** øverst
3. Timer starter (standard 255 sekunder)

### Trin 3: Par måleren

**TS011F (standard plug):**
1. Sæt måleren i stikkontakt
2. Tryk og hold knappen i **5 sekunder**
3. LED blinker hurtigt = parringstilstand
4. Vent på at den dukker op i Z2M (10-30 sek)

**Alternativ metode:**
1. Tryk knappen **5 gange hurtigt**
2. LED blinker = parringstilstand

### Trin 4: Verificer parring

1. Ny device vises i Zigbee2MQTT med IEEE-adresse (f.eks. `0xdc8e95fffe93c5e2`)
2. Status: "Interview successful"
3. Device type: TS011F

### Trin 5: Omdøb til pladsnummer

1. Klik på den nye device
2. Find "Friendly name" felt
3. Skriv pladsnummer (f.eks. `F44`, `212,2`, `H05`)
4. Klik **"Rename device"**

### Trin 6: Bekræft synkronisering

Måleren synkroniseres automatisk til Supabase via `device-sync`.

Tjek i Supabase:
```sql
SELECT * FROM power_meters WHERE meter_number = 'F44';
```

---

## ✅ VERIFIKATION

### I Zigbee2MQTT
- [ ] Device vises med korrekt navn
- [ ] Status: "Available" (grøn)
- [ ] Linkquality > 50

### I Dashboard
- [ ] Måler vises i oversigt
- [ ] Status: Online
- [ ] Data kommer ind (energy, power)

### Test ON/OFF
1. Gå til Admin → Målere
2. Find måleren
3. Klik Tænd/Sluk
4. Bekræft at fysisk måler reagerer

---

## 🔧 FEJLSØGNING

### Måler dukker ikke op

**Tjek:**
1. Er Permit join aktiv?
2. Er måleren tæt nok på coordinator/andre målere?
3. Prøv at resette måleren (hold knap 10 sek)

**Løsning:**
```bash
# Tjek Z2M logs
ssh jc@192.168.9.61
sudo docker logs --tail 100 zigbee2mqtt | grep -i join
```

### Måler viser "Interview failed"

**Løsning:**
1. Klik på device
2. Klik "Reconfigure"
3. Vent 30 sekunder
4. Hvis stadig fejl: Slet og genpar

### Måler parret til forkert område

**Løsning:**
1. Slet device fra nuværende Z2M
2. Genpar til korrekt Z2M instans

---

## 📝 NAVNGIVNINGSKONVENTION

| Type | Format | Eksempel |
|------|--------|----------|
| Standard plads | Nummer | `101`, `202` |
| Hytte | H + nummer | `H01`, `H15` |
| Flexplads | F + nummer | `F44`, `F52` |
| Sæsonplads | S + nummer | `S01`, `S25` |
| 3-fase | 3F + nummer | `3F01` |

---

## 🔄 BULK TILFØJELSE

Ved mange nye målere:

1. Sæt Z2M i permanent permit join:
   - Settings → Zigbee → Permit join timeout → 0 (disabled)

2. Par alle målere efter hinanden

3. Omdøb alle til sidst

4. Deaktiver permit join igen:
   - Settings → Zigbee → Permit join timeout → 255

5. Tjek synkronisering:
```sql
SELECT COUNT(*) FROM power_meters WHERE created_at > NOW() - INTERVAL '1 hour';
```
