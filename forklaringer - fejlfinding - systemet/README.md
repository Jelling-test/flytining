# 📚 JELLING CAMPING STRØMSTYRINGSSYSTEM
## Komplet Dokumentation til Fejlsøgning og Genoprettelse

**Opdateret:** 16. december 2025  
**Version:** 3.0

---

## 🎯 HURTIG NAVIGATION

| Jeg vil... | Se fil |
|------------|--------|
| Forstå hele systemet | [01_SYSTEM_ARKITEKTUR.md](01_SYSTEM_ARKITEKTUR.md) |
| Fejlsøge et problem | [02_FEJLSØGNING.md](02_FEJLSØGNING.md) |
| Genopbygge systemet | [03_GENOPRETTELSE.md](03_GENOPRETTELSE.md) |
| Forstå MQTT/Zigbee | [04_MQTT_OG_ZIGBEE.md](04_MQTT_OG_ZIGBEE.md) |
| Se database struktur | [05_DATABASE.md](05_DATABASE.md) |
| Se Edge Functions | [06_EDGE_FUNCTIONS.md](06_EDGE_FUNCTIONS.md) |
| Se Cron Jobs | [07_CRON_JOBS.md](07_CRON_JOBS.md) |
| Tilføje ny måler | [08_TILFØJ_MÅLER.md](08_TILFØJ_MÅLER.md) |
| Opsætte nyt område | [09_NYT_OMRÅDE.md](09_NYT_OMRÅDE.md) |
| Se alle credentials | [10_CREDENTIALS.md](10_CREDENTIALS.md) |
| Forstå bom/kamera | [11_BOM_OG_KAMERA.md](11_BOM_OG_KAMERA.md) |
| Se NAS services | [12_NAS_SERVICES.md](12_NAS_SERVICES.md) |

---

## 🏗️ SYSTEM OVERBLIK

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
└─────────────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   VERCEL CDN     │  │   SUPABASE       │  │ EKSTERNE SERVICES│
│                  │  │                  │  │                  │
│ • Admin Portal   │  │ • PostgreSQL DB  │  │ • Stripe         │
│   test-af-system │  │ • 37 Edge Func   │  │ • Brevo Email    │
│   .vercel.app    │  │ • 13 Cron Jobs   │  │ • Sirvoy Booking │
│                  │  │ • Auth + Storage │  │ • Axis ANPR      │
│ • Gæsteportal    │  │                  │  │                  │
│   jelling.       │  │ jkmqliztlhmfy... │  │                  │
│   vercel.app     │  │ .supabase.co     │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
           │                    │                    │
           └────────────────────┼────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         NAS SERVER (192.168.9.61)                        │
│                                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ Mosquitto  │  │ Zigbee2MQTT│  │ device-    │  │ command-   │         │
│  │ MQTT:1890  │◄─┤ x7 instans │  │ sync.py    │  │ processor  │         │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │
│        │                │              │               │                 │
│        ▼                ▼              ▼               ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │         7 SLZB-06M COORDINATORS (Zigbee netværk)            │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                   360+ STRØMMÅLERE                          │        │
│  │              (TS011F Zigbee / OpenBeken BK7231N)            │        │
│  └─────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 NØGLETAL

| Metrik | Værdi |
|--------|-------|
| **Strømmålere** | 360+ |
| **Zigbee Områder** | 7 (6 normale + 3-fase) |
| **Edge Functions** | 37 |
| **Cron Jobs** | 13 |
| **Database Tabeller** | 25+ |
| **Frontend Apps** | 2 |

---

## 🔗 VIGTIGE LINKS

### Cloud Services
| Service | URL |
|---------|-----|
| **Supabase Dashboard** | https://supabase.com/dashboard/project/jkmqliztlhmfyejhmuil |
| **Admin Portal** | https://test-af-system.vercel.app |
| **Gæsteportal** | https://jelling.vercel.app |
| **Stripe Dashboard** | https://dashboard.stripe.com |
| **Brevo Dashboard** | https://app.brevo.com |

### NAS Services (192.168.9.61)
| Service | URL |
|---------|-----|
| **Zigbee2MQTT Område 1** | http://192.168.9.61:8082 |
| **Zigbee2MQTT Område 2** | http://192.168.9.61:8083 |
| **Zigbee2MQTT Område 3** | http://192.168.9.61:8084 |
| **Zigbee2MQTT Område 4** | http://192.168.9.61:8085 |
| **Zigbee2MQTT Område 5** | http://192.168.9.61:8086 |
| **Zigbee2MQTT Område 6** | http://192.168.9.61:8087 |
| **Zigbee2MQTT 3-fase** | http://192.168.9.61:8088 |
| **Home Assistant** | http://192.168.9.61:8124 |

---

## 🚨 NØDSITUATIONER

### Alt er nede - Hvad gør jeg?

**Trin 1:** Tjek NAS
```bash
ping 192.168.9.61
```

**Trin 2:** SSH og genstart Docker
```bash
ssh jc@192.168.9.61
cd /volume1/docker/jelling-power-system
sudo docker compose restart
```

**Trin 3:** Tjek status
```bash
sudo docker ps
```

➡️ **Detaljeret guide:** [02_FEJLSØGNING.md](02_FEJLSØGNING.md)

---

## 📁 DOKUMENTATIONSOVERSIGT

### Basis Dokumentation (Fejlsøgning)
| # | Fil | Indhold |
|---|-----|---------|
| 01 | [SYSTEM_ARKITEKTUR.md](01_SYSTEM_ARKITEKTUR.md) | Komplet systemdiagram, komponenter, dataflow |
| 02 | [FEJLSØGNING.md](02_FEJLSØGNING.md) | Systematisk fejlfinding, symptomer, løsninger |
| 03 | [GENOPRETTELSE.md](03_GENOPRETTELSE.md) | Disaster recovery, backup, genopbygning |
| 04 | [MQTT_OG_ZIGBEE.md](04_MQTT_OG_ZIGBEE.md) | MQTT topics, Zigbee2MQTT config, coordinators |
| 05 | [DATABASE.md](05_DATABASE.md) | Tabeller, views, RPC funktioner |
| 06 | [EDGE_FUNCTIONS.md](06_EDGE_FUNCTIONS.md) | Alle 37 Edge Functions dokumenteret |
| 07 | [CRON_JOBS.md](07_CRON_JOBS.md) | Alle 13 planlagte jobs |
| 08 | [TILFØJ_MÅLER.md](08_TILFØJ_MÅLER.md) | Guide til at tilføje ny måler |
| 09 | [NYT_OMRÅDE.md](09_NYT_OMRÅDE.md) | Guide til at opsætte nyt Zigbee område |
| 10 | [CREDENTIALS.md](10_CREDENTIALS.md) | Alle adgangskoder og API keys |
| 11 | [BOM_OG_KAMERA.md](11_BOM_OG_KAMERA.md) | ANPR, bom styring, kamera API |
| 12 | [NAS_SERVICES.md](12_NAS_SERVICES.md) | Alle Docker containers på NAS |

### Genopbygning (Lovable-ready)
| # | Fil | Indhold |
|---|-----|---------|
| 20 | [DATABASE_SCHEMA_SQL.md](20_DATABASE_SCHEMA_SQL.md) | Komplet SQL til at oprette alle tabeller |
| 21 | [FRONTEND_STRUKTUR.md](21_FRONTEND_STRUKTUR.md) | React komponenter, routes, hooks, contexts |
| 22 | [EDGE_FUNCTIONS_KODE.md](22_EDGE_FUNCTIONS_KODE.md) | Komplet TypeScript kode for Edge Functions |
| 23 | [BRUGERFLOWS_OG_UI.md](23_BRUGERFLOWS_OG_UI.md) | User flows, UI specs, design system |
| 24 | [INTEGRATIONER.md](24_INTEGRATIONER.md) | Sirvoy, Stripe, Brevo, Axis ANPR setup |

### Detaljeret Funktionsdokumentation
| # | Fil | Indhold |
|---|-----|---------|
| 25 | [KOMPLET_FUNKTIONSOVERSIGT.md](25_KOMPLET_FUNKTIONSOVERSIGT.md) | Alle admin/staff/gæst sider og funktioner |
| 26 | [KORT_OG_INFRASTRUKTUR.md](26_KORT_OG_INFRASTRUKTUR.md) | Interaktivt kort, el-infrastruktur, standere |
| 27 | [PARRING_OG_MAALER_SETUP.md](27_PARRING_OG_MAALER_SETUP.md) | Parring af målere, navngivning, fejlfinding |
| 28 | [RAPPORTER_OG_STATISTIK.md](28_RAPPORTER_OG_STATISTIK.md) | Alle rapporttyper, grafer, eksport |
| 29 | [GAESTE_FUNKTIONER.md](29_GAESTE_FUNKTIONER.md) | Gæsteportal, magic link, multi-sprog |
| 30 | [CAFE_OG_BAGERI.md](30_CAFE_OG_BAGERI.md) | Bestillingssystemer, kapacitet, timeslots |
| 31 | [TO_REPO_ARKITEKTUR.md](31_TO_REPO_ARKITEKTUR.md) | **To GitHub repos, Vercel deploy, delt Supabase** |

### Komplet Genopbygning (Alt kode)
| # | Fil | Indhold |
|---|-----|---------|
| 40 | [DOCKER_COMPOSE.md](40_DOCKER_COMPOSE.md) | **Komplet docker-compose.yml, .env, configs** |
| 41 | [ALLE_EDGE_FUNCTIONS.md](41_ALLE_EDGE_FUNCTIONS.md) | **Alle 37 Edge Functions med kode** |
| 42 | [GUEST_CONTEXT.md](42_GUEST_CONTEXT.md) | **Komplet multi-sprog context (DA/EN/DE/NL)** |
| 43 | [LOVABLE_PROMPTS.md](43_LOVABLE_PROMPTS.md) | **15 trin-for-trin prompts til at bygge systemet** |

---

## 📝 ÆNDRINGSLOG

| Dato | Ændring |
|------|---------|
| 16.12.2025 | Konsolideret dokumentation fra 80+ filer |
| 16.12.2025 | Opdateret til 37 Edge Functions (var 22) |
| 16.12.2025 | Opdateret til 13 Cron Jobs |
| 16.12.2025 | Fjernet HA integration (bruges kun til statistik) |
| 16.12.2025 | Tilføjet 7 Zigbee områder (var 2) |
