import { useEffect, useState } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { 
  MapPin, 
  ExternalLink, 
  Navigation, 
  PawPrint, 
  Landmark, 
  TreePine, 
  Mountain, 
  Users,
  Star,
  Loader2
} from 'lucide-react';

const HEADER_IMAGE = 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80';

// Campingpladsens adresse for Google Maps rutevejledning
const CAMPING_LOCATION = 'Jelling+Familie+Camping,+M%C3%B8lvangvej+8,+7300+Jelling';

interface Attraction {
  id: string;
  name: string;
  name_en?: string;
  name_de?: string;
  description: string;
  description_en?: string;
  description_de?: string;
  distance_km: number;
  category: 'zoo' | 'museum' | 'nature' | 'adventure' | 'family' | 'other';
  events_url?: string;
  main_url?: string;
  image_url?: string;
  highlight: boolean;
}

const GuestAttractions = () => {
  const { language } = useGuest();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttractions = async () => {
      try {
        const { data, error } = await supabase
          .from('attractions')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setAttractions(data || []);
      } catch (err) {
        console.error('Fejl ved hentning af attraktioner:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttractions();
  }, []);

  const getCategoryIcon = (category: Attraction['category']) => {
    switch (category) {
      case 'zoo': return PawPrint;
      case 'museum': return Landmark;
      case 'nature': return TreePine;
      case 'adventure': return Mountain;
      case 'family': return Users;
      default: return MapPin;
    }
  };

  const getCategoryColor = (category: Attraction['category']) => {
    switch (category) {
      case 'zoo': return 'bg-amber-100 text-amber-600';
      case 'museum': return 'bg-purple-100 text-purple-600';
      case 'nature': return 'bg-green-100 text-green-600';
      case 'adventure': return 'bg-red-100 text-red-600';
      case 'family': return 'bg-blue-100 text-blue-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getCategoryLabel = (category: Attraction['category']) => {
    const labels: Record<Attraction['category'], Record<string, string>> = {
      zoo: { da: 'Zoo', en: 'Zoo', de: 'Zoo', nl: 'Dierentuin' },
      museum: { da: 'Museum', en: 'Museum', de: 'Museum', nl: 'Museum' },
      nature: { da: 'Natur', en: 'Nature', de: 'Natur', nl: 'Natuur' },
      adventure: { da: 'Eventyr', en: 'Adventure', de: 'Abenteuer', nl: 'Avontuur' },
      family: { da: 'Familie', en: 'Family', de: 'Familie', nl: 'Familie' },
      other: { da: 'Andet', en: 'Other', de: 'Andere', nl: 'Anders' },
    };
    return labels[category]?.[language] || labels[category]?.['en'] || 'Andet';
  };

  // Generer Google Maps URL fra campingpladsen til attraktionen
  const getDirectionsUrl = (attractionName: string) => {
    const destination = encodeURIComponent(attractionName + ', Denmark');
    return `https://www.google.com/maps/dir/${CAMPING_LOCATION}/${destination}`;
  };

  const AttractionCard = ({ attraction }: { attraction: Attraction }) => {
    const IconComponent = getCategoryIcon(attraction.category);
    const colorClass = getCategoryColor(attraction.category);
    
    return (
      <Card className={`overflow-hidden hover:shadow-md transition-shadow ${
        attraction.highlight ? 'border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-white' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${colorClass}`}>
              <IconComponent className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">{attraction.name}</h3>
                  {attraction.highlight && (
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getCategoryLabel(attraction.category)}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {attraction.distance_km} km
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{attraction.description}</p>
              <div className="flex flex-wrap gap-2">
                {/* Find vej knap - Google Maps */}
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-2 bg-blue-600 hover:bg-blue-700"
                  onClick={() => window.open(getDirectionsUrl(attraction.name), '_blank')}
                >
                  <Navigation className="h-4 w-4" />
                  {language === 'da' ? 'Find vej' : language === 'de' ? 'Route' : language === 'nl' ? 'Routebeschrijving' : 'Directions'}
                </Button>
                {/* Besøg hjemmeside */}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => window.open(attraction.main_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  {language === 'da' ? 'Hjemmeside' : language === 'de' ? 'Webseite' : language === 'nl' ? 'Website' : 'Website'}
                </Button>
                {/* Se events */}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 text-muted-foreground"
                  onClick={() => window.open(attraction.events_url, '_blank')}
                >
                  {language === 'da' ? 'Se events' : language === 'de' ? 'Events ansehen' : language === 'nl' ? 'Evenementen bekijken' : 'See events'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={language === 'da' ? 'Attraktioner' : language === 'de' ? 'Attraktionen' : language === 'nl' ? 'Attracties' : 'Attractions'}
        subtitle={language === 'da' ? 'Oplevelser i nærheden af Jelling' : language === 'de' ? 'Erlebnisse in der Nähe von Jelling' : language === 'nl' ? 'Ervaringen in de buurt van Jelling' : 'Experiences near Jelling'}
        image={HEADER_IMAGE}
      />
      
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <MapPin className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            {language === 'da' 
              ? 'Alle attraktioner er inden for 50 km fra Jelling Camping. Klik "Find vej" for rutevejledning fra campingpladsen.'
              : language === 'de' ? 'Alle Attraktionen sind innerhalb von 50 km vom Jelling Camping. Klicken Sie auf "Route" für die Wegbeschreibung vom Campingplatz.'
              : language === 'nl' ? 'Alle attracties liggen binnen 50 km van Jelling Camping. Klik op "Routebeschrijving" voor de route vanaf de camping.'
              : 'All attractions are within 50 km from Jelling Camping. Click "Directions" for route guidance from the campsite.'}
          </p>
        </div>

        {/* Attraktioner liste */}
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : attractions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Ingen attraktioner fundet.</p>
          ) : (
            attractions.map(attraction => (
              <AttractionCard key={attraction.id} attraction={attraction} />
            ))
          )}
        </div>

        {/* Footer note */}
        <p className="text-xs text-center text-muted-foreground pt-4">
          {language === 'da' 
            ? '↗ Alle links åbner i nye vinduer. Tjek hjemmesider for aktuelle åbningstider og priser.'
            : language === 'de' ? '↗ Alle Links öffnen in neuen Fenstern. Überprüfen Sie die Websites für aktuelle Öffnungszeiten und Preise.'
            : language === 'nl' ? '↗ Alle links openen in nieuwe vensters. Controleer websites voor actuele openingstijden en prijzen.'
            : '↗ All links open in new windows. Check websites for current opening hours and prices.'}
        </p>
      </div>
    </div>
  );
};

export default GuestAttractions;
