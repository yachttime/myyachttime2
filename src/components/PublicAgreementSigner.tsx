import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle, Clock, Anchor } from 'lucide-react';
import { supabase as anonClient } from '../lib/supabase';

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
  vessel_make_model?: string;
  vessel_year?: number;
  vessel_length?: string;
  vessel_hull_number?: string;
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

function fmt(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function fmtShort(d?: string) {
  if (!d) return 'TBD';
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function cur(n?: number, fallback = 0) {
  return `$${(n ?? fallback).toFixed(2)}`;
}

function daysLeft(createdAt?: string): number {
  if (!createdAt) return 0;
  const expiry = new Date(createdAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function PublicAgreementSigner({ token }: Props) {
  const [state, setState] = useState<PageState>('loading');
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [consentOfficeScheduling, setConsentOfficeScheduling] = useState(false);
  const [consentPaymentTerms, setConsentPaymentTerms] = useState(false);
  const [repairName, setRepairName] = useState('');
  const [repairEmail, setRepairEmail] = useState('');
  const [repairPhone, setRepairPhone] = useState('');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [signedAt, setSignedAt] = useState('');

  useEffect(() => { loadAgreement(); }, [token]);

  const loadAgreement = async () => {
    if (!token || token.length < 10) { setState('invalid'); return; }
    try {
      const { data, error } = await anonClient.rpc('get_agreement_by_signing_token', { p_token: token });
      if (error || !data || data.length === 0) { setState('invalid'); return; }
      const ag: Agreement = data[0];
      if (ag.owner_signature_date) { setAgreement(ag); setState('already_signed'); return; }
      if (!ag.signing_token_created_at || daysLeft(ag.signing_token_created_at) <= 0) { setState('expired'); return; }
      setAgreement(ag); setState('ready');
    } catch { setState('error'); }
  };

  const handleSign = async () => {
    if (!consentOfficeScheduling) { setError('You must acknowledge the Office Scheduling policy'); return; }
    if (!consentPaymentTerms) { setError('You must acknowledge the Payment Terms policy'); return; }
    if (!repairName.trim()) { setError('Management Team Repair Approval name is required'); return; }
    if (!repairEmail.trim()) { setError('Management Team Repair Approval email is required'); return; }
    if (!repairPhone.trim()) { setError('Management Team Repair Approval phone is required'); return; }
    if (!billingName.trim()) { setError('Management Team Billing Approval name is required'); return; }
    if (!billingEmail.trim()) { setError('Management Team Billing Approval email is required'); return; }
    if (!billingPhone.trim()) { setError('Management Team Billing Approval phone is required'); return; }
    if (!signatureName.trim()) { setError('Please enter your full legal name'); return; }
    setSigning(true); setError('');
    try {
      const { data, error } = await anonClient.rpc('sign_agreement_by_token', {
        p_token: token,
        p_signature_name: signatureName.trim(),
        p_consent_office_scheduling: consentOfficeScheduling,
        p_consent_payment_terms: consentPaymentTerms,
        p_repair_approval_name: repairName.trim(),
        p_repair_approval_email: repairEmail.trim(),
        p_repair_approval_phone: repairPhone.trim(),
        p_billing_approval_name: billingName.trim(),
        p_billing_approval_email: billingEmail.trim(),
        p_billing_approval_phone: billingPhone.trim(),
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
    } finally { setSigning(false); }
  };

  if (state === 'loading') return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-600 mx-auto mb-4" />
        <p className="text-gray-500">Loading agreement…</p>
      </div>
    </div>
  );

  if (state === 'invalid') return <StatusPage icon="error" title="Invalid Link" message="This signing link is invalid or does not exist. Please contact AZ Marine for assistance." />;
  if (state === 'expired') return <StatusPage icon="clock" title="Link Expired" message="This signing link has expired (links are valid for 30 days). Please contact AZ Marine to request a new link." />;
  if (state === 'error') return <StatusPage icon="error" title="Something Went Wrong" message="Unable to load the agreement. Please try refreshing the page or contact AZ Marine." />;

  if (state === 'already_signed') return (
    <StatusPage
      icon="check"
      title="Already Signed"
      message={`This agreement has already been signed${agreement?.owner_signature_name ? ` by ${agreement.owner_signature_name}` : ''}${agreement?.owner_signature_date ? ` on ${new Date(agreement.owner_signature_date).toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })}` : ''}.`}
    />
  );

  if (state === 'signed') return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Agreement Signed</h1>
        <p className="text-gray-600 mb-6">
          You have successfully signed the <strong>{agreement?.season_name}</strong> vessel management agreement for <strong>{agreement?.vessel_name}</strong>.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Signed by</span>
            <span className="text-gray-900 font-medium">{signatureName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Date &amp; Time</span>
            <span className="text-gray-900">{signedAt}</span>
          </div>
        </div>
        <p className="text-gray-400 text-sm">AZ Marine has been notified. You may close this window.</p>
      </div>
    </div>
  );

  const ag = agreement!;
  const annualFee = Number(ag.annual_fee) ?? 8000;
  const perTripFee = Number(ag.per_trip_fee) || 350;
  const totalTrips = (ag.season_trips || 0) + (ag.off_season_trips || 0);
  const totalTripCost = totalTrips * perTripFee;
  const grandTotal = Number(ag.grand_total) || annualFee + totalTripCost;
  const expiryDays = daysLeft(ag.signing_token_created_at);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
            <Anchor className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-none">AZ Marine</p>
            <p className="text-gray-400 text-xs">Vessel Management Agreement</p>
          </div>
        </div>
        {expiryDays <= 7 && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs">
            <Clock className="w-3.5 h-3.5" />
            <span>Expires in {expiryDays}d</span>
          </div>
        )}
      </div>

      {/* Agreement document — white paper style */}
      <div className="max-w-4xl mx-auto px-6 py-10 print:py-4">

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">VESSEL MANAGEMENT AGREEMENT</h1>
          <p className="text-lg text-gray-700">{ag.season_name}</p>
        </div>

        {/* Dates */}
        <div className="mb-6 text-sm space-y-1">
          {ag.start_date && <p><strong>Effective Date:</strong> {fmt(ag.start_date)}</p>}
          {ag.start_date && ag.end_date && <p><strong>Term:</strong> {fmt(ag.start_date)} through {fmt(ag.end_date)}</p>}
        </div>

        {/* Parties */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">PARTIES TO THIS AGREEMENT</h2>
          <div className="mb-4">
            <h3 className="font-bold mb-1">VESSEL OWNER/MANAGER:</h3>
            <p>{ag.manager_name}</p>
            {ag.manager_address && <p>{ag.manager_address}</p>}
            <p>Email: {ag.manager_email}</p>
            {ag.manager_phone && <p>Phone: {ag.manager_phone}</p>}
          </div>
          <div>
            <h3 className="font-bold mb-1">MANAGEMENT COMPANY:</h3>
            <p>AZ Marine Services</p>
          </div>
        </div>

        {/* Vessel */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">VESSEL INFORMATION</h2>
          <p><strong>Vessel Name:</strong> {ag.vessel_name}</p>
          {ag.vessel_make_model && <p><strong>Make/Model:</strong> {ag.vessel_make_model}</p>}
          {ag.vessel_year && <p><strong>Year:</strong> {ag.vessel_year}</p>}
          {ag.vessel_length && <p><strong>Length:</strong> {ag.vessel_length}</p>}
          {ag.vessel_hull_number && <p><strong>Hull #:</strong> {ag.vessel_hull_number}</p>}
        </div>

        {/* Schedule */}
        {(ag.agreed_arrival_time || ag.agreed_departure_time) && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">VESSEL AVAILABILITY</h2>
            {ag.agreed_arrival_time && <p><strong>Agreed Arrival Time:</strong> {ag.agreed_arrival_time}</p>}
            {ag.agreed_departure_time && <p><strong>Agreed Departure Time:</strong> {ag.agreed_departure_time}</p>}
          </div>
        )}

        {/* Financial terms */}
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">FINANCIAL TERMS</h2>
          <table className="w-full border-collapse mb-4 text-sm">
            <tbody>
              <tr className="border-b border-gray-300">
                <td className="py-2">Annual Management Fee</td>
                <td className="py-2 text-right font-semibold">{cur(annualFee)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-2">Season Trips ({ag.season_trips || 0} trips × {cur(perTripFee)})</td>
                <td className="py-2 text-right">{cur((ag.season_trips || 0) * perTripFee)}</td>
              </tr>
              <tr className="border-b border-gray-300">
                <td className="py-2">Off-Season Trips ({ag.off_season_trips || 0} trips × {cur(perTripFee)})</td>
                <td className="py-2 text-right">{cur((ag.off_season_trips || 0) * perTripFee)}</td>
              </tr>
              <tr className="border-t-2 border-black">
                <td className="py-2 font-bold">TOTAL AGREEMENT VALUE</td>
                <td className="py-2 text-right font-bold text-base">{cur(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Full legal terms */}
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3">Agreement Terms &amp; Conditions</h2>
          <div className="text-xs space-y-2 leading-relaxed text-gray-800">
            <p className="font-semibold">This Inspection Agreement ("Agreement")</p>
            <p>is made between AZ Marine, an authorized vendor of Antelope Point Holdings LLC, as operator and liaison (hereinafter "Liaison") of Antelope Point Holdings Marina at Lake Powell (the "Marina") and <strong className="underline">{ag.vessel_name || '___________________________'}</strong> as the President or other designated representative of the corporation, limited liability company, limited partnership or other legal entity ("Boatco"), which owns vessels at and on the Marina. (Collectively, Liaison and Boatco are the "Parties" to this Agreement) entered on <strong className="underline">{ag.contract_date ? fmt(ag.contract_date) : '_________________'}</strong>.</p>

            <h3 className="font-bold text-sm mt-3">Recitals</h3>

            <p><strong>A:</strong> The Parties to this Agreement desire to have a central point of communication to handle Mechanical Inspections and maintenance issues and establish terms and conditions for Boatco's use of the Marina. Authorized contact information;</p>
            <div className="ml-4 space-y-1">
              <p>AZ Marine approved contact information are as follows:</p>
              <p>Phone 928-637-6500</p>
              <p>Website www.azmarine.net</p>
              <p>Email accounts jeff@azmarine.net, karen.stanley17@gmail.com, sales@azmarine.net, service@azmarine.net</p>
              <p>AZ Marine is using the web-based app My Yacht Time to schedule repairs and communicate with all owners and managers; billing will also be managed within this program. www.myyachttime.com fees for the use of this app are included in the standard management fees.</p>
              <p>Company's Mailing address PO BOX 2184 Flagstaff AZ. 86003 (we are unable to get mail directly at the store so it will be returned if you send anything by US Mail. UPS and FedEx only)</p>
              <p>With respect to our valued employees, we ask you to please use these forms of contact only. If an employee calls from their personal cellphone, that is for them to get a clear understanding of the services needed or being requested. All scheduling for services must go through the office phone numbers, please do not call employees directly to schedule new services. Customers that abuse this policy will cause this contract to be canceled and/or voided.</p>
            </div>

            <p><strong>B:</strong> The Marina provides a harbor for vessels of all kinds ("Vessel(s)") at Lake Powell.</p>
            <p><strong>C:</strong> Az Marine as Liaison has the exclusive executive authority to handle Mechanical Inspections and maintenance matters for the Marina and will serve as the central point of contact between the parties.</p>
            <p><strong>D:</strong> Boatco is an organization of vessel owners who use the Marina.</p>
            <p><strong>E:</strong> Boatco holds title or property interest in the vessels.</p>
            <p><strong>F:</strong> Boatco represents the owners and holders of shares, interest and equity in Boatco in all matters arising out of this Agreement including all matters relating to the vessels' location and use in the Marina, regardless of whether the claim is based on contact, tort, liability, product liability or otherwise.</p>
            <p><strong>G:</strong> By their purchase of their equity interest in Boatco and their selection of the President and Treasurer or other authorized representative(s) of Boatco, the individual shareholders, members, partners and any other equity holders ("Equity Owners") agree and hereby deem that Boatco shall be the exclusive representative of the Equity Owners in all matters including the Services provided hereunder as well as all claims for personal injury or any other claims arising out of their operation and use of the vessels.</p>
            <p><strong>H:</strong> Liaison provides Mechanical Inspections and maintenance services for the vessels in the Marina. This includes service technicians who are qualified to provide the various repair, maintenance and renovations services needed for the vessels kept at the Marina.</p>
            <p><strong>I:</strong> While some maintenance and repair services can be performed during the season when the vessels are being used ("Services"), typically vessels also need service that cannot be done while the vessel is in the water and being used, but only when the season is over and the vessels are on land in storage ("Off-Season Services"). Most Equity Owners and vessel users are gone from the Marina when the Off-Season Services are performed.</p>
            <p><strong>J:</strong> Boatco desires to have Liaison provide its Mechanical inspections and Maintenance services, including the repair and maintenance Services and Off-Season Services to Boatco.</p>
            <p>Therefore, for the consideration stated herein the Parties agree as follows,</p>

            <h3 className="font-bold text-sm mt-3">Terms and Conditions</h3>

            <p><strong>1.</strong> Liaison will provide mechanical inspections and maintenance service to Boatco included a Maintenance budget for during season and any off-season repairs needed.</p>

            <p><strong>2.</strong> Boatco, on behalf of each Equity Owner and vessel, on or before <strong className="underline px-2">{ag.contract_date ? fmtShort(ag.contract_date) : '________________'}</strong> the contract Start date, shall pay an annual management fee of <strong className="underline px-2">{cur(annualFee)}</strong> ("Annual Fee"), in addition to the Annual Fee the Boatco agrees to pay the Liaison $350.00 per turn to do a full 2-hour mechanical inspection of the boat, and will provide the Boatco a report with the findings. The estimated number of trips for this agreement will be <strong className="underline px-2">{totalTrips}</strong> this will include <strong className="underline px-2">{ag.season_trips || 0}</strong> in season trips and <strong className="underline px-2">{ag.off_season_trips || 0}</strong> off-season trips at $350.00 each totaling <strong className="underline px-2">{cur(totalTripCost)}</strong>. For a grand total of <strong className="underline px-2">{cur(grandTotal)}</strong> This is a one-time fee per season payable to the Liaison, the Boatco understands that repairs and maintenance will be additional.</p>

            <p><strong>3.</strong> Rates and billing, during the term of this agreement, any work done on the APM Marina, or in dry storage. AZ Marine is required to charge a surcharge of 15% pre-taxed per invoice. The 15% will be capped at a retail invoice of $50,000. This 15% will be paid to APM for access to APM Properties by AZ Marine. The 15% is non-negotiable. Rates for house systems and Gasoline engines will be $150.00 per hour; All Diesel engine repairs are $175.00 per hour. Up-lake service calls are not subject to any surcharges and will be paid directly to the Liaison. Up-lake rates are as follows, $600.00 Chase boat launch fee, this charge includes all fuel for the work boat, and $275.00 per hour. Hourly charge starts once the chase boat leaves break water, until it returns to break water. If an employee has to use Diving gear to repair the boat there will be an additional $300.00 fee added to the bill. Up-lake billing will be due within 48 hours of the Boatco receiving the invoice. Payments made directly to the Liaison will be done by My Yacht Time ACH with no fees or Credit card. Any invoices paid by credit card over $5,000.00 will have a fee of 3% added. Mailing paper checks must be approved by Liaison, if Boatco mails a paper check without approval, Liaison will suspend all future work until check arrives. All payments are due within 48 hours of services being completed.</p>

            <p><strong>4.</strong> Agreement as Condition. Becoming a party to and adherence to the terms of this Agreement shall be a condition of using the Marina.</p>

            <p><strong>5.</strong> Liaison. The Parties hereby agree that Liaison shall be the central point of communication for mechanical inspections, maintenance and other matters involving or relating to the Marina.</p>

            <p><strong>6.</strong> Liaison's Right and Responsibilities. In its dealings with the Boatco representatives Liaison's authority, rights and responsibilities shall include, without limitation, the following:</p>
            <div className="ml-4 space-y-1">
              <p>A-Conducting Check off inspections and Pre Trip inspections; these inspections will be documented electronically. The Boatco president can request access to records. Any inspections of the vessel and determining in the Liaison's sole discretion any and all needed repairs and maintenance, including without limitation services needed for health, safety, and legal compliance as well as the services and off-season services,</p>
              <p>B-Negotiating and signing of Marina use agreements.</p>
              <p>C-Collecting Marina use fees and related payments.</p>
              <p>D-Coordinating and/or providing various management and maintenance services for the Boatco owners and the Marina.</p>
              <p>E-Coordinating, without limitation, the above-listed repair, maintenance, and upkeep services by and with the authorized service technicians and other qualified personal. This includes coordinating all turn services,</p>
              <p>F-Complying with applicable law.</p>
              <p>G-Enforcing the Marina's Rule and Regulations and applicable law, (collectively, the above items shall, without limitations, constitute as be referred to as the "Services", including the off-season services referred to herein.</p>
              <p>H-Doing all things necessary to provide the optimum level of Mechanical Inspections and vessel maintenance for the Boatco and the Marina.</p>
              <p>I-Taking all steps necessary to ensure the Equity owner or vessel user timely and promptly vacates the vessel by the agreed upon time in the contract of its last day of use. This means you must be in the slip and off loaded prior to the agreed upon time. Equity owners or vessel owner that don't have a dedicated mooring slip, must depart before the agreed upon time failure to do so the Boatco shall be subject to an additional charge of $500 per each half hour of delay ("late departure fee"). Prompt departure is absolutely necessary because Liaison and its Service providers have only the hours between 7am and 6pm of the same day to perform necessary Services to prepare the vessel for the occupancy and use by the next user Equity owner at 6pm. Late Departure Fees not paid by the Equity Owner or vessel user within 5 days shall be billed and payable by the Boatco.</p>
              <p>M-The authority and mandate to take corrective action to implement and enforce the above Service (collectively, "Corrective Action") as determined in good faith in Liaison's sole discretion.</p>
            </div>

            <p><strong>7.</strong> Hold Harmless, Release and Waiver. In the event Boatco or a vessel user works on his/her own vessel, or uses a third party vendor, or uses the vessel after being advised by Liaison or with knowledge that use of the vessel in the Marina may not be safe or Prudent, Boatco and/or vessel user do so at their own risk and hereby release and waive any claims against Liaison, the Marina or any principal or agent of the same and hold harmless and shall indemnify them against any and all claims. Boatco shall indemnify Liaison and Marina as well as their principals and agents from any event or claims arising out of use of a Boatco vessel in the Marina. Regardless of whether the user was or was not an equity holder in Boatco. Vessel users may be required to sign a hold harmless agreement and waiver at the time of usage in the marina if such use occurs after receiving advice or having knowledge that using the vessel in that condition was unsafe or imprudent.</p>

            <p><strong>8.</strong> Terms and Termination</p>
            <div className="ml-4 space-y-1">
              <p>A-The term of this Agreement shall be for not less than one (1) year and will automatically renew for successive one-year terms until termination.</p>
              <p>B-Boatco commits to this minimum term of one year after which Boatco may opts out of the agreement with a 30-day notice.</p>
              <p>C-Liaison may terminate this Agreement with ten (10) days prior notice and in its sole discretion (depending on circumstances) terminate Boatco's (and a vessel user) access to and use of the Marina, and any other agreement between the Parties or Boatco and third-party vendors.</p>
              <p>D-The Agreement as well as access and use of the Marina may be terminated, without prior notice at any time by the Liaison for good cause. "Cause", including, without limitation, Boatco's (or a vessel User's) fail to take Corrective Action, the negligent or improper use of the Marina, willful or reckless misconduct, or criminal activities.</p>
            </div>

            <p><strong>9.</strong> Corrective action and Enforcement. Liaison shall have necessary and proper authority to enforce the Corrective Actions. Boatco's failure to complete such Corrective Action within ten (10) days of written notice of the same shall constitute a breach of this Agreement. In the event the Corrective Action, or cause for same, cannot be completed within ten (10) days then the Boatco shall commence, or cause the vessel user to commence, the necessary Corrective Action, proceed diligently to its conclusion and keep the Liaison informed as to the process.</p>

            <p><strong>10.</strong> Warranty Disclaimer. Liaison agrees to service as contact liaison and to perform the Services as listed above and warrants that it shall perform same with diligence and the Services shall be of workmanlike quality. Liaison makes no other warranties express or implied regarding the performance of Services including Off-Season Services, of the repair, maintenance, or other service technicians, or of any other person or party. Liaison disclaims any warranties, express or implied, as to availability, suitability, deadlines, interruptions, or fitness for a particular purpose. Marina makes no warranties express or implied.</p>

            <p><strong>11.</strong> Limitation of Liability. Liaison shall not be responsible for, and shall not pay, any amount of incidental, consequential, exemplary, or other direct or indirect damages arising out of Boatco's (or its vessel users) operation of their vessels and any injury to any third party. Liaison shall not be liable to Boatco or the vessel users for contract damages except those arising directly out of this Agreement. Liaison (and Marina) shall not be responsible to Boatco or a vessel user for loss of revenue, loss profits, loss of goodwill or otherwise, regardless of whether Liaison was advised of the possibility of such losses. In no event shall Liaison's liability hereunder to the Boatco or the vessel users exceed the amount paid by Boatco for Liaison Services, regardless of whether the claim is based on the contract, tort, strict liability, product liability or otherwise. Liaison is not responsible for any damages or losses sustained by Boatco for any products or services Boatco or vessel user purchased from any third-party Vendor, even if Liaison approved the use of such Vendor. In any case, Boatco's sole remedy shall be a refund of amounts paid for Liaison's service fees.</p>

            <p><strong>12.</strong> Time Limitations on Claims. Any claims by Boatco, its vessel users, agent or affiliates shall be brought within one year of the date of the alleged breach or injury is, or reasonably should have been, discovered, and within two years of the date of breach or injury regardless of when same is/was discovered.</p>

            <p><strong>13.</strong> Successors and Assigns. This Agreement is not assignable by Boatco, but in any case, shall be binding upon Boatco's the equity Owners and vessel users' successors, assigns, heirs and personal representatives.</p>

            <p><strong>14.</strong> Entire Agreement. This Agreement constitutes the entire agreement and understanding among the Parties hereto and supersedes and prior and contemporaneous agreements, understandings, inducements, and conditions, express or implied, oral, or written, of any nature whatsoever with respect to the subject matter hereof. No amendment of any provision of this Agreement shall be effective against any party unless the party or its lawful agent shall have consented thereto in writing.</p>

            <p><strong>15.</strong> Waiver. Neither the failure of nor any delay on the part of either party to exercise any right, remedy, power or privilege under this Agreement shall operate as a waiver thereof, nor shall any single or partial exercise of any right, remedy, power or privilege preclude any other privilege, nor shall any waiver of any right, remedy, power or privilege with respect to any occurrence be construed as a waiver of any right, remedy, power or privilege, with respect to any other occurrence. No waiver shall be effective unless it is in writing and is signed by the party asserted to have granted such waiver.</p>

            <p><strong>16.</strong> Notices. All notices or other communications to be given by any party to the other Parties shall be in writing, shall be served by personal delivery or by depositing such notices in the United States mail, certified or registered, return receipt requested, with certification or registration and postage charges prepaid, properly addressed and directed to Liaison or Boatco at the addresses set forth below. Any party may designate a different person or place for notices by delivering a written notice to that effect to the other party, which notice shall be effective after the same is received by the other party.</p>
            <div className="ml-4 space-y-1">
              <p>If to Liaison: Competition Auto Super Center Inc.</p>
              <p>DBA: AZ Marine</p>
              <p>PO Box 2184</p>
              <p>Flagstaff, AZ 86003</p>
              <p>With a copy to: Antelope Point Holdings LLC.</p>
              <p>537 Marina Parkway</p>
              <p>Page, AZ 86040</p>
              <p>And to Boatco: {ag.manager_name}{ag.manager_address ? `, ${ag.manager_address}` : ''}</p>
            </div>

            <p><strong>17.</strong> Governing Law, Venue &amp; Jurisdiction: The terms and provisions of this Agreement shall be governed by, construed in accordance with, and interpreted under the laws of the State of Arizona with venue and jurisdiction in Coconino County of Arizona.</p>

            <p><strong>18.</strong> Mediation and Arbitration. Notwithstanding the foregoing in the event a dispute arises out of this Agreement the affected Parties shall meet and confer, with or without legal counsel to resolve this dispute. If the dispute is not resolved within ten (10) days of the written request to meet and confer, then the Parties shall engage in mediation under the auspices of the American Arbitration Association within thirty (30) days. If the dispute is not resolved by and in mediation, then the dispute shall be heard by a single arbitrator under the Commercial Rules of Arbitration of the American Arbitration Association. The arbitrator's award shall be final and may be entered as a judgment in any court of competent jurisdiction.</p>

            <p><strong>19.</strong> Attorneys' Fees. If either party institutes a civil action or arbitration against the other party which claims in any way relate to this Agreement, its formation, or its enforcement, the successful party in any such action shall be entitled to recover from the other party reasonable attorneys' fees (not to exceed the actual attorneys' fees incurred), witness fees and expenses, any and all other litigation expenses and court costs incurred in connection with said proceedings.</p>

            <p><strong>20.</strong> Counterparts. This Agreement may be executed in any number of counterparts, each of which shall be deemed to be an original as against any party whose signature appears hereon, and all of which shall together constitute one and the same instrument. This Agreement shall become binding when one or more counterparts hereof, individually or taken together, shall bear the signatures of all of the parties reflected hereon as signatories.</p>

            <p><strong>21.</strong> Invalidity. The invalidity or unenforceability of any covenant, term or condition of this Agreement, or any portion of any covenant, term or condition of this Agreement, shall not affect any other covenant, term or condition or portion hereof, and this Agreement shall remain in effect as if such invalid or unenforceable covenant, term or condition (or portion hereof) was not contained herein or was reduced to enforceable limits by a court.</p>

            <p><strong>22.</strong> Representation by Counsel. Each of the Parties has been represented by or has had the full and fair opportunity to be represented by legal counsel of its, his or her own choice.</p>

            <p><strong>23.</strong> Boatco Responsibility. The Boatco shall provide the items listed in Schedule 1 below within ten (10) days of the signed Agreement to the Liaison in order for the Liaison to properly execute this Agreement. Failure to do so will cause this agreement to be terminated without a refund.</p>
          </div>
        </div>

        {/* AZ Marine signature block */}
        {ag.staff_signature_name && (
          <div className="mb-8 border-t-2 border-black pt-6">
            <h2 className="text-xl font-bold mb-4">AZ MARINE SERVICES SIGNATURE</h2>
            <div className="border-2 border-black rounded p-4 inline-block">
              <p className="font-bold text-lg mb-1">{ag.staff_signature_name}</p>
              {ag.staff_signature_date && (
                <p className="text-sm">Date Signed: {new Date(ag.staff_signature_date).toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })}</p>
              )}
            </div>
          </div>
        )}

        {/* ── Signature panel — sticky at bottom on mobile, inline on desktop ── */}
        <div className="border-t-2 border-black pt-8 pb-12">
          <h2 className="text-xl font-bold mb-6">COMPLETE &amp; SIGN AGREEMENT</h2>

          {/* Consent checkboxes */}
          <div className="mb-8">
            <h3 className="font-bold text-base mb-4 border-b border-gray-300 pb-2">Agreement Consent</h3>
            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consentOfficeScheduling}
                  onChange={(e) => { setConsentOfficeScheduling(e.target.checked); setError(''); }}
                  className="mt-1 w-4 h-4 flex-shrink-0 accent-gray-900 cursor-pointer"
                  disabled={signing}
                />
                <span className="text-sm text-gray-800 leading-relaxed">
                  <strong>Office Scheduling:</strong> I acknowledge that all new work must be scheduled through the office phone numbers (928-637-6500) and not directly with employees. Scheduling services directly with employees without going through the office may result in contract cancellation.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={consentPaymentTerms}
                  onChange={(e) => { setConsentPaymentTerms(e.target.checked); setError(''); }}
                  className="mt-1 w-4 h-4 flex-shrink-0 accent-gray-900 cursor-pointer"
                  disabled={signing}
                />
                <span className="text-sm text-gray-800 leading-relaxed">
                  <strong>Payment Terms:</strong> I agree to send all payments within 48 hours of the work being completed. Failure to comply with this payment schedule may result in suspension of future work.
                </span>
              </label>
            </div>
          </div>

          {/* Repair Approval contact */}
          <div className="mb-8">
            <h3 className="font-bold text-base mb-4 border-b border-gray-300 pb-2">Management Team - Repair Approval</h3>
            <div className="grid grid-cols-1 gap-4 max-w-xl">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  value={repairName}
                  onChange={(e) => { setRepairName(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  disabled={signing}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-red-600">*</span></label>
                <input
                  type="email"
                  value={repairEmail}
                  onChange={(e) => { setRepairEmail(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  disabled={signing}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone <span className="text-red-600">*</span></label>
                <input
                  type="tel"
                  value={repairPhone}
                  onChange={(e) => { setRepairPhone(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  disabled={signing}
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>

          {/* Billing Approval contact */}
          <div className="mb-8">
            <h3 className="font-bold text-base mb-4 border-b border-gray-300 pb-2">Management Team - Billing Approval</h3>
            <div className="grid grid-cols-1 gap-4 max-w-xl">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name <span className="text-red-600">*</span></label>
                <input
                  type="text"
                  value={billingName}
                  onChange={(e) => { setBillingName(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  disabled={signing}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-red-600">*</span></label>
                <input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => { setBillingEmail(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  disabled={signing}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone <span className="text-red-600">*</span></label>
                <input
                  type="tel"
                  value={billingPhone}
                  onChange={(e) => { setBillingPhone(e.target.value); setError(''); }}
                  className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:border-gray-900 transition-colors text-sm"
                  disabled={signing}
                  autoComplete="tel"
                />
              </div>
            </div>
          </div>

          {/* Signature */}
          <div className="max-w-xl space-y-4">
            <h3 className="font-bold text-base border-b border-gray-300 pb-2">Vessel Owner/Manager Signature</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              By entering your full legal name below and clicking <strong>Sign Agreement</strong>, you confirm that you have read and understood all 23 sections of this Vessel Management Agreement and agree to be bound by its terms.
            </p>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                Full Legal Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={signatureName}
                onChange={(e) => { setSignatureName(e.target.value); setError(''); }}
                placeholder="Type your full legal name exactly as it appears on your ID"
                className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-900 transition-colors text-base"
                disabled={signing}
                autoComplete="name"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {expiryDays <= 7 && (
              <p className="text-amber-600 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 flex-shrink-0" />
                This link expires in {expiryDays} day{expiryDays !== 1 ? 's' : ''}. Please sign before it expires.
              </p>
            )}

            <button
              onClick={handleSign}
              disabled={signing || !signatureName.trim() || !consentOfficeScheduling || !consentPaymentTerms}
              className="w-full px-6 py-4 bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-bold text-base"
            >
              {signing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Signing…
                </span>
              ) : 'Sign Agreement'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Signing constitutes a legal electronic signature. This document is binding upon execution.
            </p>
          </div>
        </div>

        <div className="text-xs text-gray-400 border-t pt-4">
          <p>Agreement ID: {ag.id}</p>
          <p>Vessel: {ag.vessel_name} &mdash; {ag.season_name}</p>
        </div>
      </div>
    </div>
  );
}

function StatusPage({ icon, title, message }: { icon: 'check' | 'clock' | 'error'; title: string; message: string }) {
  const iconEl =
    icon === 'check' ? <CheckCircle className="w-10 h-10 text-emerald-600" /> :
    icon === 'clock' ? <Clock className="w-10 h-10 text-amber-500" /> :
    <AlertCircle className="w-10 h-10 text-red-500" />;
  const ringColor =
    icon === 'check' ? 'bg-emerald-50 border-emerald-300' :
    icon === 'clock' ? 'bg-amber-50 border-amber-300' :
    'bg-red-50 border-red-300';
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className={`w-20 h-20 rounded-full ${ringColor} border-2 flex items-center justify-center mx-auto mb-6`}>{iconEl}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{title}</h1>
        <p className="text-gray-600 leading-relaxed mb-6">{message}</p>
        <p className="text-gray-400 text-sm">AZ Marine &mdash; (928) 637-6500</p>
      </div>
    </div>
  );
}
