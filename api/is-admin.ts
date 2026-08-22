export const config = { runtime: 'edge' }

// Endpoint mínimo pra frontend checar se o usuário logado é admin — necessário porque
// a tabela `admins` tem RLS "admins_no_public_access" (ninguém lê direto pelo client,
// nem o próprio dono da linha). Usado pelo ContentStudio.tsx pra travar acesso: essa
// ferramenta é de uso interno (gera post pras redes sociais do próprio Surf AI), não é
// benefício de assinante — nunca foi anunciada como tal no app, mas até essa correção
// qualquer assinante Premium que descobrisse a URL conseguia usar.

import { verifyToken, isAdminUser } from './_auth.js'

export default async function handler(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ isAdmin: false }), { headers: { 'Content-Type': 'application/json' } })
  }

  const { valid, userId } = await verifyToken(token)
  if (!valid || !userId) {
    return new Response(JSON.stringify({ isAdmin: false }), { headers: { 'Content-Type': 'application/json' } })
  }

  const isAdmin = await isAdminUser(userId)
  return new Response(JSON.stringify({ isAdmin }), { headers: { 'Content-Type': 'application/json' } })
}
