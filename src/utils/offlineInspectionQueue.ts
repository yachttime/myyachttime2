/**
 * Offline inspection queue — stores completed and draft inspections on the device
 * so they can be submitted later when internet is available.
 */

export type InspectionKind = 'trip' | 'handoff';
export type QueueItemStatus = 'draft' | 'ready' | 'uploading' | 'uploaded' | 'failed';

export interface OfflinePhoto {
  /** base64 data URL of the image so it persists in localStorage */
  dataUrl: string;
  category: 'port_prop' | 'starboard_prop' | 'damage' | 'general';
  caption: string;
}

export interface OfflineInspectionItem {
  id: string;
  kind: InspectionKind;
  status: QueueItemStatus;
  yachtId: string;
  yachtName: string;
  inspectorId: string;
  inspectorName: string;
  ownerName: string;
  inspectionType: 'check_in' | 'check_out';
  formData: Record<string, unknown>;
  photos: OfflinePhoto[];
  companyId?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

const STORAGE_KEY = 'offline_inspection_queue';

function loadQueue(): OfflineInspectionItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as OfflineInspectionItem[];
  } catch {
    return [];
  }
}

function saveQueue(items: OfflineInspectionItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to persist offline inspection queue:', err);
  }
}

export function getQueue(): OfflineInspectionItem[] {
  return loadQueue();
}

export function addItem(item: Omit<OfflineInspectionItem, 'id' | 'createdAt' | 'updatedAt'>): OfflineInspectionItem {
  const items = loadQueue();
  const now = new Date().toISOString();
  const full: OfflineInspectionItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    createdAt: now,
    updatedAt: now,
  };
  items.push(full);
  saveQueue(items);
  return full;
}

export function updateItem(id: string, patch: Partial<OfflineInspectionItem>): void {
  const items = loadQueue();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  items[idx] = { ...items[idx], ...patch, updatedAt: new Date().toISOString() };
  saveQueue(items);
}

export function removeItem(id: string): void {
  const items = loadQueue().filter(i => i.id !== id);
  saveQueue(items);
}

export function getReadyItems(): OfflineInspectionItem[] {
  return loadQueue().filter(i => i.status === 'ready');
}

export function getDraftCount(): number {
  return loadQueue().filter(i => i.status === 'draft').length;
}

export function getReadyCount(): number {
  return loadQueue().filter(i => i.status === 'ready').length;
}

export function convertFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_PHOTO_DIMENSION = 1280;

export async function compressImage(file: File): Promise<string> {
  const dataUrl = await convertFileToDataUrl(file);

  // For non-image types, just return the data URL as-is
  if (!file.type.startsWith('image/')) return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_PHOTO_DIMENSION || height > MAX_PHOTO_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_PHOTO_DIMENSION);
          width = MAX_PHOTO_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_PHOTO_DIMENSION);
          height = MAX_PHOTO_DIMENSION;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
