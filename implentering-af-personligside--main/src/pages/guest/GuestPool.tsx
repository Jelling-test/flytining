import { useState, useEffect } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, CreditCard, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const DEFAULT_HEADER = 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?w=1200&q=80';

interface PoolSettings {
  header_image: string | null;
  access_title_da: string;
  access_title_en: string;
  access_title_de: string;
  access_text_da: string;
  access_text_en: string;
  access_text_de: string;
  season_dates: string;
  morning_swim_time: string;
  period1_label: string;
  period1_dates: string;
  period1_weekdays: string;
  period1_weekend: string;
  period2_label: string;
  period2_dates: string;
  period2_everyday: string;
  closed_dates: string | null;
  location_address: string;
  location_text_da: string;
  location_text_en: string;
  location_text_de: string;
  external_url: string;
}

const GuestPool = () => {
  const { language } = useGuest();
  const [settings, setSettings] = useState<PoolSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('pool_settings')
          .select('*')
          .single();
        
        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching pool settings:', error);
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

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={getText('Jelling Friluftsbad', 'Jelling Outdoor Pool', 'Jelling Freibad', 'Jelling Buitenbad')}
        subtitle={getText('Fri adgang for alle gæster', 'Free access for all guests', 'Freier Eintritt für alle Gäste', 'Gratis toegang voor alle gasten')}
        image={settings.header_image || DEFAULT_HEADER}
      />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        
        {/* Info kort */}
        <Card className="border-teal-200 bg-teal-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-teal-100 rounded-full">
                <CreditCard className="h-6 w-6 text-teal-700" />
              </div>
              <div>
                <h3 className="font-semibold text-teal-800 mb-2">
                  {getText(settings.access_title_da, settings.access_title_en, settings.access_title_de)}
                </h3>
                <p className="text-teal-700">
                  {getText(settings.access_text_da, settings.access_text_en, settings.access_text_de)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Åbningstider */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              {getText('Åbningstider 2025', 'Opening Hours 2025', 'Öffnungszeiten 2025', 'Openingstijden 2025')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500 mb-4">{settings.season_dates}</p>
            
            {/* Morgensvømning */}
            <div className="border-b pb-4">
              <h4 className="font-medium mb-2">
                {getText('Morgensvømning', 'Morning Swim', 'Morgenschwimmen', 'Ochtendzwemmen')}
              </h4>
              <p className="text-gray-600">{settings.morning_swim_time}</p>
            </div>
            
            {/* Lavsæson */}
            <div className="border-b pb-4">
              <h4 className="font-medium mb-2 text-blue-700">
                {settings.period1_label}: {settings.period1_dates}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">{getText('Hverdage', 'Weekdays', 'Wochentage', 'Weekdagen')}:</span>
                  <span className="ml-2 font-medium text-orange-600">{settings.period1_weekdays}</span>
                </div>
                <div>
                  <span className="text-gray-500">{getText('Weekend', 'Weekend', 'Wochenende', 'Weekend')}:</span>
                  <span className="ml-2 font-medium text-orange-600">{settings.period1_weekend}</span>
                </div>
              </div>
            </div>
            
            {/* Højsæson */}
            <div className="border-b pb-4 bg-teal-50 -mx-6 px-6 py-4">
              <h4 className="font-medium mb-2 text-teal-700">
                {settings.period2_label}: {settings.period2_dates}
              </h4>
              <div className="text-sm">
                <span className="text-gray-500">{getText('Alle dage', 'Every day', 'Alle Tage', 'Alle dagen')}:</span>
                <span className="ml-2 font-medium text-orange-600">{settings.period2_everyday}</span>
              </div>
            </div>
            
            {/* Lukket */}
            {settings.closed_dates && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-lg">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {getText('Lukket', 'Closed', 'Geschlossen', 'Gesloten')} {settings.closed_dates}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Placering */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-teal-600" />
              {getText('Placering', 'Location', 'Standort', 'Locatie')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{settings.location_address}</p>
            <p className="text-gray-500 text-sm mb-4">
              {getText(settings.location_text_da, settings.location_text_en, settings.location_text_de)}
            </p>
            {settings.external_url && (
              <a href={settings.external_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  {getText('Se mere på vejle.dk', 'See more at vejle.dk', 'Mehr auf vejle.dk', 'Meer op vejle.dk')}
                </Button>
              </a>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default GuestPool;
