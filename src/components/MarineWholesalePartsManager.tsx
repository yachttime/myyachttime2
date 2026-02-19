import React, { useState, useEffect } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, Search, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isMasterRole } from '../lib/supabase';

interface MarineWholesalePartsManagerProps {
  userId: string;
  userRole: string;
}

interface ImportHistory {
  id: string;
  file_name: string;
  uploaded_at: string;
  total_parts_imported: number;
  status: string;
  error_message: string | null;
  file_size_bytes: number;
  processing_time_seconds: number;
  uploader_name: string;
}

interface MarineWholesalePart {
  id: string;
  sku: string;
  mfg_part_number: string;
  description: string;
  unit_of_measure: string;
  list_price: number;
  cost: number;
  is_active: boolean;
  created_at: string;
}

interface ParsedPart {
  sku: string;
  mfg_part_number: string;
  description: string;
  unit_of_measure: string;
  list_price: number;
  cost: number;
}

interface ParseResult {
  parts: ParsedPart[];
  errors: string[];
  totalRows: number;
  skippedRows: number;
}

function parseMarineWholesaleCSV(content: string): ParseResult {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const parts: ParsedPart[] = [];
  const errors: string[] = [];
  let skippedRows = 0;

  if (lines.length === 0) {
    return { parts, errors: ['File is empty'], totalRows: 0, skippedRows: 0 };
  }

  // Detect header row — skip it if first column looks like "SKU" or "sku"
  let startIndex = 0;
  const firstLine = lines[0].toLowerCase();
  if (firstLine.startsWith('sku') || firstLine.includes('description') || firstLine.includes('mfg')) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    // Parse CSV respecting quoted fields
    const cols = parseCSVLine(line);

    if (cols.length < 4) {
      skippedRows++;
      continue;
    }

    const sku = cols[0]?.trim() || '';
    const mfgPartNumber = cols[1]?.trim() || '';
    const description = cols[2]?.trim() || '';
    const unitOfMeasure = cols[3]?.trim() || '';
    const listRaw = cols[4]?.trim().replace(/[$,]/g, '') || '0';
    const costRaw = cols[5]?.trim().replace(/[$,]/g, '') || '0';

    if (!sku && !mfgPartNumber) {
      skippedRows++;
      continue;
    }

    const listPrice = parseFloat(listRaw) || 0;
    const cost = parseFloat(costRaw) || 0;

    parts.push({
      sku,
      mfg_part_number: mfgPartNumber,
      description,
      unit_of_measure: unitOfMeasure,
      list_price: listPrice,
      cost,
    });
  }

  return {
    parts,
    errors,
    totalRows: lines.length - startIndex,
    skippedRows,
  };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function MarineWholesalePartsManager({ userId, userRole }: MarineWholesalePartsManagerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'history' | 'browse'>('upload');
  const [searchTerm, setSearchTerm] = useState('');
  const [parts, setParts] = useState<MarineWholesalePart[]>([]);
  const [selectedPart, setSelectedPart] = useState<MarineWholesalePart | null>(null);
  const [showPartDetails, setShowPartDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isMaster = isMasterRole(userRole as any);

  useEffect(() => {
    if (isMaster) {
      fetchImportHistory();
    }
    if (activeTab === 'browse') {
      fetchParts();
    }
  }, [activeTab, isMaster]);

  async function fetchImportHistory() {
    try {
      const { data, error } = await supabase
        .from('marine_wholesale_imports')
        .select(`
          id,
          file_name,
          uploaded_at,
          total_parts_imported,
          status,
          error_message,
          file_size_bytes,
          processing_time_seconds,
          uploader:user_profiles!marine_wholesale_imports_uploaded_by_fkey(first_name, last_name)
        `)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      setImportHistory((data || []).map((item: any) => ({
        ...item,
        uploader_name: item.uploader ? `${item.uploader.first_name} ${item.uploader.last_name}` : 'Unknown',
      })));
    } catch (error) {
      console.error('Error fetching import history:', error);
    }
  }

  async function fetchParts() {
    try {
      setLoading(true);
      let query = supabase
        .from('marine_wholesale_parts')
        .select('*')
        .order('sku', { ascending: true });

      if (searchTerm) {
        query = query.or(`sku.ilike.%${searchTerm}%,mfg_part_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      setParts(data || []);
    } catch (error) {
      console.error('Error fetching Marine Wholesale parts:', error);
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
      const content = await selectedFile.text();
      const result = parseMarineWholesaleCSV(content);
      setParseResult(result);
      setShowPreview(true);
      setUploadProgress(100);
    } catch (error) {
      console.error('Error parsing file:', error);
      setErrorMessage('Error parsing file. Please check the file format.');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirmImport() {
    if (!parseResult || !selectedFile) return;
    setUploading(true);
    const startTime = Date.now();

    try {
      const { data: importRecord, error: importError } = await supabase
        .from('marine_wholesale_imports')
        .insert({
          file_name: selectedFile.name,
          uploaded_by: userId,
          file_size_bytes: selectedFile.size,
          status: 'processing',
        })
        .select()
        .single();

      if (importError) throw importError;

      setUploadProgress(5);

      const { error: deleteError } = await supabase
        .from('marine_wholesale_parts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw new Error('Failed to clear existing parts');

      setUploadProgress(10);

      const partsToInsert = parseResult.parts.map(part => ({
        ...part,
        import_batch_id: importRecord.id,
      }));

      const batchSize = 200;
      let imported = 0;

      for (let i = 0; i < partsToInsert.length; i += batchSize) {
        const batch = partsToInsert.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('marine_wholesale_parts')
          .insert(batch);

        if (!insertError) imported += batch.length;

        setUploadProgress(10 + Math.round((i / partsToInsert.length) * 85));
      }

      const processingTime = Math.round((Date.now() - startTime) / 1000);
      setUploadProgress(95);

      await supabase
        .from('marine_wholesale_imports')
        .update({
          status: 'success',
          total_parts_imported: imported,
          processing_time_seconds: processingTime,
        })
        .eq('id', importRecord.id);

      setUploadProgress(100);

      setSuccessMessage(`Successfully imported ${imported.toLocaleString()} Marine Wholesale parts! All previous parts have been replaced with the new data.`);
      setSelectedFile(null);
      setParseResult(null);
      setShowPreview(false);
      setUploadProgress(0);
      fetchImportHistory();
    } catch (error) {
      console.error('Error importing parts:', error);
      setErrorMessage('Error importing parts. Please try again.');
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

  if (!isMaster) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Access Restricted</h3>
        <p className="text-gray-700">
          Only Master users can upload and manage Marine Wholesale price lists.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-gray-200">
        {(['upload', 'history', 'browse'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium border-b-2 capitalize ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'upload' && <Upload className="w-4 h-4 inline mr-2" />}
            {tab === 'history' && <FileText className="w-4 h-4 inline mr-2" />}
            {tab === 'browse' && <Search className="w-4 h-4 inline mr-2" />}
            {tab === 'upload' ? 'Upload Price List' : tab === 'history' ? 'Import History' : 'Browse Parts'}
          </button>
        ))}
      </div>

      {successMessage && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-300 rounded-lg p-4">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 flex-1">{successMessage}</p>
          <button onClick={() => setSuccessMessage(null)} className="text-green-600 hover:text-green-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-300 rounded-lg p-4">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800 flex-1">{errorMessage}</p>
          <button onClick={() => setErrorMessage(null)} className="text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Marine Wholesale CSV Format</h3>
            <p className="text-sm text-blue-800 mb-3">
              Upload the Marine Wholesale parts price list in CSV (.csv) format exported from the Excel spreadsheet.
            </p>

            <div className="bg-white bg-opacity-50 rounded p-3 mb-3">
              <h4 className="font-medium text-blue-900 text-sm mb-2">Expected column layout:</h4>
              <div className="overflow-x-auto">
                <table className="text-xs text-blue-800 border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="px-2 py-1 border border-blue-200 text-left">Column A</th>
                      <th className="px-2 py-1 border border-blue-200 text-left">Column B</th>
                      <th className="px-2 py-1 border border-blue-200 text-left">Column C</th>
                      <th className="px-2 py-1 border border-blue-200 text-left">Column D</th>
                      <th className="px-2 py-1 border border-blue-200 text-left">Column E</th>
                      <th className="px-2 py-1 border border-blue-200 text-left">Column F</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-2 py-1 border border-blue-200">SKU</td>
                      <td className="px-2 py-1 border border-blue-200">Mfg Part #</td>
                      <td className="px-2 py-1 border border-blue-200">Description</td>
                      <td className="px-2 py-1 border border-blue-200">Stk U/M</td>
                      <td className="px-2 py-1 border border-blue-200">List</td>
                      <td className="px-2 py-1 border border-blue-200">Cost</td>
                    </tr>
                    <tr className="bg-blue-50">
                      <td className="px-2 py-1 border border-blue-200 font-mono">ACD41-101</td>
                      <td className="px-2 py-1 border border-blue-200 font-mono">41-101</td>
                      <td className="px-2 py-1 border border-blue-200">IRIDIUM SPARK PLUG</td>
                      <td className="px-2 py-1 border border-blue-200">EA</td>
                      <td className="px-2 py-1 border border-blue-200">20.95</td>
                      <td className="px-2 py-1 border border-blue-200">11.31</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white bg-opacity-50 rounded p-3">
              <h4 className="font-medium text-blue-900 text-sm mb-1">How to export from Excel:</h4>
              <ol className="text-sm text-blue-800 space-y-1">
                <li>1. Open the Marine Wholesale Excel spreadsheet</li>
                <li>2. Go to <strong>File &gt; Save As</strong></li>
                <li>3. Choose <strong>CSV (Comma delimited) (*.csv)</strong></li>
                <li>4. Save and upload the .csv file here</li>
              </ol>
            </div>

            <p className="text-sm text-blue-800 mt-3 font-medium">
              Important: Uploading will replace all existing Marine Wholesale parts. Preview your data before confirming!
            </p>
          </div>

          <div className="bg-white border border-gray-300 rounded-lg p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Marine Wholesale CSV File (.csv)
            </label>
            <input
              type="file"
              accept=".csv"
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
                <button onClick={handleCancelImport} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4 text-sm text-gray-800 space-y-1">
                <p><span className="font-medium">Total rows processed:</span> {parseResult.totalRows}</p>
                <p><span className="font-medium">Parts parsed:</span> {parseResult.parts.length.toLocaleString()}</p>
                <p><span className="font-medium">Skipped rows:</span> {parseResult.skippedRows}</p>
                {parseResult.parts.length > 0 && (
                  <>
                    <p><span className="font-medium">Sample SKUs:</span> {parseResult.parts.slice(0, 3).map(p => p.sku).join(', ')}</p>
                    <p><span className="font-medium">Price range:</span> ${Math.min(...parseResult.parts.map(p => p.list_price)).toFixed(2)} – ${Math.max(...parseResult.parts.map(p => p.list_price)).toFixed(2)}</p>
                  </>
                )}
              </div>

              {parseResult.parts.length === 0 ? (
                <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 mb-1">No Parts Found</h4>
                      <p className="text-sm text-red-800">
                        Could not parse any parts from this file. Please verify the CSV format matches the expected layout (SKU, Mfg Part #, Description, Stk U/M, List, Cost).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-green-900 mb-1">File Parsed Successfully</h4>
                        <p className="text-sm text-green-800">
                          Found {parseResult.parts.length.toLocaleString()} parts ready to import.
                        </p>
                      </div>
                    </div>
                  </div>

                  <h4 className="font-medium text-gray-900 mb-2">Preview (First 20 parts)</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Mfg Part #</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">U/M</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">List Price</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {parseResult.parts.slice(0, 20).map((part, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 text-sm font-mono text-gray-900">{part.sku}</td>
                            <td className="px-3 py-2 text-sm font-mono text-gray-600">{part.mfg_part_number || '—'}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">{part.description}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{part.unit_of_measure}</td>
                            <td className="px-3 py-2 text-sm text-green-600 font-medium">${part.list_price.toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm text-gray-900">${part.cost.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-medium text-blue-900 mb-2">Before Importing:</h5>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• This will replace all existing Marine Wholesale parts in the database</li>
                      <li>• Existing estimates will not be affected and will retain their original pricing</li>
                      <li>• New estimates will use the updated parts and pricing</li>
                      <li>• Import cannot be undone — ensure the data looks correct above</li>
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
              )}
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
                  <td className="px-6 py-4 text-sm text-gray-900">{new Date(record.uploaded_at).toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.file_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.uploader_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.total_parts_imported}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      record.status === 'success' ? 'bg-green-100 text-green-800'
                      : record.status === 'failed' ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{record.processing_time_seconds}s</td>
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
                placeholder="Search by SKU, Mfg Part #, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchParts()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900"
              />
            </div>
            <button
              onClick={fetchParts}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">SKU</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Mfg Part #</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">U/M</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">List Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parts.map((part) => (
                    <tr key={part.id}>
                      <td className="px-4 py-3 text-sm font-medium font-mono text-gray-900">{part.sku}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{part.mfg_part_number || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{part.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{part.unit_of_measure}</td>
                      <td className="px-4 py-3 text-sm text-green-600 font-medium">${part.list_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">${part.cost.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => { setSelectedPart(part); setShowPartDetails(true); }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {parts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                        No parts found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              {parts.length === 100 && (
                <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                  Showing first 100 results. Use search to narrow down.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showPartDetails && selectedPart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Marine Wholesale Part Details</h3>
              <button onClick={() => setShowPartDetails(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">SKU</label>
                  <p className="text-gray-900 font-mono font-medium">{selectedPart.sku}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Mfg Part #</label>
                  <p className="text-gray-900 font-mono">{selectedPart.mfg_part_number || '—'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900">{selectedPart.description}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Unit of Measure</label>
                  <p className="text-gray-900">{selectedPart.unit_of_measure}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">List Price</label>
                  <p className="text-green-600 font-semibold">${selectedPart.list_price.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Cost</label>
                  <p className="text-gray-900">${selectedPart.cost.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    selectedPart.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedPart.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
