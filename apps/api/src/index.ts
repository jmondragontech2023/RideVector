import { healthResponse } from './health';
import { handlePocGenerate } from './poc/handler';
import { handlePocRoute } from './poc/route-handler';

export { healthResponse };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json(healthResponse());
    }

    if (url.pathname === '/api/poc/routes/generate') {
      return handlePocGenerate(request, env);
    }

    if (url.pathname === '/api/poc/routes/route') {
      return handlePocRoute(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
