import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Plus, Eye, Printer, Trash2, ArrowLeft, Upload, X, FileText, Save, CheckCircle, Video, ChevronDown, ChevronLeft, ChevronRight, Ship, User, Loader2 } from 'lucide-react';
import { supabase, SalvageReport, SalvageReportMedia } from '../lib/supabase';

interface SalvageReportsProps {
  userId: string;
  companyId: string;
  userRole: string;
  prefillEstimateId?: string;
}

const EMPTY_FORM = {
  estimate_id: '' as string,
  yacht_id: '' as string,
  vessel_name: '',
  owner_name: '',
  owner_phone: '',
  owner_email: '',
  owner_address: '',
  insurance_company: '',
  policy_number: '',
  claim_number: '',
  adjuster_name: '',
  adjuster_phone: '',
  adjuster_email: '',
  date_of_loss: '',
  date_of_service: '',
  gps_latitude: '',
  gps_longitude: '',
  vessel_depth: '',
  underwater_condition: '',
  vessel_description_prior: '',
  diesel_gallons: '',
  gas_gallons: '',
  findings: '',
  status: 'draft' as 'draft' | 'complete',
};

export function SalvageReports({ userId, companyId, userRole, prefillEstimateId }: SalvageReportsProps) {
  const [reports, setReports] = useState<SalvageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'form' | 'print'>('list');
  const [editingReport, setEditingReport] = useState<SalvageReport | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [media, setMedia] = useState<SalvageReportMedia[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadPending, setUploadPending] = useState(0);
  const [uploadCompleted, setUploadCompleted] = useState(0);
  const [printReport, setPrintReport] = useState<SalvageReport | null>(null);
  const [companyInfo, setCompanyInfo] = useState<{ name: string; logo_url?: string; tagline?: string; phone?: string; email?: string; address?: string } | null>(null);
  const [yachts, setYachts] = useState<{ id: string; name: string; manufacturer?: string | null; size?: string | null; hull_number?: string | null }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; first_name: string | null; last_name: string | null; business_name: string | null; email: string | null; phone: string | null; address_line1: string | null; city: string | null; state: string | null; zip_code: string | null }[]>([]);

  const isMaster = userRole === 'master';

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('salvage_reports')
        .select(`
          *,
          salvage_report_media(*),
          estimates(estimate_number, customer_name, customer_email, customer_phone, yachts(name))
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports((data as SalvageReport[]) || []);
    } catch (err) {
      console.error('Error loading salvage reports:', err);
      setError('Failed to load salvage reports');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadCompanyInfo = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('companies')
        .select('name, logo_url, tagline, phone, email, address_line1, city, state, zip_code')
        .eq('id', companyId)
        .maybeSingle();
      if (data) {
        const addr = [data.address_line1, data.city, data.state, data.zip_code].filter(Boolean).join(', ');
        setCompanyInfo({ name: data.name, logo_url: data.logo_url, tagline: data.tagline, phone: data.phone, email: data.email, address: addr });
      }
    } catch (err) {
      console.error('Error loading company info:', err);
    }
  }, [companyId]);

  const loadYachtsAndCustomers = useCallback(async () => {
    try {
      const [yachtRes, customerRes] = await Promise.all([
        supabase.from('yachts').select('id, name, manufacturer, size, hull_number').eq('is_active', true).eq('company_id', companyId).order('name'),
        supabase.from('customers').select('id, first_name, last_name, business_name, email, phone, address_line1, city, state, zip_code').eq('is_active', true).eq('company_id', companyId).order('first_name'),
      ]);
      if (yachtRes.data) setYachts(yachtRes.data as typeof yachts);
      if (customerRes.data) setCustomers(customerRes.data as typeof customers);
    } catch (err) {
      console.error('Error loading yachts/customers:', err);
    }
  }, [companyId]);

  useEffect(() => {
    loadReports();
    loadCompanyInfo();
    loadYachtsAndCustomers();
  }, [loadReports, loadCompanyInfo, loadYachtsAndCustomers]);

  useEffect(() => {
    if (prefillEstimateId && view === 'list') {
      handleCreateFromEstimate(prefillEstimateId);
    }
  }, [prefillEstimateId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredReports = reports.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.report_number?.toLowerCase().includes(s) ||
      r.vessel_name?.toLowerCase().includes(s) ||
      r.owner_name?.toLowerCase().includes(s) ||
      r.estimates?.estimate_number?.toLowerCase().includes(s)
    );
  });

  async function handleCreateFromEstimate(estimateId: string) {
    try {
      const { data: est, error: estErr } = await supabase
        .from('estimates')
        .select('id, estimate_number, customer_name, customer_email, customer_phone, yacht_id, yachts(name)')
        .eq('id', estimateId)
        .maybeSingle();
      if (estErr) throw estErr;

      const { data: reportNum } = await supabase.rpc('generate_salvage_report_number');

      const { data: newReport, error: createErr } = await supabase
        .from('salvage_reports')
        .insert({
          report_number: reportNum || 'SAL-0001',
          estimate_id: estimateId,
          company_id: companyId,
          yacht_id: est?.yacht_id || null,
          vessel_name: est?.yachts?.name || '',
          owner_name: est?.customer_name || '',
          owner_email: est?.customer_email || '',
          owner_phone: est?.customer_phone || '',
          created_by: userId,
          status: 'draft',
        })
        .select()
        .single();

      if (createErr) throw createErr;

      await loadReports();
      handleEdit(newReport as SalvageReport);
    } catch (err) {
      console.error('Error creating salvage report from estimate:', err);
      setError('Failed to create salvage report');
    }
  }

  function handleCreateNew() {
    setEditingReport(null);
    setForm({ ...EMPTY_FORM });
    setMedia([]);
    setError('');
    setSuccess(false);
    setView('form');
  }

  function handleSelectYacht(yachtId: string) {
    const yacht = yachts.find(y => y.id === yachtId);
    if (yacht) {
      setForm(prev => ({ ...prev, yacht_id: yacht.id, vessel_name: yacht.name }));
    } else {
      setForm(prev => ({ ...prev, yacht_id: '' }));
    }
  }

  function handleSelectCustomer(customerId: string) {
    const c = customers.find(c => c.id === customerId);
    if (c) {
      const name = c.business_name || [c.first_name, c.last_name].filter(Boolean).join(' ');
      const addr = [c.address_line1, c.city, c.state, c.zip_code].filter(Boolean).join(', ');
      setForm(prev => ({
        ...prev,
        owner_name: name,
        owner_phone: c.phone || prev.owner_phone,
        owner_email: c.email || prev.owner_email,
        owner_address: addr || prev.owner_address,
      }));
    }
  }

  function handleEdit(report: SalvageReport) {
    setEditingReport(report);
    setForm({
      estimate_id: report.estimate_id || '',
      yacht_id: report.yacht_id || '',
      vessel_name: report.vessel_name || '',
      owner_name: report.owner_name || '',
      owner_phone: report.owner_phone || '',
      owner_email: report.owner_email || '',
      owner_address: report.owner_address || '',
      insurance_company: report.insurance_company || '',
      policy_number: report.policy_number || '',
      claim_number: report.claim_number || '',
      adjuster_name: report.adjuster_name || '',
      adjuster_phone: report.adjuster_phone || '',
      adjuster_email: report.adjuster_email || '',
      date_of_loss: report.date_of_loss || '',
      date_of_service: report.date_of_service || '',
      gps_latitude: report.gps_latitude || '',
      gps_longitude: report.gps_longitude || '',
      vessel_depth: report.vessel_depth || '',
      underwater_condition: report.underwater_condition || '',
      vessel_description_prior: report.vessel_description_prior || '',
      diesel_gallons: report.diesel_gallons || '',
      gas_gallons: report.gas_gallons || '',
      findings: report.findings || '',
      status: report.status || 'draft',
    });
    setMedia(report.salvage_report_media || []);
    setError('');
    setSuccess(false);
    setView('form');
  }

  async function handleSave(markComplete = false) {
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        estimate_id: form.estimate_id || null,
        yacht_id: form.yacht_id || null,
        date_of_loss: form.date_of_loss || null,
        date_of_service: form.date_of_service || null,
        status: markComplete ? 'complete' : form.status,
        company_id: companyId,
      };

      if (editingReport) {
        const { error: updateErr } = await supabase
          .from('salvage_reports')
          .update(payload)
          .eq('id', editingReport.id);
        if (updateErr) throw updateErr;
      } else {
        const { data: reportNum } = await supabase.rpc('generate_salvage_report_number');
        const { data: newReport, error: createErr } = await supabase
          .from('salvage_reports')
          .insert({ ...payload, report_number: reportNum || 'SAL-0001', created_by: userId })
          .select()
          .single();
        if (createErr) throw createErr;
        setEditingReport(newReport as SalvageReport);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      await loadReports();
    } catch (err) {
      console.error('Error saving salvage report:', err);
      setError('Failed to save report');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reportId: string) {
    const report = reports.find(r => r.id === reportId);
    const label = report ? `${report.report_number} (${report.vessel_name || 'no vessel'})` : 'this report';
    if (!confirm(`Delete salvage report ${label}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.from('salvage_reports').delete().eq('id', reportId);
      if (error) throw error;
      await loadReports();
    } catch (err) {
      console.error('Error deleting report:', err);
      setError('Failed to delete report');
    }
  }

  async function handleUpload(files: File[], mediaType: 'photo_prior' | 'photo_loss' | 'video_loss') {
    if (!editingReport) return;
    setUploadingType(mediaType);
    setUploadPending(files.length);
    setUploadCompleted(0);
    let successCount = 0;
    let failCount = 0;
    const existingGroup = media.filter(m => m.media_type === mediaType);
    const maxSort = existingGroup.reduce((max, m) => Math.max(max, m.sort_order), -1);
    let sortOffset = 0;
    await Promise.allSettled(files.map(async (file) => {
      try {
        const ext = file.name.split('.').pop() || 'bin';
        const fileName = `${editingReport.id}/${mediaType}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('salvage-media')
          .upload(fileName, file, { upsert: false });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from('salvage-media').getPublicUrl(fileName);

        const sortOrder = maxSort + 1 + sortOffset;
        sortOffset++;

        const { data: newMedia, error: mediaErr } = await supabase
          .from('salvage_report_media')
          .insert({
            salvage_report_id: editingReport.id,
            media_type: mediaType,
            file_url: urlData.publicUrl,
            file_name: file.name,
            sort_order: sortOrder,
          })
          .select()
          .single();

        if (mediaErr) throw mediaErr;
        setMedia(prev => [...prev, newMedia as SalvageReportMedia]);
        successCount++;
      } catch (err) {
        console.error('Error uploading media:', err);
        failCount++;
      } finally {
        setUploadCompleted(prev => prev + 1);
      }
    }));
    setUploadPending(0);
    setUploadCompleted(0);
    setUploadingType(null);
    if (failCount > 0) {
      setError(`Failed to upload ${failCount} of ${files.length} file${files.length > 1 ? 's' : ''}`);
    }
  }

  async function handleMoveMedia(mediaId: string, direction: 'left' | 'right') {
    const item = media.find(m => m.id === mediaId);
    if (!item) return;
    const group = media.filter(m => m.media_type === item.media_type).sort((a, b) => a.sort_order - b.sort_order);
    const idx = group.findIndex(m => m.id === mediaId);
    if (direction === 'left' && idx <= 0) return;
    if (direction === 'right' && idx >= group.length - 1) return;
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    const swapItem = group[swapIdx];
    if (!swapItem) return;

    const prevMedia = media;
    setMedia(prev => prev.map(m => {
      if (m.id === mediaId) return { ...m, sort_order: swapItem.sort_order };
      if (m.id === swapItem.id) return { ...m, sort_order: item.sort_order };
      return m;
    }));

    try {
      const [r1, r2] = await Promise.all([
        supabase.from('salvage_report_media').update({ sort_order: swapItem.sort_order }).eq('id', mediaId),
        supabase.from('salvage_report_media').update({ sort_order: item.sort_order }).eq('id', swapItem.id),
      ]);
      if (r1.error || r2.error) {
        setMedia(prevMedia);
        setError('Failed to reorder photos. Please try again.');
      }
    } catch (err) {
      console.error('Error reordering media:', err);
      setMedia(prevMedia);
      setError('Failed to reorder photos. Please try again.');
    }
  }

  async function handleDeleteMedia(mediaId: string, fileUrl: string) {
    try {
      const filePath = fileUrl.split('/salvage-media/')[1];
      if (filePath) {
        await supabase.storage.from('salvage-media').remove([filePath]);
      }
      const { error } = await supabase.from('salvage_report_media').delete().eq('id', mediaId);
      if (error) throw error;
      setMedia(prev => prev.filter(m => m.id !== mediaId));
    } catch (err) {
      console.error('Error deleting media:', err);
    }
  }

  function handlePrint(report: SalvageReport) {
    setPrintReport(report);
    setView('print');
  }

  const photoPrior = media.filter(m => m.media_type === 'photo_prior').sort((a, b) => a.sort_order - b.sort_order);
  const photoLoss = media.filter(m => m.media_type === 'photo_loss').sort((a, b) => a.sort_order - b.sort_order);
  const videoLoss = media.filter(m => m.media_type === 'video_loss').sort((a, b) => a.sort_order - b.sort_order);

  // ── PRINT VIEW ──
  if (view === 'print' && printReport) {
    const r = printReport;
    const rMedia = r.salvage_report_media || [];
    const rPhotoPrior = rMedia.filter(m => m.media_type === 'photo_prior');
    const rPhotoLoss = rMedia.filter(m => m.media_type === 'photo_loss');
    const rVideoLoss = rMedia.filter(m => m.media_type === 'video_loss');

    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6 no-print">
            <button onClick={() => { setView('list'); setPrintReport(null); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
              <ArrowLeft className="w-5 h-5" /> Back to Reports
            </button>
            <button onClick={() => window.print()} className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              <Printer className="w-5 h-5" /> Print
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-12 print:p-0 print:shadow-none">
            {/* Company Header */}
            <div className="flex items-start justify-between border-b-2 border-gray-800 pb-6 mb-8">
              <div className="flex items-center gap-4">
                {companyInfo?.logo_url && (
                  <img src={companyInfo.logo_url} alt="logo" className="w-20 h-20 object-contain" />
                )}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{companyInfo?.name || ''}</h1>
                  {companyInfo?.tagline && <p className="text-sm text-gray-600">{companyInfo.tagline}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    {[companyInfo?.phone, companyInfo?.email].filter(Boolean).join(' | ')}
                  </p>
                  {companyInfo?.address && <p className="text-xs text-gray-500">{companyInfo.address}</p>}
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-gray-900">Salvage Service Report</h2>
                <p className="text-lg font-mono text-gray-700">{r.report_number}</p>
                <p className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Owner & Insurance */}
            <PrintSection title="Owner & Insurance Information">
              <PrintField label="Vessel Name" value={r.vessel_name} />
              <PrintField label="Owner Name" value={r.owner_name} />
              <PrintField label="Owner Phone" value={r.owner_phone} />
              <PrintField label="Owner Email" value={r.owner_email} />
              <PrintField label="Owner Address" value={r.owner_address} />
              <PrintField label="Insurance Company" value={r.insurance_company} />
              <PrintField label="Policy Number" value={r.policy_number} />
              <PrintField label="Claim Number" value={r.claim_number} />
              <PrintField label="Adjuster Name" value={r.adjuster_name} />
              <PrintField label="Adjuster Phone" value={r.adjuster_phone} />
              <PrintField label="Adjuster Email" value={r.adjuster_email} />
            </PrintSection>

            {/* Loss & Service Details */}
            <PrintSection title="Loss & Service Details">
              <PrintField label="Date of Loss" value={r.date_of_loss} />
              <PrintField label="Date of Service" value={r.date_of_service} />
              <PrintField label="GPS Latitude" value={r.gps_latitude} />
              <PrintField label="GPS Longitude" value={r.gps_longitude} />
              <PrintField label="Vessel Depth" value={r.vessel_depth} />
            </PrintSection>

            {/* Vessel Condition & Fuel */}
            <PrintSection title="Vessel Condition & Fuel">
              <PrintField label="Description Prior to Loss" value={r.vessel_description_prior} fullWidth />
              <PrintField label="Diesel Fuel (gallons)" value={r.diesel_gallons} />
              <PrintField label="Gasoline (gallons)" value={r.gas_gallons} />
            </PrintSection>

            {/* Findings */}
            {(r.findings || r.underwater_condition) && (
              <PrintSection title="Findings from Estimate">
                {r.underwater_condition && (
                  <div className="col-span-2 mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Underwater Condition</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.underwater_condition}</p>
                  </div>
                )}
                {r.findings && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Findings & Notes</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{r.findings}</p>
                  </div>
                )}
              </PrintSection>
            )}

            {/* Photos - Prior to Loss */}
            {rPhotoPrior.length > 0 && (
              <PrintSection title="Photos of Boat Prior to Loss">
                {rPhotoPrior.map(m => (
                  <div key={m.id} className="col-span-2 mb-4">
                    <img src={m.file_url} alt={m.caption || m.file_name} className="max-w-full h-auto rounded border border-gray-300" style={{ maxHeight: '400px' }} />
                    {m.caption && <p className="text-xs text-gray-600 mt-1">{m.caption}</p>}
                  </div>
                ))}
              </PrintSection>
            )}

            {/* Photos - Loss */}
            {rPhotoLoss.length > 0 && (
              <PrintSection title="Photos of the Loss">
                {rPhotoLoss.map(m => (
                  <div key={m.id} className="col-span-2 mb-4">
                    <img src={m.file_url} alt={m.caption || m.file_name} className="max-w-full h-auto rounded border border-gray-300" style={{ maxHeight: '400px' }} />
                    {m.caption && <p className="text-xs text-gray-600 mt-1">{m.caption}</p>}
                  </div>
                ))}
              </PrintSection>
            )}

            {/* Videos - Loss (thumbnail only in print) */}
            {rVideoLoss.length > 0 && (
              <PrintSection title="Videos of the Loss">
                {rVideoLoss.map(m => (
                  <div key={m.id} className="col-span-2 mb-4">
                    <div className="flex items-center gap-3 border border-gray-300 rounded-lg p-4">
                      <Video className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{m.file_name}</p>
                        {m.caption && <p className="text-xs text-gray-600">{m.caption}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </PrintSection>
            )}

            <div className="mt-12 pt-6 border-t border-gray-300 text-xs text-gray-500 text-center">
              Report #{r.report_number} | Generated {new Date().toLocaleDateString()} | {companyInfo?.name || ''}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM VIEW ──
  if (view === 'form') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => { setView('list'); setEditingReport(null); }} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium">
              <ArrowLeft className="w-5 h-5" /> Back to Reports
            </button>
            <h1 className="text-2xl font-bold text-gray-900">
              {editingReport ? `Edit ${editingReport.report_number}` : 'New Salvage Report'}
            </h1>
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}
          {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"><CheckCircle className="w-5 h-5" /> Report saved successfully.</div>}

          <div className="space-y-6">
            {/* Quick-fill from existing data */}
            <FormSection title="Quick Fill from Existing Data">
              <VesselPickerDropdown
                yachts={yachts}
                selectedId={form.yacht_id}
                onSelect={handleSelectYacht}
              />
              <CustomerPickerDropdown
                customers={customers}
                onSelect={handleSelectCustomer}
              />
            </FormSection>

            {/* Section: Owner & Insurance */}
            <FormSection title="Owner & Insurance Information">
              <FormField label="Vessel Name" value={form.vessel_name} onChange={v => setForm({ ...form, vessel_name: v, yacht_id: '' })} />
              <FormField label="Owner Name" value={form.owner_name} onChange={v => setForm({ ...form, owner_name: v })} />
              <FormField label="Owner Phone" value={form.owner_phone} onChange={v => setForm({ ...form, owner_phone: v })} />
              <FormField label="Owner Email" value={form.owner_email} onChange={v => setForm({ ...form, owner_email: v })} />
              <FormField label="Owner Address" value={form.owner_address} onChange={v => setForm({ ...form, owner_address: v })} fullWidth />
              <FormField label="Insurance Company" value={form.insurance_company} onChange={v => setForm({ ...form, insurance_company: v })} />
              <FormField label="Policy Number" value={form.policy_number} onChange={v => setForm({ ...form, policy_number: v })} />
              <FormField label="Claim Number" value={form.claim_number} onChange={v => setForm({ ...form, claim_number: v })} />
              <FormField label="Adjuster Name" value={form.adjuster_name} onChange={v => setForm({ ...form, adjuster_name: v })} />
              <FormField label="Adjuster Phone" value={form.adjuster_phone} onChange={v => setForm({ ...form, adjuster_phone: v })} />
              <FormField label="Adjuster Email" value={form.adjuster_email} onChange={v => setForm({ ...form, adjuster_email: v })} />
            </FormSection>

            {/* Section: Loss & Service Details */}
            <FormSection title="Loss & Service Details">
              <FormField label="Date of Loss" type="date" value={form.date_of_loss} onChange={v => setForm({ ...form, date_of_loss: v })} />
              <FormField label="Date of Service" type="date" value={form.date_of_service} onChange={v => setForm({ ...form, date_of_service: v })} />
              <FormField label="GPS Latitude" value={form.gps_latitude} onChange={v => setForm({ ...form, gps_latitude: v })} placeholder="e.g., 36.9147" />
              <FormField label="GPS Longitude" value={form.gps_longitude} onChange={v => setForm({ ...form, gps_longitude: v })} placeholder="e.g., -111.4558" />
              <FormField label="Vessel Depth" value={form.vessel_depth} onChange={v => setForm({ ...form, vessel_depth: v })} placeholder="e.g., 45 feet" />
            </FormSection>

            {/* Section: Vessel Condition & Fuel */}
            <FormSection title="Vessel Condition & Fuel">
              <FormField label="Description of Boat Prior to Loss" value={form.vessel_description_prior} onChange={v => setForm({ ...form, vessel_description_prior: v })} fullWidth textarea placeholder="Overall description of the boat's condition prior to the loss..." />
              <FormField label="Diesel Fuel (gallons)" value={form.diesel_gallons} onChange={v => setForm({ ...form, diesel_gallons: v })} />
              <FormField label="Gasoline (gallons)" value={form.gas_gallons} onChange={v => setForm({ ...form, gas_gallons: v })} />
            </FormSection>

            {/* Section: Findings */}
            <FormSection title="Findings from Estimate">
              <FormField label="Underwater Condition" value={form.underwater_condition} onChange={v => setForm({ ...form, underwater_condition: v })} fullWidth textarea placeholder="Describe the condition of the vessel underwater..." />
              <FormField label="Findings & Notes" value={form.findings} onChange={v => setForm({ ...form, findings: v })} fullWidth textarea placeholder="Findings and notes drawn from the estimate..." />
            </FormSection>

            {/* Section: Media Attachments */}
            {editingReport && (
              <FormSection title="Media Attachments">
                <MediaUploadSection
                  label="Photos of Boat Prior to Loss"
                  accept="image/*"
                  items={photoPrior}
                  onUpload={files => handleUpload(files, 'photo_prior')}
                  onDelete={id => handleDeleteMedia(id, photoPrior.find(m => m.id === id)?.file_url || '')}
                  onMove={(id, dir) => handleMoveMedia(id, dir)}
                  uploading={uploadingType === 'photo_prior'}
                  isVideo={false}
                  pendingCount={uploadingType === 'photo_prior' ? uploadPending : 0}
                  completedCount={uploadingType === 'photo_prior' ? uploadCompleted : 0}
                />
                <MediaUploadSection
                  label="Photos of the Loss"
                  accept="image/*"
                  items={photoLoss}
                  onUpload={files => handleUpload(files, 'photo_loss')}
                  onDelete={id => handleDeleteMedia(id, photoLoss.find(m => m.id === id)?.file_url || '')}
                  onMove={(id, dir) => handleMoveMedia(id, dir)}
                  uploading={uploadingType === 'photo_loss'}
                  isVideo={false}
                  pendingCount={uploadingType === 'photo_loss' ? uploadPending : 0}
                  completedCount={uploadingType === 'photo_loss' ? uploadCompleted : 0}
                />
                <MediaUploadSection
                  label="Videos of the Loss"
                  accept="video/*"
                  items={videoLoss}
                  onUpload={files => handleUpload(files, 'video_loss')}
                  onDelete={id => handleDeleteMedia(id, videoLoss.find(m => m.id === id)?.file_url || '')}
                  onMove={(id, dir) => handleMoveMedia(id, dir)}
                  uploading={uploadingType === 'video_loss'}
                  isVideo={true}
                  pendingCount={uploadingType === 'video_loss' ? uploadPending : 0}
                  completedCount={uploadingType === 'video_loss' ? uploadCompleted : 0}
                />
              </FormSection>
            )}

            {!editingReport && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                Save the report first to upload photos and videos.
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                <Save className="w-5 h-5" />
                {saving ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                <CheckCircle className="w-5 h-5" />
                {saving ? 'Saving...' : 'Mark Complete'}
              </button>
              {editingReport && (
                <button
                  onClick={() => handlePrint(editingReport)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >
                  <Printer className="w-5 h-5" /> Print
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salvage Service Reports</h1>
            <p className="text-gray-600 text-sm mt-1">Manage salvage and recovery service reports</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            <Plus className="w-5 h-5" /> New Report
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by report number, vessel name, or owner..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No salvage reports yet. Click "New Report" to create one.</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Report #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Vessel</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Owner</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Estimate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Date of Loss</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReports.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{r.report_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.vessel_name || r.yachts?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.owner_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.estimates?.estimate_number || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{r.date_of_loss || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.status === 'complete' ? 'Complete' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePrint(r)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                        {isMaster && (
                          <>
                            <div className="w-px h-5 bg-gray-300 mx-1" />
                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper Components ──

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function FormField({
  label, value, onChange, type = 'text', fullWidth = false, textarea = false, placeholder = '',
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  fullWidth?: boolean; textarea?: boolean; placeholder?: string;
}) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
        />
      )}
    </div>
  );
}

function MediaUploadSection({
  label, accept, items, onUpload, onDelete, onMove, uploading, isVideo, pendingCount, completedCount,
}: {
  label: string; accept: string; items: SalvageReportMedia[];
  onUpload: (files: File[]) => void; onDelete: (id: string) => void;
  onMove: (id: string, direction: 'left' | 'right') => void;
  uploading: boolean; isVideo: boolean; pendingCount?: number; completedCount?: number;
}) {
  const pct = uploading && pendingCount && pendingCount > 0
    ? Math.round(((completedCount || 0) / pendingCount) * 100)
    : 0;
  return (
    <div className="md:col-span-2 mb-4 last:mb-0">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-wrap gap-3 mb-3">
        {items.map((m, idx) => (
          <div key={m.id} className="relative group">
            {isVideo ? (
              <div className="w-32 h-24 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                <Video className="w-8 h-8 text-gray-400" />
              </div>
            ) : (
              <img src={m.file_url} alt={m.caption || m.file_name} className="w-32 h-24 object-cover rounded-lg border border-gray-300" />
            )}
            <button
              onClick={() => onDelete(m.id)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
            {items.length > 1 && (
              <div className="absolute -top-2 -left-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onMove(m.id, 'left')}
                  disabled={idx === 0}
                  className="bg-white text-gray-700 rounded-full p-1 shadow-sm border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onMove(m.id, 'right')}
                  disabled={idx === items.length - 1}
                  className="bg-white text-gray-700 rounded-full p-1 shadow-sm border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1 w-32 truncate">{m.file_name}</p>
          </div>
        ))}
      </div>
      <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer text-sm font-medium transition-colors ${uploading ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {pendingCount && pendingCount > 1
              ? `Uploading ${completedCount || 0}/${pendingCount} files...`
              : 'Uploading...'}
          </>
        ) : (<> <Upload className="w-4 h-4" /> Upload {isVideo ? 'Videos' : 'Photos'}</>)}
        <input
          type="file"
          accept={accept}
          multiple
          className="hidden"
          disabled={uploading}
          onChange={e => { const fs = Array.from(e.target.files || []); if (fs.length) onUpload(fs); e.target.value = ''; }}
        />
      </label>
      {uploading && pendingCount && pendingCount > 0 && (
        <div className="mt-2 w-64">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{pct}% complete</p>
        </div>
      )}
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2 mb-4">{title}</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </div>
  );
}

function PrintField({ label, value, fullWidth = false }: { label: string; value: string | null | undefined; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-2' : ''}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 whitespace-pre-wrap">{value || '—'}</p>
    </div>
  );
}

function VesselPickerDropdown({
  yachts, selectedId, onSelect,
}: {
  yachts: { id: string; name: string; manufacturer?: string | null; size?: string | null; hull_number?: string | null }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = yachts.filter(y =>
    y.name.toLowerCase().includes(query.toLowerCase()) ||
    (y.manufacturer || '').toLowerCase().includes(query.toLowerCase()) ||
    (y.hull_number || '').toLowerCase().includes(query.toLowerCase())
  );

  const selected = yachts.find(y => y.id === selectedId);

  return (
    <div ref={ref}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <Ship className="w-4 h-4 inline mr-1 text-gray-400" />
        Select Vessel from Fleet
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-blue-400 transition-colors"
        >
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected ? selected.name : 'Search fleet vessels...'}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-2 border-b border-gray-200 text-sm focus:outline-none"
            />
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">No vessels found</p>
            ) : (
              filtered.map(y => (
                <button
                  key={y.id}
                  type="button"
                  onClick={() => { onSelect(y.id); setOpen(false); setQuery(''); }}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-900">{y.name}</p>
                  <p className="text-xs text-gray-500">
                    {[y.manufacturer, y.size, y.hull_number && `Hull: ${y.hull_number}`].filter(Boolean).join(' • ')}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerPickerDropdown({
  customers, onSelect,
}: {
  customers: { id: string; first_name: string | null; last_name: string | null; business_name: string | null; email: string | null; phone: string | null; address_line1: string | null; city: string | null; state: string | null; zip_code: string | null }[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function custName(c: typeof customers[0]) {
    return c.business_name || [c.first_name, c.last_name].filter(Boolean).join(' ');
  }

  const filtered = customers.filter(c =>
    custName(c).toLowerCase().includes(query.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(query.toLowerCase()) ||
    (c.phone || '').includes(query)
  );

  return (
    <div ref={ref}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <User className="w-4 h-4 inline mr-1 text-gray-400" />
        Select Owner from Customer Database
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-left flex items-center justify-between hover:border-blue-400 transition-colors"
        >
          <span className="text-gray-400">Search customers...</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search by name, email, or phone..."
              className="w-full px-3 py-2 border-b border-gray-200 text-sm focus:outline-none"
            />
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">No customers found</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onSelect(c.id); setOpen(false); setQuery(''); }}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <p className="text-sm font-medium text-gray-900">{custName(c)}</p>
                  <p className="text-xs text-gray-500">
                    {[c.phone, c.email].filter(Boolean).join(' • ')}
                  </p>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">Selecting a customer auto-fills owner name, phone, email, and address.</p>
    </div>
  );
}
