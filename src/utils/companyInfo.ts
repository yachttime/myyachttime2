import { supabase } from '../lib/supabase';

/**
 * Fetches company info from the `companies` table and maps the fields
 * to the shape the PDF generators expect (company_name, address_line1,
 * address_line2, city, state, zip_code, phone, email, website, logo_url).
 *
 * If a companyId is provided, fetches that specific company; otherwise
 * falls back to the user's company via get_user_company_id().
 */
export async function getCompanyInfoForPdf(companyId?: string) {
  let query = supabase.from('companies').select('*');
  if (companyId) {
    query = query.eq('id', companyId);
  } else {
    const { data: userData } = await supabase
      .from('user_profiles')
      .select('company_id, selected_company_id')
      .maybeSingle();
    const effectiveCompanyId = userData?.selected_company_id || userData?.company_id;
    if (effectiveCompanyId) {
      query = query.eq('id', effectiveCompanyId);
    } else {
      query = query.limit(1);
    }
  }

  const { data } = await query.maybeSingle();
  if (!data) return null;

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
