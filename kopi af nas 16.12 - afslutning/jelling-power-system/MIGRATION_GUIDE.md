# Migration Guide: Fra Gammelt til Nyt System

## Før Migration

### 1. Tag backup af alt på NAS
```bash
ssh jc@192.168.9.61
cd /volume1/docker
sudo tar -czvf backup-$(date +%Y%m%d).tar.gz .
```

### 2. Stop alle eksisterende containere
```bash
# Stop alle containere
sudo docker stop $(sudo docker ps -q)

# Verificer
sudo docker ps
```

## Migration

### 3. Kopier zigbee2mqtt data (VIGTIG - beholder pairing!)
```bash
# Kopier fra gammel til ny mappe
sudo cp -r /volume1/docker/zigbee2mqtt/data /volume1/docker/jelling-power-system/zigbee2mqtt/
sudo cp -r /volume1/docker/zigbee2mqtt_area2/data /volume1/docker/jelling-power-system/zigbee2mqtt_area2/
sudo cp -r /volume1/docker/zigbee2mqtt_area3/data /volume1/docker/jelling-power-system/zigbee2mqtt_area3/
sudo cp -r /volume1/docker/zigbee2mqtt_area4/data /volume1/docker/jelling-power-system/zigbee2mqtt_area4/
sudo cp -r /volume1/docker/zigbee2mqtt_area5/data /volume1/docker/jelling-power-system/zigbee2mqtt_area5/
sudo cp -r /volume1/docker/zigbee2mqtt_area6/data /volume1/docker/jelling-power-system/zigbee2mqtt_area6/
sudo cp -r /volume1/docker/zigbee2mqtt_3p/data /volume1/docker/jelling-power-system/zigbee2mqtt_3p/
```

### 4. Kopier mosquitto data
```bash
sudo cp -r /volume1/docker/mosquitto/config /volume1/docker/jelling-power-system/mosquitto/
sudo cp -r /volume1/docker/mosquitto/data /volume1/docker/jelling-power-system/mosquitto/
sudo cp -r /volume1/docker/mosquitto/log /volume1/docker/jelling-power-system/mosquitto/
```

### 5. Kopier homeassistant config
```bash
sudo cp -r /volume1/docker/homeassistant/config /volume1/docker/jelling-power-system/homeassistant/
```

### 6. Kopier maaler-opsaetning
```bash
sudo cp -r /volume1/docker/maaler\ opsaetning/* /volume1/docker/jelling-power-system/maaler-opsaetning/
```

### 7. Kopier power-monitor
```bash
sudo cp -r /volume1/docker/watch/nas-web-host-main/monitor-backend /volume1/docker/jelling-power-system/power-monitor/backend
sudo cp -r /volume1/docker/watch/nas-web-host-main/* /volume1/docker/jelling-power-system/power-monitor/frontend
```

## Start Nyt System

### 8. Start det nye system
```bash
cd /volume1/docker/jelling-power-system
sudo docker-compose up -d
```

### 9. Verificer
```bash
# Tjek alle containere kører
sudo docker-compose ps

# Tjek logs for fejl
sudo docker-compose logs --tail 50
```

## Rollback (hvis noget går galt)

```bash
# Stop nyt system
cd /volume1/docker/jelling-power-system
sudo docker-compose down

# Start gammelt system
cd /volume1/docker/jelling-iot
sudo docker-compose up -d
```

## Hvad der er ændret

| Gammelt | Nyt |
|---------|-----|
| Flere docker-compose filer | Én samlet docker-compose.yml |
| Ingen depends_on | Korrekt afhængigheder |
| Ingen healthchecks | Mosquitto healthcheck |
| telegraf + telegraf-v2 | Kun én telegraf |
| device-sync uden retry | device-sync MED retry |
| Area 4-6 restart: unless-stopped | Area 4-6 profiles: future |

## Efter Migration

1. ✅ Test at målere kan tændes/slukkes fra UI
2. ✅ Test at Power Security virker (manuel tænding bliver slukket)
3. ✅ Test at data kommer ind i Supabase
4. ✅ Slet gamle containere og images
