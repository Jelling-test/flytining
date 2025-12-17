import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Konfiguration
const RETENTION_HOURS = 1; // Slet readings ældre end 1 time
const BATCH_SIZE = 10000; // Slet i batches

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("=".repeat(50));
    console.log("ARCHIVE & CLEANUP - Started");
    console.log(`Retention: ${RETENTION_HOURS} hour(s)`);
    console.log("=".repeat(50));

    const now = new Date();
    let totalArchived = 0;
    let totalDeleted = 0;

    // ========================================
    // STEP 1: ARKIVER DAGLIGT SNAPSHOT (kun kl 23:00-23:59 dansk tid)
    // ========================================
    const currentHour = now.getUTCHours();
    
    // 22 UTC = 23 dansk vintertid, 21 UTC = 23 dansk sommertid
    if (currentHour === 22 || currentHour === 21) {
      console.log("\n📸 Step 1: Archiving daily snapshot...");

      // Hent alle målere
      const { data: meters, error: metersError } = await supabase
        .from("power_meters")
        .select("meter_number");

      if (metersError) throw metersError;
      console.log(`Found ${meters?.length || 0} meters`);

      // For hver måler, arkiver seneste reading
      for (const meter of meters || []) {
        const { data: reading, error: readingError } = await supabase
          .from("meter_readings")
          .select("*")
          .eq("meter_id", meter.meter_number)
          .order("time", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (readingError) {
          console.error(`Error: ${meter.meter_number}:`, readingError.message);
          continue;
        }

        if (reading) {
          // Brug snapshot_time kolonne (IKKE snapshot_label)
          const { error: insertError } = await supabase
            .from("meter_readings_history")
            .insert({
              meter_id: reading.meter_id,
              time: reading.time,
              energy: reading.energy,
              power: reading.power,
              current: reading.current,
              voltage: reading.voltage,
              state: reading.state,
              snapshot_time: "23:59",
            });

          if (insertError && !insertError.message.includes("duplicate")) {
            console.error(`Archive error ${meter.meter_number}:`, insertError.message);
          } else {
            totalArchived++;
          }
        }
      }

      console.log(`✅ Archived ${totalArchived} daily snapshots`);
    } else {
      console.log(`\n⏭️ Step 1: Skipping archive (hour=${currentHour} UTC, need 21 or 22)`);
    }

    // ========================================
    // STEP 2: SLET GAMLE READINGS (via rå SQL)
    // ========================================
    console.log("\n🗑️ Step 2: Cleaning up old readings...");

    // Brug rå SQL fordi .limit() ikke virker med .delete() i Supabase JS
    let batchCount = 0;
    let deletedInBatch = 0;
    const maxBatches = 50; // Max 50 batches per kørsel for at undgå timeout

    do {
      const { data, error } = await supabase.rpc('delete_old_meter_readings', {
        retention_hours: RETENTION_HOURS,
        batch_size: BATCH_SIZE
      });

      if (error) {
        // Hvis RPC ikke findes, prøv direkte SQL
        if (error.message.includes('function') || error.message.includes('does not exist')) {
          console.log("RPC not found, using direct SQL...");
          
          const { data: sqlResult, error: sqlError } = await supabase
            .from('meter_readings')
            .delete()
            .lt('time', new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString());
          
          if (sqlError) {
            console.error("SQL delete error:", sqlError.message);
            break;
          }
          
          // Uden limit sletter den ALT på én gang
          console.log("Deleted all old readings in one go");
          totalDeleted = -1; // Ukendt antal
          break;
        }
        
        console.error("Delete error:", error.message);
        break;
      }

      deletedInBatch = data || 0;
      totalDeleted += deletedInBatch;
      batchCount++;

      if (deletedInBatch > 0) {
        console.log(`Batch ${batchCount}: Deleted ${deletedInBatch} readings (total: ${totalDeleted})`);
      }

      // Lille pause mellem batches
      if (deletedInBatch === BATCH_SIZE) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } while (deletedInBatch === BATCH_SIZE && batchCount < maxBatches);

    if (totalDeleted === -1) {
      console.log(`✅ Deleted all old readings`);
    } else {
      console.log(`✅ Deleted ${totalDeleted} old readings in ${batchCount} batches`);
    }

    // ========================================
    // DONE
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("ARCHIVE & CLEANUP - Complete");
    console.log(`Archived: ${totalArchived} snapshots`);
    console.log(`Deleted: ${totalDeleted} readings`);
    console.log("=".repeat(50));

    return new Response(
      JSON.stringify({
        success: true,
        archived: totalArchived,
        deleted: totalDeleted,
        retention_hours: RETENTION_HOURS,
        batches: batchCount,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
