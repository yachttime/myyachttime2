import PDFDocument from 'npm:pdfkit@0.15.0';

const PHX = 'America/Phoenix';
const phxDateTime = (d: Date | string) => new Date(d).toLocaleString('en-US', { timeZone: PHX });

const NAVY: [number, number, number] = [10 / 255, 36 / 255, 64 / 255];
const TEAL: [number, number, number] = [0, 128 / 255, 128 / 255];
const OK_BG: [number, number, number] = [230 / 255, 247 / 255, 237 / 255];
const OK_FG: [number, number, number] = [22 / 255, 101 / 255, 52 / 255];
const WARN_BG: [number, number, number] = [254 / 255, 242 / 255, 220 / 255];
const WARN_FG: [number, number, number] = [146 / 255, 64 / 255, 14 / 255];
const LIGHT_BG: [number, number, number] = [245 / 255, 247 / 255, 250 / 255];
const BORDER: [number, number, number] = [210 / 255, 215 / 255, 220 / 255];
const TEXT_DIM: [number, number, number] = [100 / 255, 110 / 255, 120 / 255];
const BLACK: [number, number, number] = [0, 0, 0];

/**
 * Append a trip inspection report to an existing PDFKit document.
 * Mirrors the frontend generateTripInspectionPDF layout.
 */
export async function appendTripInspectionPDF(
  doc: InstanceType<typeof PDFDocument>,
  inspection: any,
  photos: any[]
): Promise<void> {
  const margin = 32;
  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentWidth = pageWidth - margin * 2;
  const anyI = inspection;

  // New page for inspection report
  doc.addPage();

  const fillRect = (x: number, y: number, w: number, h: number, color: [number, number, number]) => {
    doc.rect(x, y, w, h).fill(color);
  };

  // Header bar
  fillRect(0, 0, pageWidth, 85, NAVY);

  const typeLabel = (inspection.inspection_type === 'check_in' ? 'Check-In' :
    inspection.inspection_type === 'check_out' ? 'Check-Out' : 'Inspection').toUpperCase();

  doc.fillColor('white').font('Helvetica-Bold').fontSize(18).text('TRIP INSPECTION REPORT', margin, 30);
  doc.font('Helvetica').fontSize(9).text(typeLabel, pageWidth - margin - 100, 30, { width: 100, align: 'right' });

  const yachtName = inspection.yachts?.name || 'Unknown';
  const inspectorName = `${inspection.user_profiles?.first_name || ''} ${inspection.user_profiles?.last_name || ''}`.trim();
  const dateStr = phxDateTime(inspection.inspection_date);

  doc.fontSize(9).text(`Vessel: ${yachtName}`, margin, 49);
  doc.text(`Inspector: ${inspectorName}`, margin + contentWidth * 0.35, 49);
  doc.text(`Date: ${dateStr}`, margin + contentWidth * 0.70, 49);

  const ownerNameVal = (anyI.owner_name as string | null) || '';
  if (ownerNameVal) {
    doc.text(`Owner: ${ownerNameVal}`, margin, 66);
  }

  // Accent stripe
  fillRect(0, 85, pageWidth, 3, TEAL);

  let yPos = 98;

  // Issues badge
  const issuesBg = inspection.issues_found ? WARN_BG : OK_BG;
  const issuesFg = inspection.issues_found ? WARN_FG : OK_FG;
  const issuesLbl = inspection.issues_found ? '  ISSUES FOUND' : '  ALL CLEAR';
  fillRect(margin, yPos, 115, 16, issuesBg);
  doc.fillColor(issuesFg).font('Helvetica-Bold').fontSize(8).text(issuesLbl, margin + 6, yPos + 4);
  doc.fillColor(BLACK);
  yPos += 24;

  // Engine & generator hours
  const portEngHrs = anyI.port_engine_hours ?? null;
  const stbdEngHrs = anyI.stbd_engine_hours ?? null;
  const portGenHrs = anyI.port_gen_hours ?? null;
  const stbdGenHrs = anyI.stbd_gen_hours ?? null;

  if (portEngHrs != null || stbdEngHrs != null || portGenHrs != null || stbdGenHrs != null) {
    if (yPos + 50 > pageHeight - 40) { doc.addPage(); yPos = margin; }
    fillRect(margin, yPos, contentWidth, 23, NAVY);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text('ENGINE & GENERATOR HOURS', margin + 6, yPos + 7);
    doc.fillColor(BLACK);
    yPos += 23;

    const hrItems: [string, number | null][] = [
      ['Port Engine', portEngHrs],
      ['Stbd Engine', stbdEngHrs],
      ['Port Gen', portGenHrs],
      ['Stbd Gen', stbdGenHrs],
    ].filter(([, v]) => v != null) as [string, number | null][];

    const colW = contentWidth / 4;
    fillRect(margin, yPos, contentWidth, 19, LIGHT_BG);
    doc.lineWidth(0.5).rect(margin, yPos, contentWidth, 19).stroke(BORDER);

    hrItems.forEach(([label, val], i) => {
      const x = margin + i * colW;
      doc.font('Helvetica-Bold').fontSize(7).fillColor(TEXT_DIM).text(label, x + 4, yPos + 4);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BLACK).text(String(val ?? ''), x + 4, yPos + 11);
    });
    yPos += 24;
  }

  // Checklist section header
  fillRect(margin, yPos, contentWidth, 23, NAVY);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text('INSPECTION CHECKLIST', margin + 6, yPos + 7);
  doc.fillColor(BLACK);
  yPos += 23;

  const getStatus = (val?: string) => {
    if (!val) return null;
    if (['needs service', 'poor', 'needs_repair'].includes(val.toLowerCase())) return 'warn';
    if (['ok', 'good', 'excellent'].includes(val.toLowerCase())) return 'ok';
    return 'other';
  };

  const checkItems: Array<[string, string | undefined, string | undefined]> = [
    ['Hull Damage', inspection.hull_condition, inspection.hull_notes],
    ['Shore Cords', inspection.deck_condition, inspection.deck_notes],
    ['Trash Removed', anyI.trash_removed, anyI.trash_removed_notes],
    ['Overall Condition', inspection.overall_condition, undefined],
    ['Inverter System', anyI.inverter_system, anyI.inverter_notes],
    ['Master Bathroom', anyI.master_bathroom, anyI.master_bathroom_notes],
    ['Secondary Bathroom', anyI.secondary_bathroom, anyI.secondary_bathroom_notes],
    ['Upper Deck Bathroom', anyI.upper_deck_bathroom, anyI.upper_deck_bathroom_notes],
    ['Lower Sinks', anyI.lower_sinks, anyI.lower_sinks_notes],
    ['Kitchen Sink', anyI.kitchen_sink, anyI.kitchen_sink_notes],
    ['Upper Kitchen Sink', anyI.upper_kitchen_sink, anyI.upper_kitchen_sink_notes],
    ['Garbage Disposal', anyI.garbage_disposal, anyI.garbage_disposal_notes],
    ['Upper Disposal', anyI.upper_disposal, anyI.upper_disposal_notes],
    ['Stove Top', anyI.stove_top, anyI.stove_top_notes],
    ['Upper Stove Top', anyI.upper_stove_top, anyI.upper_stove_top_notes],
    ['Dishwasher', anyI.dishwasher, anyI.dishwasher_notes],
    ['Trash Compactor', anyI.trash_compactor, anyI.trash_compactor_notes],
    ['Ice Maker', anyI.icemaker, anyI.icemaker_notes],
    ['12V Fans', anyI.volt_fans, anyI.volt_fans_notes],
    ['AC Filters', anyI.ac_filters, anyI.ac_filters_notes],
    ['Upper AC Filter', anyI.upper_ac_filter, anyI.upper_ac_filter_notes],
    ['AC Water Pumps', anyI.ac_water_pumps, anyI.ac_water_pumps_notes],
    ['Water Filters', anyI.water_filters, anyI.water_filters_notes],
    ['Water Pump Controls', anyI.water_pumps_controls, anyI.water_pumps_controls_notes],
    ['Propane', anyI.propane, anyI.propane_notes],
    ['Windlass Port', anyI.windless_port, anyI.windless_port_notes],
    ['Windlass Stbd', anyI.windless_starboard, anyI.windless_starboard_notes],
    ['Anchor Lines', anyI.anchor_lines, anyI.anchor_lines_notes],
    ['Port Engine Oil', anyI.port_engine_oil, anyI.port_engine_oil_notes],
    ['Stbd Engine Oil', anyI.starboard_engine_oil, anyI.starboard_engine_oil_notes],
    ['Port Generator Oil', anyI.port_generator_oil, anyI.port_generator_oil_notes],
    ['Stbd Generator Oil', anyI.starboard_generator_oil, anyI.starboard_generator_oil_notes],
    ['Sea Strainers', anyI.sea_strainers, anyI.sea_strainers_notes],
    ['Engine Batteries', anyI.engine_batteries, anyI.engine_batteries_notes],
  ].filter(([, v]) => v) as Array<[string, string | undefined, string | undefined]>;

  const normalItems = checkItems.filter(([, , n]) => !n);
  const noteItems = checkItems.filter(([, , n]) => !!n);

  // Normal items in two columns
  const colW2 = contentWidth / 2;
  const statusColW = 36;
  const labelColW = colW2 - statusColW - 5;
  let rowY = yPos;
  const rowH = 14;

  for (let i = 0; i < normalItems.length; i += 2) {
    if (rowY + rowH > pageHeight - 40) { doc.addPage(); rowY = margin; }
    const left = normalItems[i];
    const right = normalItems[i + 1];
    const leftWarn = getStatus(left[1]) === 'warn';
    const rightWarn = right ? getStatus(right[1]) === 'warn' : false;

    // Left item
    doc.lineWidth(0.5);
    doc.rect(margin, rowY, labelColW, rowH).stroke(BORDER);
    doc.font('Helvetica').fontSize(7.5).fillColor([30 / 255, 40 / 255, 50 / 255])
      .text(left[0], margin + 4, rowY + 4, { width: labelColW - 4 });
    doc.rect(margin + labelColW + 3, rowY, statusColW, rowH).fillAndStroke(leftWarn ? WARN_BG : OK_BG, BORDER);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(leftWarn ? WARN_FG : OK_FG)
      .text(leftWarn ? 'NEEDS SVC' : 'OK', margin + labelColW + 3, rowY + 4, { width: statusColW, align: 'center' });

    // Right item
    const rightX = margin + colW2 + 5;
    if (right) {
      doc.fillColor(BLACK);
      doc.rect(rightX, rowY, labelColW, rowH).stroke(BORDER);
      doc.font('Helvetica').fontSize(7.5).fillColor([30 / 255, 40 / 255, 50 / 255])
        .text(right[0], rightX + 4, rowY + 4, { width: labelColW - 4 });
      doc.rect(rightX + labelColW + 3, rowY, statusColW, rowH).fillAndStroke(rightWarn ? WARN_BG : OK_BG, BORDER);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(rightWarn ? WARN_FG : OK_FG)
        .text(rightWarn ? 'NEEDS SVC' : 'OK', rightX + labelColW + 3, rowY + 4, { width: statusColW, align: 'center' });
    }
    doc.fillColor(BLACK);
    rowY += rowH;
  }

  yPos = rowY + 6;

  // Note items - each gets its own row with badge and notes text
  for (const [label, val, note] of noteItems) {
    const isWarn = getStatus(val) === 'warn';
    const badgeBg = isWarn ? WARN_BG : OK_BG;
    const badgeFg = isWarn ? WARN_FG : OK_FG;
    const noteFg = isWarn ? WARN_FG : OK_FG;
    const badgeTxt = isWarn ? 'NEEDS SVC' : 'OK';

    const noteText = note || '';
    const noteHeight = doc.heightOfString(noteText, { width: contentWidth - 30, fontSize: 7 });
    const totalH = 8 + 12 + 4 + noteHeight + 6;

    if (yPos + totalH > pageHeight - 40) { doc.addPage(); yPos = margin; }

    doc.lineWidth(0.5).rect(margin, yPos, contentWidth, totalH).stroke(BORDER);
    if (isWarn) {
      doc.rect(margin, yPos, 3, totalH).fill(WARN_FG);
    }

    const labelBaseline = yPos + 8 + 9;
    doc.font('Helvetica-Bold').fontSize(8).fillColor([30 / 255, 40 / 255, 50 / 255])
      .text(label, margin + 8, labelBaseline - 7, { width: contentWidth - 60 });

    const badgeW = 36;
    const badgeH = 14;
    const bx = margin + contentWidth - badgeW - 4;
    doc.rect(bx, yPos + 2, badgeW, badgeH).fill(badgeBg);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(badgeFg)
      .text(badgeTxt, bx, yPos + 5, { width: badgeW, align: 'center' });

    doc.font('Helvetica-Oblique').fontSize(7).fillColor(noteFg)
      .text(noteText, margin + 8, labelBaseline + 4, { width: contentWidth - 30 });
    doc.fillColor(BLACK);
    yPos += totalH + 4;
  }

  // Additional notes
  if (inspection.additional_notes) {
    yPos += 6;
    if (yPos + 50 > pageHeight - 40) { doc.addPage(); yPos = margin; }
    fillRect(margin, yPos, contentWidth, 23, NAVY);
    doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text('ADDITIONAL NOTES', margin + 6, yPos + 7);
    doc.fillColor(BLACK);
    yPos += 23;

    const notesHeight = doc.heightOfString(inspection.additional_notes, { width: contentWidth - 12, fontSize: 8 }) + 8;
    doc.lineWidth(0.5).rect(margin, yPos, contentWidth, notesHeight).stroke(BORDER);
    doc.font('Helvetica').fontSize(8).text(inspection.additional_notes, margin + 6, yPos + 4, { width: contentWidth - 12 });
    yPos += notesHeight + 4;
  }

  // Photos
  if (photos && photos.length > 0) {
    const allPhotos = photos.slice(0, 6);
    const photoBuffers: { photo: any; buffer: Uint8Array | null }[] = [];

    for (const p of allPhotos) {
      try {
        const resp = await fetch(p.photo_url);
        if (resp.ok) {
          const buf = new Uint8Array(await resp.arrayBuffer());
          photoBuffers.push({ photo: p, buffer: buf });
        }
      } catch {
        // skip failed photo
      }
    }

    const validPhotos = photoBuffers.filter(p => p.buffer);
    if (validPhotos.length > 0) {
      yPos += 6;
      const gap = 9;
      const imgW = (contentWidth - gap) / 2;
      const imgH = imgW * 0.72;
      const captionH = 10;
      const minSectionH = 23 + imgH + captionH;
      if (yPos + minSectionH > pageHeight - 40) { doc.addPage(); yPos = margin; }

      fillRect(margin, yPos, contentWidth, 23, NAVY);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(8).text('INSPECTION PHOTOS', margin + 6, yPos + 7);
      doc.fillColor(BLACK);
      yPos += 23;

      const catLabels: Record<string, string> = {
        port_prop: 'Port Propeller', starboard_prop: 'Stbd Propeller',
        damage: 'Damage', general: 'General',
      };
      const propImgW = imgW * 1.4;
      const propImgH = propImgW * 0.72;

      let i = 0;
      while (i < validPhotos.length) {
        const { photo: p, buffer } = validPhotos[i];
        const isProp = p.category === 'port_prop' || p.category === 'starboard_prop';

        if (isProp) {
          const totalH = propImgH + captionH;
          if (yPos + totalH > pageHeight - 30) { doc.addPage(); yPos = margin; }
          const x = margin + (contentWidth - propImgW) / 2;
          if (buffer) doc.image(buffer as any, x, yPos, { width: propImgW, height: propImgH });
          const cap = p.caption?.trim() || catLabels[p.category || ''] || '';
          if (cap) {
            doc.font('Helvetica').fontSize(6.5).fillColor(TEXT_DIM)
              .text(cap, x, yPos + propImgH + 2, { width: propImgW, align: 'center' });
          }
          doc.fillColor(BLACK);
          yPos += totalH + 4;
          i += 1;
        } else {
          const row = validPhotos.slice(i, i + 2);
          const totalH = imgH + captionH;
          if (yPos + totalH > pageHeight - 30) { doc.addPage(); yPos = margin; }
          row.forEach((rp, j) => {
            const x = margin + j * (imgW + gap);
            if (rp.buffer) doc.image(rp.buffer as any, x, yPos, { width: imgW, height: imgH });
            const cap = rp.photo.caption?.trim() || catLabels[rp.photo.category || ''] || '';
            if (cap) {
              doc.font('Helvetica').fontSize(6.5).fillColor(TEXT_DIM)
                .text(cap, x, yPos + imgH + 2, { width: imgW, align: 'center' });
            }
          });
          doc.fillColor(BLACK);
          yPos += totalH + 4;
          i += row.length;
        }
      }
    }
  }
}
