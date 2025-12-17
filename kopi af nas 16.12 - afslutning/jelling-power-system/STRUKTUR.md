# Projekt Struktur

```
jelling-power-system/
├── docker-compose.yml          # Hoved compose fil (alle services)
├── .env                        # Alle credentials og konfiguration
├── README.md                   # Dokumentation
├── MIGRATION_GUIDE.md          # Guide til migration fra gammelt system
├── STRUKTUR.md                 # Denne fil
│
├── mosquitto/                  # MQTT Broker
│   ├── config/
│   │   ├── mosquitto.conf
│   │   └── passwd
│   ├── data/                   # ← Kopieres fra gammelt system
│   └── log/
│
├── zigbee2mqtt/                # Area 1 - IP: 192.168.0.254
│   └── data/                   # ← Kopieres fra gammelt system
│       └── configuration.yaml
│
├── zigbee2mqtt_area2/          # Area 2 - IP: 192.168.1.35
│   └── data/
│
├── zigbee2mqtt_area3/          # Area 3 - IP: 192.168.1.9
│   └── data/
│
├── zigbee2mqtt_area4/          # Area 4 - IP: 192.168.1.66 (venter)
│   └── data/
│
├── zigbee2mqtt_area5/          # Area 5 - IP: 192.168.0.95 (venter)
│   └── data/
│
├── zigbee2mqtt_area6/          # Area 6 - IP: 192.168.0.60 (venter)
│   └── data/
│
├── zigbee2mqtt_3p/             # 3-fase - IP: 192.168.0.242
│   └── data/
│
├── device-sync/                # Synk til Supabase + Power Security
│   ├── Dockerfile
│   ├── requirements.txt
│   └── device_sync.py
│
├── command-processor/          # Håndterer tænd/sluk kommandoer
│   ├── Dockerfile
│   ├── requirements.txt
│   └── command_processor.py
│
├── telegraf/                   # Metrics til database
│   └── telegraf.conf
│
├── maaler-opsaetning/          # ← Kopieres fra gammelt system
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
│
├── power-monitor/              # ← Kopieres fra gammelt system
│   ├── backend/
│   └── frontend/
│
└── homeassistant/              # ← Kopieres fra gammelt system
    └── config/
```

## Hvad skal kopieres fra NAS

Disse mapper skal kopieres fra det gamle system (indeholder data/konfiguration):

1. `mosquitto/config/passwd` - Password fil (VIGTIG!)
2. `mosquitto/data/` - Persistent data
3. `zigbee2mqtt/data/` - Device pairing (VIGTIG!)
4. `zigbee2mqtt_area2/data/` - Device pairing
5. `zigbee2mqtt_area3/data/` - Device pairing
6. `zigbee2mqtt_area4/data/` - Device pairing
7. `zigbee2mqtt_area5/data/` - Device pairing
8. `zigbee2mqtt_area6/data/` - Device pairing
9. `zigbee2mqtt_3p/data/` - Device pairing
10. `homeassistant/config/` - HA konfiguration
11. `maaler-opsaetning/` - Hele mappen
12. `power-monitor/` - Backend og frontend

## Hvad er NYT i dette projekt

1. **Én docker-compose.yml** - Alt samlet
2. **Retry-logik** i device-sync og command-processor
3. **Healthchecks** på mosquitto
4. **Profiles** til area4-6 (starter ikke automatisk)
5. **Én telegraf** (ikke to)
6. **Korrekt depends_on** rækkefølge
