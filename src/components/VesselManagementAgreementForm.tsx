import { useState, useEffect } from 'react';
import { X, Save, Send, FileText, AlertCircle, CheckCircle, ChevronRight, ChevronLeft, Printer } from 'lucide-react';
import { supabase, VesselManagementAgreement, Yacht, UserProfile, logYachtActivity } from '../lib/supabase';
import { PrintableVesselAgreement } from './PrintableVesselAgreement';

interface VesselManagementAgreementFormProps {
  yacht: Yacht;
  userProfile: UserProfile;
  userId: string;
  existingAgreement?: VesselManagementAgreement;
  onClose: () => void;
  onSuccess: () => void;
  onDraftSaved?: () => void;
}

export const VesselManagementAgreementForm = ({
  yacht,
  userProfile,
  userId,
  existingAgreement,
  onClose,
  onSuccess,
  onDraftSaved,
}: VesselManagementAgreementFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isDraft, setIsDraft] = useState(true);
  const [savedAgreementId, setSavedAgreementId] = useState<string | undefined>(existingAgreement?.id);

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    season_year: existingAgreement?.season_year || currentYear,
    season_name: existingAgreement?.season_name || `Annual ${currentYear}`,
    start_date: existingAgreement?.start_date || '',
    end_date: existingAgreement?.end_date || '',

    manager_name: existingAgreement?.manager_name || `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim(),
    manager_email: existingAgreement?.manager_email || userProfile.email || '',
    manager_phone: existingAgreement?.manager_phone || userProfile.phone || '',
    manager_address: existingAgreement?.manager_address || `${userProfile.street || ''}, ${userProfile.city || ''}, ${userProfile.state || ''} ${userProfile.zip_code || ''}`.trim(),

    vessel_name: existingAgreement?.vessel_name || yacht.name,
    vessel_year: existingAgreement?.vessel_year || yacht.year || 0,
    vessel_length: existingAgreement?.vessel_length || yacht.size || '',
    vessel_hull_number: existingAgreement?.vessel_hull_number || yacht.hull_number || '',

    special_provisions: existingAgreement?.special_provisions || '',
    additional_services: existingAgreement?.additional_services || '',

    season_trips: existingAgreement?.season_trips || 0,
    off_season_trips: existingAgreement?.off_season_trips || 0,
    per_trip_fee: existingAgreement?.per_trip_fee || 350.00,
    annual_fee: existingAgreement?.annual_fee ?? 8000,
    total_trip_cost: existingAgreement?.total_trip_cost || 0,
    grand_total: existingAgreement?.grand_total || 8000,
    contract_date: existingAgreement?.contract_date || new Date().toISOString().split('T')[0],
    manager_repair_approval_name: existingAgreement?.manager_repair_approval_name || '',
    manager_repair_approval_email: existingAgreement?.manager_repair_approval_email || '',
    manager_repair_approval_phone: existingAgreement?.manager_repair_approval_phone || '',
    manager_billing_approval_name: existingAgreement?.manager_billing_approval_name || '',
    manager_billing_approval_email: existingAgreement?.manager_billing_approval_email || '',
    manager_billing_approval_phone: existingAgreement?.manager_billing_approval_phone || '',
    boat_wifi_name: existingAgreement?.boat_wifi_name || yacht.wifi_name || '',
    boat_wifi_password: existingAgreement?.boat_wifi_password || yacht.wifi_password || '',
    agreed_arrival_time: existingAgreement?.agreed_arrival_time || '',
    agreed_departure_time: existingAgreement?.agreed_departure_time || '',
    consent_office_scheduling: existingAgreement?.consent_office_scheduling || false,
    consent_payment_terms: existingAgreement?.consent_payment_terms || false,
    owner_signature_name: existingAgreement?.owner_signature_name || '',
  });

  useEffect(() => {
    const autoSave = setTimeout(() => {
      if (existingAgreement && existingAgreement.status === 'draft') {
        handleSaveDraft(true);
      }
    }, 30000);

    return () => clearTimeout(autoSave);
  }, [formData]);

  const handleSaveDraft = async (silent = false) => {
    try {
      setLoading(true);
      setError('');

      const agreementData = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        insurance_expiration: (formData as any).insurance_expiration || null,
        agreed_arrival_time: formData.agreed_arrival_time || null,
        agreed_departure_time: formData.agreed_departure_time || null,
        contract_date: formData.contract_date || null,
        vessel_year: formData.vessel_year || null,
        yacht_id: yacht.id,
        submitted_by: userId,
        status: 'draft' as const,
      };

      if (savedAgreementId) {
        const { error: updateError } = await supabase
          .from('vessel_management_agreements')
          .update(agreementData)
          .eq('id', savedAgreementId);

        if (updateError) throw updateError;
      } else {
        const { data: insertData, error: insertError } = await supabase
          .from('vessel_management_agreements')
          .insert([agreementData])
          .select()
          .single();

        if (insertError) throw insertError;
        setSavedAgreementId(insertData.id);
      }

      onDraftSaved?.();

      if (!silent) {
        setSuccess('Draft saved successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message || 'Failed to save draft');
      }
      console.error('Error saving draft:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      if (!formData.season_name?.trim()) {
        throw new Error('Season name is required');
      }

      if (!formData.start_date || !formData.end_date) {
        throw new Error('Season start and end dates are required');
      }

      if (!formData.manager_name?.trim() || !formData.manager_email?.trim() ||
          !formData.manager_phone?.trim() || !formData.manager_address?.trim()) {
        throw new Error('All manager information fields are required');
      }

      if (!formData.vessel_name?.trim() || !formData.vessel_year ||
          !formData.vessel_length?.trim()) {
        throw new Error('Vessel name, year, and length are required');
      }

      if (!formData.manager_repair_approval_name?.trim() || !formData.manager_repair_approval_email?.trim() ||
          !formData.manager_repair_approval_phone?.trim()) {
        throw new Error('All repair approval contact fields are required');
      }

      if (!formData.manager_billing_approval_name?.trim() || !formData.manager_billing_approval_email?.trim() ||
          !formData.manager_billing_approval_phone?.trim()) {
        throw new Error('All billing approval contact fields are required');
      }


      if (!formData.agreed_arrival_time?.trim() || !formData.agreed_departure_time?.trim()) {
        throw new Error('Arrival and departure times are required');
      }

      if (!formData.consent_office_scheduling || !formData.consent_payment_terms) {
        throw new Error('You must agree to both consent terms to submit');
      }

      if (!formData.owner_signature_name?.trim()) {
        throw new Error('Manager signature is required to submit the agreement');
      }

      const agreementData = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        insurance_expiration: (formData as any).insurance_expiration || null,
        agreed_arrival_time: formData.agreed_arrival_time || null,
        agreed_departure_time: formData.agreed_departure_time || null,
        contract_date: formData.contract_date || null,
        vessel_year: formData.vessel_year || null,
        yacht_id: yacht.id,
        submitted_by: userId,
        status: 'pending_approval' as const,
        submitted_at: new Date().toISOString(),
        owner_signature_date: new Date().toISOString(),
        owner_signature_ip: 'client',
      };

      let resolvedId = savedAgreementId;

      if (!resolvedId) {
        const { data: existingDraft } = await supabase
          .from('vessel_management_agreements')
          .select('id')
          .eq('yacht_id', yacht.id)
          .eq('status', 'draft')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingDraft?.id) {
          resolvedId = existingDraft.id;
        }
      }

      let agreementId = resolvedId;

      if (resolvedId) {
        const { error: updateError } = await supabase
          .from('vessel_management_agreements')
          .update(agreementData)
          .eq('id', resolvedId);

        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('vessel_management_agreements')
          .insert([agreementData])
          .select()
          .single();

        if (insertError) throw insertError;
        agreementId = data.id;
      }

      await logYachtActivity(
        yacht.id,
        yacht.name,
        `Vessel Management Agreement submitted for ${formData.season_name}`,
        userId,
        formData.manager_name,
        agreementId,
        'vessel_agreement'
      );

      const { data: managers } = await supabase
        .from('user_profiles')
        .select('email, first_name, last_name')
        .eq('role', 'manager')
        .not('email', 'is', null);

      if (managers && managers.length > 0) {
        const managerEmails = managers.map(m => m.email).filter(Boolean);

        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-agreement-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            managerEmails,
            yachtName: yacht.name,
            seasonName: formData.season_name,
            ownerName: formData.manager_name,
            agreementId,
          }),
        });
      }

      setSuccess('Vessel Management Agreement submitted successfully!');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit agreement');
      console.error('Error submitting agreement:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 7) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const renderStepIndicator = () => {
    const steps = [
      { number: 1, label: 'Season Info' },
      { number: 2, label: 'Manager & Vessel' },
      { number: 3, label: 'Contract Details' },
      { number: 4, label: 'Review' },
      { number: 5, label: 'Preview Agreement' },
      { number: 6, label: 'Signature' },
      { number: 7, label: 'Submit' },
    ];

    return (
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  currentStep >= step.number
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {currentStep > step.number ? <CheckCircle className="w-5 h-5" /> : step.number}
              </div>
              <span className="text-xs text-slate-400 mt-1 text-center">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-all ${
                  currentStep > step.number ? 'bg-blue-500' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Season Information</h3>

      <div>
        <label htmlFor="season-year" className="block text-sm font-medium text-slate-300 mb-2">Season Year *</label>
        <input
          id="season-year"
          name="season_year"
          type="number"
          value={formData.season_year}
          onChange={(e) => setFormData({ ...formData, season_year: parseInt(e.target.value) || currentYear })}
          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="season-name" className="block text-sm font-medium text-slate-300 mb-2">Season Name *</label>
        <input
          id="season-name"
          name="season_name"
          type="text"
          value={formData.season_name}
          onChange={(e) => setFormData({ ...formData, season_name: e.target.value })}
          placeholder="e.g., Annual 2025, Spring 2025, Summer Season"
          className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
          disabled={loading}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium text-slate-300 mb-2">Start Date *</label>
          <input
            id="start-date"
            name="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => {
              const startDate = e.target.value;
              let endDate = formData.end_date;

              if (startDate) {
                const start = new Date(startDate);
                const end = new Date(start);
                end.setFullYear(end.getFullYear() + 1);
                endDate = end.toISOString().split('T')[0];
              }

              setFormData({ ...formData, start_date: startDate, end_date: endDate });
            }}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            disabled={loading}
            required
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-medium text-slate-300 mb-2">End Date *</label>
          <input
            id="end-date"
            name="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
            disabled={loading}
            required
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Manager & Vessel Information</h3>

      <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Manager Information</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name *</label>
            <input
              type="text"
              value={formData.manager_name}
              onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
            <input
              type="email"
              value={formData.manager_email}
              onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone *</label>
            <input
              type="tel"
              value={formData.manager_phone}
              onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Mailing Address *</label>
            <textarea
              value={formData.manager_address}
              onChange={(e) => setFormData({ ...formData, manager_address: e.target.value })}
              rows={2}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
              disabled={loading}
              required
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-300 mb-3">Vessel Information</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Vessel Name *</label>
            <input
              type="text"
              value={formData.vessel_name}
              onChange={(e) => setFormData({ ...formData, vessel_name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Year *</label>
              <input
                type="number"
                value={formData.vessel_year || ''}
                onChange={(e) => setFormData({ ...formData, vessel_year: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Length *</label>
              <input
                type="text"
                value={formData.vessel_length}
                onChange={(e) => setFormData({ ...formData, vessel_length: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Hull Number</label>
            <input
              type="text"
              value={formData.vessel_hull_number}
              onChange={(e) => setFormData({ ...formData, vessel_hull_number: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">WiFi Name</label>
            <input
              type="text"
              value={formData.boat_wifi_name}
              onChange={(e) => setFormData({ ...formData, boat_wifi_name: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">WiFi Password</label>
            <input
              type="text"
              value={formData.boat_wifi_password}
              onChange={(e) => setFormData({ ...formData, boat_wifi_password: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Vessel Managment Agreement 2026</h3>

      <div className="bg-slate-800/50 rounded-lg p-6 max-h-96 overflow-y-auto text-xs text-slate-300 space-y-2 leading-relaxed">
        <p className="font-semibold text-white text-sm">This Inspection Agreement ("Agreement")</p>
        <p>is made between AZ Marine, an authorized vendor of Antelope Point Holdings LLC, as operator and liaison (hereinafter "Liaison") of Antelpe Point Holdings Marina at Lake Powell (the "Marina") and <span className="font-semibold text-blue-400">{formData.vessel_name || '___________________________'}</span> as the President or other designated representative of the corporation, limited liability company, limited partnership or other legal entity ("Boatco"), which owns vessels at and on the Marina. (Collectively, Liaison and Boatco are the "Parties" to this Agreement) entered on <span className="font-semibold text-blue-400">{formData.contract_date ? new Date(formData.contract_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '_________________'}</span>.</p>

        <h4 className="text-white font-bold mt-4 text-sm">Recitals</h4>
        <p><strong>A:</strong> The Parties to this Agreement desire to have a central point of communication to handle Mechanical Inspections and maintenance issues and establish terms and conditions for Boatco's use of the Marina. Authorized contact information;</p>
        <p className="ml-4">AZ Marine approved contact information are as follows:</p>
        <p className="ml-4">Phone 928-637-6500</p>
        <p className="ml-4">Website www.azmarine.net</p>
        <p className="ml-4">Email accounts jeff@azmarine.net , karen.stanley17@gmail.com, sales@azmarine.net , service@azmarine.net</p>
        <p className="ml-4">AZ Marine is using the web-based app My Yacht Time to schedule repairs and communicate with all owners and managers; billing will also be managed within this program. www.myyachttime.com fees for the use of this app are included in the standard management fees.</p>
        <p className="ml-4">Company's Mailing address PO BOX 2184 Flagstaff AZ. 86003 (we are unable to get mail directly at the store so it will be returned if you send anything by US Mail. USP and FedEx only)</p>
        <p className="ml-4">With respect to our valued employees, we ask you to please use these forms of contact only. If an employee calls from their personal cellphone, that is for them to get a clear understanding of the services needed or being requested. All scheduling for services must go through the office phone numbers, please do not call employees directly to schedule new services. Customers that abuse this policy will cause this contract to be canceled and/or voided.</p>

        <p><strong>B:</strong> The Marina provides a harbor for vessels of all kinds (" Vessel(s)) at Lake Powell.</p>

        <p><strong>C:</strong> Az Marine as Liaison has the exclusive executive authority to handle Mechanical Inspections and maintenance matters for the Marina and will serve as the central point of contact between the parties.</p>

        <p><strong>D:</strong> Boatco is an organization of vessel owners who use the Marina.</p>

        <p><strong>E:</strong> Boatco holds title or property interest in the vessels.</p>

        <p><strong>F:</strong> Boatco represents the owners and holders of shares, interest and equity in Boatco in all matters arising out of this Agreement including all matters relating to the vessels' location and use in the Marina, regardless of whether the claim is based on contact, tort, liability, product liability or otherwise.</p>

        <p><strong>G:</strong> By their purchase of their equity interest in Boatco and their selection of the President and Treasurer or other authorized representative(s) of Boatco, the individual shareholders, members, partners and any other equity holders ("Equity Owners") agree and hereby deem that Boatco shall be the exclusive representative of the Equity Owners in all matters including the Services provided hereunder as well as all claims for personal injury or any other claims arising out of their operation and use of the vessels.</p>

        <p><strong>H:</strong> Liaison provides Mechanical Inspections and maintenance services for the vessels in the Marina. This includes service technicians who are qualified to provide the various repair, maintenance and renovations services needed for the vessels kept at the Marina.</p>

        <p><strong>I:</strong> While some maintenance and repair services can be performed during the season when the vessels are being used ("Services"), typically vessels also need service that cannot be done while the vessel is in the water and being used, but only when the season is over and the vessels are on land in storage ("Off-Season Services"). Most Equity Owners and vessel users are gone from the Marina when the Off-Season Services are performed.</p>

        <p><strong>J:</strong> Boatco desires to have Liaison provide its Mechanical inspections and Maintenance services, including the repair and maintenance Services and Off-Season Services to Boatco.</p>

        <p className="mt-4">Therefore, for the consideration stated herein the Parties agree as follows,</p>

        <h4 className="text-white font-bold mt-4 text-sm">Terms and Conditions</h4>

        <p><strong>1.</strong> Liaison will provide mechanical inspections and maintenance service to Boatco included a Maintenance budget for during season and any off-season repairs needed.</p>

        <p><strong>2.</strong> Boatco, on behalf of each Equity Owner and vessel, on or before  the contract Start date, shall pay an annual management fee of <span className="font-semibold text-blue-400">${(formData.annual_fee ?? 8000).toFixed(2)}</span> ("Annual Fee"), in addition to the Annual Fee the Boatco agrees to pay the Liaison $350.00 per turn to do a full 2-hour mechanical inspection of the boat, and will provide the Boatco a report with the findings. The estimated number of trips for this agreement will be <span className="font-semibold text-blue-400">{(formData.season_trips || 0) + (formData.off_season_trips || 0) || '________'}</span> this will include in season trips and off-season trips at $350.00 each totaling <span className="font-semibold text-blue-400">${(((formData.season_trips || 0) + (formData.off_season_trips || 0)) * (formData.per_trip_fee || 350)).toFixed(2) || '___________'}</span>. For a grand total of <span className="font-semibold text-blue-400">${((formData.annual_fee ?? 8000) + (((formData.season_trips || 0) + (formData.off_season_trips || 0)) * (formData.per_trip_fee || 350))).toFixed(2) || '______________'}</span> This is a one-time fee per season payable to the Liaison, the Boatco understands that repairs and maintenance will be additional.</p>

        <p><strong>3.</strong> Rates and Billing. During the term of this Agreement, for any work done on the APM Marina or in dry storage, AZ Marine is required to charge a surcharge of 15% pre-tax per invoice. The 15% will be capped at a retail invoice of $50,000. This 15% will be paid to APM for access to APM properties by AZ Marine. The 15% is non-negotiable. Rates for house systems and gasoline engines will be $175.00 per hour; all diesel engine repairs are $210.00 per hour. Up-lake service calls are not subject to any surcharges and will be paid directly to the Liaison. Up-lake rates are as follows: $750.00 chase boat launch fee (this charge includes all fuel for the work boat) and $325.00 per hour. The hourly charge starts once the chase boat leaves the breakwater, until it returns to the breakwater. If an employee has to use diving gear to repair the boat, there will be an additional dive fee of $500.00 per hour, with a one (1) hour minimum, added to the bill. The rates listed in this Section apply to standard service calls only; emergency response and towing are billed at separate rates. Up-lake billing will be due within 48 hours of Boatco receiving the invoice. Payments made directly to the Liaison will be made only by My Yacht Time ACH. If Boatco needs to pay by credit card, a fee of 3% will be added. Paper checks are not accepted for payment. All payments are due within 48 hours of services being completed. Any invoice not paid on time may be subject to an 18% interest charge.</p>

        <p><strong>4.</strong> Agreement as Condition. Becoming a party to and adherence to the terms of this Agreement shall be a condition of using the Marina.</p>

        <p><strong>5.</strong> Liaison. The Parties hereby agree that Liaison shall be the central point of communication for mechanical inspections, maintenance and other matters involving or relating to the Marina.</p>

        <p><strong>6.</strong> Liaison's Rights and Responsibilities. In its dealings with the Boatco representatives, Liaison's authority, rights and responsibilities shall include, without limitation, the following:</p>
        <ul className="list-none pl-4 space-y-1">
          <li>A - Conducting check-off inspections and pre-trip inspections; these inspections will be documented electronically. The Boatco president can request access to records. Any inspections of the vessel and determining in the Liaison's sole discretion any and all needed repairs and maintenance, including without limitation services needed for health, safety, and legal compliance, as well as the Services and Off-Season Services.</li>
          <li>B-Negotiating and signing of Marina use agreements.</li>
          <li>C-Collecting Marina use fees and related payments.</li>
          <li>D-Coordinating and/or providing various management and maintenance services for the Boatco owners and the Marina.</li>
          <li>E - Coordinating, without limitation, the above-listed repair, maintenance, and upkeep services by and with the authorized service technicians and other qualified personnel. This includes coordinating all turn services.</li>
          <li>F-Complying with applicable law.</li>
          <li>G - Enforcing the Marina's Rules and Regulations and applicable law (collectively, the above items shall, without limitation, constitute and be referred to as the "Services", including the Off-Season Services referred to herein).</li>
          <li>H-Doing all things necessary to provide the optimum level of Mechanical Inspections and vessel maintenance for the Boatco and the Marina.</li>
          <li>I - Taking all steps necessary to ensure the Equity Owner or vessel user timely and promptly vacates the vessel by the agreed-upon time in the contract on its last day of use. This means you must be in the slip and offloaded prior to the agreed-upon time. Equity Owners or vessel owners that don't have a dedicated mooring slip must depart before the agreed-upon time; failure to do so shall subject Boatco to an additional charge of $500 per each half hour of delay ("Late Departure Fee"). Prompt departure is absolutely necessary because Liaison and its service providers have only the hours between 7am and 6pm of the same day to perform necessary Services to prepare the vessel for occupancy and use by the next user Equity Owner at 6pm. Late Departure Fees not paid by the Equity Owner or vessel user within 5 days shall be billed to and payable by Boatco.</li>
          <li>J - The authority and mandate to take corrective action to implement and enforce the above Services (collectively, "Corrective Action") as determined in good faith in Liaison's sole discretion.</li>
        </ul>

        <p><strong>7.</strong> Hold Harmless, Release and Waiver. In the event Boatco or a vessel user works on his/her own vessel, or uses a third-party vendor (which must be approved in writing by the Liaison prior to any work being done), or uses the vessel after being advised by Liaison or with knowledge that use of the vessel in the Marina may not be safe or prudent, Boatco and/or the vessel user do so at their own risk and hereby release and waive any claims against Liaison, the Marina or any principal or agent of the same, and shall hold harmless and indemnify them against any and all claims. Boatco shall indemnify Liaison and Marina as well as their principals and agents from any event or claims arising out of use of a Boatco vessel in the Marina, regardless of whether the user was or was not an equity holder in Boatco. Vessel users may be required to sign a hold harmless agreement and waiver at the time of usage in the Marina if such use occurs after receiving advice or having knowledge that using the vessel in that condition was unsafe or imprudent.</p>

        <p><strong>8.</strong> Term and Termination</p>
        <ul className="list-none pl-4 space-y-1">
          <li>A - The term of this Agreement shall be for not less than one (1) year and will automatically renew for successive one-year terms until termination.</li>
          <li>B - Boatco commits to this minimum term of one year, after which Boatco may opt out of the Agreement with a 30-day notice.</li>
          <li>C - Liaison may terminate this Agreement with ten (10) days' prior notice and, in its sole discretion (depending on circumstances), terminate Boatco's (and a vessel user's) access to and use of the Marina, and any other agreement between the Parties or between Boatco and third-party vendors.</li>
          <li>D - This Agreement, as well as access to and use of the Marina, may be terminated without prior notice at any time by the Liaison for good cause. "Cause" includes, without limitation, Boatco's (or a vessel user's) failure to take Corrective Action, negligent or improper use of the Marina, willful or reckless misconduct, or criminal activities.</li>
          <li>E - If this Agreement is canceled by either the Liaison or Boatco, for any reason, there will be no discounts on the contract and no refunds of any fees paid.</li>
        </ul>

        <p><strong>9.</strong> Corrective action and Enforcement. Liaison shall have necessary and proper authority to enforce the Corrective Actions. Boatco's failure to complete such Corrective Action with in ten (10) days of written notice of the same shall constitute a breach of this Agreement. In the event the Corrective Action, or cause for same, cannot be completed with-in ten (10) days then the Boatco shall commence, or cause the vessel user to commence, the necessary Corrective Action, proceed diligently to it conclusion and keep the Liaison informed as to the process.</p>

        <p><strong>10.</strong> Warranty Disclaimer, Liaison agrees to service as contact liaison and to perform the Services as listed above and warrants that it shall perform same with diligence and the Services shall be of workmanlike quality. Liaison makes no other warranties express or implied regarding the performance of Services including Off-Season Services, of the repair, maintenance, or other service technicians, or of any other person or party. Liaison disclaims any warranties, express or implied, as to availability, suitability, deadlines, interruptions, or fitness for a particular purpose. Marina makes no warranties express or implied.</p>

        <p><strong>11.</strong> Limitation of Liability. Liaison shall not be responsible for, and shall not pay, any amount of incidental, consequential, exemplary, or other direct or indirect damages arising out of Boatco's (or its vessel users') operation of their vessels and any injury to any third party. Liaison shall not be liable to Boatco or the vessel users for contract damages except those arising directly out of this Agreement. Liaison (and Marina) shall not be responsible to Boatco or a vessel user for loss of revenue, loss of profits, loss of goodwill or otherwise, regardless of whether Liaison was advised of the possibility of such losses. In no event shall Liaison's liability hereunder to Boatco or the vessel users exceed the amount paid by Boatco for Liaison Services, regardless of whether the claim is based on contract, tort, strict liability, product liability or otherwise. Liaison is not responsible for any damages or losses sustained by Boatco for any products or services Boatco or a vessel user purchased from any third-party vendor, even if Liaison approved the use of such vendor. In any case, no refunds of Liaison's service fees will be issued, consistent with Section 8-E.</p>

        <p><strong>12.</strong> Time Limitations on Claims. Any claims by Boatco, its vessel users, agent or affiliates shall be brought with-in one year of the date of the alleged breach or injury is, or reasonable should have been, discovered, and within two years of the date of breach or injury regardless of when same is/was discovered.</p>

        <p><strong>13.</strong> Successors and Assigns. This Agreement is not assignable by Boatco, but in any case, shall be binding upon Boatco's the equity Owners and vessel users' successors, assigns, heirs and personal representatives.</p>

        <p><strong>14.</strong> Entire Agreement. This Agreement constitutes the entire agreement and understanding among the Parties hereto and supersedes and prior and contemporaneous agreements, understandings, inducements and conditions, express or implied, oral or written, of any nature whatsoever with respect to the subject matter hereof. No amendment of any provision of this Agreement shall be effective against any party unless the party or its lawful agent shall have consented thereto in writing.</p>

        <p><strong>15.</strong> Waiver. Neither the failure of nor any delay on the part of either party to exercise any right, remedy, power or privilege under this Agreement shall operate as a waiver thereof, nor shall any single or partial excise of any right, remedy, power or privilege preclude any other privilege, nor shall any waiver of any right, remedy, power or privilege with respect to any occurrence be constructed as a waiver of any right, remedy, power or privilege, with respect to any other occurrence. No waiver shall be effective unless it is in writing and is signed by the party asserted to have granted such waiver.</p>

        <p><strong>16.</strong> Notices. All notices or other communications to be given by any party to the other Parties shall be in writing, shall be served by personal delivery or by depositing such notices in the United States mail, certified or registered, return receipt requested, with certification or registration and postage charges prepaid, properly addressed and directed to Liaison or Boatco at the addresses set forth below. Any party may designate a different person or place for notices by delivering a written notice to that effect to the other party, which notice shall be effective after the same is received by the other party. Except as expressly provided in the preceding sentence, all notices shall be deemed to have been delivered upon the earlier of (i) actual receipt as evidenced by a return receipt or other delivery receipt, or (ii) two days after such notice and has been deposited for delivery in the office or postal mail box operated by the United States Postal Service.</p>
        <p className="ml-4">If to Liaison: Competition Auto super Center Inc.</p>
        <p className="ml-4">DBA: AZ Marine</p>
        <p className="ml-4">PO Box 2184</p>
        <p className="ml-4">Flagstaff, AZ. 86003</p>
        <p className="ml-4">With a copy to: Antelope Point Holdings LLC.</p>
        <p className="ml-4">537 Marina Parkway</p>
        <p className="ml-4">Page, AZ 86040</p>
        <p className="ml-4">And to Boatco:</p>

        <p><strong>17.</strong> Governing Law, Venue & Jurisdiction: The terms and provisions of this Agreement shall be governed by, construed in accordance with, and interpreted under the laws of the State of Arizona with venue and jurisdiction in Coconino County of Arizona.</p>

        <p><strong>18.</strong> Mediation and Arbitration. Notwithstanding the foregoing in the event a dispute arises out of this Agreement the affected Parties shall meet and confer, with or without legal counsel to resolve this dispute. If the dispute is not resolved within ten (10) days of the written request to meet and confer, then the Parties shall engage in mediation under the auspices of the American Arbitration Association within thirty (30) days. If the dispute is not resolved by and in mediation then the dispute shall be heard by a single arbitrator under the Commercial Rules of Arbitration of the American Arbitration association. The arbitrator's award shall be final and may be entered as a judgment in any court of competent jurisdiction.</p>

        <p><strong>19.</strong> Attorneys' Fees. If either party institutes a civil action or arbitration against the other party which claims in any way relate to this Agreement. its formation, or its enforcement, the successful party in any such action shall be entitled to recover from the other party reasonable attorneys' fees (not to exceed the actual attorneys' fees incurred), witness fees and expenses, any and all other litigation expenses and court costs incurred in connection with said proceedings.</p>

        <p><strong>20.</strong> Counterparts. This Agreement may be executed in any number of counterparts, each of which shall be deemed to be and original as against any party whose signature appears hereon, and all of which shall together constitute one and the same instrument. This Agreement shall become binding when one or more counterparts hereof, individually or taken together, shall bear the signatures of all of the parties reflected hereon as signatories.</p>

        <p><strong>21.</strong> Invalidity. The invalidity or unenforceability of any covenant, term or condition of this Agreement, or any portion of any covenant, term or condition of this Agreement, shall not affect any other covenant, term or condition or portion hereof, and this Agreement shall remain in effect as if such invalid or unenforceable covenant, term or condition (or portion hereof) was not contained herein or was reduced to enforceable limits by a court.</p>

        <p><strong>22.</strong> Representation by Counsel. Each of the Parties has been represented by or as had the full and fair opportunity to be represented by legal counsel of its, his or her own choice.</p>

        <p><strong>23.</strong> Boatco Responsibility. The Boatco shall provide the items listed in Schedule 1 below with-in ten (10) of the signed Agreement to the Liaison in order for the Liaison to properly execute this Agreement. Failure to do so will cause this agreement to be terminated without a refund.</p>

        <p><strong>24.</strong> Notice of Change in Ownership. The Boatco manager or other authorized representative is responsible for notifying the Liaison in writing of any change in ownership of the vessel or of any equity interest in Boatco within forty-eight (48) hours of the sale or transfer being completed. This notice is required so the Liaison can update owner contact lists, trip schedules, and billing records in My Yacht Time. If Boatco fails to provide timely notice of a change in ownership at any time after this Agreement is signed, Boatco will be charged an administrative fee of $250.00 per occurrence to cover the cost of updating contact lists and trip dates. This fee is payable under the payment terms in Section 3.</p>

        <p><strong>25.</strong> Exclusive Mechanical Service Provider. Once the vessel is under this Agreement, the Liaison shall be the sole and exclusive provider of all mechanical work performed on the vessel. No other vendor, contractor, or individual, including Boatco, its Equity Owners, or vessel users, may perform mechanical work on the vessel for the term of this Agreement, except a third-party vendor approved in writing by the Liaison prior to any work being done, as provided in Section 7.</p>

        <p><strong>26.</strong> My Yacht Time Monitoring System.</p>
        <ul className="list-none pl-4 space-y-1">
          <li>A - Equipment Ownership. Any monitoring equipment installed on the vessel is owned by Boatco. Boatco understands and agrees that the My Yacht Time software is the only software compatible with this equipment.</li>
          <li>B - Monitoring Agreement and Pricing. Monitoring services, including alert response, are provided under a separate My Yacht Time Monitoring Agreement. Monitoring fees may be included in or separate from the fees in this Agreement, depending on the agreement signed by Boatco, and pricing may vary.</li>
          <li>C - Termination of This Agreement. If this Agreement ends for any reason, Boatco must subscribe to a My Yacht Time monitoring-only agreement to continue using the monitoring equipment.</li>
          <li>D - No Guarantee. The monitoring system is a convenience tool and does not replace inspections or Boatco's responsibility for the vessel. The Liaison is not liable for any loss or damage resulting from a failure of the equipment, software, power, or cellular or internet service, or from any alert that is delayed or not delivered.</li>
          <li>E - Data Consent. Boatco consents to the collection of vessel data through the monitoring system, including location, bilge, pump, and battery data, and agrees that the Liaison may access and view this data.</li>
        </ul>

        <p><strong>27.</strong> Emergency Response and Right of First Refusal.</p>
        <ul className="list-none pl-4 space-y-1">
          <li>A - Emergency Events. All emergency response for the vessel must go through the Liaison. An emergency includes, without limitation, mechanical failure, the vessel being blown off the beach, the vessel striking a rock or other object and taking on water, or the vessel sinking.</li>
          <li>B - Right of First Refusal. Boatco and its vessel users shall notify the Liaison first of any emergency event, and the Liaison shall have the right of first refusal for all response, recovery, salvage, and repair work related to that event. If the Liaison declines the work, Boatco may use another provider.</li>
          <li>C - Fee for Failure to Offer First Refusal. If Boatco or a vessel user does not give the Liaison the right of first refusal and uses another provider, Boatco shall pay the Liaison a fee equal to ten percent (10%) of the total bill charged by the responding party. This fee is payable under the payment terms in Section 3.</li>
          <li>D - Life Safety Exception. Nothing in this Section prevents anyone from calling 911, the National Park Service, or the U.S. Coast Guard when there is a risk to human life or safety, and no fee under this Section applies to that call. Any work on the vessel beyond the immediate life-safety response remains subject to this Section.</li>
          <li>E - Unauthorized Responders. Boatco acknowledges that third parties have performed salvage and emergency response work at Lake Powell at no charge in order to be paid through social media channels, and that such work has not been approved by the National Park Service. Boatco and its vessel users shall not use any such responder. If an unauthorized responder performs work on the vessel, Boatco shall pay the Liaison a fee equal to the greater of $10,000.00 or the value of the work performed, calculated at the Liaison's rates in Section 3, in place of the fee in Part C, payable under the payment terms in Section 3.</li>
        </ul>
      </div>
    </div>
  );

  const renderStep4 = () => {
    const calculateTotals = () => {
      const totalTrips = (formData.season_trips || 0) + (formData.off_season_trips || 0);
      const tripCost = totalTrips * (formData.per_trip_fee || 350);
      const annualFee = formData.annual_fee ?? 8000;
      const total = annualFee + tripCost;

      if (formData.total_trip_cost !== tripCost || formData.grand_total !== total) {
        setFormData({
          ...formData,
          total_trip_cost: tripCost,
          grand_total: total,
        });
      }
    };

    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white mb-4">Contract Details</h3>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Financial Terms</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Contract Date *</label>
              <input
                type="date"
                value={formData.contract_date}
                onChange={(e) => setFormData({ ...formData, contract_date: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Season Trips</label>
                <input
                  type="number"
                  value={formData.season_trips || ''}
                  onChange={(e) => setFormData({ ...formData, season_trips: parseInt(e.target.value) || 0 })}
                  onBlur={calculateTotals}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Off Season Trips</label>
                <input
                  type="number"
                  value={formData.off_season_trips || ''}
                  onChange={(e) => setFormData({ ...formData, off_season_trips: parseInt(e.target.value) || 0 })}
                  onBlur={calculateTotals}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Per Trip Fee</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.per_trip_fee || 350}
                  onChange={(e) => setFormData({ ...formData, per_trip_fee: parseFloat(e.target.value) || 350 })}
                  onBlur={calculateTotals}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Annual Fee</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.annual_fee ?? 8000}
                  onChange={(e) => setFormData({ ...formData, annual_fee: parseFloat(e.target.value) || 0 })}
                  onBlur={calculateTotals}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  disabled={loading}
                />
              </div>
            </div>
            <div className="bg-slate-700/50 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Annual Fee:</span>
                <span className="text-white font-semibold">${(formData.annual_fee ?? 8000).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Season Trips ({formData.season_trips || 0} × ${formData.per_trip_fee || 350}):</span>
                <span className="text-white font-semibold">${((formData.season_trips || 0) * (formData.per_trip_fee || 350)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Off Season Trips ({formData.off_season_trips || 0} × ${formData.per_trip_fee || 350}):</span>
                <span className="text-white font-semibold">${((formData.off_season_trips || 0) * (formData.per_trip_fee || 350)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Trips ({(formData.season_trips || 0) + (formData.off_season_trips || 0)}):</span>
                <span className="text-white font-semibold">${(((formData.season_trips || 0) + (formData.off_season_trips || 0)) * (formData.per_trip_fee || 350)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base border-t border-slate-600 pt-2">
                <span className="text-white font-bold">Grand Total:</span>
                <span className="text-emerald-400 font-bold">${((formData.annual_fee ?? 8000) + (((formData.season_trips || 0) + (formData.off_season_trips || 0)) * (formData.per_trip_fee || 350))).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Vessel Availability Schedule</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Agreed Arrival Time *</label>
              <input
                type="time"
                value={formData.agreed_arrival_time}
                onChange={(e) => setFormData({ ...formData, agreed_arrival_time: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Agreed Departure Time *</label>
              <input
                type="time"
                value={formData.agreed_departure_time}
                onChange={(e) => setFormData({ ...formData, agreed_departure_time: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Agreement Consent</h4>
          <div className="space-y-3">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consent_office_scheduling}
                onChange={(e) => setFormData({ ...formData, consent_office_scheduling: e.target.checked })}
                className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                disabled={loading}
              />
              <span className="text-sm text-slate-300">
                <strong className="text-white">Office Scheduling:</strong> I acknowledge that all new work must be scheduled through the office phone numbers (928-637-6500) and not directly with employees. Scheduling services directly with employees without going through the office may result in contract cancellation.
              </span>
            </label>
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.consent_payment_terms}
                onChange={(e) => setFormData({ ...formData, consent_payment_terms: e.target.checked })}
                className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900"
                disabled={loading}
              />
              <span className="text-sm text-slate-300">
                <strong className="text-white">Payment Terms:</strong> I agree to send all payments within 48 hours of the work being completed. Failure to comply with this payment schedule may result in suspension of future work.
              </span>
            </label>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Management Team - Repair Approval</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
              <input
                type="text"
                value={formData.manager_repair_approval_name}
                onChange={(e) => setFormData({ ...formData, manager_repair_approval_name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
              <input
                type="email"
                value={formData.manager_repair_approval_email}
                onChange={(e) => setFormData({ ...formData, manager_repair_approval_email: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Phone *</label>
              <input
                type="tel"
                value={formData.manager_repair_approval_phone}
                onChange={(e) => setFormData({ ...formData, manager_repair_approval_phone: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3">Management Team - Billing Approval</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Name *</label>
              <input
                type="text"
                value={formData.manager_billing_approval_name}
                onChange={(e) => setFormData({ ...formData, manager_billing_approval_name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email *</label>
              <input
                type="email"
                value={formData.manager_billing_approval_email}
                onChange={(e) => setFormData({ ...formData, manager_billing_approval_email: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Phone *</label>
              <input
                type="tel"
                value={formData.manager_billing_approval_phone}
                onChange={(e) => setFormData({ ...formData, manager_billing_approval_phone: e.target.value })}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep5 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Review & Submit</h3>

      <div className="bg-slate-800/50 rounded-lg p-4 space-y-4 max-h-96 overflow-y-auto">
        <div>
          <h4 className="text-sm font-semibold text-blue-400 mb-2">Season Information</h4>
          <div className="text-sm text-slate-300 space-y-1">
            <p><span className="text-slate-500">Season:</span> {formData.season_name} ({formData.season_year})</p>
            <p><span className="text-slate-500">Period:</span> {formData.start_date} to {formData.end_date}</p>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-3">
          <h4 className="text-sm font-semibold text-blue-400 mb-2">Manager Information</h4>
          <div className="text-sm text-slate-300 space-y-1">
            <p><span className="text-slate-500">Name:</span> {formData.manager_name}</p>
            <p><span className="text-slate-500">Email:</span> {formData.manager_email}</p>
            {formData.manager_phone && <p><span className="text-slate-500">Phone:</span> {formData.manager_phone}</p>}
            {formData.manager_address && <p><span className="text-slate-500">Address:</span> {formData.manager_address}</p>}
          </div>
        </div>

        <div className="border-t border-slate-700 pt-3">
          <h4 className="text-sm font-semibold text-blue-400 mb-2">Vessel Information</h4>
          <div className="text-sm text-slate-300 space-y-1">
            <p><span className="text-slate-500">Name:</span> {formData.vessel_name}</p>
            {formData.vessel_year && <p><span className="text-slate-500">Year:</span> {formData.vessel_year}</p>}
            {formData.vessel_length && <p><span className="text-slate-500">Length:</span> {formData.vessel_length}</p>}
            {formData.vessel_hull_number && <p><span className="text-slate-500">Hull #:</span> {formData.vessel_hull_number}</p>}
            {formData.boat_wifi_name && <p><span className="text-slate-500">WiFi Name:</span> {formData.boat_wifi_name}</p>}
            {formData.boat_wifi_password && <p><span className="text-slate-500">WiFi Password:</span> {formData.boat_wifi_password}</p>}
          </div>
        </div>

        {(formData.agreed_arrival_time || formData.agreed_departure_time) && (
          <div className="border-t border-slate-700 pt-3">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Vessel Availability Schedule</h4>
            <div className="text-sm text-slate-300 space-y-1">
              {formData.agreed_arrival_time && <p><span className="text-slate-500">Arrival Time:</span> {formData.agreed_arrival_time}</p>}
              {formData.agreed_departure_time && <p><span className="text-slate-500">Departure Time:</span> {formData.agreed_departure_time}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = () => {
    setShowPrintPreview(true);
  };

  const renderStep6 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Printable Agreement Preview</h3>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Agreement
        </button>
      </div>

      <div id="printable-agreement" className="bg-white text-black p-8 rounded-lg print:shadow-none">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">VESSEL MANAGEMENT AGREEMENT 2026</h1>
          <p className="text-sm">AZ Marine - Antelope Point Holdings Marina</p>
        </div>

        <div className="mb-6 border-b pb-4">
          <h2 className="text-lg font-bold mb-3">Agreement Information</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold">Season:</p>
              <p>{formData.season_name} ({formData.season_year})</p>
            </div>
            <div>
              <p className="font-semibold">Contract Date:</p>
              <p>{formData.contract_date}</p>
            </div>
            <div>
              <p className="font-semibold">Period:</p>
              <p>{formData.start_date} to {formData.end_date}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b pb-4">
          <h2 className="text-lg font-bold mb-3">Parties to Agreement</h2>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">AZ Marine (Liaison)</h3>
            <p className="text-sm">Authorized vendor of Antelope Point Holdings LLC</p>
            <p className="text-sm">Phone: 928-637-6500</p>
            <p className="text-sm">Website: www.azmarine.net</p>
            <p className="text-sm">Email: jeff@azmarine.net, sales@azmarine.net, service@azmarine.net</p>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Manager Information (Boatco Representative)</h3>
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Name:</span> {formData.manager_name}</p>
              <p><span className="font-medium">Email:</span> {formData.manager_email}</p>
              {formData.manager_phone && <p><span className="font-medium">Phone:</span> {formData.manager_phone}</p>}
              {formData.manager_address && <p><span className="font-medium">Address:</span> {formData.manager_address}</p>}
            </div>
          </div>
        </div>

        <div className="mb-6 border-b pb-4">
          <h2 className="text-lg font-bold mb-3">Vessel Information</h2>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Vessel Name:</span> {formData.vessel_name}</p>
            {formData.vessel_year > 0 && <p><span className="font-medium">Year:</span> {formData.vessel_year}</p>}
            {formData.vessel_length && <p><span className="font-medium">Length:</span> {formData.vessel_length}</p>}
            {formData.vessel_hull_number && <p><span className="font-medium">Hull Number:</span> {formData.vessel_hull_number}</p>}
            {formData.boat_wifi_name && <p><span className="font-medium">WiFi Name:</span> {formData.boat_wifi_name}</p>}
            {formData.boat_wifi_password && <p><span className="font-medium">WiFi Password:</span> {formData.boat_wifi_password}</p>}
          </div>
        </div>

        {(formData.agreed_arrival_time || formData.agreed_departure_time) && (
          <div className="mb-6 border-b pb-4">
            <h2 className="text-lg font-bold mb-3">Vessel Availability Schedule</h2>
            <div className="text-sm space-y-1">
              {formData.agreed_arrival_time && <p><span className="font-medium">Agreed Arrival Time:</span> {formData.agreed_arrival_time}</p>}
              {formData.agreed_departure_time && <p><span className="font-medium">Agreed Departure Time:</span> {formData.agreed_departure_time}</p>}
            </div>
          </div>
        )}

        <div className="mb-6 border-b pb-4">
          <h2 className="text-lg font-bold mb-3">Financial Terms</h2>
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span>Annual Management Fee:</span>
              <span className="font-semibold">$8,000.00</span>
            </div>
            <div className="flex justify-between">
              <span>Season Trips:</span>
              <span className="font-semibold">{formData.season_trips || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Off Season Trips:</span>
              <span className="font-semibold">{formData.off_season_trips || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Trips:</span>
              <span className="font-semibold">{(formData.season_trips || 0) + (formData.off_season_trips || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>Per Trip Inspection Fee:</span>
              <span className="font-semibold">${(formData.per_trip_fee || 350).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Trip Cost:</span>
              <span className="font-semibold">${(((formData.season_trips || 0) + (formData.off_season_trips || 0)) * (formData.per_trip_fee || 350)).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <span className="font-bold">Grand Total:</span>
              <span className="font-bold">${(8000 + (((formData.season_trips || 0) + (formData.off_season_trips || 0)) * (formData.per_trip_fee || 350))).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b pb-4">
          <h2 className="text-lg font-bold mb-3">Agreement Consent</h2>
          <div className="text-sm space-y-2">
            <div className="flex items-start">
              <span className={`mr-2 ${formData.consent_office_scheduling ? 'text-emerald-500' : 'text-red-500'}`}>
                {formData.consent_office_scheduling ? '✓' : '✗'}
              </span>
              <span>
                <strong>Office Scheduling:</strong> All new work must be scheduled through the office phone numbers (928-637-6500) and not directly with employees.
              </span>
            </div>
            <div className="flex items-start">
              <span className={`mr-2 ${formData.consent_payment_terms ? 'text-emerald-500' : 'text-red-500'}`}>
                {formData.consent_payment_terms ? '✓' : '✗'}
              </span>
              <span>
                <strong>Payment Terms:</strong> All payments will be sent within 48 hours of work being completed.
              </span>
            </div>
          </div>
        </div>

        <div className="mb-6 border-b pb-4">
          <h2 className="text-lg font-bold mb-3">Management Team Contacts</h2>

          {(formData.manager_repair_approval_name || formData.manager_repair_approval_email || formData.manager_repair_approval_phone) && (
            <div className="mb-3">
              <h3 className="font-semibold mb-1">Repair Approval Contact</h3>
              <div className="text-sm space-y-1">
                {formData.manager_repair_approval_name && <p><span className="font-medium">Name:</span> {formData.manager_repair_approval_name}</p>}
                {formData.manager_repair_approval_email && <p><span className="font-medium">Email:</span> {formData.manager_repair_approval_email}</p>}
                {formData.manager_repair_approval_phone && <p><span className="font-medium">Phone:</span> {formData.manager_repair_approval_phone}</p>}
              </div>
            </div>
          )}

          {(formData.manager_billing_approval_name || formData.manager_billing_approval_email || formData.manager_billing_approval_phone) && (
            <div>
              <h3 className="font-semibold mb-1">Billing Approval Contact</h3>
              <div className="text-sm space-y-1">
                {formData.manager_billing_approval_name && <p><span className="font-medium">Name:</span> {formData.manager_billing_approval_name}</p>}
                {formData.manager_billing_approval_email && <p><span className="font-medium">Email:</span> {formData.manager_billing_approval_email}</p>}
                {formData.manager_billing_approval_phone && <p><span className="font-medium">Phone:</span> {formData.manager_billing_approval_phone}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 page-break-before">
          <h2 className="text-lg font-bold mb-3">Agreement Terms & Conditions</h2>

          <div className="text-xs space-y-1.5 leading-relaxed">
            <p className="font-semibold">This Inspection Agreement ("Agreement")</p>
            <p>is made between AZ Marine, an authorized vendor of Antelope Point Holdings LLC, as operator and liaison (hereinafter "Liaison") of Antelpe Point Holdings Marina at Lake Powell (the "Marina") and <strong>{formData.vessel_name || '___________________________'}</strong> as the President or other designated representative of the corporation, limited liability company, limited partnership or other legal entity ("Boatco"), which owns vessels at and on the Marina. (Collectively, Liaison and Boatco are the "Parties" to this Agreement) entered on <strong>{formData.contract_date ? new Date(formData.contract_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '_________________'}</strong>.</p>

            <h3 className="font-bold text-sm mt-3">Recitals</h3>

            <p><strong>A:</strong> The Parties to this Agreement desire to have a central point of communication to handle Mechanical Inspections and maintenance issues and establish terms and conditions for Boatco's use of the Marina. Authorized contact information;</p>
            <p className="ml-4">AZ Marine approved contact information are as follows:</p>
            <p className="ml-4">Phone 928-637-6500</p>
            <p className="ml-4">Website www.azmarine.net</p>
            <p className="ml-4">Email accounts jeff@azmarine.net , karen.stanley17@gmail.com, sales@azmarine.net , service@azmarine.net</p>
            <p className="ml-4">AZ Marine is using the web-based app My Yacht Time to schedule repairs and communicate with all owners and managers; billing will also be managed within this program. www.myyachttime.com fees for the use of this app are included in the standard management fees.</p>
            <p className="ml-4">Company's Mailing address PO BOX 2184 Flagstaff AZ. 86003 (we are unable to get mail directly at the store so it will be returned if you send anything by US Mail. USP and FedEx only)</p>
            <p className="ml-4">With respect to our valued employees, we ask you to please use these forms of contact only. If an employee calls from their personal cellphone, that is for them to get a clear understanding of the services needed or being requested. All scheduling for services must go through the office phone numbers, please do not call employees directly to schedule new services. Customers that abuse this policy will cause this contract to be canceled and/or voided.</p>

            <p><strong>B:</strong> The Marina provides a harbor for vessels of all kinds (" Vessel(s)) at Lake Powell.</p>

            <p><strong>C:</strong> Az Marine as Liaison has the exclusive executive authority to handle Mechanical Inspections and maintenance matters for the Marina and will serve as the central point of contact between the parties.</p>

            <p><strong>D:</strong> Boatco is an organization of vessel owners who use the Marina.</p>

            <p><strong>E:</strong> Boatco holds title or property interest in the vessels.</p>

            <p><strong>F:</strong> Boatco represents the owners and holders of shares, interest and equity in Boatco in all matters arising out of this Agreement including all matters relating to the vessels' location and use in the Marina, regardless of whether the claim is based on contact, tort, liability, product liability or otherwise.</p>

            <p><strong>G:</strong> By their purchase of their equity interest in Boatco and their selection of the President and Treasurer or other authorized representative(s) of Boatco, the individual shareholders, members, partners and any other equity holders ("Equity Owners") agree and hereby deem that Boatco shall be the exclusive representative of the Equity Owners in all matters including the Services provided hereunder as well as all claims for personal injury or any other claims arising out of their operation and use of the vessels.</p>

            <p><strong>H:</strong> Liaison provides Mechanical Inspections and maintenance services for the vessels in the Marina. This includes service technicians who are qualified to provide the various repair, maintenance and renovations services needed for the vessels kept at the Marina.</p>

            <p><strong>I:</strong> While some maintenance and repair services can be performed during the season when the vessels are being used ("Services"), typically vessels also need service that cannot be done while the vessel is in the water and being used, but only when the season is over and the vessels are on land in storage ("Off-Season Services"). Most Equity Owners and vessel users are gone from the Marina when the Off-Season Services are performed.</p>

            <p><strong>J:</strong> Boatco desires to have Liaison provide its Mechanical inspections and Maintenance services, including the repair and maintenance Services and Off-Season Services to Boatco.</p>

            <p className="mt-2">Therefore, for the consideration stated herein the Parties agree as follows,</p>

            <h3 className="font-bold text-sm mt-3">Terms and Conditions</h3>

            <p><strong>1.</strong> Liaison will provide mechanical inspections and maintenance service to Boatco included a Maintenance budget for during season and any off-season repairs needed.</p>

            <p><strong>2.</strong> Boatco, on behalf of each Equity Owner and vessel, on or before <strong className="border-b border-black px-2">{formData.contract_date || '________________'}</strong> the contract Start date, shall pay an annual management fee of $ 8000.00" Annual Fee"), in addition to the Annual Fee the Boatco agrees to pay the Liaison $350.00 per turn to do a full 2-hour mechanical inspection of the boat, and will provide the Boatco a report with the findings. The estimated number of trips for this agreement will be <strong className="border-b border-black px-2">{(formData.season_trips || 0) + (formData.off_season_trips || 0)}</strong> this will include <strong className="border-b border-black px-2">{formData.season_trips || 0}</strong> in season trips and <strong className="border-b border-black px-2">{formData.off_season_trips || 0}</strong> off-season trips at $350.00 each totaling <strong className="border-b border-black px-2">${(((formData.season_trips || 0) + (formData.off_season_trips || 0)) * 350).toFixed(2)}</strong>. For a grand total of <strong className="border-b border-black px-2">${(8000 + (((formData.season_trips || 0) + (formData.off_season_trips || 0)) * 350)).toFixed(2)}</strong> This is a one-time fee per season payable to the Liaison, the Boatco understands that repairs and maintenance will be additional.</p>

            <p><strong>3.</strong> Rates and Billing. During the term of this Agreement, for any work done on the APM Marina or in dry storage, AZ Marine is required to charge a surcharge of 15% pre-tax per invoice. The 15% will be capped at a retail invoice of $50,000. This 15% will be paid to APM for access to APM properties by AZ Marine. The 15% is non-negotiable. Rates for house systems and gasoline engines will be $175.00 per hour; all diesel engine repairs are $210.00 per hour. Up-lake service calls are not subject to any surcharges and will be paid directly to the Liaison. Up-lake rates are as follows: $750.00 chase boat launch fee (this charge includes all fuel for the work boat) and $325.00 per hour. The hourly charge starts once the chase boat leaves the breakwater, until it returns to the breakwater. If an employee has to use diving gear to repair the boat, there will be an additional dive fee of $500.00 per hour, with a one (1) hour minimum, added to the bill. The rates listed in this Section apply to standard service calls only; emergency response and towing are billed at separate rates. Up-lake billing will be due within 48 hours of Boatco receiving the invoice. Payments made directly to the Liaison will be made only by My Yacht Time ACH. If Boatco needs to pay by credit card, a fee of 3% will be added. Paper checks are not accepted for payment. All payments are due within 48 hours of services being completed. Any invoice not paid on time may be subject to an 18% interest charge.</p>

            <p><strong>4.</strong> Agreement as Condition. Becoming a party to and adherence to the terms of this Agreement shall be a condition of using the Marina.</p>

            <p><strong>5.</strong> Liaison. The Parties hereby agree that Liaison shall be the central point of communication for mechanical inspections, maintenance and other matters involving or relating to the Marina.</p>

            <p><strong>6.</strong> Liaison's Rights and Responsibilities. In its dealings with the Boatco representatives, Liaison's authority, rights and responsibilities shall include, without limitation, the following:</p>
            <div className="pl-3 space-y-1">
              <p>A - Conducting check-off inspections and pre-trip inspections; these inspections will be documented electronically. The Boatco president can request access to records. Any inspections of the vessel and determining in the Liaison's sole discretion any and all needed repairs and maintenance, including without limitation services needed for health, safety, and legal compliance, as well as the Services and Off-Season Services.</p>
              <p>B-Negotiating and signing of Marina use agreements.</p>
              <p>C-Collecting Marina use fees and related payments.</p>
              <p>D-Coordinating and/or providing various management and maintenance services for the Boatco owners and the Marina.</p>
              <p>E - Coordinating, without limitation, the above-listed repair, maintenance, and upkeep services by and with the authorized service technicians and other qualified personnel. This includes coordinating all turn services.</p>
              <p>F-Complying with applicable law.</p>
              <p>G - Enforcing the Marina's Rules and Regulations and applicable law (collectively, the above items shall, without limitation, constitute and be referred to as the "Services", including the Off-Season Services referred to herein).</p>
              <p>H-Doing all things necessary to provide the optimum level of Mechanical Inspections and vessel maintenance for the Boatco and the Marina.</p>
              <p>I - Taking all steps necessary to ensure the Equity Owner or vessel user timely and promptly vacates the vessel by the agreed-upon time in the contract on its last day of use. This means you must be in the slip and offloaded prior to the agreed-upon time. Equity Owners or vessel owners that don't have a dedicated mooring slip must depart before the agreed-upon time; failure to do so shall subject Boatco to an additional charge of $500 per each half hour of delay ("Late Departure Fee"). Prompt departure is absolutely necessary because Liaison and its service providers have only the hours between 7am and 6pm of the same day to perform necessary Services to prepare the vessel for occupancy and use by the next user Equity Owner at 6pm. Late Departure Fees not paid by the Equity Owner or vessel user within 5 days shall be billed to and payable by Boatco.</p>
              <p>J - The authority and mandate to take corrective action to implement and enforce the above Services (collectively, "Corrective Action") as determined in good faith in Liaison's sole discretion.</p>
            </div>

            <p><strong>7.</strong> Hold Harmless, Release and Waiver. In the event Boatco or a vessel user works on his/her own vessel, or uses a third-party vendor (which must be approved in writing by the Liaison prior to any work being done), or uses the vessel after being advised by Liaison or with knowledge that use of the vessel in the Marina may not be safe or prudent, Boatco and/or the vessel user do so at their own risk and hereby release and waive any claims against Liaison, the Marina or any principal or agent of the same, and shall hold harmless and indemnify them against any and all claims. Boatco shall indemnify Liaison and Marina as well as their principals and agents from any event or claims arising out of use of a Boatco vessel in the Marina, regardless of whether the user was or was not an equity holder in Boatco. Vessel users may be required to sign a hold harmless agreement and waiver at the time of usage in the Marina if such use occurs after receiving advice or having knowledge that using the vessel in that condition was unsafe or imprudent.</p>

            <p><strong>8.</strong> Term and Termination</p>
            <div className="pl-3 space-y-1">
              <p>A - The term of this Agreement shall be for not less than one (1) year and will automatically renew for successive one-year terms until termination.</p>
              <p>B - Boatco commits to this minimum term of one year, after which Boatco may opt out of the Agreement with a 30-day notice.</p>
              <p>C - Liaison may terminate this Agreement with ten (10) days' prior notice and, in its sole discretion (depending on circumstances), terminate Boatco's (and a vessel user's) access to and use of the Marina, and any other agreement between the Parties or between Boatco and third-party vendors.</p>
              <p>D - This Agreement, as well as access to and use of the Marina, may be terminated without prior notice at any time by the Liaison for good cause. "Cause" includes, without limitation, Boatco's (or a vessel user's) failure to take Corrective Action, negligent or improper use of the Marina, willful or reckless misconduct, or criminal activities.</p>
              <p>E - If this Agreement is canceled by either the Liaison or Boatco, for any reason, there will be no discounts on the contract and no refunds of any fees paid.</p>
            </div>

            <p><strong>9.</strong> Corrective action and Enforcement. Liaison shall have necessary and proper authority to enforce the Corrective Actions. Boatco's failure to complete such Corrective Action with in ten (10) days of written notice of the same shall constitute a breach of this Agreement. In the event the Corrective Action, or cause for same, cannot be completed with-in ten (10) days then the Boatco shall commence, or cause the vessel user to commence, the necessary Corrective Action, proceed diligently to it conclusion and keep the Liaison informed as to the process.</p>

            <p><strong>10.</strong> Warranty Disclaimer, Liaison agrees to service as contact liaison and to perform the Services as listed above and warrants that it shall perform same with diligence and the Services shall be of workmanlike quality. Liaison makes no other warranties express or implied regarding the performance of Services including Off-Season Services, of the repair, maintenance, or other service technicians, or of any other person or party. Liaison disclaims any warranties, express or implied, as to availability, suitability, deadlines, interruptions, or fitness for a particular purpose. Marina makes no warranties express or implied.</p>

            <p><strong>11.</strong> Limitation of Liability. Liaison shall not be responsible for, and shall not pay, any amount of incidental, consequential, exemplary, or other direct or indirect damages arising out of Boatco's (or its vessel users') operation of their vessels and any injury to any third party. Liaison shall not be liable to Boatco or the vessel users for contract damages except those arising directly out of this Agreement. Liaison (and Marina) shall not be responsible to Boatco or a vessel user for loss of revenue, loss of profits, loss of goodwill or otherwise, regardless of whether Liaison was advised of the possibility of such losses. In no event shall Liaison's liability hereunder to Boatco or the vessel users exceed the amount paid by Boatco for Liaison Services, regardless of whether the claim is based on contract, tort, strict liability, product liability or otherwise. Liaison is not responsible for any damages or losses sustained by Boatco for any products or services Boatco or a vessel user purchased from any third-party vendor, even if Liaison approved the use of such vendor. In any case, no refunds of Liaison's service fees will be issued, consistent with Section 8-E.</p>

            <p><strong>12.</strong> Time Limitations on Claims. Any claims by Boatco, its vessel users, agent or affiliates shall be brought with-in one year of the date of the alleged breach or injury is, or reasonable should have been, discovered, and within two years of the date of breach or injury regardless of when same is/was discovered.</p>

            <p><strong>13.</strong> Successors and Assigns. This Agreement is not assignable by Boatco, but in any case, shall be binding upon Boatco's the equity Owners and vessel users' successors, assigns, heirs and personal representatives.</p>

            <p><strong>14.</strong> Entire Agreement. This Agreement constitutes the entire agreement and understanding among the Parties hereto and supersedes and prior and contemporaneous agreements, understandings, inducements, and conditions, express or implied, oral, or written, of any nature whatsoever with respect to the subject matter hereof. No amendment of any provision of this Agreement shall be effective against any party unless the party or its lawful agent shall have consented thereto in writing.</p>

            <p><strong>15.</strong> Waiver. Neither the failure of nor any delay on the part of either party to exercise any right, remedy, power or privilege under this Agreement shall operate as a waiver thereof, nor shall any single or partial excise of any right, remedy, power or privilege preclude any other privilege, nor shall any waiver of any right, remedy, power or privilege with respect to any occurrence be constructed as a waiver of any right, remedy, power or privilege, with respect to any other occurrence. No waiver shall be effective unless it is in writing and is signed by the party asserted to have granted such waiver.</p>

            <p><strong>16.</strong> Notices. All notices or other communications to be given by any party to the other Parties shall be in writing, shall be served by personal delivery or by depositing such notices in the United States mail, certified or registered, return receipt requested, with certification or registration and postage charges prepaid, properly addressed and directed to Liaison or Boatco at the addresses set forth below. Any party may designate a different person or place for notices by delivering a written notice to that effect to the other party, which notice shall be effective after the same is received by the other party. Except as expressly provided in the preceding sentence, all notices shall be deemed to have been delivered upon the earlier of (i) actual receipt as evidenced by a return receipt or other delivery receipt, or (ii) two days after such notice and has been deposited for delivery in the office or postal mail box operated by the United States Postal Service.</p>
            <p className="ml-4">If to Liaison: Competition Auto super Center Inc.</p>
            <p className="ml-4">DBA: AZ Marine</p>
            <p className="ml-4">PO Box 2184</p>
            <p className="ml-4">Flagstaff, AZ. 86003</p>
            <p className="ml-4">With a copy to: Antelope Point Holdings LLC.</p>
            <p className="ml-4">537 Marina Parkway</p>
            <p className="ml-4">Page, AZ 86040</p>
            <p className="ml-4">And to Boatco:</p>

            <p><strong>17.</strong> Governing Law, Venue & Jurisdiction: The terms and provisions of this Agreement shall be governed by, construed in accordance with, and interpreted under the laws of the State of Arizona with venue and jurisdiction in Coconino County of Arizona.</p>

            <p><strong>18.</strong> Mediation and Arbitration. Notwithstanding the foregoing in the event a dispute arises out of this Agreement the affected Parties shall meet and confer, with or without legal counsel to resolve this dispute. If the dispute is not resolved within ten (10) days of the written request to meet and confer, then the Parties shall engage in mediation under the auspices of the American Arbitration Association within thirty (30) days. If the dispute is not resolved by and in mediation, then the dispute shall be heard by a single arbitrator under the Commercial Rules of Arbitration of the American Arbitration association. The arbitrator's award shall be final and may be entered as a judgment in any court of competent jurisdiction.</p>

            <p><strong>19.</strong> Attorneys' Fees. If either party institutes a civil action or arbitration against the other party which claims in any way relate to this Agreement. its formation, or its enforcement, the successful party in any such action shall be entitled to recover from the other party reasonable attorneys' fees (not to exceed the actual attorneys' fees incurred), witness fees and expenses, any and all other litigation expenses and court costs incurred in connection with said proceedings.</p>

            <p><strong>20.</strong> Counterparts. This Agreement may be executed in any number of counterparts, each of which shall be deemed to be and original as against any party whose signature appears hereon, and all of which shall together constitute one and the same instrument. This Agreement shall become binding when one or more counterparts hereof, individually or taken together, shall bear the signatures of all of the parties reflected hereon as signatories.</p>

            <p><strong>21.</strong> Invalidity. The invalidity or unenforceability of any covenant, term or condition of this Agreement, or any portion of any covenant, term or condition of this Agreement, shall not affect any other covenant, term or condition or portion hereof, and this Agreement shall remain in effect as if such invalid or unenforceable covenant, term or condition (or portion hereof) was not contained herein or was reduced to enforceable limits by a court.</p>

            <p><strong>22.</strong> Representation by Counsel. Each of the Parties has been represented by or as had the full and fair opportunity to be represented by legal counsel of its, his or her own choice.</p>

            <p><strong>23.</strong> Boatco Responsibility. The Boatco shall provide the items listed in Schedule 1 below with-in ten (10) of the signed Agreement to the Liaison in order for the Liaison to properly execute this Agreement. Failure to do so will cause this agreement to be terminated without a refund.</p>

            <p><strong>24.</strong> Notice of Change in Ownership. The Boatco manager or other authorized representative is responsible for notifying the Liaison in writing of any change in ownership of the vessel or of any equity interest in Boatco within forty-eight (48) hours of the sale or transfer being completed. This notice is required so the Liaison can update owner contact lists, trip schedules, and billing records in My Yacht Time. If Boatco fails to provide timely notice of a change in ownership at any time after this Agreement is signed, Boatco will be charged an administrative fee of $250.00 per occurrence to cover the cost of updating contact lists and trip dates. This fee is payable under the payment terms in Section 3.</p>

            <p><strong>25.</strong> Exclusive Mechanical Service Provider. Once the vessel is under this Agreement, the Liaison shall be the sole and exclusive provider of all mechanical work performed on the vessel. No other vendor, contractor, or individual, including Boatco, its Equity Owners, or vessel users, may perform mechanical work on the vessel for the term of this Agreement, except a third-party vendor approved in writing by the Liaison prior to any work being done, as provided in Section 7.</p>

            <p><strong>26.</strong> My Yacht Time Monitoring System.</p>
            <div className="pl-3 space-y-1">
              <p>A - Equipment Ownership. Any monitoring equipment installed on the vessel is owned by Boatco. Boatco understands and agrees that the My Yacht Time software is the only software compatible with this equipment.</p>
              <p>B - Monitoring Agreement and Pricing. Monitoring services, including alert response, are provided under a separate My Yacht Time Monitoring Agreement. Monitoring fees may be included in or separate from the fees in this Agreement, depending on the agreement signed by Boatco, and pricing may vary.</p>
              <p>C - Termination of This Agreement. If this Agreement ends for any reason, Boatco must subscribe to a My Yacht Time monitoring-only agreement to continue using the monitoring equipment.</p>
              <p>D - No Guarantee. The monitoring system is a convenience tool and does not replace inspections or Boatco's responsibility for the vessel. The Liaison is not liable for any loss or damage resulting from a failure of the equipment, software, power, or cellular or internet service, or from any alert that is delayed or not delivered.</p>
              <p>E - Data Consent. Boatco consents to the collection of vessel data through the monitoring system, including location, bilge, pump, and battery data, and agrees that the Liaison may access and view this data.</p>
            </div>

            <p><strong>27.</strong> Emergency Response and Right of First Refusal.</p>
            <div className="pl-3 space-y-1">
              <p>A - Emergency Events. All emergency response for the vessel must go through the Liaison. An emergency includes, without limitation, mechanical failure, the vessel being blown off the beach, the vessel striking a rock or other object and taking on water, or the vessel sinking.</p>
              <p>B - Right of First Refusal. Boatco and its vessel users shall notify the Liaison first of any emergency event, and the Liaison shall have the right of first refusal for all response, recovery, salvage, and repair work related to that event. If the Liaison declines the work, Boatco may use another provider.</p>
              <p>C - Fee for Failure to Offer First Refusal. If Boatco or a vessel user does not give the Liaison the right of first refusal and uses another provider, Boatco shall pay the Liaison a fee equal to ten percent (10%) of the total bill charged by the responding party. This fee is payable under the payment terms in Section 3.</p>
              <p>D - Life Safety Exception. Nothing in this Section prevents anyone from calling 911, the National Park Service, or the U.S. Coast Guard when there is a risk to human life or safety, and no fee under this Section applies to that call. Any work on the vessel beyond the immediate life-safety response remains subject to this Section.</p>
              <p>E - Unauthorized Responders. Boatco acknowledges that third parties have performed salvage and emergency response work at Lake Powell at no charge in order to be paid through social media channels, and that such work has not been approved by the National Park Service. Boatco and its vessel users shall not use any such responder. If an unauthorized responder performs work on the vessel, Boatco shall pay the Liaison a fee equal to the greater of $10,000.00 or the value of the work performed, calculated at the Liaison's rates in Section 3, in place of the fee in Part C, payable under the payment terms in Section 3.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold mb-2">AZ Marine Representative</p>
              <div className="border-t border-black pt-2 mt-8">
                <p className="text-xs">Signature</p>
              </div>
              <div className="mt-4">
                <p className="text-xs">Date: _________________</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2">Boatco Representative</p>
              <div className="border-t border-black pt-2 mt-8">
                <p className="text-xs">Signature</p>
              </div>
              <div className="mt-4">
                <p className="text-xs">Date: _________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Manager Signature</h3>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-slate-300">
            <p className="font-semibold text-blue-400 mb-2 text-lg">Electronic Signature Required</p>
            <p className="leading-relaxed">By typing your full name below, you agree that this electronic signature is legally binding and equivalent to your handwritten signature. You acknowledge that you have read, understood, and agree to all terms and conditions in this Vessel Management Agreement.</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mt-6">
        <label className="block text-sm font-semibold text-white mb-2">
          Full Name (Manager/Owner Representative) *
        </label>
        <input
          type="text"
          value={formData.owner_signature_name}
          onChange={(e) => setFormData({ ...formData, owner_signature_name: e.target.value })}
          placeholder="Type your full name to sign"
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {formData.owner_signature_name && (
          <div className="mt-4 pt-4 border-t border-slate-600">
            <p className="text-xs text-slate-400 mb-2">Signature Preview:</p>
            <p className="text-2xl font-signature text-blue-400" style={{ fontFamily: 'cursive' }}>
              {formData.owner_signature_name}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        )}
      </div>

      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-slate-300 text-sm">
            <p className="font-semibold text-yellow-400 mb-1">Important Notice</p>
            <p>After you submit this agreement with your signature, it will be sent to AZ Marine for review. Once AZ Marine approves and signs the agreement, it becomes a legally binding contract.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-white mb-4">Final Confirmation</h3>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-slate-300">
            <p className="font-semibold text-blue-400 mb-2 text-lg">Ready to Submit?</p>
            <p className="leading-relaxed">By submitting this agreement, it will be sent to AZ Marine for review and approval. You will be notified once a decision is made.</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mt-6">
        <h4 className="text-sm font-semibold text-white mb-3">Agreement Summary</h4>
        <div className="text-sm text-slate-300 space-y-2">
          <p><span className="text-slate-500">Vessel:</span> {formData.vessel_name}</p>
          <p><span className="text-slate-500">Season:</span> {formData.season_name}</p>
          <p><span className="text-slate-500">Manager:</span> {formData.manager_name}</p>
          {formData.agreed_arrival_time && (
            <p><span className="text-slate-500">Arrival Time:</span> {formData.agreed_arrival_time}</p>
          )}
          {formData.agreed_departure_time && (
            <p><span className="text-slate-500">Departure Time:</span> {formData.agreed_departure_time}</p>
          )}
          {formData.owner_signature_name && (
            <p><span className="text-slate-500">Signed By:</span> {formData.owner_signature_name}</p>
          )}
        </div>
      </div>
    </div>
  );

  if (showPrintPreview) {
    const tempAgreement: VesselManagementAgreement = {
      id: existingAgreement?.id || 'preview',
      yacht_id: yacht.id,
      season_year: formData.season_year,
      season_name: formData.season_name,
      start_date: formData.start_date,
      end_date: formData.end_date,
      manager_name: formData.manager_name,
      manager_email: formData.manager_email,
      manager_phone: formData.manager_phone,
      manager_address: formData.manager_address,
      vessel_name: formData.vessel_name,
      vessel_year: formData.vessel_year,
      vessel_length: formData.vessel_length,
      vessel_make_model: yacht.manufacturer || '',
      special_provisions: formData.special_provisions,
      additional_services: formData.additional_services,
      season_trips: formData.season_trips,
      off_season_trips: formData.off_season_trips,
      per_trip_fee: formData.per_trip_fee,
      agreed_arrival_time: formData.agreed_arrival_time,
      agreed_departure_time: formData.agreed_departure_time,
      status: existingAgreement?.status || 'draft',
      submitted_by: userId,
      created_at: existingAgreement?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      owner_signature_name: formData.owner_signature_name,
      owner_signature_date: existingAgreement?.owner_signature_date || null,
      owner_signature_ip: existingAgreement?.owner_signature_ip || null,
      staff_signature_name: existingAgreement?.staff_signature_name || null,
      staff_signature_date: existingAgreement?.staff_signature_date || null,
      staff_signature_ip: existingAgreement?.staff_signature_ip || null,
      approved_by: existingAgreement?.approved_by || null,
      approved_at: existingAgreement?.approved_at || null,
      submitted_at: existingAgreement?.submitted_at || null,
      rejection_reason: existingAgreement?.rejection_reason || null,
      contract_date: formData.contract_date,
      vessel_hull_number: formData.vessel_hull_number,
      manager_repair_approval_name: formData.manager_repair_approval_name,
      manager_repair_approval_email: formData.manager_repair_approval_email,
      manager_repair_approval_phone: formData.manager_repair_approval_phone,
      manager_billing_approval_name: formData.manager_billing_approval_name,
      manager_billing_approval_email: formData.manager_billing_approval_email,
      manager_billing_approval_phone: formData.manager_billing_approval_phone,
      boat_wifi_name: formData.boat_wifi_name,
      boat_wifi_password: formData.boat_wifi_password,
      consent_office_scheduling: formData.consent_office_scheduling,
      consent_payment_terms: formData.consent_payment_terms,
    };

    return <PrintableVesselAgreement agreement={tempAgreement} onClose={() => setShowPrintPreview(false)} />;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-slate-700">
        <div className="bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-white" />
            <h2 className="text-xl font-bold text-white">
              {existingAgreement ? 'Edit' : 'New'} Vessel Management Agreement
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {existingAgreement?.status === 'rejected' && existingAgreement.rejection_reason && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-red-400 font-semibold mb-1">Agreement Previously Rejected</h4>
                  <p className="text-sm text-slate-300 mb-2">This agreement was rejected with the following reason:</p>
                  <p className="text-sm text-red-300 italic bg-red-950/30 rounded p-2">{existingAgreement.rejection_reason}</p>
                  <p className="text-xs text-slate-400 mt-2">Please address the issues mentioned above before resubmitting.</p>
                </div>
              </div>
            </div>
          )}
          {renderStepIndicator()}

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep4()}
          {currentStep === 4 && renderStep5()}
          {currentStep === 5 && renderStep6()}
          {currentStep === 6 && renderStep7()}
          {currentStep === 7 && renderStep8()}

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 bg-emerald-500/10 border border-emerald-500 text-emerald-500 px-4 py-3 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {(!existingAgreement || existingAgreement.status === 'draft') && currentStep < 7 && (
              <button
                onClick={() => handleSaveDraft(false)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
            )}

            {currentStep < 7 ? (
              <button
                onClick={nextStep}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {loading ? 'Submitting...' : 'Submit Agreement'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
