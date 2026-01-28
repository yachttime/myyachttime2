import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { managerEmails, repairTitle, yachtName, submitterName } = await req.json();

    if (!managerEmails || managerEmails.length === 0) {
      throw new Error('No manager emails provided');
    }

    console.log('Sending repair notification emails to:', managerEmails);
    console.log('Repair Title:', repairTitle);
    console.log('Yacht:', yachtName);
    console.log('Submitted by:', submitterName);

    const emailPromises = managerEmails.map(async (email: string) => {
      console.log(`Sending email to: ${email}`);
      return {
        to: email,
        subject: `New Repair Request: ${repairTitle}`,
        body: `A new repair request has been submitted for ${yachtName}.\n\nTitle: ${repairTitle}\nSubmitted by: ${submitterName}\n\nPlease log in to the yacht management system to review and approve this request.`
      };
    });

    const emailResults = await Promise.all(emailPromises);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification emails prepared',
        emails: emailResults,
        note: 'Email sending requires SMTP configuration. Emails have been logged to console.'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error in send-repair-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});