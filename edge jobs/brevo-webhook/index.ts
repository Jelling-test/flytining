import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return email;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value === "number") {
    // some providers send unix seconds
    if (value > 1000000000000) return new Date(value);
    return new Date(value * 1000);
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function extractEmail(evt: Record<string, unknown>): string | null {
  // Common Brevo keys
  return (
    normalizeEmail(evt.email) ||
    normalizeEmail(evt.to) ||
    normalizeEmail(evt.recipient) ||
    normalizeEmail((evt as any).message?.to) ||
    normalizeEmail((evt as any).message?.recipient) ||
    (Array.isArray((evt as any).to) ? normalizeEmail((evt as any).to?.[0]) : null) ||
    null
  );
}

function extractEvent(evt: Record<string, unknown>): string {
  return (
    asString(evt.event) ||
    asString(evt.type) ||
    asString(evt.status) ||
    asString((evt as any).eventType) ||
    "unknown"
  ).toLowerCase();
}

function extractMessageId(evt: Record<string, unknown>): string | null {
  return (
    asString(evt.message_id) ||
    asString(evt.messageId) ||
    asString(evt["message-id"]) ||
    asString((evt as any).message?.id) ||
    asString((evt as any).message?.message_id) ||
    null
  );
}

function extractSubject(evt: Record<string, unknown>): string | null {
  return asString(evt.subject) || asString((evt as any).message?.subject) || null;
}

function extractOccurredAt(evt: Record<string, unknown>): Date {
  return (
    asDate(evt.date) ||
    asDate(evt.timestamp) ||
    asDate(evt.occurred_at) ||
    asDate((evt as any).event_date) ||
    asDate((evt as any).sentAt) ||
    new Date()
  );
}

function toEvents(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
  }
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    const maybeEvents = (p.events || p.event || p.data) as unknown;
    if (Array.isArray(maybeEvents)) {
      return maybeEvents.filter((x) => x && typeof x === "object") as Record<string, unknown>[];
    }
    return [p];
  }
  return [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Brevo sends JSON; be defensive in case of non-json
    let raw: string | null = null;
    let payload: unknown;
    try {
      raw = await req.text();
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }

    const events = toEvents(payload);
    if (events.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const rows = events
      .map((evt) => {
        const email = extractEmail(evt);
        if (!email) return null;
        return {
          email,
          event: extractEvent(evt),
          message_id: extractMessageId(evt),
          subject: extractSubject(evt),
          occurred_at: extractOccurredAt(evt).toISOString(),
          payload: evt,
        };
      })
      .filter(Boolean) as Array<{
      email: string;
      event: string;
      message_id: string | null;
      subject: string | null;
      occurred_at: string;
      payload: Record<string, unknown>;
    }>;

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { error } = await (supabase as any).from("brevo_email_events").insert(rows);
    if (error) {
      console.error("Error inserting brevo events:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ ok: true, inserted: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("Error in brevo-webhook:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message || "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
