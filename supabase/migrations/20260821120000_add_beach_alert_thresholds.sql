-- "Alertas Personalizados" Fase 1 — nota mínima por praia, além da nota mínima
-- global (min_score) que hoje é igual pra todas as praias favoritas.
-- Chave do jsonb = beach_id (ids de src/lib/surfData.ts), valor = nota mínima
-- (mesma escala 1-10 do min_score). Praia sem entrada no mapa continua usando o
-- min_score global — não quebra quem já tinha alerta configurado.
-- Vive em push_subscriptions (não em user_preferences) para acompanhar o mesmo
-- padrão já usado por min_score/favorite_only, lidos direto por api/push-notify.ts
-- sem precisar de um join extra.
alter table public.push_subscriptions
  add column if not exists beach_thresholds jsonb not null default '{}'::jsonb;
