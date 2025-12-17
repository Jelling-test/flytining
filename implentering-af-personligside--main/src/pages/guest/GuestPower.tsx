import { useState, useEffect, useCallback } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Zap, 
  AlertCircle, 
  Power, 
  CheckCircle2, 
  Lock,
  ShoppingCart,
  Home,
  Search,
  ArrowRight,
  Clock,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const HEADER_IMAGE = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80';

// ============================================
// INTERFACES
// ============================================

interface PowerPackage {
  id: string;
  status: string;
  name?: string;
  totalEnheder: number;
  usedEnheder: number;
  remainingEnheder: number;
  expiresAt?: string | null;
}

interface IndividualPackage {
  id: string;
  name: string;
  enheder: number;
  status: string;
  type: 'dagspakke' | 'tillaeg' | 'hytte_prepaid';
  expiresAt?: string | null;
  oprettet: string;
  // Fra database
  pakke_kategori?: string;
  pakke_type?: string;
}

interface MeterData {
  id: string;
  name: string;
  isPowerOn: boolean;
  usedEnheder: number;
  currentPower?: number;  // Effekt i Watt
  voltage?: number;       // Spænding i Volt
  current?: number;       // Strømstyrke i Ampere
}

interface AvailableMeter {
  id: string;
  meter_number: string;
  spot_number?: string;
}

interface BuyablePackage {
  id: string;
  name: string;
  enheder: number;
  hours: number;
  price: number;
  type?: 'dagspakke' | 'tillaeg';
}

// ============================================
// MOCK DATA FOR TESTING
// ============================================

const mockAvailableMeters: AvailableMeter[] = [
  { id: '1', meter_number: '42', spot_number: 'A42' },
  { id: '2', meter_number: '43', spot_number: 'A43' },
  { id: '3', meter_number: '150', spot_number: 'B150' },
  { id: '4', meter_number: '151', spot_number: 'B151' },
  { id: '5', meter_number: '200', spot_number: 'C200' },
];

// Pakker fra database - matcher plugin_data.ref_id
// Priser fra main database: 45 kr per 10 enheder
const PRICE_PER_10_ENHEDER = 45;

// Generér DAGSPAKKER baseret på antal dage (til første køb)
const generateDagspakker = (maxDays: number): BuyablePackage[] => {
  const packages: BuyablePackage[] = [];
  for (let days = 1; days <= Math.min(maxDays, 21); days++) {
    const enheder = days * 10;
    packages.push({
      id: `koerende-${enheder}-enh`,
      name: days === 1 ? '1 Dag' : `${days} Dage`,
      enheder: enheder,
      hours: days * 24,
      price: days * PRICE_PER_10_ENHEDER,
      type: 'dagspakke',
    });
  }
  return packages;
};

// TILLÆGSPAKKER - ingen udløbstid, følger dagspakken/startpakken
const tillaegspakker: BuyablePackage[] = [
  { id: 'koerende-tillaeg-10', name: '10 enheder', enheder: 10, hours: 0, price: 45, type: 'tillaeg' },
  { id: 'koerende-tillaeg-20', name: '20 enheder', enheder: 20, hours: 0, price: 90, type: 'tillaeg' },
  { id: 'koerende-tillaeg-30', name: '30 enheder', enheder: 30, hours: 0, price: 135, type: 'tillaeg' },
  { id: 'koerende-tillaeg-50', name: '50 enheder', enheder: 50, hours: 0, price: 225, type: 'tillaeg' },
  { id: 'koerende-tillaeg-100', name: '100 enheder', enheder: 100, hours: 0, price: 450, type: 'tillaeg' },
];

// STARTPAKKE for sæsongæster - ingen udløbstid, aktiv til sæson slutter
const saesonStartpakke: BuyablePackage = {
  id: 'saeson-100',
  name: '100 enheder (sæson)',
  enheder: 100,
  hours: 0, // Ingen udløb - aktiv til departure_date
  price: 450,
  type: 'startpakke' as any,
};

// ============================================
// STATE TYPES
// ============================================

type PowerState = 
  | 'not_checked_in'  // Ikke tjekket ind
  | 'cabin'           // Hytte - strøm inkluderet
  | 'no_meter'        // Skal vælge måler (Step 1)
  | 'no_package'      // Har måler, skal købe pakke (Step 2)
  | 'active';         // Har aktiv pakke - dashboard

// Main Supabase URL for API calls
const MAIN_SUPABASE_URL = 'https://jkmqliztlhmfyejhmuil.supabase.co';
const MAIN_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbXFsaXp0bGhtZnllamhtdWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODQ5NzAsImV4cCI6MjA3NjU2MDk3MH0.QBlcBs-3Udf0C3qAc7efxyUddzPnjTPR2ROSA3dHqeQ';

const GuestPower = () => {
  const { guest, t, language } = useGuest();
  
  // State for data loading
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [powerData, setPowerData] = useState<{
    hasMeter: boolean;
    hasPackage: boolean;
    meterId: string | null;
    powerPackage: PowerPackage | null;
    meters: MeterData[];
    packages: IndividualPackage[];
  } | null>(null);
  
  // State for meter selection (Step 1)
  const [meterSearch, setMeterSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AvailableMeter[]>([]);
  const [selectedMeter, setSelectedMeter] = useState<AvailableMeter | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isConfirmingMeter, setIsConfirmingMeter] = useState(false);
  
  // State for package selection (Step 2)
  const [selectedPkg, setSelectedPkg] = useState<BuyablePackage | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  
  // State for dashboard
  const [meterStates, setMeterStates] = useState<Record<string, boolean>>({});
  const [showPackages, setShowPackages] = useState(false);

  // Hent strømdata fra database - kan kaldes ved mount og efter målervalg
  const fetchPowerData = async () => {
    const bookingNummer = (guest as any).bookingId || (guest as any).booking_nummer;
    
    if (!bookingNummer || !guest.checkedIn) {
      setIsLoadingData(false);
      return;
    }

    try {
      const response = await fetch(`${MAIN_SUPABASE_URL}/functions/v1/get-guest-power-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAIN_ANON_KEY}`,
        },
        body: JSON.stringify({ booking_nummer: bookingNummer }),
      });

      const data = await response.json();
      console.log('Power data from DB:', data);

      if (!data.error) {
        setPowerData({
          hasMeter: data.hasMeter,
          hasPackage: data.hasPackage,
          meterId: data.meterId,
          powerPackage: data.powerPackage,
          meters: data.meters || [],
          packages: data.packages || [],
        });
      }
    } catch (error) {
      console.error('Error fetching power data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Hent ved mount
  useEffect(() => {
    fetchPowerData();
  }, [guest]);

  // Brug data fra database eller fallback til guest context
  const guestAny = guest as any;
  const powerPackage: PowerPackage | null = powerData?.powerPackage || guestAny.powerPackage || null;
  const meters: MeterData[] = powerData?.meters?.length ? powerData.meters : (guestAny.meters || []);
  const meterId: string | null = powerData?.meterId || guestAny.meterId || guest.meterId || null;
  const packages: IndividualPackage[] = powerData?.packages || [];

  // Beregn resterende dage af booking
  const calculateRemainingDays = (): number => {
    const departureDate = guest.departureDate ? new Date(guest.departureDate) : null;
    if (!departureDate) return 7; // Default 7 dage hvis ingen dato
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    departureDate.setHours(0, 0, 0, 0);
    
    const diffTime = departureDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(1, diffDays); // Minimum 1 dag
  };

  const remainingDays = calculateRemainingDays();
  const isSeasonal = guest.bookingType === 'seasonal';
  
  // Sæsongæster: Startpakke (ingen udløb)
  // Kørende campist: Dagspakke til alle resterende dage
  const requiredPackage = isSeasonal 
    ? saesonStartpakke
    : (generateDagspakker(remainingDays).find(p => p.enheder === remainingDays * 10) 
       || generateDagspakker(remainingDays)[remainingDays - 1]);

  // ============================================
  // BESTEM POWER STATE
  // ============================================
  
  const getPowerState = (): PowerState => {
    // Venter på data
    if (isLoadingData) return 'not_checked_in';
    
    // Ikke tjekket ind
    if (!guest.checkedIn) return 'not_checked_in';
    
    // Hytte gæst - strøm inkluderet
    if (guest.bookingType === 'cabin') return 'cabin';
    
    // Ingen måler tildelt (fra database)
    if (!meterId && meters.length === 0) return 'no_meter';
    
    // Har måler men ingen pakke (fra database)
    if (!powerPackage || powerPackage.status !== 'aktiv') return 'no_package';
    
    // Har aktiv pakke
    return 'active';
  };

  const currentState = getPowerState();

  // ============================================
  // HANDLERS
  // ============================================

  // Søg efter ledige målere - SAMME logik som VaelgMaaler.tsx i main system
  const searchMeters = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      // 1. Hent målere der matcher søgning og er markeret ledige
      const { data: meters, error } = await (supabase as any)
        .from('power_meters')
        .select('id, meter_number, spot_number, is_online')
        .eq('is_available', true)
        .ilike('meter_number', `%${query}%`)
        .limit(10);

      if (error) throw error;

      // 2. HYTTE-FILTER: Hent alle målere der er låst til hytter
      const { data: cabinMeters } = await (supabase as any)
        .from('cabins')
        .select('meter_id')
        .not('meter_id', 'is', null);

      const cabinMeterIds = new Set(cabinMeters?.map((c: any) => c.meter_id) || []);

      // 3. Hent alle tildelte målere fra kunder (checked ind)
      const { data: seasonalCustomers } = await (supabase as any)
        .from('seasonal_customers')
        .select('meter_id')
        .eq('checked_in', true)
        .not('meter_id', 'is', null);

      const { data: regularCustomers } = await (supabase as any)
        .from('regular_customers')
        .select('meter_id')
        .eq('checked_in', true)
        .not('meter_id', 'is', null);

      // 4. Hent ekstra målere (tilknyttet bookinger)
      const { data: extraMeters } = await (supabase as any)
        .from('booking_extra_meters')
        .select('meter_id');

      // 5. Opret set af tildelte måler IDs
      const assignedMeterIds = new Set([
        ...(seasonalCustomers?.map((c: any) => c.meter_id) || []),
        ...(regularCustomers?.map((c: any) => c.meter_id) || []),
        ...(extraMeters?.map((m: any) => m.meter_id) || []),
      ]);

      // 6. Filtrer: kun online, ikke tildelt, ikke hytte-måler
      const availableMeters = (meters || [])
        .filter((meter: any) => {
          if (assignedMeterIds.has(meter.meter_number)) return false;
          if (cabinMeterIds.has(meter.meter_number)) return false;
          return meter.is_online === true;
        })
        .map((meter: any) => ({
          id: meter.id,
          meter_number: meter.meter_number,
          spot_number: meter.spot_number,
        }));

      setSearchResults(availableMeters);
    } catch (error) {
      console.error('Meter search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce søgning
  const handleMeterSearch = (query: string) => {
    setMeterSearch(query);
  };

  // Trigger søgning med debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchMeters(meterSearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [meterSearch, searchMeters]);

  // Bekræft valg af måler - kalder assign-meter Edge Function
  const handleConfirmMeter = async () => {
    if (!selectedMeter) return;
    setIsConfirmingMeter(true);
    
    try {
      const bookingNummer = (guest as any).bookingId || (guest as any).booking_nummer;
      
      // Kald Edge Function til at tildele måler
      const response = await fetch(`${MAIN_SUPABASE_URL}/functions/v1/assign-meter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAIN_ANON_KEY}`,
        },
        body: JSON.stringify({
          booking_nummer: bookingNummer,
          meter_number: selectedMeter.meter_number,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(`Måler ${selectedMeter.meter_number} er nu tilknyttet!`);
        // Genindlæs power data for at få komplet måler-info
        await fetchPowerData();
      } else {
        throw new Error(result.error || 'Kunne ikke tildele måler');
      }
    } catch (error: any) {
      console.error('Meter assignment error:', error);
      toast.error(language === 'da' ? 'Fejl ved tildeling af måler' : 'Error assigning meter');
    } finally {
      setIsConfirmingMeter(false);
    }
  };

  // Køb pakke via Stripe (bruger MAIN projekt for Stripe)
  // TEST_MODE: Sæt til true for at simulere køb uden Stripe
  const TEST_MODE = false; // ← PRODUKTION: Kalder rigtig Stripe
  
  const handlePurchasePackage = async () => {
    const pkg = selectedPkg || requiredPackage;
    if (!pkg || !termsAccepted) return;
    setIsPurchasing(true);
    
    try {
      // Hent booking info fra guest
      const bookingNummer = (guest as any).bookingId || (guest as any).booking_nummer || 99901;
      const organizationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const maalerId = selectedMeter?.meter_number || meterId || meters[0]?.id || '42';
      
      console.log('Stripe checkout params:', { organizationId, bookingNummer, pakke_type_id: pkg.id, maalerId });
      
      // TEST MODE: Simuler køb uden at kalde Stripe
      if (TEST_MODE) {
        await new Promise(r => setTimeout(r, 1500));
        toast.success(language === 'da' 
          ? `✅ Pakke "${pkg.name}" købt! (TEST MODE)` 
          : `✅ Package "${pkg.name}" purchased! (TEST MODE)`
        );
        // Simuler at gå til dashboard ved at sætte en "aktiv pakke"
        // I produktion ville dette ske via webhook efter betaling
        setIsPurchasing(false);
        return;
      }
      
      // PRODUKTION: Kald MAIN projektets create-checkout Edge Function
      const MAIN_SUPABASE_URL = 'https://jkmqliztlhmfyejhmuil.supabase.co';
      const MAIN_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprbXFsaXp0bGhtZnllamhtdWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODQ5NzAsImV4cCI6MjA3NjU2MDk3MH0.QBlcBs-3Udf0C3qAc7efxyUddzPnjTPR2ROSA3dHqeQ';
      
      const response = await fetch(`${MAIN_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAIN_ANON_KEY}`,
        },
        body: JSON.stringify({
          organization_id: organizationId,
          booking_nummer: bookingNummer,
          pakke_type_id: pkg.id,
          maaler_id: maalerId,
        }),
      });

      const data = await response.json();

      if (data?.checkout_url) {
        toast.info(language === 'da' ? 'Omdirigerer til betaling...' : 'Redirecting to payment...');
        window.location.href = data.checkout_url;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Ingen checkout URL modtaget');
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast.error(language === 'da' ? 'Fejl ved oprettelse af betaling' : 'Error creating payment');
      setIsPurchasing(false);
    }
  };

  // Toggle power for en måler via Edge Function
  const toggleMeterPower = async (mId: string, currentOn: boolean) => {
    const bookingNummer = (guest as any).bookingId || (guest as any).booking_nummer;
    const newState = !currentOn;
    
    // Optimistisk UI opdatering
    setMeterStates(prev => ({ ...prev, [mId]: newState }));
    
    try {
      const response = await fetch(`${MAIN_SUPABASE_URL}/functions/v1/toggle-power`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAIN_ANON_KEY}`,
        },
        body: JSON.stringify({
          maaler_id: mId,
          action: newState ? 'on' : 'off',
          booking_nummer: bookingNummer,
        }),
      });

      const data = await response.json();
      
      if (data?.success) {
        toast.success(newState 
          ? (language === 'da' ? 'Strøm tændt' : 'Power on')
          : (language === 'da' ? 'Strøm slukket' : 'Power off')
        );
      } else if (data?.error) {
        // Reverter UI ved fejl
        setMeterStates(prev => ({ ...prev, [mId]: currentOn }));
        toast.error(data.error);
      }
    } catch (error: any) {
      console.error('Toggle power error:', error);
      // Reverter UI ved fejl
      setMeterStates(prev => ({ ...prev, [mId]: currentOn }));
      toast.error(language === 'da' ? 'Fejl ved tænd/sluk' : 'Error toggling power');
    }
  };

  const getMeterPowerState = (meter: MeterData) => {
    return meterStates[meter.id] !== undefined ? meterStates[meter.id] : meter.isPowerOn;
  };

  // Køb tillægspakke via Stripe
  const handleBuyTillaegspakke = async (pkg: BuyablePackage) => {
    try {
      const bookingNummer = (guest as any).bookingId || (guest as any).booking_nummer;
      const organizationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const maalerId = meterId || meters[0]?.id || 'default';
      
      toast.info(language === 'da' ? 'Opretter betaling...' : 'Creating payment...');
      
      const response = await fetch(`${MAIN_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAIN_ANON_KEY}`,
        },
        body: JSON.stringify({
          organization_id: organizationId,
          booking_nummer: bookingNummer,
          pakke_type_id: pkg.id,  // f.eks. 'koerende-tillaeg-10'
          maaler_id: maalerId,
        }),
      });

      const data = await response.json();

      if (data?.checkout_url) {
        toast.info(language === 'da' ? 'Omdirigerer til betaling...' : 'Redirecting to payment...');
        window.location.href = data.checkout_url;
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        throw new Error('Ingen checkout URL modtaget');
      }
    } catch (error: any) {
      console.error('Tillægspakke purchase error:', error);
      toast.error(language === 'da' ? 'Fejl ved køb af tillægspakke' : 'Error purchasing add-on package');
    }
  };

  // ============================================
  // RENDER: NOT CHECKED IN
  // ============================================
  
  if (currentState === 'not_checked_in') {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={t('powerManagement')}
          subtitle={language === 'da' ? 'Styr din strøm' : language === 'de' ? 'Verwalten Sie Ihren Strom' : language === 'nl' ? 'Beheer uw stroom' : 'Manage your electricity'}
          image={HEADER_IMAGE}
        />
        <div className="max-w-2xl mx-auto p-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lock className="h-12 w-12 text-amber-500 mb-4" />
              <p className="text-gray-800 font-medium mb-2">
                {language === 'da' ? 'Strømstyring ikke tilgængelig' : language === 'de' ? 'Stromverwaltung nicht verfügbar' : language === 'nl' ? 'Stroombeheer niet beschikbaar' : 'Power management not available'}
              </p>
              <p className="text-sm text-gray-600">
                {language === 'da' ? 'Strømstyring er tilgængelig efter check-in' : language === 'de' ? 'Nach dem Check-in verfügbar' : language === 'nl' ? 'Beschikbaar na check-in' : 'Available after check-in'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: CABIN - PREPAID POWER PACKAGE
  // ============================================
  
  if (currentState === 'cabin') {
    // Hytte-gæster har prepaid pakke (10 enheder/dag) + evt. tillægspakker
    const cabinMeter = meters[0]; // Hytte har kun én måler
    
    // Filtrer pakker: inkluderet pakke (hytte_prepaid) vs tillægspakker
    const includedPackage = packages.find(p => 
      p.pakke_kategori === 'hytte_prepaid' || 
      p.type === 'hytte_prepaid' ||
      (p.name && p.name.includes('Energipakke'))
    );
    // Tillæg har pakke_type === 'tillæg' ELLER type === 'tillaeg', men IKKE hytte_prepaid
    const addonPackages = packages.filter(p => 
      (p.pakke_type === 'tillæg' || p.type === 'tillaeg') &&
      p.pakke_kategori !== 'hytte_prepaid' &&
      p.type !== 'hytte_prepaid' &&
      !(p.name && p.name.includes('Energipakke'))
    );
    
    // Brug powerPackage som fallback hvis packages ikke er loadet
    const mainPackage = includedPackage || powerPackage;
    
    // Beregn totaler (inkluderet + tillæg)
    const includedEnheder = (mainPackage as any)?.totalEnheder || (mainPackage as any)?.enheder || 10;
    const addonEnheder = addonPackages.reduce((sum, p) => sum + p.enheder, 0);
    const totalEnheder = includedEnheder + addonEnheder;
    const usedEnheder = powerPackage?.usedEnheder || 0;
    const remainingEnheder = totalEnheder - usedEnheder;
    const usagePercent = totalEnheder > 0 ? (usedEnheder / totalEnheder) * 100 : 0;
    const isLowPower = remainingEnheder < 5;
    
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={t('powerManagement')}
          subtitle={language === 'da' ? `Hytte ${guest.spotNumber}` : language === 'de' ? `Hütte ${guest.spotNumber}` : language === 'nl' ? `Hut ${guest.spotNumber}` : `Cabin ${guest.spotNumber}`}
          image={HEADER_IMAGE}
        />
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          
          {/* Hytte info med Effekt og Spænding */}
          <div className="bg-teal-700 text-white p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <Home className="h-6 w-6" />
              <div className="flex-1">
                <p className="font-semibold">Hytte {guest.spotNumber}</p>
                <p className="text-sm text-white/80">
                  {language === 'da' ? 'Måler: ' : language === 'de' ? 'Zähler: ' : language === 'nl' ? 'Meter: ' : 'Meter: '}{meterId || cabinMeter?.name || (language === 'da' ? 'Automatisk tildelt' : language === 'de' ? 'Automatisch zugewiesen' : language === 'nl' ? 'Automatisch toegewezen' : 'Automatically assigned')}
                </p>
              </div>
              {/* Effekt og Spænding */}
              {cabinMeter && (
                <div className="flex items-center gap-4 text-center">
                  <div>
                    <p className="text-xs text-white/70">{language === 'da' ? 'Effekt' : 'Power'}</p>
                    <p className="text-lg font-bold">{(cabinMeter.currentPower || 0).toFixed(1)} W</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70">{language === 'da' ? 'Spænding' : language === 'de' ? 'Spannung' : language === 'nl' ? 'Spanning' : 'Voltage'}</p>
                    <p className="text-lg font-bold">{Math.round(cabinMeter.voltage || 0)} V</p>
                  </div>
                </div>
              )}
              {/* Tænd/sluk */}
              {cabinMeter && (
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-sm">{getMeterPowerState(cabinMeter) ? (language === 'da' ? 'Tændt' : language === 'de' ? 'Ein' : language === 'nl' ? 'Aan' : 'On') : (language === 'da' ? 'Slukket' : language === 'de' ? 'Aus' : language === 'nl' ? 'Uit' : 'Off')}</span>
                  <Switch
                    checked={getMeterPowerState(cabinMeter)}
                    onCheckedChange={() => toggleMeterPower(cabinMeter.id, getMeterPowerState(cabinMeter))}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Inkluderet pakke */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-teal-600" />
                  {language === 'da' ? 'Inkluderet strøm' : language === 'de' ? 'Inklusivstrom' : language === 'nl' ? 'Inbegrepen stroom' : 'Included power'}
                </CardTitle>
                <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                  {language === 'da' ? 'Inkluderet i ophold' : language === 'de' ? 'Im Aufenthalt enthalten' : language === 'nl' ? 'Inbegrepen in verblijf' : 'Included in stay'}
                </Badge>
              </div>
              <CardDescription>
                {mainPackage?.name || (language === 'da' ? `Energipakke ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dage'}` : language === 'de' ? `Energiepaket ${remainingDays} ${remainingDays === 1 ? 'Tag' : 'Tage'}` : language === 'nl' ? `Energiepakket ${remainingDays} ${remainingDays === 1 ? 'dag' : 'dagen'}` : `Energy package ${remainingDays} ${remainingDays === 1 ? 'day' : 'days'}`)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Forbrug */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{language === 'da' ? 'Forbrug' : language === 'de' ? 'Verbrauch' : language === 'nl' ? 'Verbruik' : 'Usage'}</span>
                  <span className="font-medium">{usedEnheder.toFixed(1)} / {totalEnheder} {language === 'da' ? 'enheder' : language === 'de' ? 'Einheiten' : language === 'nl' ? 'eenheden' : 'units'}</span>
                </div>
                <Progress value={usagePercent} className={isLowPower ? 'bg-red-100' : 'bg-gray-100'} />
              </div>

              {/* Resterende */}
              <div className={`p-4 rounded-lg ${isLowPower ? 'bg-amber-50 border border-amber-200' : 'bg-teal-50'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isLowPower ? (
                      <AlertCircle className="h-5 w-5 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-teal-600" />
                    )}
                    <span className={isLowPower ? 'text-amber-700' : 'text-teal-700'}>
                      {language === 'da' ? 'Tilbage' : language === 'de' ? 'Verbleibend' : language === 'nl' ? 'Resterend' : 'Remaining'}
                    </span>
                  </div>
                  <span className={`text-2xl font-bold ${isLowPower ? 'text-amber-700' : 'text-teal-700'}`}>
                    {remainingEnheder.toFixed(1)} {language === 'da' ? 'enheder' : language === 'de' ? 'Einheiten' : language === 'nl' ? 'eenheden' : 'units'}
                  </span>
                </div>
                {isLowPower && (
                  <p className="text-sm text-amber-600 mt-2">
                    {language === 'da' 
                      ? 'Du har snart brugt din inkluderede strøm. Køb en tillægspakke nedenfor.'
                      : language === 'de' ? 'Ihr Inklusivstrom ist bald aufgebraucht. Kaufen Sie unten ein Zusatzpaket.'
                      : language === 'nl' ? 'Uw inbegrepen stroom is bijna op. Koop hieronder een aanvullend pakket.'
                      : 'You are running low on included power. Buy an add-on package below.'}
                  </p>
                )}
              </div>

              {/* Info */}
              <p className="text-sm text-gray-500">
                {language === 'da' 
                  ? 'Du har inkluderet 10 enheder pr. dag i din booking. Har du behov for mere strøm kan du tilkøbe ekstra pakker.'
                  : language === 'de' ? 'Sie haben 10 Einheiten pro Tag in Ihrer Buchung inklusive. Bei Bedarf können Sie Zusatzpakete kaufen.'
                  : language === 'nl' ? 'U heeft 10 eenheden per dag inbegrepen in uw boeking. Heeft u meer stroom nodig, dan kunt u extra pakketten kopen.'
                  : 'You have 10 units per day included in your booking. If you need more power, you can purchase extra packages.'}
              </p>
            </CardContent>
          </Card>

          {/* Dine pakker - vis inkluderet og tillægspakker separat */}
          {(includedEnheder > 0 || addonPackages.length > 0) && (
            <Card className="border-0 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-teal-600" />
                  {language === 'da' ? 'Dine pakker' : language === 'de' ? 'Ihre Pakete' : language === 'nl' ? 'Uw pakketten' : 'Your packages'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Inkluderet pakke */}
                {includedPackage && (
                  <div className="p-3 border rounded-lg bg-teal-50 border-teal-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{includedPackage.name || (language === 'da' ? 'Inkluderet i booking' : 'Included in booking')}</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-teal-100 text-teal-800">
                          {language === 'da' ? 'INKLUDERET' : language === 'de' ? 'INKLUSIVE' : language === 'nl' ? 'INBEGREPEN' : 'INCLUDED'}
                        </span>
                      </div>
                      <span className="font-semibold text-teal-600">{includedPackage.enheder} {language === 'da' ? 'enheder' : 'units'}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {language === 'da' ? '10 enheder pr. dag i dit ophold' : language === 'de' ? '10 Einheiten pro Tag Ihres Aufenthalts' : language === 'nl' ? '10 eenheden per dag van uw verblijf' : '10 units per day of your stay'}
                    </p>
                  </div>
                )}

                {/* Tillægspakker */}
                {addonPackages.map((pkg) => (
                  <div key={pkg.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pkg.name}</span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                          {language === 'da' ? 'TILLÆG' : language === 'de' ? 'ZUSATZ' : language === 'nl' ? 'EXTRA' : 'ADD-ON'}
                        </span>
                      </div>
                      <span className="font-semibold text-teal-600">{pkg.enheder} {language === 'da' ? 'enheder' : 'units'}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {language === 'da' ? 'Købt via Stripe' : language === 'de' ? 'Über Stripe gekauft' : language === 'nl' ? 'Gekocht via Stripe' : 'Purchased via Stripe'}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Køb tillægspakke */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-orange-500" />
                {language === 'da' ? 'Køb ekstra strøm' : language === 'de' ? 'Extra Strom kaufen' : language === 'nl' ? 'Extra stroom kopen' : 'Buy extra power'}
              </CardTitle>
              <CardDescription>
                {language === 'da' 
                  ? 'Tillægspakker tilføjes til din nuværende strøm'
                  : language === 'de' ? 'Zusatzpakete werden zu Ihrem aktuellen Strom hinzugefügt'
                  : language === 'nl' ? 'Aanvullende pakketten worden toegevoegd aan uw huidige stroom'
                  : 'Add-on packages are added to your current power'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {tillaegspakker.slice(0, 3).map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedPkg?.id === pkg.id
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Zap className="h-5 w-5 text-orange-500" />
                      <div>
                        <p className="font-semibold">{pkg.name}</p>
                        <p className="text-sm text-gray-500">+{pkg.enheder} {language === 'da' ? 'enheder' : 'units'}</p>
                      </div>
                    </div>
                    <span className="font-bold text-gray-800">{pkg.price} kr</span>
                  </div>
                </div>
              ))}

              {/* Vilkår og køb */}
              {selectedPkg && (
                <div className="pt-4 space-y-4 border-t">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="cabin-terms"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    />
                    <label htmlFor="cabin-terms" className="text-sm text-gray-600">
                      {language === 'da'
                        ? 'Jeg accepterer at tillægspakken ikke refunderes ved ikke-brug.'
                        : 'I accept that the add-on package is non-refundable.'}
                    </label>
                  </div>
                  <Button
                    onClick={() => handleBuyTillaegspakke(selectedPkg!)}
                    disabled={!termsAccepted || isPurchasing}
                    className="w-full h-12 bg-orange-500 hover:bg-orange-600"
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        {language === 'da' ? 'Behandler...' : 'Processing...'}
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        {language === 'da' ? `Køb ${selectedPkg.name} - ${selectedPkg.price} kr` : `Buy ${selectedPkg.name} - ${selectedPkg.price} kr`}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: NO METER - STEP 1: Vælg måler
  // ============================================
  
  if (currentState === 'no_meter') {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={language === 'da' ? 'Aktiver strøm' : language === 'de' ? 'Strom aktivieren' : language === 'nl' ? 'Stroom activeren' : 'Activate power'}
          subtitle={language === 'da' ? 'Trin 1: Vælg din strømmåler' : language === 'de' ? 'Schritt 1: Wählen Sie Ihren Zähler' : language === 'nl' ? 'Stap 1: Selecteer uw meter' : 'Step 1: Select your meter'}
          image={HEADER_IMAGE}
        />
        
        {/* Step indicator */}
        <div className="bg-teal-700 text-white py-3 px-6">
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white text-teal-700 flex items-center justify-center font-bold">1</div>
              <span className="font-medium">{language === 'da' ? 'Vælg måler' : language === 'de' ? 'Zähler wählen' : language === 'nl' ? 'Meter selecteren' : 'Select meter'}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-white/50" />
            <div className="flex items-center gap-2 opacity-50">
              <div className="h-8 w-8 rounded-full bg-white/30 flex items-center justify-center font-bold">2</div>
              <span>{language === 'da' ? 'Køb pakke' : language === 'de' ? 'Paket kaufen' : language === 'nl' ? 'Pakket kopen' : 'Buy package'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Search */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-teal-600" />
                {language === 'da' ? 'Find din strømmåler' : language === 'de' ? 'Finden Sie Ihren Zähler' : language === 'nl' ? 'Vind uw meter' : 'Find your meter'}
              </CardTitle>
              <CardDescription>
                {language === 'da' ? 'Indtast nummeret på standeren ved din plads' : language === 'de' ? 'Geben Sie die Nummer am Stromständer bei Ihrem Platz ein' : language === 'nl' ? 'Voer het nummer in van de stroomzuil bij uw plek' : 'Enter the number on the power stand at your spot'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder={language === 'da' ? 'F.eks. 42, 150, 200...' : language === 'de' ? 'Z.B. 42, 150, 200...' : language === 'nl' ? 'Bijv. 42, 150, 200...' : 'E.g. 42, 150, 200...'}
                  value={meterSearch}
                  onChange={(e) => handleMeterSearch(e.target.value)}
                  className="pl-12 h-14 text-lg"
                />
              </div>

              {/* Search results */}
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              )}

              {searchResults.length > 0 && !isSearching && (
                <div className="space-y-2">
                  {searchResults.map((meter) => (
                    <div
                      key={meter.id}
                      onClick={() => setSelectedMeter(meter)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedMeter?.id === meter.id 
                          ? 'border-teal-500 bg-teal-50' 
                          : 'border-gray-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="h-6 w-6 text-teal-600" />
                        <div>
                          <p className="font-semibold">Stander {meter.meter_number}</p>
                          {meter.spot_number && (
                            <p className="text-sm text-gray-500">Plads {meter.spot_number}</p>
                          )}
                        </div>
                        {selectedMeter?.id === meter.id && (
                          <CheckCircle2 className="h-6 w-6 text-teal-600 ml-auto" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {meterSearch.length > 0 && searchResults.length === 0 && !isSearching && (
                <p className="text-center text-gray-500 py-4">
                  {language === 'da' ? 'Ingen ledige målere fundet' : language === 'de' ? 'Keine verfügbaren Zähler gefunden' : language === 'nl' ? 'Geen beschikbare meters gevonden' : 'No available meters found'}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Confirm button */}
          {selectedMeter && (
            <Button 
              onClick={handleConfirmMeter}
              disabled={isConfirmingMeter}
              className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700"
            >
              {isConfirmingMeter ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {language === 'da' ? 'Bekræfter...' : language === 'de' ? 'Bestätigen...' : language === 'nl' ? 'Bevestigen...' : 'Confirming...'}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  {language === 'da' ? `Bekræft stander ${selectedMeter.meter_number}` : language === 'de' ? `Ständer ${selectedMeter.meter_number} bestätigen` : language === 'nl' ? `Zuil ${selectedMeter.meter_number} bevestigen` : `Confirm stand ${selectedMeter.meter_number}`}
                </>
              )}
            </Button>
          )}

          {/* Help */}
          <Card className="bg-gray-50">
            <CardContent className="p-4">
              <p className="text-sm text-gray-600 font-medium mb-2">
                {language === 'da' ? 'Sådan finder du nummeret:' : language === 'de' ? 'So finden Sie die Nummer:' : language === 'nl' ? 'Zo vindt u het nummer:' : 'How to find the number:'}
              </p>
              <ul className="text-sm text-gray-500 space-y-1">
                <li>• {language === 'da' ? 'Nummeret står på strømboksen ved din plads' : language === 'de' ? 'Die Nummer steht auf der Strombox an Ihrem Platz' : language === 'nl' ? 'Het nummer staat op de stroomkast bij uw plek' : 'The number is on the power box at your spot'}</li>
                <li>• {language === 'da' ? 'Det er typisk et 1-3 cifret tal' : language === 'de' ? 'Es ist typischerweise eine 1-3 stellige Zahl' : language === 'nl' ? 'Het is meestal een 1-3 cijferig nummer' : 'It is typically a 1-3 digit number'}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: NO PACKAGE - STEP 2: Køb pakke
  // ============================================
  
  if (currentState === 'no_package') {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={language === 'da' ? 'Køb strømpakke' : language === 'de' ? 'Strompaket kaufen' : language === 'nl' ? 'Stroompakket kopen' : 'Buy power package'}
          subtitle={language === 'da' ? 'Trin 2: Vælg din pakke' : language === 'de' ? 'Schritt 2: Wählen Sie Ihr Paket' : language === 'nl' ? 'Stap 2: Selecteer uw pakket' : 'Step 2: Select your package'}
          image={HEADER_IMAGE}
        />
        
        {/* Step indicator */}
        <div className="bg-teal-700 text-white py-3 px-6">
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 opacity-50">
              <div className="h-8 w-8 rounded-full bg-white/30 flex items-center justify-center font-bold">✓</div>
              <span>{language === 'da' ? 'Måler valgt' : language === 'de' ? 'Zähler ausgewählt' : language === 'nl' ? 'Meter geselecteerd' : 'Meter selected'}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-white/50" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-white text-teal-700 flex items-center justify-center font-bold">2</div>
              <span className="font-medium">{language === 'da' ? 'Køb pakke' : 'Buy package'}</span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Meter info */}
          <Card className="bg-teal-50 border-teal-200">
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="h-6 w-6 text-teal-600" />
              <div>
                <p className="font-medium text-teal-800">
                  {language === 'da' ? 'Din måler er klar' : language === 'de' ? 'Ihr Zähler ist bereit' : language === 'nl' ? 'Uw meter is klaar' : 'Your meter is ready'}
                </p>
                <p className="text-sm text-teal-600">Stander {meterId || meters[0]?.name || selectedMeter?.meter_number}</p>
              </div>
            </CardContent>
          </Card>

          {/* Packages */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-gray-800">
                {isSeasonal 
                  ? (language === 'da' ? 'Din aktiverings pakke' : 'Your activation package')
                  : (language === 'da' ? 'Din strømpakke' : 'Your power package')
                }
              </h2>
              {!isSeasonal && (
                <Badge variant="secondary" className="text-sm">
                  {language === 'da' ? `${remainingDays} dage` : `${remainingDays} days`}
                </Badge>
              )}
            </div>
            
            {/* Pakke - startpakke for sæson, dagspakke for kørende */}
            {requiredPackage && (
              <Card className="border-2 border-teal-500 bg-teal-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xl font-bold text-gray-800">⚡ {requiredPackage.name}</p>
                      <p className="text-sm text-gray-500">
                        {requiredPackage.enheder} enheder • {isSeasonal 
                          ? (language === 'da' ? 'Aktiv hele sæsonen' : 'Active entire season')
                          : (language === 'da' ? 'Dækker hele dit ophold' : 'Covers your entire stay')
                        }
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-teal-600">{requiredPackage.price} kr</p>
                      <p className="text-xs text-gray-400">{(requiredPackage.price / requiredPackage.enheder).toFixed(1)} kr/enhed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Terms & Purchase */}
          {requiredPackage && (
            <Card className="border-teal-200 bg-white">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                    className="mt-1"
                  />
                  <div>
                    <label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                      {language === 'da' ? 'Jeg accepterer vilkårene' : language === 'de' ? 'Ich akzeptiere die Bedingungen' : language === 'nl' ? 'Ik accepteer de voorwaarden' : 'I accept the terms'}
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      {isSeasonal 
                        ? (language === 'da' 
                            ? `En aktiverings pakke er aktiv i den indeværende sæson. Ubrugte enheder refunderes ikke. Har du brug for flere enheder, kan der købes tillægspakker.`
                            : `An activation package is active for the current season. Unused units are not refunded. Need more units? Add-on packages can be purchased.`)
                        : (language === 'da' 
                            ? `Pakken dækker ${remainingDays} dage (10 enheder/dag). Når pakken udløber, skal du købe en ny dagspakke. Har du brug for flere enheder, kan du købe tillægspakker.`
                            : `Package covers ${remainingDays} days (10 units/day). When expired, you must purchase a new day package. Need more units? Buy add-on packages.`)
                      }
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handlePurchasePackage}
                  disabled={!termsAccepted || isPurchasing}
                  className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700"
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {language === 'da' ? 'Omdirigerer...' : language === 'de' ? 'Weiterleitung...' : language === 'nl' ? 'Doorsturen...' : 'Redirecting...'}
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      {isSeasonal 
                        ? (language === 'da' ? `Køb aktivering - ${requiredPackage?.price || 0} kr` : `Buy activation - ${requiredPackage?.price || 0} kr`)
                        : (language === 'da' ? `Køb nu - ${requiredPackage?.price || 0} kr` : `Buy now - ${requiredPackage?.price || 0} kr`)
                      }
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: ACTIVE - Dashboard med tænd/sluk
  // ============================================
  
  const totalUsage = powerPackage?.usedEnheder || 0;
  const totalPackage = powerPackage?.totalEnheder || 0;
  const totalRemaining = powerPackage?.remainingEnheder || 0;
  const totalUsagePercent = totalPackage > 0 ? (totalUsage / totalPackage) * 100 : 0;

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={t('powerManagement')}
        subtitle={`${meters.length} ${language === 'da' ? 'elmålere tilknyttet' : 'meters assigned'}`}
        image={HEADER_IMAGE}
        guestName={guest.firstName}
        bookingId={guest.bookingId}
      />
      
      {/* Teal info bar */}
      <div className="bg-teal-700 text-white py-3 px-6">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <span>{language === 'da' ? 'Samlet forbrug' : language === 'de' ? 'Gesamtverbrauch' : language === 'nl' ? 'Totaal verbruik' : 'Total usage'}</span>
          </div>
          <div className="text-right">
            <span className="font-bold">{totalUsage.toFixed(1)} enheder</span>
            <span className="text-white/60 ml-2">/ {totalPackage} enheder</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        
        {/* Package status */}
        {powerPackage?.expiresAt && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-6 w-6 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">
                  {language === 'da' ? 'Pakke udløber' : 'Package expires'}
                </p>
                <p className="text-sm text-amber-600">
                  {new Date(powerPackage.expiresAt).toLocaleString(language === 'da' ? 'da-DK' : 'en-GB')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Card */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-teal-500 to-teal-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">{powerPackage?.name || (language === 'da' ? 'Din pakke' : 'Your package')}</p>
                <p className="text-sm text-white/80">{meters.length} {language === 'da' ? 'målere' : 'meters'}</p>
              </div>
            </div>
            <div className="flex justify-between items-end mb-3">
              <div>
                <span className="text-4xl font-light">{totalUsage.toFixed(1)}</span>
                <span className="ml-2 text-white/80">enheder {language === 'da' ? 'brugt' : 'used'}</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-light">{totalRemaining.toFixed(1)}</span>
                <span className="ml-2 text-white/80">enheder {language === 'da' ? 'tilbage' : 'left'}</span>
              </div>
            </div>
            <Progress value={totalUsagePercent} className="h-2 bg-white/30" />
          </CardContent>
        </Card>

        {/* Individual Packages */}
        {packages.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Zap className="h-5 w-5 text-teal-600" />
              {language === 'da' ? 'Dine pakker' : language === 'de' ? 'Ihre Pakete' : language === 'nl' ? 'Uw pakketten' : 'Your packages'}
            </h2>
            {packages.map((pkg) => {
              const isDagspakke = pkg.type === 'dagspakke';
              return (
                <Card key={pkg.id} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pkg.name}</span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          isDagspakke 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {isDagspakke ? 'DAGSPAKKE' : 'TILLÆG'}
                        </span>
                      </div>
                      <span className="font-semibold text-teal-600">{pkg.enheder} enheder</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                      {isDagspakke && pkg.expiresAt ? (
                        <span>
                          {language === 'da' ? 'Udløber: ' : 'Expires: '}
                          {new Date(pkg.expiresAt).toLocaleString(language === 'da' ? 'da-DK' : 'en-GB', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      ) : (
                        <span>{isSeasonal 
                          ? (language === 'da' ? 'Aktiv hele sæsonen' : 'Active entire season')
                          : (language === 'da' ? 'Aktiv så længe dagspakken er aktiv' : 'Active while day package is active')
                        }</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Individual Meters */}
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Zap className="h-5 w-5 text-teal-600" />
            {language === 'da' ? 'Dine elmålere' : language === 'de' ? 'Ihre Zähler' : language === 'nl' ? 'Uw meters' : 'Your meters'}
          </h2>
          
          {meters.map((meter) => {
            const isPowerOn = getMeterPowerState(meter);
            
            return (
              <Card key={meter.id} className="border-0 shadow-lg overflow-hidden">
                <div className={`p-4 ${isPowerOn ? 'bg-gradient-to-r from-teal-500 to-teal-600' : 'bg-gray-400'} text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                        <Power className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-semibold">{meter.name}</p>
                        <p className="text-sm text-white/80">
                          {isPowerOn ? (language === 'da' ? 'Tændt' : language === 'de' ? 'Ein' : language === 'nl' ? 'Aan' : 'On') : (language === 'da' ? 'Slukket' : language === 'de' ? 'Aus' : language === 'nl' ? 'Uit' : 'Off')}
                        </p>
                      </div>
                    </div>
                    {/* Effekt og Spænding */}
                    <div className="flex items-center gap-4 text-center">
                      <div>
                        <p className="text-xs text-white/70">{language === 'da' ? 'Effekt' : 'Power'}</p>
                        <p className="text-lg font-bold">{(meter.currentPower || 0).toFixed(1)} W</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/70">{language === 'da' ? 'Spænding' : language === 'de' ? 'Spannung' : language === 'nl' ? 'Spanning' : 'Voltage'}</p>
                        <p className="text-lg font-bold">{Math.round(meter.voltage || 0)} V</p>
                      </div>
                    </div>
                    <Switch
                      checked={isPowerOn}
                      onCheckedChange={() => toggleMeterPower(meter.id, isPowerOn)}
                      className="scale-125"
                    />
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-3xl font-light text-teal-600">{(meter.usedEnheder || 0).toFixed(2)}</span>
                      <span className="text-gray-500 ml-1 text-sm">{language === 'da' ? `enheder brugt på måler ${meter.name}` : `units used on meter ${meter.name}`}</span>
                    </div>
                    <p className="text-xs text-gray-400">ID: {meter.id}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Buy More */}
        {!showPackages ? (
          <Button 
            className="w-full bg-teal-600 hover:bg-teal-700 h-14 text-lg" 
            onClick={() => setShowPackages(true)}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            {language === 'da' ? 'Køb mere strøm' : language === 'de' ? 'Mehr Strom kaufen' : language === 'nl' ? 'Meer stroom kopen' : 'Buy more power'}
          </Button>
        ) : (
          <Card className="border-0 shadow-lg">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center justify-between">
                <span>{language === 'da' ? 'Tillægspakker' : language === 'de' ? 'Zusatzpakete' : language === 'nl' ? 'Aanvullende pakketten' : 'Add-on packages'}</span>
                <Button variant="ghost" size="sm" onClick={() => setShowPackages(false)}>✕</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-gray-500 mb-2">
                {isSeasonal 
                  ? (language === 'da' 
                      ? 'Tillægspakker er aktive hele sæsonen'
                      : 'Add-on packages are active entire season')
                  : (language === 'da' 
                      ? 'Tillægspakker aktiveres automatisk sammen med din dagspakke'
                      : 'Add-on packages activate automatically with your day package')
                }
              </p>
              {tillaegspakker.map((pkg) => (
                <div 
                  key={pkg.id}
                  onClick={() => handleBuyTillaegspakke(pkg)}
                  className="p-4 border rounded-lg hover:border-teal-300 hover:bg-teal-50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-lg text-gray-800">+{pkg.enheder} enheder</p>
                      <p className="text-sm text-gray-500">{(pkg.price / pkg.enheder).toFixed(1)} kr/enhed</p>
                    </div>
                    <p className="font-bold text-2xl text-teal-600">{pkg.price} kr</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GuestPower;
