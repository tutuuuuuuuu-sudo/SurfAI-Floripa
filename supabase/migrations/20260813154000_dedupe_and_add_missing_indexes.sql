-- Continuação da limpeza de performance da auditoria de 13/ago/2026.

-- Última policy duplicada que sobrou (score_snapshots, não coberta na migration
-- anterior por não envolver auth.uid()): duas policies idênticas de leitura pública.
drop policy if exists "Leitura pública de snapshots" on public.score_snapshots; -- mantém snapshots_read_all

-- Índices genuinamente duplicados (mesma coluna, dois nomes) — mantém sempre o
-- prefixado com idx_, dropa o outro. score_snapshots é a tabela que mais cresce
-- (+14 linhas/hora via api/snapshot.ts), então cada índice a mais custa em toda
-- escrita horária à toa.
drop index if exists public.push_subscriptions_user; -- mantém idx_push_subs_user_id
drop index if exists public.score_snapshots_beach_time; -- mantém score_snapshots_beach_captured
drop index if exists public.score_snapshots_time; -- mantém idx_score_snapshots_captured_at
drop index if exists public.subscriptions_user_id_idx; -- mantém idx_subscriptions_user_id

-- Foreign keys sem índice de cobertura (achado do advisor de performance) — sem
-- risco hoje com poucas linhas, mas evita scan completo quando crescer.
create index if not exists idx_comments_user_id on public.comments (user_id);
create index if not exists idx_payments_user_id on public.payments (user_id);
create index if not exists idx_spot_validations_user_id on public.spot_validations (user_id);
create index if not exists idx_surf_sessions_user_date on public.surf_sessions (user_id, date desc);
