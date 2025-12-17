# 🔄 GENOPRETTELSE - Disaster Recovery

**Opdateret:** 16. december 2025

---

## ⚠️ HVAD ER SIKKERT I SKYEN?

Følgende data er **ALTID SIKKERT** i Supabase Cloud:

| Data | Tabel | Backup |
|------|-------|--------|
| ✅ Alle kunder | `regular_customers`, `seasonal_customers` | Automatisk |
| ✅ Alle bookings | `webhook_data` | Automatisk |
| ✅ Strømpakker | `plugin_data` | Automatisk |
| ✅ Måler-stamdata | `power_meters` | Automatisk |
| ✅ IEEE → Navn mapping | `meter_identity` | Automatisk |
| ✅ Al historik | `meter_readings_history` | Automatisk |
| ✅ Betalinger | Stripe Dashboard | Automatisk |

---

## 🔴 HVIS NAS GÅR NED

### Hvad skal genskabes?
1. Docker containers
2. Zigbee2MQTT configuration.yaml (parringer)
3. Mosquitto config

### Hvad er bevaret lokalt?
Backup mappe: `C:\...\flytning af system\kopi af nas 16.12 - afslutning\jelling-power-system`

Indeholder:
- Alle `configuration.yaml` filer med IEEE → navn parringer
- Alle `database.db` filer med coordinator parringer
- `docker-compose.yml`
- `.env` fil
- Mosquitto passwords

---

## 📋 GENOPRETNING TRIN FOR TRIN

### Trin 1: Installer Docker på ny server

**Synology:**
- Installer via Package Center → Docker

**Linux:**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Trin 2: Kopier backup til server

```bash
scp -r "jelling-power-system" jc@NY_SERVER_IP:/volume1/docker/
```

### Trin 3: Start services

```bash
ssh jc@NY_SERVER_IP
cd /volume1/docker/jelling-power-system
sudo docker compose up -d
```

### Trin 4: Verificer

```bash
# Tjek containers
sudo docker ps

# Tjek Zigbee2MQTT UI
# http://NY_SERVER_IP:8082

# Tjek MQTT
sudo docker exec -it mosquitto mosquitto_sub -t '#' -u homeassistant -P '7200Grindsted!' -v -C 5
```

### Trin 5: Opdater IP-adresser

Hvis serveren har ny IP, opdater:

1. **Telegraf config:** Supabase connection string
2. **Coordinators:** Zigbee2MQTT `serial.port` settings
3. **Supabase secrets:** Hvis MQTT endpoint er eksponeret

---

## 🔧 GENSKAB PARRINGER FRA SUPABASE

Hvis `configuration.yaml` er tabt, kan parringer hentes fra Supabase:

```sql
-- Hent alle parringer
SELECT ieee_address, meter_number, base_topic 
FROM meter_identity 
ORDER BY base_topic, meter_number;
```

Eksempel output:
```
ieee_address          | meter_number | base_topic
0xdc8e95fffe93c5e2   | 212,2       | zigbee2mqtt
0xdc8e95fffe93c2f7   | F44         | zigbee2mqtt
0xbc8d7efffe21ab04   | F42         | zigbee2mqtt
```

Konverter til `configuration.yaml` format:
```yaml
devices:
  '0xdc8e95fffe93c5e2':
    friendly_name: '212,2'
  '0xdc8e95fffe93c2f7':
    friendly_name: F44
  '0xbc8d7efffe21ab04':
    friendly_name: F42
```

---

## 📁 BACKUP STRUKTUR

```
jelling-power-system/
├── docker-compose.yml           # Container opsætning
├── .env                         # Environment variabler
├── mosquitto/
│   └── config/
│       ├── mosquitto.conf       # MQTT config
│       ├── passwd               # Passwords (hashed)
│       └── acl                  # Access control
├── zigbee2mqtt/data/
│   ├── configuration.yaml       # PARRINGER område 1
│   ├── database.db              # Coordinator parringer
│   └── coordinator_backup.json
├── zigbee2mqtt_area2/data/
│   └── ...                      # PARRINGER område 2
├── zigbee2mqtt_area3/data/
│   └── ...                      # PARRINGER område 3
├── zigbee2mqtt_area4/data/
│   └── ...                      # PARRINGER område 4
├── zigbee2mqtt_area5/data/
│   └── ...                      # PARRINGER område 5
├── zigbee2mqtt_3p/data/
│   └── ...                      # PARRINGER 3-fase
├── telegraf/
│   └── telegraf.conf            # Data pipeline config
└── device-sync/
    └── device_sync.py           # Sync script
```

---

## 🔄 BACKUP RUTINE

### Dagligt (automatisk via Supabase)
- `meter_identity` snapshot (IEEE → Navn)
- `meter_readings_history` snapshot

### Ugentligt (manuelt anbefalet)
1. SSH til NAS
2. Kopier `configuration.yaml` filer
3. Gem på ekstern lokation

```bash
# Backup kommando
ssh jc@192.168.9.61 "tar -czf /volume1/backup/z2m-config-$(date +%Y%m%d).tar.gz /volume1/docker/jelling-power-system/zigbee2mqtt*/data/configuration.yaml"
```

---

## ⚡ HURTIG GENSTART EFTER STRØMSVIGT

Hvis NAS genstarter efter strømsvigt:

```bash
ssh jc@192.168.9.61

# Tjek om containers startede
sudo docker ps

# Hvis ikke, start manuelt
cd /volume1/docker/jelling-power-system
sudo docker compose up -d

# Vent på Zigbee netværk stabiliserer (2-5 min)
sleep 120

# Verificer data flow
sudo docker exec -it mosquitto mosquitto_sub -t 'zigbee2mqtt/#' -u homeassistant -P '7200Grindsted!' -v -C 5
```

---

## 📞 NØDKONTAKTER

| Problem | Kontakt |
|---------|---------|
| **Supabase nede** | https://status.supabase.com |
| **Stripe problemer** | https://status.stripe.com |
| **Vercel deploy fejl** | https://vercel-status.com |
| **Hardware svigt** | Lokal IT support |
