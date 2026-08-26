import { healthResponse } from './health';

export { healthResponse };

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json(healthResponse());
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
