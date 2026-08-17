# Surf AI - Relatório de Anúncios e Orgânico

Script que puxa dados de campanhas pagas (Facebook/Instagram Ads) e métricas
orgânicas (posts do Instagram) via Meta Graph API, e gera um relatório em
Markdown.

## Setup no Codespaces

1. Suba esta pasta pro seu repositório (ou crie um repo novo só pra isso).
2. Abra o Codespace.
3. Copie `.env.example` para `.env`:
   ```
   cp .env.example .env
   ```
4. Edite `.env` e cole seu `META_ACCESS_TOKEN` (o long-lived que você gerou
   no Graph API Explorer). **Nunca commite esse arquivo** — já está no
   `.gitignore`.
5. Instale as dependências:
   ```
   npm install
   ```
6. Rode o relatório:
   ```
   npm run report
   ```

## O que ele faz

- Descobre automaticamente sua conta de anúncios e sua Página (não precisa
  caçar IDs manualmente).
- Puxa insights de anúncios pagos dos últimos 30 dias (CTR, CPC, gasto,
  cliques no link), por anúncio individual.
- Se a Página tiver uma conta do Instagram vinculada, puxa também as
  métricas orgânicas dos posts recentes (alcance, impressões, curtidas,
  comentários).
- Salva o relatório em `report-AAAA-MM-DD.md` e imprime no terminal.

## Permissões necessárias no token

- `ads_read`
- `pages_show_list`
- `pages_read_engagement`
- `instagram_basic`

## Erros comuns

- **"Nenhuma conta de anúncios encontrada"** — sua conta ainda não tem uma
  Ad Account criada no Business Manager (diferente de ter só a Página).
- **"Nenhuma Página encontrada"** — confirme que a Página está vinculada ao
  seu portfólio empresarial no Business Suite.
- **Aviso sobre Instagram não vinculado** — o relatório ainda roda, só pula
  a seção orgânica do Instagram. Vincule o Instagram no Business Suite e
  rode de novo.
- **Token expirado** — gere um novo no Graph API Explorer e estenda pra
  long-lived antes de colar no `.env`.
