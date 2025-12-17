import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Alle kendte Zigbee2MQTT områder
const AREAS = [
  'zigbee2mqtt',
  'zigbee2mqtt_area2',
  'zigbee2mqtt_area3',
  'zigbee2mqtt_area4',
  'zigbee2mqtt_area5',
  'zigbee2mqtt_area6'
];

Deno.serve(async (req) => {
  try {
    const { ieee_address, new_name, base_topic } = await req.json();
    
    console.log(`Rename request: ${ieee_address} → ${new_name} (topic: ${base_topic})`);
    
    if (!ieee_address || !new_name) {
      return new Response(
        JSON.stringify({ error: 'Missing ieee_address or new_name' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // Bestem hvilken base_topic der skal bruges
    const topic = base_topic || 'zigbee2mqtt';
    const renameTopic = `${topic}/bridge/request/device/rename`;
    const payload = JSON.stringify({ from: ieee_address, to: new_name });
    
    // Log kommandoen (MQTT publish skal implementeres via ekstern service)
    // For nu logger vi bare - Node-RED kan lytte på et Supabase webhook
    console.log(`MQTT Topic: ${renameTopic}`);
    console.log(`MQTT Payload: ${payload}`);
    
    // Gem rename-kommando i database så Node-RED kan hente den
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/rest/v1/meter_commands`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        meter_id: ieee_address,
        command: 'rename',
        value: new_name,
        status: 'pending'
      })
    });
    
    if (!response.ok) {
      console.error('Fejl ved gem af rename kommando:', await response.text());
    } else {
      console.log(`Rename kommando gemt for ${ieee_address} → ${new_name}`);
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Rename command queued: ${ieee_address} → ${new_name}`,
        topic: renameTopic
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error: any) {
    console.error('Fejl i rename-meter:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
