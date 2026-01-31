import { useState } from 'react';
import { X, FileSignature, CheckCircle, AlertCircle, Printer } from 'lucide-react';
import { VesselManagementAgreement, UserProfile, supabase } from '../lib/supabase';
import { PrintableVesselAgreement } from './PrintableVesselAgreement';

interface VesselAgreementViewerProps {
  agreement: VesselManagementAgreement;
  userProfile: UserProfile;
  userId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function VesselAgreementViewer({ agreement, userProfile, userId, onClose, onUpdate }: VesselAgreementViewerProps) {
  const [signatureName, setSignatureName] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [showPrintView, setShowPrintView] = useState(false);

  const isStaff = userProfile.role === 'staff' || userProfile.role === 'manager' || userProfile.role === 'master';
  const isOwner = userProfile.role === 'owner';
  const canSign = (isStaff && !agreement.staff_signature_date) || (isOwner && !agreement.owner_signature_date);

  const handleSign = async () => {
    if (!signatureName.trim()) {
      setError('Please enter your full name to sign');
      return;
    }

    if (!confirm('By signing this agreement, you acknowledge that you have read and agree to all terms. Continue?')) {
      return;
    }

    setSigning(true);
    setError('');

    try {
      const updateData: any = {};

      if (isStaff) {
        updateData.staff_signature_name = signatureName;
        updateData.staff_signature_date = new Date().toISOString();
        updateData.staff_signature_ip = 'web-client';
      } else if (isOwner) {
        updateData.owner_signature_name = signatureName;
        updateData.owner_signature_date = new Date().toISOString();
        updateData.owner_signature_ip = 'web-client';
      }

      const { error: updateError } = await supabase
        .from('vessel_management_agreements')
        .update(updateData)
        .eq('id', agreement.id);

      if (updateError) throw updateError;

      if (isStaff) {
        alert('Agreement signed successfully! You can now approve this agreement to finalize the contract.');
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSigning(false);
    }
  };

  if (showPrintView) {
    return <PrintableVesselAgreement agreement={agreement} onClose={() => setShowPrintView(false)} />;
  }

  if (!agreement) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9998]">
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-cyan-400" />
            Vessel Management Agreement
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className={`px-3 py-1 rounded text-sm font-semibold ${
                agreement.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                agreement.status === 'pending_approval' ? 'bg-yellow-500/20 text-yellow-400' :
                agreement.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                'bg-slate-500/20 text-slate-400'
              }`}>
                {agreement.status === 'pending_approval' ? 'Pending Approval' :
                 agreement.status === 'approved' ? 'Approved' :
                 agreement.status === 'rejected' ? 'Rejected' : 'Draft'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{agreement.season_name}</h3>
            <p className="text-slate-400 text-sm">
              {new Date(agreement.start_date).toLocaleDateString()} - {new Date(agreement.end_date).toLocaleDateString()}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Manager Information</h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-500">Name:</span> <span className="text-white">{agreement.manager_name}</span></p>
                <p><span className="text-slate-500">Email:</span> <span className="text-white">{agreement.manager_email}</span></p>
                {agreement.manager_phone && <p><span className="text-slate-500">Phone:</span> <span className="text-white">{agreement.manager_phone}</span></p>}
                {agreement.manager_address && <p><span className="text-slate-500">Address:</span> <span className="text-white">{agreement.manager_address}</span></p>}
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Vessel Information</h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-slate-500">Name:</span> <span className="text-white">{agreement.vessel_name}</span></p>
                {agreement.vessel_make_model && <p><span className="text-slate-500">Make/Model:</span> <span className="text-white">{agreement.vessel_make_model}</span></p>}
                {agreement.vessel_year && <p><span className="text-slate-500">Year:</span> <span className="text-white">{agreement.vessel_year}</span></p>}
                {agreement.vessel_length && <p><span className="text-slate-500">Length:</span> <span className="text-white">{agreement.vessel_length}</span></p>}
              </div>
            </div>
          </div>

          {(agreement.agreed_arrival_time || agreement.agreed_departure_time) && (
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Vessel Availability Schedule</h4>
              <div className="space-y-2 text-sm">
                {agreement.agreed_arrival_time && <p><span className="text-slate-500">Arrival Time:</span> <span className="text-white">{agreement.agreed_arrival_time}</span></p>}
                {agreement.agreed_departure_time && <p><span className="text-slate-500">Departure Time:</span> <span className="text-white">{agreement.agreed_departure_time}</span></p>}
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Financial Terms</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Annual Management Fee:</span>
                <span className="text-white font-semibold">$8,000.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Season Trips:</span>
                <span className="text-white">{agreement.season_trips || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Off Season Trips:</span>
                <span className="text-white">{agreement.off_season_trips || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Per Trip Fee:</span>
                <span className="text-white">${(agreement.per_trip_fee || 350).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="text-white font-bold">Grand Total:</span>
                <span className="text-emerald-400 font-bold">
                  ${(8000 + ((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * (agreement.per_trip_fee || 350)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {(agreement.management_scope || agreement.maintenance_plan) && (
            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3">Agreement Terms</h4>
              <div className="space-y-3 text-sm">
                {agreement.management_scope && (
                  <div>
                    <p className="text-slate-500 font-medium mb-1">Management Scope:</p>
                    <p className="text-white">{agreement.management_scope}</p>
                  </div>
                )}
                {agreement.maintenance_plan && (
                  <div>
                    <p className="text-slate-500 font-medium mb-1">Maintenance Plan:</p>
                    <p className="text-white">{agreement.maintenance_plan}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3">Signatures</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-2">Owner/Manager Signature:</p>
                {agreement.owner_signature_date ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold text-sm">Signed</span>
                    </div>
                    <p className="text-white text-sm">{agreement.owner_signature_name}</p>
                    <p className="text-slate-400 text-xs">{new Date(agreement.owner_signature_date).toLocaleString()}</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
                    <p className="text-slate-500 text-sm">Not yet signed</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-2">AZ Marine Staff Signature:</p>
                {agreement.staff_signature_date ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-semibold text-sm">Signed</span>
                    </div>
                    <p className="text-white text-sm">{agreement.staff_signature_name}</p>
                    <p className="text-slate-400 text-xs">{new Date(agreement.staff_signature_date).toLocaleString()}</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 border border-slate-600 rounded-lg p-3">
                    <p className="text-slate-500 text-sm">Not yet signed</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {canSign && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                <FileSignature className="w-4 h-4" />
                Sign Agreement
              </h4>
              <div className="space-y-3">
                <div>
                  <label htmlFor="signature-name" className="block text-sm font-medium text-slate-300 mb-2">
                    Full Legal Name *
                  </label>
                  <input
                    id="signature-name"
                    name="signature_name"
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    disabled={signing}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  By signing, you acknowledge that you have read and agree to all terms of this vessel management agreement.
                </p>
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <button
                  onClick={handleSign}
                  disabled={signing || !signatureName.trim()}
                  className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-semibold"
                >
                  {signing ? 'Signing...' : 'Sign Agreement'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 p-4 flex justify-between">
          <button
            onClick={() => setShowPrintView(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors flex items-center gap-2 font-semibold"
          >
            <Printer className="w-4 h-4" />
            Print Agreement
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
