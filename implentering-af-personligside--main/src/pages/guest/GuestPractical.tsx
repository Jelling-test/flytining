import { useState, useEffect } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Wifi, 
  Phone, 
  Clock, 
  Car, 
  Droplets, 
  Trash2, 
  Dog,
  MapPin,
  Train,
  ShoppingBag,
  Baby,
  Pill,
  Hospital,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

const DEFAULT_HEADER = 'https://images.unsplash.com/photo-1571863533956-01c88e79957e?w=1200&q=80';

// Icon mapping
const iconMap: Record<string, any> = {
  Pill, ShoppingBag, Hospital, Droplets, Trash2, Car, Dog, Baby, MapPin, Phone, Wifi
};

interface PracticalInfo {
  wifi_network: string;
  wifi_password: string | null;
  wifi_open: boolean;
  header_image: string | null;
  checkout_time: string;
  address_name: string;
  address_street: string;
  address_city: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  is_urgent: boolean;
}

interface NearbyService {
  id: string;
  name: string;
  icon: string;
  distance: string;
  hours: string;
}

interface Transport {
  id: string;
  name: string;
  distance: string;
}

interface Facility {
  id: string;
  name: string;
  name_en?: string;
  name_de?: string;
  name_nl?: string;
  icon: string;
  info: string;
  info_en?: string;
  info_de?: string;
  info_nl?: string;
}

const GuestPractical = () => {
  const { t, language } = useGuest();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<PracticalInfo | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [services, setServices] = useState<NearbyService[]>([]);
  const [transport, setTransport] = useState<Transport[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [infoRes, contactsRes, servicesRes, transportRes, facilitiesRes] = await Promise.all([
        supabase.from('practical_info').select('*').single(),
        supabase.from('practical_emergency_contacts').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('practical_nearby_services').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('practical_transport').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('practical_facilities').select('*').eq('is_active', true).order('sort_order'),
      ]);
      
      if (infoRes.data) setInfo(infoRes.data);
      if (contactsRes.data) setContacts(contactsRes.data);
      if (servicesRes.data) setServices(servicesRes.data);
      if (transportRes.data) setTransport(transportRes.data);
      if (facilitiesRes.data) setFacilities(facilitiesRes.data);
    } catch (error) {
      console.error('Error fetching practical info:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (iconName: string) => iconMap[iconName] || MapPin;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={t('practicalInfo')}
        subtitle={language === 'da' ? 'Alt du har brug for at vide' : language === 'de' ? 'Alles was Sie wissen müssen' : language === 'nl' ? 'Alles wat u moet weten' : 'Everything you need to know'}
        image={info?.header_image || DEFAULT_HEADER}
      />
      
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* WiFi */}
        {info && (
          <Card className="bg-teal-50 border-teal-200">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wifi className="h-5 w-5 text-primary" />
                {t('wifiInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-2">
                <p className="text-lg font-medium text-primary">
                  {info.wifi_open ? (
                    language === 'da' ? 'Åbent netværk - ingen kode' : 
                    language === 'de' ? 'Offenes Netzwerk - kein Passwort' : 
                    language === 'nl' ? 'Open netwerk - geen wachtwoord' : 
                    'Open network - no password'
                  ) : (
                    language === 'da' ? `Kodeord: ${info.wifi_password}` : language === 'de' ? `Passwort: ${info.wifi_password}` : language === 'nl' ? `Wachtwoord: ${info.wifi_password}` : `Password: ${info.wifi_password}`
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {language === 'da' ? `Forbind til "${info.wifi_network}"` :
                   language === 'de' ? `Verbinden mit "${info.wifi_network}"` :
                   language === 'nl' ? `Verbinden met "${info.wifi_network}"` :
                   `Connect to "${info.wifi_network}"`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Emergency Contacts */}
        {contacts.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Phone className="h-5 w-5 text-rose-500" />
              {t('emergencyContacts')}
            </h2>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {contacts.map((contact) => (
                  <a 
                    key={contact.id}
                    href={`tel:${contact.phone.replace(/\s/g, '')}`}
                    className={`flex items-center justify-between p-4 hover:bg-muted/50 transition-colors ${contact.is_urgent ? 'bg-rose-500/5' : ''}`}
                  >
                    <span className={`font-medium ${contact.is_urgent ? 'text-rose-600' : ''}`}>{contact.name}</span>
                    <span className={`font-mono ${contact.is_urgent ? 'text-rose-600 font-bold' : 'text-primary'}`}>{contact.phone}</span>
                  </a>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Nearby Services */}
        {services.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg">
              {language === 'da' ? 'I nærheden' : language === 'de' ? 'In der Nähe' : language === 'nl' ? 'In de buurt' : 'Nearby'}
            </h2>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {services.map((service) => {
                  const IconComponent = getIcon(service.icon);
                  return (
                    <div key={service.id} className="flex items-center gap-3 p-4">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.hours}</p>
                      </div>
                      <span className="text-sm text-muted-foreground">{service.distance}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Transport */}
        {transport.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Train className="h-5 w-5 text-blue-500" />
              {language === 'da' ? 'Transport & Afstande' : language === 'de' ? 'Transport & Entfernungen' : language === 'nl' ? 'Vervoer & Afstanden' : 'Transport & Distances'}
            </h2>
            <Card>
              <CardContent className="p-0 divide-y divide-border">
                {transport.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4">
                    <span className="font-medium text-sm">{item.name}</span>
                    <span className="text-sm text-muted-foreground">{item.distance}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open('https://rejseplanen.dk', '_blank')}
            >
              <Train className="h-4 w-4 mr-2" />
              Rejseplanen.dk
            </Button>
          </section>
        )}

        {/* Check-out */}
        {info && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-primary" />
                {t('checkoutInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {language === 'da' ? 'Check-out senest' : language === 'de' ? 'Check-out spätestens' : language === 'nl' ? 'Check-out uiterlijk' : 'Check-out by'}
                </span>
                <span className="font-medium">{info.checkout_time}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Facilities */}
        {facilities.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg">{t('facilities')}</h2>
            <div className="grid grid-cols-2 gap-3">
              {facilities.map((facility) => {
                const IconComponent = getIcon(facility.icon);
                return (
                  <Card key={facility.id}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{language === 'en' ? (facility.name_en || facility.name) : language === 'de' ? (facility.name_de || facility.name) : language === 'nl' ? (facility.name_nl || facility.name_en || facility.name) : facility.name}</p>
                        <p className="text-xs text-muted-foreground">{language === 'en' ? (facility.info_en || facility.info) : language === 'de' ? (facility.info_de || facility.info) : language === 'nl' ? (facility.info_nl || facility.info_en || facility.info) : facility.info}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Address */}
        {info && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-4 flex items-start gap-3">
              <MapPin className="h-5 w-5 text-teal-600 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-800">{info.address_name}</p>
                <p className="text-sm text-gray-500">{info.address_street}</p>
                <p className="text-sm text-gray-500">{info.address_city}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GuestPractical;
