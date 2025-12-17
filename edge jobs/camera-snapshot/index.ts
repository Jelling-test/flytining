import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Samme IP som gate-open bruger
    const cameraUrl = 'http://152.115.191.134:65471/axis-cgi/jpg/image.cgi';
    
    console.log('Fetching camera snapshot from:', cameraUrl);
    
    // Hent snapshot fra kameraet
    const response = await fetch(cameraUrl, {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error('Camera response not ok:', response.status);
      return new Response(
        JSON.stringify({ error: `Camera error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Hent billedet som ArrayBuffer
    const imageData = await response.arrayBuffer();
    
    console.log('Snapshot fetched, size:', imageData.byteLength);
    
    // Returner billedet direkte
    return new Response(imageData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
    
  } catch (error: any) {
    console.error('Camera snapshot error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
