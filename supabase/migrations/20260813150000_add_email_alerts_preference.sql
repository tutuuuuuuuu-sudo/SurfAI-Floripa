-- O cron de alerta por email (.github/workflows/email-alert.yml) mandava "boas condições
-- de mar" pra TODOS os usuários cadastrados, de graça, sem checar assinatura nem dar opção
-- de sair da lista — mesmo "Alertas de swell" sendo um benefício exclusivo do plano Premium
-- (ver tabela de planos no CLAUDE.md). Corrigido em api/email-alert.ts: agora só manda pra
-- assinantes premium ativos, e cada um pode desligar essa preferência em Configurações.
-- Default true porque é um benefício que a pessoa já está pagando por — desligar é opt-out,
-- não opt-in.
alter table public.user_preferences
  add column if not exists email_alerts_enabled boolean not null default true;
