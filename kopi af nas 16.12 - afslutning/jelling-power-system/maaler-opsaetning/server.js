import express from 'express';
import mqtt from 'mqtt';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MQTT Configuration
const MQTT_BROKER = 'mqtt://192.168.9.61:1890';
const MQTT_USERNAME = 'homeassistant';
const MQTT_PASSWORD = '7200Grindsted!';

// List of all Z2M base topics (alle 6 områder + 3-faset)
const Z2M_TOPICS = [
  'zigbee2mqtt',
  'zigbee2mqtt_area2',
  'zigbee2mqtt_area3',
  'zigbee2mqtt_area4',
  'zigbee2mqtt_area5',
  'zigbee2mqtt_area6',
  'zigbee2mqtt_3p'
];

// 3-faset måler modeller (til auto-detektion)
const THREE_PHASE_MODELS = ['TS011F', 'TOQCB2-80', 'SPM02'];

// ============================================================
// PERSISTENT MQTT CONNECTION FOR PAIRING
// ============================================================

let mqttClient = null;
let pairingState = {
  active: false,
  baseTopic: null,
  startedAt: null,
  currentDevice: null,
  interviewStatus: null,
  deviceModel: null,
  isThreePhase: false,
  sseClients: new Set()
};

function initMqttConnection() {
  console.log('🔌 Initializing persistent MQTT connection...');
  
  mqttClient = mqtt.connect(MQTT_BROKER, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `pairing-service-${Date.now()}`,
    reconnectPeriod: 5000
  });

  mqttClient.on('connect', () => {
    console.log('✅ MQTT connected for pairing service');
    
    // Subscribe to bridge events for all areas
    Z2M_TOPICS.forEach(topic => {
      mqttClient.subscribe(`${topic}/bridge/event`, (err) => {
        if (!err) console.log(`📡 Subscribed to ${topic}/bridge/event`);
      });
      mqttClient.subscribe(`${topic}/bridge/response/#`, (err) => {
        if (!err) console.log(`📡 Subscribed to ${topic}/bridge/response/#`);
      });
    });
  });

  mqttClient.on('error', (err) => {
    console.error('❌ MQTT error:', err.message);
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      handleMqttMessage(topic, payload);
    } catch (e) {
      // Ignore non-JSON messages
    }
  });
}

function handleMqttMessage(topic, payload) {
  // Only process if pairing is active
  if (!pairingState.active) return;
  
  // Check if this is from the active base topic
  const baseTopic = topic.split('/')[0];
  if (baseTopic !== pairingState.baseTopic) return;
  
  // Handle bridge events
  if (topic.endsWith('/bridge/event')) {
    const eventType = payload.type;
    const data = payload.data || {};
    
    console.log(`📨 Event: ${eventType}`, data);
    
    switch (eventType) {
      case 'device_joined':
        pairingState.currentDevice = {
          ieee_address: data.ieee_address,
          friendly_name: data.friendly_name
        };
        pairingState.interviewStatus = 'joined';
        broadcastToClients({
          event: 'device_joined',
          data: {
            ieee_address: data.ieee_address,
            friendly_name: data.friendly_name
          }
        });
        break;
        
      case 'device_interview':
        if (data.ieee_address === pairingState.currentDevice?.ieee_address) {
          pairingState.interviewStatus = data.status;
          
          if (data.status === 'started') {
            broadcastToClients({
              event: 'interview_started',
              data: { ieee_address: data.ieee_address }
            });
          } else if (data.status === 'successful') {
            // Detect if this is a 3-phase meter based on model
            const model = data.definition?.model || 'Unknown';
            const isThreePhase = THREE_PHASE_MODELS.some(m => model.toUpperCase().includes(m.toUpperCase()));
            pairingState.deviceModel = model;
            pairingState.isThreePhase = isThreePhase;
            
            console.log(`🔍 Detected meter type: ${isThreePhase ? '3-FASET' : '1-FASET'} (model: ${model})`);
            
            // Auto-configure the meter after successful interview
            const deviceName = pairingState.currentDevice?.friendly_name || data.ieee_address;
            autoConfigureMeter(pairingState.baseTopic, deviceName, isThreePhase);
            
            // Send OFF command to test relay (user will see light turn off)
            setTimeout(() => {
              sendRelayCommand(pairingState.baseTopic, deviceName, 'OFF');
            }, 2000);
            
            broadcastToClients({
              event: 'interview_successful',
              data: {
                ieee_address: data.ieee_address,
                model: model,
                vendor: data.definition?.vendor || 'Unknown',
                description: data.definition?.description || '',
                isThreePhase: isThreePhase
              }
            });
          } else if (data.status === 'failed') {
            broadcastToClients({
              event: 'interview_failed',
              data: { ieee_address: data.ieee_address }
            });
          }
        }
        break;
        
      case 'device_announce':
        // Device re-announced (usually after power cycle)
        if (pairingState.currentDevice?.ieee_address === data.ieee_address) {
          broadcastToClients({
            event: 'device_announce',
            data: { ieee_address: data.ieee_address }
          });
        }
        break;
    }
  }
  
  // Handle rename response
  if (topic.includes('/bridge/response/device/rename')) {
    broadcastToClients({
      event: 'rename_response',
      data: payload
    });
    
    // If rename was successful, send ON command to complete test
    if (payload.status === 'ok' && payload.data?.to) {
      const newName = payload.data.to;
      console.log(`📝 Rename successful, sending ON command to: ${newName}`);
      // Send ON command to turn relay back on
      setTimeout(() => {
        sendRelayCommand(pairingState.baseTopic, newName, 'ON');
        broadcastToClients({
          event: 'relay_test_complete',
          data: { friendly_name: newName, success: true }
        });
      }, 1000);
    }
  }
}

function broadcastToClients(message) {
  const data = `data: ${JSON.stringify(message)}\n\n`;
  pairingState.sseClients.forEach(client => {
    client.write(data);
  });
}

// Auto-configure a newly paired meter (different config for 1-phase vs 3-phase)
function autoConfigureMeter(baseTopic, friendlyName, isThreePhase = false) {
  console.log(`⚙️ Auto-configuring ${isThreePhase ? '3-FASET' : '1-FASET'} meter: ${friendlyName}`);
  
  let configPayload;
  
  if (isThreePhase) {
    // 3-faset måler config (TOQCB2-80 / TS011F)
    configPayload = {
      state: 'ON',
      current_threshold: 63,           // Max 63A per fase
      over_current_setting: 'trip',    // Trip ved overstrøm
      over_voltage_setting: 'trip',    // Trip ved overspænding
      over_voltage_threshold: 280,     // Max 280V
      under_voltage_setting: 'alarm',  // Alarm ved underspænding
      under_voltage_threshold: 165,    // Min 165V
      temperature_setting: 'trip',     // Trip ved overtemperatur
      temperature_threshold: 80        // Max 80°C
    };
    console.log(`📊 3-faset config: current_threshold=63A, over_voltage=280V, under_voltage=165V`);
  } else {
    // 1-faset måler config
    configPayload = {
      state: 'ON',
      power_outage_memory: 'restore',
      indicator_mode: 'on_off'
    };
    console.log(`📊 1-faset config: power_outage_memory=restore, indicator_mode=on_off`);
  }
  
  const topic = `${baseTopic}/${friendlyName}/set`;
  
  mqttClient.publish(topic, JSON.stringify(configPayload), (err) => {
    if (err) {
      console.error(`❌ Failed to auto-configure ${friendlyName}:`, err.message);
      broadcastToClients({
        event: 'auto_config_failed',
        data: { friendly_name: friendlyName, error: err.message, isThreePhase: isThreePhase }
      });
    } else {
      console.log(`✅ Auto-configured ${friendlyName} (${isThreePhase ? '3-faset' : '1-faset'})`);
      broadcastToClients({
        event: 'auto_config_success',
        data: { 
          friendly_name: friendlyName,
          config: configPayload,
          isThreePhase: isThreePhase
        }
      });
    }
  });
}

// Send a single relay command (ON or OFF)
function sendRelayCommand(baseTopic, friendlyName, state) {
  console.log(`🔌 Sending ${state} to: ${friendlyName}`);
  
  const topic = `${baseTopic}/${friendlyName}/set`;
  
  mqttClient.publish(topic, JSON.stringify({ state: state }), { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to send ${state} to ${friendlyName}:`, err.message);
      broadcastToClients({
        event: 'relay_command_failed',
        data: { friendly_name: friendlyName, state: state, error: err.message }
      });
    } else {
      console.log(`✅ Sent ${state} to ${friendlyName}`);
      broadcastToClients({
        event: 'relay_command_sent',
        data: { friendly_name: friendlyName, state: state }
      });
    }
  });
}

// Initialize MQTT on startup
initMqttConnection();

// ============================================================
// PAIRING ENDPOINTS
// ============================================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mqtt-pairing-service',
    mqtt_connected: mqttClient?.connected || false,
    pairing_active: pairingState.active
  });
});

// Area names mapping
const AREA_NAMES = {
  'zigbee2mqtt': '100 området',
  'zigbee2mqtt_area2': 'Hytter og 500 området',
  'zigbee2mqtt_area3': '200 området',
  'zigbee2mqtt_area4': '400 området',
  'zigbee2mqtt_area5': '300 området',
  'zigbee2mqtt_area6': 'Område 6',
  'zigbee2mqtt_3p': '3-faset målere'
};

// Get available areas
app.get('/pairing/areas', (req, res) => {
  res.json({
    success: true,
    areas: Z2M_TOPICS.map((topic) => ({
      id: topic,
      name: AREA_NAMES[topic] || topic,
      baseTopic: topic
    }))
  });
});

// SSE endpoint for pairing events
app.get('/pairing/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Send initial state
  res.write(`data: ${JSON.stringify({
    event: 'connected',
    data: {
      pairing_active: pairingState.active,
      base_topic: pairingState.baseTopic,
      current_device: pairingState.currentDevice,
      interview_status: pairingState.interviewStatus
    }
  })}\n\n`);
  
  // Add client to set
  pairingState.sseClients.add(res);
  console.log(`📱 SSE client connected. Total: ${pairingState.sseClients.size}`);
  
  // Remove on close
  req.on('close', () => {
    pairingState.sseClients.delete(res);
    console.log(`📱 SSE client disconnected. Total: ${pairingState.sseClients.size}`);
  });
});

// Start pairing mode
app.post('/pairing/start', (req, res) => {
  const { baseTopic, duration = 254 } = req.body;
  
  if (!baseTopic || !Z2M_TOPICS.includes(baseTopic)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid baseTopic. Must be one of: ' + Z2M_TOPICS.join(', ')
    });
  }
  
  if (!mqttClient?.connected) {
    return res.status(503).json({
      success: false,
      error: 'MQTT not connected'
    });
  }
  
  // Reset pairing state
  pairingState.active = true;
  pairingState.baseTopic = baseTopic;
  pairingState.startedAt = Date.now();
  pairingState.currentDevice = null;
  pairingState.interviewStatus = null;
  
  // Send permit_join command
  const topic = `${baseTopic}/bridge/request/permit_join`;
  const payload = JSON.stringify({ time: duration });
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to start pairing:', err);
      pairingState.active = false;
      return res.status(500).json({
        success: false,
        error: 'Failed to send permit_join command'
      });
    }
    
    console.log(`🔓 Pairing started on ${baseTopic} for ${duration} seconds`);
    
    broadcastToClients({
      event: 'pairing_started',
      data: { baseTopic, duration }
    });
    
    res.json({
      success: true,
      message: `Pairing mode started on ${baseTopic}`,
      duration
    });
  });
});

// Stop pairing mode
app.post('/pairing/stop', (req, res) => {
  if (!pairingState.active) {
    return res.json({
      success: true,
      message: 'Pairing was not active'
    });
  }
  
  const baseTopic = pairingState.baseTopic;
  
  // Send permit_join disable command
  const topic = `${baseTopic}/bridge/request/permit_join`;
  const payload = JSON.stringify({ time: 0 });
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    pairingState.active = false;
    pairingState.baseTopic = null;
    
    if (err) {
      console.error('❌ Failed to stop pairing:', err);
    }
    
    console.log(`🔒 Pairing stopped on ${baseTopic}`);
    
    broadcastToClients({
      event: 'pairing_stopped',
      data: {}
    });
    
    res.json({
      success: true,
      message: 'Pairing mode stopped'
    });
  });
});

// Rename device
app.post('/pairing/rename', (req, res) => {
  const { ieee_address, new_name, baseTopic } = req.body;
  
  if (!ieee_address || !new_name) {
    return res.status(400).json({
      success: false,
      error: 'Missing ieee_address or new_name'
    });
  }
  
  const topic = `${baseTopic || pairingState.baseTopic}/bridge/request/device/rename`;
  const payload = JSON.stringify({
    from: ieee_address,
    to: new_name
  });
  
  console.log(`📝 Renaming ${ieee_address} to "${new_name}"`);
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to rename:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to send rename command'
      });
    }
    
    res.json({
      success: true,
      message: `Rename command sent: ${ieee_address} → ${new_name}`
    });
  });
});

// Remove device (for failed interviews)
app.post('/pairing/remove', (req, res) => {
  const { ieee_address, baseTopic, force = true } = req.body;
  
  if (!ieee_address) {
    return res.status(400).json({
      success: false,
      error: 'Missing ieee_address'
    });
  }
  
  const topic = `${baseTopic || pairingState.baseTopic}/bridge/request/device/remove`;
  const payload = JSON.stringify({
    id: ieee_address,
    force: force
  });
  
  console.log(`🗑️ Removing device ${ieee_address} (force: ${force})`);
  
  mqttClient.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to remove:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to send remove command'
      });
    }
    
    res.json({
      success: true,
      message: `Remove command sent for ${ieee_address}`
    });
  });
});

// Get current pairing status
app.get('/pairing/status', (req, res) => {
  res.json({
    success: true,
    pairing: {
      active: pairingState.active,
      baseTopic: pairingState.baseTopic,
      startedAt: pairingState.startedAt,
      currentDevice: pairingState.currentDevice,
      interviewStatus: pairingState.interviewStatus,
      connectedClients: pairingState.sseClients.size
    }
  });
});

// ============================================================
// EXISTING CONFIGURE METERS ENDPOINT
// ============================================================

app.post('/configure-meters', async (req, res) => {
  console.log('📡 Received configuration request');

  try {
    // Connect to MQTT broker
    const client = mqtt.connect(MQTT_BROKER, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      clientId: `config-service-${Date.now()}`,
    });

    let configured = 0;
    let failed = 0;
    let allDevices = [];
    let responsesReceived = 0;

    // Wait for connection
    await new Promise((resolve, reject) => {
      client.on('connect', resolve);
      client.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    console.log('✅ Connected to MQTT broker');

    // Get all devices from all Z2M instances
    await new Promise((resolve) => {
      // Subscribe to all bridge responses
      Z2M_TOPICS.forEach(topic => {
        client.subscribe(`${topic}/bridge/devices`);
      });

      // Handle responses
      client.on('message', (topic, message) => {
        if (topic.endsWith('/bridge/devices')) {
          const baseTopic = topic.split('/')[0];
          const devices = JSON.parse(message.toString());
          
          console.log(`📡 Received ${devices.length} devices from ${baseTopic}`);
          
          // Filter Tongou devices and add base topic
          const tongouDevices = devices
            .filter(device => 
              device.definition?.model === 'TO-Q-SY1-JZT' &&
              device.friendly_name !== 'Coordinator'
            )
            .map(device => ({
              ...device,
              baseTopic: baseTopic
            }));
          
          allDevices.push(...tongouDevices);
          responsesReceived++;
          
          // When all responses received, start configuration
          if (responsesReceived >= Z2M_TOPICS.length) {
            resolve();
          }
        }
      });

      // Request device list from all Z2M instances
      Z2M_TOPICS.forEach(topic => {
        client.publish(`${topic}/bridge/request/devices`, '');
      });

      // Timeout after 5 seconds
      setTimeout(resolve, 5000);
    });

    console.log(`🎯 Found ${allDevices.length} Tongou meters to configure`);

    // Configure each meter
    for (const device of allDevices) {
      try {
        const meterName = device.friendly_name;
        const baseTopic = device.baseTopic;
        const configTopic = `${baseTopic}/${meterName}/set`;

        console.log(`Configuring ${meterName} on ${baseTopic}...`);

        // Configuration 1: Power outage memory (restore state after power loss)
        const powerOutageConfig = {
          power_outage_memory: 'restore',
        };

        await new Promise((resolve) => {
          client.publish(configTopic, JSON.stringify(powerOutageConfig), { qos: 1 }, resolve);
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // Configuration 2: Indicator mode (LED behavior)
        const indicatorConfig = {
          indicator_mode: 'on_off',
        };

        await new Promise((resolve) => {
          client.publish(configTopic, JSON.stringify(indicatorConfig), { qos: 1 }, resolve);
        });

        configured++;
        console.log(`✅ Configured: ${meterName}`);

        // Wait between meters
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`❌ Failed to configure ${device.friendly_name}:`, error);
        failed++;
      }
    }

    // Disconnect
    client.end();

    console.log(`✅ Configuration complete: ${configured} success, ${failed} failed`);

    // Send response
    res.json({
      success: true,
      configured,
      failed,
      total: allDevices.length,
    });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 MQTT Pairing & Config Service');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  📡 Port: ${PORT}`);
  console.log(`  🔌 MQTT Broker: ${MQTT_BROKER}`);
  console.log(`  🎯 Areas: ${Z2M_TOPICS.length}`);
  console.log('');
  console.log('  Endpoints:');
  console.log('    GET  /health           - Service status');
  console.log('    GET  /pairing/areas    - List available areas');
  console.log('    GET  /pairing/events   - SSE event stream');
  console.log('    GET  /pairing/status   - Current pairing status');
  console.log('    POST /pairing/start    - Start pairing mode');
  console.log('    POST /pairing/stop     - Stop pairing mode');
  console.log('    POST /pairing/rename   - Rename device');
  console.log('    POST /pairing/remove   - Remove device');
  console.log('    POST /configure-meters - Configure all meters');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
});
