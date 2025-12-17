#!/usr/bin/env python3
"""
Device Sync Service - Synkroniserer Zigbee2MQTT devices til Supabase
Med Power Security feature til at forhindre uautoriseret strømtænding.

Version: 2.3 (FIXED: bridge/devices no longer overwrites offline status)
"""

import os
import json
import time
import logging
from typing import Dict, Any, List, Tuple
from threading import Lock

import paho.mqtt.client as mqtt
from supabase import create_client, Client

# -------- Settings --------
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jkmqliztlhmfyejhmuil.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
MQTT_HOST = os.getenv("MQTT_HOST", "mosquitto")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_USER = os.getenv("MQTT_USER", "homeassistant")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")
BASE_TOPICS = [t.strip() for t in os.getenv(
    "BASE_TOPICS",
    "zigbee2mqtt,zigbee2mqtt_area2,zigbee2mqtt_area3,zigbee2mqtt_area4,zigbee2mqtt_area5,zigbee2mqtt_area6,zigbee2mqtt_3p"
).split(",") if t.strip()]
POLL_REDISCOVER_SEC = int(os.getenv("POLL_REDISCOVER_SEC", "300"))
IGNORE_NAMES = {s.strip().lower() for s in os.getenv("IGNORE_NAMES", "coordinator").split(",") if s.strip()}
ENABLE_POWER_SECURITY = os.getenv("ENABLE_POWER_SECURITY", "true").lower() == "true"
CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", "5"))  # Cache power check for 5 seconds

# -------- Logging --------
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
log = logging.getLogger("device-sync")

# -------- Supabase --------
if not SUPABASE_KEY:
    raise SystemExit("Missing SUPABASE_SERVICE_ROLE_KEY env var")

sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
mqtt_client_global = None

# -------- Power Security Cache --------
# Cache format: {meter_number: (allowed, reason, timestamp)}
_power_cache: Dict[str, Tuple[bool, str, float]] = {}
_power_cache_lock = Lock()


# ============================================
# POWER SECURITY FUNCTIONS
# ============================================

def check_meter_allowed(meter_number: str) -> tuple:
    """
    Tjek om en måler må være tændt.
    Returnerer (allowed: bool, reason: str)
    Bruger cache for hurtigere respons.
    """
    global _power_cache
    now = time.time()
    
    # Check cache first
    with _power_cache_lock:
        if meter_number in _power_cache:
            allowed, reason, cached_at = _power_cache[meter_number]
            if now - cached_at < CACHE_TTL_SECONDS:
                log.debug(f"Cache hit for {meter_number}: {allowed} ({reason})")
                return allowed, reason
    
    # Cache miss or expired - call database
    try:
        result = sb.rpc("check_meter_power_allowed", {
            "p_meter_number": meter_number
        }).execute()
        
        if result.data and len(result.data) > 0:
            row = result.data[0]
            allowed = row.get("allowed", True)
            reason = row.get("reason", "unknown")
        else:
            allowed, reason = True, "new_meter"
        
        # Update cache
        with _power_cache_lock:
            _power_cache[meter_number] = (allowed, reason, now)
        
        log.debug(f"Cache updated for {meter_number}: {allowed} ({reason})")
        return allowed, reason
        
    except Exception as e:
        log.exception(f"check_meter_allowed error for {meter_number}: {e}")
        return True, "error_allow"


def invalidate_power_cache(meter_number: str = None):
    """Invalidér cache for en specifik måler eller hele cachen."""
    global _power_cache
    with _power_cache_lock:
        if meter_number:
            _power_cache.pop(meter_number, None)
            log.debug(f"Cache invalidated for {meter_number}")
        else:
            _power_cache.clear()
            log.info("Power cache cleared")


def log_unauthorized_attempt(meter_number: str, reason: str, base_topic: str, details: dict = None):
    """Log uautoriseret tændingsforsøg til database."""
    try:
        sb.table("unauthorized_power_attempts").insert({
            "meter_id": meter_number,
            "meter_number": meter_number,
            "action_taken": "shutoff_sent",
            "had_customer": reason != "no_customer",
            "had_package": False,
            "details": {
                "reason": reason,
                "base_topic": base_topic,
                **(details or {})
            }
        }).execute()
        log.warning(f"🚨 Logged unauthorized attempt: {meter_number} - {reason}")
    except Exception as e:
        log.exception(f"Failed to log unauthorized attempt for {meter_number}: {e}")


def send_shutoff_command(meter_number: str, base_topic: str):
    """Send OFF kommando til måler via MQTT."""
    global mqtt_client_global
    if not mqtt_client_global:
        log.error("MQTT client not available for shutoff command")
        return
    
    topic = f"{base_topic}/{meter_number}/set"
    payload = json.dumps({"state": "OFF"})
    mqtt_client_global.publish(topic, payload, qos=1)
    log.warning(f"⚡ Sent shutoff command to {meter_number} via {topic}")


def handle_meter_state_change(device_name: str, state: str, base_topic: str, payload: dict):
    """Håndter state ændring - tjek om tilladt."""
    if not ENABLE_POWER_SECURITY:
        return
    
    if state != "ON":
        return
    
    if device_name.lower() in IGNORE_NAMES:
        return
    
    allowed, reason = check_meter_allowed(device_name)
    
    if not allowed:
        log.warning(f"🚨 UNAUTHORIZED ON detected: {device_name} - {reason}")
        send_shutoff_command(device_name, base_topic)
        log_unauthorized_attempt(device_name, reason, base_topic, {
            "power": payload.get("power"),
            "energy": payload.get("energy")
        })
    else:
        log.debug(f"✅ Allowed ON: {device_name} - {reason}")


# ============================================
# DEVICE SYNC FUNCTIONS
# ============================================

def upsert_power_meter(friendly_name: str, base_topic: str, is_online: bool = True):
    """Upsert power meter WITH is_online status. Use when availability is known."""
    topic = f"{base_topic}/{friendly_name}"
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    payload = {
        "meter_number": friendly_name,
        "mqtt_topic": topic,
        "is_available": True,
        "is_online": is_online,
        "updated_at": now_iso,
    }
    sb.table("power_meters").upsert(payload, on_conflict="meter_number").execute()


def upsert_power_meter_metadata(friendly_name: str, base_topic: str):
    """Upsert power meter WITHOUT touching is_online status.
    
    Used when syncing from bridge/devices where availability is not included.
    This prevents overwriting correct offline status from availability messages.
    """
    topic = f"{base_topic}/{friendly_name}"
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    
    # Tjek om måleren allerede eksisterer
    existing = sb.table("power_meters").select("meter_number").eq("meter_number", friendly_name).execute()
    
    if existing.data:
        # Opdater kun metadata, IKKE is_online
        sb.table("power_meters").update({
            "mqtt_topic": topic,
            "updated_at": now_iso,
        }).eq("meter_number", friendly_name).execute()
    else:
        # Ny måler - opret med is_online = False (unknown state until availability msg)
        sb.table("power_meters").insert({
            "meter_number": friendly_name,
            "mqtt_topic": topic,
            "is_available": True,
            "is_online": False,
            "updated_at": now_iso,
        }).execute()


def update_meter_online_status(friendly_name: str, is_online: bool):
    """Update only the is_online status for a meter."""
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    try:
        sb.table("power_meters").update({
            "is_online": is_online,
            "updated_at": now_iso,
        }).eq("meter_number", friendly_name).execute()
        log.info(f"Updated online status: {friendly_name} -> {'online' if is_online else 'offline'}")
    except Exception as e:
        log.exception(f"Failed to update online status for {friendly_name}: {e}")


def upsert_meter_identity(ieee: str, friendly_name: str, base_topic: str, last_seen: str | None, availability: str | None, model: str | None):
    now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    payload = {
        "ieee_address": ieee,
        "meter_number": friendly_name,
        "base_topic": base_topic,
        "last_seen": last_seen,
        "availability": availability,
        "model": model,
        "updated_at": now_iso,
    }
    
    # FIXED: Kun opdater is_online hvis vi HAR availability info fra Z2M
    # Dette forhindrer at bridge/devices (som ikke har availability) overskriver
    # korrekt offline status fra availability MQTT beskeder
    if availability is not None:
        is_online = availability == "online"
        upsert_power_meter(friendly_name, base_topic, is_online)
    else:
        # Opret/opdater metadata UDEN at røre is_online
        upsert_power_meter_metadata(friendly_name, base_topic)
    
    sb.table("meter_identity").upsert(payload, on_conflict="ieee_address").execute()


def process_devices_array(devices: List[Dict[str, Any]], base_topic: str):
    for d in devices:
        ieee = d.get("ieee_address") or d.get("ieee")
        fn = d.get("friendly_name") or d.get("friendlyName") or ieee
        device_type = (d.get("type") or "").strip().lower()
        if device_type == "coordinator":
            log.info(f"Ignored coordinator device base={base_topic}")
            continue
        if (fn or "").strip().lower() in IGNORE_NAMES:
            log.info(f"Ignored device fn={fn} base={base_topic}")
            continue
        availability = None
        if isinstance(d.get("availability"), dict):
            availability = d["availability"].get("state")
        elif isinstance(d.get("availability"), str):
            availability = d.get("availability")
        last_seen = d.get("last_seen") or d.get("lastSeen")
        model = (d.get("definition") or {}).get("model") if isinstance(d.get("definition"), dict) else d.get("model")
        if not ieee:
            continue
        try:
            upsert_meter_identity(ieee, fn, base_topic, last_seen, availability, model)
            log.info(f"Upserted device ieee={ieee} fn={fn} base={base_topic}")
        except Exception as e:
            log.exception(f"Upsert failed for ieee={ieee} fn={fn}: {e}")


def cleanup_duplicates_for_ieee(ieee: str, new_name: str, base_topic: str):
    """
    Find og opryd dubletter for en given IEEE adresse.
    Migrerer meter_readings til nyt navn og sletter gamle power_meters.
    """
    try:
        # Find alle meter_numbers der har været brugt til denne IEEE
        result = sb.table("meter_identity").select("meter_number").eq("ieee_address", ieee).execute()
        
        if not result.data:
            return
        
        old_names = [r["meter_number"] for r in result.data if r["meter_number"] != new_name]
        
        if not old_names:
            return
        
        log.info(f"🔄 Found {len(old_names)} old names for IEEE {ieee}: {old_names}")
        
        for old_name in old_names:
            # 1. Migrér meter_readings til nyt navn (bevarer historik!)
            try:
                migrate_result = sb.table("meter_readings").update({
                    "meter_id": new_name
                }).eq("meter_id", old_name).execute()
                
                if migrate_result.data:
                    log.info(f"📊 Migrated {len(migrate_result.data)} readings: {old_name} -> {new_name}")
            except Exception as e:
                log.warning(f"Could not migrate readings for {old_name}: {e}")
            
            # 2. Migrér meter_readings_history
            try:
                sb.table("meter_readings_history").update({
                    "meter_id": new_name
                }).eq("meter_id", old_name).execute()
            except Exception as e:
                log.warning(f"Could not migrate history for {old_name}: {e}")
            
            # 3. Slet den gamle power_meter post
            try:
                sb.table("power_meters").delete().eq("meter_number", old_name).execute()
                log.info(f"🗑️ Deleted duplicate power_meter: {old_name}")
            except Exception as e:
                log.warning(f"Could not delete old power_meter {old_name}: {e}")
        
        log.info(f"✅ Cleanup complete for IEEE {ieee} -> {new_name}")
        
    except Exception as e:
        log.exception(f"Cleanup failed for IEEE {ieee}: {e}")


def rename_in_db(old_name: str | None, new_name: str, base_topic: str, ieee: str | None = None):
    """
    Update existing power_meters + meter_identity rows on rename.
    Includes duplicate cleanup and history migration.
    """
    try:
        if (new_name or "").strip().lower() in IGNORE_NAMES:
            log.info(f"Rename ignored for new_name={new_name}")
            return
        
        now_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        updated = False
        
        # Opdater eksisterende post hvis old_name er kendt
        if old_name:
            result = sb.table("power_meters").update({
                "meter_number": new_name,
                "mqtt_topic": f"{base_topic}/{new_name}",
                "updated_at": now_iso,
            }).eq("meter_number", old_name).execute()
            
            if result.data:
                updated = True
                log.info(f"Updated power_meters: {old_name} -> {new_name}")

            sb.table("meter_identity").update({
                "meter_number": new_name,
                "base_topic": base_topic,
                "updated_at": now_iso,
            }).eq("meter_number", old_name).execute()
        
        # Hvis vi har IEEE, ryd op i eventuelle dubletter
        if ieee:
            cleanup_duplicates_for_ieee(ieee, new_name, base_topic)
        
        # Opret ny post hvis ingen blev opdateret
        if not updated:
            upsert_power_meter(new_name, base_topic, True)  # New devices default to online
            log.info(f"Created new power_meter: {new_name}")
            
    except Exception as e:
        log.exception(f"Rename DB update failed ({old_name} -> {new_name} @ {base_topic}): {e}")


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
    topic = msg.topic
    try:
        payload = json.loads(msg.payload.decode("utf-8")) if msg.payload else None
    except Exception:
        payload = msg.payload.decode("utf-8") if msg.payload else None
    
    # === POWER SECURITY: Monitor device state changes ===
    for base in BASE_TOPICS:
        if topic.startswith(f"{base}/") and "/bridge" not in topic and not topic.endswith("/availability"):
            parts = topic.split("/")
            if len(parts) == 2 and isinstance(payload, dict):
                device_name = parts[1]
                state = payload.get("state")
                if state:
                    handle_meter_state_change(device_name, state, base, payload)
    
    # Handle availability topics
    for base in BASE_TOPICS:
        if topic.startswith(f"{base}/") and topic.endswith("/availability"):
            parts = topic.split("/")
            if len(parts) >= 3:
                device_name = parts[1]
                if device_name.lower() in IGNORE_NAMES or device_name.lower() == "coordinator":
                    return
                is_online = False
                if isinstance(payload, dict):
                    is_online = payload.get("state") == "online"
                elif isinstance(payload, str):
                    is_online = payload.lower() == "online"
                update_meter_online_status(device_name, is_online)
                return
    
    # bridge/devices full dump
    for base in BASE_TOPICS:
        if topic == f"{base}/bridge/devices" and isinstance(payload, list):
            process_devices_array(payload, base)
            return
        if topic == f"{base}/bridge/event" and isinstance(payload, dict):
            if payload.get("type") == "device_renamed":
                data = payload.get("data", {})
                new = data.get("to")
                old = data.get("from")
                ieee = data.get("ieee_address")  # Hent IEEE fra event
                if new:
                    rename_in_db(old, new, base, ieee)
                    client.publish(f"{base}/bridge/config/devices/get", "")
                    log.info(f"Rename event on {base}: {old} -> {new} (IEEE: {ieee})")
                return
            if payload.get("type") in {"device_announce", "device_interview"}:
                client.publish(f"{base}/bridge/config/devices/get", "")
                log.info(f"Device event on {base}: {payload.get('type')}")
                return


# ============================================
# MQTT CONNECTION HANDLERS (med retry-logik)
# ============================================

def on_connect(client, userdata, flags, rc):
    """Called when MQTT connection is established."""
    if rc == 0:
        log.info("✅ MQTT Connected successfully")
        for base in BASE_TOPICS:
            client.subscribe(f"{base}/bridge/devices", qos=1)
            client.subscribe(f"{base}/bridge/event", qos=1)
            client.subscribe(f"{base}/+/availability", qos=1)
            client.subscribe(f"{base}/+", qos=1)
            log.info(f"Subscribed to {base}/+ (state monitoring)")
        for base in BASE_TOPICS:
            client.publish(f"{base}/bridge/config/devices/get", "")
    else:
        log.error(f"❌ MQTT Connection failed with code {rc}")


def on_disconnect(client, userdata, rc):
    """Called when MQTT connection is lost."""
    if rc != 0:
        log.warning(f"⚠️ MQTT Disconnected unexpectedly (rc={rc}). Will auto-reconnect...")
    else:
        log.info("MQTT Disconnected normally")


def connect_mqtt_with_retry(client, max_retries=None):
    """Connect to MQTT broker with infinite retry."""
    retry_delay = 5
    max_delay = 60
    attempt = 0
    
    while max_retries is None or attempt < max_retries:
        attempt += 1
        try:
            log.info(f"Connecting MQTT {MQTT_HOST}:{MQTT_PORT} (attempt {attempt})...")
            client.connect(MQTT_HOST, MQTT_PORT, 60)
            return True
        except Exception as e:
            log.warning(f"⚠️ MQTT connection failed: {e}. Retrying in {retry_delay}s...")
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_delay)
    
    return False


def main():
    global mqtt_client_global
    
    log.info("=" * 50)
    log.info("DEVICE-SYNC SERVICE v2.3 (offline status fix)")
    log.info(f"Power Security: {'ENABLED' if ENABLE_POWER_SECURITY else 'DISABLED'}")
    log.info(f"MQTT: {MQTT_HOST}:{MQTT_PORT}")
    log.info(f"Topics: {', '.join(BASE_TOPICS)}")
    log.info("=" * 50)
    
    client = mqtt.Client(client_id="device-sync")
    mqtt_client_global = client
    
    if MQTT_USER or MQTT_PASSWORD:
        client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
    
    client.on_message = on_message
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    
    # Enable automatic reconnection
    client.reconnect_delay_set(min_delay=1, max_delay=30)
    
    # Connect with retry logic
    connect_mqtt_with_retry(client)
    
    client.loop_start()

    # Main loop with health monitoring
    last_refresh = 0
    last_health_log = 0
    health_interval = 300
    
    try:
        while True:
            now = time.time()
            
            if now - last_refresh >= POLL_REDISCOVER_SEC:
                if client.is_connected():
                    for base in BASE_TOPICS:
                        client.publish(f"{base}/bridge/config/devices/get", "")
                    last_refresh = now
                else:
                    log.warning("⚠️ MQTT not connected, skipping device refresh")
            
            if now - last_health_log >= health_interval:
                status = "CONNECTED" if client.is_connected() else "DISCONNECTED"
                cache_size = len(_power_cache)
                log.info(f"💓 Health: MQTT {status}, Security: {'ON' if ENABLE_POWER_SECURITY else 'OFF'}, Cache: {cache_size} entries")
                last_health_log = now
                
                # Clean expired cache entries
                with _power_cache_lock:
                    expired = [k for k, v in _power_cache.items() if now - v[2] > CACHE_TTL_SECONDS * 10]
                    for k in expired:
                        del _power_cache[k]
            
            time.sleep(1.0)
    except KeyboardInterrupt:
        log.info("Shutting down...")
    finally:
        client.loop_stop()
        client.disconnect()
        log.info("Device-sync stopped")


if __name__ == "__main__":
    main()
