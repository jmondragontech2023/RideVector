import { ValhallaHeightProvider } from './elevation/valhalla-height';
import { generatePocRoutes } from './generate';
import {
  errorResponse,
  isPocRoutingEnabled,
  parseJsonBody,
  pocCorsHeaders,
  readOpenMeteoBaseUrl,
  readTomTomApiKey,
  readTomTomBaseUrl,
  readValhallaBaseUrl,
  routingUnavailableResponse,
  jsonResponse,
} from './poc-http';
import { ValhallaRoutingProvider } from './routing/valhalla';
import { TomTomTrafficProvider } from './traffic/tomtom-flow';
import type { PocGenerateResponse } from './types';
import { validatePocGenerateRequest } from './validate';
import { OpenMeteoWeatherProvider } from './weather/open-meteo';

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
  const elevationProvider = validated.request.features.elevationEnrichment
    ? new ValhallaHeightProvider({ baseUrl })
    : null;
  const weatherProvider = validated.request.features.weatherForecast
    ? new OpenMeteoWeatherProvider({ baseUrl: readOpenMeteoBaseUrl(env) })
    : null;
  const tomtomKey = readTomTomApiKey(env);
  const trafficProvider =
    validated.request.features.motorTrafficEnrichment && tomtomKey
      ? new TomTomTrafficProvider({
          apiKey: tomtomKey,
          baseUrl: readTomTomBaseUrl(env),
        })
      : null;

  const result: PocGenerateResponse = await generatePocRoutes(validated.request, {
    provider,
    elevationProvider,
    weatherProvider,
    trafficProvider,
  });

  return jsonResponse(result, 200, { headers: pocCorsHeaders() });
}

/** @deprecated use isPocRoutingEnabled */
export const isPocGenerationEnabled = isPocRoutingEnabled;
