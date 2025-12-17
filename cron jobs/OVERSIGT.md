# Supabase Cron Jobs - Jelling Camping

**Hentet:** 16. december 2025
**Projekt:** jkmqliztlhmfyejhmuil
**Antal jobs:** 13

## Oversigt

| Job ID | Navn | Schedule | Type | Beskrivelse |
|--------|------|----------|------|-------------|
| 32 | refresh-latest-readings-every-minute | `* * * * *` | SQL | Opdaterer seneste måleraflæsninger |
| 33 | check-low-power-every-5min | `*/5 * * * *` | Edge Function | Tjekker for lav strøm og sender advarsler |
| 39 | auto-shutoff-meters-every-5min | `*/5 * * * *` | SQL | Slukker målere uden aktiv pakke |
| 40 | archive-and-cleanup-hourly | `0 * * * *` | Edge Function | Arkiverer og rydder op i måleraflæsninger |
| 35 | cleanup-expired-customers | `0 * * * *` | Edge Function | Rydder op i udløbne kunder |
| 31 | daily-meter-identity-snapshot | `0 3 * * *` | SQL | Dagligt snapshot af måler-identiteter |
| 41 | scheduled-emails-daily | `0 8 * * *` | Edge Function | Sender planlagte emails (velkomst osv.) |
| 29 | start-cleaning-power-daily | `0 9 * * *` | Edge Function | Tænder rengøringsstrøm kl. 10:00 dansk tid |
| 30 | end-cleaning-power-daily | `0 14 * * *` | Edge Function | Slukker rengøringsstrøm kl. 15:00 dansk tid |
| 3 | cleanup-expired-customers-daily | `0 16 * * *` | SQL | Rydder op i udløbne kunder (SQL version) |
| 23 | daily-package-snapshot-job | `59 23 * * *` | Edge Function | Dagligt snapshot af pakker |
| 36 | daily-accounting-report | `59 23 * * *` | Edge Function | Sender daglig bogføringsrapport |
| 4 | cleanup-checked-out-webhooks-weekly | `0 3 * * 0` | SQL | Ugentlig oprydning af webhook data |

## Schedule Format (Cron)

```
┌───────────── minut (0 - 59)
│ ┌───────────── time (0 - 23)
│ │ ┌───────────── dag i måneden (1 - 31)
│ │ │ ┌───────────── måned (1 - 12)
│ │ │ │ ┌───────────── ugedag (0 - 6) (søndag = 0)
│ │ │ │ │
* * * * *
```

**Bemærk:** Supabase bruger UTC tid. Danmark er UTC+1 (vinter) / UTC+2 (sommer).

---

## Detaljeret Oversigt

### 1. refresh-latest-readings-every-minute
- **Job ID:** 32
- **Schedule:** `* * * * *` (hvert minut)
- **Type:** SQL Function
- **Kommando:**
```sql
SELECT refresh_latest_meter_readings()
```
- **Formål:** Holder en cached view opdateret med seneste måleraflæsninger for hurtig adgang.

---

### 2. check-low-power-every-5min
- **Job ID:** 33
- **Schedule:** `*/5 * * * *` (hvert 5. minut)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/check-low-power`
- **Formål:** Tjekker alle aktive pakker for lav strøm og sender advarselsmails til kunder der er ved at løbe tør.

---

### 3. auto-shutoff-meters-every-5min
- **Job ID:** 39
- **Schedule:** `*/5 * * * *` (hvert 5. minut)
- **Type:** SQL Function
- **Kommando:**
```sql
SELECT auto_shutoff_meters_without_package()
```
- **Formål:** Slukker automatisk målere der ikke har en aktiv strømpakke tilknyttet.

---

### 4. archive-and-cleanup-hourly
- **Job ID:** 40
- **Schedule:** `0 * * * *` (hver hele time)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/archive-meter-readings`
- **Formål:** 
  - Arkiverer dagligt snapshot af måleraflæsninger (kun kl. 23:00)
  - Sletter gamle readings for at spare plads

---

### 5. cleanup-expired-customers
- **Job ID:** 35
- **Schedule:** `0 * * * *` (hver hele time)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/cleanup-expired-customers`
- **Formål:** Frigør målere og rydder op efter kunder der er tjekket ud.

---

### 6. daily-meter-identity-snapshot
- **Job ID:** 31
- **Schedule:** `0 3 * * *` (kl. 03:00 UTC = 04:00 dansk vintertid)
- **Type:** SQL Function
- **Kommando:**
```sql
SELECT take_meter_identity_snapshot()
```
- **Formål:** Gemmer dagligt snapshot af alle måler-identiteter for historisk reference.

---

### 7. scheduled-emails-daily
- **Job ID:** 41
- **Schedule:** `0 8 * * *` (kl. 08:00 UTC = 09:00 dansk vintertid)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/scheduled-emails`
- **Formål:** Sender velkomstemails og andre planlagte emails baseret på trigger_days_before.

---

### 8. start-cleaning-power-daily
- **Job ID:** 29
- **Schedule:** `0 9 * * *` (kl. 09:00 UTC = 10:00 dansk vintertid)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/start-cleaning-power`
- **Formål:** Tænder strøm på hytter med checkout i dag for rengøring.

---

### 9. end-cleaning-power-daily
- **Job ID:** 30
- **Schedule:** `0 14 * * *` (kl. 14:00 UTC = 15:00 dansk vintertid)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/end-cleaning-power`
- **Formål:** Slukker strøm på hytter efter rengøring er færdig.

---

### 10. cleanup-expired-customers-daily
- **Job ID:** 3
- **Schedule:** `0 16 * * *` (kl. 16:00 UTC = 17:00 dansk vintertid)
- **Type:** SQL Function
- **Kommando:**
```sql
SELECT manual.cleanup_expired_customers()
```
- **Formål:** Alternativ SQL-baseret oprydning af udløbne kunder.

---

### 11. daily-package-snapshot-job
- **Job ID:** 23
- **Schedule:** `59 23 * * *` (kl. 23:59 UTC)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/daily-package-snapshot`
- **Formål:** Gemmer dagligt snapshot af alle aktive strømpakker og deres forbrug.

---

### 12. daily-accounting-report
- **Job ID:** 36
- **Schedule:** `59 23 * * *` (kl. 23:59 UTC)
- **Type:** Edge Function
- **Endpoint:** `/functions/v1/daily-accounting-report`
- **Formål:** Sender daglig bogføringsrapport med Stripe-salg til bogholderi@jellingcamping.dk.

---

### 13. cleanup-checked-out-webhooks-weekly
- **Job ID:** 4
- **Schedule:** `0 3 * * 0` (søndag kl. 03:00 UTC)
- **Type:** SQL Function
- **Kommando:**
```sql
SELECT public.cleanup_checked_out_webhooks()
```
- **Formål:** Ugentlig oprydning af gamle webhook data fra udtjekkede bookinger.

---

## Administration

### Se alle cron jobs
```sql
SELECT * FROM cron.job ORDER BY jobname;
```

### Pause et job
```sql
UPDATE cron.job SET active = false WHERE jobname = 'job-navn';
```

### Genaktiver et job
```sql
UPDATE cron.job SET active = true WHERE jobname = 'job-navn';
```

### Slet et job
```sql
SELECT cron.unschedule('job-navn');
```

### Opret nyt job (Edge Function eksempel)
```sql
SELECT cron.schedule(
  'mit-nye-job',
  '0 * * * *',  -- hver time
  $$
  SELECT net.http_post(
    url := 'https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/min-function',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Opret nyt job (SQL Function eksempel)
```sql
SELECT cron.schedule(
  'mit-sql-job',
  '*/5 * * * *',  -- hvert 5. minut
  $$SELECT min_sql_function()$$
);
```

---

## Tidszoner

| UTC | Danmark (vinter) | Danmark (sommer) |
|-----|------------------|------------------|
| 00:00 | 01:00 | 02:00 |
| 03:00 | 04:00 | 05:00 |
| 08:00 | 09:00 | 10:00 |
| 09:00 | 10:00 | 11:00 |
| 14:00 | 15:00 | 16:00 |
| 16:00 | 17:00 | 18:00 |
| 23:59 | 00:59 | 01:59 |
