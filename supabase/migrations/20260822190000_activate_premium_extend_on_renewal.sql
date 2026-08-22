-- Corrige achado da auditoria de 22/ago/2026: quem renovava o Premium ANTES de expirar
-- perdia o tempo que sobrava — activate_premium() sempre recalculava expires_at a partir
-- de `now()`, mesmo quando a assinatura atual ainda tinha dias/meses restantes.
--
-- Agora, se a assinatura existente ainda está ativa (expires_at no futuro), a nova
-- duração é somada a partir do expires_at atual em vez de a partir de agora. Se já
-- expirou (ou é a primeira ativação), conta a partir de agora, como antes.

create or replace function public.activate_premium(
  p_user_id uuid,
  p_mp_payment_id text,
  p_mp_preference_id text,
  p_amount numeric default 29.90,
  p_payment_method text default 'unknown',
  p_duration_days integer default 30,
  p_plan text default 'monthly'
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inserted_count integer;
begin
  insert into payments (user_id, mp_payment_id, mp_preference_id, status, amount, payment_method)
  values (p_user_id, p_mp_payment_id, p_mp_preference_id, 'approved', p_amount, p_payment_method)
  on conflict (mp_payment_id) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    -- Este mp_payment_id já foi processado por outra chamada (webhook + IPN em paralelo,
    -- por exemplo) — não ativa de novo.
    return false;
  end if;

  insert into subscriptions (
    user_id, status, mp_payment_id, mp_preference_id,
    plan, amount, started_at, expires_at, updated_at
  ) values (
    p_user_id, 'premium', p_mp_payment_id, p_mp_preference_id,
    p_plan, p_amount, now(), now() + make_interval(days => p_duration_days), now()
  )
  on conflict (user_id) do update set
    status = 'premium',
    mp_payment_id = p_mp_payment_id,
    mp_preference_id = p_mp_preference_id,
    plan = p_plan,
    amount = p_amount,
    started_at = now(),
    -- Estende a partir do maior entre "agora" e o vencimento atual — quem renova
    -- cedo não perde o tempo que já pagou; quem renova depois de expirado conta
    -- a partir de agora, igual antes.
    expires_at = greatest(now(), subscriptions.expires_at) + make_interval(days => p_duration_days),
    updated_at = now();

  return true;
end;
$function$;
