import { useState } from 'react';
import { UploadCloud, File as FileEdit, CheckCircle, XCircle, Loader2, Trash2, Upload, ChevronDown, ChevronUp, Clock, AlertCircle } from 'lucide-react';
import type { OfflineInspectionItem, QueueItemStatus } from '../utils/offlineInspectionQueue';

interface PendingQueuePanelProps {
  items: OfflineInspectionItem[];
  onOpen: (item: OfflineInspectionItem) => void;
  onUploadOne: (item: OfflineInspectionItem) => void;
  onUploadAll: () => void;
  onDelete: (id: string) => void;
  uploading: boolean;
}

function statusBadge(status: QueueItemStatus): { label: string; classes: string; icon: typeof CheckCircle } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', classes: 'bg-slate-500/20 text-slate-300', icon: FileEdit };
    case 'ready':
      return { label: 'Ready', classes: 'bg-amber-500/20 text-amber-300', icon: Clock };
    case 'uploading':
      return { label: 'Uploading', classes: 'bg-blue-500/20 text-blue-300', icon: Loader2 };
    case 'uploaded':
      return { label: 'Uploaded', classes: 'bg-green-500/20 text-green-300', icon: CheckCircle };
    case 'failed':
      return { label: 'Failed', classes: 'bg-red-500/20 text-red-300', icon: XCircle };
  }
}

export default function PendingQueuePanel({
  items, onOpen, onUploadOne, onUploadAll, onDelete, uploading,
}: PendingQueuePanelProps) {
  const [expanded, setExpanded] = useState(true);

  const readyCount = items.filter(i => i.status === 'ready').length;
  const draftCount = items.filter(i => i.status === 'draft').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const hasItems = items.length > 0;

  if (!hasItems) {
    return (
      <div className="bg-slate-800/40 rounded-xl p-4 border border-slate-700/50 flex items-center gap-3 text-slate-400">
        <UploadCloud className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">No pending inspections. Completed inspections will appear here for upload when offline.</span>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/60 rounded-xl border border-slate-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-slate-100">Pending Inspections</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {readyCount > 0 && (
              <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                {readyCount} ready
              </span>
            )}
            {draftCount > 0 && (
              <span className="bg-slate-500/20 text-slate-300 px-2 py-0.5 rounded-full font-medium">
                {draftCount} draft{draftCount !== 1 ? 's' : ''}
              </span>
            )}
            {failedCount > 0 && (
              <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full font-medium">
                {failedCount} failed
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {readyCount > 0 && !expanded && (
            <span className="text-sm text-amber-300 font-medium">Upload All</span>
          )}
          {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {readyCount > 0 && (
            <button
              type="button"
              onClick={onUploadAll}
              disabled={uploading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 font-semibold py-3 rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
            >
              <UploadCloud className="w-5 h-5" />
              {uploading ? 'Uploading...' : `Upload All Ready (${readyCount})`}
            </button>
          )}

          {items.map((item) => {
            const badge = statusBadge(item.status);
            const StatusIcon = badge.icon;
            const isDraft = item.status === 'draft';
            const isUploading = item.status === 'uploading';
            const isFailed = item.status === 'failed';
            const canUpload = (item.status === 'ready' || isFailed) && !uploading;

            return (
              <div
                key={item.id}
                className={`bg-slate-900/50 rounded-lg p-3 border ${
                  isFailed ? 'border-red-500/40' : 'border-slate-700/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${badge.classes}`}>
                        <StatusIcon className={`w-3 h-3 ${isUploading ? 'animate-spin' : ''}`} />
                        {badge.label}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.kind === 'trip'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {item.kind === 'trip' ? 'Trip Inspection' : 'Owner Handoff'}
                      </span>
                    </div>
                    <p className="text-slate-100 font-medium mt-1.5 truncate">{item.yachtName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {item.inspectorName} &middot; {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {item.photos.length > 0 && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.photos.length} photo{item.photos.length !== 1 ? 's' : ''}</p>
                    )}
                    {isFailed && item.error && (
                      <p className="text-xs text-red-400 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                        <span>{item.error}</span>
                      </p>
                    )}
                    {isDraft && (
                      <p className="text-xs text-slate-500 mt-1 italic">Complete this inspection before uploading</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      disabled={uploading}
                      className="text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600 disabled:opacity-50 text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      Open
                    </button>
                    {canUpload && (
                      <button
                        type="button"
                        onClick={() => onUploadOne(item)}
                        className="text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      disabled={isUploading}
                      className="text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
