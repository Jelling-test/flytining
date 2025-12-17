# 🌐 OPSÆT NYT ZIGBEE OMRÅDE

**Opdateret:** 16. december 2025

---

## 📋 FORUDSÆTNINGER

- SLZB-06M coordinator (eller tilsvarende)
- Netværksforbindelse til NAS
- Statisk IP til coordinator
- SSH adgang til NAS

---

## 🔧 TRIN FOR TRIN

### Trin 1: Konfigurer Coordinator Hardware

1. **Tilslut coordinator** til netværk via ethernet
2. **Find IP** via router DHCP liste eller scan:
   ```bash
   nmap -sP 192.168.1.0/24 | grep -i slzb
   ```
3. **Åbn web interface:** `http://COORDINATOR_IP`
4. **Sæt statisk IP:** Network Settings → Static IP
5. **Genstart coordinator**

### Trin 2: Opret Docker Mappe

```bash
ssh jc@192.168.9.61
cd /volume1/docker/jelling-power-system

# Opret ny data mappe
mkdir -p zigbee2mqtt_area6/data
```

### Trin 3: Opret configuration.yaml

```bash
cat > zigbee2mqtt_area6/data/configuration.yaml << 'EOF'
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
  base_topic: zigbee2mqtt_area6

serial:
  adapter: ember
  port: tcp://192.168.1.XX:6638

advanced:
  transmit_power: 20
  last_seen: ISO_8601
  log_level: info

frontend:
  enabled: true
  port: 8080
  title: "Område 600"

version: 4
devices: {}
EOF
```

**VIGTIGT:** Erstat `192.168.1.XX` med coordinator IP!

### Trin 4: Tilføj til docker-compose.yml

Tilføj ny service i `docker-compose.yml`:

```yaml
  zigbee2mqtt_area6:
    container_name: zigbee2mqtt_area6
    image: koenkk/zigbee2mqtt
    restart: unless-stopped
    volumes:
      - ./zigbee2mqtt_area6/data:/app/data
    ports:
      - "8087:8080"
    environment:
      - TZ=Europe/Copenhagen
    depends_on:
      - mosquitto
```

### Trin 5: Start Container

```bash
cd /volume1/docker/jelling-power-system
sudo docker compose up -d zigbee2mqtt_area6

# Tjek logs
sudo docker logs -f zigbee2mqtt_area6
```

### Trin 6: Verificer

1. **Åbn Web UI:** http://192.168.9.61:8087
2. **Tjek MQTT forbindelse:** "Connected to MQTT"
3. **Tjek coordinator:** Coordinator vises i devices

### Trin 7: Opdater Telegraf Config

Tilføj nyt topic i `telegraf/telegraf.conf`:

```toml
[[inputs.mqtt_consumer]]
  servers = ["tcp://mosquitto:1883"]
  topics = [
    "zigbee2mqtt/+",
    "zigbee2mqtt_area2/+",
    "zigbee2mqtt_area3/+",
    "zigbee2mqtt_area4/+",
    "zigbee2mqtt_area5/+",
    "zigbee2mqtt_area6/+",  # NY!
    "zigbee2mqtt_3p/+"
  ]
  username = "homeassistant"
  password = "7200Grindsted!"
  data_format = "json"
```

Genstart Telegraf:
```bash
sudo docker restart telegraf
```

### Trin 8: Opdater device-sync

Tilføj nyt område i `device-sync/device_sync.py`:

```python
Z2M_INSTANCES = [
    {"base_topic": "zigbee2mqtt", "name": "Område 1"},
    {"base_topic": "zigbee2mqtt_area2", "name": "Område 2"},
    {"base_topic": "zigbee2mqtt_area3", "name": "Område 3"},
    {"base_topic": "zigbee2mqtt_area4", "name": "Område 4"},
    {"base_topic": "zigbee2mqtt_area5", "name": "Område 5"},
    {"base_topic": "zigbee2mqtt_area6", "name": "Område 6"},  # NY!
    {"base_topic": "zigbee2mqtt_3p", "name": "3-fase"},
]
```

Genstart device-sync:
```bash
sudo docker restart device-sync
```

---

## ✅ VERIFIKATION TJEKLISTE

- [ ] Coordinator har statisk IP
- [ ] Zigbee2MQTT container kører
- [ ] Web UI er tilgængeligt
- [ ] MQTT forbindelse OK
- [ ] Coordinator vises i devices
- [ ] Telegraf modtager data fra nyt topic
- [ ] device-sync synkroniserer nye målere

---

## 🔧 FEJLSØGNING

### Container starter ikke

```bash
sudo docker logs zigbee2mqtt_area6
```

**Almindelige fejl:**
- `ECONNREFUSED` → Forkert coordinator IP
- `No adapter found` → Forkert adapter type
- `MQTT connection failed` → MQTT credentials forkerte

### Coordinator ikke tilgængelig

```bash
# Ping coordinator
ping 192.168.1.XX

# Tjek port 6638
nc -zv 192.168.1.XX 6638
```

### Data kommer ikke i database

1. Tjek MQTT beskeder:
```bash
sudo docker exec -it mosquitto mosquitto_sub -t 'zigbee2mqtt_area6/#' -u homeassistant -P '7200Grindsted!' -v -C 5
```

2. Tjek Telegraf logs:
```bash
sudo docker logs --tail 50 telegraf | grep area6
```

---

## 📊 PORT OVERSIGT

| Område | Container | Web Port | Base Topic |
|--------|-----------|----------|------------|
| 1 | zigbee2mqtt | 8082 | zigbee2mqtt |
| 2 | zigbee2mqtt_area2 | 8083 | zigbee2mqtt_area2 |
| 3 | zigbee2mqtt_area3 | 8084 | zigbee2mqtt_area3 |
| 4 | zigbee2mqtt_area4 | 8085 | zigbee2mqtt_area4 |
| 5 | zigbee2mqtt_area5 | 8086 | zigbee2mqtt_area5 |
| 6 | zigbee2mqtt_area6 | 8087 | zigbee2mqtt_area6 |
| 3p | zigbee2mqtt_3p | 8088 | zigbee2mqtt_3p |
