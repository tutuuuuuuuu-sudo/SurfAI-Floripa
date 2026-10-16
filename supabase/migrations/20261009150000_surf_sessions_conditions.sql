-- Sessões do diário com a hora e o mar daquela hora (09/out/2026).
-- Em toda a história só 1 sessão tinha sido registrada: o formulário pedia trabalho e não devolvia
-- nada. Agora a sessão guarda a hora em que a pessoa entrou e as condições do mar naquela hora
-- (preenchidas pelo app a partir do histórico, api/session-conditions.ts). É com isso que o app
-- aprende o "seu mar ideal" (src/lib/idealSea.ts) e monta o cartão pro story.
alter table public.surf_sessions
  add column if not exists start_hour smallint check (start_hour between 0 and 23),
  add column if not exists wave_height numeric,
  add column if not exists wind_speed integer,
  add column if not exists wind_direction text,
  add column if not exists swell_period integer,
  add column if not exists app_score numeric,
  add column if not exists tide_trend text;
