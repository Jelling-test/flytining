# 🖥️ FRONTEND STRUKTUR - Komplet Guide

**Opdateret:** 16. december 2025  
**Framework:** React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui

---

## 📊 TO SEPARATE APPS

| App | Repository | URL | Formål |
|-----|------------|-----|--------|
| **Admin/Staff** | test.af.system | test-af-system.vercel.app | Administration |
| **Gæsteportal** | implentering-af-personligside | jelling.vercel.app | Gæstesider |

Begge bruger **samme Supabase database**.

---

## 📁 MAPPESTRUKTUR

```
src/
├── components/
│   ├── ui/                    # shadcn/ui komponenter
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   └── ...
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── meters/
│   │   ├── MeterCard.tsx
│   │   ├── MeterList.tsx
│   │   └── MeterControls.tsx
│   ├── customers/
│   │   ├── CustomerCard.tsx
│   │   └── CustomerList.tsx
│   └── packages/
│       ├── PackageCard.tsx
│       └── BuyPackage.tsx
│
├── pages/
│   ├── admin/
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminMaalere.tsx
│   │   ├── AdminKunder.tsx
│   │   ├── AdminPakker.tsx
│   │   ├── AdminBom.tsx
│   │   ├── AdminCafe.tsx
│   │   └── AdminGuide.tsx
│   ├── staff/
│   │   ├── StaffDashboard.tsx
│   │   ├── StaffCheckin.tsx
│   │   └── StaffGuide.tsx
│   ├── guest/
│   │   ├── GuestDashboard.tsx
│   │   ├── GuestPower.tsx
│   │   ├── GuestEvents.tsx
│   │   ├── GuestBakery.tsx
│   │   ├── GuestCafe.tsx
│   │   └── GuestPractical.tsx
│   ├── Index.tsx              # Landing/login
│   ├── Dashboard.tsx          # Kunde dashboard
│   └── NotFound.tsx
│
├── hooks/
│   ├── useAuth.ts
│   ├── useMeter.ts
│   ├── useCustomer.ts
│   ├── usePackage.ts
│   └── useRealtime.ts
│
├── contexts/
│   ├── AuthContext.tsx
│   ├── GuestContext.tsx       # Multi-sprog + gæstedata
│   └── ThemeContext.tsx
│
├── lib/
│   ├── supabase.ts            # Supabase client
│   ├── utils.ts               # Hjælpefunktioner
│   └── constants.ts
│
├── types/
│   ├── database.ts            # Supabase types
│   ├── customer.ts
│   ├── meter.ts
│   └── package.ts
│
├── App.tsx                    # Router setup
├── main.tsx                   # Entry point
└── index.css                  # Tailwind imports
```

---

## 🛣️ ROUTES

### Admin/Staff App (test.af.system)

```tsx
// App.tsx routes
<Routes>
  {/* Public */}
  <Route path="/" element={<Index />} />
  <Route path="/dashboard" element={<Dashboard />} />
  <Route path="/vaelg-maaler" element={<VaelgMaaler />} />
  <Route path="/koeb-stroem" element={<KoebStroem />} />
  
  {/* Staff */}
  <Route path="/staff/login" element={<StaffLogin />} />
  <Route path="/staff/dashboard" element={<StaffDashboard />} />
  <Route path="/staff/checkin" element={<StaffCheckin />} />
  
  {/* Admin */}
  <Route path="/admin/login" element={<AdminLogin />} />
  <Route path="/admin/dashboard" element={<AdminDashboard />} />
  <Route path="/admin/maalere" element={<AdminMaalere />} />
  <Route path="/admin/kunder" element={<AdminKunder />} />
  <Route path="/admin/pakker" element={<AdminPakker />} />
  <Route path="/admin/bom" element={<AdminBom />} />
  <Route path="/admin/cafe" element={<AdminCafe />} />
  <Route path="/admin/events" element={<AdminEvents />} />
  <Route path="/admin/guide" element={<AdminGuide />} />
</Routes>
```

### Gæsteportal (implentering-af-personligside)

```tsx
<Routes>
  {/* Magic link entry */}
  <Route path="/m/:bookingId/:token" element={<MagicLinkEntry />} />
  
  {/* Guest pages (requires GuestContext) */}
  <Route path="/guest" element={<GuestLayout />}>
    <Route index element={<GuestDashboard />} />
    <Route path="power" element={<GuestPower />} />
    <Route path="events" element={<GuestEvents />} />
    <Route path="bakery" element={<GuestBakery />} />
    <Route path="cafe" element={<GuestCafe />} />
    <Route path="practical" element={<GuestPractical />} />
    <Route path="pool" element={<GuestPool />} />
    <Route path="playground" element={<GuestPlayground />} />
    <Route path="cabin" element={<GuestCabin />} />
  </Route>
</Routes>
```

---

## 🔐 AUTHENTICATION

### Admin/Staff Login
```tsx
// Supabase Auth med email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
});

// Tjek rolle efter login
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

if (roles?.some(r => r.role === 'admin')) {
  navigate('/admin/dashboard');
} else if (roles?.some(r => r.role === 'staff')) {
  navigate('/staff/dashboard');
}
```

### Gæst Magic Link
```tsx
// MagicLinkEntry.tsx
const { bookingId, token } = useParams();

// Valider token via Edge Function
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/validate-magic-link`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: bookingId, token })
  }
);

const data = await response.json();

if (data.valid) {
  // Gem i GuestContext
  setGuestData(data.customer);
  navigate('/guest');
} else {
  setError('Invalid or expired link');
}
```

---

## 🌍 MULTI-SPROG (GuestContext)

```tsx
// contexts/GuestContext.tsx
interface GuestContextType {
  guest: GuestData | null;
  language: 'da' | 'en' | 'de' | 'nl';
  setLanguage: (lang: string) => void;
  t: (key: string) => string;  // Translate function
}

const translations = {
  da: {
    welcome: 'Velkommen',
    power: 'Strøm',
    events: 'Aktiviteter',
    buy_power: 'Køb strøm',
    // ...
  },
  en: {
    welcome: 'Welcome',
    power: 'Power',
    events: 'Events',
    buy_power: 'Buy power',
    // ...
  },
  de: {
    welcome: 'Willkommen',
    power: 'Strom',
    events: 'Veranstaltungen',
    buy_power: 'Strom kaufen',
    // ...
  }
};

export function GuestProvider({ children }) {
  const [guest, setGuest] = useState(null);
  const [language, setLanguage] = useState('da');
  
  const t = (key: string) => translations[language][key] || key;
  
  return (
    <GuestContext.Provider value={{ guest, language, setLanguage, t }}>
      {children}
    </GuestContext.Provider>
  );
}
```

---

## ⚡ REALTIME UPDATES

```tsx
// hooks/useRealtime.ts
export function useMeterRealtime(meterId: string) {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    // Subscribe to meter_readings changes
    const subscription = supabase
      .channel(`meter-${meterId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meter_readings',
          filter: `meter_id=eq.${meterId}`
        },
        (payload) => {
          setData(payload.new);
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [meterId]);
  
  return data;
}
```

---

## 🎨 UI KOMPONENTER

### MeterCard
```tsx
interface MeterCardProps {
  meter: PowerMeter;
  reading?: MeterReading;
  onToggle: (state: 'ON' | 'OFF') => void;
}

export function MeterCard({ meter, reading, onToggle }: MeterCardProps) {
  const isOnline = reading && 
    new Date(reading.time) > new Date(Date.now() - 5 * 60 * 1000);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{meter.meter_number}</span>
          <Badge variant={isOnline ? 'success' : 'destructive'}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Forbrug</p>
            <p className="text-2xl font-bold">{reading?.energy?.toFixed(2)} kWh</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Effekt</p>
            <p className="text-2xl font-bold">{reading?.power?.toFixed(0)} W</p>
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button 
            onClick={() => onToggle('ON')}
            variant={reading?.state === 'ON' ? 'default' : 'outline'}
          >
            Tænd
          </Button>
          <Button 
            onClick={() => onToggle('OFF')}
            variant={reading?.state === 'OFF' ? 'destructive' : 'outline'}
          >
            Sluk
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### PackageCard (Strømpakke)
```tsx
interface PackageCardProps {
  package: Package;
  onBuyMore: () => void;
}

export function PackageCard({ package: pkg, onBuyMore }: PackageCardProps) {
  const percentRemaining = (pkg.enheder_tilbage / pkg.enheder) * 100;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Din strømpakke</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Progress value={percentRemaining} />
          
          <div className="flex justify-between">
            <span>Tilbage:</span>
            <span className="font-bold">{pkg.enheder_tilbage.toFixed(1)} kWh</span>
          </div>
          
          <div className="flex justify-between">
            <span>Brugt:</span>
            <span>{(pkg.enheder - pkg.enheder_tilbage).toFixed(1)} kWh</span>
          </div>
          
          {percentRemaining < 20 && (
            <Alert variant="warning">
              <AlertDescription>
                Din pakke er ved at løbe tør!
              </AlertDescription>
            </Alert>
          )}
          
          <Button onClick={onBuyMore} className="w-full">
            Køb mere strøm
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 💳 STRIPE INTEGRATION

```tsx
// Køb strømpakke
async function buyPackage(packageType: string, amount: number) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/create-checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        booking_id: guest.booking_id,
        package_type: packageType,
        amount: amount,
        customer_type: guest.type
      })
    }
  );
  
  const { url } = await response.json();
  
  // Redirect til Stripe Checkout
  window.location.href = url;
}
```

---

## 📱 RESPONSIVE DESIGN

```tsx
// Tailwind breakpoints
// sm: 640px, md: 768px, lg: 1024px, xl: 1280px

// Eksempel: Grid der ændrer kolonner
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {meters.map(meter => (
    <MeterCard key={meter.id} meter={meter} />
  ))}
</div>

// Mobile-first sidebar
<aside className={cn(
  "fixed inset-y-0 left-0 z-50 w-64 bg-background",
  "transform transition-transform duration-200",
  "md:relative md:translate-x-0",
  isOpen ? "translate-x-0" : "-translate-x-full"
)}>
  {/* Sidebar content */}
</aside>
```

---

## 🔧 ENVIRONMENT VARIABLES

```env
# .env.local
VITE_SUPABASE_URL=https://jkmqliztlhmfyejhmuil.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optional
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
VITE_PORTAL_URL=https://jelling.vercel.app
```

---

## 📦 DEPENDENCIES

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@supabase/supabase-js": "^2.39.0",
    "@tanstack/react-query": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "@radix-ui/react-dialog": "^1.0.0",
    "@radix-ui/react-dropdown-menu": "^2.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "lucide-react": "^0.294.0",
    "date-fns": "^2.30.0"
  }
}
```

---

## 🎯 LOVABLE PROMPTS

For at genopbygge i Lovable, brug disse prompts:

**Prompt 1 - Setup:**
```
Create a React + TypeScript + Vite app with TailwindCSS and shadcn/ui.
Add Supabase client with environment variables.
Create AuthContext for user authentication.
```

**Prompt 2 - Routes:**
```
Add React Router with these routes:
- / (landing page with booking login)
- /dashboard (customer dashboard)
- /admin/* (admin pages)
- /staff/* (staff pages)
```

**Prompt 3 - Meter komponenter:**
```
Create MeterCard component that shows:
- Meter number
- Online/offline status (based on last reading < 5 min)
- Current energy (kWh) and power (W)
- ON/OFF toggle buttons
Use shadcn Card, Badge, Button components.
```
