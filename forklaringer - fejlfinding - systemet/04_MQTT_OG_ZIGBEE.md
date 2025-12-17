# 📡 MQTT OG ZIGBEE

**Opdateret:** 16. december 2025

---

## 🎯 OVERSIGT

Systemet bruger **Zigbee** til kommunikation med målere og **MQTT** som message broker mellem alle komponenter.

---

## 📊 MQTT BROKER

### Forbindelsesinfo
| Parameter | Værdi |
|-----------|-------|
| **Host** | 192.168.9.61 |
| **Port (ekstern)** | 1890 |
| **Port (intern Docker)** | 1883 |
| **Username** | homeassistant |
| **Password** | 7200Grindsted! |

### Test forbindelse
```bash
# Fra NAS
sudo docker exec -it mosquitto mosquitto_sub -t '#' -u homeassistant -P '7200Grindsted!' -v -C 10

# Fra ekstern maskine
mosquitto_sub -h 192.168.9.61 -p 1890 -t '#' -u homeassistant -P '7200Grindsted!' -v -C 10
```

---

## 📡 ZIGBEE2MQTT INSTANSER

| Område | Base Topic | Port | Coordinator IP | Antal målere |
|--------|------------|------|----------------|--------------|
| 1 (100-serien) | `zigbee2mqtt` | 8082 | 192.168.0.254 | ~80 |
| 2 (Hytter/500) | `zigbee2mqtt_area2` | 8083 | 192.168.1.35 | ~40 |
| 3 (200-serien) | `zigbee2mqtt_area3` | 8084 | 192.168.1.36 | ~80 |
| 4 (400-serien) | `zigbee2mqtt_area4` | 8085 | 192.168.1.37 | ~60 |
| 5 (300-serien) | `zigbee2mqtt_area5` | 8086 | 192.168.1.38 | ~100 |
| 6 (Fremtidig) | `zigbee2mqtt_area6` | 8087 | TBD | 0 |
| 3-fase | `zigbee2mqtt_3p` | 8088 | 192.168.1.39 | ~10 |

### Web UI
- Område 1: http://192.168.9.61:8082
- Område 2: http://192.168.9.61:8083
- Område 3: http://192.168.9.61:8084
- Område 4: http://192.168.9.61:8085
- Område 5: http://192.168.9.61:8086
- 3-fase: http://192.168.9.61:8088

---

## 🔑 MQTT TOPIC STRUKTUR

### State Topics (data FRA måler)
```
zigbee2mqtt/MÅLER_NAVN
zigbee2mqtt_area2/MÅLER_NAVN
zigbee2mqtt_area3/MÅLER_NAVN
...
```

**Payload eksempel:**
```json
{
  "state": "ON",
  "energy": 12.45,
  "power": 150.2,
  "voltage": 230.1,
  "current": 0.65,
  "linkquality": 120
}
```

### Set Topics (kommando TIL måler)
```
zigbee2mqtt/MÅLER_NAVN/set
```

**Payload eksempel:**
```json
{"state": "ON"}
{"state": "OFF"}
```

### Bridge Topics (Zigbee2MQTT status)
```
zigbee2mqtt/bridge/state          # online/offline
zigbee2mqtt/bridge/devices        # liste af devices
zigbee2mqtt/bridge/logging        # log beskeder
```

---

## 🔧 ZIGBEE2MQTT CONFIGURATION

### configuration.yaml struktur
```yaml
homeassistant:
  enabled: true
  retain: true

availability:
  enabled: true
  active:
    timeout: 10

mqtt:
  server: mqtt://mosquitto:1883
  user: homeassistant
  password: 7200Grindsted!
  base_topic: zigbee2mqtt  # ÆNDRES per område

serial:
  adapter: ember
  port: tcp://192.168.0.254:6638  # ÆNDRES per coordinator

frontend:
  enabled: true
  port: 8080

devices:
  '0xdc8e95fffe93c5e2':
    friendly_name: '212,2'
  '0xdc8e95fffe93c2f7':
    friendly_name: F44
  # ... alle målere med IEEE → navn
```

### Vigtige indstillinger

| Indstilling | Formål |
|-------------|--------|
| `base_topic` | Unik per område for at undgå konflikter |
| `serial.port` | TCP forbindelse til coordinator |
| `serial.adapter` | `ember` for SLZB-06M |
| `availability.timeout` | Sekunder før device markeres offline |

---

## 🔌 SLZB-06M COORDINATORS

### Hardware specifikationer
- **Chip:** EFR32MG21 (Silicon Labs)
- **Protokol:** Zigbee 3.0
- **Forbindelse:** Ethernet (TCP/IP)
- **Firmware:** Zigbee2MQTT kompatibel

### Coordinator IP-adresser
| Område | IP | Gateway |
|--------|-----|---------|
| 1 | 192.168.0.254 | 192.168.0.1 |
| 2 | 192.168.1.35 | 192.168.1.1 |
| 3 | 192.168.1.36 | 192.168.1.1 |
| 4 | 192.168.1.37 | 192.168.1.1 |
| 5 | 192.168.1.38 | 192.168.1.1 |
| 3-fase | 192.168.1.39 | 192.168.1.1 |

### Konfigurer coordinator IP
1. Find coordinator på netværket (DHCP først)
2. Tilgå web interface: `http://COORDINATOR_IP`
3. Sæt statisk IP under Network settings
4. Genstart coordinator

---

## 📊 MÅLER HARDWARE

### TS011F Specifikationer
| Parameter | Værdi |
|-----------|-------|
| **Model** | Tuya TS011F |
| **Protokol** | Zigbee 3.0 |
| **Max load** | 16A / 3680W |
| **Måling** | Voltage, Current, Power, Energy |
| **Rapportering** | Hver 5-10 sekunder |

### Tilgængelige værdier
```json
{
  "state": "ON/OFF",
  "energy": 123.45,      // kWh (total forbrug)
  "power": 150.2,        // W (øjeblikkelig effekt)
  "voltage": 230.1,      // V
  "current": 0.65,       // A
  "linkquality": 120     // 0-255 (signal styrke)
}
```

---

## 🔧 FEJLSØGNING

### Måler viser offline

1. **Tjek i Zigbee2MQTT UI:**
   - `last_seen` - hvornår sidst set?
   - `linkquality` - signal styrke?

2. **Prøv at reconfigure:**
   - Klik på måler → Reconfigure

3. **Genpar måler:**
   - Sæt Z2M i permit join mode
   - Tryk 5x på målerens knap
   - Vent på parring

### Ingen MQTT beskeder

```bash
# Tjek om Zigbee2MQTT er connected til MQTT
sudo docker logs --tail 50 zigbee2mqtt | grep -i mqtt

# Forventet: "Connected to MQTT server"
```

### Coordinator ikke tilgængelig

```bash
# Ping coordinator
ping 192.168.0.254

# Tjek Z2M logs
sudo docker logs --tail 50 zigbee2mqtt | grep -i error
```

---

## 📝 TILFØJ NY MÅLER

### Trin 1: Sæt Zigbee2MQTT i permit join mode
- Åbn Web UI (http://192.168.9.61:808X)
- Klik "Permit join (All)"

### Trin 2: Par måler
- Tryk og hold knappen på måleren i 5 sekunder
- Eller tryk 5x hurtigt
- Vent på at den dukker op i Z2M

### Trin 3: Omdøb måler
- Klik på den nye device
- Ændre "Friendly name" til pladsnummer
- Klik "Rename device"

### Trin 4: Bekræft
- Måleren synkroniseres automatisk til Supabase via device-sync
- Tjek `power_meters` tabellen

---

## 🔄 GENSTART SERVICES

```bash
ssh jc@192.168.9.61

# Genstart alle Zigbee2MQTT instanser
sudo docker restart zigbee2mqtt zigbee2mqtt_area2 zigbee2mqtt_area3 zigbee2mqtt_area4 zigbee2mqtt_area5 zigbee2mqtt_3p

# Genstart MQTT broker
sudo docker restart mosquitto

# Genstart data pipeline
sudo docker restart telegraf device-sync command-processor
```
