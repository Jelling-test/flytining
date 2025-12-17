import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, MapPin, Users, ExternalLink, Tent, Loader2, Navigation, Sparkles, X, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const HEADER_IMAGE = 'https://images.unsplash.com/photo-1472653816316-3ad6f10a6592?w=1200&q=80';

// Campingpladsens adresse for Google Maps rutevejledning
const CAMPING_LOCATION = 'Jelling+Familie+Camping,+M%C3%B8lvangvej+8,+7300+Jelling';

interface CampEvent {
  id: string;
  title: string;
  title_en?: string;
  title_de?: string;
  description: string;
  description_en?: string;
  description_de?: string;
  event_date: string;
  event_time: string;
  end_time?: string;
  location: string;
  target_group: 'families' | 'adults' | 'children' | 'all';
  registration_place: 'reception' | 'cafe' | 'none';
  max_participants?: number;
  image_url?: string;
}

interface ExternalEvent {
  id: string;
  attraction_name: string;
  title: string;
  title_en?: string;
  title_de?: string;
  description?: string;
  description_en?: string;
  description_de?: string;
  event_date: string;
  event_time?: string;
  end_date?: string;
  location: string;
  distance_km: number;
  category: string;
  event_url?: string;
  attraction_url?: string;
}

// Unified event type for display
interface UnifiedEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  end_time?: string;
  location: string;
  distance_km: number;
  isInternal: boolean;
  image_url?: string;
  // Internal event specific
  target_group?: 'families' | 'adults' | 'children' | 'all';
  registration_place?: 'reception' | 'cafe' | 'none';
  // External event specific
  attraction_name?: string;
  event_url?: string;
  attraction_url?: string;
  category?: string;
}


const GuestEvents = () => {
  const { t, language, guest } = useGuest();
  const [allEvents, setAllEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);

  // Beregn dato range: fra ankomst (eller i dag hvis ankomst er i fortiden) + 14 dage
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const arrivalDate = new Date(guest.arrivalDate);
    arrivalDate.setHours(0, 0, 0, 0);
    
    // Start fra ankomst eller i dag (hvad der er senest)
    const startDate = arrivalDate > today ? arrivalDate : today;
    
    // 14 dage frem
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    };
  };

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { start, end } = getDateRange();
        console.log('📅 Fetching events from', start, 'to', end);
        
        // Hent interne events
        const { data: internalData, error: internalError } = await supabase
          .from('camp_events')
          .select('*')
          .gte('event_date', start)
          .lte('event_date', end)
          .order('event_date', { ascending: true });

        console.log('🏕️ Camp events:', internalData?.length || 0, 'found', internalError ? 'ERROR:' + internalError.message : '');
        if (internalError) throw internalError;

        // Hent eksterne events (max 50 km)
        const { data: externalData, error: externalError } = await supabase
          .from('external_events')
          .select('*')
          .gte('event_date', start)
          .lte('event_date', end)
          .lte('distance_km', 50)
          .order('event_date', { ascending: true });

        if (externalError) throw externalError;

        // Konverter til unified format
        const internalEvents: UnifiedEvent[] = (internalData || []).map(e => ({
          id: e.id,
          title: language === 'en' && e.title_en ? e.title_en : language === 'de' && e.title_de ? e.title_de : e.title,
          description: language === 'en' && e.description_en ? e.description_en : language === 'de' && e.description_de ? e.description_de : e.description,
          event_date: e.event_date,
          event_time: e.event_time,
          end_time: e.end_time,
          location: e.location,
          distance_km: 0, // Intern = på pladsen
          isInternal: true,
          image_url: e.image_url,
          target_group: e.target_group,
          registration_place: e.registration_place,
        }));

        const externalEvents: UnifiedEvent[] = (externalData || []).map(e => ({
          id: e.id,
          title: language === 'en' && e.title_en ? e.title_en : language === 'de' && e.title_de ? e.title_de : e.title,
          description: language === 'en' && e.description_en ? e.description_en : language === 'de' && e.description_de ? e.description_de : e.description,
          event_date: e.event_date,
          event_time: e.event_time,
          location: e.location,
          distance_km: e.distance_km,
          isInternal: false,
          image_url: e.image_url,
          attraction_name: e.attraction_name,
          event_url: e.event_url,
          attraction_url: e.attraction_url,
          category: e.category,
        }));

        // Kombiner og sorter: interne først, derefter efter dato
        const combined = [...internalEvents, ...externalEvents].sort((a, b) => {
          // Interne events først på samme dato
          if (a.event_date === b.event_date) {
            if (a.isInternal && !b.isInternal) return -1;
            if (!a.isInternal && b.isInternal) return 1;
            return (a.distance_km || 0) - (b.distance_km || 0);
          }
          return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
        });

        setAllEvents(combined);
      } catch (err) {
        console.error('Fejl ved hentning af events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [guest.arrivalDate, language]);


  const formatDate = (dateStr: string) => {
    const locale = language === 'da' ? 'da-DK' : language === 'de' ? 'de-DE' : language === 'nl' ? 'nl-NL' : 'en-GB';
    return new Date(dateStr).toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const getTargetGroupLabel = (group: CampEvent['target_group'] | undefined) => {
    const labels = {
      families: { da: 'Familier', en: 'Families', de: 'Familien', nl: 'Gezinnen' },
      adults: { da: 'Voksne', en: 'Adults', de: 'Erwachsene', nl: 'Volwassenen' },
      children: { da: 'Børn', en: 'Children', de: 'Kinder', nl: 'Kinderen' },
      all: { da: 'Alle', en: 'Everyone', de: 'Alle', nl: 'Iedereen' },
    };
    const safeGroup = group && labels[group] ? group : 'all';
    return labels[safeGroup][language] || labels[safeGroup]['en'];
  };

  const getRegistrationLabel = (place: CampEvent['registration_place'] | undefined) => {
    if (!place || place === 'none') return null;
    const labels = {
      reception: { da: 'Tilmeld i receptionen', en: 'Sign up at reception', de: 'Anmeldung an der Rezeption', nl: 'Aanmelden bij receptie' },
      cafe: { da: 'Tilmeld i caféen', en: 'Sign up at café', de: 'Anmeldung im Café', nl: 'Aanmelden in café' },
    };
    if (!labels[place]) return null;
    return labels[place][language] || labels[place]['en'];
  };

  // Generer Google Maps URL fra campingpladsen til attraktionen
  const getDirectionsUrl = (attractionName: string) => {
    const destination = encodeURIComponent(attractionName + ', Denmark');
    return `https://www.google.com/maps/dir/${CAMPING_LOCATION}/${destination}`;
  };

  // Default event billede
  const DEFAULT_EVENT_IMAGE = 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80';

  // Unified Event Card - viser både interne og eksterne events med billede
  const UnifiedEventCard = ({ event }: { event: UnifiedEvent }) => {
    const isInternal = event.isInternal;
    
    return (
      <Card 
        className={`overflow-hidden transition-all cursor-pointer ${
          isInternal 
            ? 'border-2 border-teal-300 bg-gradient-to-r from-teal-50 to-white shadow-md hover:shadow-lg' 
            : 'hover:shadow-md'
        }`}
        onClick={() => setSelectedEvent(event)}
      >
        <div className="flex">
          {/* Billede */}
          <div className="w-28 h-28 flex-shrink-0 relative">
            <img 
              src={event.image_url || DEFAULT_EVENT_IMAGE}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            {isInternal && (
              <div className="absolute top-1 left-1 bg-teal-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                <Tent className="h-3 w-3" />
              </div>
            )}
          </div>
          
          {/* Indhold */}
          <CardContent className="p-3 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className={`font-semibold text-sm line-clamp-1 ${isInternal ? 'text-teal-800' : 'text-foreground'}`}>
                  {event.title}
                </h3>
                <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </div>
              
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(event.event_date)}
                </span>
                {event.event_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {event.event_time.slice(0, 5)}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2">
              {isInternal ? (
                <Badge className="bg-teal-600 text-white text-xs">
                  {language === 'da' ? 'På pladsen' : 'On-site'}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  {event.distance_km} km
                </Badge>
              )}
              {event.target_group && (
                <Badge variant="outline" className="text-xs">
                  {getTargetGroupLabel(event.target_group)}
                </Badge>
              )}
            </div>
          </CardContent>
        </div>
      </Card>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={t('events')}
        subtitle={language === 'da' ? 'Events på og omkring campingpladsen' : language === 'de' ? 'Veranstaltungen auf und um den Campingplatz' : language === 'nl' ? 'Evenementen op en rond de camping' : 'Events at and around the campsite'}
        image={HEADER_IMAGE}
      />
      
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* EVENTS I DIN PERIODE */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-teal-600" />
            <h2 className="font-semibold text-lg">
              {language === 'da' ? 'Events i din periode' : language === 'de' ? 'Veranstaltungen während Ihres Aufenthalts' : language === 'nl' ? 'Evenementen tijdens uw verblijf' : 'Events during your stay'}
            </h2>
            <span className="text-sm text-muted-foreground ml-auto">
              {language === 'da' ? 'De næste 14 dage • Max 50 km' : language === 'de' ? 'Die nächsten 14 Tage • Max 50 km' : language === 'nl' ? 'De komende 14 dagen • Max 50 km' : 'Next 14 days • Max 50 km'}
            </span>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : allEvents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-gray-500 font-medium">
                  {language === 'da' ? 'Ingen events fundet' : language === 'de' ? 'Keine Veranstaltungen gefunden' : language === 'nl' ? 'Geen evenementen gevonden' : 'No events found'}
                </p>
                <p className="text-sm text-gray-400">
                  {language === 'da' ? 'Der er ingen events i den valgte periode' : language === 'de' ? 'Es gibt keine Veranstaltungen im ausgewählten Zeitraum' : language === 'nl' ? 'Er zijn geen evenementen in de geselecteerde periode' : 'There are no events in the selected period'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allEvents.map(event => (
                <UnifiedEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          {selectedEvent && (
            <>
              {/* Stort billede */}
              <div className="relative h-48 w-full">
                <img 
                  src={selectedEvent.image_url || DEFAULT_EVENT_IMAGE}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
                {selectedEvent.isInternal && (
                  <div className="absolute top-3 left-3 bg-teal-600 text-white text-sm px-2 py-1 rounded flex items-center gap-1">
                    <Tent className="h-4 w-4" />
                    {language === 'da' ? 'På pladsen' : 'On-site'}
                  </div>
                )}
              </div>
              
              {/* Indhold */}
              <div className="p-6 space-y-4">
                <DialogHeader>
                  <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
                </DialogHeader>
                
                {/* Info */}
                <div className="flex flex-wrap gap-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(selectedEvent.event_date)}
                  </div>
                  {selectedEvent.event_time && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      {selectedEvent.event_time.slice(0, 5)}
                      {selectedEvent.end_time && ` - ${selectedEvent.end_time.slice(0, 5)}`}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.location}
                  </div>
                  {selectedEvent.target_group && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Users className="h-4 w-4" />
                      {getTargetGroupLabel(selectedEvent.target_group)}
                    </div>
                  )}
                </div>
                
                {/* Beskrivelse */}
                {selectedEvent.description && (
                  <p className="text-gray-600">{selectedEvent.description}</p>
                )}
                
                {/* Knapper */}
                <div className="flex flex-wrap gap-3 pt-2">
                  {selectedEvent.isInternal && selectedEvent.registration_place && selectedEvent.registration_place !== 'none' && (
                    <Button className="bg-teal-600 hover:bg-teal-700">
                      {getRegistrationLabel(selectedEvent.registration_place)}
                    </Button>
                  )}
                  
                  {!selectedEvent.isInternal && (
                    <>
                      {selectedEvent.event_url && (
                        <Button 
                          variant="outline" 
                          className="gap-2"
                          onClick={() => window.open(selectedEvent.event_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {language === 'da' ? 'Læs mere' : language === 'de' ? 'Mehr lesen' : language === 'nl' ? 'Lees meer' : 'Read more'}
                        </Button>
                      )}
                      <Button 
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                        onClick={() => window.open(getDirectionsUrl(selectedEvent.attraction_name || selectedEvent.location), '_blank')}
                      >
                        <Navigation className="h-4 w-4" />
                        {language === 'da' ? 'Find vej' : language === 'de' ? 'Wegbeschreibung' : language === 'nl' ? 'Routebeschrijving' : 'Directions'}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuestEvents;
