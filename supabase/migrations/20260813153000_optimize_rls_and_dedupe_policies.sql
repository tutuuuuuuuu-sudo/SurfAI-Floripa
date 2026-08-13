-- Achado de auditoria (13/ago/2026): 45 policies permissivas duplicadas + 10 tabelas
-- reavaliando auth.uid() por linha em vez de uma vez por statement. Com ~9 usuários
-- ativos não dói hoje, mas cresce linearmente com o volume — mais barato corrigir
-- agora do que depois que score_snapshots/comments crescerem de verdade.
--
-- Duas mudanças, sem alterar nenhuma regra de acesso (mesmo qual/with_check em
-- todas, só reescritas):
-- 1) Remove policies genuinamente duplicadas (mesma tabela, mesmo cmd, mesma regra).
-- 2) Envolve auth.uid() em (select auth.uid()) nas 10 tabelas restantes — o
--    Postgres passa a resolver a identidade do usuário uma vez por statement em
--    vez de recalcular pra cada linha avaliada.

-- ── 1) Remove duplicatas exatas ────────────────────────────────────────────────

drop policy if exists "Usuário gerencia próprias subscriptions" on public.push_subscriptions; -- mantém push_subs_own
drop policy if exists "Usuário gerencia próprias preferências" on public.user_preferences; -- mantém user_preferences_own
drop policy if exists "Usuário atualiza suas próprias preferências" on public.user_preferences;
drop policy if exists "Usuário lê suas próprias preferências" on public.user_preferences;
drop policy if exists "Usuário salva suas próprias preferências" on public.user_preferences;

-- ── 2) auth.uid() → (select auth.uid()) nas policies restantes ─────────────────

-- comments
drop policy if exists "Usuários logados podem comentar" on public.comments;
create policy "Usuários logados podem comentar" on public.comments
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Usuários podem apagar seus próprios comentários" on public.comments;
create policy "Usuários podem apagar seus próprios comentários" on public.comments
  for delete using ((select auth.uid()) = user_id);

-- favorites
drop policy if exists "Usuário adiciona favoritos" on public.favorites;
create policy "Usuário adiciona favoritos" on public.favorites
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Usuário remove favoritos" on public.favorites;
create policy "Usuário remove favoritos" on public.favorites
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "Usuário vê seus favoritos" on public.favorites;
create policy "Usuário vê seus favoritos" on public.favorites
  for select using ((select auth.uid()) = user_id);

-- payments
drop policy if exists "user reads own payments" on public.payments;
create policy "user reads own payments" on public.payments
  for select using ((select auth.uid()) = user_id);

-- profiles
drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check ((select auth.uid()) = id);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using ((select auth.uid()) = id);

-- push_subscriptions (a duplicada já foi removida acima)
drop policy if exists "push_subs_own" on public.push_subscriptions;
create policy "push_subs_own" on public.push_subscriptions
  for all using ((select auth.uid()) = user_id);

-- spot_validations
drop policy if exists "Usuários logados podem validar" on public.spot_validations;
create policy "Usuários logados podem validar" on public.spot_validations
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Usuários podem atualizar seu próprio voto do dia" on public.spot_validations;
create policy "Usuários podem atualizar seu próprio voto do dia" on public.spot_validations
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- subscriptions
drop policy if exists "subscriptions_select" on public.subscriptions;
create policy "subscriptions_select" on public.subscriptions
  for select using ((select auth.uid()) = user_id);

-- surf_log
drop policy if exists "surf_log_delete" on public.surf_log;
create policy "surf_log_delete" on public.surf_log
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "surf_log_insert" on public.surf_log;
create policy "surf_log_insert" on public.surf_log
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "surf_log_select" on public.surf_log;
create policy "surf_log_select" on public.surf_log
  for select using ((select auth.uid()) = user_id);

drop policy if exists "surf_log_update" on public.surf_log;
create policy "surf_log_update" on public.surf_log
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- surf_sessions
drop policy if exists "Users can delete own sessions" on public.surf_sessions;
create policy "Users can delete own sessions" on public.surf_sessions
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own sessions" on public.surf_sessions;
create policy "Users can insert own sessions" on public.surf_sessions
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read own sessions" on public.surf_sessions;
create policy "Users can read own sessions" on public.surf_sessions
  for select using ((select auth.uid()) = user_id);

-- user_preferences (as 4 duplicadas já foram removidas acima)
drop policy if exists "user_preferences_own" on public.user_preferences;
create policy "user_preferences_own" on public.user_preferences
  for all using ((select auth.uid()) = user_id);
