import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { 
  Home,
  CheckCircle2,
  AlertCircle,
  Phone,
  DoorOpen,
  DoorClosed,
  Sparkles,
  UtensilsCrossed,
  Bed,
  Bath,
  ClipboardList,
  Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

const HEADER_IMAGE = 'https://jkmqliztlhmfyejhmuil.supabase.co/storage/v1/object/public/images/hytten.png';

interface ChecklistItem {
  id: string;
  text_da: string;
  text_en: string;
  text_de: string;
  fee?: number;
}

interface InfoSection {
  id: string;
  title_da: string;
  title_en: string;
  title_de: string;
  text_da: string;
  text_en: string;
  text_de: string;
  icon: string;
  cabin_numbers: string[] | 'all';
}

interface InventoryItem {
  id: string;
  quantity_4: number;
  quantity_6: number;
  name_da: string;
  name_en: string;
  name_de: string;
}

interface CabinSettings {
  arrival_items: ChecklistItem[];
  departure_items: ChecklistItem[];
  cleaning_price: number;
  cleaning_items: ChecklistItem[];
  phone: string;
  info_sections: InfoSection[];
  inventory: InventoryItem[];
  cabin_6_persons: string[];
}

const DEFAULT_SETTINGS: CabinSettings = {
  arrival_items: [
    { id: '1', text_da: 'Tjek om der er det anførte antal service i skabe/skuffer – ved mangler kontakt receptionen.', text_en: 'Check if there is the stated amount of tableware in cabinets/drawers - contact reception if missing.', text_de: 'Prüfen Sie, ob das angegebene Geschirr in Schränken/Schubladen vorhanden ist.' },
    { id: '2', text_da: 'Er der øvrige mangler eller manglende rengøring skal det meldes til receptionen umiddelbart efter ankomst.', text_en: 'Any other deficiencies must be reported to reception immediately upon arrival.', text_de: 'Sonstige Mängel müssen sofort nach Ankunft an der Rezeption gemeldet werden.' },
    { id: '3', text_da: 'Skulle noget gå i stykker så henvend jer i receptionen.', text_en: 'If something breaks, please contact reception.', text_de: 'Sollte etwas kaputt gehen, wenden Sie sich bitte an die Rezeption.' },
  ],
  departure_items: [
    { id: '1', text_da: 'Affald/madampose/dåser/flasker fjernet og sorteret', text_en: 'Waste/garbage sorted and removed', text_de: 'Abfall sortiert und entfernt', fee: 50 },
    { id: '2', text_da: 'Evt. lejet sengelinned pillet af og lagt på gulvet', text_en: 'Rented bed linen removed and placed on floor', text_de: 'Gemietete Bettwäsche abgezogen', fee: 50 },
    { id: '3', text_da: 'Opvasken taget og service sat på plads', text_en: 'Dishes washed and put away', text_de: 'Geschirr gespült und weggeräumt', fee: 100 },
    { id: '4', text_da: 'Mikro/miniovn, kaffemaskine og elkedel rengjort', text_en: 'Microwave, coffee maker and kettle cleaned', text_de: 'Mikrowelle, Kaffeemaschine und Wasserkocher gereinigt', fee: 100 },
    { id: '5', text_da: 'Køleskabet tømt og rengjort', text_en: 'Refrigerator emptied and cleaned', text_de: 'Kühlschrank geleert und gereinigt', fee: 100 },
    { id: '6', text_da: 'Evt. lejet barneseng/højstol afleveret i receptionen', text_en: 'Rented crib/high chair returned to reception', text_de: 'Gemietetes Kinderbett/Hochstuhl abgegeben', fee: 100 },
  ],
  cleaning_price: 300,
  cleaning_items: [
    { id: '1', text_da: 'Badeværelse rengjort', text_en: 'Bathroom cleaned', text_de: 'Badezimmer gereinigt', fee: 200 },
    { id: '2', text_da: 'Overflader tørt af', text_en: 'Surfaces wiped', text_de: 'Oberflächen abgewischt', fee: 200 },
    { id: '3', text_da: 'Gulve fejet og vasket', text_en: 'Floors swept and washed', text_de: 'Böden gefegt und gewaschen', fee: 200 },
  ],
  phone: '+45 75 87 16 53',
  info_sections: [
    { id: '1', icon: 'kitchen', title_da: 'Køkken', title_en: 'Kitchen', title_de: 'Küche', text_da: 'Tallerkner, kopper, bestik til 6 personer, gryder, pander, elkedel', text_en: 'Plates, cups, cutlery for 6 persons, pots, pans, kettle', text_de: 'Teller, Tassen, Besteck für 6 Personen, Töpfe, Pfannen, Wasserkocher', cabin_numbers: 'all' },
    { id: '2', icon: 'bedroom', title_da: 'Soveværelse', title_en: 'Bedroom', title_de: 'Schlafzimmer', text_da: 'Dyner og puder (medbring eget sengetøj eller lej)', text_en: 'Duvets and pillows (bring own linens or rent)', text_de: 'Bettdecken und Kissen (eigene Bettwäsche mitbringen oder mieten)', cabin_numbers: 'all' },
    { id: '3', icon: 'bathroom', title_da: 'Badeværelse', title_en: 'Bathroom', title_de: 'Badezimmer', text_da: 'Håndklæder er IKKE inkluderet', text_en: 'Towels are NOT included', text_de: 'Handtücher sind NICHT enthalten', cabin_numbers: 'all' },
    { id: '4', icon: 'cleaning', title_da: 'Rengøring', title_en: 'Cleaning', title_de: 'Reinigung', text_da: 'Kost, moppe, fejebakke, opvaskemiddel', text_en: 'Broom, mop, dustpan, dish soap', text_de: 'Besen, Mopp, Kehrschaufel, Spülmittel', cabin_numbers: 'all' },
  ],
  inventory: [],
  cabin_6_persons: ['28', '32', '33', '34', '36', '37', '38', '39', '40', '42'],
};

const GuestCabin = () => {
  const { guest, language } = useGuest();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<CabinSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('cabin_settings')
          .select('*')
          .single();
        
        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching cabin settings:', error);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Brug default settings hvis ikke hentet
  const s = settings || DEFAULT_SETTINGS;

  // Kun vis for hytte-gæster
  if (guest.bookingType !== 'cabin') {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={language === 'da' ? 'Din hytte' : 'Your cabin'}
          subtitle={language === 'da' ? 'Information om din hytte' : 'Cabin information'}
          image={HEADER_IMAGE}
        />
        <div className="max-w-2xl mx-auto p-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Home className="h-12 w-12 text-amber-500 mb-4" />
              <p className="text-gray-600">
                {language === 'da' ? 'Denne side er kun for hytte-gæster' :
                 language === 'de' ? 'Diese Seite ist nur für Hüttengäste' :
                 language === 'nl' ? 'Deze pagina is alleen voor hutgasten' :
                 'This page is only for cabin guests'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const getText = (item: ChecklistItem) => {
    if (language === 'de') return item.text_de;
    if (language === 'nl') return item.text_en; // NL falder tilbage til EN
    if (language === 'en') return item.text_en;
    return item.text_da;
  };

  const getInfoTitle = (section: InfoSection) => {
    if (language === 'de') return section.title_de;
    if (language === 'nl') return section.title_en; // NL falder tilbage til EN
    if (language === 'en') return section.title_en;
    return section.title_da;
  };

  const getInfoText = (section: InfoSection) => {
    if (language === 'de') return section.text_de;
    if (language === 'nl') return section.text_en; // NL falder tilbage til EN
    if (language === 'en') return section.text_en;
    return section.text_da;
  };

  const getInventoryName = (item: InventoryItem) => {
    if (language === 'de') return item.name_de;
    if (language === 'nl') return item.name_en; // NL falder tilbage til EN
    if (language === 'en') return item.name_en;
    return item.name_da;
  };

  // Beregn antal baseret på hyttestørrelse
  const getInventoryQuantity = (item: InventoryItem) => {
    const cabinNumber = guest.spotNumber || '';
    const is6Person = s.cabin_6_persons?.includes(cabinNumber);
    return is6Person ? item.quantity_6 : item.quantity_4;
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'kitchen': return UtensilsCrossed;
      case 'bedroom': return Bed;
      case 'bathroom': return Bath;
      case 'cleaning': return Sparkles;
      default: return Home;
    }
  };

  const toggleTask = (taskId: string) => {
    setChecklist(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Kombiner departure og cleaning items til total tjekliste
  const allTasks = [...s.departure_items, ...s.cleaning_items];
  const completedTasks = Object.values(checklist).filter(Boolean).length;
  const allDone = completedTasks === allTasks.length;

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={language === 'da' ? 'Din hytte' : language === 'de' ? 'Ihre Hütte' : language === 'nl' ? 'Uw hut' : 'Your cabin'}
        subtitle={language === 'da' ? 'Tjeklister ved ankomst og afrejse' : language === 'de' ? 'Checklisten für Ankunft und Abreise' : language === 'nl' ? 'Checklists voor aankomst en vertrek' : 'Checklists for arrival and departure'}
        image={HEADER_IMAGE}
      />
      
      <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* INFO SEKTIONER */}
      {s.info_sections && s.info_sections.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">
              {language === 'da' ? 'Hvad er i hytten' : language === 'de' ? 'Was ist in der Hütte' : language === 'nl' ? 'Wat zit er in de hut' : "What's in the cabin"}
            </h2>
            {/* Inventar knap */}
            {s.inventory && s.inventory.length > 0 && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    {language === 'da' ? 'Se inventarliste' : language === 'de' ? 'Inventarliste' : language === 'nl' ? 'Inventarislijst' : 'Inventory list'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {language === 'da' ? 'Inventarliste' : language === 'de' ? 'Inventarliste' : 'Inventory list'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-1 mt-4">
                    {s.inventory.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 py-1 border-b border-gray-100">
                        <span className="font-medium text-teal-700 w-8">{getInventoryQuantity(item)}×</span>
                        <span>{getInventoryName(item)}</span>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="space-y-3">
            {s.info_sections
              .filter((section) => {
                // Vis sektionen hvis den er for alle hytter
                if (section.cabin_numbers === 'all') return true;
                // Eller hvis gæstens hyttenummer er i listen
                const cabinNumber = guest.spotNumber || '';
                return Array.isArray(section.cabin_numbers) && section.cabin_numbers.includes(cabinNumber);
              })
              .map((section) => {
                const IconComponent = getIcon(section.icon);
                return (
                  <Card key={section.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                          <IconComponent className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="font-medium">{getInfoTitle(section)}</p>
                          <p className="text-sm text-muted-foreground">{getInfoText(section)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </section>
      )}

      {/* VED ANKOMST */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <DoorOpen className="h-5 w-5 text-green-600" />
          <h2 className="font-semibold text-lg text-green-800">
            {language === 'da' ? 'Ved ankomst' : language === 'de' ? 'Bei Ankunft' : language === 'nl' ? 'Bij aankomst' : 'Upon arrival'}
          </h2>
        </div>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 space-y-3">
            {s.arrival_items.map((item, i) => (
              <div key={item.id} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-1 shrink-0" />
                <p className="text-sm text-green-800">{getText(item)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* VED AFREJSE - ALTID */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <DoorClosed className="h-5 w-5 text-amber-600" />
          <h2 className="font-semibold text-lg text-amber-800">
            {language === 'da' ? 'Ved afrejse - SKAL udføres' : language === 'de' ? 'Bei Abreise - MUSS erledigt werden' : language === 'nl' ? 'Bij vertrek - MOET worden gedaan' : 'Before departure - MUST be done'}
          </h2>
        </div>
        <p className="text-sm text-amber-700">
          {language === 'da' ? 'Såfremt det ikke er udført, opkræves nedenstående gebyrer' : 
           language === 'de' ? 'Bei Nichterfüllung werden folgende Gebühren erhoben' :
           language === 'nl' ? 'Als dit niet is gedaan, worden de volgende kosten in rekening gebracht' :
           'If not completed, the following fees will be charged'}
        </p>
        <Card className="border-amber-200">
          <CardContent className="p-0 divide-y divide-amber-100">
            {s.departure_items.map((item) => (
              <label 
                key={item.id}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-amber-50 transition-colors"
              >
                <Checkbox 
                  checked={checklist[`dep_${item.id}`] || false}
                  onCheckedChange={() => toggleTask(`dep_${item.id}`)}
                />
                <span className={`flex-1 ${checklist[`dep_${item.id}`] ? 'line-through text-muted-foreground' : ''}`}>
                  {getText(item)}
                </span>
                {item.fee && (
                  <span className="text-amber-600 font-medium text-sm">{item.fee},-</span>
                )}
              </label>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* SLUTRENGØRING */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-red-600" />
          <h2 className="font-semibold text-lg text-red-800">
            {language === 'da' ? 'Slutrengøring' : language === 'de' ? 'Endreinigung' : language === 'nl' ? 'Eindschoonmaak' : 'Final cleaning'}
          </h2>
        </div>
        <Card className="border-teal-200 bg-teal-50 mb-3">
          <CardContent className="p-4">
            <p className="text-sm text-teal-800">
              {language === 'da' ? `Slutrengøring kan tilkøbes for ${s.cleaning_price},-` : 
               language === 'de' ? `Endreinigung kann für ${s.cleaning_price},- DKK zugebucht werden` :
               language === 'nl' ? `Eindschoonmaak kan worden bijgekocht voor ${s.cleaning_price},-` :
               `Final cleaning can be purchased for ${s.cleaning_price},-`}
            </p>
          </CardContent>
        </Card>
        <p className="text-sm text-red-700">
          {language === 'da' ? 'Er der IKKE tilkøbt slutrengøring, skal følgende også udføres:' : 
           language === 'de' ? 'Wenn KEINE Endreinigung gebucht wurde, muss auch Folgendes erledigt werden:' :
           language === 'nl' ? 'Als eindschoonmaak NIET is bijgekocht, moet ook het volgende worden gedaan:' :
           'If final cleaning is NOT purchased, the following must also be done:'}
        </p>
        <Card className="border-red-200">
          <CardContent className="p-0 divide-y divide-red-100">
            {s.cleaning_items.map((item) => (
              <label 
                key={item.id}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-red-50 transition-colors"
              >
                <Checkbox 
                  checked={checklist[`clean_${item.id}`] || false}
                  onCheckedChange={() => toggleTask(`clean_${item.id}`)}
                />
                <span className={`flex-1 ${checklist[`clean_${item.id}`] ? 'line-through text-muted-foreground' : ''}`}>
                  {getText(item)}
                </span>
                {item.fee && (
                  <span className="text-red-600 font-medium text-sm">{item.fee},-</span>
                )}
              </label>
            ))}
          </CardContent>
        </Card>

        {allDone && (
          <div className="flex items-center gap-2 text-green-600 bg-green-500/10 p-3 rounded-lg">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">
              {language === 'da' ? 'Alt er klar! God tur hjem!' :
               language === 'de' ? 'Alles erledigt! Gute Heimreise!' :
               language === 'nl' ? 'Alles klaar! Goede reis naar huis!' :
               'All done! Safe travels!'}
            </span>
          </div>
        )}
      </section>

      {/* Problems */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">
                {language === 'da' ? 'Problemer med hytten?' :
                 language === 'de' ? 'Probleme mit der Hütte?' :
                 language === 'nl' ? 'Problemen met de hut?' :
                 'Problems with the cabin?'}
              </p>
              <p className="text-sm text-amber-700 mb-3">
                {language === 'da' ? 'Kontakt receptionen med det samme' :
                 language === 'de' ? 'Kontaktieren Sie sofort die Rezeption' :
                 language === 'nl' ? 'Neem direct contact op met de receptie' :
                 'Contact reception immediately'}
              </p>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={`tel:${s.phone.replace(/\s/g, '')}`}>
                  <Phone className="h-4 w-4" />
                  {s.phone}
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default GuestCabin;
