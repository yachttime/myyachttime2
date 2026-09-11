import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  reportId: string;
  recipientEmails: string[];
  ccEmails?: string[];
  subject?: string;
  message?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Check API key BEFORE doing any work
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured. Please add RESEND_API_KEY to enable email sending." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { reportId, recipientEmails, ccEmails, subject, message }: EmailRequest = await req.json();

    if (!reportId || !recipientEmails || recipientEmails.length === 0) {
      throw new Error("Report ID and at least one recipient email are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipientEmails) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid recipient email: ${email}`);
      }
    }
    if (ccEmails) {
      for (const email of ccEmails) {
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid CC email: ${email}`);
        }
      }
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, first_name, last_name")
      .eq("user_id", user.id)
      .single();

    const hasAccess = profile?.role === "staff" || profile?.role === "manager" || profile?.role === "mechanic" || profile?.role === "master";
    if (!hasAccess) {
      throw new Error("Unauthorized to send salvage report emails");
    }

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the report with media
    const { data: report, error: reportError } = await adminSupabase
      .from("salvage_reports")
      .select(`
        *,
        salvage_report_media(*)
      `)
      .eq("id", reportId)
      .single();

    if (reportError || !report) {
      throw new Error("Salvage report not found");
    }

    // Fetch company info
    let companyName = "";
    let companyPhone = "";
    let companyEmail = "";
    let companyAddress = "";
    let companyMailingAddress = "";
    let logoUrl: string | null = null;

    if (report.company_id) {
      const { data: company } = await adminSupabase
        .from("companies")
        .select("company_name, logo_url, phone, email, address, city, state, zip_code, mailing_address, mailing_city, mailing_state, mailing_zip_code")
        .eq("id", report.company_id)
        .maybeSingle();

      if (company) {
        companyName = company.company_name || "";
        logoUrl = company.logo_url || null;
        companyPhone = company.phone || "";
        companyEmail = company.email || "";
        companyAddress = [company.address, company.city, company.state, company.zip_code].filter(Boolean).join(", ");
        companyMailingAddress = [company.mailing_address, company.mailing_city, company.mailing_state, company.mailing_zip_code].filter(Boolean).join(", ");
      }
    }

    const sortedMedia = (report.salvage_report_media || []).sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));

    // Videos are ALWAYS links (too large for email attachments)
    const videoLinks: Array<{ name: string; url: string }> = sortedMedia
      .filter((m: any) => m.media_type === "video_loss")
      .map((m: any) => ({ name: m.file_name, url: m.file_url }));

    // All photos are shown as inline images in the email body via their public URLs.
    // No photo file attachments are included — photos are viewed inline only.
    const photoMedia = sortedMedia.filter((m: any) => m.media_type === "photo_prior" || m.media_type === "photo_loss");
    const photoPrior = sortedMedia.filter((m: any) => m.media_type === "photo_prior");
    const photoLoss = sortedMedia.filter((m: any) => m.media_type === "photo_loss");
    const videoLoss = sortedMedia.filter((m: any) => m.media_type === "video_loss");

    // Build satellite map image URL if GPS coordinates are valid
    const latNum = parseFloat(report.gps_latitude);
    const lngNum = parseFloat(report.gps_longitude);
    let mapHtml = "";
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      const latSpan = 0.0351;
      const lngSpan = 0.0527;
      const bbox = [lngNum - lngSpan, latNum - latSpan, lngNum + lngSpan, latNum + latSpan].join(",");
      const mapParams = new URLSearchParams({ bbox, bboxSR: "4326", imageSR: "4326", size: "900,520", format: "png32", f: "image" });
      const mapUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?${mapParams.toString()}`;
      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`;
      mapHtml = `
        <tr>
          <td style="padding:0 0 20px 0;">
            <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Approximate Location of Loss</h3>
            <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;">GPS: ${latNum.toFixed(4)}, ${lngNum.toFixed(4)} — <a href="${gmapsUrl}" style="color:#2563eb;">Open in Google Maps</a></p>
            <a href="${gmapsUrl}" target="_blank" style="display:block;text-decoration:none;">
              <img src="${mapUrl}" alt="Satellite imagery showing approximate salvage location at ${latNum}, ${lngNum}" style="width:100%;max-width:576px;height:auto;border-radius:6px;border:1px solid #e5e7eb;display:block;" />
            </a>
            <p style="font-size:9px;color:#9ca3af;margin:4px 0 0 0;">Esri, Maxar, Earthstar Geographics</p>
          </td>
        </tr>`;
    }

    const emailSubject = subject || `Salvage Service Report ${report.report_number}`;

    function fieldRow(label: string, value: string | null | undefined): string {
      if (!value) return "";
      return `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;white-space:nowrap;">${label}</td><td style="padding:4px 0;font-size:13px;color:#111827;">${value}</td></tr>`;
    }

    function section(title: string, rows: string): string {
      if (!rows) return "";
      return `
        <tr>
          <td style="padding:0 0 20px 0;">
            <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">${title}</h3>
            <table style="border-collapse:collapse;">${rows}</table>
          </td>
        </tr>`;
    }

    const ownerRows = [
      fieldRow("Vessel Name", report.vessel_name),
      fieldRow("Owner Name", report.owner_name),
      fieldRow("Owner Phone", report.owner_phone),
      fieldRow("Owner Email", report.owner_email),
      fieldRow("Owner Address", report.owner_address),
      fieldRow("Mailing Address", report.owner_mailing_address),
    ].join("");

    const insuranceRows = [
      fieldRow("Insurance Company", report.insurance_company),
      fieldRow("Policy Number", report.policy_number),
      fieldRow("Claim Number", report.claim_number),
      fieldRow("Adjuster Name", report.adjuster_name),
      fieldRow("Adjuster Phone", report.adjuster_phone),
      fieldRow("Adjuster Email", report.adjuster_email),
    ].join("");

    const lossRows = [
      fieldRow("Date of Loss", report.date_of_loss),
      fieldRow("Date of Service", report.date_of_service),
      fieldRow("GPS Latitude", report.gps_latitude),
      fieldRow("GPS Longitude", report.gps_longitude),
      fieldRow("Vessel Depth", report.vessel_depth),
    ].join("");

    const conditionRows = [
      report.vessel_description_prior
        ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Description Prior to Loss</td><td style="padding:4px 0;font-size:13px;color:#111827;">${report.vessel_description_prior.replace(/\n/g, "<br>")}</td></tr>`
        : "",
      fieldRow("Diesel Fuel (gal)", report.diesel_gallons),
      fieldRow("Gasoline (gal)", report.gas_gallons),
    ].join("");

    const findingsRows = [
      report.underwater_condition
        ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Underwater Condition</td><td style="padding:4px 0;font-size:13px;color:#111827;">${report.underwater_condition.replace(/\n/g, "<br>")}</td></tr>`
        : "",
      report.findings
        ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px;vertical-align:top;">Findings &amp; Notes</td><td style="padding:4px 0;font-size:13px;color:#111827;">${report.findings.replace(/\n/g, "<br>")}</td></tr>`
        : "",
    ].join("");

    function photoGallery(photos: any[], sectionTitle: string): string {
      if (photos.length === 0) return "";
      const thumbs = photos.map((p: any, i: number) =>
        `<a href="${p.file_url}" target="_blank" style="display:inline-block;margin:4px 4px 8px 0;text-decoration:none;">`
        + `<img src="${p.file_url}" alt="${p.file_name}" style="width:180px;height:135px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;" />`
        + `<span style="display:block;font-size:11px;color:#6b7280;margin-top:2px;text-align:center;">${i + 1}. ${p.file_name}</span>`
        + `</a>`
      ).join("");
      return `
        <tr>
          <td style="padding:0 0 20px 0;">
            <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">${sectionTitle} (${photos.length})</h3>
            <p style="font-size:12px;color:#6b7280;margin:0 0 10px 0;">Click any photo to view it at full size.</p>
            ${thumbs}
          </td>
        </tr>`;
    }

    const photoPriorHtml = photoGallery(photoPrior, "Photos Prior to Loss");
    const photoLossHtml = photoGallery(photoLoss, "Photos of Loss");

    const videoLinksHtml = videoLinks.length > 0
      ? `
        <tr>
          <td style="padding:0 0 20px 0;">
            <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#374151;border-bottom:1px solid #e5e7eb;padding-bottom:6px;">Videos</h3>
            <p style="font-size:12px;color:#6b7280;margin:0 0 8px 0;">Click the links below to view the videos online:</p>
            ${videoLinks.map(v => `<p style="margin:4px 0;font-size:13px;"><a href="${v.url}" style="color:#2563eb;">${v.name}</a></p>`).join("")}
          </td>
        </tr>`
      : "";

    const totalPhotoCount = photoMedia.length;

    const mediaSummary = `
      <tr>
        <td style="padding:0 0 20px 0;">
          <p style="font-size:13px;color:#374153;margin:0;">
            <strong>Photos:</strong> ${totalPhotoCount} photo${totalPhotoCount !== 1 ? "s" : ""} shown above.
            ${videoLinks.length > 0 ? `${videoLinks.length} video${videoLinks.length !== 1 ? "s" : ""} included as links.` : ""}
          </p>
        </td>
      </tr>`;

    const personalMessage = message
      ? `<tr><td style="padding:0 0 20px 0;"><div style="background:#f9fafb;border-left:4px solid #2563eb;padding:12px 16px;border-radius:0 6px 6px 0;font-size:14px;color:#111827;">${message.replace(/\n/g, "<br>")}</div></td></tr>`
      : "";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;min-height:100%;">
          <tr>
            <td align="center" style="padding:24px 12px;">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#1e3a5f 0%,#15293f 100%);padding:28px 32px;">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:56px;max-width:200px;margin-bottom:12px;display:block;" />` : ""}
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Salvage Service Report</h1>
                    <p style="margin:4px 0 0 0;font-size:14px;color:#93c5fd;">${report.report_number}</p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:28px 32px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${personalMessage}
                      ${section("Owner & Insurance Information", ownerRows + insuranceRows)}
                      ${section("Loss & Service Details", lossRows)}
                      ${mapHtml}
                      ${section("Vessel Condition & Fuel", conditionRows)}
                      ${section("Report Findings", findingsRows)}
                      ${photoPriorHtml}
                      ${photoLossHtml}
                      ${mediaSummary}
                      ${videoLinksHtml}
                    </table>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:13px;color:#6b7280;">
                      <strong style="color:#374151;">${companyName}</strong>${companyPhone ? ` &nbsp;|&nbsp; ${companyPhone}` : ""}${companyEmail ? ` &nbsp;|&nbsp; ${companyEmail}` : ""}
                    </p>
                    ${companyAddress ? `<p style="margin:2px 0 0 0;font-size:12px;color:#9ca3af;">Physical: ${companyAddress}</p>` : ""}
                    ${companyMailingAddress ? `<p style="margin:2px 0 0 0;font-size:12px;color:#9ca3af;">Mailing: ${companyMailingAddress}</p>` : ""}
                    <p style="margin:8px 0 0 0;font-size:11px;color:#9ca3af;">Report #${report.report_number} &nbsp;|&nbsp; Generated ${new Date().toLocaleDateString()}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>`;

    let fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "notifications@myyachttime.com";
    fromEmail = fromEmail.trim();

    const emailPayload: any = {
      from: fromEmail,
      to: recipientEmails,
      subject: emailSubject,
      html: htmlContent,
      tags: [
        { name: "category", value: "salvage-report" },
        { name: "report_id", value: reportId },
      ],
      headers: { "X-Entity-Ref-ID": reportId },
    };

    if (ccEmails && ccEmails.length > 0) {
      emailPayload.cc = ccEmails;
    }

    console.log(`Sending salvage report email for ${report.report_number}: ${recipientEmails.length} recipients, ${totalPhotoCount} photos inline, ${videoLinks.length} video links, map: ${mapHtml ? "yes" : "no"}`);

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend API error:", errorText);
      let errorMessage = "Failed to send email via Resend";
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMessage = `Resend Error: ${errorData.message}`;
          if (errorData.message.includes("testing emails")) {
            errorMessage += "\n\nTo fix this:\n1. Go to resend.com/domains and verify your domain\n2. In Supabase Edge Functions, add RESEND_FROM_EMAIL secret";
          }
        }
      } catch {
        errorMessage = `Resend Error (${emailResponse.status}): ${errorText}`;
      }
      throw new Error(errorMessage);
    }

    const emailData = await emailResponse.json();
    console.log("Salvage report email sent successfully:", emailData);

    // Update report with email tracking
    await adminSupabase
      .from("salvage_reports")
      .update({
        email_sent_at: new Date().toISOString(),
        email_recipients: recipientEmails.join(", "),
        email_cc_recipients: (ccEmails || []).join(", ") || null,
        email_resend_id: emailData.id,
      })
      .eq("id", reportId);

    return new Response(
      JSON.stringify({ success: true, message: "Salvage report email sent successfully", emailId: emailData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending salvage report email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
