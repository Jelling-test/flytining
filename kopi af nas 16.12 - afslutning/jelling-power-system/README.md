# Jelling Power System v2.0

Komplet strømstyringssystem til Jelling Camping med 300+ målere.

## Oversigt

| Service | Port | Beskrivelse |
|---------|------|-------------|
| mosquitto | 1890 | MQTT Broker |
| zigbee2mqtt | 8082 | Zigbee Area 1 |
| zigbee2mqtt_area2 | 8083 | Zigbee Area 2 |
| zigbee2mqtt_area3 | 8084 | Zigbee Area 3 |
| zigbee2mqtt_area4 | 8085 | Zigbee Area 4 (venter) |
| zigbee2mqtt_area5 | 8086 | Zigbee Area 5 (venter) |
| zigbee2mqtt_area6 | 8087 | Zigbee Area 6 (venter) |
| zigbee2mqtt_3p | 8088 | 3-fase målere |
| mqtt-config-service | 3001 | Måler opsætning |
| power-monitor-frontend | 3002 | Power Monitor UI |
| power-monitor-backend | 3010 | Power Monitor API |
| homeassistant | 8124 | Home Assistant |

## Hurtig Start

```bash
# 1. Kopier projektet til NAS
scp -r jelling-power-system jc@192.168.9.61:/volume1/docker/

# 2. SSH til NAS
ssh jc@192.168.9.61

# 3. Start systemet
cd /volume1/docker/jelling-power-system
sudo docker-compose up -d

# 4. Tjek status
sudo docker-compose ps
```

## Start Area 4-6 (når antenner er monteret)

```bash
sudo docker-compose --profile future up -d zigbee2mqtt_area4
sudo docker-compose --profile future up -d zigbee2mqtt_area5
sudo docker-compose --profile future up -d zigbee2mqtt_area6
```

## Logs

```bash
# Alle logs
sudo docker-compose logs -f

# Specifik service
sudo docker-compose logs -f device-sync
sudo docker-compose logs -f mosquitto
```

## Genstart

```bash
# Genstart en service
sudo docker-compose restart device-sync

# Genstart hele systemet
sudo docker-compose down && sudo docker-compose up -d
```

## Zigbee Controller IP'er

| Controller | IP | Port |
|------------|-----|------|
| Area 1 | 192.168.0.254 | 6638 |
| Area 2 | 192.168.1.35 | 6638 |
| Area 3 | 192.168.1.9 | 6638 |
| Area 4 | 192.168.1.66 | 6638 |
| Area 5 | 192.168.0.95 | 6638 |
| Area 6 | 192.168.0.60 | 6638 |
| 3-fase | 192.168.0.242 | 6638 |

## Fejlfinding

### MQTT forbindelse fejler
```bash
# Tjek mosquitto logs
sudo docker-compose logs mosquitto

# Test forbindelse
mosquitto_sub -h 192.168.9.61 -p 1890 -u homeassistant -P "7200Grindsted!" -t "#" -C 1
```

### Zigbee2MQTT starter ikke
```bash
# Tjek logs
sudo docker-compose logs zigbee2mqtt

# Ofte årsag: Serial port ikke tilgængelig
# Tjek at coordinator IP'en er korrekt i configuration.yaml
```

### Device-sync virker ikke
```bash
# Tjek logs
sudo docker-compose logs device-sync

# Tjek health status
sudo docker-compose exec device-sync ps aux
```
