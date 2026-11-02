-- Apply through the Supabase migration workflow after the staging checks described in the deployment runbook.
-- This migration retains point and payroll rows. It never cascades their deletion.

create table public.perfis_excluidos (
  id uuid primary key,
  nome text not null,
  cpf text,
  funcao text,
  excluido_em timestamptz not null default now()
);

alter table public.registros_ponto
  add column colaborador_excluido_id uuid references public.perfis_excluidos(id);

alter table public.folhas_pagamento
  add column colaborador_excluido_id uuid references public.perfis_excluidos(id);

alter table public.registros_ponto
  alter column funcionario_id drop not null;

alter table public.folhas_pagamento
  alter column funcionario_id drop not null;

create index registros_ponto_colaborador_excluido_id_idx
  on public.registros_ponto (colaborador_excluido_id);

create index folhas_pagamento_colaborador_excluido_id_idx
  on public.folhas_pagamento (colaborador_excluido_id);

create or replace function public.eh_gestor_ativo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and is_admin = true
  );
$$;

revoke all on function public.eh_gestor_ativo() from public;
grant execute on function public.eh_gestor_ativo() to authenticated;

alter table public.perfis_excluidos enable row level security;
grant select on public.perfis_excluidos to authenticated;

create policy "gestores leem perfis excluidos"
on public.perfis_excluidos
for select
to authenticated
using (public.eh_gestor_ativo());

create or replace function public.arquivar_referencias_ao_excluir_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis_excluidos (id, nome, cpf, funcao)
  values (old.id, old.nome, old.cpf, old.funcao)
  on conflict (id) do nothing;

  update public.registros_ponto
  set colaborador_excluido_id = old.id,
      funcionario_id = null
  where funcionario_id = old.id;

  update public.folhas_pagamento
  set colaborador_excluido_id = old.id,
      funcionario_id = null
  where funcionario_id = old.id;

  return old;
end;
$$;

create trigger arquivar_referencias_ao_excluir_perfil
before delete on public.perfis
for each row execute function public.arquivar_referencias_ao_excluir_perfil();

-- The reported production state has exactly one broad UPDATE policy. Abort rather than
-- removing an unknown policy set if the environment differs from that state.
do $$
declare
  policy_name text;
  policy_count integer;
  update_policy_count integer;
begin
  select
    count(*),
    count(*) filter (where coalesce(qual, '') in ('true', '(true)')),
    min(policyname) filter (where coalesce(qual, '') in ('true', '(true)'))
  into update_policy_count, policy_count, policy_name
  from pg_policies
  where schemaname = 'public'
    and tablename = 'perfis'
    and cmd = 'UPDATE';

  if update_policy_count <> 1 or policy_count <> 1 then
    raise exception 'Esperada exatamente uma policy UPDATE USING true em public.perfis; encontradas % policies UPDATE e % USING true', update_policy_count, policy_count;
  end if;

  execute format('drop policy %I on public.perfis', policy_name);
end;
$$;

revoke update on public.perfis from anon, authenticated;
grant update (funcao, avatar_url, data_nascimento) on public.perfis to authenticated;

create policy "usuarios atualizam somente o proprio perfil"
on public.perfis
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- A policy ALL atual permite que PWAs antigas apaguem folhas diretamente. Preserve
-- as operações de gestor que ainda são usadas pelo aplicativo, mas exclua DELETE.
do $$
declare
  policy_name text;
  all_policy_count integer;
  delete_policy_count integer;
begin
  select count(*), min(policyname)
  into all_policy_count, policy_name
  from pg_policies
  where schemaname = 'public'
    and tablename = 'folhas_pagamento'
    and cmd = 'ALL';

  select count(*)
  into delete_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'folhas_pagamento'
    and cmd = 'DELETE';

  if all_policy_count <> 1 or delete_policy_count <> 0 then
    raise exception 'Esperada uma policy ALL e nenhuma DELETE em public.folhas_pagamento; encontradas % ALL e % DELETE', all_policy_count, delete_policy_count;
  end if;

  execute format('drop policy %I on public.folhas_pagamento', policy_name);
end;
$$;

revoke delete on public.folhas_pagamento from anon, authenticated;

create policy "gestores consultam folhas"
on public.folhas_pagamento
for select
to authenticated
using (public.eh_gestor_ativo());

create policy "gestores inserem folhas"
on public.folhas_pagamento
for insert
to authenticated
with check (public.eh_gestor_ativo());

create policy "gestores atualizam folhas"
on public.folhas_pagamento
for update
to authenticated
using (public.eh_gestor_ativo())
with check (public.eh_gestor_ativo());

create or replace function public.reabrir_folha_mes(p_mes_ano text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_gestor_ativo() then
    raise exception 'Apenas gestores podem reabrir folhas';
  end if;

  if p_mes_ano !~ '^\d{4}-\d{2}$' then
    raise exception 'Competência inválida';
  end if;

  delete from public.folhas_pagamento
  where mes_ano = p_mes_ano;
end;
$$;

revoke all on function public.reabrir_folha_mes(text) from public;
grant execute on function public.reabrir_folha_mes(text) to authenticated;

create or replace function public.alterar_permissao_gestor(
  p_colaborador_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.eh_gestor_ativo() then
    raise exception 'Apenas gestores podem alterar permissões';
  end if;

  if p_colaborador_id = auth.uid() then
    raise exception 'Um gestor não pode alterar a própria permissão';
  end if;

  if not p_is_admin and exists (
    select 1 from public.perfis where id = p_colaborador_id and is_admin = true
  ) and (select count(*) from public.perfis where is_admin = true) <= 1 then
    raise exception 'Não é permitido remover o último gestor';
  end if;

  update public.perfis
  set is_admin = p_is_admin
  where id = p_colaborador_id;

  if not found then
    raise exception 'Colaborador não encontrado';
  end if;
end;
$$;

revoke all on function public.alterar_permissao_gestor(uuid, boolean) from public;
grant execute on function public.alterar_permissao_gestor(uuid, boolean) to authenticated;
