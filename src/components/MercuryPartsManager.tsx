import React, { useState, useEffect } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle, X, Search, Filter, Eye, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { parseMercuryASCIIFile, generateImportSummary, type MercuryPart, type ParseResult } from '../utils/mercuryParser';
import { isMasterRole } from '../lib/supabase';

interface MercuryPartsManagerProps {
  userId: string;
  userRole: string;
}

interface ImportHistory {
  id: string;
  file_name: string;
  uploaded_at: string;
  total_parts_imported: number;
  total_parts_updated: number;
  status: string;
  error_message: string | null;
  file_size_bytes: number;
  processing_time_seconds: number;
  uploader_name: string;
}

interface MercuryPartRow {
  id: string;
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
  is_active: boolean;
  import_batch_id: string;
  created_at: string;
}

export function MercuryPartsManager({ userId, userRole }: MercuryPartsManagerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'browse'>('upload');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mercuryParts, setMercuryParts] = useState<MercuryPartRow[]>([]);
  const [selectedPart, setSelectedPart] = useState<MercuryPartRow | null>(null);
  const [showPartDetails, setShowPartDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  const isMaster = isMasterRole(userRole as any);

  useEffect(() => {
    if (isMaster) {
      fetchImportHistory();
    }
    if (activeTab === 'browse') {
      fetchMercuryParts();
    }
  }, [activeTab, isMaster]);

  async function fetchImportHistory() {
    try {
      const { data, error } = await supabase
        .from('mercury_price_list_imports')
        .select(`
          id,
          file_name,
          uploaded_at,
          total_parts_imported,
          total_parts_updated,
          status,
          error_message,
          file_size_bytes,
          processing_time_seconds,
          uploader:user_profiles!mercury_price_list_imports_uploaded_by_fkey(first_name, last_name)
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      const formattedHistory = data.map((item: any) => ({
        ...item,
        uploader_name: item.uploader ? `${item.uploader.first_name} ${item.uploader.last_name}` : 'Unknown'
      }));

      setImportHistory(formattedHistory);
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  }

  async function fetchMercuryParts() {
    try {
      setLoading(true);
      let query = supabase
        .from('mercury_marine_parts')
        .select('*')
        .order('part_number', { ascending: true });

      if (searchTerm) {
        query = query.or(`part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          query = query.eq('is_active', true);
        } else if (statusFilter === 'inactive') {
          query = query.eq('is_active', false);
        } else {
          query = query.eq('item_status', statusFilter);
        }
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      setMercuryParts(data || []);
    } catch (error) {
      console.error('Error fetching Mercury parts:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setParseResult(null);
      setShowPreview(false);
    }
  }

  async function handleParseFile() {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      const result = await parseMercuryASCIIFile(selectedFile);
      setParseResult(result);
      setShowPreview(true);
      setUploadProgress(100);
    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Error parsing file. Please check the file format.');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmImport() {
    if (!parseResult || !selectedFile) return;

    setUploading(true);
    const startTime = Date.now();

    try {
      // Create import record
      const { data: importRecord, error: importError } = await supabase
        .from('mercury_price_list_imports')
        .insert({
          file_name: selectedFile.name,
          uploaded_by: userId,
          file_size_bytes: selectedFile.size,
          status: 'processing'
        })
        .select()
        .single();

      if (importError) throw importError;

      setUploadProgress(5);

      const { error: deleteError } = await supabase.rpc('truncate_mercury_marine_parts');

      if (deleteError) {
        console.error('Error clearing old parts:', deleteError);
        throw new Error('Failed to clear existing parts');
      }

      setUploadProgress(10);

      // Insert new parts in batches
      const partsToInsert = parseResult.parts.map(part => ({
        ...part,
        import_batch_id: importRecord.id
      }));

      const batchSize = 100;
      let imported = 0;

      for (let i = 0; i < partsToInsert.length; i += batchSize) {
        const batch = partsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('mercury_marine_parts')
          .insert(batch);

        if (insertError) {
          console.error('Error inserting batch:', insertError);
        } else {
          imported += batch.length;
        }

        setUploadProgress(10 + Math.round((i / partsToInsert.length) * 85));
      }

      const processingTime = Math.round((Date.now() - startTime) / 1000);

      setUploadProgress(95);

      await supabase
        .from('mercury_price_list_imports')
        .update({
          status: 'success',
          total_parts_imported: imported,
          processing_time_seconds: processingTime
        })
        .eq('id', importRecord.id);

      setUploadProgress(100);

      alert(`Successfully imported ${imported} Mercury Marine parts!\n\nAll previous parts have been replaced with the new data.`);
      setSelectedFile(null);
      setParseResult(null);
      setShowPreview(false);
      setUploadProgress(0);
      fetchImportHistory();
    } catch (error) {
      console.error('Error importing parts:', error);
      alert('Error importing parts. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleCancelImport() {
    setSelectedFile(null);
    setParseResult(null);
    setShowPreview(false);
    setUploadProgress(0);
  }

  function viewPartDetails(part: MercuryPartRow) {
    setSelectedPart(part);
    setShowPartDetails(true);
  }

  async function togglePartActive(partId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('mercury_marine_parts')
        .update({ is_active: !currentStatus })
        .eq('id', partId);

      if (error) throw error;

      fetchMercuryParts();
    } catch (error) {
      console.error('Error toggling part status:', error);
      alert('Error updating part status');
    }
  }

  if (!isMaster) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-700">
          Only Master users can upload and manage Mercury Marine price lists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'upload'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload Price List
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Import History
        </button>
        <button
          onClick={() => setActiveTab('browse')}
          className={`px-4 py-2 font-medium border-b-2 ${
            activeTab === 'browse'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Browse Parts
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Mercury Marine ASCII File Format</h3>
            <p className="text-sm text-blue-800 mb-3">
              Upload the Mercury Marine parts price list in ASCII fixed-width format.
              The file should contain fields for part number, description, MSRP, dealer price, and other part details.
            </p>

            <div className="bg-white bg-opacity-50 rounded p-3 mb-3">
              <h4 className="font-medium text-blue-900 text-sm mb-1">How to export from Mercury Marine:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Go to Mercury Electronic Parts Catalog</li>
                <li>2. Navigate to the pricebook export section</li>
                <li>3. Select: <strong>MSRP - USD</strong> and <strong>DEALER - USD</strong></li>
                <li>4. Choose: <strong>Fixed width (default)</strong></li>
                <li>5. Select: <strong>Full</strong> price data</li>
                <li>6. Click Export/Download - creates a <strong>.lku</strong> file</li>
              </ol>
            </div>

            <div className="bg-white bg-opacity-50 rounded p-3">
              <h4 className="font-medium text-blue-900 text-sm mb-1">Expected format:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• File extension: .lku, .txt, or .ascii</li>
                <li>• Part numbers like: 8M0173572, 91-8M0083982, 892-47089A06, or MPNU format (e.g., 2168-9378M)</li>
                <li>• Full descriptions (30+ characters)</li>
                <li>• MSRP and dealer pricing included</li>
              </ul>
            </div>

            <p className="text-sm text-blue-800 mt-3 font-medium">
              Important: Uploading will replace all existing parts. Preview your data before confirming!
            </p>
          </div>

          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Mercury Price List File (.lku, .txt)
            </label>
            <input
              type="file"
              accept=".lku,.txt,.ascii"
              onChange={handleFileSelect}
              disabled={uploading}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
            />
            {selectedFile && (
              <div className="mt-3 text-sm text-gray-600">
                <p>File: {selectedFile.name}</p>
                <p>Size: {(selectedFile.size / 1024).toFixed(2)} KB</p>
              </div>
            )}

            {selectedFile && !showPreview && (
              <button
                onClick={handleParseFile}
                disabled={uploading}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Parse File
              </button>
            )}
          </div>

          {uploading && (
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <div className="mb-2 text-sm font-medium text-gray-700">
                Processing... {uploadProgress}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {showPreview && parseResult && (
            <div className="bg-white border border-gray-300 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Import Preview</h3>
                <button
                  onClick={handleCancelImport}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                  {generateImportSummary(parseResult)}
                </pre>
              </div>

              {parseResult.parts.length > 0 && (() => {
                const sampleParts = parseResult.parts.slice(0, 20);
                const hasValidFormat = sampleParts.some(part =>
                  (/^\d+[A-Z]?\d+[A-Z]?/.test(part.part_number) || /^\d{4}-\w+/.test(part.part_number)) &&
                  part.description.length > 20 &&
                  part.msrp > 0
                );
                const hasDescriptions = sampleParts.every(part => part.description.length > 15);
                const avgDescLength = sampleParts.reduce((acc, p) => acc + p.description.length, 0) / sampleParts.length;
                const hasPricing = sampleParts.filter(p => p.msrp > 0).length > sampleParts.length * 0.5;

                return (
                  <>
                    {!hasValidFormat && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                        <div className="flex items-start">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-yellow-900 mb-2">Data Format Warning</h4>
                            <p className="text-sm text-yellow-800 mb-2">
                              The parsed data may not be in the correct format. Mercury Marine part numbers typically:
                            </p>
                            <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                              <li>Start with numbers (e.g., 8M0173572, 91-8M0083982) or item class prefix (e.g., 2168-9378M)</li>
                              <li>Have descriptions longer than 20 characters (avg: {Math.round(avgDescLength)} chars detected)</li>
                              <li>Include pricing information ({Math.round((sampleParts.filter(p => p.msrp > 0).length / sampleParts.length) * 100)}% have prices)</li>
                            </ul>
                            <p className="text-sm text-yellow-800 mt-2 font-medium">
                              Please verify this is the correct Mercury Marine ASCII price list file before importing.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {hasValidFormat && (
                      <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-4">
                        <div className="flex items-start">
                          <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-green-900 mb-1">Data Format Looks Good</h4>
                            <p className="text-sm text-green-800">
                              Part numbers and descriptions appear to be in the correct Mercury Marine format.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <h4 className="font-medium text-gray-900 mb-2">Preview (First 20 parts)</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Part Number</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">MSRP</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Dealer</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Superseded</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sampleParts.map((part, idx) => (
                            <tr key={idx} className={!hasValidFormat ? 'bg-yellow-50' : ''}>
                              <td className="px-3 py-2 text-sm font-mono text-gray-900">{part.part_number}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">{part.description}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${part.msrp.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-900">${part.dealer_price.toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{part.item_status}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{part.superseded_part_number || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-medium text-blue-900 mb-2">Before Importing:</h5>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• This will replace all existing Mercury Marine parts in the database</li>
                        <li>• Existing estimates will not be affected and will retain their original pricing</li>
                        <li>• New estimates will use the updated parts and pricing</li>
                        <li>• Import cannot be undone - ensure the data looks correct above</li>
                      </ul>
                    </div>

                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={handleConfirmImport}
                        disabled={uploading}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium"
                      >
                        <CheckCircle className="w-4 h-4 inline mr-2" />
                        Confirm Import ({parseResult.parts.length.toLocaleString()} parts)
                      </button>
                      <button
                        onClick={handleCancelImport}
                        disabled={uploading}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Import Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">File Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Uploaded By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Parts Imported</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500">Processing Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {importHistory.map((record) => (
                <tr key={record.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {new Date(record.uploaded_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.file_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.uploader_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.total_parts_imported}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'success'
                          ? 'bg-green-100 text-green-800'
                          : record.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {record.processing_time_seconds}s
                  </td>
                </tr>
              ))}
              {importHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No import history yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'browse' && (
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by part number or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="ACT">ACT</option>
              <option value="SS">Superseded</option>
              <option value="NLA">No Longer Available</option>
            </select>
            <button
              onClick={fetchMercuryParts}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Search className="w-4 h-4 inline mr-2" />
              Search
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Part Number</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">MSRP</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {mercuryParts.map((part) => (
                    <tr key={part.id}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{part.part_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{part.description}</td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">${part.msrp.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{part.item_status}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            part.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {part.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => viewPartDetails(part)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          <Eye className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => togglePartActive(part.id, part.is_active)}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {mercuryParts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No parts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showPartDetails && selectedPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Mercury Part Details</h3>
              <button
                onClick={() => setShowPartDetails(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Part Number</label>
                  <p className="text-gray-900 font-medium">{selectedPart.part_number}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Item Class</label>
                  <p className="text-gray-900">{selectedPart.item_class}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900">{selectedPart.description}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">MSRP</label>
                  <p className="text-gray-900 font-semibold text-green-600">${selectedPart.msrp.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Dealer Price</label>
                  <p className="text-gray-900">${selectedPart.dealer_price.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <p className="text-gray-900">{selectedPart.item_status}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Pack Quantity</label>
                  <p className="text-gray-900">{selectedPart.pack_quantity}</p>
                </div>
                {selectedPart.superseded_part_number && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500">Superseded Part Number</label>
                    <p className="text-gray-900">{selectedPart.superseded_part_number}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Weight</label>
                  <p className="text-gray-900">{selectedPart.weight_lbs} lbs {selectedPart.weight_oz} oz</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Dimensions (L x W x H)</label>
                  <p className="text-gray-900">
                    {selectedPart.unit_length}" x {selectedPart.unit_width}" x {selectedPart.unit_height}"
                  </p>
                </div>
                {selectedPart.upc_code && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">UPC Code</label>
                    <p className="text-gray-900">{selectedPart.upc_code}</p>
                  </div>
                )}
                {selectedPart.core_charge > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Core Charge</label>
                    <p className="text-gray-900">${selectedPart.core_charge.toFixed(2)}</p>
                  </div>
                )}
                {selectedPart.container_charge > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Container Charge</label>
                    <p className="text-gray-900">${selectedPart.container_charge.toFixed(2)}</p>
                  </div>
                )}
                {selectedPart.hazardous_code && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Hazardous Code</label>
                    <p className="text-gray-900">{selectedPart.hazardous_code}</p>
                  </div>
                )}
                {selectedPart.ca_proposition_65 && (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-500">CA Proposition 65</label>
                    <p className="text-gray-900">{selectedPart.ca_proposition_65}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
