#!/bin/bash
# =============================================================================
# JELLING POWER SYSTEM - ROLLBACK SCRIPT
# =============================================================================
# Brug dette script hvis migrationen går galt
# Det stopper det nye system og starter det gamle igen
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

NEW_SYSTEM="/volume1/docker/jelling-power-system"
OLD_DOCKER="/volume1/docker"

echo -e "${YELLOW}"
echo "============================================================================="
echo "  ROLLBACK - Tilbage til gammelt system"
echo "============================================================================="
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}FEJL: Kør dette script med sudo${NC}"
    exit 1
fi

# Stop nyt system
echo "Stopper nyt system..."
cd "$NEW_SYSTEM"
docker-compose down 2>/dev/null || true

# Start gammelt system
echo "Starter gammelt system..."

# Mosquitto først
cd "$OLD_DOCKER/jelling-iot" 2>/dev/null || cd "$OLD_DOCKER"
docker-compose up -d mosquitto 2>/dev/null || docker start mosquitto

sleep 5

# Zigbee2mqtt
docker-compose up -d zigbee2mqtt zigbee2mqtt_area2 2>/dev/null || true
docker start zigbee2mqtt zigbee2mqtt_area2 zigbee2mqtt_area3 2>/dev/null || true

# Andre services
docker start device-sync mqtt-command-processor telegraf telegraf-v2 2>/dev/null || true
docker start mqtt-config-service power-monitor-backend power-monitor-frontend 2>/dev/null || true
docker start homeassistant 2>/dev/null || true

echo ""
echo -e "${GREEN}Rollback fuldført!${NC}"
echo ""
echo "Tjek status:"
echo "  docker ps"
