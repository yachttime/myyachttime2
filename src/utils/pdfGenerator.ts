import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VesselManagementAgreement, UserProfile, Yacht, TripInspection, OwnerHandoffInspection, YachtBooking, YachtInvoice } from '../lib/supabase';

const PHX = 'America/Phoenix';
const phxDate = (d: Date | string) => new Date(d).toLocaleDateString('en-US', { timeZone: PHX });
const phxTime = (d: Date | string) => new Date(d).toLocaleTimeString('en-US', { timeZone: PHX, hour: 'numeric', minute: '2-digit' });
const phxDateTime = (d: Date | string) => new Date(d).toLocaleString('en-US', { timeZone: PHX });

export function generateVesselAgreementPDF(agreement: VesselManagementAgreement): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 8.5;
  const margin = 0.75;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const addText = (text: string, fontSize: number = 10, style: 'normal' | 'bold' = 'normal', align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);

    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }

    const lines = doc.splitTextToSize(text, contentWidth);

    if (align === 'center') {
      lines.forEach((line: string) => {
        const textWidth = doc.getTextWidth(line);
        doc.text(line, (pageWidth - textWidth) / 2, yPos);
        yPos += fontSize / 72 * 1.2;
      });
    } else if (align === 'right') {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth - margin, yPos, { align: 'right' });
        yPos += fontSize / 72 * 1.2;
      });
    } else {
      doc.text(lines, margin, yPos);
      yPos += (lines.length * fontSize / 72 * 1.2);
    }
  };

  const addSpace = (inches: number = 0.15) => {
    yPos += inches;
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
  };

  const addLine = () => {
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
    doc.setLineWidth(0.02);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 0.1;
  };

  const totalAmount = 8000 + ((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * (agreement.per_trip_fee || 350);

  addText('VESSEL MANAGEMENT AGREEMENT', 18, 'bold', 'center');
  addText(agreement.season_name, 12, 'normal', 'center');
  addSpace(0.3);

  addText(`Effective Date: ${phxDate(agreement.start_date)}`, 10, 'bold');
  addText(`Term: ${phxDate(agreement.start_date)} through ${phxDate(agreement.end_date)}`, 10);
  if (agreement.approved_at) {
    addText(`Agreement Executed: ${phxDate(agreement.approved_at)}`, 10);
  }
  addSpace(0.25);

  addText('PARTIES TO THIS AGREEMENT', 14, 'bold');
  addLine();
  addSpace(0.1);

  addText('VESSEL OWNER/MANAGER:', 11, 'bold');
  addText(agreement.manager_name, 10);
  if (agreement.manager_address) addText(agreement.manager_address, 10);
  addText(`Email: ${agreement.manager_email}`, 10);
  if (agreement.manager_phone) addText(`Phone: ${agreement.manager_phone}`, 10);
  addSpace(0.15);

  addText('MANAGEMENT COMPANY:', 11, 'bold');
  addText('AZ Marine Services', 10);
  addSpace(0.25);

  addText('VESSEL INFORMATION', 14, 'bold');
  addLine();
  addSpace(0.1);
  addText(`Vessel Name: ${agreement.vessel_name}`, 10, 'bold');
  if (agreement.vessel_make_model) addText(`Make/Model: ${agreement.vessel_make_model}`, 10);
  if (agreement.vessel_year) addText(`Year: ${agreement.vessel_year}`, 10);
  if (agreement.vessel_length) addText(`Length: ${agreement.vessel_length}`, 10);
  addSpace(0.25);

  if (agreement.agreed_arrival_time || agreement.agreed_departure_time) {
    addText('VESSEL AVAILABILITY', 14, 'bold');
    addLine();
    addSpace(0.1);
    if (agreement.agreed_arrival_time) addText(`Agreed Arrival Time: ${agreement.agreed_arrival_time}`, 10);
    if (agreement.agreed_departure_time) addText(`Agreed Departure Time: ${agreement.agreed_departure_time}`, 10);
    addSpace(0.25);
  }

  addText('FINANCIAL TERMS', 14, 'bold');
  addLine();
  addSpace(0.1);

  const tableData = [
    ['Annual Management Fee', '$8,000.00'],
    [`Season Trips (${agreement.season_trips || 0} trips × $${(agreement.per_trip_fee || 350).toFixed(2)})`, `$${((agreement.season_trips || 0) * (agreement.per_trip_fee || 350)).toFixed(2)}`],
    [`Off-Season Trips (${agreement.off_season_trips || 0} trips × $${(agreement.per_trip_fee || 350).toFixed(2)})`, `$${((agreement.off_season_trips || 0) * (agreement.per_trip_fee || 350)).toFixed(2)}`],
    ['TOTAL AGREEMENT VALUE', `$${totalAmount.toFixed(2)}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: tableData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 0.08, font: 'helvetica' },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y + 0.15;
    }
  });

  addSpace(0.15);
  addText('Agreement Terms & Conditions', 12, 'bold');
  addSpace(0.1);

  addText('This Inspection Agreement ("Agreement")', 9, 'bold');
  addText(`is made between AZ Marine, an authorized vendor of Antelope Point Holdings LLC, as operator and liaison (hereinafter "Liaison") of Antelope Point Holdings Marina at Lake Powell (the "Marina") and ${agreement.vessel_name || '___________________________'} as the President or other designated representative of the corporation, limited liability company, limited partnership or other legal entity ("Boatco"), which owns vessels at and on the Marina. (Collectively, Liaison and Boatco are the "Parties" to this Agreement) entered on ${agreement.contract_date ? new Date(agreement.contract_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '_________________'}.`, 9);
  addSpace(0.15);

  addText('Recitals', 10, 'bold');
  addSpace(0.08);

  const recitals = [
    { label: 'A:', text: 'The Parties to this Agreement desire to have a central point of communication to handle Mechanical Inspections and maintenance issues and establish terms and conditions for Boatco\'s use of the Marina. Authorized contact information; AZ Marine approved contact information are as follows: Phone 928-637-6500, Website www.azmarine.net, Email accounts jeff@azmarine.net, karen.stanley17@gmail.com, sales@azmarine.net, service@azmarine.net. AZ Marine is using the web-based app My Yacht Time to schedule repairs and communicate with all owners and managers; billing will also be managed within this program. www.myyachttime.com fees for the use of this app are included in the standard management fees. Company\'s Mailing address PO BOX 2184 Flagstaff AZ. 86003 (we are unable to get mail directly at the store so it will be returned if you send anything by US Mail. UPS and FedEx only). With respect to our valued employees, we ask you to please use these forms of contact only. If an employee calls from their personal cellphone, that is for them to get a clear understanding of the services needed or being requested. All scheduling for services must go through the office phone numbers, please do not call employees directly to schedule new services. Customers that abuse this policy will cause this contract to be canceled and/or voided.' },
    { label: 'B:', text: 'The Marina provides a harbor for vessels of all kinds ("Vessel(s)) at Lake Powell.' },
    { label: 'C:', text: 'Az Marine as Liaison has the exclusive executive authority to handle Mechanical Inspections and maintenance matters for the Marina and will serve as the central point of contact between the parties.' },
    { label: 'D:', text: 'Boatco is an organization of vessel owners who use the Marina.' },
    { label: 'E:', text: 'Boatco holds title or property interest in the vessels.' },
    { label: 'F:', text: 'Boatco represents the owners and holders of shares, interest and equity in Boatco in all matters arising out of this Agreement including all matters relating to the vessels\' location and use in the Marina, regardless of whether the claim is based on contact, tort, liability, product liability or otherwise.' },
    { label: 'G:', text: 'By their purchase of their equity interest in Boatco and their selection of the President and Treasurer or other authorized representative(s) of Boatco, the individual shareholders, members, partners and any other equity holders ("Equity Owners") agree and hereby deem that Boatco shall be the exclusive representative of the Equity Owners in all matters including the Services provided hereunder as well as all claims for personal injury or any other claims arising out of their operation and use of the vessels.' },
    { label: 'H:', text: 'Liaison provides Mechanical Inspections and maintenance services for the vessels in the Marina. This includes service technicians who are qualified to provide the various repair, maintenance and renovations services needed for the vessels kept at the Marina.' },
    { label: 'I:', text: 'While some maintenance and repair services can be performed during the season when the vessels are being used ("Services"), typically vessels also need service that cannot be done while the vessel is in the water and being used, but only when the season is over and the vessels are on land in storage ("Off-Season Services"). Most Equity Owners and vessel users are gone from the Marina when the Off-Season Services are performed.' },
    { label: 'J:', text: 'Boatco desires to have Liaison provide its Mechanical inspections and Maintenance services, including the repair and maintenance Services and Off-Season Services to Boatco.' },
  ];

  recitals.forEach((recital) => {
    addText(`${recital.label} ${recital.text}`, 8);
    addSpace(0.08);
  });

  addText('Therefore, for the consideration stated herein the Parties agree as follows,', 8);
  addSpace(0.15);

  addText('Terms and Conditions', 10, 'bold');
  addSpace(0.08);

  const terms = [
    '1. Liaison will provide mechanical inspections and maintenance service to Boatco included a Maintenance budget for during season and any off-season repairs needed.',

    `2. Boatco, on behalf of each Equity Owner and vessel, on or before ${agreement.contract_date || '________________'} the contract Start date, shall pay an annual management fee of $8000.00" Annual Fee"), in addition to the Annual Fee the Boatco agrees to pay the Liaison $350.00 per turn to do a full 2-hour mechanical inspection of the boat, and will provide the Boatco a report with the findings. The estimated number of trips for this agreement will be ${(agreement.season_trips || 0) + (agreement.off_season_trips || 0)} this will include ${agreement.season_trips || 0} in season trips and ${agreement.off_season_trips || 0} off-season trips at $350.00 each totaling $${(((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * 350).toFixed(2)}. For a grand total of $${(8000 + (((agreement.season_trips || 0) + (agreement.off_season_trips || 0)) * 350)).toFixed(2)} This is a one-time fee per season payable to the Liaison, the Boatco understands that repairs and maintenance will be additional.`,

    '3. Rates and billing, during the term of this agreement, any work done on the APM Marina, or in dry storage. AZ Marine is required to charge a surcharge of 15% pre-taxed per invoice. The 15% will be capped at a retail invoice of $50,000. This 15% will be paid to APM for access to APM Properties by AZ Marine. The 15% is non-negotiable. Rates for house systems and Gasoline engines will be $150.00 per hour; All Diesel engine repairs are $175.00 per hour. Up-lake service calls are not subject to any surcharges and will be paid directly to the Liaison. Up-lake rates are as follows, $600.00 Chase boat launch fee, this charge includes all fuel for the work boat, and $275.00 per hour. Hourly charge starts once the chase boat leaves break water, until it returns to break water. If an employee has to use Diving gear to repair the boat their will be an additional $300.00 fee added to the bill. Up-lake billing will be due within 48 hours of the Boatco receiving the invoice. Payments made directly to the Liaison will be done by My yacht time ACH with no fees or Credit card. Any invoices paid by credit card over $5000.00 will have a fee of 3% added. Mailing paper checks must be approved by Liaison, if Boatco mails a paper check without approval, Liaison will suspend all future work until check arrives. All payments are due within 48 hours of services being completed.',

    '4. Agreement as Condition. Becoming a party to and adherence to the terms of this Agreement shall be a condition of using the Marina.',

    '5. Liaison. The Parties hereby agree that Liaison shall be the central point of communication for mechanical inspections, maintenance and other matters involving or relating to the Marina.',

    '6. Liaison\'s Right and Responsibilities. In its dealings with the Boatco representatives Liaison\'s authority, rights and responsibilities shall include, without limitation, the following: A-Conducting Check off inspections and Pre Trip inspections; these inspections will be documented electronically. The Boatco president can request access to records. Any inspections of the vessel and determining in the Liaison\'s sole discretion any and all needed repairs and maintenance, including without limitation services needed for health, safety, and legal compliance as well as the services and off-season services, B-Negotiating and signing of Marina use agreements. C-Collecting Marina use fees and related payments. D-Coordinating and/or providing various management and maintenance services for the Boatco owners and the Marina. E-Coordinating, without limitation, the above-listed repair, maintenance, and upkeep services by and with the authorized service technicians and other qualified personal. This includes coordinating all turn services, F-Complying with applicable law. G-Enforcing the Marina\'s Rule and Regulations and applicable law, (collectively, the above items shall, without limitations, constitute as be referred to as the "Services", including the off-season services referred to herein. H-Doing all things necessary to provide the optimum level of Mechanical Inspections and vessel maintenance for the Boatco and the Marina. I-Taking all steps necessary to ensure the Equity owner or vessel user timely and promptly vacates the vessel by the agreed upon time in the contract of its last day of use. This means you must be in the slip and off loaded prior to the agreed upon time. Equity owners or vessel owner that don\'t have a dedicated mooring slip, must depart before the agreed upon time failure to do so the Boatco shell be subject to an additional charge of $500 per each half hour of delay ("late departure fee"). Prompt departure is absolutely necessary because Liaison and its Service providers have only the hours between 7am and 6pm of the same day to perform necessary Services to prepare the vessel for the occupancy and use by the next user Equity owner at 6pm. Late Departure Fees not paid by the Equity Owner or vessel user with in 5 days shall be billed and payable by the boatco. M-The authority and mandate to take corrective action to implement and enforce the about Service (collectively, "Corrective Action") as determined in good faith in Liaison\'s sole discretion.',
  ];

  terms.forEach((term) => {
    addText(term, 8);
    addSpace(0.08);
  });

  addText('7. Hold Harmless, Release and Waiver. In the event Boatco or a vessel user works on his/her own vessel, or uses a third party vendor, or uses the vessel after being advised by Liaison or with knowledge that use of the vessel in the Marina may not be safe or Prudent, Boatco and/or vessel user do so at their own risk and hereby release and waive any claims against Liaison, the Marina or any principal or agent of the same and hold harmless and shall indemnify them against any and all claims. Boatco shall indemnify Liaison and Marina as well as their principals and agents from any event or claims arising out of use of a Boatco vessel in the Marina. Regardless of whether the user was or was not an equity holder in Boatco. Vessel users may be required to sign a hold harmless agreement and waiver at the time of usage in the marina if such use occurs after receiving advice or having knowledge that using the vessel in that condition was unsafe or imprudent.', 8);
  addSpace(0.08);

  addText('8. Terms and Termination: A-The term of this Agreement shall be for not less than one (1) year and will automatically renew for successive one-year terms until termination. B-Boatco commits to this minimum term of one year after which Boatco may opts out of the agreement with a 30-day notice. C-Liaison may terminate this Agreement with ten (10) days prior notice and in its sole discretion (depending on circumstances) terminate Boatco\'s (and a vessel user) access to and use of the Marina, and any other agreement between the Parties or Boatco and third-party vendors. D-The Agreement as well as access and use of the Marina may be terminated, without prior notice at any time by the Liaison for good cause. "Cause", including, without limitation, Boatco\'s (or a vessel User\'s) fail to take Corrective Action, the negligent or improper use of the Marina. willful or reckless misconduct, or criminal activities.', 8);
  addSpace(0.08);

  const remainingTerms = [
    '9. Corrective action and Enforcement. Liaison shall have necessary and proper authority to enforce the Corrective Actions. Boatco\'s failure to complete such Corrective Action with in ten (10) days of written notice of the same shall constitute a breach of this Agreement. In the event the Corrective Action, or cause for same, cannot be completed with-in ten (10) days then the Boatco shall commence, or cause the vessel user to commence, the necessary Corrective Action, proceed diligently to it conclusion and keep the Liaison informed as to the process.',

    '10. Warranty Disclaimer, Liaison agrees to service as contact liaison and to perform the Services as listed above and warrants that it shall perform same with diligence and the Services shall be of workmanlike quality. Liaison makes no other warranties express or implied regarding the performance of Services including Off-Season Services, of the repair, maintenance, or other service technicians, or of any other person or party. Liaison disclaims any warranties, express or implied, as to availability, suitability, deadlines, interruptions, or fitness for a particular purpose. Marina makes no warranties express or implied.',

    '11. Limitation of Liability. Liaison shall not be responsible for, and shall not pay, any amount of incidental, consequential, exemplary, or other direct or indirect damages arising out of Boatco\'s (or its vessel users) operation of their vessels and any injury to any third party. Liaison shall not be liable to Boatco or the vessel users for contract damages except those arising directly out of this Agreement. Liaison (and Marina) shall not be responsible to Boatco or a vessel user for loss of revenue, loss profits, loss of goodwill or otherwise, regardless of whether Liaison was advised of the possibility of such losses. In no event shall Liaison\'s liability hereunder to the Boatco or the vessel users exceed the amount paid by Boatco for Liaison Services, regardless of whether the claim is based on the contract, tort, strict liability, product liability or otherwise. Liaison is not responsible for any damages or losses sustained by Boatco for any products or services Boatco or vessel user Purchased from any third-party Vendor, even if Liaison approved the use of such Vendor. In any case, Boatco\'s sole remedy shall be a refund of amounts paid for Liaison\'s service fees.',

    '12. Time Limitations on Claims. Any claims by Boatco, its vessel users, agent or affiliates shall be brought with-in one year of the date of the alleged breach or injury is, or reasonable should have been, discovered, and within two years of the date of breach or injury regardless of when same is/was discovered.',

    '13. Successors and Assigns. This Agreement is not assignable by Boatco, but in any case, shall be binding upon Boatco\'s the equity Owners and vessel users\' successors, assigns, heirs and personal representatives.',

    '14. Entire Agreement. This Agreement constitutes the entire agreement and understanding among the Parties hereto and supersedes and prior and contemporaneous agreements, understandings, inducements, and conditions, express or implied, oral, or written, of any nature whatsoever with respect to the subject matter hereof. No amendment of any provision of this Agreement shall be effective against any party unless the party or its lawful agent shall have consented thereto in writing.',

    '15. Waiver. Neither the failure of nor any delay on the part of either party to exercise any right, remedy, power or privilege under this Agreement shall operate as a waiver thereof, nor shall any single or partial excise of any right, remedy, power or privilege preclude any other privilege, nor shall any waiver of any right, remedy, power or privilege with respect to any occurrence be constructed as a waiver of any right, remedy, power or privilege, with respect to any other occurrence. No waiver shall be effective unless it is in writing and is signed by the party asserted to have granted such waiver.',

    '16. Notices. All notices or other communications to be given by any party to the other Parties shall be in writing, shall be served by personal delivery or by depositing such notices in the United States mail, certified or registered, return receipt requested, with certification or registration and postage charges prepaid, properly addressed and directed to Liaison or Boatco at the addresses set forth below. Any party may designate a different person or place for notices by delivering a written notice to that effect to the other party, which notice shall be effective after the same is received by the other party. Except as expressly provided in the preceding sentence, all notices shall be deemed to have been delivered upon the earlier of (i) actual receipt as evidenced by a return receipt or other delivery receipt, or (ii) two days after such notice and has been deposited for delivery in the office or postal mail box operated by the United States Postal Service. If to Liaison: Competition Auto super Center Inc. DBA: AZ Marine, PO Box 2184, Flagstaff, AZ. 86003, With a copy to: Antelope Point Holdings LLC. 537 Marina Parkway, Page, AZ 86040, And to Boatco:',

    '17. Governing Law, Venue & Jurisdiction: The terms and provisions of this Agreement shall be governed by, construed in accordance with, and interpreted under the laws of the State of Arizona with venue and jurisdiction in Coconino County of Arizona.',

    '18. Mediation and Arbitration. Notwithstanding the foregoing in the event a dispute arises out of this Agreement the affected Parties shall meet and confer, with or without legal counsel to resolve this dispute. If the dispute is not resolved within ten (10) days of the written request to meet and confer, then the Parties shall engage in mediation under the auspices of the American Arbitration Association within thirty (30) days. If the dispute is not resolved by and in mediation, then the dispute shall be heard by a single arbitrator under the Commercial Rules of Arbitration of the American Arbitration association. The arbitrator\'s award shall be final and may be entered as a judgment in any court of competent jurisdiction.',

    '19. Attorneys\' Fees. If either party institutes a civil action or arbitration against the other party which claims in any way relate to this Agreement. its formation, or its enforcement, the successful party in any such action shall be entitled to recover from the other party reasonable attorneys\' fees (not to exceed the actual attorneys\' fees incurred), witness fees and expenses, any and all other litigation expenses and court costs incurred in connection with said proceedings.',

    '20. Counterparts. This Agreement may be executed in any number of counterparts, each of which shall be deemed to be and original as against any party whose signature appears hereon, and all of which shall together constitute one and the same instrument. This Agreement shall become binding when one or more counterparts hereof, individually or taken together, shall bear the signatures of all of the parties reflected hereon as signatories.',

    '21. Invalidity. The invalidity or unenforceability of any covenant, term or condition of this Agreement, or any portion of any covenant, term or condition of this Agreement, shall not affect any other covenant, term or condition or portion hereof, and this Agreement shall remain in effect as if such invalid or unenforceable covenant, term or condition (or portion hereof) was not contained herein or was reduced to enforceable limits by a court.',

    '22. Representation by Counsel. Each of the Parties has been represented by or as had the full and fair opportunity to be represented by legal counsel of its, his or her own choice.',

    '23. Boatco Responsibility. The Boatco shall provide the items listed in Schedule 1 below with-in ten (10) of the signed Agreement to the Liaison in order for the Liaison to properly execute this Agreement. Failure to do so will cause this agreement to be terminated without a refund.',
  ];

  remainingTerms.forEach((term) => {
    addText(term, 8);
    addSpace(0.08);
  });

  doc.addPage();
  yPos = margin;

  addText('SIGNATURES', 14, 'bold');
  addLine();
  addSpace(0.25);

  addText('VESSEL OWNER/MANAGER:', 11, 'bold');
  if (agreement.owner_signature_date) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.02);
    doc.rect(margin, yPos, 3, 0.8);
    yPos += 0.15;
    addText(agreement.owner_signature_name, 11, 'bold');
    addText(`Date Signed: ${phxDate(agreement.owner_signature_date)}`, 9);
    addText(`Time: ${phxTime(agreement.owner_signature_date)}`, 9);
  } else {
    addText('Not yet signed', 9);
  }
  addSpace(0.25);

  addText('AZ MARINE SERVICES:', 11, 'bold');
  if (agreement.staff_signature_date) {
    doc.setDrawColor(0);
    doc.setLineWidth(0.02);
    doc.rect(margin, yPos, 3, 0.8);
    yPos += 0.15;
    addText(agreement.staff_signature_name, 11, 'bold');
    addText(`Date Signed: ${phxDate(agreement.staff_signature_date)}`, 9);
    addText(`Time: ${phxTime(agreement.staff_signature_date)}`, 9);
  } else {
    addText('Not yet signed', 9);
  }
  addSpace(0.25);

  if (agreement.status === 'approved' && agreement.approved_at) {
    doc.setDrawColor(5, 150, 105);
    doc.setFillColor(236, 253, 245);
    doc.setLineWidth(0.02);
    doc.rect(margin, yPos, contentWidth, 0.6, 'FD');
    yPos += 0.2;
    addText('AGREEMENT APPROVED AND EXECUTED', 11, 'bold', 'center');
    addText(`Date: ${phxDate(agreement.approved_at)} at ${phxTime(agreement.approved_at)}`, 9, 'normal', 'center');
    yPos += 0.1;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const footerY = 10.5;
  doc.text(`Agreement ID: ${agreement.id}`, margin, footerY);
  doc.text(`Generated: ${phxDateTime(new Date())}`, margin, footerY + 0.15);

  return doc;
}

export function generateUserListPDF(users: (UserProfile & { yachts?: Yacht })[], title: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 11;
  const margin = 0.75;
  let yPos = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  yPos += 0.3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateText = `Generated: ${phxDateTime(new Date())}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
  yPos += 0.4;

  // Sort users: by trip number first (if present), then alphabetically
  const sortedUsers = [...users].sort((a, b) => {
    // If both have trip numbers, sort by trip number
    if (a.trip_number && b.trip_number) {
      return a.trip_number - b.trip_number;
    }
    // Users with trip numbers come first
    if (a.trip_number && !b.trip_number) return -1;
    if (!a.trip_number && b.trip_number) return 1;
    // If neither has trip number, sort alphabetically by name
    const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
    const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const tableData = sortedUsers.map((user) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A';
    const role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'N/A';
    const yachtName = user.yachts?.name || 'N/A';

    return [
      fullName,
      user.email || 'N/A',
      user.phone || 'N/A',
      role,
      user.trip_number || 'N/A',
      yachtName
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Name', 'Email', 'Phone', 'Role', 'Trip #', 'Yacht']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 0.08,
      font: 'helvetica',
      lineColor: [203, 213, 225],
      lineWidth: 0.01
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    margin: { left: margin, right: margin },
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 8, { align: 'right' });
  }

  return doc;
}

export interface InspectionPhoto {
  photo_url: string;
  caption?: string;
  category: 'port_prop' | 'starboard_prop' | 'damage' | 'general';
}

const loadImageAsDataUrl = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } else {
        resolve('');
      }
    };
    img.onerror = () => resolve('');
    img.src = url;
  });
};

export async function generateTripInspectionPDF(
  inspection: TripInspection & { yachts?: { name: string }; user_profiles?: { first_name: string; last_name: string } },
  photos?: InspectionPhoto[]
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });

  const PW = 8.5;
  const PH = 11;
  const M = 0.45;
  const CW = PW - M * 2;
  const anyI = inspection as any;

  // ── Colour palette ──────────────────────────────────────────────────────────
  const NAVY  = [10, 36, 64]   as [number,number,number];
  const TEAL  = [0, 128, 128]  as [number,number,number];
  const OK_BG    = [230, 247, 237] as [number,number,number];
  const OK_FG    = [22, 101, 52]  as [number,number,number];
  const WARN_BG  = [254, 242, 220] as [number,number,number];
  const WARN_FG  = [146, 64, 14]  as [number,number,number];
  const LIGHT_BG = [245, 247, 250] as [number,number,number];
  const BORDER   = [210, 215, 220] as [number,number,number];
  const TEXT_DIM = [100, 110, 120] as [number,number,number];
  const WHITE    = [255, 255, 255] as [number,number,number];

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const fillRect = (x: number, y: number, w: number, h: number, rgb: [number,number,number]) => {
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y, w, h, 'F');
  };
  const strokeRect = (x: number, y: number, w: number, h: number, rgb: [number,number,number]) => {
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.rect(x, y, w, h, 'D');
    doc.setDrawColor(0, 0, 0);
  };

  // ── Header bar ───────────────────────────────────────────────────────────────
  fillRect(0, 0, PW, 1.18, NAVY);

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TRIP INSPECTION REPORT', M, 0.42);

  const typeLabel = (inspection.inspection_type === 'check_in' ? 'Check-In' :
                     inspection.inspection_type === 'check_out' ? 'Check-Out' : 'Inspection').toUpperCase();
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(typeLabel, PW - M, 0.42, { align: 'right' });

  // Yacht / Inspector / Date row inside header
  doc.setFontSize(9);
  const yachtName = inspection.yachts?.name || 'Unknown';
  const inspectorName = `${inspection.user_profiles?.first_name || ''} ${inspection.user_profiles?.last_name || ''}`.trim();
  const dateStr = phxDateTime(inspection.inspection_date);
  doc.text(`Vessel: ${yachtName}`, M, 0.68);
  doc.text(`Inspector: ${inspectorName}`, M + CW * 0.35, 0.68);
  doc.text(`Date: ${dateStr}`, M + CW * 0.70, 0.68);

  // Owner name row
  const ownerNameVal = (anyI.owner_name as string | null) || '';
  if (ownerNameVal) {
    doc.text(`Owner: ${ownerNameVal}`, M, 0.92);
  }

  // Accent stripe under header
  fillRect(0, 1.18, PW, 0.04, TEAL);

  let yPos = 1.36;

  // ── Issues Found badge ────────────────────────────────────────────────────────
  const issuesBg  = inspection.issues_found ? WARN_BG : OK_BG;
  const issuesFg  = inspection.issues_found ? WARN_FG : OK_FG;
  const issuesLbl = inspection.issues_found ? '  ISSUES FOUND' : '  ALL CLEAR';
  fillRect(M, yPos, 1.6, 0.22, issuesBg);
  doc.setFillColor(...issuesFg);
  doc.setTextColor(...issuesFg);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(issuesLbl, M + 0.08, yPos + 0.145);
  doc.setTextColor(0, 0, 0);

  yPos += 0.34;

  // ── Engine & Generator Hours ──────────────────────────────────────────────────
  const portEngHrs = anyI.port_engine_hours ?? null;
  const stbdEngHrs = anyI.stbd_engine_hours ?? null;
  const portGenHrs = anyI.port_gen_hours ?? null;
  const stbdGenHrs = anyI.stbd_gen_hours ?? null;

  if (portEngHrs != null || stbdEngHrs != null || portGenHrs != null || stbdGenHrs != null) {
    const sectionHdrH = 0.32;
    if (yPos + sectionHdrH + 0.3 > PH - 0.5) { doc.addPage(); yPos = M; }
    fillRect(M, yPos, CW, sectionHdrH, NAVY);
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ENGINE & GENERATOR HOURS', M + 0.08, yPos + 0.21);
    doc.setTextColor(0, 0, 0);
    yPos += sectionHdrH;

    const hrItems: [string, number | null][] = [
      ['Port Engine', portEngHrs],
      ['Stbd Engine', stbdEngHrs],
      ['Port Gen', portGenHrs],
      ['Stbd Gen', stbdGenHrs],
    ].filter(([, v]) => v != null) as [string, number | null][];

    const colW = CW / 4;
    fillRect(M, yPos, CW, 0.26, LIGHT_BG);
    strokeRect(M, yPos, CW, 0.26, BORDER);

    hrItems.forEach(([label, val], i) => {
      const x = M + i * colW;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_DIM);
      doc.text(label || '', x + 0.06, yPos + 0.10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      doc.text(String(val ?? ''), x + 0.06, yPos + 0.21);
    });
    yPos += 0.34;
  }

  // ── Checklist section ─────────────────────────────────────────────────────────
  const hdrH = 0.32;
  fillRect(M, yPos, CW, hdrH, NAVY);
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('INSPECTION CHECKLIST', M + 0.08, yPos + 0.21);
  doc.setTextColor(0, 0, 0);
  yPos += hdrH;

  const getStatus = (val?: string) => {
    if (!val) return null;
    if (['needs service', 'poor', 'needs_repair', 'needs service'].includes(val.toLowerCase())) return 'warn';
    if (['ok', 'good', 'excellent'].includes(val.toLowerCase())) return 'ok';
    return 'other';
  };

  const checkItems: Array<[string, string | undefined, string | undefined]> = [
    ['Hull Damage',          inspection.hull_condition,             inspection.hull_notes],
    ['Shore Cords',          inspection.deck_condition,             inspection.deck_notes],
    ['Trash Removed',        anyI.trash_removed,                    anyI.trash_removed_notes],
    ['Overall Condition',    inspection.overall_condition,          undefined],
    ['Inverter System',      anyI.inverter_system,                  anyI.inverter_notes],
    ['Master Bathroom',      anyI.master_bathroom,                  anyI.master_bathroom_notes],
    ['Secondary Bathroom',   anyI.secondary_bathroom,               anyI.secondary_bathroom_notes],
    ['Upper Deck Bathroom',  anyI.upper_deck_bathroom,              anyI.upper_deck_bathroom_notes],
    ['Lower Sinks',          anyI.lower_sinks,                      anyI.lower_sinks_notes],
    ['Kitchen Sink',         anyI.kitchen_sink,                     anyI.kitchen_sink_notes],
    ['Upper Kitchen Sink',   anyI.upper_kitchen_sink,               anyI.upper_kitchen_sink_notes],
    ['Garbage Disposal',     anyI.garbage_disposal,                 anyI.garbage_disposal_notes],
    ['Upper Disposal',       anyI.upper_disposal,                   anyI.upper_disposal_notes],
    ['Stove Top',            anyI.stove_top,                        anyI.stove_top_notes],
    ['Upper Stove Top',      anyI.upper_stove_top,                  anyI.upper_stove_top_notes],
    ['Dishwasher',           anyI.dishwasher,                       anyI.dishwasher_notes],
    ['Trash Compactor',      anyI.trash_compactor,                  anyI.trash_compactor_notes],
    ['Ice Maker',            anyI.icemaker,                         anyI.icemaker_notes],
    ['12V Fans',             anyI.volt_fans,                        anyI.volt_fans_notes],
    ['AC Filters',           anyI.ac_filters,                       anyI.ac_filters_notes],
    ['Upper AC Filter',      anyI.upper_ac_filter,                  anyI.upper_ac_filter_notes],
    ['AC Water Pumps',       anyI.ac_water_pumps,                   anyI.ac_water_pumps_notes],
    ['Water Filters',        anyI.water_filters,                    anyI.water_filters_notes],
    ['Water Pump Controls',  anyI.water_pumps_controls,             anyI.water_pumps_controls_notes],
    ['Propane',              anyI.propane,                          anyI.propane_notes],
    ['Windlass Port',        anyI.windless_port,                    anyI.windless_port_notes],
    ['Windlass Stbd',        anyI.windless_starboard,               anyI.windless_starboard_notes],
    ['Anchor Lines',         anyI.anchor_lines,                     anyI.anchor_lines_notes],
    ['Port Engine Oil',      anyI.port_engine_oil,                  anyI.port_engine_oil_notes],
    ['Stbd Engine Oil',      anyI.starboard_engine_oil,             anyI.starboard_engine_oil_notes],
    ['Port Generator Oil',   anyI.port_generator_oil,               anyI.port_generator_oil_notes],
    ['Stbd Generator Oil',   anyI.starboard_generator_oil,          anyI.starboard_generator_oil_notes],
    ['Sea Strainers',        anyI.sea_strainers,                    anyI.sea_strainers_notes],
    ['Engine Batteries',     anyI.engine_batteries,                 anyI.engine_batteries_notes],
  ].filter(([, v]) => v) as Array<[string, string | undefined, string | undefined]>;

  // Separate items with notes (need extra height) from normal items
  const normalItems = checkItems.filter(([, , n]) => !n);
  const noteItems   = checkItems.filter(([, , n]) => !!n);

  // Build two-column autoTable for normal items (no notes)
  // Each pair of items fills one row: [label1, status1, label2, status2]
  const tableRows: any[] = [];
  for (let i = 0; i < normalItems.length; i += 2) {
    const left  = normalItems[i];
    const right = normalItems[i + 1];
    const leftStatus  = getStatus(left[1]);
    const rightStatus = right ? getStatus(right[1]) : null;
    tableRows.push([
      left[0],
      leftStatus === 'warn' ? 'NEEDS SVC' : 'OK',
      right ? right[0] : '',
      right ? (rightStatus === 'warn' ? 'NEEDS SVC' : 'OK') : '',
    ]);
  }

  const statusCellStyles = (val: string, isWarn: boolean) => ({
    content: val,
    styles: {
      fontStyle: 'bold' as const,
      fontSize: 7,
      textColor: isWarn ? [146, 64, 14] : [22, 101, 52],
      fillColor: isWarn ? [254, 242, 220] : [230, 247, 237],
      halign: 'center' as const,
    },
  });

  const tableData = tableRows.map(([l1, s1, l2, s2]) => [
    { content: l1, styles: { fontSize: 7.5, fontStyle: 'normal' as const, textColor: [30, 40, 50], fillColor: [255, 255, 255] } },
    statusCellStyles(s1, s1 === 'NEEDS SVC'),
    { content: l2, styles: { fontSize: 7.5, fontStyle: 'normal' as const, textColor: [30, 40, 50], fillColor: [255, 255, 255] } },
    statusCellStyles(s2, s2 === 'NEEDS SVC'),
  ]);

  autoTable(doc, {
    startY: yPos,
    body: tableData,
    columnStyles: {
      0: { cellWidth: (CW / 2) - 0.5 },
      1: { cellWidth: 0.5 },
      2: { cellWidth: (CW / 2) - 0.5 },
      3: { cellWidth: 0.5 },
    },
    styles: {
      cellPadding: { top: 0.03, bottom: 0.03, left: 0.06, right: 0.04 },
      lineColor: [210, 215, 220],
      lineWidth: 0.005,
      overflow: 'linebreak',
    },
    margin: { left: M, right: M },
    theme: 'grid',
    tableWidth: CW,
  });

  yPos = (doc as any).lastAutoTable.finalY + 0.08;

  // Items with notes — drawn manually for full control
  // Layout: topPad | label(8pt) | labelToNote gap | note(7pt) × N lines | bottomPad
  const noteBadgeW = 0.5;
  const labelFontPt = 8;
  const noteFontPt  = 7;
  const ptToIn = 1 / 72;
  const labelH  = labelFontPt * ptToIn;   // text height ~0.111"
  const noteH   = noteFontPt  * ptToIn;   // text height ~0.097"
  const topPad  = 0.08;
  const noteGap = 0.06;  // gap between label baseline and note top
  const botPad  = 0.08;

  for (const [label, val, note] of noteItems) {
    const isWarn = getStatus(val) === 'warn';
    const badgeBg = isWarn ? WARN_BG : OK_BG;
    const badgeFg = isWarn ? WARN_FG : OK_FG;
    const noteFg  = isWarn ? WARN_FG : OK_FG;
    const badgeTxt = isWarn ? 'NEEDS SVC' : 'OK';

    // Measure note text
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(noteFontPt);
    const noteMaxW = CW - 0.22;
    const noteLines = doc.splitTextToSize(note || '', noteMaxW);
    const noteLineH = noteH * 1.5;
    const totalH = topPad + labelH + noteGap + noteLines.length * noteLineH + botPad;

    if (yPos + totalH > PH - 0.5) { doc.addPage(); yPos = M; }

    // Row background + border
    fillRect(M, yPos, CW, totalH, [255, 255, 255]);
    strokeRect(M, yPos, CW, totalH, BORDER);

    // Left accent stripe for warn items
    if (isWarn) fillRect(M, yPos, 0.04, totalH, WARN_FG);

    // Label (bold) — baseline at topPad + labelH
    const labelBaseline = yPos + topPad + labelH;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(labelFontPt);
    doc.setTextColor(30, 40, 50);
    doc.text(label, M + 0.12, labelBaseline);

    // Badge — vertically centered in the label row zone
    const badgeRowH = topPad + labelH;
    const nbx = M + CW - noteBadgeW - 0.05;
    const badgeH = badgeRowH - 0.04;
    fillRect(nbx, yPos + 0.02, noteBadgeW, badgeH, badgeBg);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(badgeFg[0], badgeFg[1], badgeFg[2]);
    doc.text(badgeTxt, nbx + noteBadgeW / 2, yPos + 0.02 + badgeH * 0.68, { align: 'center' });

    // Note lines — first baseline below label baseline + gap
    const firstNoteBaseline = labelBaseline + noteGap + noteH;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(noteFontPt);
    doc.setTextColor(noteFg[0], noteFg[1], noteFg[2]);
    noteLines.forEach((line: string, i: number) => {
      doc.text(line, M + 0.12, firstNoteBaseline + i * noteLineH);
    });

    doc.setTextColor(0, 0, 0);
    yPos += totalH + 0.04;
  }

  // ── Additional Notes ──────────────────────────────────────────────────────────
  if (inspection.additional_notes) {
    yPos += 0.08;
    if (yPos + 0.5 > PH - 0.5) { doc.addPage(); yPos = M; }

    fillRect(M, yPos, CW, 0.32, NAVY);
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ADDITIONAL NOTES', M + 0.08, yPos + 0.21);
    doc.setTextColor(0, 0, 0);
    yPos += 0.32;

    const noteLines = doc.splitTextToSize(inspection.additional_notes, CW - 0.12);
    const noteBlockH = noteLines.length * (8 / 72 * 1.3) + 0.1;
    fillRect(M, yPos, CW, noteBlockH, [255, 255, 255]);
    strokeRect(M, yPos, CW, noteBlockH, BORDER);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(noteLines, M + 0.06, yPos + 0.12);
    yPos += noteBlockH + 0.06;
  }

  // ── Photos ────────────────────────────────────────────────────────────────────
  if (photos && photos.length > 0) {
    const allPhotos = photos.slice(0, 6); // max 6 photos, 2 per row
    const dataUrls = await Promise.all(allPhotos.map(p => loadImageAsDataUrl(p.photo_url)));
    const validPhotos = allPhotos.map((p, i) => ({ ...p, dataUrl: dataUrls[i] })).filter(p => p.dataUrl);

    if (validPhotos.length > 0) {
      yPos += 0.08;
      const perRow = 2;
      const gap = 0.12;
      const imgW = (CW - gap * (perRow - 1)) / perRow;
      const imgH = imgW * 0.72;
      const minPhotoSectionH = 0.32 + imgH + 0.14; // header + one photo row + caption
      if (yPos + minPhotoSectionH > PH - 0.5) { doc.addPage(); yPos = M; }

      fillRect(M, yPos, CW, 0.32, NAVY);
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('INSPECTION PHOTOS', M + 0.08, yPos + 0.21);
      doc.setTextColor(0, 0, 0);
      yPos += 0.32;

      const catLabels: Record<string, string> = {
        port_prop: 'Port Propeller', starboard_prop: 'Stbd Propeller',
        damage: 'Damage', general: 'General',
      };
      const propImgW = imgW * 1.4;
      const propImgH = propImgW * 0.72;
      const captionH = 0.14;

      let i = 0;
      while (i < validPhotos.length) {
        const p = validPhotos[i];
        const isProp = p.category === 'port_prop' || p.category === 'starboard_prop';

        if (isProp) {
          // Prop photos: one per row, 40% larger
          const totalH = propImgH + captionH;
          if (yPos + totalH > PH - 0.45) { doc.addPage(); yPos = M; }
          const x = M + (CW - propImgW) / 2;
          doc.addImage(p.dataUrl!, 'JPEG', x, yPos, propImgW, propImgH);
          const cap = p.caption?.trim() || catLabels[p.category || ''] || '';
          if (cap) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...TEXT_DIM);
            doc.text(cap, x + propImgW / 2, yPos + propImgH + 0.10, { align: 'center' });
            doc.setTextColor(0, 0, 0);
          }
          yPos += totalH + 0.06;
          i += 1;
        } else {
          // Non-prop photos: two per row at normal size
          const actualRow = validPhotos.slice(i, i + perRow);
          const totalH = imgH + captionH;
          if (yPos + totalH > PH - 0.45) { doc.addPage(); yPos = M; }
          actualRow.forEach((rp, j) => {
            const x = M + j * (imgW + gap);
            doc.addImage(rp.dataUrl!, 'JPEG', x, yPos, imgW, imgH);
            const cap = rp.caption?.trim() || catLabels[rp.category || ''] || '';
            if (cap) {
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(6.5);
              doc.setTextColor(...TEXT_DIM);
              doc.text(cap, x + imgW / 2, yPos + imgH + 0.10, { align: 'center' });
              doc.setTextColor(0, 0, 0);
            }
          });
          yPos += totalH + 0.06;
          i += actualRow.length;
        }
      }
    }
  }

  // ── Footer ────────────────────────────────────────────────────────────────────
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    fillRect(0, PH - 0.32, PW, 0.32, NAVY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text(`${yachtName}  |  ${typeLabel}  |  ${dateStr}`, M, PH - 0.12);
    doc.text(`Page ${i} of ${pageCount}`, PW - M, PH - 0.12, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}

export function generateOwnerHandoffPDF(handoff: OwnerHandoffInspection & { yachts?: { name: string }; user_profiles?: { first_name: string; last_name: string } }): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 8.5;
  const margin = 0.75;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const addText = (text: string, fontSize: number = 10, style: 'normal' | 'bold' = 'normal') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);

    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }

    const lines = doc.splitTextToSize(text, contentWidth);
    doc.text(lines, margin, yPos);
    yPos += (lines.length * fontSize / 72 * 1.2);
  };

  const addSpace = (inches: number = 0.15) => {
    yPos += inches;
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
  };

  const addLine = () => {
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
    doc.setLineWidth(0.02);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 0.1;
  };

  const addHandoffItem = (label: string, condition?: string, notes?: string) => {
    if (!condition) return;

    const displayLabel = condition.charAt(0).toUpperCase() + condition.slice(1);

    addText(`${label}: ${displayLabel}`, 10, 'bold');
    if (notes) {
      addText(`  Notes: ${notes}`, 9);
    }
    addSpace(0.1);
  };

  addText('Meet the Yacht Owner Report', 18, 'bold');
  addSpace(0.3);

  addText(`Yacht: ${handoff.yachts?.name || 'Unknown'}`, 10, 'bold');
  addText(`Staff Member: ${handoff.user_profiles?.first_name || ''} ${handoff.user_profiles?.last_name || ''}`, 10);
  addText(`Inspection Type: Owner Handoff`, 10);
  addText(`Date: ${phxDateTime(handoff.inspection_date)}`, 10);
  addSpace(0.25);
  addLine();

  addText('Trip Issues and Damage', 14, 'bold');
  addSpace(0.15);
  addHandoffItem('Any Issues During the Trip', handoff.trip_issues, handoff.trip_issues_notes);
  addHandoffItem('Any Damage to Boat During Trip', handoff.boat_damage, handoff.boat_damage_notes);

  addSpace(0.15);
  addText('Pre-Handoff Checklist', 14, 'bold');
  addSpace(0.15);
  addHandoffItem('Shore Cords Plugged In and Inverters On', handoff.shore_cords_inverters, handoff.shore_cords_inverters_notes);
  addHandoffItem('Engine and Generators Fuel Full', handoff.engine_generator_fuel, handoff.engine_generator_fuel_notes);
  addHandoffItem('Toy Tank Fuel Full', handoff.toy_tank_fuel, handoff.toy_tank_fuel_notes);
  addHandoffItem('Propane Tanks Full and Connected', handoff.propane_tanks, handoff.propane_tanks_notes);

  addSpace(0.15);
  addText('Cleaning and Repairs', 14, 'bold');
  addSpace(0.15);
  addHandoffItem('Boat Has Been Cleaned', handoff.boat_cleaned, handoff.boat_cleaned_notes);
  addHandoffItem('All Repairs Completed', handoff.repairs_completed, handoff.repairs_completed_notes);
  addHandoffItem('Owners Called If Repairs Not Completed', handoff.owners_called, handoff.owners_called_notes);

  if (handoff.additional_notes) {
    addSpace(0.15);
    addText('Additional Notes', 12, 'bold');
    addSpace(0.1);
    addText(handoff.additional_notes, 9);
  }

  if (handoff.issues_found) {
    addSpace(0.15);
    addText('Issues found that require attention', 11, 'bold');
  }

  return doc;
}

export function generateOwnerTripsPDF(trips: YachtBooking[], yachtName: string): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 11;
  const margin = 0.75;
  let yPos = margin;

  const convertTo12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = `Owner Trips - ${yachtName}`;
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  yPos += 0.3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateText = `Generated: ${phxDateTime(new Date())}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
  yPos += 0.4;

  const sortedTrips = [...trips].sort((a, b) => {
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

  const tableData = sortedTrips.map((trip: any) => {
    const startDate = phxDate(trip.start_date);
    const endDate = phxDate(trip.end_date);
    const departureTime = trip.departure_time ? convertTo12Hour(trip.departure_time) : '';
    const arrivalTime = trip.arrival_time ? convertTo12Hour(trip.arrival_time) : '';
    const timeInfo = [departureTime && `Dep: ${departureTime}`, arrivalTime && `Arr: ${arrivalTime}`].filter(Boolean).join(' | ') || 'N/A';
    const tripNumber = trip.user_profiles?.trip_number || 'N/A';

    let ownerNames = 'N/A';
    let ownerContacts = 'N/A';

    if (trip.yacht_booking_owners && trip.yacht_booking_owners.length > 0) {
      ownerNames = trip.yacht_booking_owners.map((o: any) => o.owner_name).join(', ');
      const contacts = trip.yacht_booking_owners
        .map((o: any) => o.owner_contact)
        .filter((c: any) => c)
        .join(', ');
      ownerContacts = contacts || 'N/A';
    } else if (trip.owner_name) {
      ownerNames = trip.owner_name;
      ownerContacts = trip.owner_contact || (trip.user_profiles ? trip.user_profiles.phone || trip.user_profiles.email || 'N/A' : 'N/A');
    } else if (trip.user_profiles) {
      ownerNames = `${trip.user_profiles.first_name} ${trip.user_profiles.last_name}`;
      ownerContacts = trip.user_profiles.phone || trip.user_profiles.email || 'N/A';
    } else {
      ownerNames = 'N/A';
      ownerContacts = 'N/A';
    }

    return [
      tripNumber,
      ownerNames,
      ownerContacts,
      startDate,
      endDate,
      timeInfo
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Trip #', 'Owner Name', 'Contact', 'Start Date', 'End Date', 'Times']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 0.08,
      font: 'helvetica',
      lineColor: [203, 213, 225],
      lineWidth: 0.01
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      0: { cellWidth: 1.0 },
      1: { cellWidth: 1.8 },
      2: { cellWidth: 1.5 },
      3: { cellWidth: 1.3 },
      4: { cellWidth: 1.3 },
      5: { cellWidth: 2.0 }
    },
    margin: { left: margin, right: margin },
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 8, { align: 'right' });
  }

  return doc;
}

export function generateAllYachtTripsPDF(yachtTripsMap: { yacht: { id: string; name: string }; trips: YachtBooking[] }[]): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 11;
  const margin = 0.75;

  const convertTo12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  let isFirstYacht = true;

  for (const { yacht, trips } of yachtTripsMap) {
    if (trips.length === 0) continue;

    if (!isFirstYacht) {
      doc.addPage();
    }
    isFirstYacht = false;

    let yPos = margin;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const title = `Owner Trips - ${yacht.name}`;
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPos);
    yPos += 0.3;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const dateText = `Generated: ${phxDateTime(new Date())}`;
    const dateWidth = doc.getTextWidth(dateText);
    doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
    yPos += 0.4;

    const sortedTrips = [...trips].sort((a, b) =>
      new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    );

    const tableData = sortedTrips.map((trip: any) => {
      const startDate = new Date(trip.start_date).toLocaleDateString();
      const endDate = new Date(trip.end_date).toLocaleDateString();
      const departureTime = trip.departure_time ? convertTo12Hour(trip.departure_time) : '';
      const arrivalTime = trip.arrival_time ? convertTo12Hour(trip.arrival_time) : '';
      const timeInfo = [departureTime && `Dep: ${departureTime}`, arrivalTime && `Arr: ${arrivalTime}`].filter(Boolean).join(' | ') || 'N/A';
      const tripNumber = trip.user_profiles?.trip_number || 'N/A';

      let ownerNames = 'N/A';
      let ownerContacts = 'N/A';

      if (trip.yacht_booking_owners && trip.yacht_booking_owners.length > 0) {
        ownerNames = trip.yacht_booking_owners.map((o: any) => o.owner_name).join(', ');
        const contacts = trip.yacht_booking_owners
          .map((o: any) => o.owner_contact)
          .filter((c: any) => c)
          .join(', ');
        ownerContacts = contacts || 'N/A';
      } else if (trip.owner_name) {
        ownerNames = trip.owner_name;
        ownerContacts = trip.owner_contact || (trip.user_profiles ? trip.user_profiles.phone || trip.user_profiles.email || 'N/A' : 'N/A');
      } else if (trip.user_profiles) {
        ownerNames = `${trip.user_profiles.first_name} ${trip.user_profiles.last_name}`;
        ownerContacts = trip.user_profiles.phone || trip.user_profiles.email || 'N/A';
      } else {
        ownerNames = 'N/A';
        ownerContacts = 'N/A';
      }

      return [tripNumber, ownerNames, ownerContacts, startDate, endDate, timeInfo];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Trip #', 'Owner Name', 'Contact', 'Start Date', 'End Date', 'Times']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 0.08,
        font: 'helvetica',
        lineColor: [203, 213, 225],
        lineWidth: 0.01
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        halign: 'left'
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 1.0 },
        1: { cellWidth: 1.8 },
        2: { cellWidth: 1.5 },
        3: { cellWidth: 1.3 },
        4: { cellWidth: 1.3 },
        5: { cellWidth: 2.0 }
      },
      margin: { left: margin, right: margin },
    });
  }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 8, { align: 'right' });
  }

  return doc;
}

interface EmployeeReport {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    employee_type: 'hourly' | 'salary';
  };
  entries: any[];
  workOrderEntries: any[];
  totalStandardHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  totalWorkOrderHours: number;
  totalInspectionHours: number;
  grandTotalHours: number;
}

export async function generateEstimatePDF(
  estimate: any,
  tasks: any[],
  yachtName: string | null,
  companyInfo?: any,
  yachtMake?: string | null,
  yachtModel?: string | null,
  showPartNumbers?: boolean
): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 8.5;
  const margin = 0.75;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const addText = (text: string, fontSize: number = 10, style: 'normal' | 'bold' = 'normal', align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);

    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }

    const lines = doc.splitTextToSize(text, contentWidth);

    if (align === 'center') {
      lines.forEach((line: string) => {
        const textWidth = doc.getTextWidth(line);
        doc.text(line, (pageWidth - textWidth) / 2, yPos);
        yPos += fontSize / 72 * 1.2;
      });
    } else if (align === 'right') {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth - margin, yPos, { align: 'right' });
        yPos += fontSize / 72 * 1.2;
      });
    } else {
      doc.text(lines, margin, yPos);
      yPos += (lines.length * fontSize / 72 * 1.2);
    }
  };

  const addSpace = (inches: number = 0.15) => {
    yPos += inches;
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
  };

  const addLine = () => {
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
    doc.setLineWidth(0.02);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 0.1;
  };

  let logoAdded = false;
  let logoWidth = 0;
  let logoHeight = 0;

  if (companyInfo?.logo_url) {
    try {
      const response = await fetch(companyInfo.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();

      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;

            const img = new Image();
            img.onload = () => {
              try {
                const maxLogoWidth = 1.8;
                const maxLogoHeight = 1.3;

                const aspectRatio = img.width / img.height;
                logoWidth = maxLogoWidth;
                logoHeight = logoWidth / aspectRatio;

                if (logoHeight > maxLogoHeight) {
                  logoHeight = maxLogoHeight;
                  logoWidth = logoHeight * aspectRatio;
                }

                const logoX = margin;
                const logoY = yPos;

                doc.addImage(base64data, 'PNG', logoX, logoY, logoWidth, logoHeight);
                logoAdded = true;
                resolve(true);
              } catch (err) {
                console.warn('Could not add logo to PDF:', err);
                resolve(false);
              }
            };
            img.onerror = () => {
              console.warn('Could not load logo image');
              resolve(false);
            };
            img.src = base64data;
          } catch (err) {
            console.warn('Could not process logo:', err);
            resolve(false);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Could not load logo for PDF:', err);
    }
  }

  if (logoAdded) {
    const companyInfoX = margin + logoWidth + 0.15;
    const originalYPos = yPos;
    yPos = originalYPos;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.company_name || 'AZ MARINE SERVICES', companyInfoX, yPos);
    yPos += 0.13;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    if (companyInfo?.address_line1) {
      doc.text(companyInfo.address_line1, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.address_line2) {
      doc.text(companyInfo.address_line2, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
      const cityStateZip = [
        companyInfo.city,
        companyInfo.state,
        companyInfo.zip_code
      ].filter(Boolean).join(', ');
      doc.text(cityStateZip, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.phone) {
      doc.text(`Phone: ${companyInfo.phone}`, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.email) {
      doc.text(`Email: ${companyInfo.email}`, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.website) {
      doc.text(`Web: ${companyInfo.website}`, companyInfoX, yPos);
      yPos += 0.11;
    }

    yPos = Math.max(yPos, originalYPos + logoHeight);
    addSpace(0.15);
  } else {
    if (companyInfo?.company_name) {
      addText(companyInfo.company_name, 11, 'bold', 'center');
    } else {
      addText('AZ MARINE SERVICES', 11, 'bold', 'center');
    }

    if (companyInfo?.address_line1) {
      addText(companyInfo.address_line1, 8, 'normal', 'center');
    }

    if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
      const cityStateZip = [
        companyInfo?.city,
        companyInfo?.state,
        companyInfo?.zip_code
      ].filter(Boolean).join(', ');
      addText(cityStateZip, 8, 'normal', 'center');
    }

    if (companyInfo?.phone) {
      addText(`Phone: ${companyInfo.phone}`, 8, 'normal', 'center');
    }

    if (companyInfo?.email) {
      addText(`Email: ${companyInfo.email}`, 8, 'normal', 'center');
    }

    if (companyInfo?.website) {
      addText(`Web: ${companyInfo.website}`, 8, 'normal', 'center');
    }

    addSpace(0.05);
  }

  const startY = yPos;
  const leftColumnX = margin;
  const rightColumnX = pageWidth / 2 + 0.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Estimate #: ${estimate.estimate_number}`, leftColumnX, yPos);
  yPos += 0.13;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date: ${phxDate(estimate.created_at)}`, leftColumnX, yPos);
  yPos += 0.13;
  doc.text(`Status: ${estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}`, leftColumnX, yPos);

  yPos = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Customer Information', rightColumnX, yPos);
  yPos += 0.15;

  doc.setDrawColor(0);
  doc.setLineWidth(0.01);
  doc.line(rightColumnX, yPos, pageWidth - margin, yPos);
  yPos += 0.12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (estimate.is_retail_customer) {
    doc.text(`Customer: ${estimate.customer_name || 'N/A'}`, rightColumnX, yPos);
    yPos += 0.13;
    if (estimate.customer_email) {
      doc.text(`Email: ${estimate.customer_email}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (estimate.customer_phone) {
      doc.text(`Phone: ${estimate.customer_phone}`, rightColumnX, yPos);
      yPos += 0.13;
    }
  } else {
    doc.text(`Vessel: ${yachtName || 'N/A'}`, rightColumnX, yPos);
    yPos += 0.13;
    if (yachtMake || yachtModel) {
      const makeModel = [yachtMake, yachtModel].filter(Boolean).join(' ');
      doc.text(`Make/Model: ${makeModel}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (estimate.customer_name) {
      doc.text(`Customer: ${estimate.customer_name}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (estimate.customer_email) {
      doc.text(`Email: ${estimate.customer_email}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (estimate.customer_phone) {
      doc.text(`Phone: ${estimate.customer_phone}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (estimate.marina_name) {
      doc.text(`Marina: ${estimate.marina_name}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (estimate.manager_name) {
      doc.text(`Repair Approval Manager: ${estimate.manager_name}`, rightColumnX, yPos);
      yPos += 0.13;
      if (estimate.manager_email) {
        doc.text(`Manager Email: ${estimate.manager_email}`, rightColumnX, yPos);
        yPos += 0.13;
      }
      if (estimate.manager_phone) {
        doc.text(`Manager Phone: ${estimate.manager_phone}`, rightColumnX, yPos);
        yPos += 0.13;
      }
    }
  }

  const leftColumnEndY = startY + 0.13 + 0.13;
  yPos = Math.max(yPos, leftColumnEndY);
  addSpace(0.15);

  const pageBottomLimit = 10.25;
  const rowHeightEstimate = 0.26;
  const tableHeaderHeight = 0.28;
  const taskTitleHeight = 0.25;

  tasks.forEach((task, taskIndex) => {
    const itemCount = task.lineItems?.length || 0;
    const overviewHeight = task.task_overview ? 0.2 : 0;
    const taskHeaderHeight = taskTitleHeight + overviewHeight + 0.15;
    const fullTaskHeight = taskHeaderHeight + tableHeaderHeight + (itemCount * rowHeightEstimate) + 0.3;
    const pageUsableHeight = pageBottomLimit - margin;

    if (fullTaskHeight <= pageUsableHeight && yPos + fullTaskHeight > pageBottomLimit) {
      doc.addPage();
      yPos = margin;
    } else if (fullTaskHeight > pageUsableHeight) {
      const minContentHeight = taskHeaderHeight + tableHeaderHeight + (3 * rowHeightEstimate);
      if (yPos + minContentHeight > pageBottomLimit) {
        doc.addPage();
        yPos = margin;
      }
    }

    addText(`Task ${taskIndex + 1}: ${task.task_name}`, 12, 'bold');
    if (task.task_overview) {
      addSpace(0.05);
      addText(task.task_overview, 9);
    }
    addSpace(0.15);

    if (task.lineItems && task.lineItems.length > 0) {
      const lineItemHeaders = [['Description', 'Qty', 'Unit Price', 'Total']];
      const lineItemData = task.lineItems.map((item: any) => {
        const isPackageHeader = item.package_header || (item.line_type === 'labor' && item.description === '' && item.quantity === 0 && item.unit_price === 0);
        if (isPackageHeader) {
          return [{ content: item.package_header || 'Package', colSpan: 4, styles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 8 } }, '', '', ''];
        }
        let description = showPartNumbers
          ? (item.description || '')
          : (item.description || '').replace(/^[A-Za-z0-9][-A-Za-z0-9]*\s+-\s+/, '');
        if (item.work_details) {
          description += `\n  ${item.work_details}`;
        }
        return [
          description,
          item.quantity?.toString() || '0',
          `$${(item.unit_price || 0).toFixed(2)}`,
          `$${(item.total_price || 0).toFixed(2)}`
        ];
      });

      const taskSubtotal = task.lineItems.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);

      autoTable(doc, {
        startY: yPos,
        head: lineItemHeaders,
        body: lineItemData,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: {
          fontSize: 9,
          cellPadding: 0.08,
          font: 'helvetica',
          lineColor: [203, 213, 225],
          lineWidth: 0.01,
          minCellHeight: 0.15,
          cellWidth: 'wrap'
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 3.5, valign: 'top' },
          1: { cellWidth: 0.8, halign: 'center', valign: 'top' },
          2: { cellWidth: 1.2, halign: 'right', valign: 'top' },
          3: { cellWidth: 1.2, halign: 'right', valign: 'top' }
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data: any) => {
          yPos = data.cursor.y + 0.1;
        }
      });

      if (task.apply_surcharge) {
        addText(`Note: Surcharge will be applied to this task`, 8, 'normal');
        addSpace(0.1);
      }

      addSpace(0.15);
    }
  });

  doc.setDrawColor(0);
  doc.setLineWidth(0.03);
  doc.line(margin + 3.5, yPos, pageWidth - margin, yPos);
  yPos += 0.1125;

  const summaryData = [
    ['Subtotal:', `$${estimate.subtotal.toFixed(2)}`],
  ];

  if (estimate.discount_amount > 0) {
    summaryData.push([`Discount (${Number(estimate.discount_percentage).toFixed(1)}%):`, `-$${estimate.discount_amount.toFixed(2)}`]);
  }

  if (estimate.shop_supplies_amount > 0) {
    summaryData.push([`Shop Supplies (${(estimate.shop_supplies_rate * 100).toFixed(1)}%):`, `$${estimate.shop_supplies_amount.toFixed(2)}`]);
  }

  if (estimate.park_fees_amount > 0) {
    summaryData.push([`Park Fees (${(estimate.park_fees_rate * 100).toFixed(1)}%):`, `$${estimate.park_fees_amount.toFixed(2)}`]);
  }

  if (estimate.surcharge_amount > 0) {
    summaryData.push([`Surcharge (${(estimate.surcharge_rate * 100).toFixed(1)}%):`, `$${estimate.surcharge_amount.toFixed(2)}`]);
  }

  summaryData.push([`Sales Tax (${(estimate.sales_tax_rate * 100).toFixed(1)}%):`, `$${estimate.sales_tax_amount.toFixed(2)}`]);

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 0.0375,
      font: 'helvetica'
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: 5.5 },
      1: { halign: 'right', cellWidth: 1.2, fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });

  doc.setLineWidth(0.03);
  doc.line(margin + 3.5, yPos, pageWidth - margin, yPos);
  yPos += 0.1125;

  autoTable(doc, {
    startY: yPos,
    body: [['TOTAL:', `$${estimate.total_amount.toFixed(2)}`]],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 0.0375,
      font: 'helvetica',
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: 5.5 },
      1: { halign: 'right', cellWidth: 1.2 }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });

  // Check if deposit has been applied (for work order)
  const depositApplied = (typeof workOrder !== 'undefined' && workOrder.deposit_amount && workOrder.deposit_paid_at) ? workOrder.deposit_amount : 0;

  if (depositApplied > 0) {
    yPos += 0.1;

    autoTable(doc, {
      startY: yPos,
      body: [['Deposit Applied:', `-$${depositApplied.toFixed(2)}`]],
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 0.0375,
        font: 'helvetica'
      },
      columnStyles: {
        0: { halign: 'right', cellWidth: 5.5 },
        1: { halign: 'right', cellWidth: 1.2 }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        yPos = data.cursor.y;
      }
    });

    doc.setLineWidth(0.03);
    doc.line(margin + 3.5, yPos, pageWidth - margin, yPos);
    yPos += 0.1125;

    const balanceDue = estimate.total_amount - depositApplied;

    autoTable(doc, {
      startY: yPos,
      body: [['BALANCE DUE:', `$${balanceDue.toFixed(2)}`]],
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 0.0375,
        font: 'helvetica',
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { halign: 'right', cellWidth: 5.5 },
        1: { halign: 'right', cellWidth: 1.2 }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        yPos = data.cursor.y + 0.2;
      }
    });
  } else {
    yPos += 0.2;
  }

  if (estimate.notes) {
    addSpace(0.15);
    addText('Notes', 11, 'bold');
    addSpace(0.05);
    addText(estimate.notes, 9);
  }

  if (estimate.customer_notes) {
    const lines = estimate.customer_notes.split('\n');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let totalWrappedLines = 0;
    let emptyLineCount = 0;

    lines.forEach(line => {
      if (line.trim()) {
        const wrappedLines = doc.splitTextToSize(line, contentWidth);
        totalWrappedLines += wrappedLines.length;
      } else {
        emptyLineCount++;
      }
    });

    const lineHeight = 8 / 72 * 1.2;
    const titleHeight = 11 / 72 * 1.2;
    const estimatedHeight = 0.3 + 0.15 + titleHeight + 0.1 + (totalWrappedLines * lineHeight) + (emptyLineCount * 0.1) + 0.3;

    if (yPos + estimatedHeight > 10.25) {
      doc.addPage();
      yPos = margin;
    }

    addSpace(0.3);
    doc.setDrawColor(0);
    doc.setLineWidth(0.02);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    addSpace(0.15);

    addText('TERMS AND CONDITIONS', 11, 'bold');
    addSpace(0.1);

    lines.forEach(line => {
      if (line.trim()) {
        addText(line, 8);
      } else {
        addSpace(0.1);
      }
    });
  }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Generated: ${phxDateTime(new Date())}`, margin, 10.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 10.5, { align: 'right' });
  }

  return doc;
}

export async function generateWorkOrderPDF(
  workOrder: any,
  tasks: any[],
  yachtName: string | null,
  companyInfo?: any,
  showPartNumbers?: boolean
): Promise<jsPDF> {
  const estimate = workOrder.estimates || {
    subtotal: 0,
    discount_percentage: 0,
    discount_amount: 0,
    sales_tax_rate: 0,
    sales_tax_amount: 0,
    shop_supplies_rate: 0,
    shop_supplies_amount: 0,
    park_fees_rate: 0,
    park_fees_amount: 0,
    surcharge_rate: 0,
    surcharge_amount: 0,
    total_amount: 0,
    notes: null,
    customer_notes: null
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 8.5;
  const margin = 0.75;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const addText = (text: string, fontSize: number = 10, style: 'normal' | 'bold' = 'normal', align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);

    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }

    const lines = doc.splitTextToSize(text, contentWidth);

    if (align === 'center') {
      lines.forEach((line: string) => {
        const textWidth = doc.getTextWidth(line);
        doc.text(line, (pageWidth - textWidth) / 2, yPos);
        yPos += fontSize / 72 * 1.2;
      });
    } else if (align === 'right') {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth - margin, yPos, { align: 'right' });
        yPos += fontSize / 72 * 1.2;
      });
    } else {
      doc.text(lines, margin, yPos);
      yPos += (lines.length * fontSize / 72 * 1.2);
    }
  };

  const addSpace = (inches: number = 0.15) => {
    yPos += inches;
    if (yPos > 10.25) {
      doc.addPage();
      yPos = margin;
    }
  };

  let logoAdded = false;
  let logoWidth = 0;
  let logoHeight = 0;

  if (companyInfo?.logo_url) {
    try {
      const response = await fetch(companyInfo.logo_url);
      const blob = await response.blob();
      const reader = new FileReader();

      await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;

            const img = new Image();
            img.onload = () => {
              try {
                const maxLogoWidth = 1.8;
                const maxLogoHeight = 1.3;

                const aspectRatio = img.width / img.height;
                logoWidth = maxLogoWidth;
                logoHeight = logoWidth / aspectRatio;

                if (logoHeight > maxLogoHeight) {
                  logoHeight = maxLogoHeight;
                  logoWidth = logoHeight * aspectRatio;
                }

                const logoX = margin;
                const logoY = yPos;

                doc.addImage(base64data, 'PNG', logoX, logoY, logoWidth, logoHeight);
                logoAdded = true;
                resolve(true);
              } catch (err) {
                console.warn('Could not add logo to PDF:', err);
                resolve(false);
              }
            };
            img.onerror = () => {
              console.warn('Could not load logo image');
              resolve(false);
            };
            img.src = base64data;
          } catch (err) {
            console.warn('Could not process logo:', err);
            resolve(false);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Could not load logo for PDF:', err);
    }
  }

  if (logoAdded) {
    const companyInfoX = margin + logoWidth + 0.15;
    const originalYPos = yPos;
    yPos = originalYPos;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.company_name || 'AZ MARINE SERVICES', companyInfoX, yPos);
    yPos += 0.13;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    if (companyInfo?.address_line1) {
      doc.text(companyInfo.address_line1, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.address_line2) {
      doc.text(companyInfo.address_line2, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
      const cityStateZip = [
        companyInfo.city,
        companyInfo.state,
        companyInfo.zip_code
      ].filter(Boolean).join(', ');
      doc.text(cityStateZip, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.phone) {
      doc.text(`Phone: ${companyInfo.phone}`, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.email) {
      doc.text(`Email: ${companyInfo.email}`, companyInfoX, yPos);
      yPos += 0.11;
    }

    if (companyInfo?.website) {
      doc.text(`Web: ${companyInfo.website}`, companyInfoX, yPos);
      yPos += 0.11;
    }

    yPos = Math.max(yPos, originalYPos + logoHeight);
    addSpace(0.15);
  } else {
    if (companyInfo?.company_name) {
      addText(companyInfo.company_name, 11, 'bold', 'center');
    } else {
      addText('AZ MARINE SERVICES', 11, 'bold', 'center');
    }

    if (companyInfo?.address_line1) {
      addText(companyInfo.address_line1, 8, 'normal', 'center');
    }

    if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
      const cityStateZip = [
        companyInfo?.city,
        companyInfo?.state,
        companyInfo?.zip_code
      ].filter(Boolean).join(', ');
      addText(cityStateZip, 8, 'normal', 'center');
    }

    if (companyInfo?.phone) {
      addText(`Phone: ${companyInfo.phone}`, 8, 'normal', 'center');
    }

    if (companyInfo?.email) {
      addText(`Email: ${companyInfo.email}`, 8, 'normal', 'center');
    }

    if (companyInfo?.website) {
      addText(`Web: ${companyInfo.website}`, 8, 'normal', 'center');
    }

    addSpace(0.05);
  }

  const startY = yPos;
  const leftColumnX = margin;
  const rightColumnX = pageWidth / 2 + 0.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Work Order #: ${workOrder.work_order_number}`, leftColumnX, yPos);
  yPos += 0.13;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date: ${phxDate(workOrder.created_at)}`, leftColumnX, yPos);
  yPos += 0.13;
  doc.text(`Status: ${workOrder.status.charAt(0).toUpperCase() + workOrder.status.slice(1)}`, leftColumnX, yPos);

  yPos = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Customer Information', rightColumnX, yPos);
  yPos += 0.15;

  doc.setDrawColor(0);
  doc.setLineWidth(0.01);
  doc.line(rightColumnX, yPos, pageWidth - margin, yPos);
  yPos += 0.12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  if (workOrder.is_retail_customer) {
    doc.text(`Customer: ${workOrder.customer_name || 'N/A'}`, rightColumnX, yPos);
    yPos += 0.13;
    if (workOrder.customer_email) {
      doc.text(`Email: ${workOrder.customer_email}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (workOrder.customer_phone) {
      doc.text(`Phone: ${workOrder.customer_phone}`, rightColumnX, yPos);
      yPos += 0.13;
    }
  } else {
    doc.text(`Yacht: ${yachtName || 'N/A'}`, rightColumnX, yPos);
    yPos += 0.13;
    if (workOrder.marina_name) {
      doc.text(`Marina: ${workOrder.marina_name}`, rightColumnX, yPos);
      yPos += 0.13;
    }
    if (workOrder.manager_name) {
      doc.text(`Repair Approval Manager: ${workOrder.manager_name}`, rightColumnX, yPos);
      yPos += 0.13;
      if (workOrder.manager_email) {
        doc.text(`Manager Email: ${workOrder.manager_email}`, rightColumnX, yPos);
        yPos += 0.13;
      }
      if (workOrder.manager_phone) {
        doc.text(`Manager Phone: ${workOrder.manager_phone}`, rightColumnX, yPos);
        yPos += 0.13;
      }
    }
  }

  const leftColumnEndY = startY + 0.13 + 0.13;
  yPos = Math.max(yPos, leftColumnEndY);
  addSpace(0.15);

  const pageBottomLimit2 = 10.25;
  const rowHeightEstimate2 = 0.26;
  const tableHeaderHeight2 = 0.28;
  const taskTitleHeight2 = 0.25;

  tasks.forEach((task, taskIndex) => {
    const itemCount = task.lineItems?.length || 0;
    const overviewHeight = task.task_overview ? 0.2 : 0;
    const taskHeaderHeight = taskTitleHeight2 + overviewHeight + 0.15;
    const fullTaskHeight = taskHeaderHeight + tableHeaderHeight2 + (itemCount * rowHeightEstimate2) + 0.3;
    const pageUsableHeight = pageBottomLimit2 - margin;

    if (fullTaskHeight <= pageUsableHeight && yPos + fullTaskHeight > pageBottomLimit2) {
      doc.addPage();
      yPos = margin;
    } else if (fullTaskHeight > pageUsableHeight) {
      const minContentHeight = taskHeaderHeight + tableHeaderHeight2 + (3 * rowHeightEstimate2);
      if (yPos + minContentHeight > pageBottomLimit2) {
        doc.addPage();
        yPos = margin;
      }
    }

    addText(`Task ${taskIndex + 1}: ${task.task_name}`, 12, 'bold');
    if (task.task_overview) {
      addSpace(0.05);
      addText(task.task_overview, 9);
    }
    addSpace(0.15);

    if (task.lineItems && task.lineItems.length > 0) {
      const lineItemHeaders = [['Description', 'Qty', 'Unit Price', 'Total']];
      const lineItemData = task.lineItems.map((item: any) => {
        const isPackageHeader = item.package_header || (item.line_type === 'labor' && item.description === '' && item.quantity === 0 && item.unit_price === 0);
        if (isPackageHeader) {
          return [{ content: item.package_header || 'Package', colSpan: 4, styles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 8 } }, '', '', ''];
        }
        let description = showPartNumbers
          ? (item.description || '')
          : (item.description || '').replace(/^[A-Za-z0-9][-A-Za-z0-9]*\s+-\s+/, '');
        if (item.work_details) {
          description += `\n  ${item.work_details}`;
        }
        return [
          description,
          item.quantity?.toString() || '0',
          `$${(item.unit_price || 0).toFixed(2)}`,
          `$${(item.total_price || 0).toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: lineItemHeaders,
        body: lineItemData,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: {
          fontSize: 9,
          cellPadding: 0.08,
          font: 'helvetica',
          lineColor: [203, 213, 225],
          lineWidth: 0.01,
          minCellHeight: 0.15,
          cellWidth: 'wrap'
        },
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 3.5, valign: 'top' },
          1: { cellWidth: 0.8, halign: 'center', valign: 'top' },
          2: { cellWidth: 1.2, halign: 'right', valign: 'top' },
          3: { cellWidth: 1.2, halign: 'right', valign: 'top' }
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data: any) => {
          yPos = data.cursor.y + 0.1;
        }
      });

      if (task.apply_surcharge) {
        addText(`Note: Surcharge will be applied to this task`, 8, 'normal');
        addSpace(0.1);
      }

      addSpace(0.15);
    }
  });

  doc.setDrawColor(0);
  doc.setLineWidth(0.03);
  doc.line(margin + 3.5, yPos, pageWidth - margin, yPos);
  yPos += 0.1125;

  const summaryData = [
    ['Subtotal:', `$${estimate.subtotal.toFixed(2)}`],
  ];

  if (estimate.discount_amount > 0) {
    summaryData.push([`Discount (${Number(estimate.discount_percentage).toFixed(1)}%):`, `-$${estimate.discount_amount.toFixed(2)}`]);
  }

  if (estimate.shop_supplies_amount > 0) {
    summaryData.push([`Shop Supplies (${(estimate.shop_supplies_rate * 100).toFixed(1)}%):`, `$${estimate.shop_supplies_amount.toFixed(2)}`]);
  }

  if (estimate.park_fees_amount > 0) {
    summaryData.push([`Park Fees (${(estimate.park_fees_rate * 100).toFixed(1)}%):`, `$${estimate.park_fees_amount.toFixed(2)}`]);
  }

  if (estimate.surcharge_amount > 0) {
    summaryData.push([`Surcharge (${(estimate.surcharge_rate * 100).toFixed(1)}%):`, `$${estimate.surcharge_amount.toFixed(2)}`]);
  }

  summaryData.push([`Sales Tax (${(estimate.sales_tax_rate * 100).toFixed(1)}%):`, `$${estimate.sales_tax_amount.toFixed(2)}`]);

  autoTable(doc, {
    startY: yPos,
    body: summaryData,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 0.0375,
      font: 'helvetica'
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: 5.5 },
      1: { halign: 'right', cellWidth: 1.2, fontStyle: 'bold' }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });

  doc.setLineWidth(0.03);
  doc.line(margin + 3.5, yPos, pageWidth - margin, yPos);
  yPos += 0.1125;

  autoTable(doc, {
    startY: yPos,
    body: [['TOTAL:', `$${estimate.total_amount.toFixed(2)}`]],
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 0.0375,
      font: 'helvetica',
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { halign: 'right', cellWidth: 5.5 },
      1: { halign: 'right', cellWidth: 1.2 }
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });


  // Check if deposits have been applied — supports multiple recorded deposits
  const depositsArray: any[] = (Array.isArray(workOrder.deposits) && workOrder.deposits.length > 0)
    ? workOrder.deposits
    : [];
  const totalDepositsApplied = depositsArray.length > 0
    ? depositsArray.reduce((sum: number, d: any) => sum + parseFloat(String(d.amount || 0)), 0)
    : (workOrder.deposit_amount && workOrder.deposit_paid_at ? parseFloat(String(workOrder.deposit_amount)) : 0);

  if (totalDepositsApplied > 0) {
    yPos += 0.1;

    if (depositsArray.length > 1) {
      for (let i = 0; i < depositsArray.length; i++) {
        const dep = depositsArray[i];
        const depAmount = parseFloat(String(dep.amount || 0));
        const methodLabel = dep.payment_method === 'check'
          ? `Check #${dep.reference_number || ''}`
          : (dep.payment_method || '');
        const notesSuffix = dep.notes ? ` — ${dep.notes}` : '';
        const label = `Deposit #${i + 1} (${methodLabel}):${notesSuffix}`;

        autoTable(doc, {
          startY: yPos,
          body: [[label, `-$${depAmount.toFixed(2)}`]],
          theme: 'plain',
          styles: { fontSize: 8, cellPadding: 0.0375, font: 'helvetica' },
          columnStyles: {
            0: { halign: 'right', cellWidth: 5.5 },
            1: { halign: 'right', cellWidth: 1.2 }
          },
          margin: { left: margin, right: margin },
          didDrawPage: (data: any) => { yPos = data.cursor.y; }
        });
      }
    } else {
      const dep = depositsArray[0];
      const notesSuffix = dep && dep.notes ? ` — ${dep.notes}` : '';
      autoTable(doc, {
        startY: yPos,
        body: [[`Deposit Applied:${notesSuffix}`, `-$${totalDepositsApplied.toFixed(2)}`]],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 0.0375, font: 'helvetica' },
        columnStyles: {
          0: { halign: 'right', cellWidth: 5.5 },
          1: { halign: 'right', cellWidth: 1.2 }
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data: any) => { yPos = data.cursor.y; }
      });
    }

    doc.setLineWidth(0.03);
    doc.line(margin + 3.5, yPos, pageWidth - margin, yPos);
    yPos += 0.1125;

    const balanceDue = estimate.total_amount - totalDepositsApplied;

    autoTable(doc, {
      startY: yPos,
      body: [['BALANCE DUE:', `$${balanceDue.toFixed(2)}`]],
      theme: 'plain',
      styles: {
        fontSize: 9,
        cellPadding: 0.0375,
        font: 'helvetica',
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { halign: 'right', cellWidth: 5.5 },
        1: { halign: 'right', cellWidth: 1.2 }
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data: any) => {
        yPos = data.cursor.y + 0.2;
      }
    });
  } else {
    yPos += 0.2;
  }

  if (estimate.notes) {
    addSpace(0.15);
    addText('Notes', 11, 'bold');
    addSpace(0.05);
    addText(estimate.notes, 9);
  }

  if (estimate.customer_notes) {
    const lines = estimate.customer_notes.split('\n');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let totalWrappedLines = 0;
    let emptyLineCount = 0;

    lines.forEach(line => {
      if (line.trim()) {
        const wrappedLines = doc.splitTextToSize(line, contentWidth);
        totalWrappedLines += wrappedLines.length;
      } else {
        emptyLineCount++;
      }
    });

    const lineHeight = 8 / 72 * 1.2;
    const titleHeight = 11 / 72 * 1.2;
    const estimatedHeight = 0.3 + 0.15 + titleHeight + 0.1 + (totalWrappedLines * lineHeight) + (emptyLineCount * 0.1) + 0.3;

    if (yPos + estimatedHeight > 10.25) {
      doc.addPage();
      yPos = margin;
    }

    addSpace(0.3);
    doc.setDrawColor(0);
    doc.setLineWidth(0.02);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    addSpace(0.15);

    addText('TERMS AND CONDITIONS', 11, 'bold');
    addSpace(0.1);

    lines.forEach(line => {
      if (line.trim()) {
        addText(line, 8);
      } else {
        addSpace(0.1);
      }
    });
  }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Generated: ${phxDateTime(new Date())}`, margin, 10.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 10.5, { align: 'right' });
  }

  return doc;
}

export async function generatePayrollReportPDF(
  employeeReports: EmployeeReport[],
  startDate: string,
  endDate: string,
  yachtMap: Record<string, string>,
  payDate?: string,
  skipDownload?: boolean
): Promise<Blob | void> {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 11;
  const pageHeight = 8.5;
  const margin = 0.5;
  const contentWidth = pageWidth - (margin * 2);
  let yPos = margin;

  const addText = (text: string, fontSize: number = 10, style: 'normal' | 'bold' = 'normal', align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', style);

    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }

    if (align === 'center') {
      const textWidth = doc.getTextWidth(text);
      doc.text(text, (pageWidth - textWidth) / 2, yPos);
    } else if (align === 'right') {
      doc.text(text, pageWidth - margin, yPos, { align: 'right' });
    } else {
      doc.text(text, margin, yPos);
    }
    yPos += fontSize / 72 * 1.2;
  };

  const addSpace = (inches: number = 0.15) => {
    yPos += inches;
    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
  };

  addText('PAYROLL REPORT', 16, 'bold', 'center');
  addText(`Pay Period: ${phxDate(startDate)} - ${phxDate(endDate)}`, 12, 'normal', 'center');
  if (payDate) {
    addText(`Payday: ${phxDate(payDate)}`, 12, 'normal', 'center');
  }
  addSpace(0.3);

  const summaryHeaders = [['Employee', 'Type', 'Standard Hrs', 'Overtime Hrs', 'Time Clock', 'Work Order Hrs', 'Inspection Hrs', 'Grand Total']];
  const summaryData = employeeReports.map(report => {
    return [
      `${report.user.last_name}, ${report.user.first_name}`,
      report.user.employee_type === 'hourly' ? 'Hourly' : 'Salary',
      report.totalStandardHours.toFixed(2),
      report.totalOvertimeHours.toFixed(2),
      report.totalHours.toFixed(2),
      report.totalWorkOrderHours.toFixed(2),
      (report.totalInspectionHours || 0).toFixed(2),
      report.grandTotalHours.toFixed(2)
    ];
  });

  const grandTotalStandard = employeeReports.reduce((sum, r) => sum + r.totalStandardHours, 0);
  const grandTotalOvertime = employeeReports.reduce((sum, r) => sum + r.totalOvertimeHours, 0);
  const grandTotalTimeClock = grandTotalStandard + grandTotalOvertime;
  const grandTotalWorkOrder = employeeReports.reduce((sum, r) => sum + r.totalWorkOrderHours, 0);
  const grandTotalInspection = employeeReports.reduce((sum, r) => sum + (r.totalInspectionHours || 0), 0);
  const grandTotal = grandTotalTimeClock + grandTotalWorkOrder + grandTotalInspection;

  summaryData.push([
    'TOTALS',
    '',
    grandTotalStandard.toFixed(2),
    grandTotalOvertime.toFixed(2),
    grandTotalTimeClock.toFixed(2),
    grandTotalWorkOrder.toFixed(2),
    grandTotalInspection.toFixed(2),
    grandTotal.toFixed(2)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: summaryHeaders,
    body: summaryData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 0.08,
      font: 'helvetica',
      textColor: [0, 0, 0]
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 2.0 },
      1: { cellWidth: 1.0 },
      2: { halign: 'right', cellWidth: 1.3 },
      3: { halign: 'right', cellWidth: 1.3 },
      4: { halign: 'right', cellWidth: 1.3 },
      5: { halign: 'right', cellWidth: 1.5 },
      6: { halign: 'right', cellWidth: 1.3, fontStyle: 'bold' }
    },
    didParseCell: function(data: any) {
      if (data.row.index === summaryData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
        data.cell.styles.textColor = [0, 0, 0];
      }
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 0.4;

  employeeReports.forEach((report, reportIndex) => {
    if (report.entries.length === 0 && report.workOrderEntries.length === 0) return;

    if (yPos > pageHeight - 2) {
      doc.addPage();
      yPos = margin;
    }

    addText(`${report.user.last_name}, ${report.user.first_name} - Detailed Time Entries`, 12, 'bold');
    addSpace(0.1);

    if (report.entries.length > 0) {
      const detailHeaders = [['Date', 'Yacht', 'Punch In', 'Punch Out', 'Lunch', 'Std Hours', 'OT Hours', 'Total', 'Notes']];
      const detailData = report.entries.map(entry => {
      const date = phxDate(entry.punch_in_time);
      const yacht = entry.yacht_id ? yachtMap[entry.yacht_id] || 'N/A' : 'N/A';
      const punchIn = phxTime(entry.punch_in_time);
      const punchOut = entry.punch_out_time
        ? phxTime(entry.punch_out_time)
        : 'Active';

      let lunch = 'N/A';
      if (report.user.employee_type === 'salary') {
        lunch = '1h (auto)';
      } else if (entry.lunch_break_start && entry.lunch_break_end) {
        const lunchStart = phxTime(entry.lunch_break_start);
        const lunchEnd = phxTime(entry.lunch_break_end);
        lunch = `${lunchStart}-${lunchEnd}`;
      }

      const notes = entry.notes || '';
      const editFlag = entry.is_edited ? ' [EDITED]' : '';

      return [
        date,
        yacht,
        punchIn,
        punchOut,
        lunch,
        entry.standard_hours?.toFixed(2) || '0.00',
        entry.overtime_hours?.toFixed(2) || '0.00',
        entry.total_hours?.toFixed(2) || '0.00',
        notes + editFlag
      ];
    });

    detailData.push([
      'SUBTOTAL',
      '',
      '',
      '',
      '',
      report.totalStandardHours.toFixed(2),
      report.totalOvertimeHours.toFixed(2),
      report.totalHours.toFixed(2),
      ''
    ]);

    autoTable(doc, {
      startY: yPos,
      head: detailHeaders,
      body: detailData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 0.05,
        font: 'helvetica',
        textColor: [0, 0, 0]
      },
      headStyles: {
        fillColor: [229, 231, 235],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        fontSize: 8
      },
      columnStyles: {
        0: { cellWidth: 0.9 },
        1: { cellWidth: 1.2 },
        2: { cellWidth: 0.9 },
        3: { cellWidth: 0.9 },
        4: { cellWidth: 1.1 },
        5: { halign: 'right', cellWidth: 0.7 },
        6: { halign: 'right', cellWidth: 0.7 },
        7: { halign: 'right', cellWidth: 0.7, fontStyle: 'bold' },
        8: { cellWidth: 2.9, fontSize: 7 }
      },
      didParseCell: function(data: any) {
        if (data.row.index === detailData.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [243, 244, 246];
          data.cell.styles.textColor = [0, 0, 0];
        }
        if (data.column.index === 8 && data.cell.text[0] && data.cell.text[0].includes('[EDITED]')) {
          data.cell.styles.textColor = [234, 88, 12];
        }
      },
      margin: { left: margin, right: margin },
    });

      yPos = (doc as any).lastAutoTable.finalY + 0.2;
    } else if (report.workOrderEntries.length > 0) {
      yPos += 0.1;
    }

    if (report.workOrderEntries && report.workOrderEntries.length > 0) {
      if (yPos > pageHeight - 1.5) {
        doc.addPage();
        yPos = margin;
      }

      if (report.entries.length > 0) {
        addText(`Work Order Time Entries`, 10, 'bold');
      } else {
        addText(`Work Order Time Entries (only)`, 10, 'bold');
      }
      addSpace(0.05);

      const woGrouped: Record<string, { work_order_number: string; total_hours: number }> = {};
      report.workOrderEntries.forEach((entry: any) => {
        const key = entry.work_order_number;
        if (!woGrouped[key]) {
          woGrouped[key] = { work_order_number: entry.work_order_number, total_hours: 0 };
        }
        woGrouped[key].total_hours += entry.total_hours;
      });

      const workOrderHeaders = [['Work Order', 'Hours']];
      const workOrderData = Object.values(woGrouped).map(wo => [
        wo.work_order_number,
        wo.total_hours.toFixed(2)
      ]);

      workOrderData.push([
        'SUBTOTAL',
        report.totalWorkOrderHours.toFixed(2)
      ]);

      autoTable(doc, {
        startY: yPos,
        head: workOrderHeaders,
        body: workOrderData,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 0.07,
          font: 'helvetica',
          textColor: [0, 0, 0]
        },
        headStyles: {
          fillColor: [219, 234, 254],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 2.0 },
          1: { halign: 'right', cellWidth: 1.0, fontStyle: 'bold' }
        },
        didParseCell: function(data: any) {
          if (data.row.index === workOrderData.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [243, 244, 246];
            data.cell.styles.textColor = [0, 0, 0];
          }
        },
        margin: { left: margin, right: margin },
      });

      yPos = (doc as any).lastAutoTable.finalY + 0.3;
    } else {
      yPos = (doc as any).lastAutoTable.finalY + 0.3;
    }
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Generated: ${phxDateTime(new Date())}`, margin, pageHeight - 0.3);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, pageHeight - 0.3, { align: 'right' });
  }

  const fileName = `Payroll_Report_${phxDate(startDate).replace(/\//g, '-')}_to_${phxDate(endDate).replace(/\//g, '-')}.pdf`;
  if (skipDownload) {
    return doc.output('blob');
  }
  doc.save(fileName);
}

export function generateActiveYachtsPDF(yachts: Yacht[], agreementPaymentMap: Record<string, string> = {}): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
  });

  const pageWidth = 11;
  const margin = 0.75;
  let yPos = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const title = 'Active Yachts List';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, yPos);
  yPos += 0.3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateText = `Generated: ${phxDateTime(new Date())}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
  yPos += 0.4;

  const sortedYachts = [...yachts]
    .filter(yacht => yacht.is_active)
    .sort((a, b) => a.name.localeCompare(b.name));

  const tableData = sortedYachts.map((yacht: Yacht) => {
    const rawStatus = agreementPaymentMap[yacht.id] || '';
    let agreementLabel = 'No Invoice';
    if (rawStatus === 'paid') agreementLabel = 'Paid';
    else if (rawStatus === 'pending') agreementLabel = 'Unpaid';
    else if (rawStatus === 'processing') agreementLabel = 'Processing';
    else if (rawStatus) agreementLabel = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
    return [
      yacht.name || 'N/A',
      yacht.hull_number || 'N/A',
      yacht.manufacturer || 'N/A',
      yacht.year?.toString() || 'N/A',
      yacht.size || 'N/A',
      yacht.marina_name || 'N/A',
      yacht.slip_location || 'N/A',
      agreementLabel,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Yacht Name', 'Hull Number', 'Manufacturer', 'Year', 'Size', 'Marina', 'Slip Location', 'Agreement']],
    body: tableData,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 0.08,
      font: 'helvetica',
      lineColor: [203, 213, 225],
      lineWidth: 0.01
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'left'
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251]
    },
    columnStyles: {
      0: { cellWidth: 1.4 },
      1: { cellWidth: 1.2 },
      2: { cellWidth: 1.2 },
      3: { cellWidth: 0.6 },
      4: { cellWidth: 0.7 },
      5: { cellWidth: 1.6 },
      6: { cellWidth: 1.1 },
      7: { cellWidth: 1.0 }
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 7) {
        const val = data.cell.raw as string;
        if (val === 'Paid') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Unpaid') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Processing') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
    margin: { left: margin, right: margin },
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 8, { align: 'right' });
  }

  return doc;
}

export interface FleetTripDatesRow {
  yacht_name: string;
  is_active: boolean;
  first_trip: string | null;
  last_trip: string | null;
  total_trips: number;
}

export function generateFleetTripDatesReportPDF(rows: FleetTripDatesRow[]): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'in',
    format: 'letter',
  });

  const rptPageWidth = 11;
  const rptMargin = 0.75;
  let rptY = rptMargin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const rptTitle = 'Fleet Trip Dates Report';
  const rptTitleWidth = doc.getTextWidth(rptTitle);
  doc.text(rptTitle, (rptPageWidth - rptTitleWidth) / 2, rptY);
  rptY += 0.3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const rptDateText = `Generated: ${phxDateTime(new Date())}`;
  const rptDateWidth = doc.getTextWidth(rptDateText);
  doc.text(rptDateText, (rptPageWidth - rptDateWidth) / 2, rptY);
  rptY += 0.4;
  doc.setTextColor(0);

  const fmtTripDate = (iso: string | null) => {
    if (!iso) return '—';
    return phxDate(iso);
  };

  const rptTableData = rows.map(r => [
    r.yacht_name,
    fmtTripDate(r.first_trip),
    fmtTripDate(r.last_trip),
    r.total_trips.toString(),
  ]);

  autoTable(doc, {
    startY: rptY,
    head: [['Yacht Name', 'First Trip', 'Last Trip', 'Total Trips']],
    body: rptTableData,
    theme: 'striped',
    styles: {
      fontSize: 10,
      cellPadding: 0.1,
      font: 'helvetica',
      lineColor: [203, 213, 225],
      lineWidth: 0.01,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 2.5 },
      1: { cellWidth: 2.5 },
      2: { cellWidth: 2.5 },
      3: { cellWidth: 1.5, halign: 'center' },
    },
    margin: { left: rptMargin, right: rptMargin },
  });

  const rptPageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  for (let i = 1; i <= rptPageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${rptPageCount}`, rptPageWidth - rptMargin - 0.5, 8.3, { align: 'right' });
  }

  return doc;
}

export async function generateEstimatingInvoicePDF(
  invoice: {
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    payment_status: string;
    customer_name: string;
    customer_email?: string | null;
    customer_phone?: string | null;
    yacht_name?: string | null;
    work_order_number?: string | null;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_amount?: number | null;
    discount_percentage?: number | null;
    shop_supplies_amount?: number | null;
    park_fees_amount?: number | null;
    surcharge_amount?: number | null;
    credit_card_fee?: number | null;
    deposit_applied?: number | null;
    amount_paid?: number | null;
    total_amount: number;
    notes?: string | null;
  },
  lineItems: { line_type: string; description: string; work_details?: string | null; quantity: number; unit_price: number; total_price: number; task_name?: string | null }[],
  companyInfo?: {
    company_name?: string | null;
    logo_url?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
  const pageWidth = 8.5;
  const margin = 0.75;
  let yPos = margin;

  let logoAdded = false;
  let logoWidth = 0;
  let logoHeight = 0;

  if (companyInfo?.logo_url) {
    try {
      const logoResponse = await fetch(companyInfo.logo_url);
      const logoBlob = await logoResponse.blob();
      await new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const base64data = reader.result as string;
            const img = new Image();
            img.onload = () => {
              try {
                const maxW = 1.8, maxH = 1.3;
                const ar = img.width / img.height;
                logoWidth = maxW;
                logoHeight = logoWidth / ar;
                if (logoHeight > maxH) { logoHeight = maxH; logoWidth = logoHeight * ar; }
                doc.addImage(base64data, 'PNG', margin, yPos, logoWidth, logoHeight);
                logoAdded = true;
              } catch { /* skip */ }
              resolve();
            };
            img.onerror = () => resolve();
            img.src = base64data;
          } catch { resolve(); }
        };
        reader.onerror = () => resolve();
        reader.readAsDataURL(logoBlob);
      });
    } catch { /* skip */ }
  }

  if (logoAdded) {
    const cx = margin + logoWidth + 0.15;
    const origY = yPos;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.company_name || 'AZ Marine', cx, yPos); yPos += 0.13;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    if (companyInfo?.address_line1) { doc.text(companyInfo.address_line1, cx, yPos); yPos += 0.11; }
    if (companyInfo?.address_line2) { doc.text(companyInfo.address_line2, cx, yPos); yPos += 0.11; }
    const csz = [companyInfo?.city, companyInfo?.state, companyInfo?.zip_code].filter(Boolean).join(', ');
    if (csz) { doc.text(csz, cx, yPos); yPos += 0.11; }
    if (companyInfo?.phone) { doc.text(`Phone: ${companyInfo.phone}`, cx, yPos); yPos += 0.11; }
    if (companyInfo?.email) { doc.text(`Email: ${companyInfo.email}`, cx, yPos); yPos += 0.11; }
    if (companyInfo?.website) { doc.text(`Web: ${companyInfo.website}`, cx, yPos); yPos += 0.11; }
    yPos = Math.max(yPos, origY + logoHeight) + 0.15;
  } else {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.company_name || 'AZ Marine', pageWidth / 2, yPos, { align: 'center' }); yPos += 0.15;
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    if (companyInfo?.address_line1) { doc.text(companyInfo.address_line1, pageWidth / 2, yPos, { align: 'center' }); yPos += 0.12; }
    const csz = [companyInfo?.city, companyInfo?.state, companyInfo?.zip_code].filter(Boolean).join(', ');
    if (csz) { doc.text(csz, pageWidth / 2, yPos, { align: 'center' }); yPos += 0.12; }
    if (companyInfo?.phone) { doc.text(`Phone: ${companyInfo.phone}`, pageWidth / 2, yPos, { align: 'center' }); yPos += 0.12; }
    if (companyInfo?.email) { doc.text(`Email: ${companyInfo.email}`, pageWidth / 2, yPos, { align: 'center' }); yPos += 0.12; }
    yPos += 0.15;
  }

  doc.setLineWidth(0.01);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 0.2;

  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text(`Invoice #: ${invoice.invoice_number}`, margin, yPos);
  const status = invoice.payment_status.toUpperCase();
  doc.text(status, pageWidth - margin - doc.getTextWidth(status), yPos);
  yPos += 0.3;

  const leftStartY = yPos;
  doc.setFontSize(10); doc.setFont('helvetica', 'bold');
  doc.text('Invoice Details', margin, yPos); yPos += 0.18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })}`, margin, yPos); yPos += 0.14;
  doc.text(`Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })}`, margin, yPos); yPos += 0.14;
  if (invoice.work_order_number) { doc.text(`Work Order: ${invoice.work_order_number}`, margin, yPos); yPos += 0.14; }

  const rightColX = pageWidth / 2 + 0.25;
  yPos = leftStartY;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Customer Information', rightColX, yPos); yPos += 0.18;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(invoice.customer_name, rightColX, yPos); yPos += 0.14;
  if (invoice.customer_email) { doc.text(invoice.customer_email, rightColX, yPos); yPos += 0.14; }
  if (invoice.customer_phone) { doc.text(invoice.customer_phone, rightColX, yPos); yPos += 0.14; }
  if (invoice.yacht_name) { doc.text(`Yacht: ${invoice.yacht_name}`, rightColX, yPos); yPos += 0.14; }
  yPos = Math.max(yPos, leftStartY + 0.6) + 0.2;

  if (lineItems.length > 0) {
    const tableData: any[] = [];
    let lastTask = '';
    lineItems.forEach(item => {
      const taskName = item.task_name || '';
      if (taskName && taskName !== lastTask) {
        tableData.push([{ content: taskName, colSpan: 5, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
        lastTask = taskName;
      }
      tableData.push([
        item.line_type.toUpperCase(),
        item.description + (item.work_details ? '\n' + item.work_details : ''),
        item.quantity.toString(),
        `$${Number(item.unit_price).toFixed(2)}`,
        `$${Number(item.total_price).toFixed(2)}`
      ]);
    });
    autoTable(doc, {
      startY: yPos,
      head: [['Type', 'Description', 'Qty', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
      margin: { left: margin, right: margin },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 0.8 },
        1: { cellWidth: 3.5 },
        2: { cellWidth: 0.6, halign: 'center' },
        3: { cellWidth: 1, halign: 'right' },
        4: { cellWidth: 1, halign: 'right' }
      }
    });
    yPos = (doc as any).lastAutoTable.finalY + 0.3;
  }

  const totalsX = pageWidth - margin - 2;
  doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', totalsX, yPos);
  doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;

  if (invoice.discount_amount && invoice.discount_amount > 0) {
    doc.text(`Discount (${Number(invoice.discount_percentage ?? 0).toFixed(1)}%):`, totalsX, yPos);
    doc.text(`-$${Number(invoice.discount_amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  }
  doc.text(`Tax (${(Number(invoice.tax_rate) * 100).toFixed(2)}%):`, totalsX, yPos);
  doc.text(`$${Number(invoice.tax_amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  if (invoice.shop_supplies_amount && invoice.shop_supplies_amount > 0) {
    doc.text('Shop Supplies:', totalsX, yPos);
    doc.text(`$${Number(invoice.shop_supplies_amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  }
  if (invoice.park_fees_amount && invoice.park_fees_amount > 0) {
    doc.text('Park Fees:', totalsX, yPos);
    doc.text(`$${Number(invoice.park_fees_amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  }
  if (invoice.surcharge_amount && invoice.surcharge_amount > 0) {
    doc.text('Surcharge:', totalsX, yPos);
    doc.text(`$${Number(invoice.surcharge_amount).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  }
  if (invoice.deposit_applied && invoice.deposit_applied > 0) {
    doc.text('Deposit Applied:', totalsX, yPos);
    doc.text(`-$${Number(invoice.deposit_applied).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  }
  if (invoice.credit_card_fee && invoice.credit_card_fee > 0) {
    doc.text('Credit Card Processing Fee (3%):', totalsX, yPos);
    doc.text(`$${Number(invoice.credit_card_fee).toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  const rawTotal = Number(invoice.total_amount) || 0;
  const rawDeposit = Number(invoice.deposit_applied) || 0;
  const displayTotal = Math.round((rawTotal - rawDeposit) * 100) / 100;
  doc.text('Total:', totalsX, yPos);
  doc.text(`$${displayTotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });

  const rawAmountPaid = Number(invoice.amount_paid) || 0;
  const rawBalanceDue = Number((invoice as any).balance_due);
  if (invoice.payment_status === 'paid' || rawAmountPaid > 0) {
    yPos += 0.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const amountPaid = rawAmountPaid > 0 ? rawAmountPaid : displayTotal;
    doc.text('Amount Paid:', totalsX, yPos);
    doc.text(`-$${amountPaid.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' }); yPos += 0.2;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    const balanceDue = !isNaN(rawBalanceDue) ? rawBalanceDue : Math.round((displayTotal - amountPaid) * 100) / 100;
    doc.text('Balance Due:', totalsX, yPos);
    doc.text(`$${balanceDue.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
  }

  if (invoice.notes) {
    yPos += 0.4;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Notes:', margin, yPos); yPos += 0.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const noteLines = doc.splitTextToSize(invoice.notes, pageWidth - margin * 2);
    doc.text(noteLines, margin, yPos);
  }

  return doc;
}

export interface EstimatingInvoiceSummary {
  id: string;
  invoice_number?: string;
  invoice_date?: string;
  total_amount?: number | string;
  payment_status?: string;
  work_title?: string;
  paid_at?: string;
  stripe_payment_intent_id?: string;
}

export function generateYachtInvoicesSummaryPDF(
  yachtName: string,
  year: number,
  invoices: YachtInvoice[],
  estInvoices: EstimatingInvoiceSummary[]
): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
  const pageWidth = 11;
  const margin = 0.75;
  let yPos = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${yachtName} — Invoices`, margin, yPos);
  yPos += 0.3;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Year: ${year}   |   Generated: ${phxDateTime(new Date())}`, margin, yPos);
  yPos += 0.35;

  doc.setTextColor(0, 0, 0);

  const rows: string[][] = [];

  for (const inv of invoices) {
    const dateStr = inv.invoice_date ? phxDate(inv.invoice_date) : '—';
    const status = inv.payment_status === 'paid' ? 'Paid' : inv.payment_status === 'pending' ? 'Pending' : inv.payment_status === 'refunded' ? 'Refunded' : inv.payment_status || '—';
    const paidAt = inv.paid_at ? phxDate(inv.paid_at) : '—';
    const paymentId = inv.payment_status === 'paid' && (inv.stripe_payment_intent_id || (inv as any).final_payment_stripe_payment_intent_id) ? (inv.stripe_payment_intent_id || (inv as any).final_payment_stripe_payment_intent_id) : '—';
    let amountDisplay = inv.invoice_amount || '—';
    if ((inv as any).credit_amount && Number((inv as any).credit_amount) > 0) {
      amountDisplay += `\n(Credit: $${Number((inv as any).credit_amount).toFixed(2)})`;
    }
    rows.push([dateStr, inv.repair_title || '—', amountDisplay, status, paidAt, paymentId]);
  }

  for (const inv of estInvoices) {
    const dateStr = inv.invoice_date ? phxDate(inv.invoice_date) : '—';
    const amount = inv.total_amount != null ? `$${Number(inv.total_amount).toFixed(2)}` : '—';
    const status = inv.payment_status === 'paid' ? 'Paid' : inv.payment_status === 'pending' ? 'Pending' : inv.payment_status === 'refunded' ? 'Refunded' : inv.payment_status || '—';
    const paidAt = inv.paid_at ? phxDate(inv.paid_at) : '—';
    const paymentId = inv.payment_status === 'paid' && (inv.stripe_payment_intent_id || inv.final_payment_stripe_payment_intent_id) ? (inv.stripe_payment_intent_id || inv.final_payment_stripe_payment_intent_id) : '—';
    rows.push([dateStr, inv.work_title || inv.invoice_number || '—', amount, status, paidAt, paymentId]);
  }

  rows.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Description', 'Amount', 'Status', 'Paid On', 'Stripe Payment ID']],
    body: rows,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 0.08, font: 'helvetica', lineColor: [203, 213, 225], lineWidth: 0.01 },
    headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 0.95 },
      1: { cellWidth: 3.2 },
      2: { cellWidth: 1.0 },
      3: { cellWidth: 0.75 },
      4: { cellWidth: 0.95 },
      5: { cellWidth: 2.65, textColor: [100, 116, 139] },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw as string;
        if (val === 'Paid') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Pending') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'Refunded') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      if (data.section === 'body' && data.column.index === 5 && data.cell.raw === '—') {
        data.cell.styles.textColor = [203, 213, 225];
      }
    },
    margin: { left: margin, right: margin },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? yPos + 1;
  const total = [
    ...invoices.map(i => i.invoice_amount_numeric || 0),
    ...estInvoices.map(i => Number(i.total_amount) || 0),
  ].reduce((s, v) => s + v, 0);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Total: $${total.toFixed(2)}`, pageWidth - margin, finalY + 0.25, { align: 'right' });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, 8, { align: 'right' });
  }

  return doc;
}
