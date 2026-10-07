-- Relatório diário (api/daily-report.ts): total de cadastros e quantos entraram desde p_since,
-- direto de auth.users. Antes contava pela tabela profiles, que só tem linha de 2 dos 24
-- cadastros (07/out/2026) e nem tem coluna created_at: o relatório mostrava "Usuários: 0 (+0 hoje)".
-- p_exclude: contas do founder e da família, que ficam fora dos números do relatório.
create or replace function public.report_user_counts(p_since timestamptz, p_exclude uuid[] default '{}')
returns table (total integer, new_since integer)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer,
         (count(*) filter (where u.created_at >= p_since))::integer
  from auth.users u
  where not (u.id = any(coalesce(p_exclude, '{}'::uuid[])));
$$;

revoke execute on function public.report_user_counts(timestamptz, uuid[]) from public, anon, authenticated;
grant execute on function public.report_user_counts(timestamptz, uuid[]) to service_role;
