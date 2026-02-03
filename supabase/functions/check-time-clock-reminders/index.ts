import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ScheduleCheck {
  user_id: string;
  full_name: string;
  email_address: string;
  schedule_date: string;
  start_time?: string;
  end_time?: string;
  scheduled_start_datetime?: string;
  scheduled_end_datetime?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Import Supabase client
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time in Eastern Time
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === "year")!.value;
    const month = parts.find(p => p.type === "month")!.value;
    const day = parts.find(p => p.type === "day")!.value;
    const hour = parts.find(p => p.type === "hour")!.value;
    const minute = parts.find(p => p.type === "minute")!.value;

    const currentDate = `${year}-${month}-${day}`;
    const currentTime = `${hour}:${minute}:00`;

    console.log(`Checking schedules for ${currentDate} at ${currentTime} ET`);

    // Calculate the time 10 minutes ago
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const tenMinutesAgoParts = formatter.formatToParts(tenMinutesAgo);
    const tenMinutesAgoTime = `${tenMinutesAgoParts.find(p => p.type === "hour")!.value}:${tenMinutesAgoParts.find(p => p.type === "minute")!.value}:00`;

    // Query 1: Get staff schedules that should have PUNCHED IN 10+ minutes ago
    const { data: punchInSchedules, error: punchInError } = await supabase.rpc(
      "get_schedules_needing_reminders",
      {
        check_date: currentDate,
        check_time: tenMinutesAgoTime,
      }
    );

    if (punchInError) {
      console.error("Error fetching punch-in schedules:", punchInError);
      throw punchInError;
    }

    // Query 2: Get staff schedules that should have PUNCHED OUT 10+ minutes ago
    const { data: punchOutSchedules, error: punchOutError } = await supabase.rpc(
      "get_schedules_needing_punchout_reminders",
      {
        check_date: currentDate,
        check_time: tenMinutesAgoTime,
      }
    );

    if (punchOutError) {
      console.error("Error fetching punch-out schedules:", punchOutError);
      throw punchOutError;
    }

    const totalSchedules = (punchInSchedules?.length || 0) + (punchOutSchedules?.length || 0);

    if (totalSchedules === 0) {
      console.log("No schedules need reminders at this time");
      return new Response(
        JSON.stringify({ success: true, message: "No reminders needed", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${punchInSchedules?.length || 0} punch-in and ${punchOutSchedules?.length || 0} punch-out schedules to check`);

    const remindersSent = [];

    // Process PUNCH-IN reminders
    if (punchInSchedules && punchInSchedules.length > 0) {
      for (const schedule of punchInSchedules as ScheduleCheck[]) {
        try {
          // Check if user has already punched in today
          // Convert Eastern Time date to UTC date range for the full 24-hour period
          const etStartOfDay = new Date(`${currentDate}T00:00:00-05:00`);
          const etEndOfDay = new Date(`${currentDate}T23:59:59-05:00`);

          const { data: timeEntry, error: timeEntryError } = await supabase
            .from("staff_time_entries")
            .select("punch_in_time")
            .eq("user_id", schedule.user_id)
            .gte("punch_in_time", etStartOfDay.toISOString())
            .lte("punch_in_time", etEndOfDay.toISOString())
            .maybeSingle();

          if (timeEntryError) {
            console.error(`Error checking time entry for ${schedule.full_name}:`, timeEntryError);
            continue;
          }

          if (timeEntry && timeEntry.punch_in_time) {
            console.log(`${schedule.full_name} already punched in at ${timeEntry.punch_in_time}`);
            continue;
          }

          // Check if we already sent a punch-in reminder for this schedule
          const { data: existingReminder, error: reminderCheckError } = await supabase
            .from("time_clock_reminders")
            .select("id")
            .eq("user_id", schedule.user_id)
            .eq("schedule_date", currentDate)
            .eq("reminder_type", "punch_in")
            .maybeSingle();

          if (reminderCheckError) {
            console.error(`Error checking existing reminder for ${schedule.full_name}:`, reminderCheckError);
            continue;
          }

          if (existingReminder) {
            console.log(`Already sent punch-in reminder to ${schedule.full_name} for today`);
            continue;
          }

          // Send email reminder
          if (resendApiKey && schedule.email_address) {
            console.log(`Sending punch-in reminder email to ${schedule.full_name} (${schedule.email_address})`);

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "Marina App <notifications@yourmarina.com>",
                to: [schedule.email_address],
                subject: "Time Clock Reminder - Please Punch In",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1f2937;">Time Clock Reminder - Punch In</h2>
                    <p>Hello ${schedule.full_name},</p>
                    <p>You were scheduled to start work at <strong>${schedule.start_time}</strong> today.</p>
                    <p>We noticed you haven't punched in yet. Please remember to clock in using the Time Clock in the app.</p>
                    <p style="margin-top: 20px;">
                      <a href="${supabaseUrl.replace('/functions/v1', '')}"
                         style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Open Time Clock
                      </a>
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                      If you've already punched in, please disregard this message.
                    </p>
                  </div>
                `,
              }),
            });

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              console.error(`Failed to send email to ${schedule.email_address}:`, errorText);
            } else {
              console.log(`Successfully sent punch-in reminder email to ${schedule.email_address}`);
            }
          }

          // Record the reminder in the database
          const { error: insertError } = await supabase
            .from("time_clock_reminders")
            .insert({
              user_id: schedule.user_id,
              schedule_date: currentDate,
              scheduled_start_time: schedule.start_time,
              reminder_type: "punch_in",
            });

          if (insertError) {
            console.error(`Error recording punch-in reminder for ${schedule.full_name}:`, insertError);
          } else {
            remindersSent.push({
              user: schedule.full_name,
              email: schedule.email_address,
              type: "punch_in",
              scheduled_time: schedule.start_time,
            });
          }
        } catch (error) {
          console.error(`Error processing punch-in schedule for user ${schedule.user_id}:`, error);
        }
      }
    }

    // Process PUNCH-OUT reminders
    if (punchOutSchedules && punchOutSchedules.length > 0) {
      for (const schedule of punchOutSchedules as ScheduleCheck[]) {
        try {
          // Check if user has already punched out today
          // Convert Eastern Time date to UTC date range for the full 24-hour period
          const etStartOfDay = new Date(`${currentDate}T00:00:00-05:00`);
          const etEndOfDay = new Date(`${currentDate}T23:59:59-05:00`);

          const { data: timeEntry, error: timeEntryError } = await supabase
            .from("staff_time_entries")
            .select("punch_in_time, punch_out_time")
            .eq("user_id", schedule.user_id)
            .gte("punch_in_time", etStartOfDay.toISOString())
            .lte("punch_in_time", etEndOfDay.toISOString())
            .maybeSingle();

          if (timeEntryError) {
            console.error(`Error checking time entry for ${schedule.full_name}:`, timeEntryError);
            continue;
          }

          // If they never punched in, don't send punch-out reminder
          if (!timeEntry || !timeEntry.punch_in_time) {
            console.log(`${schedule.full_name} never punched in, skipping punch-out reminder`);
            continue;
          }

          // If they already punched out, skip
          if (timeEntry.punch_out_time) {
            console.log(`${schedule.full_name} already punched out at ${timeEntry.punch_out_time}`);
            continue;
          }

          // Check if we already sent a punch-out reminder for this schedule
          const { data: existingReminder, error: reminderCheckError } = await supabase
            .from("time_clock_reminders")
            .select("id")
            .eq("user_id", schedule.user_id)
            .eq("schedule_date", currentDate)
            .eq("reminder_type", "punch_out")
            .maybeSingle();

          if (reminderCheckError) {
            console.error(`Error checking existing punch-out reminder for ${schedule.full_name}:`, reminderCheckError);
            continue;
          }

          if (existingReminder) {
            console.log(`Already sent punch-out reminder to ${schedule.full_name} for today`);
            continue;
          }

          // Send email reminder
          if (resendApiKey && schedule.email_address) {
            console.log(`Sending punch-out reminder email to ${schedule.full_name} (${schedule.email_address})`);

            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "Marina App <notifications@yourmarina.com>",
                to: [schedule.email_address],
                subject: "Time Clock Reminder - Please Punch Out",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1f2937;">Time Clock Reminder - Punch Out</h2>
                    <p>Hello ${schedule.full_name},</p>
                    <p>Your shift was scheduled to end at <strong>${schedule.end_time}</strong> today.</p>
                    <p>We noticed you haven't punched out yet. Please remember to clock out using the Time Clock in the app.</p>
                    <p style="margin-top: 20px;">
                      <a href="${supabaseUrl.replace('/functions/v1', '')}"
                         style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        Open Time Clock
                      </a>
                    </p>
                    <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                      If you've already punched out, please disregard this message.
                    </p>
                  </div>
                `,
              }),
            });

            if (!emailResponse.ok) {
              const errorText = await emailResponse.text();
              console.error(`Failed to send punch-out email to ${schedule.email_address}:`, errorText);
            } else {
              console.log(`Successfully sent punch-out reminder email to ${schedule.email_address}`);
            }
          }

          // Record the reminder in the database
          const { error: insertError } = await supabase
            .from("time_clock_reminders")
            .insert({
              user_id: schedule.user_id,
              schedule_date: currentDate,
              scheduled_end_time: schedule.end_time,
              reminder_type: "punch_out",
            });

          if (insertError) {
            console.error(`Error recording punch-out reminder for ${schedule.full_name}:`, insertError);
          } else {
            remindersSent.push({
              user: schedule.full_name,
              email: schedule.email_address,
              type: "punch_out",
              scheduled_time: schedule.end_time,
            });
          }
        } catch (error) {
          console.error(`Error processing punch-out schedule for user ${schedule.user_id}:`, error);
        }
      }
    }

    console.log(`Sent ${remindersSent.length} reminders`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${remindersSent.length} reminders`,
        reminders: remindersSent,
        count: remindersSent.length,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in check-time-clock-reminders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
