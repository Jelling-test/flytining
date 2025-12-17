import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// RATE LIMIT: 15 seconds
const RATE_LIMIT_MS = 15000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Received request from Axis camera');
    
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams);
    
    let payload;
    
    if (req.method === 'GET' && Object.keys(queryParams).length > 0) {
      payload = queryParams;
    } else {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const rawBody = await req.text();
        payload = JSON.parse(rawBody);
      } else if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        
        let jsonData = formData.get('json') || formData.get('data') || formData.get('payload');
        
        if (!jsonData) {
          for (const [key, value] of formData.entries()) {
            if (typeof value === 'string') {
              try {
                payload = JSON.parse(value);
                break;
              } catch (e) {}
            }
          }
        } else {
          payload = JSON.parse(jsonData.toString());
        }
        
        if (!payload) {
          const images = {};
          for (const [key, value] of formData.entries()) {
            if (typeof value !== 'string') {
              images[key] = value;
            }
          }
          
          const imagePromises = Object.entries(images).map(async ([key, file]) => {
            const buffer = await file.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            return [key, base64];
          });
          
          const imageData = Object.fromEntries(await Promise.all(imagePromises));
          
          payload = {
            plateText: 'UNKNOWN',
            carState: 'new',
            datetime: new Date().toISOString(),
            ImageArray: Object.entries(imageData).map(([key, base64]) => ({
              ImageType: key,
              ImageFormat: 'jpg',
              BinaryImage: base64
            }))
          };
        }
      } else {
        const rawBody = await req.text();
        payload = JSON.parse(rawBody);
      }
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const plateText = payload.plateText || payload.plateUTF8 || payload.plateUnicode || payload.plateASCII;
    
    if (!plateText) {
      return new Response(JSON.stringify({ success: true, message: 'No plate text, skipped' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const detectionData = {
      plate_text: plateText,
      plate_unicode: payload.plateUnicode || null,
      plate_country: payload.plateCountry || null,
      plate_region: payload.plateRegion || null,
      plate_region_code: payload.plateRegionCode || null,
      plate_confidence: payload.plateConfidence ? parseFloat(payload.plateConfidence) : null,
      car_state: payload.carState || null,
      car_direction: payload.carMoveDirection || null,
      car_id: payload.carID || null,
      vehicle_type: payload.vehicle_info?.type || null,
      vehicle_color: payload.vehicle_info?.color || null,
      vehicle_view: payload.vehicle_info?.view || null,
      plate_list: payload.plateList || null,
      plate_list_mode: payload.plateListMode || null,
      plate_list_description: payload.plateListDescription || null,
      capture_timestamp: payload.capture_timestamp ? parseInt(payload.capture_timestamp) : null,
      frame_timestamp: payload.frame_timestamp ? parseInt(payload.frame_timestamp) : null,
      datetime: payload.datetime || null,
      camera_serial: payload.camera_info?.SerialNumber || null,
      camera_model: payload.camera_info?.ProdShortName || null,
      camera_ip: payload.camera_info?.IPAddress || null,
      camera_mac: payload.camera_info?.MACAddress || null,
      plate_coordinates: payload.plateCoordinates ? JSON.stringify(payload.plateCoordinates) : null,
      geotag: payload.geotag ? JSON.stringify(payload.geotag) : null,
      image_plate: payload.ImageArray?.[0]?.BinaryImage || null,
      image_vehicle: payload.ImageArray?.[1]?.BinaryImage || null,
      image_format: payload.plateImageType || 'jpeg',
      full_payload: payload
    };
    
    const { data, error } = await supabase.from('plate_detections').insert(detectionData).select();
    
    if (error) {
      console.error('Database error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Successfully stored detection:', data[0].id);
    
    // AUTOMATIC GATE OPENING LOGIC
    let gateOpened = false;
    let gateError = null;
    
    if (payload.carState === 'new' || payload.carState === 'lost') {
      try {
        const { data: approvedPlate, error: lookupError } = await supabase
          .from('approved_plates')
          .select('*')
          .eq('plate_text', plateText)
          .single();
        
        if (approvedPlate && !lookupError) {
          console.log('Approved plate found:', plateText, 'Source:', approvedPlate.source);
          
          let shouldOpen = false;
          let timeRestrictionMet = true;
          let checkinStatusMet = true;
          
          if (approvedPlate.source === 'manual') {
            shouldOpen = true;
            console.log('Manual plate - 24/7 access granted');
          } else if (approvedPlate.source === 'sirvoy_webhook') {
            const now = new Date();
            const danishTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
            const hour = danishTime.getHours();
            
            timeRestrictionMet = hour >= 7 && hour < 23;
            checkinStatusMet = approvedPlate.checked_in === true && approvedPlate.checked_out === false;
            shouldOpen = timeRestrictionMet && checkinStatusMet;
            
            console.log('Sirvoy plate - Hour:', hour, 'Time OK:', timeRestrictionMet, 'Status OK:', checkinStatusMet);
          }
          
          if (shouldOpen) {
            const rateLimitKey = `gate_${plateText}`;
            const { data: recentOpenings } = await supabase
              .from('gate_openings')
              .select('opened_at')
              .eq('plate_text', plateText)
              .gte('opened_at', new Date(Date.now() - RATE_LIMIT_MS).toISOString())
              .order('opened_at', { ascending: false })
              .limit(1);
            
            if (recentOpenings && recentOpenings.length > 0) {
              console.log('Rate limit: Gate already opened recently for', plateText);
              gateError = 'Rate limit: Gate opened recently';
            } else {
              console.log('Opening gate for', plateText);
              const gateUrl = '152.115.191.134:65471';
              
              const onResponse = await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%2F`, {
                signal: AbortSignal.timeout(3000)
              });
              
              if (onResponse.ok) {
                console.log('Gate pulse ON sent');
                await new Promise(resolve => setTimeout(resolve, 700));
                
                const offResponse = await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%5C`, {
                  signal: AbortSignal.timeout(3000)
                });
                
                if (offResponse.ok) {
                  console.log('Gate opened successfully');
                  gateOpened = true;
                  
                  setTimeout(async () => {
                    try {
                      await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%5C`, {
                        signal: AbortSignal.timeout(3000)
                      });
                      console.log('Failsafe OFF sent');
                    } catch (e) {
                      console.error('Failsafe OFF failed:', e);
                    }
                  }, 5000);
                } else {
                  gateError = `Failed to send OFF pulse: ${offResponse.status}`;
                }
              } else {
                gateError = `Failed to send ON pulse: ${onResponse.status}`;
              }
            }
            
            await supabase.from('gate_openings').insert({
              plate_text: plateText,
              approved_plate_id: approvedPlate.id,
              detection_id: data[0].id,
              success: gateOpened,
              error_message: gateError,
              source: approvedPlate.source,
              time_restriction_met: timeRestrictionMet,
              checkin_status_met: checkinStatusMet,
              camera_ip: payload.camera_info?.IPAddress || null,
              rate_limit_key: rateLimitKey
            });
          } else {
            console.log('Conditions not met for gate opening');
            await supabase.from('gate_openings').insert({
              plate_text: plateText,
              approved_plate_id: approvedPlate.id,
              detection_id: data[0].id,
              success: false,
              error_message: 'Conditions not met (time or check-in status)',
              source: approvedPlate.source,
              time_restriction_met: timeRestrictionMet,
              checkin_status_met: checkinStatusMet,
              camera_ip: payload.camera_info?.IPAddress || null
            });
          }
        } else {
          console.log('Plate not approved:', plateText);
        }
      } catch (gateErr) {
        console.error('Gate opening error:', gateErr);
        gateError = gateErr instanceof Error ? gateErr.message : String(gateErr);
      }
    }
    
    return new Response(JSON.stringify({
      success: true,
      id: data[0].id,
      plate: detectionData.plate_text,
      gate_opened: gateOpened,
      gate_error: gateError
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
