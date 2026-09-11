import { supabase } from '../lib/supabase';

/**
 * Generates a PDF from a jsPDF doc, uploads it to the salvage-media bucket,
 * and upserts a salvage_report_media row with media_type='document'.
 * Replaces any existing document PDF for the same report so only the
 * most current version is kept.
 */
export async function attachPdfToSalvageReport(
  salvageReportId: string,
  pdfDoc: { output: (type: string) => Blob },
  fileName: string
): Promise<void> {
  const pdfBlob = pdfDoc.output('blob');
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

  const storagePath = `${salvageReportId}/document/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('salvage-media')
    .upload(storagePath, file, { upsert: true, cacheControl: '3600' });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('salvage-media')
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // Remove any existing document media so only the latest is kept
  await supabase
    .from('salvage_report_media')
    .delete()
    .eq('salvage_report_id', salvageReportId)
    .eq('media_type', 'document');

  const { error: mediaError } = await supabase
    .from('salvage_report_media')
    .insert({
      salvage_report_id: salvageReportId,
      media_type: 'document',
      file_url: publicUrl,
      file_name: fileName,
      sort_order: 0,
    });

  if (mediaError) throw mediaError;
}

/**
 * Looks up a salvage report linked to the given estimate and, if found,
 * attaches the provided PDF to it.
 */
export async function attachPdfToEstimateSalvageReport(
  estimateId: string,
  pdfDoc: { output: (type: string) => Blob },
  fileName: string
): Promise<void> {
  const { data: report } = await supabase
    .from('salvage_reports')
    .select('id')
    .eq('estimate_id', estimateId)
    .maybeSingle();

  if (!report) return;
  await attachPdfToSalvageReport(report.id, pdfDoc, fileName);
}

/**
 * Looks up a salvage report linked to the given work order's estimate and,
 * if found, attaches the provided PDF to it.
 */
export async function attachPdfToWorkOrderSalvageReport(
  workOrderId: string,
  pdfDoc: { output: (type: string) => Blob },
  fileName: string
): Promise<void> {
  const { data: wo } = await supabase
    .from('work_orders')
    .select('estimate_id')
    .eq('id', workOrderId)
    .maybeSingle();

  if (!wo?.estimate_id) return;
  await attachPdfToEstimateSalvageReport(wo.estimate_id, pdfDoc, fileName);
}
