/**
 * Shared response utilities for edge functions
 * Provides consistent error handling and response formatting
 */

import { ValidationError } from './validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * Handle OPTIONS preflight request
 */
export function handleOptions(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Create success response
 */
export function successResponse(
  data: any,
  status = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Create error response with proper status code
 */
export function errorResponse(
  error: unknown,
  defaultMessage = 'Internal server error'
): Response {
  console.error('Error:', error);

  // Handle ValidationError
  if (error instanceof ValidationError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        field: error.field,
        type: 'validation_error',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('not found')) {
      return new Response(
        JSON.stringify({
          error: error.message,
          type: 'not_found',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return new Response(
        JSON.stringify({
          error: error.message,
          type: 'unauthorized',
        }),
        {
          status: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Generic error
    return new Response(
      JSON.stringify({
        error: error.message || defaultMessage,
        type: 'error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Unknown error type
  return new Response(
    JSON.stringify({
      error: defaultMessage,
      type: 'unknown_error',
    }),
    {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Wrap handler function with standard error handling
 */
export function withErrorHandling(
  handler: (req: Request) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    // Handle OPTIONS
    if (req.method === 'OPTIONS') {
      return handleOptions();
    }

    try {
      return await handler(req);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
