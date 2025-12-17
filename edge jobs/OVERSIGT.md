# Supabase Edge Functions - Jelling Camping

**Hentet:** 16. december 2025
**Projekt:** jkmqliztlhmfyejhmuil
**Antal funktioner:** 39 (37 fra Supabase + 2 lokale)

## Oversigt

| # | Funktion | Beskrivelse |
|---|----------|-------------|
| 1 | gate-open | Manuel åbning af bom via admin/staff |
| 2 | webhook | Sirvoy booking webhook - opretter/opdaterer kunder |
| 3 | axis-anpr-webhook | ANPR kamera - automatisk bom åbning |
| 4 | cleanup-expired-customers | Cron: Rydder op i udløbne kunder |
| 5 | toggle-power | Tænd/sluk strøm for gæster |
| 6 | send-email | Multi-provider email (SMTP/REST API) |
| 7 | send-email-brevo | Direkte Brevo email |
| 8 | monitor-power-usage | Cron: Overvåger strømforbrug |
| 9 | create-checkout | Opretter Stripe checkout session |
| 10 | stripe-webhook | Håndterer Stripe betalinger |
| 11 | daily-accounting-report | Cron: Daglig bogføringsrapport |
| 12 | archive-meter-readings | Cron: Arkiverer måleraflæsninger |
| 13 | cleanup-old-readings | Cron: Sletter gamle aflæsninger |
| 14 | send-low-power-warning | Sender advarsel ved lav strøm |
| 15 | check-low-power | Cron: Tjekker for lav strøm |
| 16 | daily-package-snapshot | Cron: Dagligt snapshot af pakker |
| 17 | send-warning-email | Sender advarselsemails fra kø |
| 18 | delete-meter | Sletter måler (admin) |
| 19 | start-cleaning-power | Cron: Tænder rengøringsstrøm |
| 20 | end-cleaning-power | Cron: Slukker rengøringsstrøm |
| 21 | rename-meter | Omdøber måler i Zigbee2MQTT |
| 22 | camera-snapshot | Henter snapshot fra bom-kamera |
| 23 | admin-bypass-meter | Admin bypass for måler |
| 24 | get-live-data | Henter live data for booking |
| 25 | get-guest-power-data | Henter strømdata for gæst |
| 26 | assign-meter | Tildeler måler til kunde |
| 27 | bakery-api | Bageri produkter og bestillinger |
| 28 | bakery-daily-summary | Cron: Daglig bageri opsummering |
| 29 | generate-magic-token | Genererer magic link token |
| 30 | validate-magic-link | Validerer magic link |
| 31 | get-guest-portal-data | Henter portal data for gæst |
| 32 | send-welcome-email | Sender velkomst email |
| 33 | scheduled-emails | Cron: Planlagte emails |
| 34 | portal-api | Events og info til portal |
| 35 | brevo-webhook | Modtager Brevo email events |
| 36 | get-guest-status | Henter gæstestatus |
| 37 | verify-plate | Verificerer nummerplade |

## Cron Jobs

Disse funktioner køres automatisk via Supabase cron:

- `cleanup-expired-customers` - Dagligt
- `monitor-power-usage` - Hvert 5. minut
- `daily-accounting-report` - Dagligt kl. 06:00
- `archive-meter-readings` - Hver time
- `check-low-power` - Hvert 15. minut
- `daily-package-snapshot` - Dagligt kl. 23:59
- `start-cleaning-power` - Dagligt kl. 10:00
- `end-cleaning-power` - Dagligt kl. 15:00
- `bakery-daily-summary` - Dagligt kl. 22:00
- `scheduled-emails` - Dagligt kl. 09:00

## Deploy

For at deploye en funktion:

```bash
supabase functions deploy <function-name>
```

For at deploye alle:

```bash
for dir in */; do supabase functions deploy "${dir%/}"; done
```
