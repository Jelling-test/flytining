import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: "Missing Supabase env" }, 500);
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Missing bearer token" }, 401);
  }

  const accessToken = authHeader.slice("Bearer ".length);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    },
    auth: { persistSession: false }
  });

  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userId = userRes.user.id;

  // Check role (admin or staff) using the user's id
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "staff"]);

  if (rolesErr || !roles || roles.length === 0) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const camera_serial = body?.camera_serial || "CAMERA001";
  const source = body?.source || "manual_button";
  const ip = req.headers.get("x-forwarded-for") || "unknown";

  // Create control_request row (pending) in access schema
  const { data: insertRow, error: insertErr } = await admin
    .schema("access")
    .from("control_requests")
    .insert({
      action: "open",
      status: "pending",
      camera_serial,
      source,
      meta: {
        ip,
        by: userRes.user.email || userId
      }
    })
    .select()
    .single();

  if (insertErr) {
    return json({ error: insertErr.message }, 400);
  }

  const rowId = insertRow?.id;

  try {
    // Brug samme metode som axis-anpr-webhook (INGEN ÆNDRINGER I ANPR SYSTEMET)
    const gateUrl = '152.115.191.134:65471';
    
    console.log('Opening gate for manual request by:', userRes.user.email);
    
    // Pulse sequence: ON → wait 700ms → OFF (NO AUTHENTICATION NEEDED)
    
    // Turn ON
    const onResponse = await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%2F`, {
      signal: AbortSignal.timeout(3000)
    });
    
    if (!onResponse.ok) {
      throw new Error(`ON failed: ${onResponse.status}`);
    }
    
    console.log('Gate pulse ON sent');
    
    // Wait 700ms
    await delay(700);
    
    // Turn OFF
    const offResponse = await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%5C`, {
      signal: AbortSignal.timeout(3000)
    });
    
    if (!offResponse.ok) {
      throw new Error(`OFF failed: ${offResponse.status}`);
    }
    
    console.log('Gate pulse OFF sent - Gate opened successfully');
    
    // Failsafe: Send OFF again after 5 seconds
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
    
    // Update status to executed
    if (rowId) {
      await admin
        .schema("access")
        .from("control_requests")
        .update({
          status: "executed",
          executed_at: new Date().toISOString()
        })
        .eq("id", rowId);
    }
    
    return json({
      ok: true,
      id: rowId || null,
      message: "Gate opened successfully"
    });
    
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Gate opening error:', msg);
    
    if (rowId) {
      await admin
        .schema("access")
        .from("control_requests")
        .update({
          status: "failed",
          error: msg
        })
        .eq("id", rowId);
    }
    
    return json({ error: msg }, 500);
  }
});
