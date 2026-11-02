export type Profile = { id: string; is_admin: boolean };

export type DeleteEmployeeDependencies = {
  getCaller: (token: string) => Promise<{ id: string } | null>;
  getProfile: (id: string) => Promise<Profile | null>;
  wasArchived: (id: string) => Promise<boolean>;
  deleteAuthUser: (id: string) => Promise<{ error?: { message: string } | null }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const json = (body: Record<string, string>, status: number) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

export const createDeleteEmployeeHandler = (dependencies: DeleteEmployeeDependencies) => async (request: Request) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sessão não autenticada.' }, 401);

  const caller = await dependencies.getCaller(authorization.slice(7));
  if (!caller) return json({ error: 'Sessão inválida.' }, 401);

  let targetUserId = '';
  try {
    targetUserId = (await request.json()).targetUserId;
  } catch {
    return json({ error: 'Requisição inválida.' }, 400);
  }

  if (typeof targetUserId !== 'string' || !uuidPattern.test(targetUserId)) {
    return json({ error: 'Colaborador inválido.' }, 400);
  }
  if (targetUserId === caller.id) return json({ error: 'Não é permitido excluir a própria conta.' }, 400);

  const [requester, target] = await Promise.all([
    dependencies.getProfile(caller.id),
    dependencies.getProfile(targetUserId)
  ]);

  if (!requester?.is_admin) return json({ error: 'Apenas gestores podem excluir colaboradores.' }, 403);
  if (!target) {
    return (await dependencies.wasArchived(targetUserId))
      ? json({ status: 'already_deleted' }, 200)
      : json({ error: 'Colaborador não encontrado.' }, 404);
  }
  if (target.is_admin) return json({ error: 'Remova a permissão de gestor antes de excluir a conta.' }, 409);

  const { error } = await dependencies.deleteAuthUser(targetUserId);
  if (error) {
    // A resposta pode se perder após o Auth concluir a transação. O arquivo é a confirmação durável.
    if (await dependencies.wasArchived(targetUserId)) return json({ status: 'already_deleted' }, 200);
    return json({ error: 'Não foi possível concluir a exclusão. Nenhum sucesso foi confirmado.' }, 502);
  }

  return json({ status: 'deleted' }, 200);
};
