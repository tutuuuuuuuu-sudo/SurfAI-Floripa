# Surf AI Floripa

PWA de previsão de surf para Florianópolis — nota de condições em tempo real, previsão de
14 dias, relatório diário por IA e alertas de swell, para ~14 picos entre as regiões Norte,
Centro e Sul da ilha.

Domínio: [surfaifloripa.com.br](https://www.surfaifloripa.com.br) · deploy automático via
Vercel a partir da branch `main`.

Documentação completa (arquitetura, regras de negócio, banco de dados, variáveis de
ambiente e checklist de mudanças) está em [`CLAUDE.md`](./CLAUDE.md).

## Stack

React 19 + TypeScript + Vite 7 + Tailwind CSS 4 + shadcn/ui no frontend; backend
serverless em `api/` (Vercel Edge); Supabase (auth + banco); Mercado Pago (pagamento);
Google Gemini (relatório de IA); Resend (e-mail transacional).

## Rodando localmente

```bash
npm install
npm run dev
```

Antes de qualquer mudança, ver o checklist em `CLAUDE.md` (`type-check`, `test`, `build`).
