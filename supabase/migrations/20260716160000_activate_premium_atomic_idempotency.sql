-- Corrige race condition de idempotência de pagamentos: o webhook e o IPN legado do
-- Mercado Pago podem notificar o mesmo pagamento quase simultaneamente. Até agora, a
-- checagem de "pagamento já processado" era feita no código da API (SELECT em payments
-- antes de chamar esta função) — um check-then-act não atômico, e além disso a tabela
-- `payments` nunca chegava a ser escrita por nenhum dos dois endpoints.
--
-- Esta versão faz o registro em `payments` (com sua constraint UNIQUE em mp_payment_id)
-- e a ativação do premium na mesma transação: se duas chamadas concorrentes tentarem
-- processar o mesmo mp_payment_id, o banco garante que só uma delas ativa a assinatura.

-- Remove a sobrecarga antiga de 5 parâmetros (pré-planos anual/mensal), órfã desde que
-- mp-webhook.ts/mp-ipn.ts passaram a sempre chamar a versão de 7 parâmetros.
drop function if exists public.activate_premium(uuid, text, text, numeric, text);

-- O retorno muda de void para boolean (para o chamador saber se a ativação de fato
-- aconteceu ou se foi ignorada por já ter sido processada) — precisa dropar antes.
drop function if exists public.activate_premium(uuid, text, text, numeric, text, integer, text);

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
    expires_at = now() + make_interval(days => p_duration_days),
    updated_at = now();

  return true;
end;
$function$;

-- Falha de autorização encontrada durante esta correção: a função estava executável por
-- `anon` e `authenticated` via /rest/v1/rpc/activate_premium — qualquer visitante sem
-- login podia se conceder premium de graça passando qualquer p_user_id. Só o backend
-- (service_role, usando SUPABASE_SERVICE_ROLE_KEY) deve poder chamar esta função.
revoke execute on function public.activate_premium(uuid, text, text, numeric, text, integer, text) from public;
revoke execute on function public.activate_premium(uuid, text, text, numeric, text, integer, text) from anon;
revoke execute on function public.activate_premium(uuid, text, text, numeric, text, integer, text) from authenticated;
