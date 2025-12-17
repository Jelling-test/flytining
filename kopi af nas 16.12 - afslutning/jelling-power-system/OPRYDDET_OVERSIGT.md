# NAS Backup - Opryddet 16. december 2025

## ✅ Denne mappe er klar til genopbygning af systemet

Alle parringer (IEEE → friendly_name) er bevaret i `database.db` og `configuration.yaml` filerne.

---

## Mappestruktur efter oprydning

```
jelling-power-system/
├── .env                          # Environment variabler (MQTT credentials osv.)
├── docker-compose.yml            # Hovedfil til alle containers
├── README.md                     # Dokumentation
├── STRUKTUR.md                   # Systemstruktur
├── MIGRATION_GUIDE.md            # Migreringsguide
├── backup-pairing.sh             # Script til backup af parringer
├── migrate.sh                    # Migreringsscript
├── rollback.sh                   # Rollback script
│
├── zigbee2mqtt/data/             # OMRÅDE 100 (hovedinstans)
│   ├── configuration.yaml        # Config + PARRINGER (friendly_name)
│   ├── database.db               # Device parringer til coordinator
│   ├── coordinator_backup.json   # Coordinator backup
│   └── state.json                # Device states
│
├── zigbee2mqtt_area2/data/       # OMRÅDE 200
│   └── (samme struktur)
│
├── zigbee2mqtt_area3/data/       # OMRÅDE 300
│   └── (samme struktur)
│
├── zigbee2mqtt_area4/data/       # OMRÅDE 400
│   └── (samme struktur)
│
├── zigbee2mqtt_area5/data/       # OMRÅDE 500
│   └── (samme struktur)
│
├── zigbee2mqtt_area6/data/       # OMRÅDE 600 (tom/ny)
│   └── configuration.yaml
│
├── zigbee2mqtt_3p/data/          # 3-FASET målere
│   ├── configuration.yaml
│   ├── database.db
│   ├── coordinator_backup.json
│   ├── state.json
│   └── external_converters/      # Custom converters
│
├── mosquitto/config/             # MQTT Broker
│   ├── mosquitto.conf            # Config
│   ├── passwd                    # Passwords (hashed)
│   ├── passwords                 # Passwords backup
│   └── acl                       # Access control
│
├── homeassistant/config/         # Home Assistant (langtidsstatistik)
│   ├── configuration.yaml        # HA config
│   ├── .HA_VERSION
│   ├── automations.yaml
│   ├── scenes.yaml
│   └── scripts.yaml
│
├── telegraf/                     # Telegraf (metrics)
│   └── telegraf.conf
│
├── device-sync/                  # Device sync service
│   ├── device_sync.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── command-processor/            # Command processor service
│   ├── command_processor.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── maaler-opsaetning/            # Måler opsætnings UI
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── README.md
│
└── power-monitor/                # Power monitor service
    └── backend/
        ├── server.js
        ├── config.json
        ├── package.json
        └── Dockerfile
```

---

## Genopbygning på ny server

### 1. Kopier mappen til ny server
```bash
scp -r jelling-power-system/ jc@<ny-server-ip>:/path/to/destination/
```

### 2. Start alle services
```bash
cd jelling-power-system
docker-compose up -d
```

### 3. Verificer parringer
Åbn Zigbee2MQTT UI og tjek at alle målere har deres korrekte navne.

---

## VIGTIG INFO

**Parringer bevaret i disse filer:**
- `zigbee2mqtt/data/configuration.yaml` - 80 devices
- `zigbee2mqtt_area2/data/configuration.yaml` - ~40 devices
- `zigbee2mqtt_area3/data/configuration.yaml` - ~80 devices
- `zigbee2mqtt_area4/data/configuration.yaml` - ~60 devices
- `zigbee2mqtt_area5/data/configuration.yaml` - ~100 devices
- `zigbee2mqtt_3p/data/configuration.yaml` - 3-faset målere

**Total: ~360+ målere med navne bevaret**

---

## Slettet ved oprydning

- ❌ Gamle versioner af filer (`.slet`, `.backup`, `.uvirksom` osv.)
- ❌ Log filer (alle `log/` mapper)
- ❌ Home Assistant database (731 MB - genopbygges automatisk)
- ❌ Mosquitto database (genopbygges automatisk)
- ❌ Migration logs
- ❌ Tomme/ubrugte backups
