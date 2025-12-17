import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGuest } from '@/contexts/GuestContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Zap, 
  Croissant, 
  CalendarDays, 
  Coffee, 
  Info,
  CheckCircle2,
  Home,
  ChevronRight,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  Heart,
  Sparkles,
  MapPin,
  Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Jelling koordinater for Yr.no API
const JELLING_LAT = 55.7553;
const JELLING_LON = 9.4197;

// Vejr interface
interface WeatherDay {
  temp: number;
  symbol: string;
  label: string;
}

interface WeatherData {
  days: WeatherDay[];
}

// Billeder fra Jelling Camping stil
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=1600&q=80', // Familie camping
  'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1600&q=80', // Telt i natur
  'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1600&q=80', // Campingvogn
];

// Default billeder - fallback til Unsplash
const DEFAULT_SECTION_IMAGES = {
  power: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
  bakery: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80',
  events: 'https://images.unsplash.com/photo-1472653816316-3ad6f10a6592?w=800&q=80',
  attractions: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80',
  cafe: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&q=80',
  practical: 'https://images.unsplash.com/photo-1571863533956-01c88e79957e?w=800&q=80',
  cabin: 'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?w=800&q=80', // Hytte
  pool: 'https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=800&q=80', // Friluftsbad
  playground: 'https://images.unsplash.com/photo-1564429238535-29e0fb41b04e?w=800&q=80', // Legeplads
};

// Hjælpefunktion til at mappe Yr.no symbol til Lucide ikon
const getWeatherIcon = (symbol: string) => {
  if (symbol.includes('snow')) return CloudSnow;
  if (symbol.includes('rain') || symbol.includes('sleet')) return CloudRain;
  if (symbol.includes('fog')) return CloudFog;
  if (symbol.includes('cloud') || symbol.includes('overcast')) return Cloud;
  return Sun; // clearsky, fair
};

const GuestWelcome = () => {
  const [sectionImages, setSectionImages] = useState(DEFAULT_SECTION_IMAGES);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const { guest, t, language, setGuestData } = useGuest();

  // Hent vejrdata fra Yr.no (Met Norway API) - 4 dage
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(
          `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${JELLING_LAT}&lon=${JELLING_LON}`,
          {
            headers: {
              'User-Agent': 'JellingCampingGuestPortal/1.0 github.com/jelling-camping'
            }
          }
        );
        
        if (!response.ok) throw new Error('Weather fetch failed');
        
        const data = await response.json();
        const timeseries = data.properties.timeseries;
        
        const now = new Date();
        const days: WeatherDay[] = [];
        
        // Dag labels baseret på sprog (håndteres i render)
        const dayLabels = ['today', 'tomorrow', 'day2', 'day3'];
        
        for (let i = 0; i < 4; i++) {
          const targetTime = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
          // Find middag (kl 12) for bedste repræsentation
          targetTime.setHours(12, 0, 0, 0);
          
          const dayData = timeseries.find((t: any) => {
            const time = new Date(t.time);
            return time >= targetTime;
          }) || timeseries[Math.min(i * 24, timeseries.length - 1)];
          
          days.push({
            temp: Math.round(dayData.data.instant.details.air_temperature),
            symbol: dayData.data.next_1_hours?.summary?.symbol_code || 
                    dayData.data.next_6_hours?.summary?.symbol_code || 'cloudy',
            label: dayLabels[i]
          });
        }
        
        setWeather({ days });
      } catch (error) {
        console.error('Error fetching weather:', error);
        // Fallback til default
        setWeather({
          days: [
            { temp: 5, symbol: 'cloudy', label: 'today' },
            { temp: 3, symbol: 'rain', label: 'tomorrow' },
            { temp: 4, symbol: 'cloudy', label: 'day2' },
            { temp: 2, symbol: 'rain', label: 'day3' }
          ]
        });
      } finally {
        setWeatherLoading(false);
      }
    };
    
    fetchWeather();
  }, []);

  // Refresh gæstedata fra database ved page load (kun én gang)
  const [hasRefreshed, setHasRefreshed] = useState(false);
  
  useEffect(() => {
    if (hasRefreshed || !guest.bookingId) return;
    
    const refreshGuestData = async () => {
      try {
        // Prøv regular_customers først
        let { data, error } = await supabase
          .from('regular_customers')
          .select('checked_in, checked_out')
          .eq('booking_id', guest.bookingId)
          .single();
        
        // Hvis ikke fundet, prøv seasonal_customers
        if (error || !data) {
          const seasonalResult = await supabase
            .from('seasonal_customers')
            .select('checked_in, checked_out')
            .eq('booking_id', guest.bookingId)
            .single();
          data = seasonalResult.data;
        }
        
        if (data) {
          const newCheckedIn = data.checked_in ?? false;
          const newCheckedOut = data.checked_out ?? false;
          
          // Kun opdater hvis status har ændret sig
          if (newCheckedIn !== guest.checkedIn || newCheckedOut !== guest.checkedOut) {
            setGuestData({
              ...guest,
              checkedIn: newCheckedIn,
              checkedOut: newCheckedOut,
            });
          }
        }
        setHasRefreshed(true);
      } catch (error) {
        console.error('Error refreshing guest data:', error);
        setHasRefreshed(true);
      }
    };
    
    refreshGuestData();
  }, [guest.bookingId, hasRefreshed]);

  // Hent dashboard billeder fra database
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const { data, error } = await supabase
          .from('dashboard_settings')
          .select('*')
          .eq('id', 'default')
          .single();
        
        if (error) throw error;
        
        if (data) {
          setSectionImages({
            power: data.power_image || DEFAULT_SECTION_IMAGES.power,
            bakery: data.bakery_image || DEFAULT_SECTION_IMAGES.bakery,
            events: data.events_image || DEFAULT_SECTION_IMAGES.events,
            attractions: data.attractions_image || DEFAULT_SECTION_IMAGES.attractions,
            cafe: data.cafe_image || DEFAULT_SECTION_IMAGES.cafe,
            practical: data.practical_image || DEFAULT_SECTION_IMAGES.practical,
            pool: data.pool_image || DEFAULT_SECTION_IMAGES.pool,
            playground: data.playground_image || DEFAULT_SECTION_IMAGES.playground,
            cabin: data.cabin_image || DEFAULT_SECTION_IMAGES.cabin,
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard images:', error);
      }
    };
    fetchImages();
  }, []);

  const arrivalDate = new Date(guest.arrivalDate);
  const departureDate = new Date(guest.departureDate);
  const today = new Date();
  
  // Beregn antal nætter i opholdet (altid departure - arrival)
  const totalNights = Math.max(0, Math.ceil((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // For indtjekkede gæster: vis nætter tilbage. For kommende: vis total nætter i opholdet
  const isCurrentlyCheckedIn = guest.checkedIn && !guest.checkedOut;
  const nightsRemaining = isCurrentlyCheckedIn 
    ? Math.max(0, Math.ceil((departureDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : totalNights;

  // Beregn dage til ankomst (for countdown)
  const daysUntilArrival = Math.max(0, Math.ceil((arrivalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // Nat/nætter logik (flertal)
  const getNightLabel = (nights: number, isRemaining: boolean) => {
    if (language === 'da') {
      const label = nights === 1 ? 'nat' : 'nætter';
      return isRemaining ? `${label} tilbage` : label;
    }
    if (language === 'de') {
      const label = nights === 1 ? 'Nacht' : 'Nächte';
      return isRemaining ? `${label} übrig` : label;
    }
    if (language === 'nl') {
      const label = nights === 1 ? 'nacht' : 'nachten';
      return isRemaining ? `${label} over` : label;
    }
    // English
    const label = nights === 1 ? 'night' : 'nights';
    return isRemaining ? `${label} remaining` : label;
  };

  const formatDate = (date: Date) => {
    const locale = language === 'da' ? 'da-DK' : language === 'de' ? 'de-DE' : language === 'nl' ? 'nl-NL' : 'en-GB';
    return date.toLocaleDateString(locale, { 
      day: 'numeric', 
      month: 'long'
    });
  };

  // Bestem gæstens status
  const isNotArrived = !guest.checkedIn && !guest.checkedOut;
  const isCheckedIn = guest.checkedIn && !guest.checkedOut;
  const isCheckedOut = !guest.checkedIn && guest.checkedOut;

  // Status-specifikke sektioner
  const getWelcomeMessage = () => {
    if (isNotArrived) {
      return language === 'da' ? `Vi ser frem til din ankomst ${formatDate(arrivalDate)}` :
             language === 'de' ? `Wir freuen uns auf Ihre Ankunft am ${formatDate(arrivalDate)}` :
             language === 'nl' ? `Wij kijken uit naar uw aankomst op ${formatDate(arrivalDate)}` :
             `We look forward to your arrival on ${formatDate(arrivalDate)}`;
    }
    if (isCheckedIn) {
      return guest.previousVisits > 0 ? t('welcomeBack') : t('welcome');
    }
    if (isCheckedOut) {
      return language === 'da' ? 'Tak for dit ophold!' :
             language === 'de' ? 'Vielen Dank für Ihren Aufenthalt!' :
             language === 'nl' ? 'Bedankt voor uw verblijf!' :
             'Thank you for your stay!';
    }
    return t('welcome');
  };

  const getStatusBadge = () => {
    if (isNotArrived) {
      return {
        text: language === 'da' ? 'Ikke ankommet' : language === 'de' ? 'Nicht angekommen' : language === 'nl' ? 'Niet aangekomen' : 'Not arrived',
        className: 'bg-orange-600 hover:bg-orange-700'
      };
    }
    if (isCheckedIn) {
      return {
        text: t('checkedIn'),
        className: 'bg-teal-600 hover:bg-teal-700'
      };
    }
    if (isCheckedOut) {
      return {
        text: language === 'da' ? 'Rejst' : language === 'de' ? 'Ausgecheckt' : language === 'nl' ? 'Uitgecheckt' : 'Checked out',
        className: 'bg-gray-600 hover:bg-gray-700'
      };
    }
    return { text: t('notCheckedIn'), className: 'bg-gray-600' };
  };

  const statusBadge = getStatusBadge();

  const sections = [
    { to: '/guest/power', image: sectionImages.power, label: t('power'), sublabel: language === 'da' ? 'Styr din strøm' : language === 'de' ? 'Verwalten Sie Ihren Strom' : language === 'nl' ? 'Beheer uw stroom' : 'Manage your power' },
    { to: '/guest/bakery', image: sectionImages.bakery, label: t('bakery'), sublabel: language === 'da' ? 'Friske morgenbrød' : language === 'de' ? 'Frische Morgenbrötchen' : language === 'nl' ? 'Verse ochtendbroodjes' : 'Fresh morning bread' },
    { to: '/guest/events', image: sectionImages.events, label: t('events'), sublabel: language === 'da' ? 'Se hvad der sker' : language === 'de' ? 'Sehen Sie, was passiert' : language === 'nl' ? 'Bekijk wat er gebeurt' : 'See what\'s happening' },
    { to: '/guest/attractions', image: sectionImages.attractions, label: t('attractions'), sublabel: language === 'da' ? 'Oplevelser i nærheden' : language === 'de' ? 'Erlebnisse in der Nähe' : language === 'nl' ? 'Ervaringen in de buurt' : 'Nearby experiences' },
    { to: '/guest/cafe', image: sectionImages.cafe, label: t('cafe'), sublabel: language === 'da' ? 'Mad & drikke' : language === 'de' ? 'Essen & Trinken' : language === 'nl' ? 'Eten & drinken' : 'Food & drinks' },
    { to: '/guest/practical', image: sectionImages.practical, label: t('practical'), sublabel: language === 'da' ? 'Nødvendig info' : language === 'de' ? 'Wichtige Infos' : language === 'nl' ? 'Belangrijke info' : 'Essential info' },
    { to: '/guest/pool', image: sectionImages.pool, label: language === 'da' ? 'Friluftsbad' : language === 'de' ? 'Freibad' : language === 'nl' ? 'Buitenzwembad' : 'Outdoor Pool', sublabel: language === 'da' ? 'Fri adgang for gæster' : language === 'de' ? 'Freier Zugang für Gäste' : language === 'nl' ? 'Gratis toegang voor gasten' : 'Free access for guests' },
    { to: '/guest/playground', image: sectionImages.playground, label: language === 'da' ? 'Legeplads' : language === 'de' ? 'Spielplatz' : language === 'nl' ? 'Speeltuin' : 'Playground', sublabel: language === 'da' ? 'Sjov for hele familien' : language === 'de' ? 'Spaß für die ganze Familie' : language === 'nl' ? 'Plezier voor het hele gezin' : 'Fun for the whole family' },
  ];

  // Tilføj Cabin for hytte-gæster (uanset check-in status)
  if (guest.bookingType === 'cabin') {
    sections.push({ 
      to: '/guest/cabin', 
      image: sectionImages.cabin, 
      label: t('cabin') || 'Din hytte',
      sublabel: language === 'da' ? 'Info om din hytte' : language === 'de' ? 'Infos zu Ihrer Hütte' : language === 'nl' ? 'Info over uw hut' : 'Cabin information'
    });
  }

  // Alle sektioner vises altid - restriktioner håndteres på undersiderne
  // (Strøm, Bageri, Café har deres egne check-in restriktioner)
  const getFilteredSections = () => {
    return sections;
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section - Fullscreen billede som på jellingcamping.dk */}
      <div 
        className="relative h-[50vh] sm:h-[60vh] bg-cover bg-center"
        style={{
          backgroundImage: `url('${HERO_IMAGES[0]}')`
        }}
      >
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <p className="text-white/80 text-sm sm:text-base tracking-widest uppercase mb-2">
            {language === 'da' ? 'Velkommen til' : language === 'de' ? 'Willkommen bei' : language === 'nl' ? 'Welkom bij' : 'Welcome to'}
          </p>
          <h1 className="text-white text-4xl sm:text-6xl font-serif font-light mb-2">
            JELLING
          </h1>
          <h1 className="text-white text-4xl sm:text-6xl font-serif font-light mb-4">
            FAMILIE CAMPING
          </h1>
          
          {/* Gæst badge */}
          <div className="flex items-center gap-3 mb-4">
            <Badge 
              className={`${statusBadge.className} text-white border-0 text-sm px-3 py-1`}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {statusBadge.text}
            </Badge>
            {/* 
              Plads/hytte visning:
              - Sæsongæster (seasonal): Vis plads (de har fast plads)
              - Hytte gæster (cabin): Vis hytte nummer
              - Kørende campister (camping): Vis ALDRIG plads (de vælger selv tom plads)
              - Ingen visning før check-in
            */}
            {isCheckedIn && guest.spotNumber && (guest.bookingType === 'cabin' || guest.bookingType === 'seasonal') && (
              <Badge className="bg-blue-600 text-white border-0 text-sm px-3 py-1">
                <Home className="h-4 w-4 mr-2" />
                {guest.bookingType === 'cabin' ? guest.spotNumber : `Plads ${guest.spotNumber}`}
              </Badge>
            )}
          </div>

          <p className="text-white text-xl sm:text-2xl font-light">
            {getWelcomeMessage()}, {guest.firstName}!
            <span className="text-white/60 text-base sm:text-lg ml-2">(#{guest.bookingId})</span>
          </p>
        </div>
      </div>

      {/* Teal info banner - som på jellingcamping.dk */}
      <div className="bg-teal-700 text-white py-4 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-6 text-sm sm:text-base">
            <div className="flex items-center gap-2">
              <span className="opacity-80">{t('arrival')}:</span>
              <span className="font-semibold">{formatDate(arrivalDate)}</span>
            </div>
            <div className="hidden sm:block w-px h-6 bg-white/30" />
            <div className="flex items-center gap-2">
              <span className="opacity-80">{t('departure')}:</span>
              <span className="font-semibold">{formatDate(departureDate)}</span>
            </div>
          </div>
          {/* Skjul nætter for sæsongæster */}
          {guest.bookingType !== 'seasonal' && (
            <div className="flex items-center gap-2 bg-white/20 px-4 py-2 rounded-full">
              <span className="text-2xl font-bold">{nightsRemaining}</span>
              <span className="text-sm opacity-90">
                {getNightLabel(nightsRemaining, isCurrentlyCheckedIn)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Vejr sektion - data fra Yr.no (Met Norway) - 4 dage */}
      <div className="bg-gray-50 py-4 px-6">
        <div className="max-w-4xl mx-auto flex justify-center gap-4 sm:gap-8 overflow-x-auto">
          {weatherLoading ? (
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">{language === 'da' ? 'Henter vejr...' : language === 'de' ? 'Wetter wird geladen...' : language === 'nl' ? 'Weer laden...' : 'Loading weather...'}</span>
            </div>
          ) : weather ? (
            <>
              {weather.days.map((day, index) => {
                const WeatherIcon = getWeatherIcon(day.symbol);
                const getDayLabel = (label: string) => {
                  if (label === 'today') return language === 'da' ? 'I dag' : language === 'de' ? 'Heute' : language === 'nl' ? 'Vandaag' : 'Today';
                  if (label === 'tomorrow') return language === 'da' ? 'I morgen' : language === 'de' ? 'Morgen' : language === 'nl' ? 'Morgen' : 'Tomorrow';
                  // For dag 2 og 3, vis ugedag
                  const date = new Date();
                  date.setDate(date.getDate() + index);
                  return date.toLocaleDateString(
                    language === 'da' ? 'da-DK' : language === 'de' ? 'de-DE' : language === 'nl' ? 'nl-NL' : 'en-GB',
                    { weekday: 'short' }
                  );
                };
                
                return (
                  <div key={index} className="flex items-center gap-2 sm:gap-3">
                    {index > 0 && <div className="w-px h-10 bg-gray-300 hidden sm:block" />}
                    <WeatherIcon className={`h-6 w-6 sm:h-8 sm:w-8 ${index === 0 ? 'text-amber-500' : 'text-gray-500'}`} />
                    <div className="text-center sm:text-left">
                      <p className="text-xs text-gray-500 uppercase">{getDayLabel(day.label)}</p>
                      <p className="text-base sm:text-lg font-semibold text-gray-800">{day.temp}°C</p>
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </div>
      </div>

      {/* Countdown boks - kun for kommende gæster */}
      {isNotArrived && daysUntilArrival > 0 && (
        <div className="px-4 sm:px-6 py-6">
          <div className="max-w-2xl mx-auto">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 border border-amber-200/50 shadow-lg">
              {/* Dekorative elementer */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-rose-200/30 to-transparent rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative p-6 sm:p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Sparkles className="h-5 w-5" />
                    <Heart className="h-6 w-6 text-rose-500 animate-pulse" />
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
                
                <p className="text-lg sm:text-xl text-gray-700 font-medium mb-4">
                  {language === 'da' ? 'Vi glæder os så meget til at se dig,' :
                   language === 'de' ? 'Wir freuen uns so sehr, Sie zu sehen,' :
                   language === 'nl' ? 'We kijken er zo naar uit om je te zien,' :
                   'We are so excited to see you,'}
                </p>
                <p className="text-base sm:text-lg text-gray-600 mb-6">
                  {language === 'da' ? 'at vi er begyndt at tælle dagene' :
                   language === 'de' ? 'dass wir angefangen haben, die Tage zu zählen' :
                   language === 'nl' ? 'dat we de dagen zijn gaan tellen' :
                   'that we have started counting the days'}
                </p>
                
                <div className="inline-flex flex-col items-center bg-white/80 backdrop-blur-sm rounded-xl px-8 py-4 shadow-inner border border-amber-100">
                  <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">
                    {daysUntilArrival === 0 ? '🎉' : daysUntilArrival}
                  </span>
                  <span className="text-sm sm:text-base text-gray-600 mt-1 font-medium">
                    {daysUntilArrival === 0 
                      ? (language === 'da' ? 'I dag er dagen!' : language === 'de' ? 'Heute ist der Tag!' : language === 'nl' ? 'Vandaag is de dag!' : 'Today is the day!')
                      : daysUntilArrival === 1 
                        ? (language === 'da' ? 'dag' : language === 'de' ? 'Tag' : language === 'nl' ? 'dag' : 'day')
                        : (language === 'da' ? 'dage' : language === 'de' ? 'Tage' : language === 'nl' ? 'dagen' : 'days')}
                  </span>
                </div>
                
                <p className="text-base sm:text-lg text-gray-600 mt-6 font-medium">
                  {language === 'da' ? 'til du er her' :
                   language === 'de' ? 'bis Sie hier sind' :
                   language === 'nl' ? 'tot je hier bent' :
                   'until you are here'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid sektioner - som på jellingcamping.dk */}
      <div className="p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {!isCheckedOut && (
            <h2 className="text-2xl font-serif text-gray-800 mb-6 text-center">
              {isNotArrived ? (language === 'da' ? 'Forbered dit ophold' : language === 'de' ? 'Bereiten Sie Ihren Aufenthalt vor' : language === 'nl' ? 'Bereid uw verblijf voor' : 'Prepare your stay') :
               isCheckedIn ? (language === 'da' ? 'Dit ophold' : language === 'de' ? 'Ihr Aufenthalt' : language === 'nl' ? 'Uw verblijf' : 'Your stay') :
               (language === 'da' ? 'Information' : language === 'de' ? 'Information' : language === 'nl' ? 'Informatie' : 'Information')}
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredSections().map((section) => (
              <Link
                key={section.to}
                to={section.to}
                className="group relative h-48 sm:h-64 overflow-hidden rounded-lg"
              >
                {/* Baggrundsbillede */}
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110"
                  style={{ backgroundImage: `url('${section.image}')` }}
                />
                
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  <h3 className="text-white text-2xl font-semibold mb-1">
                    {section.label}
                  </h3>
                  <p className="text-white/80 text-sm mb-3">
                    {section.sublabel}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-fit bg-transparent border-white text-white hover:bg-white hover:text-gray-900 transition-colors"
                  >
                    {language === 'da' ? 'Se mere' : language === 'de' ? 'Ansehen' : language === 'nl' ? 'Bekijken' : 'View'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Footer message - som på jellingcamping.dk */}
      <div 
        className="relative h-48 sm:h-64 bg-cover bg-center mt-4"
        style={{
          backgroundImage: `url('${HERO_IMAGES[1]}')`
        }}
      >
        <div className="absolute inset-0 bg-teal-800/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
          <h2 className="text-white text-2xl sm:text-4xl font-serif mb-4">
            {isCheckedOut ? 
              (language === 'da' ? 'Vi ses igen!' : 
               language === 'de' ? 'Wir sehen uns wieder!' :
               language === 'nl' ? 'Tot ziens!' :
               'See you again!') :
              (language === 'da' ? 'Vi glæder os til at gøre dit ophold uforglemmelig' : 
               language === 'de' ? 'Wir freuen uns, Ihren Aufenthalt unvergesslich zu machen' :
               language === 'nl' ? 'Wij kijken ernaar uit om uw verblijf onvergetelijk te maken' :
               'We look forward to making your stay unforgettable')
            }
          </h2>
          <p className="text-white/80 text-sm">
            {language === 'da' ? 'Receptionen er åben alle dage 08.00 - 20.00' :
             language === 'de' ? 'Rezeption geöffnet täglich 08.00 - 20.00' :
             language === 'nl' ? 'Receptie geopend dagelijks 08.00 - 20.00' :
             'Reception open daily 08.00 - 20.00'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default GuestWelcome;
