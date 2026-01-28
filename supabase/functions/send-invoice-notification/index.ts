import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvoiceNotificationRequest {
  managerEmails: string[];
  repairTitle: string;
  yachtName: string;
  invoiceAmount: string;
  invoiceFileUrl?: string;
  completedBy: string;
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
      repairTitle,
      yachtName,
      invoiceAmount,
      invoiceFileUrl,
      completedBy
    }: InvoiceNotificationRequest = await req.json();

    console.log('Invoice notification requested:', {
      managerEmails,
      repairTitle,
      yachtName,
      invoiceAmount,
      completedBy
    });

    const data = {
      message: `Invoice notification sent for repair: ${repairTitle}`,
      managerCount: managerEmails.length,
      repairTitle,
      yachtName,
      invoiceAmount,
      completedBy,
      invoiceFileUrl: invoiceFileUrl || null
    };

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    console.error('Error in send-invoice-notification:', error);

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
