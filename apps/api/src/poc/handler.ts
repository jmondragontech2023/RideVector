import { generatePocRoutes } from './generate';
import {
  errorResponse,
  isPocRoutingEnabled,
  parseJsonBody,
  pocCorsHeaders,
  readValhallaBaseUrl,
  routingUnavailableResponse,
  jsonResponse,
} from './poc-http';
import { ValhallaRoutingProvider } from './routing/valhalla';
import type { PocGenerateResponse } from './types';
import { validatePocGenerateRequest } from './validate';

export async function handlePocGenerate(request: Request, env: Env): Promise<Response> {
  if (!isPocRoutingEnabled(env)) {
    return new Response('Not Found', { status: 404 });
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: pocCorsHeaders(),
    });
  }

  if (request.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for route generation.');
  }

  const baseUrl = readValhallaBaseUrl(env);
  if (!baseUrl) {
    return routingUnavailableResponse();
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const validated = validatePocGenerateRequest(parsedBody.body);
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

  return jsonResponse(result, 200, { headers: pocCorsHeaders() });
}

/** @deprecated use isPocRoutingEnabled */
export const isPocGenerationEnabled = isPocRoutingEnabled;
