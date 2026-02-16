import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'No reCAPTCHA token provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const secretKey = Deno.env.get('RECAPTCHA_SECRET_KEY');

    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'reCAPTCHA not configured on server' }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }).toString(),
    });

    const verifyData = await verifyResponse.json();

    if (verifyData.success) {
      return new Response(
        JSON.stringify({
          success: true,
          score: verifyData.score,
          action: verifyData.action,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    } else {
      console.error('reCAPTCHA verification failed:', verifyData);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'reCAPTCHA verification failed',
          'error-codes': verifyData['error-codes'],
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An error occurred during reCAPTCHA verification'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
