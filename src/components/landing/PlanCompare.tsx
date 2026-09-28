import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Lock, Crown } from 'lucide-react'
import { FREE_DAYS } from '@/lib/weatherData'

// Grátis x Premium lado a lado (landing v2, 28/set/2026). Antes o plano grátis só era
// explicado dentro do FAQ e a seção de preço listava só o Premium. Cada linha foi conferida
// com o app: FREE_DAYS (weatherData.ts) pra previsão/curva, GeoFinderCard e
// BestWindowWidget travados por usePremium, AdBanner só pra quem não é Premium, chat com
// CHAT_DAILY_MAX=20 (api/surf-chat.ts). Pagamento é avulso (api/create-payment.ts, sem
// renovação) e o reembolso de 7 dias está nos Termos de Uso (Art. 49 do CDC).

type Cell = true | false | string
const ROWS: { label: string; free: Cell; premium: Cell }[] = [
  { label: 'Nota das 14 praias ao vivo', free: true, premium: true },
  { label: 'Previsão por dia', free: `${FREE_DAYS} dias`, premium: '14 dias' },
  { label: 'Curva hora a hora', free: `${FREE_DAYS} dias`, premium: '14 dias' },
  { label: 'Favoritos e diário de surf', free: true, premium: true },
  { label: 'Chat com o Surf AI', free: false, premium: '20 por dia' },
  { label: 'Melhor janela do dia', free: false, premium: true },
  { label: 'Bora Surfar', free: false, premium: true },
  { label: 'Alertas da sua praia', free: false, premium: true },
  { label: 'Histórico de 30 dias', free: false, premium: true },
  { label: 'Comparar praias', free: false, premium: true },
  { label: 'Sem anúncios', free: false, premium: true },
]

function Value({ v, premium }: { v: Cell; premium?: boolean }) {
  if (v === true) return <Check className={`mx-auto h-4 w-4 ${premium ? 'text-rating-fair' : 'text-rating-good'}`} aria-label="incluído" />
  if (v === false) return <Lock className="mx-auto h-3.5 w-3.5 text-muted-foreground/50" aria-label="não incluído" />
  return <span className={`text-xs font-semibold ${premium ? 'text-rating-fair' : 'text-foreground'}`}>{v}</span>
}

export function PlanCompare() {
  const [annual, setAnnual] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
        {/* Cabeçalho com os dois planos */}
        <div className="grid grid-cols-[minmax(0,1fr)_3.75rem_5.75rem] items-end gap-2 border-b border-border/60 p-4 sm:grid-cols-[minmax(0,1fr)_7rem_9rem]">
          <div />
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grátis</div>
            <div className="mt-1 text-lg font-black leading-none">R$0</div>
            <div className="text-[10px] text-muted-foreground">sem cartão</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-rating-fair">
              <Crown className="h-3.5 w-3.5" />Premium
            </div>
            <div className="mt-1 text-lg font-black leading-none tabular-nums text-rating-fair">{annual ? 'R$12,49' : 'R$16,90'}</div>
            <div className="text-[10px] text-muted-foreground">por mês</div>
            <div className="text-[10px] leading-tight text-muted-foreground">{annual ? 'R$149,90/ano' : 'por 30 dias'}</div>
          </div>
        </div>

        {/* Linhas */}
        <ul>
          {ROWS.map(r => (
            <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_3.75rem_5.75rem] items-center gap-2 border-b border-border/40 px-4 py-2.5 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_7rem_9rem]">
              <span className="leading-snug">{r.label}</span>
              <span className="text-center"><Value v={r.free} /></span>
              <span className="text-center"><Value v={r.premium} premium /></span>
            </li>
          ))}
        </ul>
      </div>

      {/* Mensal/Anual + botões */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex self-start rounded-xl border border-border bg-card p-1 text-sm" role="radiogroup" aria-label="Período do Premium">
          {[{ v: false, l: 'Mensal' }, { v: true, l: 'Anual · 26% menos' }].map(o => (
            <button key={o.l} type="button" role="radio" aria-checked={annual === o.v} onClick={() => setAnnual(o.v)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                annual === o.v ? 'bg-rating-fair text-[oklch(0.18_0.02_240)]' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {o.l}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Link to="/login?plan=premium" className="inline-flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-rating-fair px-5 text-sm font-bold text-[oklch(0.18_0.02_240)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Crown className="h-4 w-4" />Assinar Premium
          </Link>
          <Link to="/login" className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-xl border border-border px-5 text-sm font-bold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            Criar conta grátis
          </Link>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        Pagamento único pelo Mercado Pago, <strong className="font-semibold text-foreground">sem cobrança automática</strong>:
        quando acabar, você decide se renova. Se não curtir, devolvemos o valor em até 7 dias.
      </p>
    </div>
  )
}
