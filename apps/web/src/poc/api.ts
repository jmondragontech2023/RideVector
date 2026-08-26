import type { ApiErrorBody, PocGenerateRequestBody, PocGenerateResponse } from './types';

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (typeof configured === 'string' && configured.trim().length > 0) {
    return configured.replace(/\/+$/, '');
  }
  return '';
}

export class PocApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'PocApiError';
    this.status = status;
    this.code = code;
  }
}

export async function generatePocRoutes(
  body: PocGenerateRequestBody,
): Promise<PocGenerateResponse> {
  const response = await fetch(`${apiBaseUrl()}/api/poc/routes/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 404) {
    throw new PocApiError(
      404,
      'NOT_FOUND',
      'POC generation is only available on the local Worker (ENVIRONMENT=local).',
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PocApiError(response.status, 'INVALID_RESPONSE', 'The API returned a non-JSON body.');
  }

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody;
    throw new PocApiError(
      response.status,
      errorBody.error?.code ?? 'REQUEST_FAILED',
      errorBody.error?.message ?? 'Route generation failed.',
    );
  }

  return payload as PocGenerateResponse;
}
