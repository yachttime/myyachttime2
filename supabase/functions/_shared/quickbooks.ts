/**
 * QuickBooks API utilities
 * Provides helpers for making QuickBooks API calls with proper tracking
 */

interface QuickBooksAPICallOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  accessToken: string;
  body?: any;
  requestType: string;
  companyId: string;
  connectionId: string;
  referenceType?: string;
  referenceId?: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

interface QuickBooksAPIResponse {
  response: Response;
  data: any;
  intuitTid: string | null;
  success: boolean;
}

/**
 * Make a QuickBooks API call and automatically capture intuit_tid for troubleshooting
 */
export async function makeQuickBooksAPICall(
  options: QuickBooksAPICallOptions
): Promise<QuickBooksAPIResponse> {
  const {
    url,
    method,
    accessToken,
    body,
    requestType,
    companyId,
    connectionId,
    referenceType,
    referenceId,
    supabaseUrl,
    serviceRoleKey,
  } = options;

  const startTime = Date.now();
  let response: Response;
  let intuitTid: string | null = null;
  let success = false;
  let responseData: any = null;
  let errorMessage: string | null = null;
  let statusCode = 0;

  try {
    // Make the API call
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json';
    }

    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    statusCode = response.status;

    // Capture intuit_tid from response headers
    intuitTid = response.headers.get('intuit_tid');

    // Log the intuit_tid for immediate troubleshooting
    if (intuitTid) {
      console.log(`[QuickBooks API] intuit_tid: ${intuitTid} | ${requestType} | Status: ${statusCode}`);
    } else {
      console.warn(`[QuickBooks API] No intuit_tid in response | ${requestType} | Status: ${statusCode}`);
    }

    // Parse response
    const responseText = await response.text();

    if (response.ok) {
      success = true;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        responseData = responseText;
      }
    } else {
      errorMessage = responseText;
      console.error(`[QuickBooks API Error] ${requestType} failed:`, {
        status: statusCode,
        intuit_tid: intuitTid,
        error: responseText,
      });
    }

    // Extract QBO ID from response if available
    let qboId: string | null = null;
    if (success && responseData) {
      // Try to extract ID from common response patterns
      if (responseData.Customer?.Id) qboId = responseData.Customer.Id;
      else if (responseData.Invoice?.Id) qboId = responseData.Invoice.Id;
      else if (responseData.Payment?.Id) qboId = responseData.Payment.Id;
      else if (responseData.Item?.Id) qboId = responseData.Item.Id;
    }

    // Log to database asynchronously (don't block on this)
    logQuickBooksAPICall({
      companyId,
      connectionId,
      endpoint: new URL(url).pathname,
      method,
      requestType,
      intuitTid,
      statusCode,
      success,
      errorMessage,
      referenceType,
      referenceId,
      qboId,
      supabaseUrl,
      serviceRoleKey,
    }).catch((err) => {
      console.error('[QuickBooks] Failed to log API call:', err);
    });

    // Update connection with last intuit_tid (don't block on this)
    if (intuitTid) {
      updateConnectionLastApiCall({
        connectionId,
        intuitTid,
        supabaseUrl,
        serviceRoleKey,
      }).catch((err) => {
        console.error('[QuickBooks] Failed to update connection:', err);
      });
    }

    return {
      response,
      data: responseData,
      intuitTid,
      success,
    };
  } catch (error) {
    // Network or other errors
    errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[QuickBooks API Exception] ${requestType}:`, error);

    // Log the error (don't block on this)
    logQuickBooksAPICall({
      companyId,
      connectionId,
      endpoint: new URL(url).pathname,
      method,
      requestType,
      intuitTid,
      statusCode: statusCode || 0,
      success: false,
      errorMessage,
      referenceType,
      referenceId,
      qboId: null,
      supabaseUrl,
      serviceRoleKey,
    }).catch((err) => {
      console.error('[QuickBooks] Failed to log API error:', err);
    });

    throw error;
  }
}

interface LogAPICallOptions {
  companyId: string;
  connectionId: string;
  endpoint: string;
  method: string;
  requestType: string;
  intuitTid: string | null;
  statusCode: number;
  success: boolean;
  errorMessage: string | null;
  referenceType?: string;
  referenceId?: string;
  qboId: string | null;
  supabaseUrl: string;
  serviceRoleKey: string;
}

async function logQuickBooksAPICall(options: LogAPICallOptions): Promise<void> {
  const { supabaseUrl, serviceRoleKey, ...logData } = options;

  // Use direct fetch to avoid circular dependencies
  const response = await fetch(`${supabaseUrl}/rest/v1/quickbooks_api_logs`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      company_id: logData.companyId,
      connection_id: logData.connectionId,
      endpoint: logData.endpoint,
      method: logData.method,
      request_type: logData.requestType,
      intuit_tid: logData.intuitTid,
      status_code: logData.statusCode,
      success: logData.success,
      error_message: logData.errorMessage,
      reference_type: logData.referenceType,
      reference_id: logData.referenceId,
      qbo_id: logData.qboId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to log API call: ${response.statusText}`);
  }
}

interface UpdateConnectionOptions {
  connectionId: string;
  intuitTid: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}

async function updateConnectionLastApiCall(options: UpdateConnectionOptions): Promise<void> {
  const { connectionId, intuitTid, supabaseUrl, serviceRoleKey } = options;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/quickbooks_connection?id=eq.${connectionId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        last_intuit_tid: intuitTid,
        last_api_call_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update connection: ${response.statusText}`);
  }
}

/**
 * Extract intuit_tid from a response object
 * Useful when you can't use makeQuickBooksAPICall
 */
export function extractIntuitTid(response: Response): string | null {
  return response.headers.get('intuit_tid');
}
