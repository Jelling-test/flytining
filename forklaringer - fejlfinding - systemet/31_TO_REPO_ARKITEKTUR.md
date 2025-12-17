# 🔗 TO-REPO ARKITEKTUR

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

Systemet består af **to separate GitHub repos** der deployer til **to separate Vercel projekter**, men deler **samme Supabase database**.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              GITHUB                                      │
│                                                                          │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐   │
│  │ Jelling-test/           │      │ Jelling-test/                   │   │
│  │ test.af.system          │      │ implentering-af-personligside-  │   │
│  │                         │      │                                 │   │
│  │ Admin + Staff + Core    │      │ Gæsteportal                     │   │
│  └───────────┬─────────────┘      └──────────────┬──────────────────┘   │
│              │                                    │                      │
│              │ git push                           │ git push             │
│              ▼                                    ▼                      │
│  ┌─────────────────────────┐      ┌─────────────────────────────────┐   │
│  │ VERCEL                  │      │ VERCEL                          │   │
│  │                         │      │                                 │   │
│  │ test-af-system          │      │ jelling                         │   │
│  │ .vercel.app             │      │ .vercel.app                     │   │
│  └───────────┬─────────────┘      └──────────────┬──────────────────┘   │
│              │                                    │                      │
└──────────────┼────────────────────────────────────┼──────────────────────┘
               │                                    │
               └───────────────┬────────────────────┘
                               │
                               ▼
               ┌───────────────────────────────────┐
               │         SUPABASE                  │
               │                                   │
               │  jkmqliztlhmfyejhmuil             │
               │  .supabase.co                     │
               │                                   │
               │  • Samme database                 │
               │  • Samme Edge Functions           │
               │  • Samme Auth                     │
               └───────────────────────────────────┘
```

---

## 📦 REPO 1: test.af.system

### Info
| Parameter | Værdi |
|-----------|-------|
| **GitHub** | https://github.com/Jelling-test/test.af.system |
| **Vercel URL** | https://test-af-system.vercel.app |
| **Formål** | Admin, Staff, og Kundeflow |

### Indhold

**Routes:**
```
/                     # Landing page (kundeflow start)
/dashboard            # Kunde dashboard
/vaelg-maaler         # Vælg måler
/koeb-stroem          # Køb strøm

/staff/login          # Staff login
/staff/dashboard      # Staff dashboard
/staff/checkin        # Check-in
/staff/parring        # Parring
/staff/manuel-taend   # Manuel tænd

/admin/login          # Admin login
/admin/dashboard      # Admin dashboard
/admin/maalere        # Målere
/admin/kunder         # Kunder
/admin/pakker         # Pakker
/admin/kort           # Interaktivt kort
/admin/el-infrastruktur
/admin/standere
/admin/pladser
/admin/hytter
/admin/parring
/admin/manuel-taend
/admin/bom
/admin/cafe
/admin/bageri
/admin/events
/admin/rapporter
/admin/indstillinger
/admin/personale
/admin/gruppe-mails
... og flere
```

**Edge Functions (deployet til Supabase fra dette repo):**
- Alle 37 Edge Functions
- Webhooks (Sirvoy, Stripe, Brevo, ANPR)
- API endpoints
- Cron triggers

### Environment Variables (Vercel)
```env
VITE_SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 📦 REPO 2: implentering-af-personligside

### Info
| Parameter | Værdi |
|-----------|-------|
| **GitHub** | https://github.com/Jelling-test/implentering-af-personligside- |
| **Vercel URL** | https://jelling.vercel.app |
| **Formål** | Gæsteportal (kundens personlige sider) |

### Indhold

**Routes:**
```
/m/:bookingId/:token  # Magic link entry point

/guest                # Gæst dashboard
/guest/power          # Strøm
/guest/events         # Aktiviteter
/guest/bakery         # Bageri
/guest/cafe           # Café
/guest/pool           # Svømmehal
/guest/playground     # Legeplads
/guest/attractions    # Attraktioner
/guest/practical      # Praktisk info
/guest/cabin          # Hytte info
/guest/payment-success
/guest/departed
```

**Funktioner:**
- Multi-sprog (DA/EN/DE/NL)
- GuestContext (gæstedata + oversættelser)
- Ingen auth (kun magic link validering)

### Environment Variables (Vercel)
```env
VITE_SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 🔄 HVORDAN DE ARBEJDER SAMMEN

### 1. Magic Link Generering

**I test.af.system:**
```typescript
// Admin eller scheduled-emails kalder generate-magic-token
const response = await fetch('/functions/v1/generate-magic-token', {
  method: 'POST',
  body: JSON.stringify({ booking_id: 12345 })
});

const { magic_link } = await response.json();
// magic_link = "https://jelling.vercel.app/m/12345/abc123..."
```

**Edge Function hardcoder portal URL:**
```typescript
// generate-magic-token/index.ts
const PORTAL_URL = 'https://jelling.vercel.app';
const magicLink = `${PORTAL_URL}/m/${booking_id}/${token}`;
```

### 2. Magic Link Validering

**I implentering-af-personligside:**
```typescript
// MagicLinkEntry.tsx
const { bookingId, token } = useParams();

// Kalder SAMME Supabase Edge Function
const response = await fetch(
  'https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/validate-magic-link',
  {
    method: 'POST',
    body: JSON.stringify({ booking_id: bookingId, token })
  }
);

if (response.valid) {
  setGuestContext(response.customer);
  navigate('/guest');
}
```

### 3. Delt Database

Begge apps læser/skriver til **samme tabeller**:

```
test.af.system (Admin):
  → Opretter kunde i regular_customers
  → Genererer magic_token
  → Sender email med link til jelling.vercel.app

implentering-af-personligside (Gæst):
  → Validerer token mod regular_customers
  → Læser kundedata
  → Læser/opretter pakker i plugin_data
  → Læser events, products, osv.
```

### 4. Delte Edge Functions

Alle Edge Functions ligger i **test.af.system** repo og deployes til Supabase:

```
test.af.system/supabase/functions/
├── toggle-power/
├── create-checkout/
├── generate-magic-token/
├── validate-magic-link/
├── get-guest-portal-data/
├── ...
```

Begge apps kalder dem via samme URL:
```
https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/FUNCTION_NAME
```

---

## 📧 EMAIL FLOW

```
1. Booking oprettet (Sirvoy webhook → test.af.system)
   ↓
2. scheduled-emails (cron, 09:00) ELLER admin manuelt
   ↓
3. generate-magic-token opretter token
   ↓
4. send-welcome-email sender til gæst
   Indeholder: https://jelling.vercel.app/m/{booking}/{token}
   ↓
5. Gæst klikker link → åbner jelling.vercel.app
   ↓
6. validate-magic-link verificerer
   ↓
7. Gæst er logget ind på portalen
```

---

## 💳 BETALING FLOW

```
1. Gæst er på jelling.vercel.app/guest/power
   ↓
2. Klikker "Køb strøm"
   ↓
3. Kalder create-checkout (Supabase Edge Function)
   ↓
4. Stripe Checkout session oprettes
   success_url: https://jelling.vercel.app/guest/power?success=true
   ↓
5. Gæst betaler på Stripe
   ↓
6. Stripe sender webhook til test-af-system Edge Function
   ↓
7. stripe-webhook opretter pakke
   ↓
8. Gæst redirectes tilbage til jelling.vercel.app
```

---

## 🔧 DEPLOYMENT

### test.af.system

```bash
# Lokal udvikling
npm run dev

# Deploy til Vercel (automatisk ved push til main)
git push origin main

# Deploy Edge Functions til Supabase
cd supabase/functions
supabase functions deploy --project-ref jkmqliztlhmfyejhmuil
```

### implentering-af-personligside

```bash
# Lokal udvikling
npm run dev

# Deploy til Vercel (automatisk ved push til main)
git push origin main

# Ingen Edge Functions i dette repo
# Bruger funktioner fra test.af.system via Supabase URL
```

---

## ⚠️ VIGTIGE HUSKEREGLER

### Ved ændringer til Edge Functions
1. Ændr i **test.af.system/supabase/functions/**
2. Deploy til Supabase
3. Begge apps bruger automatisk den nye version

### Ved ændringer til database schema
1. Kør migration i Supabase
2. Opdater types i **begge repos** hvis nødvendigt

### Ved ændringer til PORTAL_URL
1. Ændr i **generate-magic-token/index.ts**
2. Ændr i **create-checkout/index.ts** (success_url)
3. Deploy Edge Functions

### Anon Key
- **Samme nøgle** bruges i begge repos
- Ændres den → opdater i begge Vercel projekter

---

## 📋 OPSUMMERING

| Aspekt | test.af.system | implentering-af-personligside |
|--------|----------------|-------------------------------|
| **Formål** | Admin + Staff | Gæsteportal |
| **URL** | test-af-system.vercel.app | jelling.vercel.app |
| **Auth** | Supabase Auth (email/password) | Magic Link (token) |
| **Edge Functions** | Deployes herfra | Kalder via URL |
| **Database** | Læser/skriver | Læser/skriver |
| **Supabase Project** | jkmqliztlhmfyejhmuil | jkmqliztlhmfyejhmuil |
