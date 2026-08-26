export type HealthResponse = {
  status: 'ok';
  service: 'ridevector-api';
};

export function healthResponse(): HealthResponse {
  return {
    status: 'ok',
    service: 'ridevector-api',
  };
}
