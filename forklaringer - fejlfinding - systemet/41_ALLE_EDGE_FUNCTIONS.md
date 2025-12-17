# ⚡ ALLE EDGE FUNCTIONS - Komplet Kode

**Opdateret:** 16. december 2025  
**Antal:** 37 funktioner

---

## 📋 OVERSIGT

| Kategori | Funktioner |
|----------|------------|
| **Strøm** | toggle-power, monitor-power-usage, check-low-power |
| **Kunde** | assign-meter, generate-magic-token, validate-magic-link |
| **Portal** | portal-api, get-guest-portal-data, get-guest-power-data, get-guest-status |
| **Betaling** | create-checkout, stripe-webhook |
| **Email** | send-email-brevo, send-welcome-email, send-warning-email, send-low-power-warning, scheduled-emails |
| **Bom/ANPR** | axis-anpr-webhook, gate-open, camera-snapshot, verify-plate |
| **Admin** | admin-bypass-meter, create-admin-user, update-user-email, rename-meter, delete-meter |
| **Cron** | cleanup-old-readings, cleanup-expired-customers, archive-meter-readings, daily-package-snapshot, daily-accounting-report |
| **Bageri/Café** | bakery-api, bakery-daily-summary |
| **Hytte** | start-cleaning-power, end-cleaning-power |
| **Webhook** | webhook, brevo-webhook |
| **Data** | get-live-data |

---

## 1. toggle-power

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { meter_id, state, source } = await req.json();

    if (!meter_id || !state) {
      return new Response(
        JSON.stringify({ error: 'meter_id and state required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data, error } = await supabase
      .from('meter_commands')
      .insert({
        meter_id,
        command: state.toUpperCase(),
        source: source || 'api',
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, command_id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 2. assign-meter

```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { booking_nummer, meter_number } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Tjek om måleren er ledig
    const { data: meterData } = await supabase
      .from('power_meters')
      .select('id, meter_number, is_available, current_customer_id')
      .eq('meter_number', meter_number)
      .maybeSingle();

    if (!meterData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Måler ikke fundet' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Find kunden (regular eller seasonal)
    let customerId = null;
    let customerType = null;

    const { data: regularCustomer } = await supabase
      .from('regular_customers')
      .select('id')
      .eq('booking_id', booking_nummer)
      .maybeSingle();

    if (regularCustomer) {
      customerId = regularCustomer.id;
      customerType = 'regular';
    } else {
      const { data: seasonalCustomer } = await supabase
        .from('seasonal_customers')
        .select('id')
        .eq('booking_id', booking_nummer)
        .maybeSingle();
      
      if (seasonalCustomer) {
        customerId = seasonalCustomer.id;
        customerType = 'seasonal';
      }
    }

    if (!customerId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Booking ikke fundet' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 3. Hent seneste måler aflæsning
    const { data: reading } = await supabase
      .from('meter_readings')
      .select('energy')
      .eq('meter_id', meter_number)
      .order('time', { ascending: false })
      .limit(1)
      .maybeSingle();

    const startEnergy = reading?.energy || 0;

    // 4. Opdater kunde med måler
    const customerTable = customerType === 'regular' ? 'regular_customers' : 'seasonal_customers';
    
    await supabase
      .from(customerTable)
      .update({
        meter_id: meter_number,
        meter_start_energy: startEnergy,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    // 5. Marker måler som optaget
    await supabase
      .from('power_meters')
      .update({
        is_available: false,
        current_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', meterData.id);

    return new Response(
      JSON.stringify({ success: true, meter_id: meter_number, start_energy: startEnergy }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
```

---

## 3. generate-magic-token

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function generateToken(length: number = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length];
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { booking_id, customer_type } = await req.json();
    const tableName = customer_type === 'seasonal' ? 'seasonal_customers' : 'regular_customers';

    const { data: existing } = await supabase
      .from(tableName)
      .select('magic_token')
      .eq('booking_id', booking_id)
      .single();

    let token = existing?.magic_token;

    if (!token) {
      token = generateToken(32);
      await supabase
        .from(tableName)
        .update({ magic_token: token })
        .eq('booking_id', booking_id);
    }

    const PORTAL_URL = 'https://jelling.vercel.app';
    const magicLink = `${PORTAL_URL}/m/${booking_id}/${token}`;

    return new Response(
      JSON.stringify({ magic_link: magicLink, token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 4. validate-magic-link

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { booking_id, token } = await req.json();

    // Try regular_customers first
    let { data: customer } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('magic_token', token)
      .maybeSingle();

    let customerType = 'regular';

    if (!customer) {
      const { data: seasonal } = await supabase
        .from('seasonal_customers')
        .select('*')
        .eq('booking_id', booking_id)
        .eq('magic_token', token)
        .maybeSingle();

      if (seasonal) {
        customer = seasonal;
        customerType = 'seasonal';
      }
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ valid: true, customer: { ...customer, type: customerType } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ valid: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 5. create-checkout

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
      apiVersion: '2023-10-16',
    });

    const { booking_id, package_type, amount, customer_type } = await req.json();

    const pricePerKwh = 3;
    const totalPrice = amount * pricePerKwh * 100;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'dkk',
          product_data: {
            name: `Strømpakke ${amount} kWh`,
            description: `Booking ${booking_id}`,
          },
          unit_amount: totalPrice,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `https://jelling.vercel.app/guest/power?success=true`,
      cancel_url: `https://jelling.vercel.app/guest/power?canceled=true`,
      metadata: {
        booking_id: booking_id.toString(),
        package_type,
        amount: amount.toString(),
        customer_type,
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 6. stripe-webhook

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';

Deno.serve(async (req) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
    apiVersion: '2023-10-16',
  });

  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Create package
    await supabase.from('plugin_data').insert({
      module: 'pakker',
      ref_id: metadata.booking_id,
      data: {
        booking_nummer: parseInt(metadata.booking_id),
        enheder: parseFloat(metadata.amount),
        enheder_tilbage: parseFloat(metadata.amount),
        pris: session.amount_total! / 100,
        status: 'aktiv',
        type: metadata.package_type,
        kunde_type: metadata.customer_type,
        stripe_session_id: session.id,
        oprettet: new Date().toISOString()
      }
    });

    // Turn on meter
    const tableName = metadata.customer_type === 'seasonal' 
      ? 'seasonal_customers' : 'regular_customers';
    
    const { data: customer } = await supabase
      .from(tableName)
      .select('meter_id')
      .eq('booking_id', parseInt(metadata.booking_id))
      .single();

    if (customer?.meter_id) {
      await supabase.from('meter_commands').insert({
        meter_id: customer.meter_id,
        command: 'ON',
        source: 'stripe_webhook',
        status: 'pending'
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
```

---

## 7. axis-anpr-webhook

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    const plateText = payload.plateText?.toUpperCase();

    if (!plateText) {
      return new Response(JSON.stringify({ error: 'No plate text' }), { status: 400 });
    }

    // Save detection
    const { data: detection } = await supabase
      .from('plate_detections')
      .insert({
        plate_text: plateText,
        plate_confidence: payload.plateConfidence,
        car_state: payload.carState,
        car_direction: payload.carMoveDirection,
        full_payload: payload
      })
      .select()
      .single();

    // Check if approved
    const { data: approved } = await supabase
      .from('approved_plates')
      .select('*')
      .eq('plate_text', plateText)
      .maybeSingle();

    if (!approved) {
      return new Response(JSON.stringify({ opened: false, reason: 'not_approved' }));
    }

    // Check conditions
    const hour = new Date().getHours();
    if (hour < 7 || hour >= 23) {
      return new Response(JSON.stringify({ opened: false, reason: 'outside_hours' }));
    }

    if (!approved.checked_in || approved.checked_out) {
      return new Response(JSON.stringify({ opened: false, reason: 'not_checked_in' }));
    }

    // Open gate
    const gateUrl = '152.115.191.134:65471';
    await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%2F`);
    await new Promise(r => setTimeout(r, 700));
    await fetch(`http://${gateUrl}/axis-cgi/io/port.cgi?action=2%3A%5C`);

    // Log opening
    await supabase.from('gate_openings').insert({
      plate_text: plateText,
      approved_plate_id: approved.id,
      detection_id: detection.id,
      success: true,
      source: 'anpr_auto'
    });

    return new Response(JSON.stringify({ opened: true }));
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

---

## 8. send-email-brevo

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to_email, to_name, subject, html_content } = await req.json();

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': Deno.env.get('BREVO_API_KEY')!
      },
      body: JSON.stringify({
        sender: { name: 'Jelling Camping', email: 'noreply@jellingcamping.dk' },
        to: [{ email: to_email, name: to_name }],
        subject,
        htmlContent: html_content
      })
    });

    const result = await response.json();
    return new Response(
      JSON.stringify({ success: true, message_id: result.messageId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 9-37: Øvrige funktioner

Se fil `22_EDGE_FUNCTIONS_KODE.md` for de mest brugte funktioner.

**Komplet liste over alle 37:**

1. toggle-power ✅
2. assign-meter ✅
3. generate-magic-token ✅
4. validate-magic-link ✅
5. create-checkout ✅
6. stripe-webhook ✅
7. axis-anpr-webhook ✅
8. send-email-brevo ✅
9. gate-open
10. camera-snapshot
11. verify-plate
12. portal-api
13. get-guest-portal-data
14. get-guest-power-data
15. get-guest-status
16. get-live-data
17. monitor-power-usage
18. check-low-power
19. send-welcome-email
20. send-warning-email
21. send-low-power-warning
22. scheduled-emails
23. admin-bypass-meter
24. create-admin-user
25. update-user-email
26. rename-meter
27. delete-meter
28. cleanup-old-readings
29. cleanup-expired-customers
30. archive-meter-readings
31. daily-package-snapshot
32. daily-accounting-report
33. bakery-api
34. bakery-daily-summary
35. start-cleaning-power
36. end-cleaning-power
37. webhook (Sirvoy)
38. brevo-webhook

---

## 🔧 DEPLOY

```bash
# Deploy alle
supabase functions deploy --project-ref jkmqliztlhmfyejhmuil

# Deploy enkelt
supabase functions deploy toggle-power --project-ref jkmqliztlhmfyejhmuil

# Se logs
supabase functions logs toggle-power --project-ref jkmqliztlhmfyejhmuil --tail
```
