import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { VesselManagementAgreement, UserProfile, Yacht, TripInspection, OwnerHandoffInspection, YachtBooking } from '../lib/supabase';

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

  addText(`Effective Date: ${new Date(agreement.start_date).toLocaleDateString()}`, 10, 'bold');
  addText(`Term: ${new Date(agreement.start_date).toLocaleDateString()} through ${new Date(agreement.end_date).toLocaleDateString()}`, 10);
  if (agreement.approved_at) {
    addText(`Agreement Executed: ${new Date(agreement.approved_at).toLocaleDateString()}`, 10);
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
    addText(`Date Signed: ${new Date(agreement.owner_signature_date).toLocaleDateString()}`, 9);
    addText(`Time: ${new Date(agreement.owner_signature_date).toLocaleTimeString()}`, 9);
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
    addText(`Date Signed: ${new Date(agreement.staff_signature_date).toLocaleDateString()}`, 9);
    addText(`Time: ${new Date(agreement.staff_signature_date).toLocaleTimeString()}`, 9);
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
    addText(`Date: ${new Date(agreement.approved_at).toLocaleDateString()} at ${new Date(agreement.approved_at).toLocaleTimeString()}`, 9, 'normal', 'center');
    yPos += 0.1;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  const footerY = 10.5;
  doc.text(`Agreement ID: ${agreement.id}`, margin, footerY);
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, footerY + 0.15);

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
  const dateText = `Generated: ${new Date().toLocaleString()}`;
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

export function generateTripInspectionPDF(inspection: TripInspection & { yachts?: { name: string }; user_profiles?: { first_name: string; last_name: string } }): jsPDF {
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

  const addInspectionItem = (label: string, condition?: string, notes?: string) => {
    if (!condition) return;

    const getConditionLabel = () => {
      if (condition === 'needs service' || condition === 'poor' || condition === 'needs_repair') {
        return 'Needs Service';
      } else if (condition === 'ok' || condition === 'good' || condition === 'excellent') {
        return 'OK';
      }
      return condition.replace('_', ' ');
    };

    addText(`${label}: ${getConditionLabel()}`, 10, 'bold');
    if (notes) {
      addText(`  Notes: ${notes}`, 9);
    }
    addSpace(0.1);
  };

  addText('Trip Inspection Report', 18, 'bold');
  addSpace(0.3);

  addText(`Yacht: ${inspection.yachts?.name || 'Unknown'}`, 10, 'bold');
  addText(`Inspector: ${inspection.user_profiles?.first_name || ''} ${inspection.user_profiles?.last_name || ''}`, 10);
  addText(`Inspection Type: ${inspection.inspection_type?.replace('_', '-') || 'N/A'}`, 10);
  addText(`Date: ${new Date(inspection.inspection_date).toLocaleString()}`, 10);
  addSpace(0.25);
  addLine();

  addText('Inspection Details', 14, 'bold');
  addSpace(0.15);

  const anyInspection = inspection as any;

  addInspectionItem('Hull Damage', inspection.hull_condition, inspection.hull_notes);
  addInspectionItem('Shore Cords', inspection.deck_condition, inspection.deck_notes);
  addInspectionItem('Trash Removed', anyInspection.trash_removed, anyInspection.trash_removed_notes);

  if (inspection.cabin_notes || inspection.galley_notes || inspection.head_notes || inspection.cabin_condition) {
    addText('Engine & Generator Hours', 12, 'bold');
    addSpace(0.1);
    if (inspection.cabin_notes) addText(`Port Engine Hours: ${inspection.cabin_notes}`, 10);
    if (inspection.galley_notes) addText(`Starboard Engine Hours: ${inspection.galley_notes}`, 10);
    if (inspection.head_notes) addText(`Port Generator Hours: ${inspection.head_notes}`, 10);
    if (inspection.cabin_condition) addText(`Starboard Generator Hours: ${inspection.cabin_condition}`, 10);
    addSpace(0.15);
  }

  addInspectionItem('Overall Condition', inspection.overall_condition);
  addInspectionItem('Inverter System', anyInspection.inverter_system, anyInspection.inverter_notes);
  addInspectionItem('Master Bathroom', anyInspection.master_bathroom, anyInspection.master_bathroom_notes);
  addInspectionItem('Secondary Bathroom', anyInspection.secondary_bathroom, anyInspection.secondary_bathroom_notes);
  addInspectionItem('Upper Deck Bathroom', anyInspection.upper_deck_bathroom, anyInspection.upper_deck_bathroom_notes);
  addInspectionItem('Lower Sinks', anyInspection.lower_sinks, anyInspection.lower_sinks_notes);
  addInspectionItem('Kitchen Sink', anyInspection.kitchen_sink, anyInspection.kitchen_sink_notes);
  addInspectionItem('Upper Kitchen Sink', anyInspection.upper_kitchen_sink, anyInspection.upper_kitchen_sink_notes);
  addInspectionItem('Garbage Disposal', anyInspection.garbage_disposal, anyInspection.garbage_disposal_notes);
  addInspectionItem('Upper Disposal', anyInspection.upper_disposal, anyInspection.upper_disposal_notes);
  addInspectionItem('Stove Top', anyInspection.stove_top, anyInspection.stove_top_notes);
  addInspectionItem('Upper Stove Top', anyInspection.upper_stove_top, anyInspection.upper_stove_top_notes);
  addInspectionItem('Dishwasher', anyInspection.dishwasher, anyInspection.dishwasher_notes);
  addInspectionItem('Trash Compactor', anyInspection.trash_compactor, anyInspection.trash_compactor_notes);
  addInspectionItem('Ice Maker', anyInspection.icemaker, anyInspection.icemaker_notes);
  addInspectionItem('12V Fans', anyInspection.volt_fans, anyInspection.volt_fans_notes);
  addInspectionItem('AC Filters', anyInspection.ac_filters, anyInspection.ac_filters_notes);
  addInspectionItem('Upper AC Filter', anyInspection.upper_ac_filter, anyInspection.upper_ac_filter_notes);
  addInspectionItem('AC Water Pumps', anyInspection.ac_water_pumps, anyInspection.ac_water_pumps_notes);
  addInspectionItem('Water Filters', anyInspection.water_filters, anyInspection.water_filters_notes);
  addInspectionItem('Water Pumps Controls', anyInspection.water_pumps_controls, anyInspection.water_pumps_controls_notes);
  addInspectionItem('Propane', anyInspection.propane, anyInspection.propane_notes);
  addInspectionItem('Windless Port', anyInspection.windless_port, anyInspection.windless_port_notes);
  addInspectionItem('Windless Starboard', anyInspection.windless_starboard, anyInspection.windless_starboard_notes);
  addInspectionItem('Anchor Lines', anyInspection.anchor_lines, anyInspection.anchor_lines_notes);
  addInspectionItem('Port Engine Oil', anyInspection.port_engine_oil, anyInspection.port_engine_oil_notes);
  addInspectionItem('Starboard Engine Oil', anyInspection.starboard_engine_oil, anyInspection.starboard_engine_oil_notes);
  addInspectionItem('Port Generator Oil', anyInspection.port_generator_oil, anyInspection.port_generator_oil_notes);
  addInspectionItem('Starboard Generator Oil', anyInspection.starboard_generator_oil, anyInspection.starboard_generator_oil_notes);
  addInspectionItem('Sea Strainers', anyInspection.sea_strainers, anyInspection.sea_strainers_notes);
  addInspectionItem('Engine Batteries', anyInspection.engine_batteries, anyInspection.engine_batteries_notes);

  if (inspection.additional_notes) {
    addSpace(0.15);
    addText('Additional Notes', 12, 'bold');
    addSpace(0.1);
    addText(inspection.additional_notes, 9);
  }

  addSpace(0.15);
  addText(`Issues Found: ${inspection.issues_found ? 'Yes' : 'No'}`, 11, 'bold');

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
  addText(`Date: ${new Date(handoff.inspection_date).toLocaleString()}`, 10);
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
  const dateText = `Generated: ${new Date().toLocaleString()}`;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, (pageWidth - dateWidth) / 2, yPos);
  yPos += 0.4;

  const sortedTrips = [...trips].sort((a, b) => {
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
  });

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
    } else {
      ownerNames = trip.owner_name || 'N/A';
      ownerContacts = trip.owner_contact || 'N/A';
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

interface EmployeeReport {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    employee_type: 'hourly' | 'salary';
  };
  entries: any[];
  totalStandardHours: number;
  totalOvertimeHours: number;
  totalHours: number;
}

export async function generateEstimatePDF(
  estimate: any,
  tasks: any[],
  yachtName: string | null,
  companyInfo?: any
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
                const maxLogoWidth = 2.0;
                const maxLogoHeight = 1.5;

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
    const companyInfoX = margin + logoWidth + 0.2;
    const originalYPos = yPos;
    yPos = originalYPos;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(companyInfo?.company_name || 'AZ MARINE SERVICES', companyInfoX, yPos);
    yPos += 0.18;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    if (companyInfo?.address_line1) {
      doc.text(companyInfo.address_line1, companyInfoX, yPos);
      yPos += 0.14;
    }

    if (companyInfo?.address_line2) {
      doc.text(companyInfo.address_line2, companyInfoX, yPos);
      yPos += 0.14;
    }

    if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
      const cityStateZip = [
        companyInfo.city,
        companyInfo.state,
        companyInfo.zip_code
      ].filter(Boolean).join(', ');
      doc.text(cityStateZip, companyInfoX, yPos);
      yPos += 0.14;
    }

    if (companyInfo?.phone) {
      doc.text(`Phone: ${companyInfo.phone}`, companyInfoX, yPos);
      yPos += 0.14;
    }

    if (companyInfo?.email) {
      doc.text(`Email: ${companyInfo.email}`, companyInfoX, yPos);
      yPos += 0.14;
    }

    if (companyInfo?.website) {
      doc.text(`Web: ${companyInfo.website}`, companyInfoX, yPos);
      yPos += 0.14;
    }

    yPos = Math.max(yPos, originalYPos + logoHeight);
    addSpace(0.3);
  } else {
    if (companyInfo?.company_name) {
      addText(companyInfo.company_name, 14, 'bold', 'center');
    } else {
      addText('AZ MARINE SERVICES', 14, 'bold', 'center');
    }

    if (companyInfo?.address_line1) {
      addText(companyInfo.address_line1, 9, 'normal', 'center');
    }

    if (companyInfo?.city || companyInfo?.state || companyInfo?.zip_code) {
      const cityStateZip = [
        companyInfo?.city,
        companyInfo?.state,
        companyInfo?.zip_code
      ].filter(Boolean).join(', ');
      addText(cityStateZip, 9, 'normal', 'center');
    }

    if (companyInfo?.phone) {
      addText(`Phone: ${companyInfo.phone}`, 9, 'normal', 'center');
    }

    if (companyInfo?.email) {
      addText(`Email: ${companyInfo.email}`, 9, 'normal', 'center');
    }

    if (companyInfo?.website) {
      addText(`Web: ${companyInfo.website}`, 9, 'normal', 'center');
    }

    addSpace(0.1);
  }

  addText('ESTIMATE', 18, 'bold', 'center');
  addSpace(0.3);

  addText(`Estimate #: ${estimate.estimate_number}`, 11, 'bold');
  addText(`Date: ${new Date(estimate.created_at).toLocaleDateString()}`, 10);
  addText(`Status: ${estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}`, 10);
  addSpace(0.25);

  addText('Customer Information', 12, 'bold');
  addLine();
  addSpace(0.1);

  if (estimate.is_retail_customer) {
    addText(`Customer: ${estimate.customer_name || 'N/A'}`, 10);
    if (estimate.customer_email) addText(`Email: ${estimate.customer_email}`, 10);
    if (estimate.customer_phone) addText(`Phone: ${estimate.customer_phone}`, 10);
  } else {
    addText(`Yacht: ${yachtName || 'N/A'}`, 10);
    if (estimate.marina_name) {
      addText(`Marina: ${estimate.marina_name}`, 10);
    }
    if (estimate.manager_name) {
      addText(`Repair Approval Manager: ${estimate.manager_name}`, 10);
      if (estimate.manager_email) {
        addText(`Manager Email: ${estimate.manager_email}`, 10);
      }
      if (estimate.manager_phone) {
        addText(`Manager Phone: ${estimate.manager_phone}`, 10);
      }
    }
  }
  addSpace(0.25);

  tasks.forEach((task, taskIndex) => {
    addText(`Task ${taskIndex + 1}: ${task.task_name}`, 12, 'bold');
    if (task.task_overview) {
      addSpace(0.05);
      addText(task.task_overview, 9);
    }
    addSpace(0.15);

    if (task.lineItems && task.lineItems.length > 0) {
      const lineItemHeaders = [['Description', 'Qty', 'Unit Price', 'Total']];
      const lineItemData = task.lineItems.map((item: any) => [
        item.description || '',
        item.quantity?.toString() || '0',
        `$${(item.unit_price || 0).toFixed(2)}`,
        `$${(item.total_price || 0).toFixed(2)}`
      ]);

      const taskSubtotal = task.lineItems.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0);

      autoTable(doc, {
        startY: yPos,
        head: lineItemHeaders,
        body: lineItemData,
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
        columnStyles: {
          0: { cellWidth: 3.5 },
          1: { cellWidth: 0.8, halign: 'center' },
          2: { cellWidth: 1.2, halign: 'right' },
          3: { cellWidth: 1.2, halign: 'right' }
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
  yPos += 0.15;

  const summaryData = [
    ['Subtotal:', `$${estimate.subtotal.toFixed(2)}`],
  ];

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
      fontSize: 10,
      cellPadding: 0.05,
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
  yPos += 0.15;

  autoTable(doc, {
    startY: yPos,
    body: [['TOTAL:', `$${estimate.total_amount.toFixed(2)}`]],
    theme: 'plain',
    styles: {
      fontSize: 12,
      cellPadding: 0.05,
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

  if (estimate.notes) {
    addSpace(0.15);
    addText('Notes', 11, 'bold');
    addSpace(0.05);
    addText(estimate.notes, 9);
  }

  if (estimate.customer_notes) {
    addSpace(0.15);
    addText('Customer Notes', 11, 'bold');
    addSpace(0.05);
    addText(estimate.customer_notes, 9);
  }

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 10.5);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, 10.5, { align: 'right' });
  }

  return doc;
}

export async function generatePayrollReportPDF(
  employeeReports: EmployeeReport[],
  startDate: string,
  endDate: string,
  yachtMap: Record<string, string>
): Promise<void> {
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
  addText(`Pay Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, 12, 'normal', 'center');
  addSpace(0.3);

  const summaryHeaders = [['Employee', 'Type', 'Standard Hours', 'Overtime Hours', 'Total Hours']];
  const summaryData = employeeReports.map(report => {
    return [
      `${report.user.last_name}, ${report.user.first_name}`,
      report.user.employee_type === 'hourly' ? 'Hourly' : 'Salary',
      report.totalStandardHours.toFixed(2),
      report.totalOvertimeHours.toFixed(2),
      report.totalHours.toFixed(2)
    ];
  });

  const grandTotalStandard = employeeReports.reduce((sum, r) => sum + r.totalStandardHours, 0);
  const grandTotalOvertime = employeeReports.reduce((sum, r) => sum + r.totalOvertimeHours, 0);
  const grandTotal = grandTotalStandard + grandTotalOvertime;

  summaryData.push([
    'TOTALS',
    '',
    grandTotalStandard.toFixed(2),
    grandTotalOvertime.toFixed(2),
    grandTotal.toFixed(2)
  ]);

  autoTable(doc, {
    startY: yPos,
    head: summaryHeaders,
    body: summaryData,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 0.08,
      font: 'helvetica'
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 2.5 },
      1: { cellWidth: 1.5 },
      2: { halign: 'right', cellWidth: 2.0 },
      3: { halign: 'right', cellWidth: 2.0 },
      4: { halign: 'right', cellWidth: 2.0, fontStyle: 'bold' }
    },
    didParseCell: function(data: any) {
      if (data.row.index === summaryData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [243, 244, 246];
      }
    },
    margin: { left: margin, right: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 0.4;

  employeeReports.forEach((report, reportIndex) => {
    if (report.entries.length === 0) return;

    if (yPos > pageHeight - 2) {
      doc.addPage();
      yPos = margin;
    }

    addText(`${report.user.last_name}, ${report.user.first_name} - Detailed Time Entries`, 12, 'bold');
    addSpace(0.1);

    const detailHeaders = [['Date', 'Yacht', 'Punch In', 'Punch Out', 'Lunch', 'Std Hours', 'OT Hours', 'Total', 'Notes']];
    const detailData = report.entries.map(entry => {
      const date = new Date(entry.punch_in_time).toLocaleDateString();
      const yacht = entry.yacht_id ? yachtMap[entry.yacht_id] || 'N/A' : 'N/A';
      const punchIn = new Date(entry.punch_in_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      const punchOut = entry.punch_out_time
        ? new Date(entry.punch_out_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        : 'Active';

      let lunch = 'N/A';
      if (report.user.employee_type === 'salary') {
        lunch = '1h (auto)';
      } else if (entry.lunch_break_start && entry.lunch_break_end) {
        const lunchStart = new Date(entry.lunch_break_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const lunchEnd = new Date(entry.lunch_break_end).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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
        font: 'helvetica'
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
        }
        if (data.column.index === 8 && data.cell.text[0] && data.cell.text[0].includes('[EDITED]')) {
          data.cell.styles.textColor = [234, 88, 12];
        }
      },
      margin: { left: margin, right: margin },
    });

    yPos = (doc as any).lastAutoTable.finalY + 0.3;
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, pageHeight - 0.3);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin - 0.5, pageHeight - 0.3, { align: 'right' });
  }

  const fileName = `Payroll_Report_${new Date(startDate).toLocaleDateString().replace(/\//g, '-')}_to_${new Date(endDate).toLocaleDateString().replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
}
