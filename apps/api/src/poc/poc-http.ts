import type { PocErrorBody } from './types';

export function jsonResponse(body: unknown, status = 200, init?: ResponseInit): Response {
  return Response.json(body, {
    status,
    ...init,
    headers: {
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

export function errorResponse(
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

/** POC routing endpoints are available only when ENVIRONMENT=local. */
export function isPocRoutingEnabled(env: Pick<Env, 'ENVIRONMENT'>): boolean {
  return env.ENVIRONMENT === 'local';
}

export function readValhallaBaseUrl(env: Env): string | null {
  const baseUrl = env.VALHALLA_BASE_URL?.trim();
  return baseUrl ? baseUrl : null;
}

export function pocCorsHeaders(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  };
}

export async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return {
      ok: false,
      response: errorResponse(400, 'VALIDATION_FAILED', 'Request body must be valid JSON.'),
    };
  }
}

export function routingUnavailableResponse(): Response {
  return errorResponse(
    503,
    'ROUTING_UNAVAILABLE',
    'Routing endpoint is not configured. Set VALHALLA_BASE_URL for the local Worker.',
  );
}
