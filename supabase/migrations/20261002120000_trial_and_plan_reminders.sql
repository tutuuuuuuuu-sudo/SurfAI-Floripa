-- Teste grátis de 15 dias + lembretes de fim de plano (02/out/2026).

-- 1) Teste grátis: Premium por 15 dias, sem cartão, uma vez por conta.
-- Regra: só quem nunca teve linha em subscriptions (nunca assinou, nunca testou, nunca ganhou
-- cortesia). Se a pessoa assinar durante o teste, activate_premium soma os dias que sobraram
-- (greatest(now(), expires_at) + duração) e trial_started_at continua marcando que já testou.
-- 15 dias também está em src/lib/pricing.ts (TRIAL_DAYS) — mudar nos dois lugares.
alter table public.subscriptions add column if not exists trial_started_at timestamptz;

create or replace function public.start_trial()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  insert into public.subscriptions (user_id, status, plan, amount, started_at, expires_at, trial_started_at, updated_at)
  values (v_uid, 'premium', 'trial', 0, now(), now() + interval '15 days', now(), now())
  on conflict (user_id) do nothing;

  return found;
end;
$$;

revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- 2) "X surfistas assinaram nos últimos 7 dias" (Premium.tsx) passa a contar só pagamento de
-- verdade. Antes contava qualquer linha premium criada no período — teste grátis e cortesia
-- entrariam como "assinaram".
create or replace function public.count_recent_premium(since_days integer default 7)
returns integer
language sql
security definer
set search_path = 'public'
as $$
  select count(distinct user_id)::integer
  from payments
  where status = 'approved'
    and amount > 0
    and created_at >= now() - (least(greatest(since_days, 1), 90) || ' days')::interval;
$$;

-- 3) Lembretes de fim de plano/teste (api/plan-reminders.ts, robô diário). Uma linha por aviso
-- mandado: a chave (user_id, kind, period_end) impede mandar o mesmo aviso duas vezes, e um
-- período novo (renovou → expires_at novo) libera os avisos de novo.
-- kind: 'd5' (faltam ~5 dias), 'd1' (falta 1 dia), 'ended' (acabou).
create table if not exists public.plan_reminders (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  period_end timestamptz not null,
  plan text not null,
  sent_at timestamptz not null default now(),
  email_ok boolean,
  push_sent integer not null default 0,
  primary key (user_id, kind, period_end)
);

-- RLS ligada e sem política = só o servidor (chave de serviço) lê e escreve
alter table public.plan_reminders enable row level security;
revoke all on public.plan_reminders from anon, authenticated;
