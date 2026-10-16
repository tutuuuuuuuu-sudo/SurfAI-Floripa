-- Renovação automática do plano mensal (02/out/2026) — assinatura do Mercado Pago (/preapproval).
-- mp_preapproval_id: assinatura no MP que cobra todo mês no cartão.
-- auto_renew: true enquanto ela estiver ativa no MP; o robô de lembretes (api/plan-reminders.ts)
-- não avisa "vai acabar" pra quem renova sozinho. Cancelou (pela pessoa em Configurações ou pelo
-- MP depois de 3 cobranças recusadas) → false, o Premium vale até expires_at e os lembretes voltam.
alter table public.subscriptions add column if not exists mp_preapproval_id text;
alter table public.subscriptions add column if not exists auto_renew boolean not null default false;
