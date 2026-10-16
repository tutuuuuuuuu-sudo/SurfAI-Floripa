-- Alerta de mar bom (api/push-notify.ts) no máximo 1 vez por praia por dia em cada aparelho
-- (14/out/2026). O robô roda de hora em hora: sem lembrar o que já avisou, mandaria "Campeche está
-- boa" a cada hora de mar bom. Nunca tinha aparecido porque até hoje a consulta das favoritas
-- falhava e nenhum alerta saía (ver api/_pushMatch.ts).
alter table public.push_subscriptions
  add column if not exists alerted_on date,
  add column if not exists alerted_beaches text[];
