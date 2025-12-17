# 🐳 KOMPLET DOCKER COMPOSE

**Opdateret:** 16. december 2025

---

## 📋 OVERSIGT

Komplet docker-compose.yml til NAS (Synology DS224+).

**Placering:** `/volume1/docker/jelling-power-system/docker-compose.yml`

---

## 📄 docker-compose.yml

```yaml
# =============================================================================
# JELLING POWER SYSTEM - KOMPLET DOCKER COMPOSE
# =============================================================================
# Version: 2.0
# 
# BRUG:
# - Start alle: docker-compose up -d
# - Stop alle: docker-compose down
# - Se logs: docker-compose logs -f [service]
# - Genstart: docker-compose restart [service]
# =============================================================================

version: '3.9'
name: jelling-power

# =============================================================================
# NETVÆRK
# =============================================================================
networks:
  jelling-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

# =============================================================================
# SERVICES
# =============================================================================
services:

  # ---------------------------------------------------------------------------
  # NIVEAU 1: MQTT BROKER
  # ---------------------------------------------------------------------------
  
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: mosquitto
    restart: unless-stopped
    ports:
      - "192.168.9.61:1890:1883"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - ./mosquitto/data:/mosquitto/data
      - ./mosquitto/log:/mosquitto/log
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # NIVEAU 2: ZIGBEE2MQTT INSTANSER
  # ---------------------------------------------------------------------------

  zigbee2mqtt:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8082:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt/data:/app/data
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  zigbee2mqtt_area2:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt_area2
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8083:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt_area2/data:/app/data
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  zigbee2mqtt_area3:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt_area3
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8084:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt_area3/data:/app/data
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  zigbee2mqtt_area4:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt_area4
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8085:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt_area4/data:/app/data
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  zigbee2mqtt_area5:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt_area5
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8086:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt_area5/data:/app/data
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  zigbee2mqtt_area6:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt_area6
    profiles: ["future"]  # Starter IKKE automatisk
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8087:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt_area6/data:/app/data
    networks:
      - jelling-net

  zigbee2mqtt_3p:
    image: koenkk/zigbee2mqtt:latest
    container_name: zigbee2mqtt_3p
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8088:8080"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./zigbee2mqtt_3p/data:/app/data
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # NIVEAU 3: DATA SERVICES
  # ---------------------------------------------------------------------------

  device-sync:
    build: ./device-sync
    container_name: device-sync
    restart: unless-stopped
    depends_on:
      - mosquitto
    env_file:
      - .env
    environment:
      - TZ=Europe/Copenhagen
      - ENABLE_POWER_SECURITY=true
    networks:
      - jelling-net
    extra_hosts:
      - "host.docker.internal:host-gateway"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  mqtt-command-processor:
    build: ./command-processor
    container_name: mqtt-command-processor
    restart: unless-stopped
    depends_on:
      - mosquitto
    env_file:
      - .env
    environment:
      - TZ=Europe/Copenhagen
    networks:
      - jelling-net
    extra_hosts:
      - "host.docker.internal:host-gateway"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  telegraf:
    image: telegraf:1.30
    container_name: telegraf
    restart: unless-stopped
    depends_on:
      - mosquitto
    volumes:
      - ./telegraf/telegraf.conf:/etc/telegraf/telegraf.conf:ro
    networks:
      - jelling-net
    extra_hosts:
      - "host.docker.internal:host-gateway"
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # NIVEAU 4: APPLICATION SERVICES
  # ---------------------------------------------------------------------------

  mqtt-config-service:
    build: ./maaler-opsaetning
    container_name: mqtt-config-service
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - TZ=Europe/Copenhagen
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # ---------------------------------------------------------------------------
  # NIVEAU 5: HOME ASSISTANT (valgfri - kun til statistik)
  # ---------------------------------------------------------------------------

  homeassistant:
    image: ghcr.io/home-assistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "192.168.9.61:8124:8123"
    environment:
      - TZ=Europe/Copenhagen
    volumes:
      - ./homeassistant/config:/config
    networks:
      - jelling-net
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 📄 .env fil

```env
# MQTT
MQTT_HOST=mosquitto
MQTT_PORT=1883
MQTT_USER=homeassistant
MQTT_PASS=7200Grindsted!

# SUPABASE
SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# TELEGRAF
INFLUX_TOKEN=your-influx-token
```

---

## 📄 mosquitto/config/mosquitto.conf

```conf
listener 1883
protocol mqtt

allow_anonymous false
password_file /mosquitto/config/passwd

persistence true
persistence_location /mosquitto/data/

log_dest file /mosquitto/log/mosquitto.log
log_dest stdout
```

---

## 📄 telegraf/telegraf.conf

```toml
[agent]
  interval = "10s"
  round_interval = true
  metric_batch_size = 1000
  metric_buffer_limit = 10000
  collection_jitter = "0s"
  flush_interval = "10s"
  flush_jitter = "0s"
  precision = ""
  hostname = ""
  omit_hostname = false

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
  
  # Parse JSON fields
  json_string_fields = ["state"]
  
  # Tag with meter_id from topic
  [[inputs.mqtt_consumer.topic_parsing]]
    topic = "+/+"
    measurement = "meter_readings"
    tags = "_/meter_id"

[[outputs.postgresql]]
  connection = "postgres://postgres:PASSWORD@db.jkmqliztlhmfyejhmuil.supabase.co:5432/postgres"
  
  table_template = "meter_readings"
  
  create_table_template = '''
    CREATE TABLE IF NOT EXISTS {{.Table}} (
      id UUID DEFAULT gen_random_uuid(),
      time TIMESTAMPTZ DEFAULT NOW(),
      meter_id TEXT,
      energy DOUBLE PRECISION,
      power DOUBLE PRECISION,
      voltage DOUBLE PRECISION,
      current DOUBLE PRECISION,
      state TEXT,
      linkquality INTEGER
    )
  '''
  
  fields_as_columns = ["energy", "power", "voltage", "current", "state", "linkquality"]
  tags_as_columns = ["meter_id"]
```

---

## 📁 MAPPESTRUKTUR

```
/volume1/docker/jelling-power-system/
├── docker-compose.yml
├── .env
│
├── mosquitto/
│   ├── config/
│   │   ├── mosquitto.conf
│   │   └── passwd
│   ├── data/
│   └── log/
│
├── zigbee2mqtt/data/
│   ├── configuration.yaml
│   ├── database.db
│   └── state.json
│
├── zigbee2mqtt_area2/data/
├── zigbee2mqtt_area3/data/
├── zigbee2mqtt_area4/data/
├── zigbee2mqtt_area5/data/
├── zigbee2mqtt_area6/data/
├── zigbee2mqtt_3p/data/
│
├── telegraf/
│   └── telegraf.conf
│
├── device-sync/
│   ├── Dockerfile
│   ├── device_sync.py
│   └── requirements.txt
│
├── command-processor/
│   ├── Dockerfile
│   ├── command_processor.py
│   └── requirements.txt
│
├── maaler-opsaetning/
│   ├── Dockerfile
│   ├── server.js
│   └── package.json
│
└── homeassistant/config/
    └── configuration.yaml
```

---

## 🔧 KOMMANDOER

```bash
# SSH til NAS
ssh jc@192.168.9.61
cd /volume1/docker/jelling-power-system

# Start alle services
sudo docker compose up -d

# Stop alle services
sudo docker compose down

# Genstart specifik service
sudo docker compose restart zigbee2mqtt

# Se logs
sudo docker compose logs -f mosquitto
sudo docker compose logs --tail 50 device-sync

# Rebuild service efter kodeændring
sudo docker compose build device-sync
sudo docker compose up -d device-sync

# Se kørende containers
sudo docker ps

# Ryd op i gamle images
sudo docker system prune -a
```
