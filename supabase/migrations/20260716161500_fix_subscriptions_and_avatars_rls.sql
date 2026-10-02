-- Duas falhas de segurança encontradas em auditoria manual de todas as RLS policies
-- do projeto (o advisor automático do Supabase não pega nenhuma das duas, porque
-- dependem de conhecer a lógica de negócio, não só padrões genéricos).

-- 1) subscriptions_insert permitia que QUALQUER usuário logado inserisse sua própria
--    linha em `subscriptions` via API REST, com status='premium' e expires_at
--    arbitrário — sem passar pelo Mercado Pago nem por activate_premium. O frontend
--    nunca faz INSERT nessa tabela (só SELECT, ver src/lib/premium.ts); toda ativação
--    real passa por activate_premium via service_role, que ignora RLS.
drop policy if exists "subscriptions_insert" on public.subscriptions;

-- 2) As policies do bucket "avatars" usavam storage.foldername(name)[1] esperando um
--    path tipo "{user_id}/foto.jpg", mas o app (Profile.tsx) salva como
--    "avatars/{user_id}.jpg" — arquivo direto na raiz, nomeado com o UUID, sem
--    subpasta. Isso quebrava a checagem dos dois lados: avatars_update/avatars_delete
--    nunca deixavam passar nem o próprio dono (foldername sempre retornava a string
--    fixa "avatars"), e avatars_insert só checava "authenticated" sem checar dono —
--    qualquer usuário logado podia sobrescrever o avatar de qualquer outro usuário.
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;

create policy "avatars_insert" on storage.objects
  for insert to public
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
    and auth.uid()::text = split_part(storage.filename(name), '.', 1)
  );

create policy "avatars_update" on storage.objects
  for update to public
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = split_part(storage.filename(name), '.', 1)
  );

create policy "avatars_delete" on storage.objects
  for delete to public
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = split_part(storage.filename(name), '.', 1)
  );
