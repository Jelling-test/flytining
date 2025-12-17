import { useState, useEffect } from 'react';
import { useGuest } from '@/contexts/GuestContext';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  Minus, 
  Plus, 
  ShoppingBasket, 
  Lock,
  CheckCircle2,
  CalendarDays,
  Receipt,
  Mail,
  Loader2,
  X,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const HEADER_IMAGE = 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1200&q=80';

// Edge function URL - PRODUKTION
const API_URL = 'https://jkmqliztlhmfyejhmuil.supabase.co/functions/v1/bakery-api';

const apiHeaders = {
  'Content-Type': 'application/json'
};

interface BakerySettings {
  order_open_time: string;
  order_close_time: string;
  pickup_start_time: string;
  pickup_end_time: string;
  is_closed: boolean;
  closed_until: string | null;
  closed_message_da: string;
  closed_message_en: string;
  closed_message_de: string;
  pickup_location_da: string;
  pickup_location_en: string;
  pickup_location_de: string;
}

interface Product {
  id: string;
  name_da: string;
  name_en: string;
  name_de: string;
  name_nl?: string;
  description_da: string;
  description_en: string;
  description_de: string;
  description_nl?: string;
  price: number;
  max_per_order: number;
  image_url: string;
  is_active: boolean;
  sort_order: number;
}

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  order_number: string;
  items: OrderItem[];
  total: number;
  pickup_date: string;
  status: 'pending' | 'cancelled' | 'collected';
  created_at: string;
}

const GuestBakery = () => {
  const { guest, t, language } = useGuest();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Data from database
  const [settings, setSettings] = useState<BakerySettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  
  // Local state
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showConfirmation, setShowConfirmation] = useState<Order | null>(null);

  // ==================== DATA FETCHING ====================

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const settingsRes = await fetch(`${API_URL}?action=get-settings`, { headers: apiHeaders });
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setSettings(settingsData.settings);
      }

      // Fetch products
      const productsRes = await fetch(`${API_URL}?action=get-products`, { headers: apiHeaders });
      const productsData = await productsRes.json();
      if (productsData.success) {
        setProducts(productsData.products);
      }

      // Fetch orders for this booking
      const guestAny = guest as any;
      if (guestAny.bookingId || guestAny.booking_nummer) {
        const bookingId = guestAny.booking_nummer || guestAny.bookingId;
        const ordersRes = await fetch(`${API_URL}?action=get-orders&booking_id=${bookingId}`, { headers: apiHeaders });
        const ordersData = await ordersRes.json();
        if (ordersData.success) {
          setOrders(ordersData.orders);
        }
      }
    } catch (err) {
      console.error('Error fetching bakery data:', err);
      toast.error(language === 'da' ? 'Kunne ikke hente data' : 'Could not fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [(guest as any).bookingId, (guest as any).booking_nummer]);

  // ==================== HELPERS ====================

  const getName = (product: Product) => {
    if (language === 'en') return product.name_en || product.name_da;
    if (language === 'de') return product.name_de || product.name_da;
    if (language === 'nl') return product.name_nl || product.name_en || product.name_da;
    return product.name_da;
  };

  const getDescription = (product: Product) => {
    if (language === 'en') return product.description_en || product.description_da;
    if (language === 'de') return product.description_de || product.description_da;
    if (language === 'nl') return product.description_nl || product.description_en || product.description_da;
    return product.description_da;
  };

  const getClosedMessage = () => {
    if (!settings) return '';
    if (language === 'en') return settings.closed_message_en || settings.closed_message_da;
    if (language === 'de') return settings.closed_message_de || settings.closed_message_da;
    return settings.closed_message_da;
  };

  const getPickupLocation = () => {
    if (!settings) return 'Receptionen';
    if (language === 'en') return settings.pickup_location_en || settings.pickup_location_da;
    if (language === 'de') return settings.pickup_location_de || settings.pickup_location_da;
    return settings.pickup_location_da;
  };

  // Tomorrow date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  
  const tomorrowFormatted = tomorrow.toLocaleDateString(
    language === 'de' ? 'de-DE' : language === 'en' ? 'en-GB' : 'da-DK', 
    { weekday: 'long', day: 'numeric', month: 'long' }
  );

  // Check ordering time
  const currentTime = new Date().toTimeString().slice(0, 5);
  const orderOpenTime = settings?.order_open_time || '10:00';
  const orderCloseTime = settings?.order_close_time || '22:00';
  const isBeforeOpen = currentTime < orderOpenTime;
  const isAfterClose = currentTime >= orderCloseTime;
  const isOrderingClosed = isBeforeOpen || isAfterClose || settings?.is_closed;

  // Check existing order for tomorrow
  const existingOrderForTomorrow = orders.find(o => 
    o.pickup_date === tomorrowDate && o.status !== 'cancelled'
  );

  // ==================== CART FUNCTIONS ====================

  const updateCart = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(prev => {
      const currentQty = prev[productId] || 0;
      const newQty = Math.max(0, Math.min(product.max_per_order, currentQty + delta));
      
      if (newQty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: newQty };
    });
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const totalPrice = products.reduce((sum, product) => {
    return sum + (cart[product.id] || 0) * product.price;
  }, 0);

  // ==================== ORDER FUNCTIONS ====================

  const handlePlaceOrder = async () => {
    if (totalItems === 0) return;
    
    if (existingOrderForTomorrow) {
      toast.error(language === 'da' 
        ? 'Du har allerede en bestilling til i morgen' 
        : 'You already have an order for tomorrow');
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = products
        .filter(p => cart[p.id] > 0)
        .map(p => ({
          product_id: p.id,
          name: getName(p),
          quantity: cart[p.id],
          price: p.price
        }));

      const response = await fetch(`${API_URL}?action=create-order`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          booking_id: (guest as any).bookingId,
          booking_nummer: (guest as any).booking_nummer || (guest as any).bookingId,
          guest_name: `${guest.firstName} ${guest.lastName}`,
          guest_email: guest.email,
          guest_phone: (guest as any).phone || '',
          pickup_date: tomorrowDate,
          items: orderItems,
          total: totalPrice
        })
      });

      const data = await response.json();

      if (data.success) {
        setCart({});
        setOrders(prev => [data.order, ...prev]);
        setShowConfirmation(data.order);
        toast.success(language === 'da' ? 'Bestilling modtaget!' : 'Order received!');
      } else {
        toast.error(data.error || (language === 'da' ? 'Kunne ikke oprette bestilling' : 'Could not create order'));
      }
    } catch (err) {
      console.error('Order error:', err);
      toast.error(language === 'da' ? 'Der opstod en fejl' : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(language === 'da' ? 'Er du sikker på at du vil annullere?' : 'Are you sure you want to cancel?')) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}?action=cancel-order`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          order_id: orderId,
          booking_nummer: (guest as any).booking_nummer || (guest as any).bookingId
        })
      });

      const data = await response.json();

      if (data.success) {
        setOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, status: 'cancelled' as const } : o
        ));
        toast.success(language === 'da' ? 'Bestilling annulleret' : 'Order cancelled');
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error(language === 'da' ? 'Kunne ikke annullere' : 'Could not cancel');
    }
  };

  // ==================== RENDER ====================

  // Loading
  if (loading) {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={t('orderBread')}
          subtitle={language === 'da' ? 'Friske morgenbrød hver dag' : 'Fresh bread every morning'}
          image={HEADER_IMAGE}
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      </div>
    );
  }

  // Not checked in
  if (!guest.checkedIn) {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={t('orderBread')}
          subtitle={language === 'da' ? 'Friske morgenbrød hver dag' : 'Fresh bread every morning'}
          image={HEADER_IMAGE}
        />
        <div className="max-w-2xl mx-auto p-6">
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Lock className="h-12 w-12 text-amber-500 mb-4" />
              <p className="text-gray-800 font-medium mb-2">
                {language === 'da' ? 'Bageri ikke tilgængeligt' : language === 'de' ? 'Bäckerei nicht verfügbar' : language === 'nl' ? 'Bakkerij niet beschikbaar' : 'Bakery not available'}
              </p>
              <p className="text-sm text-gray-600">
                {language === 'da' ? 'Bestilling er tilgængelig efter check-in' : language === 'de' ? 'Bestellung nach Check-in möglich' : language === 'nl' ? 'Bestellen beschikbaar na check-in' : 'Ordering available after check-in'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Bakery closed
  if (settings?.is_closed) {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={t('orderBread')}
          subtitle={language === 'da' ? 'Friske morgenbrød hver dag' : language === 'de' ? 'Frische Morgenbrötchen jeden Tag' : language === 'nl' ? 'Verse ochtendbroodjes elke dag' : 'Fresh bread every morning'}
          image={HEADER_IMAGE}
        />
        <div className="max-w-2xl mx-auto p-6">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-gray-800 font-medium mb-2">{getClosedMessage()}</p>
              {settings.closed_until && (
                <p className="text-sm text-gray-600">
                  {language === 'da' ? 'Åbner igen: ' : language === 'de' ? 'Öffnet wieder: ' : language === 'nl' ? 'Opent weer: ' : 'Opens again: '}
                  {new Date(settings.closed_until).toLocaleDateString(language === 'da' ? 'da-DK' : language === 'de' ? 'de-DE' : language === 'nl' ? 'nl-NL' : 'en-GB')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show confirmation
  if (showConfirmation) {
    return (
      <div className="bg-white min-h-screen">
        <PageHeader 
          title={language === 'da' ? 'Bestilling modtaget!' : language === 'de' ? 'Bestellung erhalten!' : language === 'nl' ? 'Bestelling ontvangen!' : 'Order received!'}
          subtitle={`${language === 'da' ? 'Ordrenummer' : language === 'de' ? 'Bestellnummer' : language === 'nl' ? 'Bestelnummer' : 'Order'}: ${showConfirmation.order_number}`}
          image={HEADER_IMAGE}
        />
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          <div className="text-center">
            <div className="h-16 w-16 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-teal-600" />
            </div>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-500">{language === 'da' ? 'Afhentning' : language === 'de' ? 'Abholung' : language === 'nl' ? 'Afhalen' : 'Pickup'}</span>
                <span className="font-semibold">
                  {settings?.pickup_start_time} - {settings?.pickup_end_time}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-500">{language === 'da' ? 'Sted' : language === 'de' ? 'Ort' : language === 'nl' ? 'Locatie' : 'Location'}</span>
                <span className="font-semibold">{getPickupLocation()}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b">
                <span className="text-gray-500">{language === 'da' ? 'Dato' : language === 'de' ? 'Datum' : language === 'nl' ? 'Datum' : 'Date'}</span>
                <span className="font-semibold capitalize">{tomorrowFormatted}</span>
              </div>
              {showConfirmation.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="font-medium">{item.quantity * item.price} kr</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-3 border-t font-bold text-lg">
                <span>Total</span>
                <span className="text-teal-600">{showConfirmation.total} kr</span>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
            <p className="text-sm text-amber-700 text-center">
              {language === 'da' ? 'Betaling sker ved afhentning' : language === 'de' ? 'Bezahlung erfolgt bei Abholung' : language === 'nl' ? 'Betaling vindt plaats bij afhalen' : 'Pay at pickup'}
            </p>
          </div>

          <Button 
            className="w-full bg-teal-600 hover:bg-teal-700 h-12" 
            onClick={() => setShowConfirmation(null)}
          >
            {language === 'da' ? 'Tilbage til oversigt' : language === 'de' ? 'Zurück zur Übersicht' : language === 'nl' ? 'Terug naar overzicht' : 'Back to overview'}
          </Button>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="bg-white min-h-screen">
      <PageHeader 
        title={t('orderBread')}
        subtitle={language === 'da' ? 'Friske morgenbrød hver dag' : language === 'de' ? 'Frische Morgenbrötchen jeden Tag' : language === 'nl' ? 'Verse ochtendbroodjes elke dag' : 'Fresh bread every morning'}
        image={HEADER_IMAGE}
        guestName={guest.firstName}
        bookingId={guest.bookingId}
      />
      
      {/* Teal info bar */}
      <div className="bg-teal-700 text-white py-3 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            <span className="capitalize">{language === 'da' ? 'Din kurv' : language === 'de' ? 'Ihr Warenkorb' : language === 'nl' ? 'Uw winkelwagen' : 'Your cart'} {tomorrowFormatted}</span>
          </div>
          <span className="text-sm text-white/80">
            {language === 'da' 
              ? `Bestil mellem ${orderOpenTime} og ${orderCloseTime}` 
              : language === 'de' ? `Bestellen zwischen ${orderOpenTime} und ${orderCloseTime}` : language === 'nl' ? `Bestel tussen ${orderOpenTime} en ${orderCloseTime}` : `Order between ${orderOpenTime} and ${orderCloseTime}`}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Order Deadline Warning */}
        {isOrderingClosed && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-red-500" />
            <div>
              <p className="font-medium text-red-700">
                {isBeforeOpen 
                  ? (language === 'da' ? `Bestilling åbner kl. ${orderOpenTime}` : language === 'de' ? `Bestellung öffnet um ${orderOpenTime}` : language === 'nl' ? `Bestellen opent om ${orderOpenTime}` : `Ordering opens at ${orderOpenTime}`)
                  : (language === 'da' ? 'Bestilling lukket' : language === 'de' ? 'Bestellung geschlossen' : language === 'nl' ? 'Bestellen gesloten' : 'Orders closed')}
              </p>
              <p className="text-sm text-red-600">
                {language === 'da' ? 'Åbner igen i morgen' : language === 'de' ? 'Öffnet wieder morgen' : language === 'nl' ? 'Opent weer morgen' : 'Opens again tomorrow'}
              </p>
            </div>
          </div>
        )}

        {/* Existing Order Alert */}
        {existingOrderForTomorrow && (
          <Card className="border-2 border-teal-500 bg-teal-50">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-teal-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-teal-800 mb-2">
                    {language === 'da' ? 'Du har en bestilling til i morgen' : language === 'de' ? 'Sie haben eine Bestellung für morgen' : language === 'nl' ? 'U heeft een bestelling voor morgen' : 'You have an order for tomorrow'}
                  </p>
                  <div className="bg-white rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold">{existingOrderForTomorrow.order_number}</span>
                      <Badge variant="secondary">{language === 'da' ? 'Afventer' : language === 'de' ? 'Wird bearbeitet' : language === 'nl' ? 'Wordt verwerkt' : 'Pending'}</Badge>
                    </div>
                    <div className="text-sm">
                      {existingOrderForTomorrow.items.map((item, i) => (
                        <p key={i}>• {item.quantity}x {item.name} - {item.quantity * item.price} kr</p>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t font-bold">
                      <span>Total</span>
                      <span className="text-teal-600">{existingOrderForTomorrow.total} kr</span>
                    </div>
                    <p className="text-xs text-gray-500 pt-2">
                      {language === 'da' 
                        ? `Afhentning ${settings?.pickup_start_time}-${settings?.pickup_end_time} i ${getPickupLocation()}` 
                        : language === 'de' ? `Abholung ${settings?.pickup_start_time}-${settings?.pickup_end_time} in ${getPickupLocation()}` : language === 'nl' ? `Afhalen ${settings?.pickup_start_time}-${settings?.pickup_end_time} in ${getPickupLocation()}` : `Pickup ${settings?.pickup_start_time}-${settings?.pickup_end_time} at ${getPickupLocation()}`}
                    </p>
                  </div>
                  {/* Cancel button - only if before close time */}
                  {!isAfterClose && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3 text-red-600"
                      onClick={() => handleCancelOrder(existingOrderForTomorrow.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {language === 'da' ? 'Annuller bestilling' : language === 'de' ? 'Bestellung stornieren' : language === 'nl' ? 'Bestelling annuleren' : 'Cancel order'}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products - kun vis hvis ingen eksisterende bestilling */}
        {!existingOrderForTomorrow && (
          <>
            <div className="space-y-3">
              {products.map((product) => (
                <Card key={product.id} className="border-0 shadow overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex">
                      {/* Product image */}
                      {product.image_url && (
                        <div className="w-28 h-28 flex-shrink-0">
                          <img 
                            src={product.image_url} 
                            alt={getName(product)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 p-4 flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-800">{getName(product)}</p>
                          <p className="text-sm text-gray-500">{getDescription(product)}</p>
                          <p className="text-teal-600 font-bold mt-1">{product.price} kr</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => updateCart(product.id, -1)}
                            disabled={!cart[product.id] || isOrderingClosed}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-8 text-center font-bold text-lg">
                            {cart[product.id] || 0}
                          </span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            onClick={() => updateCart(product.id, 1)}
                            disabled={(cart[product.id] || 0) >= product.max_per_order || isOrderingClosed}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    {(cart[product.id] || 0) >= product.max_per_order && (
                      <p className="text-xs text-gray-400 px-4 pb-2">
                        Max {product.max_per_order} {language === 'da' ? 'pr. bestilling' : language === 'de' ? 'pro Bestellung' : language === 'nl' ? 'per bestelling' : 'per order'}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pickup Info */}
            {totalItems > 0 && (
              <Card className="border-0 shadow bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-800">
                        {language === 'da' 
                          ? `Afhentning i morgen ${settings?.pickup_start_time}-${settings?.pickup_end_time}` 
                          : language === 'de' ? `Abholung morgen ${settings?.pickup_start_time}-${settings?.pickup_end_time}` : language === 'nl' ? `Afhalen morgen ${settings?.pickup_start_time}-${settings?.pickup_end_time}` : `Pickup tomorrow ${settings?.pickup_start_time}-${settings?.pickup_end_time}`}
                      </p>
                      <p className="text-sm text-blue-600">{getPickupLocation()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            {totalItems > 0 && (
              <Card className="bg-teal-600 text-white border-0 shadow-lg">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShoppingBasket className="h-5 w-5" />
                      <span>{totalItems} {totalItems === 1 ? (language === 'da' ? 'vare' : language === 'de' ? 'Artikel' : language === 'nl' ? 'artikel' : 'item') : (language === 'da' ? 'varer' : language === 'de' ? 'Artikel' : language === 'nl' ? 'artikelen' : 'items')}</span>
                    </div>
                    <span className="text-2xl font-bold">{totalPrice} kr</span>
                  </div>
                  <Button 
                    className="w-full bg-white text-teal-600 hover:bg-gray-100 h-12 font-semibold"
                    onClick={handlePlaceOrder}
                    disabled={isOrderingClosed || submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : null}
                    {language === 'da' ? 'Bestil - Betal ved afhentning' : 'Order - Pay at pickup'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Previous Orders */}
        {orders.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h2 className="font-semibold flex items-center gap-2 text-gray-800">
              <Receipt className="h-5 w-5 text-teal-600" />
              {language === 'da' ? 'Mine bestillinger' : 'My orders'}
            </h2>
            {orders.map((order) => (
              <Card key={order.id} className={`border-0 shadow ${order.status === 'cancelled' ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono font-bold">{order.order_number}</span>
                      <Badge 
                        variant={order.status === 'cancelled' ? 'destructive' : order.status === 'collected' ? 'default' : 'secondary'} 
                        className="ml-2"
                      >
                        {order.status === 'pending' ? (language === 'da' ? 'Afventer' : 'Pending') :
                         order.status === 'collected' ? (language === 'da' ? 'Afhentet' : 'Collected') :
                         (language === 'da' ? 'Annulleret' : 'Cancelled')}
                      </Badge>
                    </div>
                    <span className="font-semibold text-teal-600">{order.total} kr</span>
                  </div>
                  <div className="text-sm text-gray-500 space-y-1">
                    <p>{language === 'da' ? 'Afhentning' : language === 'de' ? 'Abholung' : language === 'nl' ? 'Afhalen' : 'Pickup'}: {order.pickup_date}</p>
                  </div>
                  <div className="mt-2 text-sm">
                    {order.items.map((item, i) => (
                      <span key={i} className="mr-2">{item.quantity}x {item.name}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestBakery;
