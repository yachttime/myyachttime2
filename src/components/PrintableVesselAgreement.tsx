import { Download, Eye, X } from 'lucide-react';
import { VesselManagementAgreement } from '../lib/supabase';
import { generateVesselAgreementPDF } from '../utils/pdfGenerator';

interface PrintableVesselAgreementProps {
  agreement: VesselManagementAgreement;
  onClose: () => void;
}

export function PrintableVesselAgreement({ agreement, onClose }: PrintableVesselAgreementProps) {
  const handlePreview = () => {
    try {
      console.log('Generating PDF preview for agreement:', agreement.id);
      const pdf = generateVesselAgreementPDF(agreement);
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      console.log('PDF preview opened successfully');
    } catch (error) {
      console.error('Error generating PDF preview:', error);
      alert('Failed to generate PDF preview. Please check the console for details.');
    }
  };

  const handleDownload = () => {
    try {
      console.log('Generating PDF for agreement:', agreement.id);
      const pdf = generateVesselAgreementPDF(agreement);
      const fileName = `Vessel_Management_Agreement_${agreement.vessel_name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      console.log('Saving PDF as:', fileName);
      pdf.save(fileName);
      console.log('PDF download initiated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please check the console for details.');
    }
  };

  const totalAmount = 8000 + ((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * (agreement.per_trip_fee || 350);

  return (
    <>
      <style>{`
        @media screen {
          .print-wrapper {
            position: fixed;
            inset: 0;
            background: white;
            z-index: 9999;
            overflow-y: auto;
          }
          .print-header {
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            background: #1e293b;
            border-bottom: 1px solid #475569;
            padding: 1rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 10;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          }
          .print-header h2 {
            font-size: 1.25rem;
            font-weight: bold;
            color: white;
            margin: 0;
          }
          .print-header-buttons {
            display: flex;
            gap: 0.5rem;
          }
          .btn-print {
            padding: 0.5rem 1rem;
            background: #0891b2;
            color: white;
            border: none;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          .btn-print:hover {
            background: #0e7490;
          }
          .btn-close {
            padding: 0.5rem 1rem;
            background: #475569;
            color: white;
            border: none;
            border-radius: 0.5rem;
            cursor: pointer;
          }
          .btn-close:hover {
            background: #334155;
          }
          .print-content {
            background: white !important;
            color: black !important;
            padding: 3rem;
            max-width: 8.5in;
            margin: 5rem auto 2rem;
          }
          .print-content * {
            color: black !important;
          }
          .print-content .text-center { text-align: center; }
          .print-content .text-right { text-align: right; }
          .print-content .mb-2 { margin-bottom: 0.5rem; }
          .print-content .mb-3 { margin-bottom: 0.75rem; }
          .print-content .mb-4 { margin-bottom: 1rem; }
          .print-content .mb-6 { margin-bottom: 1.5rem; }
          .print-content .mb-8 { margin-bottom: 2rem; }
          .print-content .mt-2 { margin-top: 0.5rem; }
          .print-content .mt-3 { margin-top: 0.75rem; }
          .print-content .mt-8 { margin-top: 2rem; }
          .print-content .pt-4 { padding-top: 1rem; }
          .print-content .pb-2 { padding-bottom: 0.5rem; }
          .print-content .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
          .print-content .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
          .print-content .p-4 { padding: 1rem; }
          .print-content .ml-4 { margin-left: 1rem; }
          .print-content .pl-3 { padding-left: 0.75rem; }
          .print-content .text-xs { font-size: 0.75rem; line-height: 1rem; }
          .print-content .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
          .print-content .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
          .print-content .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
          .print-content .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
          .print-content .font-bold { font-weight: 700; }
          .print-content .font-semibold { font-weight: 600; }
          .print-content .border-b { border-bottom: 1px solid #000; }
          .print-content .border-b-2 { border-bottom: 2px solid #000; }
          .print-content .border-t { border-top: 1px solid #000; }
          .print-content .border-t-2 { border-top: 2px solid #000; }
          .print-content .border-black { border-color: #000; }
          .print-content .border-2 { border-width: 2px; }
          .print-content .border { border-width: 1px; }
          .print-content .border-gray-300 { border-color: #d1d5db; }
          .print-content .rounded { border-radius: 0.25rem; }
          .print-content .space-y-1 > * + * { margin-top: 0.25rem; }
          .print-content .space-y-1\.5 > * + * { margin-top: 0.375rem; }
          .print-content .leading-relaxed { line-height: 1.625; }
          .print-content .grid { display: grid; }
          .print-content .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .print-content .gap-8 { gap: 2rem; }
          .print-content .w-full { width: 100%; }
          .print-content .border-collapse { border-collapse: collapse; }
          .print-content .bg-gray-50 { background-color: #f9fafb; }
          .print-content .bg-emerald-50 { background-color: #ecfdf5; }
          .print-content .border-emerald-600 { border-color: #059669; }
          .print-content .text-emerald-700 { color: #047857 !important; }
          .print-content .text-emerald-800 { color: #065f46 !important; }
          .print-content .text-gray-500 { color: #6b7280 !important; }
          .print-content .text-gray-600 { color: #4b5563 !important; }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-wrapper,
          .print-wrapper * {
            visibility: visible !important;
          }
          .print-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            overflow: visible !important;
          }
          .print-header {
            display: none !important;
          }
          .print-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            max-width: 100% !important;
            padding: 0.25in !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .print-content * {
            color: black !important;
            visibility: visible !important;
          }
          .print-content p,
          .print-content h1,
          .print-content h2,
          .print-content h3,
          .print-content h4,
          .print-content strong,
          .print-content td,
          .print-content th,
          .print-content div,
          .print-content span {
            color: black !important;
            visibility: visible !important;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          p {
            orphans: 3;
            widows: 3;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: always !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            border-collapse: collapse !important;
          }
          td, th {
            border: 1px solid black !important;
            padding: 0.5rem !important;
          }
          .text-gray-500,
          .text-gray-600 {
            color: #4b5563 !important;
          }
          .text-emerald-700,
          .text-emerald-800 {
            color: #047857 !important;
          }
        }
        @page {
          size: letter;
          margin: 0.5in;
        }
      `}</style>

      <div className="print-wrapper">
        <div className="print-header">
          <h2>Agreement Preview</h2>
          <div className="print-header-buttons">
            <button onClick={handlePreview} className="btn-print">
              <Eye style={{ width: '1rem', height: '1rem' }} />
              Preview PDF
            </button>
            <button onClick={handleDownload} className="btn-print" style={{ background: '#059669' }}>
              <Download style={{ width: '1rem', height: '1rem' }} />
              Download PDF
            </button>
            <button onClick={onClose} className="btn-close">
              <X style={{ width: '1rem', height: '1rem' }} />
            </button>
          </div>
        </div>

        <div className="print-content">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">VESSEL MANAGEMENT AGREEMENT</h1>
          <p className="text-lg">{agreement.season_name}</p>
        </div>

        <div className="mb-6 text-sm">
          <p className="mb-2">
            <strong>Effective Date:</strong> {new Date(agreement.start_date).toLocaleDateString()}
          </p>
          <p className="mb-2">
            <strong>Term:</strong> {new Date(agreement.start_date).toLocaleDateString()} through {new Date(agreement.end_date).toLocaleDateString()}
          </p>
          {agreement.approved_at && (
            <p className="mb-2">
              <strong>Agreement Executed:</strong> {new Date(agreement.approved_at).toLocaleDateString()}
            </p>
          )}
        </div>

        <div className="mb-8 avoid-break">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">PARTIES TO THIS AGREEMENT</h2>

          <div className="mb-4">
            <h3 className="font-bold mb-2">VESSEL OWNER/MANAGER:</h3>
            <p>{agreement.manager_name}</p>
            {agreement.manager_address && <p>{agreement.manager_address}</p>}
            <p>Email: {agreement.manager_email}</p>
            {agreement.manager_phone && <p>Phone: {agreement.manager_phone}</p>}
          </div>

          <div className="mb-4">
            <h3 className="font-bold mb-2">MANAGEMENT COMPANY:</h3>
            <p>AZ Marine Services</p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">VESSEL INFORMATION</h2>
          <p><strong>Vessel Name:</strong> {agreement.vessel_name}</p>
          {agreement.vessel_make_model && <p><strong>Make/Model:</strong> {agreement.vessel_make_model}</p>}
          {agreement.vessel_year && <p><strong>Year:</strong> {agreement.vessel_year}</p>}
          {agreement.vessel_length && <p><strong>Length:</strong> {agreement.vessel_length}</p>}
        </div>

        {(agreement.agreed_arrival_time || agreement.agreed_departure_time) && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">VESSEL AVAILABILITY</h2>
            {agreement.agreed_arrival_time && <p><strong>Agreed Arrival Time:</strong> {agreement.agreed_arrival_time}</p>}
            {agreement.agreed_departure_time && <p><strong>Agreed Departure Time:</strong> {agreement.agreed_departure_time}</p>}
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b-2 border-black pb-2">FINANCIAL TERMS</h2>
          <table className="w-full border-collapse mb-4">
            <tbody>
              <tr className="border-b">
                <td className="py-2">Annual Management Fee</td>
                <td className="py-2 text-right font-semibold">$8,000.00</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Season Trips ({agreement.season_trips || 0} trips × ${(agreement.per_trip_fee || 350).toFixed(2)})</td>
                <td className="py-2 text-right">${((agreement.season_trips || 0) * (agreement.per_trip_fee || 350)).toFixed(2)}</td>
              </tr>
              <tr className="border-b">
                <td className="py-2">Off-Season Trips ({agreement.off_season_trips || 0} trips × ${(agreement.per_trip_fee || 350).toFixed(2)})</td>
                <td className="py-2 text-right">${((agreement.off_season_trips || 0) * (agreement.per_trip_fee || 350)).toFixed(2)}</td>
              </tr>
              <tr className="border-t-2 border-black">
                <td className="py-2 font-bold">TOTAL AGREEMENT VALUE</td>
                <td className="py-2 text-right font-bold text-lg">${totalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-bold mb-3">Agreement Terms & Conditions</h2>

          <div className="text-xs space-y-1.5 leading-relaxed">
            <p className="font-semibold">This Inspection Agreement ("Agreement")</p>
            <p>is made between AZ Marine, an authorized vendor of Antelope Point Holdings LLC, as operator and liaison (hereinafter "Liaison") of Antelpe Point Holdings Marina at Lake Powell (the "Marina") and <strong>{agreement.vessel_name || '___________________________'}</strong> as the President or other designated representative of the corporation, limited liability company, limited partnership or other legal entity ("Boatco"), which owns vessels at and on the Marina. (Collectively, Liaison and Boatco are the "Parties" to this Agreement) entered on <strong>{agreement.contract_date ? new Date(agreement.contract_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '_________________'}</strong>.</p>

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

            <p><strong>2.</strong> Boatco, on behalf of each Equity Owner and vessel, on or before <strong className="border-b border-black px-2">{agreement.contract_date || '________________'}</strong> the contract Start date, shall pay an annual management fee of $ 8000.00" Annual Fee"), in addition to the Annual Fee the Boatco agrees to pay the Liaison $350.00 per turn to do a full 2-hour mechanical inspection of the boat, and will provide the Boatco a report with the findings. The estimated number of trips for this agreement will be <strong className="border-b border-black px-2">{(agreement.season_trips || 0) + (agreement.off_season_trips || 0)}</strong> this will include <strong className="border-b border-black px-2">{agreement.season_trips || 0}</strong> in season trips and <strong className="border-b border-black px-2">{agreement.off_season_trips || 0}</strong> off-season trips at $350.00 each totaling <strong className="border-b border-black px-2">${(((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * 350).toFixed(2)}</strong>. For a grand total of <strong className="border-b border-black px-2">${(8000 + (((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * 350)).toFixed(2)}</strong> This is a one-time fee per season payable to the Liaison, the Boatco understands that repairs and maintenance will be additional.</p>

            <p><strong>3.</strong> Rates and billing, during the term of this agreement, any work done on the APM Marina, or in dry storage. AZ Marine is required to charge a surcharge of 15% pre-taxed per invoice. The 15% will be capped at a retail invoice of $50,000. This 15% will be paid to APM for access to APM Properties by AZ Marine. The 15% is non-negotiable. Rates for house systems and Gasoline engines will be $150.00 per hour; All Diesel engine repairs are $175.00 per hour. Up-lake service calls are not subject to any surcharges and will be paid directly to the Liaison. Up-lake rates are as follows, $600.00 Chase boat launch fee, this charge includes all fuel for the work boat, and $275.00 per hour. Hourly charge starts once the chase boat leaves break water, until it returns to break water. If an employee has to use Diving gear to repair the boat their will be an additional $300.00 fee added to the bill. Up-lake billing will be due within 48 hours of the Boatco receiving the invoice. Payments made directly to the Liaison will be done by My yacht time ACH  with no fees or Credit card. Any invoices paid by credit card over $5000.00 will have a fee of 3% added. Mailing paper checks must be approved by Liaison, if Boatco mails a paper check without approval, Liaison will suspend all future work until check arrives. All payments are due within 48 hours of services being completed.</p>

            <p><strong>4.</strong> Agreement as Condition. Becoming a party to and adherence to the terms of this Agreement shall be a condition of using the Marina.</p>

            <p><strong>5.</strong> Liaison. The Parties hereby agree that Liaison shall be the central point of communication for mechanical inspections, maintenance and other matters involving or relating to the Marina.</p>

            <p><strong>6.</strong> Liaison's Right and Responsibilities. In its dealings with the Boatco representatives Liaison's authority, rights and responsibilities shall include, without limitation, the following:</p>
            <div className="pl-3 space-y-1">
              <p>A-Conducting Check off inspections and Pre Trip inspections; these inspections will be documented electronically. The Boatco president can request access to records. Any inspections of the vessel and determining in the Liaison's sole discretion any and all needed repairs and maintenance, including without limitation services needed for health, safety, and legal compliance as well as the services and off-season services,</p>
              <p>B-Negotiating and signing of Marina use agreements.</p>
              <p>C-Collecting Marina use fees and related payments.</p>
              <p>D-Coordinating and/or providing various management and maintenance services for the Boatco owners and the Marina.</p>
              <p>E-Coordinating, without limitation, the above-listed repair, maintenance, and upkeep services by and with the authorized service technicians and other qualified personal. This includes coordinating all turn services,</p>
              <p>F-Complying with applicable law.</p>
              <p>G-Enforcing the Marina's Rule and Regulations and applicable law, (collectively, the above items shall, without limitations, constitute as be referred to as the "Services", including the off-season services referred to herein.</p>
              <p>H-Doing all things necessary to provide the optimum level of Mechanical Inspections and vessel maintenance for the Boatco and the Marina.</p>
              <p>I-Taking all steps necessary to ensure the Equity owner or vessel user timely and promptly vacates the vessel by the agreed upon time in the contract of its last day of use. This means you must be in the slip and off loaded prior to the agreed upon time. Equity owners or vessel owner that don't have a dedicated mooring slip, must depart before the agreed upon time failure to do so the Boatco shell be subject to an additional charge of $500 per each half hour of delay ("late departure fee"). Prompt departure is absolutely necessary because Liaison and its Service providers have only the hours between 7am and 6pm of the same day to perform necessary Services to prepare the vessel for the occupancy and use by the next user Equity owner at 6pm. Late Departure Fees not paid by the Equity Owner or vessel user with in 5 days shall be billed and payable by the boatco.</p>
              <p>M-The authority and mandate to take corrective action to implement and enforce the about Service (collectively, "Corrective Action") as determined in good faith in Liaison's sole discretion.</p>
            </div>

            <p><strong>7.</strong> Hold Harmless, Release and Waiver. In the event Boatco or a vessel user works on his/her own vessel, or uses a third party vendor, or uses the vessel after being advised by Liaison or with knowledge that use of the vessel in the Marina may not be safe or Prudent, Boatco and/or vessel user do so at their own risk and hereby release and waive any claims against Liaison, the Marina or any principal or agent of the same and hold harmless and shall indemnify them against any and all claims. Boatco shall indemnify Liaison and Marina as well as their principals and agents from any event or claims arising out of use of a Boatco vessel in the Marina. Regardless of whether the user was or was not an equity holder in Boatco. Vessel users may be required to sign a hold harmless agreement and waiver at the time of usage in the marina if such use occurs after receiving advice or having knowledge that using the vessel in that condition was unsafe or imprudent.</p>

            <p><strong>8.</strong> Terms and Termination</p>
            <div className="pl-3 space-y-1">
              <p>A -The term of this Agreement shall be for not less than one (1) year and will automatically renew for successive one-year terms until termination.</p>
              <p>B-Boatco commits to this minimum term of one year after which Boatco may opts out of the agreement with a 30-day notice.</p>
              <p>C-Liaison may terminate this Agreement with ten (10) days prior notice and in its sole discretion (depending on circumstances) terminate Boatco's (and a vessel user) access to and use of the Marina, and any other agreement between the Parties or Boatco and third-party vendors.</p>
              <p>D-The Agreement as well as access and use of the Marina may be terminated, without prior notice at any time by the Liaison for good cause. "Cause", including, without limitation, Boatco's (or a vessel User's) fail to take Corrective Action, the negligent or improper use of the Marina. willful or reckless misconduct, or criminal activities.</p>
            </div>

            <p><strong>9.</strong> Corrective action and Enforcement. Liaison shall have necessary and proper authority to enforce the Corrective Actions. Boatco's failure to complete such Corrective Action with in ten (10) days of written notice of the same shall constitute a breach of this Agreement. In the event the Corrective Action, or cause for same, cannot be completed with-in ten (10) days then the Boatco shall commence, or cause the vessel user to commence, the necessary Corrective Action, proceed diligently to it conclusion and keep the Liaison informed as to the process.</p>

            <p><strong>10.</strong> Warranty Disclaimer, Liaison agrees to service as contact liaison and to perform the Services as listed above and warrants that it shall perform same with diligence and the Services shall be of workmanlike quality. Liaison makes no other warranties express or implied regarding the performance of Services including Off-Season Services, of the repair, maintenance, or other service technicians, or of any other person or party. Liaison disclaims any warranties, express or implied, as to availability, suitability, deadlines, interruptions, or fitness for a particular purpose. Marina makes no warranties express or implied.</p>

            <p><strong>11.</strong> Limitation of Liability. Liaison shall not be responsible for, and shall not pay, any amount of incidental, consequential, exemplary, or other direct or indirect damages arising out of Boatco's (or its vessel users) operation of their vessels and any injury to any third party. Liaison shall not be liable to Boatco or the vessel users for contract damages except those arising directly out of this Agreement. Liaison (and Marina) shall not be responsible to Boatco or a vessel user for loss of revenue, loss profits, loss of goodwill or otherwise, regardless of whether Liaison was advised of the possibility of such losses. In no event shall Liaison's liability hereunder to the Boatco or the vessel users exceed the amount paid by Boatco for Liaison Services, regardless of whether the claim is based on the contract, tort, strict liability, product liability or otherwise. Liaison is not responsible for any damages or losses sustained by Boatco for any products or services Boatco or vessel user Purchased from any third-party Vendor, even if Liaison approved the use of such Vendor. In any case, Boatco's sole remedy shall be a refund of amounts paid for Liaison's service fees.</p>

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
          </div>
        </div>

        <div className="mb-8 page-break-before avoid-break">
          <h2 className="text-xl font-bold mb-6 border-b-2 border-black pb-2">SIGNATURES</h2>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="font-bold mb-4">VESSEL OWNER/MANAGER:</p>
              {agreement.owner_signature_date ? (
                <div className="border-2 border-black rounded p-4">
                  <p className="font-bold text-lg mb-2">{agreement.owner_signature_name}</p>
                  <p className="text-sm">Date Signed: {new Date(agreement.owner_signature_date).toLocaleDateString()}</p>
                  <p className="text-sm">Time: {new Date(agreement.owner_signature_date).toLocaleTimeString()}</p>
                </div>
              ) : (
                <div className="border-2 border-gray-300 rounded p-4 bg-gray-50">
                  <p className="text-gray-500">Not yet signed</p>
                </div>
              )}
            </div>

            <div>
              <p className="font-bold mb-4">AZ MARINE SERVICES:</p>
              {agreement.staff_signature_date ? (
                <div className="border-2 border-black rounded p-4">
                  <p className="font-bold text-lg mb-2">{agreement.staff_signature_name}</p>
                  <p className="text-sm">Date Signed: {new Date(agreement.staff_signature_date).toLocaleDateString()}</p>
                  <p className="text-sm">Time: {new Date(agreement.staff_signature_date).toLocaleTimeString()}</p>
                </div>
              ) : (
                <div className="border-2 border-gray-300 rounded p-4 bg-gray-50">
                  <p className="text-gray-500">Not yet signed</p>
                </div>
              )}
            </div>
          </div>

          {agreement.status === 'approved' && agreement.approved_at && (
            <div className="bg-emerald-50 border-2 border-emerald-600 rounded p-4 text-center">
              <p className="font-bold text-emerald-800 text-lg mb-1">AGREEMENT APPROVED AND EXECUTED</p>
              <p className="text-emerald-700">Date: {new Date(agreement.approved_at).toLocaleDateString()} at {new Date(agreement.approved_at).toLocaleTimeString()}</p>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-600 border-t pt-4 mt-8">
          <p>Agreement ID: {agreement.id}</p>
          <p>Generated: {new Date().toLocaleString()}</p>
        </div>
      </div>
      </div>
    </>
  );
}
