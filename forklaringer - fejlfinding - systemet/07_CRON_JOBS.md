# ⏰ CRON JOBS

**Opdateret:** 16. december 2025  
**Antal:** 13 jobs

---

## 📊 OVERSIGT

| Frekvens | Antal | Jobs |
|----------|-------|------|
| Hvert minut | 1 | refresh-latest-readings |
| Hvert 5. min | 2 | check-low-power, auto-shutoff |
| Hver time | 2 | archive-readings, cleanup-customers |
| Dagligt | 7 | emails, rapporter, cleaning power |
| Ugentligt | 1 | cleanup-webhooks |

---

## ⚡ HVERT MINUT

### refresh-latest-readings-every-minute
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `* * * * *` |
| **Type** | SQL Function |
| **Funktion** | `refresh_latest_meter_readings()` |

**Formål:** Opdaterer materialized view med seneste måleraflæsninger for hurtig adgang.

---

## 🔄 HVERT 5. MINUT

### check-low-power-every-5min
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `*/5 * * * *` |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/check-low-power` |

**Formål:** Tjekker alle aktive pakker for lav strøm og sender advarselsmails.

### auto-shutoff-meters-every-5min
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `*/5 * * * *` |
| **Type** | SQL Function |
| **Funktion** | `auto_shutoff_meters_without_package()` |

**Formål:** Slukker automatisk målere uden aktiv pakke.

---

## 🕐 HVER TIME

### archive-and-cleanup-hourly
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 * * * *` |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/archive-meter-readings` |

**Formål:** 
- Arkiverer dagligt snapshot (kun kl. 23:00)
- Sletter gamle readings løbende

### cleanup-expired-customers
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 * * * *` |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/cleanup-expired-customers` |

**Formål:** Frigør målere og rydder data for udtjekkede kunder.

---

## 📅 DAGLIGT

### daily-meter-identity-snapshot (04:00 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 3 * * *` (03:00 UTC) |
| **Type** | SQL Function |
| **Funktion** | `take_meter_identity_snapshot()` |

**Formål:** Gemmer dagligt backup af IEEE → Navn mapping.

### scheduled-emails-daily (09:00 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 8 * * *` (08:00 UTC) |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/scheduled-emails` |

**Formål:** Sender velkomst- og reminder emails baseret på templates.

### start-cleaning-power-daily (10:00 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 9 * * *` (09:00 UTC) |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/start-cleaning-power` |

**Formål:** Tænder strøm på hytter med checkout i dag for rengøring.

### end-cleaning-power-daily (15:00 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 14 * * *` (14:00 UTC) |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/end-cleaning-power` |

**Formål:** Slukker strøm på hytter efter rengøring.

### cleanup-expired-customers-daily (17:00 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 16 * * *` (16:00 UTC) |
| **Type** | SQL Function |
| **Funktion** | `manual.cleanup_expired_customers()` |

**Formål:** Ekstra daglig oprydning af udløbne kunder.

### daily-package-snapshot-job (00:59 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `59 23 * * *` (23:59 UTC) |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/daily-package-snapshot` |

**Formål:** Gemmer dagligt snapshot af alle pakker for statistik.

### daily-accounting-report (00:59 DK)
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `59 23 * * *` (23:59 UTC) |
| **Type** | Edge Function |
| **Endpoint** | `/functions/v1/daily-accounting-report` |

**Formål:** Sender daglig bogføringsrapport til bogholderi.

---

## 📆 UGENTLIGT

### cleanup-checked-out-webhooks-weekly
| Parameter | Værdi |
|-----------|-------|
| **Schedule** | `0 3 * * 0` (søndag 04:00 DK) |
| **Type** | SQL Function |
| **Funktion** | `cleanup_checked_out_webhooks()` |

**Formål:** Sletter gamle webhook data fra udtjekkede bookings.

---

## 🔧 ADMINISTRATION

### Se alle jobs
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

### Se seneste kørsler
```sql
SELECT jobname, status, start_time, end_time 
FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

### Pause et job
```sql
UPDATE cron.job SET active = false WHERE jobname = 'job-navn';
```

### Genaktiver et job
```sql
UPDATE cron.job SET active = true WHERE jobname = 'job-navn';
```

### Kør job manuelt
Edge Functions kan kaldes direkte:
```bash
curl -X POST https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/FUNCTION_NAME \
  -H "Authorization: Bearer SERVICE_ROLE_KEY"
```

---

## ⏱️ TIDSZONER

Supabase cron bruger **UTC**. Danmark er:
- **Vintertid:** UTC+1
- **Sommertid:** UTC+2

| UTC | Danmark (vinter) | Danmark (sommer) |
|-----|------------------|------------------|
| 03:00 | 04:00 | 05:00 |
| 08:00 | 09:00 | 10:00 |
| 09:00 | 10:00 | 11:00 |
| 14:00 | 15:00 | 16:00 |
| 23:59 | 00:59 | 01:59 |
