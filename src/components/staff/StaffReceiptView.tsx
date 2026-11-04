import { useRef, useState } from 'react';
import { Camera, ImagePlus, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatLocalDate } from './staffDates';

const TAG_OPTIONS = [
  { value: 'shop_supplies', label: 'Shop supplies' },
  { value: 'fuel_company_vehicle', label: 'Fuel - company vehicle' },
  { value: 'fuel_company_boat', label: 'Fuel - company boat' },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const inputClass = 'w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-3 text-white focus:outline-none focus:border-amber-500';

export function StaffReceiptView() {
  const { user } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(formatLocalDate(new Date()));
  const [tagType, setTagType] = useState('shop_supplies');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    if (selected.size > MAX_FILE_BYTES) {
      setError('That file is over 10MB. Please choose a smaller one.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null);
    setError('');
    setSaved(false);
  };

  const resetForm = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setAmount('');
    setDescription('');
    setReceiptDate(formatLocalDate(new Date()));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError('Please enter the receipt amount.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('receipts').insert({
        user_id: user.id,
        receipt_url: urlData.publicUrl,
        amount: parsedAmount,
        description: description.trim() || null,
        tag_type: tagType,
        receipt_date: receiptDate,
      });
      if (insertError) throw insertError;

      resetForm();
      setSaved(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message ? `Could not upload the receipt: ${message}` : 'Could not upload the receipt. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="font-semibold">Upload a receipt</h2>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
      <input ref={libraryRef} type="file" accept="image/*,application/pdf" onChange={handleFileChange} className="hidden" />

      {previewUrl ? (
        <img src={previewUrl} alt="Receipt preview" className="w-full max-h-72 object-contain rounded-lg bg-slate-800" />
      ) : file ? (
        <div className="rounded-lg bg-slate-800 p-4 text-sm text-slate-300 break-all">{file.name}</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex flex-col items-center gap-2 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
        >
          <Camera className="w-6 h-6 text-amber-400" />
          <span className="text-sm">Take photo</span>
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          className="flex flex-col items-center gap-2 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
        >
          <ImagePlus className="w-6 h-6 text-amber-400" />
          <span className="text-sm">Choose file</span>
        </button>
      </div>

      {file && (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="text-slate-400">Amount</span>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={inputClass} required />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Date</span>
            <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} className={inputClass} required />
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">What is it for?</span>
            <select value={tagType} onChange={e => setTagType(e.target.value)} className={inputClass}>
              {TAG_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-400">Note (optional)</span>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className={inputClass} />
          </label>
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Submit receipt'}
          </button>
        </div>
      )}

      {saved && (
        <p className="flex items-center gap-2 text-emerald-400 text-sm">
          <CheckCircle2 className="w-4 h-4" /> Receipt submitted for review.
        </p>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </form>
  );
}
