import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, AlertCircle, FileText, Clock, Anchor } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eqiecntollhgfxmmbize.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWVjbnRvbGxoZ2Z4bW1iaXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODc5ODEsImV4cCI6MjA3NjU2Mzk4MX0.5Y-xXVwjPuD8kVe50BFfg1QwihscdlYk20XCSgG4fOY';
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

interface Agreement {
  id: string;
  vessel_name: string;
  season_name: string;
  season_year: number;
  status: string;
  manager_name: string;
  manager_email: string;
  manager_phone?: string;
  manager_address?: string;
  manager_billing_approval_name?: string;
  manager_billing_approval_email?: string;
  annual_fee?: number;
  per_trip_fee?: number;
  total_trip_cost?: number;
  grand_total?: number;
  season_trips?: number;
  off_season_trips?: number;
  management_scope?: string;
  maintenance_plan?: string;
  usage_restrictions?: string;
  financial_terms?: string;
  special_provisions?: string;
  additional_services?: string;
  start_date?: string;
  end_date?: string;
  agreed_arrival_time?: string;
  agreed_departure_time?: string;
  contract_date?: string;
  owner_signature_name?: string;
  owner_signature_date?: string;
  staff_signature_name?: string;
  staff_signature_date?: string;
  signing_token?: string;
  signing_token_created_at?: string;
}

type PageState = 'loading' | 'ready' | 'already_signed' | 'expired' | 'invalid' | 'signed' | 'error';

interface Props {
  token: string;
}

function formatDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  });
}

function formatCurrency(n?: number) {
  return `$${(n ?? 0).toFixed(2)}`;
}

function daysUntilExpiry(createdAt?: string): number {
  if (!createdAt) return 0;
  const created = new Date(createdAt).getTime();
  const expiry = created + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function PublicAgreementSigner({ token }: Props) {
  const [state, setState] = useState<PageState>('loading');
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [signedAt, setSignedAt] = useState('');

  useEffect(() => {
    loadAgreement();
  }, [token]);

  const loadAgreement = async () => {
    if (!token || token.length < 10) {
      setState('invalid');
      return;
    }

    try {
      const { data, error } = await anonClient.rpc('get_agreement_by_signing_token', {
        p_token: token,
      });

      if (error || !data || data.length === 0) {
        setState('invalid');
        return;
      }

      const ag: Agreement = data[0];

      if (ag.owner_signature_date) {
        setAgreement(ag);
        setState('already_signed');
        return;
      }

      if (!ag.signing_token_created_at) {
        setState('expired');
        return;
      }

      const days = daysUntilExpiry(ag.signing_token_created_at);
      if (days <= 0) {
        setState('expired');
        return;
      }

      setAgreement(ag);
      setState('ready');
    } catch {
      setState('error');
    }
  };

  const handleSign = async () => {
    if (!signatureName.trim()) {
      setError('Please enter your full legal name');
      return;
    }

    setSigning(true);
    setError('');

    try {
      const { data, error } = await anonClient.rpc('sign_agreement_by_token', {
        p_token: token,
        p_signature_name: signatureName.trim(),
      });

      if (error) throw error;

      if (!data?.success) {
        if (data?.error === 'already_signed') { setState('already_signed'); return; }
        if (data?.error === 'expired') { setState('expired'); return; }
        setError(data?.message || 'Unable to sign. Please try again.');
        return;
      }

      setSignedAt(new Date().toLocaleString('en-US', { timeZone: 'America/Phoenix' }));
      setState('signed');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading agreement…</p>
        </div>
      </div>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────────
  if (state === 'invalid') {
    return <StatusPage icon="error" title="Invalid Link" message="This signing link is invalid or does not exist. Please contact AZ Marine for assistance." />;
  }

  if (state === 'expired') {
    return <StatusPage icon="clock" title="Link Expired" message="This signing link has expired (links are valid for 30 days). Please contact AZ Marine to request a new link." />;
  }

  if (state === 'error') {
    return <StatusPage icon="error" title="Something Went Wrong" message="Unable to load the agreement. Please try refreshing the page or contact AZ Marine." />;
  }

  // ── Already signed ───────────────────────────────────────────────────────
  if (state === 'already_signed') {
    return (
      <StatusPage
        icon="check"
        title="Already Signed"
        message={`This agreement has already been signed${agreement?.owner_signature_name ? ` by ${agreement.owner_signature_name}` : ''}${agreement?.owner_signature_date ? ` on ${new Date(agreement.owner_signature_date).toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })}` : ''}.`}
      />
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (state === 'signed') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Agreement Signed</h1>
          <p className="text-slate-400 mb-6">
            You have successfully signed the <strong className="text-white">{agreement?.season_name}</strong> vessel management agreement for <strong className="text-cyan-400">{agreement?.vessel_name}</strong>.
          </p>
          <div className="bg-slate-800 rounded-lg p-4 text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Signed by</span>
              <span className="text-white font-medium">{signatureName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Date & Time</span>
              <span className="text-white">{signedAt}</span>
            </div>
          </div>
          <p className="text-slate-500 text-sm">AZ Marine has been notified. You may close this window.</p>
        </div>
      </div>
    );
  }

  // ── Main signing page ────────────────────────────────────────────────────
  const ag = agreement!;
  const annualFee = Number(ag.annual_fee) || 8000;
  const perTripFee = Number(ag.per_trip_fee) || 350;
  const totalTrips = (ag.season_trips || 0) + (ag.off_season_trips || 0);
  const totalTripCost = totalTrips * perTripFee;
  const grandTotal = Number(ag.grand_total) || annualFee + totalTripCost;
  const expiryDays = daysUntilExpiry(ag.signing_token_created_at);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700 px-4 py-5">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Anchor className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">AZ Marine</h1>
            <p className="text-sm text-slate-400">Vessel Management Agreement</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Expiry notice */}
        {expiryDays <= 7 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300 text-sm">
              This signing link expires in <strong>{expiryDays} day{expiryDays !== 1 ? 's' : ''}</strong>. Please sign before it expires.
            </p>
          </div>
        )}

        {/* Agreement header */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">{ag.season_name}</h2>
              {ag.start_date && ag.end_date && (
                <p className="text-slate-400 text-sm mt-1">{formatDate(ag.start_date)} – {formatDate(ag.end_date)}</p>
              )}
            </div>
            <div className="flex-shrink-0">
              <FileText className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 mb-1">Vessel</p>
              <p className="text-white font-semibold">{ag.vessel_name}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Manager</p>
              <p className="text-white">{ag.manager_name}</p>
            </div>
          </div>
        </div>

        {/* Financial terms */}
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Financial Terms</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Annual Management Fee</span>
              <span className="text-white font-medium">{formatCurrency(annualFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Season Trips</span>
              <span className="text-white">{ag.season_trips || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Off-Season Trips</span>
              <span className="text-white">{ag.off_season_trips || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Per Trip Fee</span>
              <span className="text-white">{formatCurrency(perTripFee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Trip Fees</span>
              <span className="text-white">{formatCurrency(totalTripCost)}</span>
            </div>
            <div className="flex justify-between pt-3 border-t border-slate-700">
              <span className="text-white font-bold">Grand Total</span>
              <span className="text-emerald-400 font-bold text-base">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Schedule */}
        {(ag.agreed_arrival_time || ag.agreed_departure_time) && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Vessel Schedule</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {ag.agreed_arrival_time && (
                <div>
                  <p className="text-slate-500 mb-1">Arrival Time</p>
                  <p className="text-white">{ag.agreed_arrival_time}</p>
                </div>
              )}
              {ag.agreed_departure_time && (
                <div>
                  <p className="text-slate-500 mb-1">Departure Time</p>
                  <p className="text-white">{ag.agreed_departure_time}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agreement terms */}
        {(ag.management_scope || ag.maintenance_plan || ag.usage_restrictions || ag.financial_terms || ag.special_provisions) && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Agreement Terms</h3>
            <div className="space-y-4 text-sm">
              {ag.management_scope && (
                <div>
                  <p className="text-slate-500 font-medium mb-1">Management Scope</p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{ag.management_scope}</p>
                </div>
              )}
              {ag.maintenance_plan && (
                <div>
                  <p className="text-slate-500 font-medium mb-1">Maintenance Plan</p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{ag.maintenance_plan}</p>
                </div>
              )}
              {ag.usage_restrictions && (
                <div>
                  <p className="text-slate-500 font-medium mb-1">Usage Restrictions</p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{ag.usage_restrictions}</p>
                </div>
              )}
              {ag.financial_terms && (
                <div>
                  <p className="text-slate-500 font-medium mb-1">Financial Terms</p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{ag.financial_terms}</p>
                </div>
              )}
              {ag.special_provisions && (
                <div>
                  <p className="text-slate-500 font-medium mb-1">Special Provisions</p>
                  <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{ag.special_provisions}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AZ Marine staff signature */}
        {ag.staff_signature_name && (
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">AZ Marine Signature</h3>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-3">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-white text-sm font-medium">{ag.staff_signature_name}</p>
                {ag.staff_signature_date && (
                  <p className="text-slate-400 text-xs">{new Date(ag.staff_signature_date).toLocaleString('en-US', { timeZone: 'America/Phoenix' })}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Signature section */}
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide mb-4">Your Signature</h3>
          <p className="text-slate-400 text-sm mb-4 leading-relaxed">
            By entering your full legal name below and clicking <strong className="text-white">Sign Agreement</strong>, you acknowledge that you have read, understood, and agree to all terms of this Vessel Management Agreement.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Legal Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => { setSignatureName(e.target.value); setError(''); }}
                placeholder="Enter your full legal name exactly as it appears on your ID"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                disabled={signing}
                autoComplete="name"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleSign}
              disabled={signing || !signatureName.trim()}
              className="w-full px-6 py-4 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-bold text-base"
            >
              {signing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Signing…
                </span>
              ) : 'Sign Agreement'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs pb-8">
          AZ Marine Services &mdash; Vessel Management Agreement &mdash; This document is legally binding.
        </p>
      </div>
    </div>
  );
}

// ── Shared status page ───────────────────────────────────────────────────────
function StatusPage({ icon, title, message }: { icon: 'check' | 'clock' | 'error'; title: string; message: string }) {
  const iconEl =
    icon === 'check' ? <CheckCircle className="w-10 h-10 text-emerald-400" /> :
    icon === 'clock' ? <Clock className="w-10 h-10 text-amber-400" /> :
    <AlertCircle className="w-10 h-10 text-red-400" />;

  const ringColor =
    icon === 'check' ? 'bg-emerald-500/20 border-emerald-500/40' :
    icon === 'clock' ? 'bg-amber-500/20 border-amber-500/40' :
    'bg-red-500/20 border-red-500/40';

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className={`w-20 h-20 rounded-full ${ringColor} border-2 flex items-center justify-center mx-auto mb-6`}>
          {iconEl}
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-slate-400 leading-relaxed mb-6">{message}</p>
        <p className="text-slate-600 text-sm">AZ Marine &mdash; (480) 555-0100</p>
      </div>
    </div>
  );
}
