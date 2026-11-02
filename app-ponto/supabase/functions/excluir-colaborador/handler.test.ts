import { createDeleteEmployeeHandler, type DeleteEmployeeDependencies } from './handler.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const requestFor = (targetUserId: string, token = 'token') => new Request('http://localhost/excluir-colaborador', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ targetUserId })
});

const requesterId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';

const dependencies = (overrides: Partial<DeleteEmployeeDependencies> = {}): DeleteEmployeeDependencies => ({
  getCaller: async () => ({ id: requesterId }),
  getProfile: async (id) => id === requesterId ? { id, is_admin: true } : { id, is_admin: false },
  wasArchived: async () => false,
  deleteAuthUser: async () => ({ error: null }),
  ...overrides
});

Deno.test('rejeita solicitante sem permissão de gestor', async () => {
  const handler = createDeleteEmployeeHandler(dependencies({
    getProfile: async (id) => ({ id, is_admin: false })
  }));
  const response = await handler(requestFor(targetId));
  assert(response.status === 403, 'Gestor ausente deveria receber 403');
});

Deno.test('rejeita exclusão da própria conta', async () => {
  const handler = createDeleteEmployeeHandler(dependencies());
  const response = await handler(requestFor(requesterId));
  assert(response.status === 400, 'Autoexclusão deveria receber 400');
});

Deno.test('exige remover a permissão de gestor antes da exclusão', async () => {
  const handler = createDeleteEmployeeHandler(dependencies({
    getProfile: async (id) => id === requesterId ? { id, is_admin: true } : { id, is_admin: true }
  }));
  const response = await handler(requestFor(targetId));
  assert(response.status === 409, 'A exclusão de gestor deveria receber 409');
});

Deno.test('rejeita colaborador inexistente que não possui histórico arquivado', async () => {
  const handler = createDeleteEmployeeHandler(dependencies({
    getProfile: async (id) => id === requesterId ? { id, is_admin: true } : null
  }));
  const response = await handler(requestFor(targetId));
  assert(response.status === 404, 'Colaborador inexistente deveria receber 404');
});

Deno.test('retorna sucesso somente após Auth confirmar a exclusão', async () => {
  let deletedId = '';
  const handler = createDeleteEmployeeHandler(dependencies({
    deleteAuthUser: async (id) => {
      deletedId = id;
      return { error: null };
    }
  }));
  const response = await handler(requestFor(targetId));
  const body = await response.json();
  assert(response.status === 200 && body.status === 'deleted', 'Exclusão confirmada deveria retornar sucesso');
  assert(deletedId === targetId, 'A exclusão deveria ser encaminhada ao Auth');
});

Deno.test('não confirma sucesso quando Auth falha sem arquivo histórico', async () => {
  const handler = createDeleteEmployeeHandler(dependencies({
    deleteAuthUser: async () => ({ error: { message: 'network error' } })
  }));
  const response = await handler(requestFor(targetId));
  assert(response.status === 502, 'Falha não confirmada deveria receber 502');
});

Deno.test('propaga falha de consulta para a camada HTTP retornar erro', async () => {
  const handler = createDeleteEmployeeHandler(dependencies({
    getProfile: async () => { throw new Error('database unavailable'); }
  }));
  let failed = false;
  try {
    await handler(requestFor(targetId));
  } catch {
    failed = true;
  }
  assert(failed, 'Falha de banco deveria alcançar o tratamento HTTP da Edge Function');
});

Deno.test('trata repetição após timeout confirmado pelo arquivo como idempotente', async () => {
  const handler = createDeleteEmployeeHandler(dependencies({
    deleteAuthUser: async () => ({ error: { message: 'timeout' } }),
    wasArchived: async () => true
  }));
  const response = await handler(requestFor(targetId));
  const body = await response.json();
  assert(response.status === 200 && body.status === 'already_deleted', 'Arquivo existente deveria confirmar repetição idempotente');
});
