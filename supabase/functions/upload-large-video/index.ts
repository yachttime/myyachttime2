import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UploadChunkRequest {
  yachtId: string;
  fileName: string;
  chunkIndex: number;
  totalChunks: number;
  chunk: string;
}

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const formData = await req.formData();
    const yachtId = formData.get('yachtId') as string;
    const fileName = formData.get('fileName') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const chunkFile = formData.get('chunk') as File;
    const mimeType = formData.get('mimeType') as string;

    if (!yachtId || !fileName || chunkIndex === undefined || !totalChunks || !chunkFile) {
      throw new Error('Missing required parameters');
    }

    let contentType = mimeType || 'video/mp4';
    if (!mimeType) {
      const ext = fileName.toLowerCase().split('.').pop();
      const mimeMap: Record<string, string> = {
        'mp4': 'video/mp4',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
        'mkv': 'video/x-matroska',
        'm4v': 'video/x-m4v',
      };
      contentType = mimeMap[ext || ''] || 'video/mp4';
    }

    const tempPath = `${yachtId}/${fileName}/chunk-${chunkIndex}`;
    const chunkBytes = await chunkFile.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('temp-chunks')
      .upload(tempPath, chunkBytes, {
        contentType: 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) {
      console.error('Chunk upload error:', uploadError);
      throw new Error(`Failed to upload chunk: ${uploadError.message || JSON.stringify(uploadError)}`);
    }

    if (chunkIndex === totalChunks - 1) {
      console.log(`All ${totalChunks} chunks uploaded for ${fileName}`);

      const storageFolder = `${yachtId}/${fileName}`;

      let totalSizeBytes = 0;
      for (let i = 0; i < totalChunks; i++) {
        const chunkPath = `${storageFolder}/chunk-${i}`;
        const { data, error } = await supabase.storage
          .from('temp-chunks')
          .download(chunkPath);

        if (data) {
          totalSizeBytes += data.size;
        }
      }

      console.log(`Total video size: ${(totalSizeBytes / (1024 * 1024)).toFixed(2)}MB`);

      const { data: videoRecord, error: dbError } = await supabase
        .from('video_uploads')
        .insert({
          yacht_id: yachtId,
          filename: fileName,
          content_type: contentType,
          total_chunks: totalChunks,
          total_size_bytes: totalSizeBytes,
          storage_folder: storageFolder,
          status: 'complete',
          completed_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        throw new Error(`Failed to save video metadata: ${dbError.message}`);
      }

      console.log('Video upload complete, video ID:', videoRecord.id);

      const streamUrl = `${supabaseUrl}/functions/v1/stream-video?id=${videoRecord.id}`;

      return new Response(
        JSON.stringify({
          success: true,
          videoId: videoRecord.id,
          url: streamUrl,
          totalSize: totalSizeBytes,
          totalChunks: totalChunks
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded` 
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('Error uploading video:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to upload video' 
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