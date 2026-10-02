import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const jsonResponse = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, serviceKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const serviceClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('role, is_active')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profile?.is_active || profile.role !== 'master') return jsonResponse({ error: 'Only master users can use Bob.' }, 403);

    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) return jsonResponse({ error: 'Audio recording is required.' }, 400);
    if (audio.size === 0 || audio.size > 10 * 1024 * 1024) return jsonResponse({ error: 'Audio recording is too large.' }, 400);

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Voice transcription is not configured.' }, 500);

    const elevenLabsForm = new FormData();
    elevenLabsForm.append('file', audio, audio.name || 'bob-question.webm');
    elevenLabsForm.append('model_id', 'scribe_v2');
    elevenLabsForm.append('language_code', 'en');

    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: elevenLabsForm,
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('ElevenLabs transcription error:', response.status, data);
      return jsonResponse({ error: 'Voice transcription failed. Please try again.' }, 502);
    }

    const text = typeof data?.text === 'string' ? data.text.trim() : '';
    if (!text) return jsonResponse({ error: 'I did not hear a question. Please try again.' }, 422);
    return jsonResponse({ text });
  } catch (error) {
    console.error('Jarvis transcription error:', error);
    return jsonResponse({ error: 'Voice transcription failed. Please try again.' }, 500);
  }
});
