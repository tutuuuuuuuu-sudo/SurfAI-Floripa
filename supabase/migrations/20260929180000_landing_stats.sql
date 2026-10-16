-- Contador anônimo da landing: visitas e cliques nos botões de cadastro, somados por dia.
-- Sem cookie, sem IP, sem identificar ninguém (só o total do dia), por isso não depende do
-- aviso de cookies (LGPD). Escrito só pelo servidor (api/landing-event.ts, chave de serviço);
-- RLS ligada e sem política = o app (anon/authenticated) não lê nem escreve.
create table if not exists public.landing_stats (
  day date not null,
  event text not null,
  detail text not null default '',
  count integer not null default 0,
  primary key (day, event, detail)
);

alter table public.landing_stats enable row level security;
revoke all on public.landing_stats from anon, authenticated;

create or replace function public.bump_landing_stat(p_event text, p_detail text)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.landing_stats (day, event, detail, count)
  values ((now() at time zone 'America/Sao_Paulo')::date, p_event, coalesce(p_detail, ''), 1)
  on conflict (day, event, detail) do update set count = public.landing_stats.count + 1;
$$;

revoke execute on function public.bump_landing_stat(text, text) from public, anon, authenticated;
grant execute on function public.bump_landing_stat(text, text) to service_role;
