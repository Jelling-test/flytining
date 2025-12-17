import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify user is admin/staff
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin or staff
    const { data: roles } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdminOrStaff = roles?.some(r => r.role === "admin" || r.role === "staff");
    if (!isAdminOrStaff) {
      return new Response(JSON.stringify({ error: "Kun admin/staff kan bruge denne funktion" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { meter_id, action, reason } = body;

    if (!meter_id || !action) {
      return new Response(JSON.stringify({ error: "meter_id og action er påkrævet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "enable") {
      // Aktiver admin bypass
      const { error: updateError } = await supabaseClient
        .from("power_meters")
        .update({
          admin_bypass: true,
          admin_bypass_by: user.id,
          admin_bypass_at: new Date().toISOString(),
          admin_bypass_reason: reason || "Ingen grund angivet",
        })
        .eq("meter_number", meter_id);

      if (updateError) throw updateError;

      // Log til historik
      await supabaseClient.from("admin_bypass_log").insert({
        meter_id,
        action: "enabled",
        reason: reason || "Ingen grund angivet",
        performed_by: user.id,
        performed_by_email: user.email,
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Admin bypass aktiveret for ${meter_id}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "disable") {
      // Deaktiver admin bypass
      const { error: updateError } = await supabaseClient
        .from("power_meters")
        .update({
          admin_bypass: false,
          admin_bypass_by: null,
          admin_bypass_at: null,
          admin_bypass_reason: null,
        })
        .eq("meter_number", meter_id);

      if (updateError) throw updateError;

      // Log til historik
      await supabaseClient.from("admin_bypass_log").insert({
        meter_id,
        action: "disabled",
        reason: reason || "Bypass deaktiveret",
        performed_by: user.id,
        performed_by_email: user.email,
      });

      return new Response(JSON.stringify({ 
        success: true, 
        message: `Admin bypass deaktiveret for ${meter_id}` 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Ugyldig action. Brug 'enable' eller 'disable'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
