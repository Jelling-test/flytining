import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

console.log("Cleanup expired customers function started");

Deno.serve(async (req) => {
  try {
    // Opret Supabase client med SERVICE_ROLE key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Kald cleanup funktionen
    const { error } = await supabaseClient.rpc('cleanup_expired_customers');

    if (error) {
      console.error('Error cleaning up expired customers:', error);
      throw error;
    }

    console.log('Successfully cleaned up expired customers');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Expired customers cleaned up',
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in cleanup function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
