import { healthResponse } from './health';
import { handlePocGenerate, type PocEnv } from './poc/handler';

export { healthResponse };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pocEnv = env as PocEnv;

    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json(healthResponse());
    }

    if (url.pathname === '/api/poc/routes/generate') {
      return handlePocGenerate(request, pocEnv);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
