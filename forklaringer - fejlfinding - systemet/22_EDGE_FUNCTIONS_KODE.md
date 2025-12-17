# ⚡ EDGE FUNCTIONS - Komplet Kode

**Opdateret:** 16. december 2025  
**Runtime:** Deno (Supabase Edge Functions)

---

## 📋 OVERSIGT

Alle Edge Functions deployes til Supabase og køres serverless.

---

## 1. toggle-power

**Formål:** Tænd/sluk strøm på en måler

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { meter_id, state, source } = await req.json();

    if (!meter_id || !state) {
      return new Response(
        JSON.stringify({ error: 'meter_id and state required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate state
    if (!['ON', 'OFF'].includes(state.toUpperCase())) {
      return new Response(
        JSON.stringify({ error: 'state must be ON or OFF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert command into queue
    const { data, error } = await supabase
      .from('meter_commands')
      .insert({
        meter_id: meter_id,
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

## 2. create-checkout

**Formål:** Opret Stripe betaling for strømpakke

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
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

    // Calculate price (example: 3 DKK per kWh)
    const pricePerKwh = 3;
    const totalPrice = amount * pricePerKwh * 100; // Stripe uses cents

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'dkk',
            product_data: {
              name: `Strømpakke ${amount} kWh`,
              description: `Booking ${booking_id}`,
            },
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${Deno.env.get('PORTAL_URL')}/guest/power?success=true`,
      cancel_url: `${Deno.env.get('PORTAL_URL')}/guest/power?canceled=true`,
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

## 3. stripe-webhook

**Formål:** Håndter Stripe betalingsbekræftelse

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
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
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
      key: `pakke_${Date.now()}`,
      data: {
        booking_nummer: parseInt(metadata.booking_id),
        enheder: parseFloat(metadata.amount),
        enheder_tilbage: parseFloat(metadata.amount),
        pris: session.amount_total! / 100,
        status: 'aktiv',
        type: metadata.package_type,
        kunde_type: metadata.customer_type,
        stripe_session_id: session.id,
        oprettet: new Date().toISOString(),
        advarsel_sendt: false
      }
    });

    // Turn on meter
    const tableName = metadata.customer_type === 'seasonal' 
      ? 'seasonal_customers' 
      : 'regular_customers';
    
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

## 4. generate-magic-token

**Formål:** Generer unik login link til gæst

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

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: 'booking_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tableName = customer_type === 'seasonal' 
      ? 'seasonal_customers' 
      : 'regular_customers';

    // Check if customer exists and already has token
    const { data: existing } = await supabase
      .from(tableName)
      .select('magic_token')
      .eq('booking_id', booking_id)
      .single();

    let token = existing?.magic_token;

    if (!token) {
      // Generate new token
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

## 5. validate-magic-link

**Formål:** Valider magic link token

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

    if (!booking_id || !token) {
      return new Response(
        JSON.stringify({ valid: false, error: 'booking_id and token required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try regular_customers first
    let { data: customer } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('booking_id', booking_id)
      .eq('magic_token', token)
      .maybeSingle();

    let customerType = 'regular';

    // If not found, try seasonal_customers
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
        JSON.stringify({ valid: false, error: 'Invalid token or booking not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if within booking period
    const now = new Date();
    const arrival = new Date(customer.arrival_date || customer.season_start);
    const departure = new Date(customer.departure_date || customer.season_end);

    if (now < arrival || now > departure) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Booking period not active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        customer: {
          ...customer,
          type: customerType
        }
      }),
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

## 6. webhook (Sirvoy)

**Formål:** Modtag booking data fra Sirvoy

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
    
    // Store raw webhook data
    await supabase.from('webhook_data').insert({
      source: 'sirvoy',
      payload: payload,
      processed: false
    });

    const {
      bookingId,
      firstName,
      lastName,
      email,
      phone,
      arrivalDate,
      departureDate,
      roomNumber,
      licensePlates,
      language
    } = payload;

    // Upsert customer
    const { error } = await supabase
      .from('regular_customers')
      .upsert({
        booking_id: parseInt(bookingId),
        customer_name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone: phone,
        arrival_date: arrivalDate,
        departure_date: departureDate,
        pitch_number: roomNumber,
        license_plates: licensePlates ? licensePlates.split(',').map(p => p.trim()) : [],
        language: language || 'da',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'booking_id'
      });

    if (error) throw error;

    // Add license plates to approved_plates
    if (licensePlates) {
      const plates = licensePlates.split(',').map(p => p.trim().toUpperCase());
      
      for (const plate of plates) {
        await supabase.from('approved_plates').upsert({
          plate_text: plate,
          source: 'sirvoy_webhook',
          booking_id: parseInt(bookingId),
          customer_type: 'regular',
          checked_in: false,
          checked_out: false
        }, {
          onConflict: 'plate_text'
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
```

---

## 7. check-low-power

**Formål:** Advarsel ved lav strøm (cron)

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Find active packages with low remaining units
  const { data: packages } = await supabase
    .from('plugin_data')
    .select('*')
    .eq('module', 'pakker')
    .eq('data->>status', 'aktiv');

  const threshold = 10; // kWh
  let warningsSent = 0;

  for (const pkg of packages || []) {
    const remaining = pkg.data.enheder_tilbage;
    const alreadyWarned = pkg.data.advarsel_sendt;

    if (remaining < threshold && !alreadyWarned) {
      // Send warning email
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-low-power-warning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          pakke_id: pkg.id,
          booking_nummer: pkg.data.booking_nummer,
          enheder_tilbage: remaining,
          kunde_type: pkg.data.kunde_type
        })
      });

      // Mark as warned
      await supabase
        .from('plugin_data')
        .update({
          data: { ...pkg.data, advarsel_sendt: true }
        })
        .eq('id', pkg.id);

      warningsSent++;
    }
  }

  return new Response(
    JSON.stringify({ checked: packages?.length || 0, warnings_sent: warningsSent }),
    { status: 200 }
  );
});
```

---

## 8. send-email-brevo

**Formål:** Send email via Brevo API

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
    const { to_email, to_name, subject, html_content, from_email, from_name } = await req.json();

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': Deno.env.get('BREVO_API_KEY')!
      },
      body: JSON.stringify({
        sender: {
          name: from_name || 'Jelling Camping',
          email: from_email || 'noreply@jellingcamping.dk'
        },
        to: [{ email: to_email, name: to_name }],
        subject: subject,
        htmlContent: html_content
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Brevo API error');
    }

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

## 📋 DEPLOY KOMMANDOER

```bash
# Deploy enkelt funktion
supabase functions deploy toggle-power --project-ref jkmqliztlhmfyejhmuil

# Deploy alle funktioner
supabase functions deploy --project-ref jkmqliztlhmfyejhmuil

# Se logs
supabase functions logs toggle-power --project-ref jkmqliztlhmfyejhmuil
```

---

## 🔧 SECRETS

Tilføj i Supabase Dashboard → Project Settings → Edge Functions → Secrets:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
BREVO_API_KEY
PORTAL_URL=https://jelling.vercel.app
```
