# 🖥️ NAS SERVICES - Detaljeret Oversigt

**Opdateret:** 16. december 2025  
**Server:** Synology DS224+ (192.168.9.61)

---

## 📊 CONTAINER OVERSIGT

| Container | Port | Status | Funktion |
|-----------|------|--------|----------|
| **mosquitto** | 1890 | ✅ Kritisk | MQTT Broker |
| **zigbee2mqtt** | 8082 | ✅ Kritisk | Zigbee Område 1 (100-serien) |
| **zigbee2mqtt_area2** | 8083 | ✅ Kritisk | Zigbee Område 2 (Hytter/500) |
| **zigbee2mqtt_area3** | 8084 | ✅ Kritisk | Zigbee Område 3 (200-serien) |
| **zigbee2mqtt_area4** | 8085 | ✅ Kritisk | Zigbee Område 4 (400-serien) |
| **zigbee2mqtt_area5** | 8086 | ✅ Kritisk | Zigbee Område 5 (300-serien) |
| **zigbee2mqtt_area6** | 8087 | ⏸️ Venter | Zigbee Område 6 (Fremtidig) |
| **zigbee2mqtt_3p** | 8088 | ✅ Kritisk | Zigbee 3-fase målere |
| **device-sync** | - | ✅ Kritisk | Synk devices → Supabase |
| **command-processor** | - | ✅ Kritisk | Kommandoer → MQTT |
| **telegraf** | - | ✅ Kritisk | Målerdata → Supabase |
| **homeassistant** | 8124 | ⚠️ Valgfri | Langtidsstatistik |

---

## 🔌 MOSQUITTO (MQTT BROKER)

**Container:** mosquitto  
**Port:** 1890 (ekstern), 1883 (intern Docker)  
**Funktion:** Central message broker for al MQTT kommunikation

### Credentials
```
Username: homeassistant
Password: 7200Grindsted!
```

### Config filer
```
/volume1/docker/jelling-power-system/mosquitto/config/
├── mosquitto.conf    # Hovedconfig
├── passwd            # Krypterede passwords
└── acl               # Access control list
```

### Test forbindelse
```bash
# Lyt på alle topics
sudo docker exec -it mosquitto mosquitto_sub -t '#' -u homeassistant -P '7200Grindsted!' -v -C 10

# Send test besked
sudo docker exec -it mosquitto mosquitto_pub -t 'test' -m 'hello' -u homeassistant -P '7200Grindsted!'
```

### Logs
```bash
sudo docker logs --tail 50 mosquitto
```

---

## 📡 ZIGBEE2MQTT (7 instanser)

**Funktion:** Oversætter Zigbee kommunikation til MQTT

### Instansoversigt

| Container | Web UI | Base Topic | Coordinator IP | Målere |
|-----------|--------|------------|----------------|--------|
| zigbee2mqtt | :8082 | zigbee2mqtt | 192.168.0.254 | ~80 |
| zigbee2mqtt_area2 | :8083 | zigbee2mqtt_area2 | 192.168.1.35 | ~40 |
| zigbee2mqtt_area3 | :8084 | zigbee2mqtt_area3 | 192.168.1.36 | ~80 |
| zigbee2mqtt_area4 | :8085 | zigbee2mqtt_area4 | 192.168.1.37 | ~60 |
| zigbee2mqtt_area5 | :8086 | zigbee2mqtt_area5 | 192.168.1.38 | ~100 |
| zigbee2mqtt_area6 | :8087 | zigbee2mqtt_area6 | TBD | 0 |
| zigbee2mqtt_3p | :8088 | zigbee2mqtt_3p | 192.168.1.39 | ~10 |

### Data mappe
```
/volume1/docker/jelling-power-system/zigbee2mqtt/data/
├── configuration.yaml    # Config + device parringer (IEEE → navn)
├── database.db           # Coordinator parringer
├── coordinator_backup.json
└── state.json
```

### Vigtige config indstillinger
```yaml
mqtt:
  server: mqtt://mosquitto:1883
  user: homeassistant
  password: 7200Grindsted!
  base_topic: zigbee2mqtt  # Unik per instans

serial:
  adapter: ember
  port: tcp://192.168.0.254:6638  # Coordinator IP
```

### Logs
```bash
sudo docker logs --tail 50 zigbee2mqtt
sudo docker logs --tail 50 zigbee2mqtt_area2
# osv.
```

---

## 🔄 DEVICE-SYNC

**Container:** device-sync  
**Sprog:** Python  
**Funktion:** Synkroniserer devices fra Zigbee2MQTT til Supabase

### Hvad den gør
1. Lytter på MQTT `zigbee2mqtt/+/bridge/devices`
2. Når device liste opdateres → sync til `power_meters` tabel
3. Opretter nye målere, opdaterer eksisterende

### Kode placering
```
/volume1/docker/jelling-power-system/device-sync/
├── device_sync.py
├── Dockerfile
└── requirements.txt
```

### Environment
```env
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_USER=homeassistant
MQTT_PASS=7200Grindsted!
SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
SUPABASE_KEY=eyJ...
```

### Logs
```bash
sudo docker logs --tail 100 device-sync
```

---

## ⚡ COMMAND-PROCESSOR

**Container:** command-processor (eller mqtt-command-processor)  
**Sprog:** Python  
**Funktion:** Udfører kommandoer fra Supabase via MQTT

### Hvad den gør
1. Poller `meter_commands` tabel hvert 2. sekund
2. Finder kommandoer med status='pending'
3. Sender MQTT kommando til måler
4. Opdaterer status til 'sent' eller 'failed'

### Flow
```
Frontend: "Tænd måler F44"
  ↓
Edge Function: toggle-power
  ↓
INSERT INTO meter_commands (meter_id='F44', command='ON', status='pending')
  ↓
command-processor (poll)
  ↓
MQTT publish: zigbee2mqtt/F44/set {"state":"ON"}
  ↓
UPDATE meter_commands SET status='sent'
```

### Kode placering
```
/volume1/docker/jelling-power-system/command-processor/
├── command_processor.py
├── Dockerfile
└── requirements.txt
```

### Logs
```bash
sudo docker logs --tail 100 command-processor
```

---

## 📊 TELEGRAF

**Container:** telegraf  
**Funktion:** Data pipeline fra MQTT til Supabase

### Hvad den gør
1. Subscribes på alle Zigbee2MQTT topics
2. Parser JSON payload (energy, power, voltage, current, state)
3. Indsætter i `meter_readings` tabel via PostgreSQL plugin

### Config
```
/volume1/docker/jelling-power-system/telegraf/telegraf.conf
```

### Vigtige config sektioner

**MQTT Input:**
```toml
[[inputs.mqtt_consumer]]
  servers = ["tcp://mosquitto:1883"]
  topics = [
    "zigbee2mqtt/+",
    "zigbee2mqtt_area2/+",
    "zigbee2mqtt_area3/+",
    "zigbee2mqtt_area4/+",
    "zigbee2mqtt_area5/+",
    "zigbee2mqtt_3p/+"
  ]
  username = "homeassistant"
  password = "7200Grindsted!"
  data_format = "json"
```

**PostgreSQL Output:**
```toml
[[outputs.postgresql]]
  connection = "postgres://postgres:PASSWORD@db.jkmqliztlhmfyejhmuil.supabase.co:5432/postgres"
  table_template = "meter_readings"
```

### Logs
```bash
sudo docker logs --tail 100 telegraf
```

---

## 🏠 HOME ASSISTANT

**Container:** homeassistant  
**Port:** 8124  
**Status:** Valgfri - kun til langtidsstatistik

### Hvad den gør
- Modtager MQTT data
- Gemmer langtidshistorik
- Kan vise grafer (ikke aktiv del af systemet)

### Web UI
http://192.168.9.61:8124

### Logs
```bash
sudo docker logs --tail 100 homeassistant
```

---

## 🔧 ADMINISTRATION

### SSH til NAS
```bash
ssh jc@192.168.9.61
```

### Se alle containers
```bash
sudo docker ps
```

### Genstart alle services
```bash
cd /volume1/docker/jelling-power-system
sudo docker compose restart
```

### Genstart specifik container
```bash
sudo docker restart zigbee2mqtt
sudo docker restart telegraf
sudo docker restart command-processor
```

### Se container logs
```bash
sudo docker logs --tail 50 CONTAINER_NAVN
sudo docker logs -f CONTAINER_NAVN  # Live logs
```

### Start/stop container
```bash
sudo docker stop CONTAINER_NAVN
sudo docker start CONTAINER_NAVN
```

---

## 📁 MAPPESTRUKTUR

```
/volume1/docker/jelling-power-system/
├── docker-compose.yml           # Alle containers
├── .env                         # Environment variabler
│
├── mosquitto/
│   ├── config/
│   │   ├── mosquitto.conf
│   │   ├── passwd
│   │   └── acl
│   └── data/
│
├── zigbee2mqtt/data/
│   ├── configuration.yaml       # PARRINGER!
│   ├── database.db
│   └── state.json
│
├── zigbee2mqtt_area2/data/      # Samme struktur
├── zigbee2mqtt_area3/data/
├── zigbee2mqtt_area4/data/
├── zigbee2mqtt_area5/data/
├── zigbee2mqtt_3p/data/
│
├── telegraf/
│   └── telegraf.conf
│
├── device-sync/
│   ├── device_sync.py
│   └── Dockerfile
│
├── command-processor/
│   ├── command_processor.py
│   └── Dockerfile
│
└── homeassistant/config/
    └── configuration.yaml
```

---

## 🚨 START RÆKKEFØLGE

Ved genstart af NAS skal services startes i denne rækkefølge:

1. **mosquitto** (ingen afhængigheder)
2. **zigbee2mqtt*** (afhænger af mosquitto)
3. **telegraf** (afhænger af mosquitto)
4. **device-sync** (afhænger af mosquitto)
5. **command-processor** (afhænger af mosquitto)
6. **homeassistant** (valgfri)

Docker Compose håndterer dette automatisk med `depends_on`.
