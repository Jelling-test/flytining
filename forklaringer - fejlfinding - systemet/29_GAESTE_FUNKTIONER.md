# 🎫 GÆSTE FUNKTIONER

**Opdateret:** 16. december 2025

---

## 📊 OVERSIGT

Komplet guide til gæsteportalens funktioner (jelling.vercel.app).

---

## 🔐 ADGANG TIL PORTAL

### Magic Link Flow

```
1. Gæst booker via Sirvoy
   ↓
2. Sirvoy webhook → regular_customers
   ↓
3. scheduled-emails sender velkomst (09:00)
   ELLER admin sender manuelt
   ↓
4. Email med magic link:
   https://jelling.vercel.app/m/{booking_id}/{token}
   ↓
5. Gæst klikker → validate-magic-link
   ↓
6. Token valid → GuestContext → Dashboard
```

### Token Validering

**Tjekkes:**
- Token matcher booking
- Booking periode er aktiv (ankomst ≤ nu ≤ afrejse)
- Kunde er ikke checked out

**Fejl:**
- "Ugyldigt link" → Token forkert
- "Booking ikke aktiv" → Uden for periode
- "Allerede checked ud" → Opholdet er slut

---

## 🏠 DASHBOARD (`/guest` eller `/guest/dashboard`)

### Layout

```
┌─────────────────────────────────────────────┐
│ 🏕️ Jelling Camping        [DA][EN][DE][NL] │
│                                              │
│ Velkommen, Peter!                            │
│ Plads: F44 | 20-27 dec 2025                  │
├─────────────────────────────────────────────┤
│                                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │ ⚡      │ │ 📅      │ │ 🥐      │         │
│ │ Strøm   │ │ Events  │ │ Bageri  │         │
│ └─────────┘ └─────────┘ └─────────┘         │
│                                              │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │ 🍽️      │ │ 🏊      │ │ ℹ️      │         │
│ │ Café    │ │ Pool    │ │ Praktisk│         │
│ └─────────┘ └─────────┘ └─────────┘         │
│                                              │
└─────────────────────────────────────────────┘
```

### Navigation Cards

| Kort | Side | Beskrivelse |
|------|------|-------------|
| ⚡ Strøm | /guest/power | Køb og administrer strøm |
| 📅 Events | /guest/events | Se aktiviteter |
| 🥐 Bageri | /guest/bakery | Bestil morgenbrød |
| 🍽️ Café | /guest/cafe | Bestil aftensmad |
| 🏊 Svømmehal | /guest/pool | Åbningstider |
| ℹ️ Praktisk | /guest/practical | WiFi, regler, kontakt |
| 🎠 Attraktioner | /guest/attractions | Se attraktioner |
| 🛝 Legeplads | /guest/playground | Faciliteter |
| 🏠 Hytte | /guest/cabin | Kun for hyttegæster |

---

## ⚡ STRØM (`/guest/power`)

### Visning

**Aktiv pakke:**
- Progress bar (% tilbage)
- kWh tilbage / total
- Advarsel ved < 20%

**Måler status:**
- Online/Offline
- Tændt/Slukket
- Aktuel effekt (W)

### Funktioner

**Køb strøm:**
1. Klik "Køb strøm"
2. Vælg pakke (25/50/100 kWh) eller custom
3. Redirect til Stripe
4. Betal
5. Tilbage til portal med aktiv pakke

**Tænd/sluk:**
- Kun hvis aktiv pakke
- Knapper: [TÆND] [SLUK]
- Bekræftelsesdialog ved sluk

**Historik:**
- Graf over forbrug
- Tabel med dagligt forbrug

### Implementation

```tsx
// GuestPower.tsx struktur
function GuestPower() {
  const { guest, t } = useGuestContext();
  const [package, setPackage] = useState(null);
  const [meter, setMeter] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackageAndMeter();
  }, []);

  const buyPackage = async (amount: number) => {
    const response = await fetch('/functions/v1/create-checkout', {
      method: 'POST',
      body: JSON.stringify({
        booking_id: guest.booking_id,
        package_type: 'running',
        amount,
        customer_type: guest.type
      })
    });
    const { url } = await response.json();
    window.location.href = url;
  };

  const togglePower = async (state: 'ON' | 'OFF') => {
    await fetch('/functions/v1/toggle-power', {
      method: 'POST',
      body: JSON.stringify({
        meter_id: meter.meter_number,
        state,
        source: 'guest_portal'
      })
    });
    // Refresh meter status
  };

  return (
    <div>
      <PackageCard package={package} onBuy={() => setShowBuyDialog(true)} />
      <MeterCard meter={meter} onToggle={togglePower} />
      <ConsumptionHistory meterId={meter?.meter_number} />
    </div>
  );
}
```

---

## 🥐 BAGERI (`/guest/bakery`)

### Funktioner

**Se produkter:**
- Liste over tilgængelige produkter
- Billede, navn, pris
- Beskrivelse

**Bestil:**
1. Vælg produkter og antal
2. Vælg afhentningsdato (kun fremtidige)
3. Bekræft bestilling
4. Bestilling gemmes

**Mine bestillinger:**
- Liste over egne bestillinger
- Status (pending/confirmed)
- Annuller (hvis inden deadline)

### Deadline

- Bestilling til næste dag: Inden kl. 18:00
- Bestilling til senere: Altid muligt

---

## 🍽️ CAFÉ (`/guest/cafe`)

### Funktioner

**Se tilbud:**
- Aktive måltidstilbud
- Billede, beskrivelse, pris
- Tilgængelige timeslots

**Bestil:**
1. Vælg tilbud
2. Vælg type (spis her / takeaway)
3. Vælg timeslot
4. Vælg antal
5. Bekræft (bindende!)

**Kapacitet:**
- System tjekker kapacitet per timeslot
- Viser "Udsolgt" hvis fuldt

**Mine bestillinger:**
- Liste over egne bestillinger
- Kan annulleres inden deadline

### Regler

- 1 bestilling per kunde per tilbud
- Bindende bestilling (ingen refund)
- Annullering inden deadline muligt

---

## 📅 EVENTS (`/guest/events`)

### Visning

- Kommende events
- Filtrer på dato
- Multi-sprog (viser brugerens sprog)

### Event kort

```
┌─────────────────────────────────────┐
│ [Billede]                           │
├─────────────────────────────────────┤
│ Bingo Aften                         │
│ 📅 Lørdag 21. december              │
│ 🕐 19:00 - 21:00                    │
│ 📍 Festsalen                        │
│                                      │
│ Kom og vær med til hyggeligt bingo! │
│ Præmier til vinderne.               │
└─────────────────────────────────────┘
```

---

## 🏊 SVØMMEHAL (`/guest/pool`)

### Indhold

- Åbningstider (per ugedag)
- Regler
- Faciliteter
- Kontakt ved spørgsmål

### Data fra `pool_settings` tabel

```sql
{
  opening_hours: {
    monday: { open: "08:00", close: "20:00" },
    tuesday: { open: "08:00", close: "20:00" },
    ...
  },
  rules_da: "Badedragt påkrævet...",
  rules_en: "Swimsuit required...",
  ...
}
```

---

## ℹ️ PRAKTISK (`/guest/practical`)

### Sektioner

**WiFi:**
- Netværksnavn
- Password

**Check-in/out:**
- Check-in tid
- Check-out tid

**Kontakt:**
- Telefon
- Email
- Adresse

**Regler:**
- Støjregler
- Affaldssortering
- Parkering
- Husdyr

---

## 🏠 HYTTE (`/guest/cabin`)

**Kun synlig for hyttegæster** (tjekkes via booking data)

### Ankomst checkliste

- Tjek inventar
- Meld mangler til reception
- Kontaktinfo

### Afrejse checkliste

- Affald fjernet ✓
- Opvask taget ✓
- Sengelinned pillet af ✓
- Køleskab tømt ✓
- ...

Hvert punkt har gebyr hvis ikke udført.

### Inventar

Liste over hvad der er i hytten:
- Køkkenudstyr
- Sengetøj info
- Rengøringsartikler

---

## 🌍 MULTI-SPROG

### Understøttede sprog

| Kode | Sprog | Flag |
|------|-------|------|
| da | Dansk | 🇩🇰 |
| en | English | 🇬🇧 |
| de | Deutsch | 🇩🇪 |
| nl | Nederlands | 🇳🇱 |

### Implementation

```tsx
// GuestContext.tsx
const translations = {
  da: {
    welcome: 'Velkommen',
    power: 'Strøm',
    buy_power: 'Køb strøm',
    remaining: 'Tilbage',
    ...
  },
  en: {
    welcome: 'Welcome',
    power: 'Power',
    buy_power: 'Buy power',
    remaining: 'Remaining',
    ...
  },
  de: {...},
  nl: {...}
};

export function useGuestContext() {
  const [language, setLanguage] = useState('da');
  
  const t = (key: string) => {
    return translations[language][key] || key;
  };
  
  return { language, setLanguage, t, ... };
}
```

### Sprogvalg

- Dropdown i header
- Gemmes i localStorage
- Default fra booking (language felt)
