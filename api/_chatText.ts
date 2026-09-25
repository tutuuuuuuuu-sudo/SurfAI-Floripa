// Limpeza final da resposta do chat antes de ir pra tela — pedido do usuário 25/set/2026:
// "parar de usar travessão e asteriscos quando fala o nome da praia". A regra existe no
// prompt, mas nenhum modelo obedece 100% (principalmente os de reserva da cascata), então a
// garantia fica aqui, no código, e não na boa vontade do modelo.
// Prefixo _ indica que não é um handler HTTP — não será exposto como endpoint pelo Vercel.
export function cleanChatReply(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')        // **negrito**
    .replace(/__(.+?)__/g, '$1')            // __negrito__
    .replace(/(^|\s)\*(\S[^*\n]*?)\*(?=\s|[.,!?;:]|$)/gm, '$1$2') // *itálico*
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')     // # títulos
    .replace(/^\s*[*•]\s+/gm, '')           // * item / • item no começo da linha
    .replace(/\*/g, '')                     // asterisco solto que sobrou
    .replace(/\s*[—–]\s*/g, ', ')           // travessão/meia-risca vira vírgula
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/^,\s*/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}
