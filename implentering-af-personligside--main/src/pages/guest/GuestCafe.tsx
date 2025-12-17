import { useState, useEffect } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Clock, UtensilsCrossed, Wine, Phone, Mail, ShoppingBag, PartyPopper, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';

const HEADER_IMAGE = 'https://images.unsplash.com/photo-1554118811-1e0d58224f54?w=1200&q=80';

interface OpeningHours {
  [key: string]: { open: string; close: string; closed: boolean };
}

interface MenuItem {
  id: string;
  category: 'food' | 'drinks';
  name: string;
  name_en?: string;
  name_de?: string;
  description?: string;
  description_en?: string;
  description_de?: string;
  price: number;
  image_url?: string;
  is_active: boolean;
}

interface Offer {
  id: string;
  name: string;
  name_en?: string;
  name_de?: string;
  description?: string;
  description_en?: string;
  description_de?: string;
  price: number;
  image_url?: string;
  visible_from?: string;
  visible_to?: string;
  execution_date?: string;
  order_deadline?: string;
  cancel_deadline?: string;
  eat_in_capacity_per_slot?: number;
  takeaway_capacity_per_slot?: number;
  total_max_orders?: number;
  timeslots?: string[];
  is_active: boolean;
}

interface PartyBox {
  id: number;
  title_da: string;
  title_en: string;
  title_de: string;
  text_da: string;
  text_en: string;
  text_de: string;
  image_url: string;
  active: boolean;
}

interface CafeSettings {
  opening_hours: OpeningHours;
  header_image?: string;
  reopening_date?: string;
  contact_phone?: string;
  contact_email?: string;
  contact_text?: string;
  contact_text_en?: string;
  contact_text_de?: string;
  party_boxes?: PartyBox[];
}

// Rækkefølge for dage (starter med mandag)
const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface CafeOrder {
  id: string;
  order_number: string;
  booking_id?: number;
  guest_name: string;
  guest_phone?: string;
  offer_id?: string;
  offer_name?: string;
  quantity: number;
  dining_option?: string;
  execution_date?: string;
  timeslot?: string;
  total: number;
  status: string;
  created_at: string;
}

const dayNames: Record<string, Record<string, string>> = {
  'mon': { da: 'Mandag', en: 'Monday', de: 'Montag', nl: 'Maandag' },
  'tue': { da: 'Tirsdag', en: 'Tuesday', de: 'Dienstag', nl: 'Dinsdag' },
  'wed': { da: 'Onsdag', en: 'Wednesday', de: 'Mittwoch', nl: 'Woensdag' },
  'thu': { da: 'Torsdag', en: 'Thursday', de: 'Donnerstag', nl: 'Donderdag' },
  'fri': { da: 'Fredag', en: 'Friday', de: 'Freitag', nl: 'Vrijdag' },
  'sat': { da: 'Lørdag', en: 'Saturday', de: 'Samstag', nl: 'Zaterdag' },
  'sun': { da: 'Søndag', en: 'Sunday', de: 'Sonntag', nl: 'Zondag' },
};

const GuestCafe = () => {
  const { guest, language } = useGuest();
  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOrders, setMyOrders] = useState<CafeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [diningOption, setDiningOption] = useState<'eat_in' | 'takeaway'>('eat_in');
  const [selectedTimeslot, setSelectedTimeslot] = useState<string>('');
  const [allOrdersForOffer, setAllOrdersForOffer] = useState<CafeOrder[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Hent settings fra Supabase
      const { data: settingsData } = await supabase
        .from('cafe_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      
      if (settingsData) setSettings(settingsData);

      // Hent menu items
      const { data: menuData } = await supabase
        .from('cafe_menu_items')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('sort_order');
      
      if (menuData) setMenuItems(menuData);

      // Hent aktive tilbud
      const { data: offersData } = await supabase
        .from('cafe_offers')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (offersData) setOffers(offersData);

      // Hent ordrer for denne booking
      console.log('🔍 Henter café ordrer for booking_id:', guest.bookingId, typeof guest.bookingId);
      const { data: ordersData, error: ordersError } = await supabase
        .from('cafe_orders')
        .select('*')
        .eq('booking_id', guest.bookingId)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });
      
      console.log('📦 Ordrer hentet:', ordersData, 'Error:', ordersError);
      
      if (ordersData) {
        const now = new Date();
        const activeOrders = ordersData.filter((o: CafeOrder) => {
          if (o.execution_date) {
            const execDate = new Date(o.execution_date);
            if (execDate < now) return false;
          }
          return true;
        });
        setMyOrders(activeOrders);
      }
    } catch (error) {
      console.error('Error fetching café data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getText = (da: string, en: string, de: string, nl?: string) => {
    if (language === 'de') return de;
    if (language === 'nl') return nl || en;
    return language === 'da' ? da : en;
  };
  
  const getMenuText = (item: MenuItem) => {
    if (language === 'de' && item.name_de) return item.name_de;
    if (language === 'nl' && item.name_nl) return item.name_nl;
    if (language === 'en' && item.name_en) return item.name_en;
    return item.name;
  };
  
  const getOfferText = (offer: Offer) => {
    if (language === 'de' && offer.name_de) return offer.name_de;
    if (language === 'nl' && offer.name_nl) return offer.name_nl;
    if (language === 'en' && offer.name_en) return offer.name_en;
    return offer.name;
  };
  
  const getOfferDesc = (offer: Offer) => {
    if (language === 'de' && offer.description_de) return offer.description_de;
    if (language === 'nl' && offer.description_nl) return offer.description_nl;
    if (language === 'en' && offer.description_en) return offer.description_en;
    return offer.description || '';
  };

  const getTodayStatus = () => {
    if (!settings?.opening_hours) return null;
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = days[new Date().getDay()];
    const hours = settings.opening_hours[today];
    
    // Hvis lukket i dag eller ingen åbningstider sat
    if (!hours || hours.closed) {
      // Find next open day
      for (let i = 1; i <= 7; i++) {
        const nextDay = days[(new Date().getDay() + i) % 7];
        const nextHours = settings.opening_hours[nextDay];
        if (nextHours && !nextHours.closed) {
          return {
            closed: true,
            nextOpen: `${dayNames[nextDay]?.[language as 'da' | 'en' | 'de' | 'nl'] || dayNames[nextDay]?.da} kl. ${nextHours.open}`
          };
        }
      }
      // Alle dage lukket (vintersæson) - vis genåbningsdato hvis sat
      if (settings.reopening_date) {
        const reopenDate = new Date(settings.reopening_date);
        const formattedDate = reopenDate.toLocaleDateString(
          language === 'de' ? 'de-DE' : language === 'en' ? 'en-GB' : language === 'nl' ? 'nl-NL' : 'da-DK',
          { day: 'numeric', month: 'long', year: 'numeric' }
        );
        return {
          closed: true,
          nextOpen: formattedDate
        };
      }
      return {
        closed: true,
        nextOpen: getText('Se åbningstider nedenfor', 'See opening hours below', 'Siehe Öffnungszeiten unten', 'Zie openingstijden hieronder')
      };
    }
    
    return { closed: false, open: hours.open, close: hours.close };
  };

  const handleOrder = async () => {
    if (!selectedOffer || !selectedTimeslot) return;
    setSubmitting(true);
    try {
      const orderNumber = `C${Date.now().toString().slice(-8)}`;
      
      // Map bookingType til guest_type
      const guestTypeMap: Record<string, string> = {
        'camping': 'kørende',
        'cabin': 'hytte',
        'seasonal': 'sæson'
      };
      const guestType = guestTypeMap[guest.bookingType] || 'kørende';
      
      const { error } = await supabase
        .from('cafe_orders')
        .insert({
          order_number: orderNumber,
          booking_id: guest.bookingId,
          guest_name: `${guest.firstName} ${guest.lastName}`,
          guest_phone: guest.phone || null,
          offer_id: selectedOffer.id,
          offer_name: getOfferText(selectedOffer),
          quantity,
          dining_option: diningOption,
          timeslot: selectedTimeslot,
          execution_date: selectedOffer.execution_date || (selectedOffer.visible_to ? new Date(selectedOffer.visible_to).toISOString().split('T')[0] : null),
          total: selectedOffer.price * quantity,
          status: 'confirmed',
          guest_type: guestType
        });
      
      if (error) throw error;
      
      toast.success(getText('Bestilling oprettet!', 'Order placed!', 'Bestellung aufgegeben!', 'Bestelling geplaatst!'));
      setOrderDialogOpen(false);
      setSelectedOffer(null);
      setQuantity(1);
      setSelectedTimeslot('');
      fetchData();
    } catch (err) {
      console.error('Order error:', err);
      toast.error('Fejl ved bestilling');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (order: CafeOrder) => {
    if (!confirm(getText('Vil du annullere denne bestilling?', 'Cancel this order?', 'Diese Bestellung stornieren?', 'Wil je deze bestelling annuleren?'))) return;
    try {
      const { error } = await supabase
        .from('cafe_orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);
      
      if (error) throw error;
      
      toast.success(getText('Bestilling annulleret', 'Order cancelled', 'Bestellung storniert', 'Bestelling geannuleerd'));
      setMyOrders(prev => prev.filter(o => o.id !== order.id));
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error('Fejl ved afbestilling');
    }
  };

  const canCancelOrder = (order: CafeOrder) => {
    // Kun hvis status er pending eller confirmed
    if (order.status !== 'pending' && order.status !== 'confirmed') return false;
    
    // Find tilhørende tilbud for at tjekke cancel_deadline
    const offer = offers.find(o => o.id === order.offer_id);
    if (offer?.cancel_deadline) {
      const deadline = new Date(offer.cancel_deadline);
      if (new Date() > deadline) return false;
    }
    return true;
  };

  const getAvailableTimeslots = (offer: Offer) => {
    const defaultSlots = ['17:00', '17:15', '17:30', '17:45', '18:00', '18:15', '18:30', '18:45', '19:00', '19:15'];
    const slots = offer.timeslots || defaultSlots;
    const eatInCap = offer.eat_in_capacity_per_slot || 12;
    const takeawayCap = offer.takeaway_capacity_per_slot || 20;
    
    return slots.filter(slot => {
      const ordersForSlot = allOrdersForOffer.filter(o => o.timeslot === slot && o.status !== 'cancelled');
      const eatInCount = ordersForSlot.filter(o => o.dining_option === 'eat_in').reduce((sum, o) => sum + o.quantity, 0);
      const takeawayCount = ordersForSlot.filter(o => o.dining_option === 'takeaway').reduce((sum, o) => sum + o.quantity, 0);
      
      if (diningOption === 'eat_in') {
        return eatInCount + quantity <= eatInCap;
      } else {
        return takeawayCount + quantity <= takeawayCap;
      }
    });
  };

  const isOfferSoldOut = (offer: Offer) => {
    if (!offer.total_max_orders) return false;
    const totalOrders = allOrdersForOffer.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.quantity, 0);
    return totalOrders >= offer.total_max_orders;
  };

  const fetchOrdersForOffer = async (offerId: string) => {
    const { data } = await supabase
      .from('cafe_orders')
      .select('*')
      .eq('offer_id', offerId)
      .neq('status', 'cancelled');
    if (data) setAllOrdersForOffer(data);
  };

  const todayStatus = getTodayStatus();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={getText('Café', 'Café', 'Café', 'Café')}
        subtitle={getText('Mad, drikke og hygge', 'Food, drinks and comfort', 'Essen, Trinken und Gemütlichkeit', 'Eten, drinken en comfort')}
        image={settings?.header_image || HEADER_IMAGE}
      />
      
      {/* Status bar */}
      {todayStatus && (
        <div className={`py-3 px-6 text-white ${todayStatus.closed ? 'bg-red-600' : 'bg-teal-700'}`}>
          <div className="max-w-2xl mx-auto flex items-center justify-center gap-2">
            <Clock className="h-5 w-5" />
            {todayStatus.closed ? (
              <span>{getText('Lukket', 'Closed', 'Geschlossen', 'Gesloten')} - {getText('Åbner', 'Opens', 'Öffnet', 'Opent')} {todayStatus.nextOpen}</span>
            ) : (
              <span>{getText('Åbent i dag', 'Open today', 'Heute geöffnet', 'Vandaag geopend')}: {todayStatus.open} - {todayStatus.close}</span>
            )}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        
        {/* Mine bestillinger */}
        {myOrders.length > 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-amber-600" />
                {getText('Mine bestillinger', 'My orders', 'Meine Bestellungen', 'Mijn bestellingen')}
                <span className="text-sm font-normal text-gray-500">
                  ({guest.firstName} #{guest.bookingId})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-200">
                  <div>
                    <p className="font-medium">{order.quantity}× {order.offer_name}</p>
                    <p className="text-sm text-gray-500">
                      {order.execution_date} {order.timeslot && `kl. ${order.timeslot}`} • {order.dining_option === 'eat_in' ? '🍽️' : '📦'} • {order.total} kr
                    </p>
                    <p className="text-xs text-green-600 font-medium mt-1">
                      ✓ {getText('Bekræftet', 'Confirmed', 'Bestätigt', 'Bevestigd')}
                    </p>
                  </div>
                  {canCancelOrder(order) && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => handleCancelOrder(order)}
                    >
                      {getText('Afbestil', 'Cancel', 'Stornieren', 'Annuleren')}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Aktive tilbud */}
        {offers.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-500" />
              {getText('Aktive tilbud', 'Special offers', 'Sonderangebote', 'Speciale aanbiedingen')}
            </h2>
            <div className="space-y-3">
              {offers.map(offer => (
                <Card key={offer.id} className="border-rose-200 overflow-hidden">
                  <div className="flex">
                    {offer.image_url && (
                      <img src={offer.image_url} alt="" className="w-24 h-24 object-cover" />
                    )}
                    <CardContent className="p-4 flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{getOfferText(offer)}</h3>
                          <p className="text-sm text-gray-600">{getOfferDesc(offer)}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {getText('Deadline', 'Deadline', 'Frist', 'Deadline')}: {offer.visible_to ? new Date(offer.visible_to).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg text-rose-600">{offer.price} kr</p>
                          {(() => {
                            // Tjek om deadline er efter gæstens udtjekning
                            const offerDeadline = offer.visible_to ? new Date(offer.visible_to) : null;
                            const guestDeparture = guest.departureDate ? new Date(guest.departureDate) : null;
                            const deadlineAfterCheckout = offerDeadline && guestDeparture && offerDeadline > guestDeparture;
                            
                            if (deadlineAfterCheckout) {
                              return (
                                <div className="mt-2 text-left">
                                  <Button size="sm" disabled className="opacity-50 cursor-not-allowed">
                                    <Lock className="h-3 w-3 mr-1" />
                                    {getText('Bestil', 'Order', 'Bestellen', 'Bestel')}
                                  </Button>
                                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                                    <p className="font-medium">
                                      {getText(
                                        'Din planlagte udtjekning ligger før du kan afhente tilbuddet.',
                                        'Your planned checkout is before you can pick up the offer.',
                                        'Ihr geplanter Checkout liegt vor dem Abholtermin.',
                                        'Uw geplande uitchecktijd ligt voor de tijd dat u het aanbod kunt ophalen.'
                                      )}
                                    </p>
                                    <p className="mt-1">
                                      {getText(
                                        'Kontakt caféen for en manuel bestilling, eller kontakt receptionen for en forlængelse af din booking.',
                                        'Contact the café for a manual order, or contact reception to extend your booking.',
                                        'Kontaktieren Sie das Café für eine manuelle Bestellung, oder die Rezeption für eine Buchungsverlängerung.',
                                        'Neem contact op met het café voor een handmatige bestelling of neem contact op met de receptie voor een verlenging van uw boeking.'
                                      )}
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            
                            if (!guest.checkedIn) {
                              return (
                                <div className="mt-2">
                                  <Button size="sm" disabled className="opacity-50 cursor-not-allowed">
                                    <Lock className="h-3 w-3 mr-1" />
                                    {getText('Bestil', 'Order', 'Bestellen', 'Bestel')}
                                  </Button>
                                  <p className="text-xs text-amber-600 mt-1">
                                    {getText('Tilgængelig efter check-in', 'Available after check-in', 'Nach Check-in verfügbar', 'Beschikbaar na inchecken')}
                                  </p>
                                </div>
                              );
                            }
                            
                            return (
                            <Dialog open={orderDialogOpen && selectedOffer?.id === offer.id} onOpenChange={(open) => {
                              setOrderDialogOpen(open);
                              if (open) {
                                setSelectedOffer(offer);
                                setSelectedTimeslot('');
                                fetchOrdersForOffer(offer.id);
                              }
                            }}>
                              <DialogTrigger asChild>
                                <Button size="sm" className="mt-2" disabled={myOrders.length > 0}>
                                  {myOrders.length > 0 
                                    ? getText('Du har allerede en bestilling', 'You already have an order', 'Sie haben bereits eine Bestellung', 'U heeft al een bestelling')
                                    : getText('Bestil', 'Order', 'Bestellen', 'Bestel')}
                                </Button>
                              </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{getText('Bestil tilbud', 'Order offer', 'Angebot bestellen', 'Bestel aanbod')}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <p className="font-medium">{getOfferText(offer)}</p>
                                <p className="text-sm text-gray-500">{offer.price} kr {getText('pr. stk', 'each', 'pro Stück', 'per stuk')}</p>
                                
                                <div>
                                  <Label>{getText('Antal', 'Quantity', 'Anzahl', 'Aantal')}</Label>
                                  <Input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
                                </div>

                                <div>
                                  <Label>{getText('Hvordan vil du have det?', 'How would you like it?', 'Wie möchten Sie es?', 'Hoe wilt u het hebben?')}</Label>
                                  <RadioGroup value={diningOption} onValueChange={(v) => setDiningOption(v as 'eat_in' | 'takeaway')} className="mt-2">
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="eat_in" id="eat_in" />
                                      <Label htmlFor="eat_in">🍽️ {getText('Spise i café', 'Eat in café', 'Im Café essen', 'Eten in het café')}</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <RadioGroupItem value="takeaway" id="takeaway" />
                                      <Label htmlFor="takeaway">📦 {getText('Tag med hjem', 'Takeaway', 'Zum Mitnehmen', 'Meenemen')}</Label>
                                    </div>
                                  </RadioGroup>
                                </div>

                                <div>
                                  <Label>{getText('Vælg tidspunkt', 'Select time', 'Zeit wählen', 'Kies een tijd')}</Label>
                                  <select 
                                    value={selectedTimeslot} 
                                    onChange={e => setSelectedTimeslot(e.target.value)}
                                    className="w-full mt-1 p-2 border rounded-md"
                                  >
                                    <option value="">{getText('Vælg tidspunkt...', 'Select time...', 'Zeit wählen...', 'Kies een tijd...')}</option>
                                    {getAvailableTimeslots(offer).map(slot => (
                                      <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                  </select>
                                  {getAvailableTimeslots(offer).length === 0 && (
                                    <p className="text-sm text-red-500 mt-1">
                                      {getText('Ingen ledige tidspunkter', 'No available times', 'Keine verfügbaren Zeiten', 'Geen beschikbare tijden')}
                                    </p>
                                  )}
                                </div>

                                <div className="p-3 bg-gray-100 rounded-lg">
                                  <p className="font-bold text-lg">Total: {offer.price * quantity} kr</p>
                                </div>

                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <p className="text-sm text-amber-800">
                                    ⚠️ {getText(
                                      `Husk: En bestilling er bindende med det samme. Du kan annullere indtil ${offer.cancel_deadline ? new Date(offer.cancel_deadline).toLocaleString('da-DK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'deadline'}.`,
                                      `Note: Your order is binding immediately. You can cancel until ${offer.cancel_deadline ? new Date(offer.cancel_deadline).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'deadline'}.`,
                                      `Hinweis: Ihre Bestellung ist sofort verbindlich. Sie können bis ${offer.cancel_deadline ? new Date(offer.cancel_deadline).toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Frist'} stornieren.`,
                                      `Opmerking: Uw bestelling is direct bindend. U kunt annuleren tot ${offer.cancel_deadline ? new Date(offer.cancel_deadline).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'deadline'}.`
                                    )}
                                  </p>
                                </div>

                                <Button onClick={handleOrder} disabled={submitting || !selectedTimeslot} className="w-full">
                                  {submitting ? 'Bestiller...' : getText('Bekræft bestilling', 'Confirm order', 'Bestellung bestätigen', 'Bevestig bestelling')}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Åbningstider */}
        {settings?.opening_hours && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-600" />
                {getText('Åbningstider', 'Opening hours', 'Öffnungszeiten', 'Openingstijden')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {dayOrder.map(day => {
                const hours = settings.opening_hours[day];
                if (!hours) return null;
                return (
                  <div key={day} className="flex justify-between text-sm">
                    <span className="text-gray-500">{dayNames[day]?.[language as 'da' | 'en' | 'de' | 'nl'] || dayNames[day]?.da}</span>
                    <span className={hours.closed ? 'text-red-500' : 'font-medium'}>
                      {hours.closed ? getText('Lukket', 'Closed', 'Geschlossen', 'Gesloten') : `${hours.open} - ${hours.close}`}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Menukort */}
        {menuItems.length > 0 && (
          <>
            {/* Mad */}
            {menuItems.filter(m => m.category === 'food').length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-teal-600" />
                  {getText('Mad', 'Food', 'Essen', 'Eten')}
                </h2>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {menuItems.filter(m => m.category === 'food').map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          {item.image_url && <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
                          <span className="font-medium">{getMenuText(item)}</span>
                        </div>
                        <span className="font-semibold text-teal-600">{item.price} kr</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            )}

            {/* Drikkevarer */}
            {menuItems.filter(m => m.category === 'drinks').length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Wine className="h-5 w-5 text-purple-600" />
                  {getText('Drikkevarer', 'Drinks', 'Getränke', 'Dranken')}
                </h2>
                <Card>
                  <CardContent className="p-0 divide-y">
                    {menuItems.filter(m => m.category === 'drinks').map(item => (
                      <div key={item.id} className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          {item.image_url && <img src={item.image_url} alt="" className="w-12 h-12 rounded object-cover" />}
                          <span className="font-medium">{getMenuText(item)}</span>
                        </div>
                        <span className="font-semibold text-purple-600">{item.price} kr</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </section>
            )}
          </>
        )}

        {/* Festmenuer */}
        {settings?.party_boxes?.filter(b => b.active).length > 0 && (
          <section className="space-y-3">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-amber-500" />
              {getText('Festmenuer', 'Party menus', 'Partymenüs', 'Feestmenu\'s')}
            </h2>
            <div className="grid gap-4">
              {settings.party_boxes.filter(b => b.active).map(box => (
                <Card key={box.id} className="overflow-hidden">
                  {box.image_url && (
                    <img src={box.image_url} alt="" className="w-full h-32 object-cover" />
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-semibold">{getText(box.title_da, box.title_en, box.title_de)}</h3>
                    <p className="text-sm text-gray-600 mt-1">{getText(box.text_da, box.text_en, box.text_de)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Kontakt */}
        {settings && (
          <Card className="bg-gray-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{getText('Kontakt', 'Contact', 'Kontakt')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {settings.contact_phone && (
                <a href={`tel:${settings.contact_phone}`} className="flex items-center gap-2 text-teal-700">
                  <Phone className="h-4 w-4" /> {settings.contact_phone}
                </a>
              )}
              {settings.contact_email && (
                <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 text-teal-700">
                  <Mail className="h-4 w-4" /> {settings.contact_email}
                </a>
              )}
              <p className="text-sm text-gray-600 mt-2">
                {getText(settings.contact_text, settings.contact_text_en, settings.contact_text_de)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GuestCafe;
