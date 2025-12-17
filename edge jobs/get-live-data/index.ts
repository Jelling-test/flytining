// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { bookingId } = await req.json()
    
    if (!bookingId) {
      return new Response(
        JSON.stringify({ error: 'Booking ID er påkrævet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Prøv først regular_customers
    const { data: regularCustomer, error: regularError } = await supabase
      .from('regular_customers')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle()

    // Hvis ikke fundet, prøv seasonal_customers
    let customer = regularCustomer
    let error = regularError

    if (!customer && !regularError) {
      const { data: seasonalCustomer, error: seasonalError } = await supabase
        .from('seasonal_customers')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle()
      
      customer = seasonalCustomer
      error = seasonalError
    }

    if (error) {
      console.error('Database fejl:', error)
      return new Response(
        JSON.stringify({ error: 'Database fejl' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Hvis ikke fundet i customer tabeller, søg i webhook_data (for udtjekkede gæster)
    if (!customer) {
      console.log('Kunde ikke fundet i customer tabeller, søger i webhook_data...')
      
      const { data: webhookData, error: webhookError } = await supabase
        .from('webhook_data')
        .select('raw_payload, created_at')
        .filter('raw_payload', 'like', `%"bookingId":${bookingId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (webhookError) {
        console.error('Webhook query fejl:', webhookError)
      }

      if (webhookData?.raw_payload) {
        try {
          const payload = JSON.parse(webhookData.raw_payload)
          console.log('Fandt webhook data for booking', bookingId, '- checked_out:', payload.bookingIsCheckedOut)
          
          // Map webhook data til guest format
          const guestData = {
            firstName: payload.guest?.firstName || '',
            lastName: payload.guest?.lastName || '',
            email: payload.guest?.email || null,
            language: payload.guest?.language || 'da',
            country: payload.guest?.country || 'DK',
            arrivalDate: payload.arrivalDate || '',
            departureDate: payload.departureDate || '',
            checkedIn: payload.bookingIsCheckedIn || false,
            checkedOut: payload.bookingIsCheckedOut || false,
            bookingType: payload.rooms?.[0]?.RoomTypeName?.toLowerCase().includes('hytte') ? 'cabin' : 'camping',
            previousVisits: 0,
            meterId: null,
            spotNumber: payload.rooms?.[0]?.RoomName || null
          }

          return new Response(
            JSON.stringify({ guest: guestData, source: 'webhook' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        } catch (parseError) {
          console.error('Kunne ikke parse webhook data:', parseError)
        }
      }

      // Virkelig ikke fundet nogen steder
      return new Response(
        JSON.stringify({ error: 'Booking ikke fundet' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Map database felter til guest data format (fra customer tabeller)
    const guestData = {
      firstName: customer.first_name || customer.firstname || '',
      lastName: customer.last_name || customer.lastname || '',
      email: customer.email || null,
      language: customer.language || 'da',
      country: customer.country || 'DK',
      arrivalDate: customer.arrival_date || customer.arrivaldate || '',
      departureDate: customer.departure_date || customer.departuredate || '',
      checkedIn: customer.checked_in || false,
      checkedOut: customer.checked_out || false,
      bookingType: customer.booking_type || 'camping',
      previousVisits: customer.previous_visits || 0,
      meterId: customer.meter_id || null,
      spotNumber: customer.spot_number || customer.spotnumber || null
    }

    return new Response(
      JSON.stringify({ guest: guestData, source: 'database' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error in get-live-data:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
