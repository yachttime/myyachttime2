import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AgreementNotificationRequest {
  managerEmails: string[];
  yachtName: string;
  seasonName: string;
  ownerName: string;
  agreementId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      managerEmails,
      yachtName,
      seasonName,
      ownerName,
      agreementId
    }: AgreementNotificationRequest = await req.json();

    console.log('Vessel Management Agreement notification requested:', {
      managerEmails,
      yachtName,
      seasonName,
      ownerName,
      agreementId
    });

    if (!managerEmails || managerEmails.length === 0) {
      throw new Error('No manager emails provided');
    }

    const data = {
      message: `Vessel Management Agreement submitted for ${yachtName} - ${seasonName}`,
      managerCount: managerEmails.length,
      yachtName,
      seasonName,
      ownerName,
      agreementId,
      emailsSent: managerEmails.length
    };

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error in send-agreement-notification:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 500,
      }
    );
  }
});
