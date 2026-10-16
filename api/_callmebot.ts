// Envio de WhatsApp pelo CallMeBot (serviço gratuito, só pro número do founder — usado pelo
// relatório diário). Prefixo _ = não exposto como endpoint HTTP pelo Vercel.
//
// O CallMeBot corta mensagem longa sem avisar: em 07/out/2026 o relatório tinha 1.030
// caracteres e chegou só até o 718, sem "Ler mais" no WhatsApp (o texto inteiro saiu daqui,
// conferido na resposta do robô). Por isso cada envio é quebrado em pedaços de até
// WHATSAPP_MAX_CHARS, de preferência entre parágrafos, com folga em relação ao corte visto.
export const WHATSAPP_MAX_CHARS = 600

// Junta parágrafos (separados por linha em branco) enquanto couberem no limite. Parágrafo que
// sozinho passa do limite é quebrado na última quebra de linha ou espaço antes dele.
export function splitForWhatsApp(text: string, max = WHATSAPP_MAX_CHARS): string[] {
  const chunks: string[] = []
  let current = ''
  const pushLong = (paragraph: string) => {
    let rest = paragraph
    while (rest.length > max) {
      const window = rest.slice(0, max)
      const cut = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '))
      const at = cut > max / 2 ? cut : max
      chunks.push(rest.slice(0, at).trimEnd())
      rest = rest.slice(at).trimStart()
    }
    return rest
  }
  for (const paragraph of text.split(/\n{2,}/)) {
    const joined = current ? `${current}\n\n${paragraph}` : paragraph
    if (joined.length <= max) {
      current = joined
      continue
    }
    if (current) chunks.push(current)
    current = pushLong(paragraph)
  }
  if (current) chunks.push(current)
  return chunks
}

// Manda o texto em um ou mais pedaços, em ordem. true só se todos saíram.
export async function sendWhatsApp(phone: string, apiKey: string, text: string): Promise<boolean> {
  const chunks = splitForWhatsApp(text)
  for (let i = 0; i < chunks.length; i++) {
    // Intervalo entre pedaços da mesma mensagem, pra chegarem na ordem
    if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500))
    try {
      const res = await fetch(
        `https://api.callmebot.com/whatsapp.php?phone=${phone}&apikey=${apiKey}&text=${encodeURIComponent(chunks[i])}`,
        { signal: AbortSignal.timeout(10000) }
      )
      if (!res.ok) {
        console.error('[callmebot] envio voltou', res.status, (await res.text()).slice(0, 200))
        return false
      }
    } catch (err) {
      console.error('[callmebot] envio falhou:', err instanceof Error ? err.message : err)
      return false
    }
  }
  return true
}
