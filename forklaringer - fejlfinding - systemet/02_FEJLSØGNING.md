# 🔧 FEJLSØGNING - Systematisk Troubleshooting

**Opdateret:** 16. december 2025

---

## 🚨 HURTIG DIAGNOSE (2 minutter)

### Tjek 1: Er NAS online?
```bash
ping 192.168.9.61
```
- ❌ Ingen respons → Se [NAS NEDE](#nas-nede)
- ✅ Respons → Gå videre

### Tjek 2: Kører Docker containers?
```bash
ssh jc@192.168.9.61
sudo docker ps
```
- ❌ Ingen/få containers → Se [DOCKER NEDE](#docker-nede)
- ✅ Alle kører → Gå videre

### Tjek 3: Kommer MQTT beskeder?
```bash
sudo docker exec -it mosquitto mosquitto_sub -t 'zigbee2mqtt/#' -u homeassistant -P '7200Grindsted!' -v -C 5
```
- ❌ Ingen beskeder → Se [INGEN MQTT](#ingen-mqtt-beskeder)
- ✅ Beskeder → Gå videre

### Tjek 4: Kommer data i database?
```sql
-- Kør i Supabase SQL Editor
SELECT COUNT(*) FROM meter_readings WHERE time > NOW() - INTERVAL '5 minutes';
```
- ❌ 0 rækker → Se [INGEN DATA](#ingen-data-i-database)
- ✅ > 0 → Data flow virker!

---

## 🔴 PROBLEM: NAS NEDE

### Symptomer
- Kan ikke pinge 192.168.9.61
- Zigbee2MQTT UI loader ikke
- Ingen data i dashboard

### Løsning
1. **Fysisk tjek:** Gå til NAS, tjek strøm og netværkskabel
2. **Genstart:** Tryk power-knap, vent 5 min på boot
3. **Netværk:** Tjek router/switch, prøv andet netværkskabel
4. **Synology DSM:** Log ind på http://192.168.9.61:5000 når den er oppe

### Efter genstart
```bash
ssh jc@192.168.9.61
sudo docker ps
# Alle containers bør starte automatisk
```

---

## 🔴 PROBLEM: DOCKER NEDE

### Symptomer
- NAS svarer på ping
- `docker ps` viser ingen/få containers
- Zigbee2MQTT UI loader ikke

### Løsning
```bash
ssh jc@192.168.9.61

# Start hovedsystemet
cd /volume1/docker/jelling-power-system
sudo docker compose up -d

# Vent 2 minutter
sleep 120

# Tjek status
sudo docker ps
```

### Forventet output
```
CONTAINER ID   IMAGE                    STATUS         NAMES
xxxx           mosquitto                Up 2 minutes   mosquitto
xxxx           zigbee2mqtt              Up 2 minutes   zigbee2mqtt
xxxx           zigbee2mqtt              Up 2 minutes   zigbee2mqtt_area2
xxxx           zigbee2mqtt              Up 2 minutes   zigbee2mqtt_area3
xxxx           zigbee2mqtt              Up 2 minutes   zigbee2mqtt_area4
xxxx           zigbee2mqtt              Up 2 minutes   zigbee2mqtt_area5
xxxx           zigbee2mqtt              Up 2 minutes   zigbee2mqtt_3p
xxxx           device-sync              Up 2 minutes   device-sync
xxxx           command-processor        Up 2 minutes   command-processor
xxxx           telegraf                 Up 2 minutes   telegraf
```

---

## 🔴 PROBLEM: INGEN MQTT BESKEDER

### Symptomer
- Containers kører
- Zigbee2MQTT UI viser målere
- Men ingen MQTT beskeder

### Diagnose
```bash
# Tjek mosquitto logs
sudo docker logs --tail 50 mosquitto

# Tjek om Zigbee2MQTT er connected
sudo docker logs --tail 50 zigbee2mqtt | grep -i mqtt
```

### Løsning 1: Genstart Mosquitto
```bash
sudo docker restart mosquitto
sleep 10
sudo docker restart zigbee2mqtt zigbee2mqtt_area2 zigbee2mqtt_area3 zigbee2mqtt_area4 zigbee2mqtt_area5 zigbee2mqtt_3p
```

### Løsning 2: Tjek MQTT credentials
Zigbee2MQTT skal bruge:
- **Server:** `mqtt://mosquitto:1883`
- **User:** `homeassistant`
- **Password:** `7200Grindsted!`

---

## 🔴 PROBLEM: INGEN DATA I DATABASE

### Symptomer
- MQTT beskeder kommer (tjekket med mosquitto_sub)
- Men meter_readings tabel får ingen nye rækker

### Diagnose
```bash
# Tjek Telegraf logs
sudo docker logs --tail 100 telegraf | grep -i error
```

### Løsning 1: Genstart Telegraf
```bash
sudo docker restart telegraf
sleep 30
sudo docker logs --tail 20 telegraf
```

### Løsning 2: Tjek Telegraf config
```bash
cat /volume1/docker/jelling-power-system/telegraf/telegraf.conf | grep topics
```
**Skal indeholde:**
```
topics = ["zigbee2mqtt/+", "zigbee2mqtt_area2/+", "zigbee2mqtt_area3/+", "zigbee2mqtt_area4/+", "zigbee2mqtt_area5/+", "zigbee2mqtt_3p/+"]
```

---

## 🔴 PROBLEM: KOMMANDOER VIRKER IKKE (ON/OFF)

### Symptomer
- Dashboard virker
- Data kommer ind
- Men tænd/sluk virker ikke

### Diagnose
```bash
# Tjek command-processor logs
sudo docker logs --tail 100 command-processor | grep -i error
```

### Tjek pending kommandoer i Supabase
```sql
SELECT * FROM meter_commands 
WHERE status = 'pending' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Løsning 1: Genstart command-processor
```bash
sudo docker restart command-processor
```

### Løsning 2: Manuelt clear stuck kommandoer
```sql
UPDATE meter_commands 
SET status = 'failed', error = 'Manual clear' 
WHERE status = 'pending' 
AND created_at < NOW() - INTERVAL '5 minutes';
```

---

## 🔴 PROBLEM: MÅLER VISER OFFLINE

### Symptomer
- Enkelte målere viser offline i Zigbee2MQTT
- Andre målere virker fint

### Diagnose
1. Åbn Zigbee2MQTT UI for det pågældende område
2. Find måleren og tjek `last_seen`
3. Tjek `linkquality` (bør være > 50)

### Løsning 1: Interview måler igen
I Zigbee2MQTT UI → Klik på måler → "Reconfigure"

### Løsning 2: Tjek fysisk
- Er der strøm på måleren?
- Er måleren for langt fra coordinator?
- Er der andre Zigbee enheder der kan route?

### Løsning 3: Genpar måler
1. Sæt Zigbee2MQTT i permit join mode
2. Tryk 5x på målerens knap
3. Vent på at den dukker op
4. Omdøb til korrekt navn

---

## 🔴 PROBLEM: EDGE FUNCTION FEJLER

### Symptomer
- Frontend viser fejl ved tænd/sluk, køb, etc.
- Edge Function returnerer 500 error

### Diagnose
1. Gå til Supabase Dashboard → Edge Functions
2. Find funktionen og klik på den
3. Se "Logs" fanen for fejlbeskeder

### Almindelige fejl

**"SUPABASE_SERVICE_ROLE_KEY not set"**
- Edge Function mangler secret
- Gå til Project Settings → Secrets → Tilføj manglende

**"TypeError: Cannot read property..."**
- Input data mangler felt
- Tjek hvad frontend sender

**"MQTT connection failed"**
- NAS er nede eller MQTT broker nede
- Se [NAS NEDE](#nas-nede)

---

## 🔴 PROBLEM: CRON JOB KØRER IKKE

### Symptomer
- Automatiske opgaver udføres ikke
- F.eks. ingen daglig rapport, ingen auto-shutoff

### Diagnose
```sql
-- Se alle cron jobs
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Se seneste kørsler
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

### Løsning: Genaktiver job
```sql
UPDATE cron.job SET active = true WHERE jobname = 'JOB_NAVN';
```

---

## 🔴 PROBLEM: PORTAL LOGIN VIRKER IKKE

### Symptomer
- Gæst kan ikke logge ind med magic link
- Fejl: "Invalid token" eller "Booking not found"

### Diagnose
```sql
-- Find kundens booking
SELECT booking_id, magic_token, arrival_date, departure_date 
FROM regular_customers 
WHERE booking_id = BOOKING_ID;

-- Eller søg på email
SELECT * FROM regular_customers WHERE email ILIKE '%email@example.com%';
```

### Løsning 1: Generer nyt magic link
Brug Edge Function `generate-magic-token` med booking_id

### Løsning 2: Tjek datoer
Kunden kan kun logge ind i booking-perioden (arrival_date til departure_date)

---

## 📋 CONTAINER OVERSIGT

| Container | Port | Funktion | Kritisk |
|-----------|------|----------|---------|
| mosquitto | 1890 | MQTT Broker | ✅ JA |
| zigbee2mqtt | 8082 | Område 1 (100-serien) | ✅ JA |
| zigbee2mqtt_area2 | 8083 | Område 2 (Hytter/500) | ✅ JA |
| zigbee2mqtt_area3 | 8084 | Område 3 (200-serien) | ✅ JA |
| zigbee2mqtt_area4 | 8085 | Område 4 (400-serien) | ✅ JA |
| zigbee2mqtt_area5 | 8086 | Område 5 (300-serien) | ✅ JA |
| zigbee2mqtt_3p | 8088 | 3-fase målere | ✅ JA |
| device-sync | - | Sync devices → Supabase | ✅ JA |
| command-processor | - | Kommandoer → MQTT | ✅ JA |
| telegraf | - | Data → Supabase | ✅ JA |

---

## 🔧 NYTTIGE KOMMANDOER

### SSH til NAS
```bash
ssh jc@192.168.9.61
```

### Se alle container logs
```bash
sudo docker logs --tail 50 CONTAINER_NAVN
```

### Genstart alle services
```bash
cd /volume1/docker/jelling-power-system
sudo docker compose restart
```

### Test MQTT forbindelse
```bash
sudo docker exec -it mosquitto mosquitto_sub -t '#' -u homeassistant -P '7200Grindsted!' -v -C 10
```

### Send manuel MQTT kommando
```bash
sudo docker exec -it mosquitto mosquitto_pub -t 'zigbee2mqtt/MÅLER_NAVN/set' -m '{"state":"ON"}' -u homeassistant -P '7200Grindsted!'
```
