import { useState, useEffect } from 'react';
import { Download, Eye, X, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateFleetTripDatesReportPDF, FleetTripDatesRow } from '../utils/pdfGenerator';

interface FleetTripDatesReportProps {
  companyId?: string;
  onClose: () => void;
}

export function FleetTripDatesReport({ companyId, onClose }: FleetTripDatesReportProps) {
  const [rows, setRows] = useState<FleetTripDatesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      let yachtsQuery = supabase
        .from('yachts')
        .select('id, name, is_active')
        .order('name');

      if (companyId) {
        yachtsQuery = yachtsQuery.eq('company_id', companyId);
      }

      const { data: yachts, error: yachtsErr } = await yachtsQuery;
      if (yachtsErr) throw yachtsErr;

      if (!yachts || yachts.length === 0) {
        setRows([]);
        return;
      }

      const yachtIds = yachts.map(y => y.id);

      const { data: bookings, error: bookingsErr } = await supabase
        .from('yacht_bookings')
        .select('yacht_id, start_date')
        .in('yacht_id', yachtIds);

      if (bookingsErr) throw bookingsErr;

      const byYacht: Record<string, string[]> = {};
      for (const b of (bookings || [])) {
        if (!b.yacht_id || !b.start_date) continue;
        if (!byYacht[b.yacht_id]) byYacht[b.yacht_id] = [];
        byYacht[b.yacht_id].push(b.start_date);
      }

      const result: FleetTripDatesRow[] = yachts.map(y => {
        const dates = (byYacht[y.id] || []).sort();
        return {
          yacht_name: y.name,
          is_active: y.is_active,
          first_trip: dates.length > 0 ? dates[0] : null,
          last_trip: dates.length > 0 ? dates[dates.length - 1] : null,
          total_trips: dates.length,
        };
      });

      setRows(result);
    } catch (err) {
      console.error('Error loading fleet trip dates:', err);
      setError('Failed to load trip data.');
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePreview = () => {
    const pdf = generateFleetTripDatesReportPDF(rows);
    const url = URL.createObjectURL(pdf.output('blob'));
    window.open(url, '_blank');
  };

  const handleDownload = () => {
    const pdf = generateFleetTripDatesReportPDF(rows);
    pdf.save(`Fleet_Trip_Dates_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold">Fleet Trip Dates Report</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-300">
              {error}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 font-semibold">Yacht</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">First Trip</th>
                  <th className="pb-3 font-semibold">Last Trip</th>
                  <th className="pb-3 font-semibold text-center">Total Trips</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.yacht_name}
                    className={`border-b border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-700/20'}`}
                  >
                    <td className="py-3 font-medium">{row.yacht_name}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${row.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{fmtDate(row.first_trip)}</td>
                    <td className="py-3 text-slate-300">{fmtDate(row.last_trip)}</td>
                    <td className="py-3 text-center text-slate-300">{row.total_trips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && rows.length > 0 && (
          <div className="flex items-center gap-3 p-6 border-t border-slate-700">
            <button
              onClick={handlePreview}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              <Eye className="w-4 h-4" />
              Preview PDF
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors ml-auto"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
