import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, Range',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const videoId = url.searchParams.get('id');

    if (!videoId) {
      throw new Error('Missing video ID');
    }

    const { data: videoRecord, error: dbError } = await supabase
      .from('video_uploads')
      .select('*')
      .eq('id', videoId)
      .single();

    if (dbError || !videoRecord) {
      console.error('Video not found:', dbError);
      return new Response('Video not found', { status: 404 });
    }

    if (videoRecord.status !== 'complete') {
      return new Response('Video is not ready for streaming', { status: 400 });
    }

    const totalSize = videoRecord.total_size_bytes;
    const totalChunks = videoRecord.total_chunks;
    const storageFolder = videoRecord.storage_folder;
    const contentType = videoRecord.content_type;

    const rangeHeader = req.headers.get('range');
    
    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      const stream = new ReadableStream({
        async start(controller) {
          try {
            let currentByte = 0;
            let bytesToSkip = start;
            let bytesToRead = chunkSize;

            for (let i = 0; i < totalChunks && bytesToRead > 0; i++) {
              const chunkPath = `${storageFolder}/chunk-${i}`;
              const { data, error } = await supabase.storage
                .from('temp-chunks')
                .download(chunkPath);

              if (error || !data) {
                console.error(`Failed to download chunk ${i}:`, error);
                controller.error(new Error(`Failed to download chunk ${i}`));
                return;
              }

              const chunkData = new Uint8Array(await data.arrayBuffer());
              const chunkLength = chunkData.length;

              if (currentByte + chunkLength <= start) {
                currentByte += chunkLength;
                continue;
              }

              const skipInChunk = Math.max(0, bytesToSkip);
              const readFromChunk = Math.min(chunkLength - skipInChunk, bytesToRead);
              
              const slice = chunkData.slice(skipInChunk, skipInChunk + readFromChunk);
              controller.enqueue(slice);

              bytesToSkip -= chunkLength;
              bytesToRead -= readFromChunk;
              currentByte += chunkLength;
            }

            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        status: 206,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
        },
      });
    } else {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for (let i = 0; i < totalChunks; i++) {
              const chunkPath = `${storageFolder}/chunk-${i}`;
              const { data, error } = await supabase.storage
                .from('temp-chunks')
                .download(chunkPath);

              if (error || !data) {
                console.error(`Failed to download chunk ${i}:`, error);
                controller.error(new Error(`Failed to download chunk ${i}`));
                return;
              }

              const chunkData = new Uint8Array(await data.arrayBuffer());
              controller.enqueue(chunkData);
            }

            controller.close();
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Length': totalSize.toString(),
          'Accept-Ranges': 'bytes',
        },
      });
    }
  } catch (error: any) {
    console.error('Error streaming video:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to stream video' 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});