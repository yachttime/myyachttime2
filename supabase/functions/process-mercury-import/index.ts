import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MercuryPart {
  part_number: string;
  item_class: string;
  description: string;
  superseded_part_number: string;
  msrp: number;
  dealer_price: number;
  item_status: string;
  pack_quantity: number;
  weight_lbs: number;
  weight_oz: number;
  upc_code: string;
  core_charge: number;
  container_charge: number;
  hazardous_code: string;
  discount_percentage: number;
  ca_proposition_65: string;
  unit_length: number;
  unit_width: number;
  unit_height: number;
}

interface ImportRequest {
  importId: string;
  parts: MercuryPart[];
  companyId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
      .auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: ImportRequest = await req.json();
    const { importId, parts, companyId } = body;

    if (!importId || !parts || !Array.isArray(parts)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const startTime = Date.now();

    await supabase.rpc('truncate_mercury_marine_parts');

    const batchSize = 500;
    let imported = 0;
    let lastError: string | null = null;

    for (let i = 0; i < parts.length; i += batchSize) {
      const batch = parts.slice(i, i + batchSize).map(part => ({
        ...part,
        import_batch_id: importId,
        company_id: companyId,
      }));

      const { error: insertError } = await supabase
        .from('mercury_marine_parts')
        .insert(batch);

      if (insertError) {
        console.error('Batch insert error:', insertError);
        lastError = insertError.message;
      } else {
        imported += batch.length;
      }

      const progress = Math.round(((i + batchSize) / parts.length) * 100);
      await supabase
        .from('mercury_price_list_imports')
        .update({ total_parts_imported: imported })
        .eq('id', importId);

      if (progress % 20 === 0 || i + batchSize >= parts.length) {
        console.log(`Progress: ${Math.min(progress, 100)}% - ${imported} parts inserted`);
      }
    }

    const processingTime = Math.round((Date.now() - startTime) / 1000);

    if (imported === 0 && lastError) {
      await supabase
        .from('mercury_price_list_imports')
        .update({
          status: 'failed',
          error_message: lastError,
          processing_time_seconds: processingTime,
        })
        .eq('id', importId);

      return new Response(JSON.stringify({ success: false, error: lastError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase
      .from('mercury_price_list_imports')
      .update({
        status: 'success',
        total_parts_imported: imported,
        processing_time_seconds: processingTime,
        error_message: lastError,
      })
      .eq('id', importId);

    return new Response(
      JSON.stringify({ success: true, imported, processingTime }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
