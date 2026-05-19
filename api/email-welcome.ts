export const config = { runtime: 'edge' }

// Chamado pelo webhook do Supabase quando um novo usuário se cadastra
// Configurar em: Supabase → Database → Webhooks → auth.users → INSERT

const RESEND_KEY = process.env.RESEND_API_KEY
const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET
const GMAIL_REPLY_TO = 'surfaifloripa@gmail.com'
const APP_URL = process.env.APP_URL ?? 'https://surf-ai-floripa.vercel.app'

async function sendWelcomeEmail(name: string, email: string) {
  const firstName = name?.split(' ')[0] ?? 'Surfista'

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden">
      <div style="padding:40px 32px;background:linear-gradient(135deg,#0ea5e9,#6366f1);text-align:center">
        <h1 style="margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px">Surf AI Floripa</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:15px">Florianópolis • SC</p>
      </div>
      <div style="padding:40px 32px">
        <h2 style="margin:0 0 16px;font-size:22px">Fala, ${firstName}! 🤙</h2>
        <p style="margin:0 0 16px;color:#ccc;line-height:1.6">
          Bem-vindo ao Surf AI Floripa. A partir de agora você tem as condições de surf das principais praias de Floripa em tempo real — analisadas por IA.
        </p>
        <div style="background:#1a1a1a;border:1px solid #333;border-radius:12px;padding:24px;margin:24px 0">
          <p style="margin:0 0 12px;font-weight:700;font-size:15px">O que você tem agora:</p>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="color:#ccc;font-size:14px">🌊 Score de condições para 17 praias em tempo real</div>
            <div style="color:#ccc;font-size:14px">🤖 Relatório diário gerado por IA toda manhã</div>
            <div style="color:#ccc;font-size:14px">🔔 Alertas quando o mar estiver bom</div>
            <div style="color:#ccc;font-size:14px">🗺️ Navegação direta até o pico</div>
          </div>
        </div>
        <a href="${APP_URL}" style="display:block;text-align:center;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;padding:16px 32px;border-radius:12px;font-weight:700;font-size:16px;margin:24px 0">
          Ver as condições agora
        </a>
        <p style="margin:24px 0 0;color:#666;font-size:13px;text-align:center">
          Qualquer dúvida, responde esse email. A gente está aqui.
        </p>
      </div>
      <div style="padding:20px 32px;background:#111;text-align:center">
        <p style="margin:0;font-size:12px;color:#555">
          Surf AI Floripa · Florianópolis, SC ·
          <a href="${APP_URL}/privacy" style="color:#555">Privacidade</a>
        </p>
      </div>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_KEY}` },
    body: JSON.stringify({
      from: 'Surf AI Floripa <onboarding@resend.dev>',
      reply_to: GMAIL_REPLY_TO,
      to: [email],
      subject: `Fala, ${firstName}! Bem-vindo ao Surf AI Floripa 🤙`,
      html,
    }),
  })

  return res.ok
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = req.headers.get('x-webhook-secret')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!RESEND_KEY) {
    return new Response('RESEND_API_KEY não configurada', { status: 500 })
  }

  let body: { record?: { email?: string; raw_user_meta_data?: { full_name?: string } } }
  try {
    body = await req.json()
  } catch {
    return new Response('Body inválido', { status: 400 })
  }

  const email = body.record?.email
  const name = body.record?.raw_user_meta_data?.full_name ?? ''

  if (!email) return new Response('Email ausente', { status: 400 })

  const sent = await sendWelcomeEmail(name, email)
  return new Response(JSON.stringify({ sent }), {
    status: sent ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  })
}
