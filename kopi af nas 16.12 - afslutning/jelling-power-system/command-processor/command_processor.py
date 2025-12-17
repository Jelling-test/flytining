#!/usr/bin/env python3
"""
Command Processor - Lytter til meter_commands og sender MQTT kommandoer
Med retry-logik og auto-reconnect.

Version: 2.0
"""

import os
import time
import json
import logging
from datetime import datetime
from supabase import create_client, Client
import paho.mqtt.client as mqtt

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration from environment
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://jkmqliztlhmfyejhmuil.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
MQTT_HOST = os.getenv('MQTT_HOST', 'mosquitto')
MQTT_PORT = int(os.getenv('MQTT_PORT', '1883'))
MQTT_USER = os.getenv('MQTT_USER', 'homeassistant')
MQTT_PASSWORD = os.getenv('MQTT_PASSWORD', '7200Grindsted!')
POLL_INTERVAL = float(os.getenv('POLL_INTERVAL', '0.2'))


class CommandProcessor:
    def __init__(self):
        self.supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.mqtt_client = mqtt.Client(client_id="command-processor")
        self.mqtt_client.username_pw_set(MQTT_USER, MQTT_PASSWORD)
        self.mqtt_connected = False

        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_disconnect = self.on_mqtt_disconnect

    def on_mqtt_connect(self, client, userdata, flags, rc):
        if rc == 0:
            logger.info("✅ Connected to MQTT broker")
            self.mqtt_connected = True
        else:
            logger.error(f"❌ Failed to connect to MQTT broker: {rc}")
            self.mqtt_connected = False

    def on_mqtt_disconnect(self, client, userdata, rc):
        logger.warning(f"⚠️ Disconnected from MQTT broker (rc={rc})")
        self.mqtt_connected = False

    def connect_mqtt_with_retry(self):
        """Connect to MQTT broker with infinite retry."""
        retry_delay = 5
        max_delay = 60
        attempt = 0
        
        while True:
            attempt += 1
            try:
                logger.info(f"Connecting to MQTT {MQTT_HOST}:{MQTT_PORT} (attempt {attempt})...")
                self.mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
                self.mqtt_client.loop_start()
                
                # Wait for connection
                timeout = 10
                start_time = time.time()
                while not self.mqtt_connected and (time.time() - start_time) < timeout:
                    time.sleep(0.1)
                
                if self.mqtt_connected:
                    return True
                    
            except Exception as e:
                logger.warning(f"⚠️ MQTT connection failed: {e}. Retrying in {retry_delay}s...")
            
            time.sleep(retry_delay)
            retry_delay = min(retry_delay * 2, max_delay)

    def get_meter_mqtt_topic(self, meter_id):
        """Lookup mqtt_topic for a meter from power_meters table."""
        try:
            response = self.supabase.table('power_meters')\
                .select('mqtt_topic')\
                .eq('meter_number', meter_id)\
                .limit(1)\
                .execute()

            if response.data and len(response.data) > 0:
                mqtt_topic = response.data[0].get('mqtt_topic')
                if mqtt_topic:
                    return mqtt_topic
                else:
                    logger.warning(f"mqtt_topic is NULL for meter '{meter_id}'")
                    return None
            else:
                logger.warning(f"No power_meters entry found for meter '{meter_id}'")
                return None

        except Exception as e:
            logger.error(f"Error looking up mqtt_topic for {meter_id}: {e}")
            return None

    def process_command(self, command):
        """Process a single command."""
        try:
            meter_id = command['meter_id']
            cmd = command['command']
            value = command.get('value', 'TOGGLE')
            command_id = command['id']

            logger.info(f"Processing command {command_id}: {cmd} for {meter_id} = {value}")

            mqtt_topic = self.get_meter_mqtt_topic(meter_id)

            if not mqtt_topic:
                logger.error(f"Cannot find MQTT topic for meter {meter_id} - skipping command")
                self.supabase.table('meter_commands').update({
                    'status': 'failed',
                    'executed_at': datetime.utcnow().isoformat()
                }).eq('id', command_id).execute()
                return False

            topic = f"{mqtt_topic}/set"

            if cmd == 'set_state':
                payload = json.dumps({"state": value})
            else:
                logger.warning(f"Unknown command: {cmd}")
                return False

            # Reconnect if needed
            if not self.mqtt_connected:
                logger.warning("MQTT not connected, reconnecting...")
                self.connect_mqtt_with_retry()

            result = self.mqtt_client.publish(topic, payload, qos=1)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"✅ Published to {topic}: {payload}")
                self.supabase.table('meter_commands').update({
                    'status': 'executed',
                    'executed_at': datetime.utcnow().isoformat()
                }).eq('id', command_id).execute()
                return True
            else:
                logger.error(f"Failed to publish MQTT message: {result.rc}")
                return False

        except Exception as e:
            logger.error(f"Error processing command: {e}")
            try:
                self.supabase.table('meter_commands').update({
                    'status': 'failed',
                    'executed_at': datetime.utcnow().isoformat()
                }).eq('id', command['id']).execute()
            except:
                pass
            return False

    def poll_commands(self):
        """Poll for pending commands."""
        try:
            response = self.supabase.table('meter_commands')\
                .select('*')\
                .eq('status', 'pending')\
                .order('created_at', desc=False)\
                .limit(10)\
                .execute()

            commands = response.data

            if commands:
                logger.info(f"Found {len(commands)} pending commands")
                for command in commands:
                    self.process_command(command)
                    time.sleep(0.1)

        except Exception as e:
            logger.error(f"Error polling commands: {e}")

    def run(self):
        """Main run loop."""
        logger.info("=" * 60)
        logger.info("COMMAND PROCESSOR v2.0")
        logger.info(f"Supabase: {SUPABASE_URL}")
        logger.info(f"MQTT: {MQTT_HOST}:{MQTT_PORT}")
        logger.info("=" * 60)

        self.connect_mqtt_with_retry()

        logger.info(f"Polling every {POLL_INTERVAL} seconds")

        last_health_log = 0
        health_interval = 300

        try:
            while True:
                self.poll_commands()
                
                now = time.time()
                if now - last_health_log >= health_interval:
                    status = "CONNECTED" if self.mqtt_connected else "DISCONNECTED"
                    logger.info(f"💓 Health: MQTT {status}")
                    last_health_log = now
                
                time.sleep(POLL_INTERVAL)

        except KeyboardInterrupt:
            logger.info("Shutting down...")
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()


if __name__ == '__main__':
    if not SUPABASE_KEY:
        logger.error("SUPABASE_SERVICE_ROLE_KEY not set!")
        exit(1)

    processor = CommandProcessor()
    processor.run()
