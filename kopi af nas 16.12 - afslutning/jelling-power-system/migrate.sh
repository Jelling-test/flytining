#!/bin/bash
# =============================================================================
# JELLING POWER SYSTEM - MIGRATIONS SCRIPT
# =============================================================================
# Kør dette script på NAS'en for at migrere fra gammelt til nyt system
#
# BRUG:
#   1. Kopier jelling-power-system mappen til /volume1/docker/
#   2. SSH til NAS: ssh jc@192.168.9.61
#   3. Kør: sudo bash /volume1/docker/jelling-power-system/migrate.sh
# =============================================================================

set -e  # Stop ved fejl

# Farver til output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Paths
OLD_DOCKER="/volume1/docker"
NEW_SYSTEM="/volume1/docker/jelling-power-system"
BACKUP_DIR="/volume1/docker/backup-$(date +%Y%m%d-%H%M%S)"

echo -e "${GREEN}"
echo "============================================================================="
echo "  JELLING POWER SYSTEM - MIGRATION"
echo "============================================================================="
echo -e "${NC}"

# =============================================================================
# TRIN 1: Verificer at vi kører som root
# =============================================================================
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}FEJL: Kør dette script med sudo${NC}"
    echo "Brug: sudo bash $0"
    exit 1
fi

# =============================================================================
# TRIN 2: Verificer at ny mappe eksisterer
# =============================================================================
if [ ! -d "$NEW_SYSTEM" ]; then
    echo -e "${RED}FEJL: $NEW_SYSTEM eksisterer ikke${NC}"
    echo "Kopier først jelling-power-system til /volume1/docker/"
    exit 1
fi

echo -e "${YELLOW}Trin 1/7: Opretter backup...${NC}"
mkdir -p "$BACKUP_DIR"

# =============================================================================
# TRIN 3: Backup af gamle containere (kun navne)
# =============================================================================
docker ps -a --format '{{.Names}}' > "$BACKUP_DIR/container-list.txt"
echo "  ✓ Container liste gemt"

# =============================================================================
# TRIN 4: Stop alle gamle containere
# =============================================================================
echo -e "${YELLOW}Trin 2/7: Stopper gamle containere...${NC}"

CONTAINERS_TO_STOP=(
    "mosquitto"
    "zigbee2mqtt"
    "zigbee2mqtt_area2"
    "zigbee2mqtt_area3"
    "zigbee2mqtt_area4"
    "zigbee2mqtt_area5"
    "zigbee2mqtt_area6"
    "zigbee2mqtt_3p"
    "device-sync"
    "mqtt-command-processor"
    "mqtt-config-service"
    "telegraf"
    "telegraf-v2"
    "power-monitor-backend"
    "power-monitor-frontend"
    "power-hub-frontend"
    "homeassistant"
)

for container in "${CONTAINERS_TO_STOP[@]}"; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        docker stop "$container" 2>/dev/null || true
        echo "  ✓ Stoppet: $container"
    fi
done

# =============================================================================
# TRIN 5: Kopier data fra gamle mapper
# =============================================================================
echo -e "${YELLOW}Trin 3/7: Kopierer zigbee2mqtt data (beholder pairing)...${NC}"

# Zigbee2mqtt data mapper
for area in "" "_area2" "_area3" "_area4" "_area5" "_area6" "_3p"; do
    OLD_PATH="$OLD_DOCKER/zigbee2mqtt${area}/data"
    NEW_PATH="$NEW_SYSTEM/zigbee2mqtt${area}/data"
    
    if [ -d "$OLD_PATH" ]; then
        mkdir -p "$NEW_PATH"
        cp -r "$OLD_PATH"/* "$NEW_PATH"/ 2>/dev/null || true
        echo "  ✓ Kopieret: zigbee2mqtt${area}/data"
    fi
done

echo -e "${YELLOW}Trin 4/7: Kopierer mosquitto data...${NC}"

# Mosquitto
if [ -d "$OLD_DOCKER/mosquitto" ]; then
    mkdir -p "$NEW_SYSTEM/mosquitto/config"
    mkdir -p "$NEW_SYSTEM/mosquitto/data"
    mkdir -p "$NEW_SYSTEM/mosquitto/log"
    
    cp -r "$OLD_DOCKER/mosquitto/config"/* "$NEW_SYSTEM/mosquitto/config"/ 2>/dev/null || true
    cp -r "$OLD_DOCKER/mosquitto/data"/* "$NEW_SYSTEM/mosquitto/data"/ 2>/dev/null || true
    echo "  ✓ Kopieret: mosquitto"
fi

echo -e "${YELLOW}Trin 5/7: Kopierer homeassistant config...${NC}"

# HomeAssistant
if [ -d "$OLD_DOCKER/homeassistant/config" ]; then
    mkdir -p "$NEW_SYSTEM/homeassistant/config"
    cp -r "$OLD_DOCKER/homeassistant/config"/* "$NEW_SYSTEM/homeassistant/config"/ 2>/dev/null || true
    echo "  ✓ Kopieret: homeassistant/config"
fi

echo -e "${YELLOW}Trin 6/7: Kopierer application services...${NC}"

# Maaler opsaetning
if [ -d "$OLD_DOCKER/maaler opsaetning" ]; then
    mkdir -p "$NEW_SYSTEM/maaler-opsaetning"
    cp -r "$OLD_DOCKER/maaler opsaetning"/* "$NEW_SYSTEM/maaler-opsaetning"/ 2>/dev/null || true
    echo "  ✓ Kopieret: maaler-opsaetning"
fi

# Power monitor
if [ -d "$OLD_DOCKER/watch/nas-web-host-main" ]; then
    mkdir -p "$NEW_SYSTEM/power-monitor/backend"
    mkdir -p "$NEW_SYSTEM/power-monitor/frontend"
    
    if [ -d "$OLD_DOCKER/watch/nas-web-host-main/monitor-backend" ]; then
        cp -r "$OLD_DOCKER/watch/nas-web-host-main/monitor-backend"/* "$NEW_SYSTEM/power-monitor/backend"/ 2>/dev/null || true
    fi
    
    # Frontend filer (undtagen monitor-backend)
    for item in "$OLD_DOCKER/watch/nas-web-host-main"/*; do
        if [ -f "$item" ]; then
            cp "$item" "$NEW_SYSTEM/power-monitor/frontend"/ 2>/dev/null || true
        elif [ -d "$item" ] && [ "$(basename "$item")" != "monitor-backend" ]; then
            cp -r "$item" "$NEW_SYSTEM/power-monitor/frontend"/ 2>/dev/null || true
        fi
    done
    echo "  ✓ Kopieret: power-monitor"
fi

# =============================================================================
# TRIN 6: Opret tomme mapper hvis de mangler
# =============================================================================
mkdir -p "$NEW_SYSTEM/mosquitto/log"
mkdir -p "$NEW_SYSTEM/mosquitto/data"

for area in "" "_area2" "_area3" "_area4" "_area5" "_area6" "_3p"; do
    mkdir -p "$NEW_SYSTEM/zigbee2mqtt${area}/data"
done

# =============================================================================
# TRIN 7: Start nyt system
# =============================================================================
echo -e "${YELLOW}Trin 7/7: Starter nyt system...${NC}"

cd "$NEW_SYSTEM"

# Build og start
docker-compose build --no-cache device-sync mqtt-command-processor 2>/dev/null || true
docker-compose up -d

echo ""
echo -e "${GREEN}=============================================================================${NC}"
echo -e "${GREEN}  MIGRATION FULDFØRT!${NC}"
echo -e "${GREEN}=============================================================================${NC}"
echo ""
echo "Tjek status med:"
echo "  cd $NEW_SYSTEM"
echo "  docker-compose ps"
echo ""
echo "Tjek logs med:"
echo "  docker-compose logs -f"
echo ""
echo "Backup gemt i: $BACKUP_DIR"
echo ""
echo -e "${YELLOW}HUSK: Area 4-6 er IKKE startet (mangler antenner)${NC}"
echo "Start dem senere med:"
echo "  docker-compose --profile future up -d zigbee2mqtt_area4"
echo ""
