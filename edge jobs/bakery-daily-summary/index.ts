import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Denne funktion sendes dagligt efter lukketid via cron job
// Eller kan kaldes manuelt fra admin panel

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📧 Starting bakery daily summary...');

    // 1. Hent settings
    const { data: settingsData } = await supabase
      .from('plugin_data')
      .select('data')
      .eq('module', 'bakery_settings')
      .single();

    const settings = settingsData?.data || {};
    const notificationEmail = settings.notification_email || 'reception@jellingcamping.dk';

    // 2. Beregn pickup_date (i morgen)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pickupDate = tomorrow.toISOString().split('T')[0];

    // 3. Hent alle pending ordrer for i morgen
    const { data: ordersData, error: ordersError } = await supabase
      .from('plugin_data')
      .select('*')
      .eq('module', 'bakery_orders')
      .eq('data->>pickup_date', pickupDate)
      .eq('data->>status', 'pending');

    if (ordersError) throw ordersError;

    const orders = (ordersData || []).map(d => ({
      id: d.ref_id,
      ...d.data
    }));

    console.log(`Found ${orders.length} pending orders for ${pickupDate}`);

    if (orders.length === 0) {
      console.log('No orders - skipping email');
      return new Response(JSON.stringify({
        success: true,
        message: 'No orders for tomorrow',
        orders_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. Beregn bage-liste (sum af alle produkter)
    const bakingList: Record<string, number> = {};
    orders.forEach(order => {
      (order.items || []).forEach((item: any) => {
        if (!bakingList[item.name]) {
          bakingList[item.name] = 0;
        }
        bakingList[item.name] += item.quantity;
      });
    });

    // 5. Formater dato
    const formattedDate = tomorrow.toLocaleDateString('da-DK', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // 6. Byg email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { color: #0d9488; }
    h2 { color: #333; margin-top: 30px; border-bottom: 2px solid #0d9488; padding-bottom: 10px; }
    .summary-box { background: #f0fdfa; border: 2px solid #0d9488; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .baking-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .baking-qty { font-weight: bold; font-size: 18px; color: #0d9488; }
    .order-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .order-header { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .booking-id { font-weight: bold; font-size: 16px; }
    .total { color: #0d9488; font-weight: bold; }
    .items { color: #666; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>🥐 Bageri Bestillinger</h1>
  <p>Oversigt for <strong>${formattedDate}</strong></p>
  <p>Afhentning: ${settings.pickup_start_time || '08:00'} - ${settings.pickup_end_time || '10:00'}</p>
  
  <h2>🥖 Bage-liste (${orders.length} ordrer)</h2>
  <div class="summary-box">
    ${Object.entries(bakingList).map(([name, qty]) => `
      <div class="baking-item">
        <span>${name}</span>
        <span class="baking-qty">${qty} stk</span>
      </div>
    `).join('')}
  </div>

  <h2>📋 Kundeliste</h2>
  ${orders.map(order => `
    <div class="order-card">
      <div class="order-header">
        <span class="booking-id">Booking #${order.booking_nummer} - ${order.guest_name}</span>
        <span class="total">${order.total} kr</span>
      </div>
      <div class="items">
        ${(order.items || []).map((item: any) => `${item.quantity}x ${item.name}`).join(', ')}
      </div>
    </div>
  `).join('')}

  <div class="footer">
    <p>Sendt automatisk fra Jelling Camping gæsteportal</p>
    <p>Genereret: ${new Date().toLocaleString('da-DK')}</p>
  </div>
</body>
</html>
    `;

    // 7. Send email via main's send-email function
    let emailSent = false;
    
    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          to: notificationEmail,
          subject: `🥐 Bageri Bestillinger til ${formattedDate}`,
          html: emailHtml
        })
      });

      const emailResult = await emailResponse.json();
      emailSent = emailResult.success;
      
      if (emailSent) {
        console.log('✅ Email sent via send-email function');
      } else {
        console.error('Email send failed:', emailResult.error);
      }
    } catch (err) {
      console.error('Email send error:', err);
    }

    // 8. Log email sending
    await supabase.from('plugin_data').insert({
      organization_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      module: 'bakery_email_log',
      ref_id: 'email_' + Date.now(),
      key: 'daily_summary_' + pickupDate,
      data: {
        pickup_date: pickupDate,
        sent_to: notificationEmail,
        orders_count: orders.length,
        baking_list: bakingList,
        email_sent: emailSent,
        sent_at: new Date().toISOString()
      }
    });

    console.log(`✅ Daily summary complete: ${orders.length} orders, email ${emailSent ? 'sent' : 'not sent'}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Daily summary generated',
      pickup_date: pickupDate,
      orders_count: orders.length,
      baking_list: bakingList,
      email_sent: emailSent,
      sent_to: notificationEmail
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Bakery daily summary error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
