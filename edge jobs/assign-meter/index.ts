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

    if (!booking_nummer || !meter_number) {
      throw new Error("Missing booking_nummer or meter_number");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Assigning meter ${meter_number} to booking ${booking_nummer}`);

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

    if (!meterData.is_available && meterData.current_customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Måler er optaget' }),
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
    
    const { error: updateError } = await supabase
      .from(customerTable)
      .update({
        meter_id: meter_number,
        meter_start_energy: startEnergy,
        updated_at: new Date().toISOString()
      })
      .eq('id', customerId);

    if (updateError) {
      console.error('Error updating customer:', updateError);
      throw new Error('Kunne ikke opdatere kunde');
    }

    // 5. Marker måler som optaget
    await supabase
      .from('power_meters')
      .update({
        is_available: false,
        current_customer_id: customerId,
        updated_at: new Date().toISOString()
      })
      .eq('id', meterData.id);

    console.log(`Meter ${meter_number} assigned to ${customerType} customer ${customerId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        meter_id: meter_number,
        start_energy: startEnergy 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in assign-meter:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
