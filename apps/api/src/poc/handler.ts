import { generatePocRoutes } from './generate';
import { ValhallaRoutingProvider } from './routing/valhalla';
import type { PocErrorBody, PocGenerateResponse } from './types';
import { validatePocGenerateRequest } from './validate';

function jsonResponse(body: unknown, status = 200, init?: ResponseInit): Response {
  return Response.json(body, {
    status,
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: PocErrorBody['error']['details'],
): Response {
  const body: PocErrorBody = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  return jsonResponse(body, status);
}

/** POC generation is available only when ENVIRONMENT=local. */
export function isPocGenerationEnabled(env: Pick<Env, 'ENVIRONMENT'>): boolean {
  return env.ENVIRONMENT === 'local';
}

export async function handlePocGenerate(request: Request, env: Env): Promise<Response> {
  if (!isPocGenerationEnabled(env)) {
    return new Response('Not Found', { status: 404 });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for route generation.');
  }

  const baseUrl = env.VALHALLA_BASE_URL?.trim();
  if (!baseUrl) {
    return errorResponse(
      503,
      'ROUTING_UNAVAILABLE',
      'Local routing endpoint is not configured. Set VALHALLA_BASE_URL for the local Worker.',
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, 'VALIDATION_FAILED', 'Request body must be valid JSON.');
  }

  const validated = validatePocGenerateRequest(body);
  if (!validated.ok) {
    return errorResponse(
      400,
      'VALIDATION_FAILED',
      'The route request is invalid.',
      validated.details,
    );
  }

  const provider = new ValhallaRoutingProvider({ baseUrl });
  const result: PocGenerateResponse = await generatePocRoutes(validated.request, { provider });

  return jsonResponse(result, 200, { headers: corsHeaders() });
}

function corsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}
