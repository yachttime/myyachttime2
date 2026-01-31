import { useState, useEffect } from 'react';
import { Anchor, ArrowLeft, Play, Upload, Edit2, X, Save, Trash2, Folder } from 'lucide-react';
import { supabase, EducationVideo } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EducationProps {
  onBack: () => void;
}

export const Education = ({ onBack }: EducationProps) => {
  const { userProfile } = useAuth();
  const [videos, setVideos] = useState<EducationVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<EducationVideo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [introVideo, setIntroVideo] = useState<EducationVideo | null>(null);
  const [introductionVideos, setIntroductionVideos] = useState<EducationVideo[]>([]);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingVideo, setEditingVideo] = useState<EducationVideo | null>(null);
  const [editForm, setEditForm] = useState({ order_index: 0, category: '', title: '', description: '', thumbnail_url: '' });
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditForms, setBulkEditForms] = useState<{ [key: string]: any }>({});
  const [addingNewVideo, setAddingNewVideo] = useState(false);
  const [newVideoForm, setNewVideoForm] = useState({ order_index: 0, category: '', title: '', description: '', thumbnail_url: '', video_url: '' });

  useEffect(() => {
    loadVideos();
  }, [userProfile]);

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('education_videos')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;

      console.log('🎬 RAW DATA FROM DATABASE:', data?.length, 'videos');
      console.log('🎬 ALL CATEGORIES:', data?.map(v => ({ title: v.title, category: v.category })));

      const welcomeVideo = data?.find(v => v.category?.trim() === 'Welcome');
      const introductionVideos = data?.filter(v => v.category?.trim() === 'Introduction') || [];

      const specialCategories = ['Welcome', 'Introduction', 'SignIn'];
      const others = data?.filter(v => !specialCategories.includes(v.category?.trim())) || [];

      console.log('🎬 WELCOME VIDEO:', welcomeVideo ? `"${welcomeVideo.title}"` : 'NONE');
      console.log('🎬 INTRODUCTION VIDEOS:', introductionVideos.length, 'videos');
      console.log('🎬 OTHER VIDEOS:', others.length, 'videos');

      setIntroVideo(welcomeVideo || null);
      setIntroductionVideos(introductionVideos);
      setVideos(others);
    } catch (error) {
      console.error('Error loading videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));

    if (videoFile) {
      await uploadVideo(videoFile);
    } else {
      alert('Please upload a video file (MP4, MOV, AVI, WebM, etc.)');
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      await uploadVideo(file);
    } else {
      alert('Please upload a video file (MP4, MOV, AVI, WebM, etc.)');
    }
  };

  const uploadStandardVideo = async (file: File, fileName: string): Promise<string> => {
    console.log('Standard upload - File details:', {
      name: file.name,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      type: file.type
    });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('education-videos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'video/mp4',
      });

    if (uploadError) {
      console.error('Standard upload error details:', {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError.error,
        name: uploadError.name,
        fullError: JSON.stringify(uploadError, null, 2)
      });
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('education-videos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const uploadLargeVideo = async (file: File, fileName: string): Promise<string> => {
    console.log(`Using chunked upload for large file: ${(file.size / (1024 * 1024)).toFixed(1)}MB`);

    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    console.log(`File will be split into ${totalChunks} chunks of ${(CHUNK_SIZE / (1024 * 1024))}MB each`);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      console.log('Supabase URL:', supabaseUrl);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get session: ' + sessionError.message);
      }

      if (!session) {
        throw new Error('No active session - please log out and log back in');
      }

      console.log('Session retrieved, access token present:', !!session.access_token);

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('yachtId', userProfile?.yacht_id || '');
        formData.append('fileName', fileName);
        formData.append('chunkIndex', chunkIndex.toString());
        formData.append('totalChunks', totalChunks.toString());
        formData.append('chunk', chunk);
        formData.append('mimeType', file.type);

        console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks} to ${supabaseUrl}/functions/v1/upload-large-video`);

        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/upload-large-video`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });

          console.log(`Chunk ${chunkIndex + 1} response status:`, response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Chunk ${chunkIndex + 1} error response:`, errorText);
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: errorText };
            }
            throw new Error(errorData.error || `Failed to upload chunk ${chunkIndex + 1}: ${response.status} ${response.statusText}`);
          }

          const progress = Math.floor(((chunkIndex + 1) / totalChunks) * 90);
          setUploadProgress(progress);
          console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded (${progress}%)`);

          if (chunkIndex === totalChunks - 1) {
            const result = await response.json();
            console.log('Upload complete, video ID:', result.videoId);

            const streamUrl = `${supabaseUrl}/functions/v1/stream-video?id=${result.videoId}`;
            return streamUrl;
          }
        } catch (fetchError: any) {
          console.error(`Fetch error for chunk ${chunkIndex + 1}:`, fetchError);
          throw new Error(`Network error uploading chunk ${chunkIndex + 1}: ${fetchError.message}. Please check your internet connection.`);
        }
      }

      throw new Error('Upload completed but no URL returned');
    } catch (error) {
      console.error('Chunked upload exception:', error);
      throw error;
    }
  };

  const uploadVideo = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      const fileSizeMB = file.size / (1024 * 1024);
      const fileSizeGB = fileSizeMB / 1024;

      console.log('=== UPLOAD DIAGNOSTICS ===');
      console.log('File information:', {
        originalName: file.name,
        size: file.size,
        sizeMB: fileSizeMB.toFixed(2),
        sizeGB: fileSizeGB.toFixed(3),
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
      });

      // Supabase Pro tier: 5GB limit per file
      // Free tier: 50MB limit per file
      const supabaseFreeLimit = 50; // MB
      const supabaseProLimit = 5000; // MB (5GB)
      const largeFileThresholdMB = 50; // Use TUS upload for files over 50MB

      // Warn if file is large (might be on free tier)
      if (fileSizeMB > supabaseFreeLimit && fileSizeMB <= 100) {
        console.warn(`File is ${fileSizeMB.toFixed(1)}MB. If upload fails, you may need to upgrade to Supabase Pro tier.`);
      }

      // Block uploads over 5GB (absolute maximum for Pro tier)
      if (fileSizeMB > supabaseProLimit) {
        alert(
          `File Too Large: ${fileSizeGB.toFixed(2)}GB\n\n` +
          `Maximum allowed: 5GB (Pro tier)\n\n` +
          `Please compress the video before uploading.`
        );
        setUploading(false);
        setUploadProgress(0);
        return;
      }

      const fileExt = 'mp4';
      const fileName = `${userProfile?.id || 'unknown'}-${Date.now()}.${fileExt}`;

      console.log(`Starting upload: ${fileName} (${fileSizeMB.toFixed(1)}MB)`);

      let publicUrl: string;

      // All files use the same upload method - Supabase automatically uses TUS for files > 6MB
      if (fileSizeMB > largeFileThresholdMB) {
        console.log('Using TUS resumable upload for large file');
        publicUrl = await uploadLargeVideo(file, fileName);
      } else {
        console.log('Using standard upload');
        publicUrl = await uploadStandardVideo(file, fileName);
      }

      setUploadProgress(95);

      console.log('Upload complete, saving to database...');

      if (introVideo) {
        const { error: updateError } = await supabase
          .from('education_videos')
          .update({
            video_url: publicUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', introVideo.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('education_videos')
          .insert({
            title: 'Introduction to Your Yacht',
            description: 'Welcome video introducing you to your yacht',
            category: 'Introduction',
            video_url: publicUrl,
            thumbnail_url: 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=400'
          });

        if (insertError) throw insertError;
      }

      setUploadProgress(100);
      console.log('Video uploaded successfully!');
      await loadVideos();
      alert('Video uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      const fileSizeMB = file.size / (1024 * 1024);
      const fileSizeGB = fileSizeMB / 1024;
      let errorMsg = error.message || 'Failed to upload video';

      if (errorMsg.includes('413') || errorMsg.includes('Payload Too Large') || errorMsg.includes('Request Entity Too Large')) {
        errorMsg = `Upload Failed: File Too Large\n\n` +
          `File size: ${fileSizeGB > 1 ? fileSizeGB.toFixed(2) + 'GB' : fileSizeMB.toFixed(1) + 'MB'}\n\n` +
          `The file could not be uploaded due to size restrictions.`;
      } else if (errorMsg.includes('exceeded') || errorMsg.includes('maximum') || errorMsg.includes('size limit') || errorMsg.includes('object')) {
        errorMsg = `Upload Failed: ${errorMsg}\n\n` +
          `File size: ${fileSizeGB > 1 ? fileSizeGB.toFixed(2) + 'GB' : fileSizeMB.toFixed(1) + 'MB'}\n\n` +
          `Try compressing the video or reducing its quality.`;
      } else if (errorMsg.includes('chunk')) {
        errorMsg = `Upload Failed: ${errorMsg}\n\n` +
          `There was an issue with the chunked upload process.\n` +
          `Please try again.`;
      }

      alert(errorMsg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEditVideo = (video: EducationVideo) => {
    setEditingVideo(video);
    setEditForm({
      order_index: video.order_index || 0,
      category: video.category,
      title: video.title,
      description: video.description || '',
      thumbnail_url: video.thumbnail_url || ''
    });
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    setUploadingThumbnail(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfile?.id || 'unknown'}-${Date.now()}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from('education-videos')
        .upload(`thumbnails/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('education-videos')
        .getPublicUrl(`thumbnails/${fileName}`);

      setEditForm({ ...editForm, thumbnail_url: publicUrl });
      alert('Thumbnail uploaded successfully!');
    } catch (error: any) {
      console.error('Thumbnail upload error:', error);
      alert(`Failed to upload thumbnail: ${error.message}`);
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingVideo) return;

    try {
      const { error } = await supabase
        .from('education_videos')
        .update({
          order_index: editForm.order_index,
          category: editForm.category,
          title: editForm.title,
          description: editForm.description,
          thumbnail_url: editForm.thumbnail_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingVideo.id);

      if (error) throw error;

      alert('Video updated successfully!');
      setEditingVideo(null);
      await loadVideos();
    } catch (error: any) {
      console.error('Update error:', error);
      alert(`Failed to update video: ${error.message}`);
    }
  };

  const handleDeleteVideo = async () => {
    if (!editingVideo) return;

    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('education_videos')
        .delete()
        .eq('id', editingVideo.id);

      if (error) throw error;

      alert('Video deleted successfully!');
      setEditingVideo(null);
      await loadVideos();
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`Failed to delete video: ${error.message}`);
    }
  };

  const handleEnterBulkEdit = () => {
    const forms: { [key: string]: any } = {};
    [...videos, ...(introVideo ? [introVideo] : []), ...introductionVideos].forEach(video => {
      forms[video.id] = {
        order_index: video.order_index || 0,
        category: video.category,
        title: video.title,
        description: video.description || '',
        thumbnail_url: video.thumbnail_url || ''
      };
    });
    setBulkEditForms(forms);
    setBulkEditMode(true);
  };

  const handleBulkThumbnailUpload = async (videoId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfile?.id || 'unknown'}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('education-videos')
        .upload(`thumbnails/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('education-videos')
        .getPublicUrl(`thumbnails/${fileName}`);

      setBulkEditForms({
        ...bulkEditForms,
        [videoId]: { ...bulkEditForms[videoId], thumbnail_url: publicUrl }
      });

      alert('Thumbnail uploaded successfully!');
    } catch (error: any) {
      console.error('Thumbnail upload error:', error);
      alert(`Failed to upload thumbnail: ${error.message}`);
    }
  };

  const handleSaveBulkChanges = async () => {
    try {
      const allVideos = [...videos, ...(introVideo ? [introVideo] : []), ...introductionVideos];

      for (const video of allVideos) {
        const form = bulkEditForms[video.id];
        if (form) {
          const { error } = await supabase
            .from('education_videos')
            .update({
              order_index: form.order_index,
              category: form.category,
              title: form.title,
              description: form.description,
              thumbnail_url: form.thumbnail_url,
              updated_at: new Date().toISOString()
            })
            .eq('id', video.id);

          if (error) throw error;
        }
      }

      alert('All changes saved successfully!');
      setBulkEditMode(false);
      await loadVideos();
    } catch (error: any) {
      console.error('Bulk update error:', error);
      alert(`Failed to save changes: ${error.message}`);
    }
  };

  const handleDeleteVideoFromBulk = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('education_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      alert('Video deleted successfully!');
      await loadVideos();

      const forms = { ...bulkEditForms };
      delete forms[videoId];
      setBulkEditForms(forms);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`Failed to delete video: ${error.message}`);
    }
  };

  const handleAddNewVideo = async () => {
    if (!newVideoForm.title || !newVideoForm.category) {
      alert('Please fill in at least the title and category');
      return;
    }

    try {
      const { error } = await supabase
        .from('education_videos')
        .insert({
          order_index: newVideoForm.order_index,
          category: newVideoForm.category,
          title: newVideoForm.title,
          description: newVideoForm.description,
          thumbnail_url: newVideoForm.thumbnail_url || 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=400',
          video_url: newVideoForm.video_url || ''
        });

      if (error) throw error;

      alert('Video added successfully!');
      setAddingNewVideo(false);
      setNewVideoForm({ order_index: 0, category: '', title: '', description: '', thumbnail_url: '', video_url: '' });
      await loadVideos();
    } catch (error: any) {
      console.error('Add video error:', error);
      alert(`Failed to add video: ${error.message}`);
    }
  };

  const handleNewVideoThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userProfile?.id || 'unknown'}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('education-videos')
        .upload(`thumbnails/${fileName}`, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('education-videos')
        .getPublicUrl(`thumbnails/${fileName}`);

      setNewVideoForm({ ...newVideoForm, thumbnail_url: publicUrl });
      alert('Thumbnail uploaded successfully!');
    } catch (error: any) {
      console.error('Thumbnail upload error:', error);
      alert(`Failed to upload thumbnail: ${error.message}`);
    }
  };

  // EARLY DEBUG PANEL - Shows on ALL views
  const categories = Array.from(new Set(videos.map(v => v.category?.trim()).filter(Boolean))).sort((a, b) => {
    const categoryOrder = ['Introduction', 'General Systems', 'Generators'];
    const indexA = categoryOrder.indexOf(a);
    const indexB = categoryOrder.indexOf(b);

    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
  const debugPanel = (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, backgroundColor: '#dc2626', color: 'white', padding: '16px', border: '8px solid yellow', zIndex: 999999 }}>
      <div style={{ fontWeight: 'bold', fontSize: '24px', marginBottom: '8px' }}>🚨 EDUCATION DEBUG - YOU SHOULD SEE THIS 🚨</div>
      <div style={{ fontFamily: 'monospace', fontSize: '14px' }}>
        <div>loading: {loading ? 'TRUE' : 'FALSE'}</div>
        <div>introVideo (Welcome): {introVideo ? `"${introVideo.title}"` : 'NULL'}</div>
        <div>introductionVideos: {introductionVideos.length} videos</div>
        <div>videos (other categories): {videos.length} videos</div>
        <div>categories: [{categories.join(', ')}]</div>
        <div>categories.length: {categories.length}</div>
        <div>selectedVideo: {selectedVideo ? 'SET' : 'NULL'}</div>
        <div>selectedCategory: {selectedCategory || 'NULL'}</div>
        <div>addingNewVideo: {addingNewVideo ? 'TRUE' : 'FALSE'}</div>
        <div>editingVideo: {editingVideo ? 'SET' : 'NULL'}</div>
        <div>bulkEditMode: {bulkEditMode ? 'TRUE' : 'FALSE'}</div>
      </div>
    </div>
  );

  if (addingNewVideo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        {debugPanel}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Anchor className="w-7 h-7 text-amber-500" />
              <h1 className="text-xl font-bold tracking-wide">ADD NEW VIDEO</h1>
            </div>
            <button
              onClick={() => setAddingNewVideo(false)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close add video form"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6">New Video Details</h2>

              <div className="space-y-6">
                <div>
                  <label htmlFor="new-video-order" className="block text-sm font-medium text-slate-300 mb-2">
                    Order
                  </label>
                  <input
                    id="new-video-order"
                    name="order_index"
                    type="number"
                    value={newVideoForm.order_index}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, order_index: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label htmlFor="new-video-category" className="block text-sm font-medium text-slate-300 mb-2">
                    Category
                  </label>
                  <input
                    id="new-video-category"
                    name="category"
                    type="text"
                    value={newVideoForm.category}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="new-video-title" className="block text-sm font-medium text-slate-300 mb-2">
                    Title *
                  </label>
                  <input
                    id="new-video-title"
                    name="title"
                    type="text"
                    value={newVideoForm.title}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="new-video-description" className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    id="new-video-description"
                    name="description"
                    value={newVideoForm.description}
                    onChange={(e) => setNewVideoForm({ ...newVideoForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white resize-none"
                  />
                </div>

                <div className="bg-amber-500/10 p-6 rounded-xl border-2 border-amber-500">
                  <label className="block text-lg font-bold text-amber-500 mb-4 flex items-center gap-2">
                    <Upload className="w-6 h-6" />
                    Thumbnail
                  </label>

                  {newVideoForm.thumbnail_url && (
                    <div className="mb-4 rounded-lg overflow-hidden border-2 border-slate-600">
                      <img
                        src={newVideoForm.thumbnail_url}
                        alt="Thumbnail preview"
                        className="w-full aspect-video object-cover"
                      />
                    </div>
                  )}

                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewVideoThumbnailUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      aria-label="Upload thumbnail image"
                    />
                    <div className="border-2 border-dashed border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 rounded-lg p-6 text-center cursor-pointer transition-colors">
                      <Upload className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                      <p className="text-white text-lg font-semibold mb-1">
                        {newVideoForm.thumbnail_url ? 'Change Thumbnail' : 'Upload Thumbnail'}
                      </p>
                      <p className="text-slate-400 text-sm">
                        PNG, JPG, WebP up to 10MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleAddNewVideo}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Add Video
                  </button>
                  <button
                    onClick={() => setAddingNewVideo(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (bulkEditMode) {
    const allVideos = [...videos, ...(introVideo ? [introVideo] : []), ...introductionVideos].sort((a, b) => a.order_index - b.order_index);

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        {debugPanel}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Anchor className="w-7 h-7 text-amber-500" />
              <h1 className="text-xl font-bold tracking-wide">EDIT ALL VIDEOS</h1>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveBulkChanges}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save All Changes
              </button>
              <button
                onClick={() => setBulkEditMode(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto space-y-6">
            {allVideos.map((video) => {
              const form = bulkEditForms[video.id] || {};
              return (
                <div key={video.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`bulk-order-${video.id}`} className="block text-sm font-medium text-slate-300 mb-2">
                            Order
                          </label>
                          <input
                            id={`bulk-order-${video.id}`}
                            name="order_index"
                            type="number"
                            value={form.order_index || 0}
                            onChange={(e) => setBulkEditForms({
                              ...bulkEditForms,
                              [video.id]: { ...form, order_index: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                          />
                        </div>
                        <div>
                          <label htmlFor={`bulk-category-${video.id}`} className="block text-sm font-medium text-slate-300 mb-2">
                            Category
                          </label>
                          <input
                            id={`bulk-category-${video.id}`}
                            name="category"
                            type="text"
                            value={form.category || ''}
                            onChange={(e) => setBulkEditForms({
                              ...bulkEditForms,
                              [video.id]: { ...form, category: e.target.value }
                            })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor={`bulk-title-${video.id}`} className="block text-sm font-medium text-slate-300 mb-2">
                          Title
                        </label>
                        <input
                          id={`bulk-title-${video.id}`}
                          name="title"
                          type="text"
                          value={form.title || ''}
                          onChange={(e) => setBulkEditForms({
                            ...bulkEditForms,
                            [video.id]: { ...form, title: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                        />
                      </div>

                      <div>
                        <label htmlFor={`bulk-description-${video.id}`} className="block text-sm font-medium text-slate-300 mb-2">
                          Description
                        </label>
                        <textarea
                          id={`bulk-description-${video.id}`}
                          name="description"
                          value={form.description || ''}
                          onChange={(e) => setBulkEditForms({
                            ...bulkEditForms,
                            [video.id]: { ...form, description: e.target.value }
                          })}
                          rows={3}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white resize-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-300">
                        Thumbnail
                      </label>
                      {form.thumbnail_url ? (
                        <div className="relative group rounded-lg overflow-hidden border-2 border-slate-600">
                          <img
                            src={form.thumbnail_url}
                            alt="Thumbnail"
                            className="w-full aspect-video object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-video bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-600 rounded-lg">
                          <Upload className="w-12 h-12 text-slate-600" />
                        </div>
                      )}

                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleBulkThumbnailUpload(video.id, e)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          aria-label="Change video thumbnail"
                        />
                        <button className="w-full bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
                          <Upload className="w-4 h-4" />
                          Change Thumbnail
                        </button>
                      </div>

                      <button
                        onClick={() => handleDeleteVideoFromBulk(video.id)}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Video
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (editingVideo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        {debugPanel}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Anchor className="w-7 h-7 text-amber-500" />
              <h1 className="text-xl font-bold tracking-wide">EDIT VIDEO</h1>
            </div>
            <button
              onClick={() => setEditingVideo(null)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close edit video form"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-3xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
              <h2 className="text-2xl font-bold mb-6">Edit Video Details</h2>

              <div className="space-y-6">
                <div>
                  <label htmlFor="edit-video-order" className="block text-sm font-medium text-slate-300 mb-2">
                    Order
                  </label>
                  <input
                    id="edit-video-order"
                    name="order_index"
                    type="number"
                    value={editForm.order_index}
                    onChange={(e) => setEditForm({ ...editForm, order_index: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label htmlFor="edit-video-category" className="block text-sm font-medium text-slate-300 mb-2">
                    Category
                  </label>
                  <input
                    id="edit-video-category"
                    name="category"
                    type="text"
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="edit-video-title" className="block text-sm font-medium text-slate-300 mb-2">
                    Title
                  </label>
                  <input
                    id="edit-video-title"
                    name="title"
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white"
                  />
                </div>

                <div>
                  <label htmlFor="edit-video-description" className="block text-sm font-medium text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    id="edit-video-description"
                    name="description"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-white resize-none"
                  />
                </div>

                <div className="bg-amber-500/10 p-8 rounded-xl border-4 border-amber-500 shadow-lg shadow-amber-500/20">
                  <label className="block text-2xl font-bold text-amber-500 mb-6 flex items-center gap-3">
                    <Upload className="w-8 h-8" />
                    CHANGE VIDEO THUMBNAIL
                  </label>

                  <div className="mb-6 rounded-lg overflow-hidden border-4 border-slate-600">
                    {editForm.thumbnail_url ? (
                      <div className="relative group">
                        <img
                          src={editForm.thumbnail_url}
                          alt="Current thumbnail"
                          className="w-full aspect-video object-cover"
                        />
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <p className="text-amber-500 text-xl font-bold">CLICK BELOW TO CHANGE</p>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-slate-900 flex items-center justify-center border-4 border-dashed border-amber-500">
                        <div className="text-center">
                          <Upload className="w-16 h-16 text-amber-500 mx-auto mb-3" />
                          <p className="text-amber-500 font-bold text-xl">NO THUMBNAIL SET</p>
                          <p className="text-slate-400 text-base mt-2">Click below to add one</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      disabled={uploadingThumbnail}
                      aria-label="Upload or change thumbnail image"
                    />
                    <div className={`border-4 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                      uploadingThumbnail
                        ? 'border-amber-500 bg-amber-500/20 shadow-lg shadow-amber-500/30'
                        : 'border-amber-500 bg-amber-500/5 hover:bg-amber-500/20 hover:shadow-lg hover:shadow-amber-500/20'
                    }`}>
                      <Upload className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                      <p className="text-white text-2xl font-bold mb-2">
                        {uploadingThumbnail ? 'UPLOADING...' : editForm.thumbnail_url ? 'CLICK HERE TO CHANGE THUMBNAIL' : 'CLICK HERE TO UPLOAD THUMBNAIL'}
                      </p>
                      <p className="text-amber-500 text-lg font-semibold mb-2">
                        Click anywhere in this box or drag and drop
                      </p>
                      <p className="text-slate-400 text-base">
                        PNG, JPG, WebP up to 10MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditingVideo(null)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteVideo}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-5 h-5" />
                    Delete Video
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedVideo) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        {debugPanel}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Anchor className="w-7 h-7 text-amber-500" />
              <h1 className="text-xl font-bold tracking-wide">MY YACHT TIME</h1>
            </div>
            <button
              onClick={() => {
                setSelectedVideo(null);
                setVideoError(null);
              }}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Back to education list"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl mb-6">
              {selectedVideo.video_url ? (
                <>
                  <video
                    controls
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    className="w-full aspect-video bg-black"
                    onError={(e) => {
                      const video = e.currentTarget;
                      const error = video.error;
                      let errorMessage = 'Unable to load video';

                      if (error) {
                        switch (error.code) {
                          case error.MEDIA_ERR_ABORTED:
                            errorMessage = 'Video loading was aborted';
                            break;
                          case error.MEDIA_ERR_NETWORK:
                            errorMessage = 'Network error occurred while loading video';
                            break;
                          case error.MEDIA_ERR_DECODE:
                            errorMessage = 'Video format error or corrupted file. Try converting to MP4 (H.264) format.';
                            break;
                          case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                            errorMessage = 'Video format not supported by your browser or file not found';
                            break;
                          default:
                            errorMessage = `Unknown error (code: ${error.code})`;
                        }
                      }

                      console.error('Video playback error:', errorMessage, {
                        url: selectedVideo.video_url,
                        error: error
                      });
                      setVideoError(errorMessage);
                    }}
                    onLoadStart={() => {
                      console.log('Video loading started:', selectedVideo.video_url);
                      setVideoError(null);
                    }}
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      console.log('Video metadata loaded:', {
                        duration: video.duration,
                        videoWidth: video.videoWidth,
                        videoHeight: video.videoHeight
                      });
                    }}
                    onCanPlay={() => {
                      console.log('Video can play');
                    }}
                  >
                    <source src={selectedVideo.video_url} type="video/mp4" />
                    <source src={selectedVideo.video_url} type="video/quicktime" />
                    <source src={selectedVideo.video_url} type="video/webm" />
                    Your browser does not support the video tag.
                  </video>
                  {videoError && (
                    <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 m-4">
                      <p className="text-red-400 font-semibold mb-2">{videoError}</p>
                      <p className="text-red-300 text-sm break-all">URL: {selectedVideo.video_url}</p>
                      <p className="text-red-300 text-sm mt-2">Please check:</p>
                      <ul className="text-red-300 text-sm list-disc list-inside">
                        <li>The video file exists in storage</li>
                        <li>The storage bucket is publicly accessible</li>
                        <li>The video file is a valid MP4 format</li>
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-video bg-slate-800 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-20 h-20 text-amber-500 mx-auto mb-4" />
                    <p className="text-slate-400">No video URL available</p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <div className="inline-block bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-sm font-medium mb-4">
                {selectedVideo.category}
              </div>
              <h2 className="text-2xl font-bold mb-3">{selectedVideo.title}</h2>
              <p className="text-slate-300 leading-relaxed">{selectedVideo.description}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getCategoryVideos = (category: string) => {
    if (category === 'Introduction') {
      return introductionVideos;
    }
    return videos.filter(v => v.category?.trim() === category);
  };

  const getCategoryThumbnail = (category: string) => {
    const firstVideo = videos.find(v => v.category?.trim() === category);
    return firstVideo?.thumbnail_url || 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=400';
  };

  if (selectedCategory) {
    const categoryVideos = getCategoryVideos(selectedCategory);

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        {debugPanel}
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Anchor className="w-7 h-7 text-amber-500" />
              <h1 className="text-xl font-bold tracking-wide">{selectedCategory.toUpperCase()}</h1>
            </div>
            <button
              onClick={() => setSelectedCategory(null)}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Back to categories"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">{selectedCategory} Videos</h2>
              <p className="text-slate-400">Click any video to watch</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryVideos.map((video) => (
                <div
                  key={video.id}
                  className="relative group bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20"
                >
                  {(userProfile?.role === 'staff' || userProfile?.role === 'manager' || userProfile?.role === 'master') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditVideo(video);
                      }}
                      className="absolute top-2 right-2 z-[9999] bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2.5 rounded-xl transition-colors shadow-2xl font-extrabold flex items-center gap-2 border-4 border-black"
                    >
                      <Edit2 className="w-5 h-5 stroke-[3]" />
                      <span className="text-base">EDIT</span>
                    </button>
                  )}
                  <div
                    onClick={() => setSelectedVideo(video)}
                    className="cursor-pointer overflow-hidden rounded-2xl"
                  >
                    <div className="relative aspect-video bg-slate-900 overflow-hidden">
                      {video.thumbnail_url ? (
                        <>
                          <img
                            src={video.thumbnail_url}
                            alt={video.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent pointer-events-none"></div>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-amber-500 rounded-full p-4 group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                              <Play className="w-6 h-6 text-slate-900 fill-slate-900" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Play className="w-16 h-16 text-amber-500" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="text-lg font-bold mb-1 group-hover:text-amber-500 transition-colors">
                        {video.title}
                      </h4>
                      <p className="text-slate-400 text-sm line-clamp-2">{video.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      {debugPanel}
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Anchor className="w-7 h-7 text-amber-500" />
            <h1 className="text-xl font-bold tracking-wide">YACHT TIME</h1>
          </div>
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="max-w-6xl mx-auto">

          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-2">Education</h2>
                <p className="text-slate-400">Click any video to watch</p>
              </div>
              <div className="flex items-center gap-3">
                {(userProfile?.role === 'staff' || userProfile?.role === 'manager' || userProfile?.role === 'master') && (
                  <>
                    <button
                      onClick={handleEnterBulkEdit}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                      <Edit2 className="w-5 h-5" />
                      Edit Videos
                    </button>
                    <button
                      onClick={() => setAddingNewVideo(true)}
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Add Video
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {(userProfile?.role === 'staff' || userProfile?.role === 'manager' || userProfile?.role === 'master') && (
            <div className="mb-8">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-12 transition-all ${
                  dragActive
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-600 bg-slate-800/30 hover:border-slate-500'
                }`}
              >
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="text-center">
                  <Upload className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    {uploading ? 'Uploading Video...' : 'Upload Introduction Video'}
                  </h3>
                  <p className="text-slate-400 mb-2">
                    Drag and drop an MP4 file here, or click to browse
                  </p>
                  <div className="text-sm space-y-1 mb-2">
                    <p className="text-green-400 font-medium">
                      Maximum: 5GB per file (Pro tier)
                    </p>
                    <p className="text-blue-400 text-xs">
                      Large files use resumable upload protocol for reliability
                    </p>
                    <p className="text-slate-400 text-xs">
                      Keep your browser tab active during upload
                    </p>
                  </div>
                  <p className="text-slate-500 text-xs">
                    Tip: Compress videos with HandBrake for faster uploads
                  </p>
                  {uploading && uploadProgress > 0 && (
                    <div className="mt-4 max-w-md mx-auto">
                      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-slate-400 mt-2">
                        {uploadProgress}% complete
                      </p>
                    </div>
                  )}
                  {introVideo && !uploading && (
                    <p className="text-amber-500 text-sm">
                      Uploading a new video will replace the existing introduction video
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <p className="text-slate-400">Loading educational content...</p>
            </div>
          ) : (
            <>
              {introVideo && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">Welcome</h3>
                  <div className="relative group bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20">
                    {(userProfile?.role === 'staff' || userProfile?.role === 'manager' || userProfile?.role === 'master') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('EDIT BUTTON CLICKED - WELCOME');
                          handleEditVideo(introVideo);
                        }}
                        className="absolute top-2 right-2 z-[9999] bg-yellow-400 hover:bg-yellow-500 text-black px-5 py-3 rounded-xl transition-colors shadow-2xl font-extrabold flex items-center gap-2 border-4 border-black"
                      >
                        <Edit2 className="w-6 h-6 stroke-[3]" />
                        <span className="text-lg">EDIT</span>
                      </button>
                    )}
                    <div
                      onClick={() => {
                        setSelectedVideo(introVideo);
                      }}
                      className="cursor-pointer overflow-hidden rounded-2xl"
                    >
                    <div className="relative aspect-video bg-slate-900 overflow-hidden">
                      {introVideo.thumbnail_url ? (
                        <>
                          <img
                            src={introVideo.thumbnail_url}
                            alt={introVideo.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent pointer-events-none"></div>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-amber-500 rounded-full p-6 group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                              <Play className="w-8 h-8 text-slate-900 fill-slate-900" />
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Play className="w-20 h-20 text-amber-500" />
                        </div>
                      )}
                    </div>
                    <div className="p-6">
                      <div className="inline-block bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-sm font-medium mb-3">
                        {introVideo.category}
                      </div>
                      <h4 className="text-xl font-bold mb-2 group-hover:text-amber-500 transition-colors">
                        {introVideo.title}
                      </h4>
                      <p className="text-slate-400 line-clamp-2">{introVideo.description}</p>
                    </div>
                    </div>
                  </div>
                </div>
              )}

              {introductionVideos.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold mb-4">Introduction</h3>
                  <div
                    onClick={() => setSelectedCategory('Introduction')}
                    className="group cursor-pointer bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20"
                  >
                    <div className="relative aspect-video bg-slate-900 overflow-hidden rounded-t-2xl">
                      <img
                        src={introductionVideos[0]?.thumbnail_url || 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=400'}
                        alt="Introduction"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="bg-amber-500 rounded-2xl p-5 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                            <Folder className="w-10 h-10 text-slate-900" />
                          </div>
                          <div className="bg-amber-500/90 text-slate-900 px-4 py-2 rounded-full text-sm font-bold">
                            {introductionVideos.length} {introductionVideos.length === 1 ? 'Video' : 'Videos'}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="p-6">
                      <h4 className="text-2xl font-bold text-center group-hover:text-amber-500 transition-colors">
                        Introduction
                      </h4>
                    </div>
                  </div>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Topics</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categories.map((category) => {
                      const videoCount = getCategoryVideos(category).length;
                      return (
                        <div
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className="group cursor-pointer bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20"
                        >
                          <div className="relative aspect-video bg-slate-900 overflow-hidden rounded-t-2xl">
                            <img
                              src={getCategoryThumbnail(category)}
                              alt={category}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-center">
                                <div className="bg-amber-500 rounded-2xl p-5 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                                  <Folder className="w-10 h-10 text-slate-900" />
                                </div>
                                <div className="bg-amber-500/90 text-slate-900 px-4 py-2 rounded-full text-sm font-bold">
                                  {videoCount} {videoCount === 1 ? 'Video' : 'Videos'}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="p-6">
                            <h4 className="text-2xl font-bold text-center group-hover:text-amber-500 transition-colors">
                              {category}
                            </h4>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!introVideo && introductionVideos.length === 0 && categories.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-400">No educational content available yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
