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
import type { RouteSpikeResponse } from './route-types';
import { validateRouteSpikeRequest } from './validate-route';

/** POC point-to-point / multi-stop route spike (local only). */
export async function handlePocRoute(request: Request, env: Env): Promise<Response> {
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
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST for route requests.');
  }

  const baseUrl = readValhallaBaseUrl(env);
  if (!baseUrl) {
    return routingUnavailableResponse();
  }

  const parsedBody = await parseJsonBody(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const validated = validateRouteSpikeRequest(parsedBody.body);
  if (!validated.ok) {
    return errorResponse(
      400,
      'VALIDATION_FAILED',
      'The route request is invalid.',
      validated.details,
    );
  }

  const provider = new ValhallaRoutingProvider({ baseUrl });
  const result = await provider.route({
    locations: [
      validated.request.start,
      ...validated.request.waypoints,
      validated.request.destination,
    ],
    costing: validated.request.costing,
  });

  if (!result.ok) {
    const status = result.reason === 'upstream_failure' ? 502 : 500;
    return errorResponse(status, 'ROUTING_FAILED', result.message);
  }

  const response: RouteSpikeResponse = {
    geometry: result.geometry,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
  };

  return jsonResponse(response, 200, { headers: pocCorsHeaders() });
}
