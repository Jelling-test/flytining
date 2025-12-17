# 🌍 GUEST CONTEXT - Komplet Multi-sprog

**Opdateret:** 16. december 2025

---

## 📋 OVERSIGT

GuestContext håndterer:
- Gæstedata (fra magic link validering)
- Sprogvalg og oversættelser
- Global state for gæsteportalen

---

## 📄 GuestContext.tsx

```tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface GuestData {
  id: string;
  booking_id: number;
  first_name: string;
  last_name: string;
  customer_name: string;
  email: string | null;
  phone: string | null;
  meter_id: string | null;
  pitch_number: string | null;
  arrival_date: string;
  departure_date: string;
  checked_in: boolean;
  checked_out: boolean;
  language: string;
  type: 'regular' | 'seasonal';
  magic_token: string;
  license_plates: string[] | null;
}

type Language = 'da' | 'en' | 'de' | 'nl';

interface GuestContextType {
  guest: GuestData | null;
  setGuest: (guest: GuestData | null) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  logout: () => void;
}

// =============================================================================
// TRANSLATIONS
// =============================================================================

const translations: Record<Language, Record<string, string>> = {
  da: {
    // Navigation
    welcome: 'Velkommen',
    dashboard: 'Oversigt',
    power: 'Strøm',
    events: 'Aktiviteter',
    bakery: 'Bageri',
    cafe: 'Café',
    pool: 'Svømmehal',
    playground: 'Legeplads',
    attractions: 'Attraktioner',
    practical: 'Praktisk info',
    cabin: 'Din hytte',
    logout: 'Log ud',
    
    // Power page
    your_power_package: 'Din strømpakke',
    remaining: 'Tilbage',
    used: 'Brugt',
    total: 'Total',
    buy_power: 'Køb strøm',
    buy_more_power: 'Køb mere strøm',
    low_power_warning: 'Din pakke er ved at løbe tør!',
    no_active_package: 'Du har ingen aktiv strømpakke',
    your_meter: 'Din måler',
    meter_status: 'Status',
    online: 'Online',
    offline: 'Offline',
    power_on: 'Tændt',
    power_off: 'Slukket',
    turn_on: 'Tænd',
    turn_off: 'Sluk',
    current_power: 'Aktuel effekt',
    
    // Package selection
    select_package: 'Vælg pakke',
    kwh: 'kWh',
    dkk: 'kr',
    custom_amount: 'Valgfrit beløb',
    proceed_to_payment: 'Gå til betaling',
    
    // Events
    upcoming_events: 'Kommende aktiviteter',
    no_events: 'Ingen kommende aktiviteter',
    date: 'Dato',
    time: 'Tid',
    location: 'Sted',
    
    // Bakery
    order_bakery: 'Bestil morgenbrød',
    pickup_date: 'Afhentningsdato',
    your_orders: 'Dine bestillinger',
    no_orders: 'Ingen bestillinger',
    cancel_order: 'Annuller',
    order_deadline: 'Bestil inden kl. 18:00 dagen før',
    add_to_order: 'Tilføj',
    place_order: 'Bestil',
    
    // Café
    todays_menu: 'Dagens menu',
    order_food: 'Bestil mad',
    select_time: 'Vælg tidspunkt',
    eat_in: 'Spis her',
    takeaway: 'Take away',
    binding_order: 'Bemærk: Bestillingen er bindende',
    sold_out: 'Udsolgt',
    
    // Practical
    wifi_info: 'WiFi',
    network_name: 'Netværksnavn',
    password: 'Adgangskode',
    check_in: 'Check-in',
    check_out: 'Check-out',
    contact: 'Kontakt',
    rules: 'Regler',
    
    // Cabin
    arrival_checklist: 'Ankomst tjekliste',
    departure_checklist: 'Afrejse tjekliste',
    inventory: 'Inventar',
    cleaning_fee: 'Rengøringsgebyr',
    
    // Common
    loading: 'Indlæser...',
    error: 'Fejl',
    success: 'Succes',
    confirm: 'Bekræft',
    cancel: 'Annuller',
    save: 'Gem',
    close: 'Luk',
    back: 'Tilbage',
    booking: 'Booking',
    pitch: 'Plads',
  },
  
  en: {
    // Navigation
    welcome: 'Welcome',
    dashboard: 'Dashboard',
    power: 'Power',
    events: 'Activities',
    bakery: 'Bakery',
    cafe: 'Café',
    pool: 'Swimming Pool',
    playground: 'Playground',
    attractions: 'Attractions',
    practical: 'Practical Info',
    cabin: 'Your Cabin',
    logout: 'Log out',
    
    // Power page
    your_power_package: 'Your Power Package',
    remaining: 'Remaining',
    used: 'Used',
    total: 'Total',
    buy_power: 'Buy Power',
    buy_more_power: 'Buy More Power',
    low_power_warning: 'Your package is running low!',
    no_active_package: 'You have no active power package',
    your_meter: 'Your Meter',
    meter_status: 'Status',
    online: 'Online',
    offline: 'Offline',
    power_on: 'On',
    power_off: 'Off',
    turn_on: 'Turn On',
    turn_off: 'Turn Off',
    current_power: 'Current Power',
    
    // Package selection
    select_package: 'Select Package',
    kwh: 'kWh',
    dkk: 'DKK',
    custom_amount: 'Custom Amount',
    proceed_to_payment: 'Proceed to Payment',
    
    // Events
    upcoming_events: 'Upcoming Activities',
    no_events: 'No upcoming activities',
    date: 'Date',
    time: 'Time',
    location: 'Location',
    
    // Bakery
    order_bakery: 'Order Breakfast',
    pickup_date: 'Pickup Date',
    your_orders: 'Your Orders',
    no_orders: 'No orders',
    cancel_order: 'Cancel',
    order_deadline: 'Order before 6 PM the day before',
    add_to_order: 'Add',
    place_order: 'Place Order',
    
    // Café
    todays_menu: "Today's Menu",
    order_food: 'Order Food',
    select_time: 'Select Time',
    eat_in: 'Dine In',
    takeaway: 'Take Away',
    binding_order: 'Note: The order is binding',
    sold_out: 'Sold Out',
    
    // Practical
    wifi_info: 'WiFi',
    network_name: 'Network Name',
    password: 'Password',
    check_in: 'Check-in',
    check_out: 'Check-out',
    contact: 'Contact',
    rules: 'Rules',
    
    // Cabin
    arrival_checklist: 'Arrival Checklist',
    departure_checklist: 'Departure Checklist',
    inventory: 'Inventory',
    cleaning_fee: 'Cleaning Fee',
    
    // Common
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    back: 'Back',
    booking: 'Booking',
    pitch: 'Pitch',
  },
  
  de: {
    // Navigation
    welcome: 'Willkommen',
    dashboard: 'Übersicht',
    power: 'Strom',
    events: 'Aktivitäten',
    bakery: 'Bäckerei',
    cafe: 'Café',
    pool: 'Schwimmbad',
    playground: 'Spielplatz',
    attractions: 'Attraktionen',
    practical: 'Praktische Info',
    cabin: 'Ihre Hütte',
    logout: 'Abmelden',
    
    // Power page
    your_power_package: 'Ihr Strompaket',
    remaining: 'Verbleibend',
    used: 'Verbraucht',
    total: 'Gesamt',
    buy_power: 'Strom kaufen',
    buy_more_power: 'Mehr Strom kaufen',
    low_power_warning: 'Ihr Paket ist fast leer!',
    no_active_package: 'Sie haben kein aktives Strompaket',
    your_meter: 'Ihr Zähler',
    meter_status: 'Status',
    online: 'Online',
    offline: 'Offline',
    power_on: 'An',
    power_off: 'Aus',
    turn_on: 'Einschalten',
    turn_off: 'Ausschalten',
    current_power: 'Aktuelle Leistung',
    
    // Package selection
    select_package: 'Paket wählen',
    kwh: 'kWh',
    dkk: 'DKK',
    custom_amount: 'Freier Betrag',
    proceed_to_payment: 'Zur Zahlung',
    
    // Events
    upcoming_events: 'Kommende Aktivitäten',
    no_events: 'Keine kommenden Aktivitäten',
    date: 'Datum',
    time: 'Zeit',
    location: 'Ort',
    
    // Bakery
    order_bakery: 'Frühstück bestellen',
    pickup_date: 'Abholdatum',
    your_orders: 'Ihre Bestellungen',
    no_orders: 'Keine Bestellungen',
    cancel_order: 'Stornieren',
    order_deadline: 'Bestellen Sie bis 18:00 Uhr am Vortag',
    add_to_order: 'Hinzufügen',
    place_order: 'Bestellen',
    
    // Café
    todays_menu: 'Heutiges Menü',
    order_food: 'Essen bestellen',
    select_time: 'Zeit wählen',
    eat_in: 'Vor Ort essen',
    takeaway: 'Zum Mitnehmen',
    binding_order: 'Hinweis: Die Bestellung ist verbindlich',
    sold_out: 'Ausverkauft',
    
    // Practical
    wifi_info: 'WLAN',
    network_name: 'Netzwerkname',
    password: 'Passwort',
    check_in: 'Check-in',
    check_out: 'Check-out',
    contact: 'Kontakt',
    rules: 'Regeln',
    
    // Cabin
    arrival_checklist: 'Ankunfts-Checkliste',
    departure_checklist: 'Abreise-Checkliste',
    inventory: 'Inventar',
    cleaning_fee: 'Reinigungsgebühr',
    
    // Common
    loading: 'Laden...',
    error: 'Fehler',
    success: 'Erfolg',
    confirm: 'Bestätigen',
    cancel: 'Abbrechen',
    save: 'Speichern',
    close: 'Schließen',
    back: 'Zurück',
    booking: 'Buchung',
    pitch: 'Stellplatz',
  },
  
  nl: {
    // Navigation
    welcome: 'Welkom',
    dashboard: 'Overzicht',
    power: 'Stroom',
    events: 'Activiteiten',
    bakery: 'Bakkerij',
    cafe: 'Café',
    pool: 'Zwembad',
    playground: 'Speeltuin',
    attractions: 'Attracties',
    practical: 'Praktische Info',
    cabin: 'Uw Huisje',
    logout: 'Uitloggen',
    
    // Power page
    your_power_package: 'Uw Stroompakket',
    remaining: 'Resterend',
    used: 'Gebruikt',
    total: 'Totaal',
    buy_power: 'Stroom Kopen',
    buy_more_power: 'Meer Stroom Kopen',
    low_power_warning: 'Uw pakket raakt op!',
    no_active_package: 'U heeft geen actief stroompakket',
    your_meter: 'Uw Meter',
    meter_status: 'Status',
    online: 'Online',
    offline: 'Offline',
    power_on: 'Aan',
    power_off: 'Uit',
    turn_on: 'Inschakelen',
    turn_off: 'Uitschakelen',
    current_power: 'Huidig Vermogen',
    
    // Package selection
    select_package: 'Selecteer Pakket',
    kwh: 'kWh',
    dkk: 'DKK',
    custom_amount: 'Aangepast Bedrag',
    proceed_to_payment: 'Naar Betaling',
    
    // Events
    upcoming_events: 'Komende Activiteiten',
    no_events: 'Geen komende activiteiten',
    date: 'Datum',
    time: 'Tijd',
    location: 'Locatie',
    
    // Bakery
    order_bakery: 'Ontbijt Bestellen',
    pickup_date: 'Ophaaldatum',
    your_orders: 'Uw Bestellingen',
    no_orders: 'Geen bestellingen',
    cancel_order: 'Annuleren',
    order_deadline: 'Bestel voor 18:00 de dag ervoor',
    add_to_order: 'Toevoegen',
    place_order: 'Bestellen',
    
    // Café
    todays_menu: 'Menu van Vandaag',
    order_food: 'Eten Bestellen',
    select_time: 'Selecteer Tijd',
    eat_in: 'Ter Plaatse Eten',
    takeaway: 'Afhalen',
    binding_order: 'Let op: De bestelling is bindend',
    sold_out: 'Uitverkocht',
    
    // Practical
    wifi_info: 'WiFi',
    network_name: 'Netwerknaam',
    password: 'Wachtwoord',
    check_in: 'Inchecken',
    check_out: 'Uitchecken',
    contact: 'Contact',
    rules: 'Regels',
    
    // Cabin
    arrival_checklist: 'Aankomst Checklist',
    departure_checklist: 'Vertrek Checklist',
    inventory: 'Inventaris',
    cleaning_fee: 'Schoonmaakkosten',
    
    // Common
    loading: 'Laden...',
    error: 'Fout',
    success: 'Succes',
    confirm: 'Bevestigen',
    cancel: 'Annuleren',
    save: 'Opslaan',
    close: 'Sluiten',
    back: 'Terug',
    booking: 'Boeking',
    pitch: 'Standplaats',
  }
};

// =============================================================================
// CONTEXT
// =============================================================================

const GuestContext = createContext<GuestContextType | undefined>(undefined);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [guest, setGuest] = useState<GuestData | null>(null);
  const [language, setLanguage] = useState<Language>('da');
  const [isLoading, setIsLoading] = useState(true);

  // Load language from localStorage on mount
  useEffect(() => {
    const savedLang = localStorage.getItem('guest_language') as Language;
    if (savedLang && ['da', 'en', 'de', 'nl'].includes(savedLang)) {
      setLanguage(savedLang);
    }
  }, []);

  // Save language to localStorage when changed
  useEffect(() => {
    localStorage.setItem('guest_language', language);
  }, [language]);

  // Set language from guest data if available
  useEffect(() => {
    if (guest?.language) {
      const guestLang = guest.language.toLowerCase() as Language;
      if (['da', 'en', 'de', 'nl'].includes(guestLang)) {
        setLanguage(guestLang);
      }
    }
  }, [guest]);

  // Translation function
  const t = (key: string): string => {
    return translations[language][key] || translations['da'][key] || key;
  };

  // Logout function
  const logout = () => {
    setGuest(null);
    localStorage.removeItem('guest_token');
    localStorage.removeItem('guest_booking_id');
  };

  return (
    <GuestContext.Provider value={{
      guest,
      setGuest,
      language,
      setLanguage,
      t,
      isLoading,
      setIsLoading,
      logout
    }}>
      {children}
    </GuestContext.Provider>
  );
}

export function useGuestContext() {
  const context = useContext(GuestContext);
  if (context === undefined) {
    throw new Error('useGuestContext must be used within a GuestProvider');
  }
  return context;
}

export default GuestContext;
```

---

## 📄 LanguageSelector.tsx

```tsx
import { useGuestContext } from '@/contexts/GuestContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

const languages = [
  { code: 'da', name: 'Dansk', flag: '🇩🇰' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
];

export function LanguageSelector() {
  const { language, setLanguage } = useGuestContext();

  const currentLang = languages.find(l => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <Globe className="h-4 w-4 mr-2" />
          {currentLang?.flag} {currentLang?.code.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as any)}
            className={language === lang.code ? 'bg-accent' : ''}
          >
            {lang.flag} {lang.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 📄 Brug i komponenter

```tsx
// I enhver komponent
import { useGuestContext } from '@/contexts/GuestContext';

function MyComponent() {
  const { guest, t, language } = useGuestContext();

  return (
    <div>
      <h1>{t('welcome')}, {guest?.first_name}!</h1>
      <p>{t('your_power_package')}</p>
      <button>{t('buy_power')}</button>
    </div>
  );
}
```

---

## 📄 App.tsx setup

```tsx
import { GuestProvider } from '@/contexts/GuestContext';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <GuestProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/m/:bookingId/:token" element={<MagicLinkEntry />} />
          <Route path="/guest/*" element={<GuestLayout />} />
        </Routes>
      </BrowserRouter>
    </GuestProvider>
  );
}
```
