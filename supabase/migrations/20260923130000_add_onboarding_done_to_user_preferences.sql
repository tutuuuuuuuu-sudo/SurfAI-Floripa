-- Persiste o "onboarding completo" por conta (Supabase), não só por navegador (localStorage).
-- Sem isso, o quiz de boas-vindas repete em qualquer dispositivo/navegador novo mesmo pra
-- quem já respondeu antes em outro aparelho.
alter table public.user_preferences
  add column if not exists onboarding_done_at timestamptz;
