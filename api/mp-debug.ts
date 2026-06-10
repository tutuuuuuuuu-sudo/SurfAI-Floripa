export const config = { runtime: 'edge' }

export default async function handler(req: Request) {
  const url = new URL(req.url)
  const headers: Record<string, string> = {}
  req.headers.forEach((v, k) => { headers[k] = v })

  let body = ''
  try { body = await req.text() } catch { body = '' }

  const info = {
    method: req.method,
    url: req.url,
    params: Object.fromEntries(url.searchParams.entries()),
    headers,
    body,
  }

  console.log('[mp-debug]', JSON.stringify(info))

  return new Response(JSON.stringify({ ok: true, received: info }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
