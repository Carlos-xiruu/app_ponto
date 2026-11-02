import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0';
import { corsHeadersFor } from './cors.ts';
import { createDeleteEmployeeHandler } from './handler.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const appOrigin = Deno.env.get('APP_ORIGIN');

if (!supabaseUrl || !serviceRoleKey || !appOrigin) throw new Error('Supabase Edge Function secrets não configurados.');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const getProfile = async (id: string) => {
  const { data, error } = await admin.from('perfis').select('id, is_admin').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
};

const handler = createDeleteEmployeeHandler({
  getCaller: async (token) => {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  },
  getProfile,
  wasArchived: async (id) => {
    const { data, error } = await admin.from('perfis_excluidos').select('id').eq('id', id).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  },
  deleteAuthUser: async (id) => {
    const { error } = await admin.auth.admin.deleteUser(id);
    return { error };
  }
});

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== appOrigin) return new Response(null, { status: 403 });

  const corsHeaders = corsHeadersFor(appOrigin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders });

  try {
    const response = await handler(request);
    Object.entries(corsHeaders).forEach(([name, value]) => response.headers.set(name, value));
    return response;
  } catch (error) {
    console.error('Erro ao excluir colaborador:', error);
    return new Response(JSON.stringify({ error: 'Não foi possível concluir a exclusão. Nenhum sucesso foi confirmado.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
