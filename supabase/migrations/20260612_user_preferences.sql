-- Tabela de preferências do usuário
-- Sincronizada com localStorage em Settings.tsx
create table if not exists public.user_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  pref_skill  text check (pref_skill in ('Iniciante', 'Intermediário', 'Avançado')),
  pref_region text check (pref_region in ('all', 'Sul', 'Centro', 'Leste', 'Norte')),
  notif_min_score integer check (notif_min_score between 1 and 10),
  notif_fav_only  boolean default false,
  updated_at  timestamptz default now()
);

alter table public.user_preferences enable row level security;

create policy "Usuário lê suas próprias preferências"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "Usuário salva suas próprias preferências"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza suas próprias preferências"
  on public.user_preferences for update
  using (auth.uid() = user_id);
