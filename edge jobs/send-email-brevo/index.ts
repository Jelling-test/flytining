import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';

Deno.serve(async (req: Request) => {
  try {
    const { to, subject, html, from_name, from_email, reply_to } = await req.json();

    console.log('Sending email via Brevo:', { to, subject });

    const payload: any = {
      sender: {
        name: from_name || 'Jelling Camping',
        email: from_email || 'noreply@jellingcamping.dk'
      },
      to: [{ email: to }],
      subject: subject,
      htmlContent: html
    };

    if (reply_to) {
      payload.replyTo = { email: reply_to };
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Brevo API error: ${error}`);
    }

    const result = await response.json();
    console.log('Email sent successfully:', result.messageId);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        } 
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Connection': 'keep-alive'
        } 
      }
    );
  }
});
