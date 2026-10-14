-- "Caiu hoje?" por notificação (api/session-reminder.ts, 14/out/2026)
-- session_reminder_enabled: interruptor nas Configurações (padrão ligado, como o alerta por e-mail)
-- surfed_prompt_dismissed_on: dia em que a pessoa tocou "Não caí" no cartão da Home — o robô das
--   19h não pergunta de novo no mesmo dia
-- session_reminder_sent_on: dia do último aviso mandado — o robô rodando 2x não manda repetido
alter table public.user_preferences
  add column if not exists session_reminder_enabled boolean not null default true,
  add column if not exists surfed_prompt_dismissed_on date,
  add column if not exists session_reminder_sent_on date;
