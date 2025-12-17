import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting cleanup of old meter readings...");

    // Slet målinger ældre end 48 timer
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 48);

    const { data, error } = await supabase
      .from("meter_readings")
      .delete()
      .lt("time", cutoffTime.toISOString());

    if (error) throw error;

    console.log(`Cleanup complete. Deleted readings older than ${cutoffTime.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        cutoff_time: cutoffTime.toISOString(),
        message: "Old readings deleted successfully",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
