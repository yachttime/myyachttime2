import { supabase } from '../lib/supabase';

/**
 * Fetches company info from the `companies` table and maps the fields
 * to the shape the PDF generators expect (company_name, address_line1,
 * address_line2, city, state, zip_code, phone, email, website, logo_url).
 *
 * If a companyId is provided, fetches that specific company; otherwise
 * falls back to the user's company via get_user_company_id() RPC.
 *
 * Uses an RPC call to bypass potential RLS recursion issues that can
 * cause the direct table query to return null even when the row exists.
 */
export async function getCompanyInfoForPdf(companyId?: string) {
  let effectiveCompanyId = companyId;

  if (!effectiveCompanyId) {
    const { data: rpcId, error: rpcErr } = await supabase.rpc('get_user_company_id');
    if (rpcErr) {
      console.error('[companyInfo] get_user_company_id RPC failed:', rpcErr);
    }
    effectiveCompanyId = rpcId || undefined;
    if (!effectiveCompanyId) {
      const { data: userData, error: userErr } = await supabase
        .from('user_profiles')
        .select('company_id, selected_company_id')
        .maybeSingle();
      if (userErr) {
        console.error('[companyInfo] user_profiles query failed:', userErr);
      }
      effectiveCompanyId = userData?.selected_company_id || userData?.company_id || undefined;
    }
  }

  if (!effectiveCompanyId) {
    console.error('[companyInfo] No company ID could be resolved; returning null');
    return null;
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', effectiveCompanyId)
    .maybeSingle();

  if (error) {
    console.error('[companyInfo] companies query failed for ID', effectiveCompanyId, ':', error);
  }

  if (!data) {
    console.warn('[companyInfo] No company row found for ID', effectiveCompanyId, '- RLS may be blocking the read');
    return null;
  }

  console.log('[companyInfo] Loaded company for PDF:', data.company_name, '(ID:', effectiveCompanyId, ')');

  return {
    company_name: data.company_name,
    address_line1: data.address || data.physical_address || null,
    address_line2: data.physical_address && data.address && data.physical_address !== data.address ? data.physical_address : null,
    city: data.city,
    state: data.state,
    zip_code: data.zip_code,
    phone: data.phone,
    email: data.email,
    website: data.website,
    logo_url: data.logo_url,
  };
}
