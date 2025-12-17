import { useGuest } from '@/contexts/GuestContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, Heart, Facebook, Instagram } from 'lucide-react';

const GuestDeparted = () => {
  const { guest, language } = useGuest();

  const getText = (da: string, en: string, de?: string, nl?: string) => {
    if (language === 'de' && de) return de;
    if (language === 'nl' && nl) return nl;
    return language === 'da' ? da : en;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {/* Hero billede */}
      <div className="relative h-[40vh] overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=1200" 
          alt="Camping sunset"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white text-center">
          <h1 className="text-3xl sm:text-4xl font-serif mb-2">
            {getText('Tak for dit ophold', 'Thank you for your stay', 'Danke für Ihren Aufenthalt', 'Bedankt voor uw verblijf')}
          </h1>
          <p className="text-xl text-white/90">
            {guest.firstName}! 💛
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto p-6 space-y-6">
        
        {/* Tak besked */}
        <Card className="border-0 shadow-lg overflow-hidden">
          <CardContent className="p-6 text-center">
            <Heart className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800 mb-3">
              {getText(
                'Vi håber du nød dit besøg hos os',
                'We hope you enjoyed your visit with us',
                'Wir hoffen, Sie haben Ihren Besuch bei uns genossen',
                'We hopen dat u heeft genoten van uw bezoek bij ons'
              )}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {getText(
                'Det var dejligt at have dig som gæst på Jelling Familie Camping. Vi ser frem til at byde dig velkommen igen!',
                'It was lovely having you as a guest at Jelling Family Camping. We look forward to welcoming you again!',
                'Es war schön, Sie als Gast auf dem Jelling Familie Camping zu haben. Wir freuen uns, Sie wieder begrüßen zu dürfen!',
                'Het was heerlijk om u als gast te hebben op Jelling Familie Camping. We kijken ernaar uit u weer te verwelkomen!'
              )}
            </p>
          </CardContent>
        </Card>

        {/* Genbooking CTA */}
        <Card className="border-2 border-teal-500 bg-teal-50">
          <CardContent className="p-6 text-center">
            <h3 className="text-lg font-semibold text-teal-800 mb-2">
              {getText(
                'Har du lyst til at komme tilbage?',
                'Would you like to come back?',
                'Möchten Sie wiederkommen?',
                'Wilt u terugkomen?'
              )}
            </h3>
            <p className="text-sm text-teal-700 mb-4">
              {getText(
                'Husk: Det er altid billigst at booke direkte på vores hjemmeside!',
                'Remember: It\'s always cheapest to book directly on our website!',
                'Denken Sie daran: Es ist immer am günstigsten, direkt auf unserer Website zu buchen!',
                'Onthoud: Het is altijd het goedkoopst om direct op onze website te boeken!'
              )}
            </p>
            <Button 
              size="lg"
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => window.open('https://www.jellingcamping.dk', '_blank')}
            >
              <ExternalLink className="h-5 w-5 mr-2" />
              www.jellingcamping.dk
            </Button>
          </CardContent>
        </Card>

        {/* Social media */}
        <div className="text-center pt-4">
          <p className="text-sm text-gray-500 mb-3">
            {getText('Følg os på sociale medier', 'Follow us on social media', 'Folgen Sie uns in den sozialen Medien', 'Volg ons op sociale media')}
          </p>
          <div className="flex justify-center gap-4">
            <Button 
              variant="outline" 
              size="icon"
              className="rounded-full"
              onClick={() => window.open('https://www.facebook.com/jellingcamping', '_blank')}
            >
              <Facebook className="h-5 w-5 text-blue-600" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              className="rounded-full"
              onClick={() => window.open('https://www.instagram.com/jellingcamping', '_blank')}
            >
              <Instagram className="h-5 w-5 text-pink-600" />
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-400 pt-6">
          <p>Jelling Familie Camping</p>
          <p>Mølvangvej 10 · 7300 Jelling</p>
        </div>
      </div>
    </div>
  );
};

export default GuestDeparted;
