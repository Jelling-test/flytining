#!/bin/bash
# =============================================================================
# ZIGBEE PAIRING BACKUP SCRIPT
# =============================================================================
# Backup af alle zigbee2mqtt configuration.yaml filer til Dropbox
# Kør dagligt via Synology Task Scheduler
#
# SETUP:
# 1. Installer Cloud Sync i Synology
# 2. Opret forbindelse til Dropbox
# 3. Vælg en lokal mappe til sync (fx /volume1/backup-dropbox)
# 4. Opret Task i Task Scheduler der kører dette script kl 02:00
# =============================================================================

# Konfiguration
BACKUP_DIR="/volume1/docker/backup-dropbox/jelling-zigbee-backup"
SOURCE_DIR="/volume1/docker/jelling-power-system"
DATE=$(date +%Y-%m-%d)
BACKUP_NAME="zigbee-pairing-$DATE"

# Opret backup mappe
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

echo "$(date): Starting Zigbee pairing backup..."

# Backup alle zigbee2mqtt data mapper
for area in "" "_area2" "_area3" "_area4" "_area5" "_area6" "_3p"; do
    SOURCE="$SOURCE_DIR/zigbee2mqtt${area}/data"
    DEST="$BACKUP_DIR/$BACKUP_NAME/zigbee2mqtt${area}"
    
    if [ -d "$SOURCE" ]; then
        mkdir -p "$DEST"
        # Kopier kun vigtige filer (ikke logs)
        cp "$SOURCE/configuration.yaml" "$DEST/" 2>/dev/null || true
        cp "$SOURCE/coordinator_backup.json" "$DEST/" 2>/dev/null || true
        cp "$SOURCE/database.db" "$DEST/" 2>/dev/null || true
        cp "$SOURCE/state.json" "$DEST/" 2>/dev/null || true
        echo "  ✓ Backed up: zigbee2mqtt${area}"
    fi
done

# Backup .env fil (credentials)
cp "$SOURCE_DIR/.env" "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true

# Backup docker-compose
cp "$SOURCE_DIR/docker-compose.yml" "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true

# Backup Home Assistant config
if [ -d "$SOURCE_DIR/homeassistant/config" ]; then
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME/homeassistant"
    cp -r "$SOURCE_DIR/homeassistant/config" "$BACKUP_DIR/$BACKUP_NAME/homeassistant/" 2>/dev/null || true
    echo "  ✓ Backed up: homeassistant/config"
fi

# Lav en samlet zip fil
cd "$BACKUP_DIR"
tar -czf "$BACKUP_NAME.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# Slet backups ældre end 30 dage
find "$BACKUP_DIR" -name "zigbee-pairing-*.tar.gz" -mtime +30 -delete

echo "$(date): Backup complete: $BACKUP_DIR/$BACKUP_NAME.tar.gz"

# Log til fil
echo "$(date): Backup completed - $BACKUP_NAME.tar.gz" >> "$BACKUP_DIR/backup.log"
