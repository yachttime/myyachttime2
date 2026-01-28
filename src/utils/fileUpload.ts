import { supabase } from '../lib/supabase';

export interface UploadProgress {
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error' | 'complete';
  error?: string;
  isAuthError?: boolean;
}

export const isTokenExpiredError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorBody = JSON.stringify(error).toLowerCase();

  return (
    errorMessage.includes('jwt expired') ||
    errorMessage.includes('token expired') ||
    errorMessage.includes('session expired') ||
    errorMessage.includes('claim timestamp check failed') ||
    errorBody.includes('jwt expired') ||
    errorBody.includes('token expired') ||
    (error?.status === 401 && errorMessage.includes('unauthorized'))
  );
};

export const uploadFileToStorage = async (
  bucketNameOrFile: string | File,
  filePathOrUserId: string,
  fileOrOnProgress?: File | ((progress: UploadProgress) => void),
  onProgress?: (progress: UploadProgress) => void
): Promise<string> => {
  try {
    let bucketName: string;
    let filePath: string;
    let file: File;
    let progressCallback: ((progress: UploadProgress) => void) | undefined;

    if (bucketNameOrFile instanceof File) {
      bucketName = 'yacht-documents';
      const userId = filePathOrUserId;
      file = bucketNameOrFile;
      progressCallback = fileOrOnProgress as ((progress: UploadProgress) => void) | undefined;

      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      filePath = `${userId}/${timestamp}-${randomString}.${fileExt}`;
    } else {
      bucketName = bucketNameOrFile;
      filePath = filePathOrUserId;
      file = fileOrOnProgress as File;
      progressCallback = onProgress;
    }

    progressCallback?.({ progress: 0, status: 'uploading' });

    let uploadError: any = null;
    let uploadData: any = null;

    if (file.size > 6 * 1024 * 1024) {
      const result = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          // @ts-ignore - TUS protocol for resumable uploads
          onUploadProgress: (progress: { loaded: number; total: number }) => {
            const percentage = Math.round((progress.loaded / progress.total) * 100);
            progressCallback?.({
              progress: Math.min(percentage, 95),
              status: 'uploading'
            });
          }
        });

      uploadData = result.data;
      uploadError = result.error;
    } else {
      progressCallback?.({ progress: 30, status: 'uploading' });

      const result = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      uploadData = result.data;
      uploadError = result.error;

      progressCallback?.({ progress: 80, status: 'uploading' });
    }

    if (uploadError) {
      throw uploadError;
    }

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    progressCallback?.({ progress: 100, status: 'success' });

    return urlData.publicUrl;
  } catch (error: any) {
    let errorMessage = error.message || 'Failed to upload file';
    const isAuthError = isTokenExpiredError(error);

    if (isAuthError) {
      errorMessage = 'Your session has expired. Please log out and log back in to continue.';
    }

    const progressCallback = typeof fileOrOnProgress === 'function' ? fileOrOnProgress : onProgress;
    progressCallback?.({ progress: 0, status: 'error', error: errorMessage, isAuthError });
    throw new Error(errorMessage);
  }
};

export const deleteFileFromStorage = async (fileUrl: string): Promise<void> => {
  try {
    const urlParts = fileUrl.split('/yacht-documents/');
    if (urlParts.length < 2) {
      throw new Error('Invalid file URL');
    }

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('yacht-documents')
      .remove([filePath]);

    if (error) {
      throw error;
    }
  } catch (error: any) {
    console.error('Error deleting file from storage:', error);
    throw error;
  }
};

export const isStorageUrl = (url: string): boolean => {
  return url.includes('/yacht-documents/');
};
