import { useState, useEffect } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Baby, TreePine, Car, Flag, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DEFAULT_HEADER = 'https://images.unsplash.com/photo-1587578932405-7c740a762f7f?w=1200&q=80';

interface PlaygroundSettings {
  header_image: string | null;
  open_title_da: string;
  open_title_en: string;
  open_title_de: string;
  open_text_da: string;
  open_text_en: string;
  open_text_de: string;
  dinocar_title: string;
  dinocar_image: string | null;
  dinocar_text_da: string;
  dinocar_text_en: string;
  dinocar_text_de: string;
  hoppepude_title: string;
  hoppepude_image: string | null;
  hoppepude_text_da: string;
  hoppepude_text_en: string;
  hoppepude_text_de: string;
  minigolf_title: string;
  minigolf_image: string | null;
  minigolf_text_da: string;
  minigolf_text_en: string;
  minigolf_text_de: string;
  facilities_da: string;
  facilities_en: string;
  facilities_de: string;
  location_text_da: string;
  location_text_en: string;
  location_text_de: string;
}

const GuestPlayground = () => {
  const { language } = useGuest();
  const [settings, setSettings] = useState<PlaygroundSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('playground_settings')
          .select('*')
          .single();
        
        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching playground settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const getText = (da: string, en: string, de: string, nl?: string) => {
    if (language === 'de') return de;
    if (language === 'nl') return nl || en;
    if (language === 'en') return en;
    return da;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return <div className="p-6 text-center text-gray-500">Kunne ikke indlæse data</div>;
  }

  const facilities = getText(settings.facilities_da, settings.facilities_en, settings.facilities_de).split(',');

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={getText('Legeplads', 'Playground', 'Spielplatz', 'Speeltuin')}
        subtitle={getText('Sjov for hele familien', 'Fun for the whole family', 'Spaß für die ganze Familie', 'Plezier voor het hele gezin')}
        image={settings.header_image || DEFAULT_HEADER}
      />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        
        {/* Åbningstider */}
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <Clock className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <h3 className="font-semibold text-green-800 mb-2">
                  {getText(settings.open_title_da, settings.open_title_en, settings.open_title_de)}
                </h3>
                <p className="text-green-700">
                  {getText(settings.open_text_da, settings.open_text_en, settings.open_text_de)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dino Cars */}
        <Card className="border-red-200 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {settings.dinocar_image && (
              <img src={settings.dinocar_image} alt="Dino Cars" className="w-full h-48 md:h-full object-cover" />
            )}
            <CardContent className="p-6 bg-red-50 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <Car className="h-5 w-5 text-red-700" />
                </div>
                <h3 className="font-semibold text-red-800 text-lg">{settings.dinocar_title}</h3>
              </div>
              <p className="text-red-700">
                {getText(settings.dinocar_text_da, settings.dinocar_text_en, settings.dinocar_text_de)}
              </p>
            </CardContent>
          </div>
        </Card>

        {/* Hoppepude */}
        <Card className="border-blue-200 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {settings.hoppepude_image && (
              <img src={settings.hoppepude_image} alt="Hoppepude" className="w-full h-48 md:h-full object-cover" />
            )}
            <CardContent className="p-6 bg-blue-50 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Baby className="h-5 w-5 text-blue-700" />
                </div>
                <h3 className="font-semibold text-blue-800 text-lg">{settings.hoppepude_title}</h3>
              </div>
              <p className="text-blue-700">
                {getText(settings.hoppepude_text_da, settings.hoppepude_text_en, settings.hoppepude_text_de)}
              </p>
            </CardContent>
          </div>
        </Card>

        {/* Minigolf */}
        <Card className="border-green-200 overflow-hidden">
          <div className="grid md:grid-cols-2">
            {settings.minigolf_image && (
              <img src={settings.minigolf_image} alt="Minigolf" className="w-full h-48 md:h-full object-cover" />
            )}
            <CardContent className="p-6 bg-green-50 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <Flag className="h-5 w-5 text-green-700" />
                </div>
                <h3 className="font-semibold text-green-800 text-lg">{settings.minigolf_title}</h3>
              </div>
              <p className="text-green-700">
                {getText(settings.minigolf_text_da, settings.minigolf_text_en, settings.minigolf_text_de)}
              </p>
            </CardContent>
          </div>
        </Card>

        {/* Faciliteter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-green-600" />
              {getText('Øvrige faciliteter', 'Other facilities', 'Weitere Einrichtungen', 'Overige faciliteiten')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-3 text-gray-600">
              {facilities.map((facility, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {facility.trim()}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Placering */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              {getText('Placering', 'Location', 'Standort', 'Locatie')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {getText(settings.location_text_da, settings.location_text_en, settings.location_text_de)}
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default GuestPlayground;
