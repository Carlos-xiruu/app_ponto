import { corsHeadersFor } from './cors.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test('libera todos os headers enviados por supabase.functions.invoke', () => {
  const headers = corsHeadersFor('https://pontoseguro.company');
  assert(headers['Access-Control-Allow-Origin'] === 'https://pontoseguro.company', 'A origem configurada deve ser preservada');

  const allowedHeaders = headers['Access-Control-Allow-Headers'].split(', ');
  for (const header of ['authorization', 'apikey', 'x-client-info', 'content-type']) {
    assert(allowedHeaders.includes(header), `O header ${header} deve ser liberado no preflight`);
  }
});
