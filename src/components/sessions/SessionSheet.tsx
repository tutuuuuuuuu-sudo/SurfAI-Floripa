import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Star, Check, Share2, Waves, Wind, Clock, ArrowUpDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useBodyScrollLock } from '@/hooks/use-body-scroll-lock'
import { todaySP, nowHourSP } from '@/lib/timeSP'
import { formatWaveRange } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'
import { track } from '@/lib/monitoring'
import {
  fetchSessionConditions, saveSession, STAR_LABELS,
  type SessionConditions, type SurfSession,
} from '@/lib/sessions'
import { shareSessionCard } from '@/lib/sessionStoryCard'
import { BEACH_REGISTRY } from '../../../api/_beachRegistry'

// Registrar uma sessão em poucos toques (09/out/2026). Em toda a história do app só 1 sessão
// tinha sido registrada: o formulário antigo pedia praia, data, duração em dois campos e não
// devolvia nada. Aqui praia/dia/hora já vêm preenchidos quando dá, o mar daquela hora aparece
// sozinho e, salva a sessão, sai o cartão pro story.

const REGIONS = ['Norte', 'Centro', 'Sul'] as const
const HOURS = Array.from({ length: 15 }, (_, i) => i + 5) // 5h às 19h
const DURATIONS = [30, 60, 90, 120, 150, 180]
const durationLabel = (m: number) => (m < 60 ? `${m}min` : m % 60 ? `${Math.floor(m / 60)}h30` : `${m / 60}h`)

function yesterdaySP(): string {
  const d = new Date(`${todaySP()}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

const chip = (active: boolean) =>
  `rounded-xl border text-sm font-semibold transition-all active:scale-95 ${
    active ? 'bg-primary text-primary-foreground border-transparent' : 'border-border/60 bg-background/40 text-foreground/80 hover:border-primary/40'
  }`

export interface SessionSheetProps {
  initialBeachId?: string
  initialDate?: string
  initialHour?: number
  source: string
  onClose: () => void
  onSaved?: (session: SurfSession) => void
}

export function SessionSheet({ initialBeachId, initialDate, initialHour, source, onClose, onSaved }: SessionSheetProps) {
  useBodyScrollLock(true)
  const { user } = useAuth()
  const today = todaySP()
  const yesterday = yesterdaySP()

  const [beachId, setBeachId] = useState(initialBeachId ?? '')
  const [pickBeach, setPickBeach] = useState(!initialBeachId)
  const [date, setDate] = useState(initialDate ?? today)
  const [hour, setHour] = useState(() => {
    if (initialHour != null) return initialHour
    const h = (initialDate ?? today) === today ? nowHourSP() - 1 : 7
    return Math.min(19, Math.max(5, h))
  })
  const [duration, setDuration] = useState(90)
  const [rating, setRating] = useState(0)
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [fetched, setFetched] = useState<{ key: string; conditions: SessionConditions | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SurfSession | null>(null)
  const [sharing, setSharing] = useState(false)

  const beach = BEACH_REGISTRY.find(b => b.id === beachId)
  const dateInput = useRef<HTMLInputElement>(null)
  function openDatePicker() {
    const el = dateInput.current
    if (!el) return
    // showPicker: Chrome 99+, Safari 16+, Firefox 101+; sem ele, foco + clique no campo
    try { el.showPicker() } catch { el.focus(); el.click() }
  }
  const futureHour = date === today && hour > nowHourSP()
  const byRegion = useMemo(() => REGIONS.map(region => ({
    region,
    beaches: BEACH_REGISTRY.filter(b => b.region === region).sort((a, b) => b.lat - a.lat),
  })), [])

  // O mar daquela hora, do histórico do app
  const conditionsKey = beachId && !futureHour ? `${beachId}|${date}|${hour}` : null
  useEffect(() => {
    if (!conditionsKey) return
    let cancelled = false
    const [b, d, h] = conditionsKey.split('|')
    fetchSessionConditions(b, d, Number(h)).then(c => {
      if (!cancelled) setFetched({ key: conditionsKey, conditions: c })
    })
    return () => { cancelled = true }
  }, [conditionsKey])
  const loadingConditions = !!conditionsKey && fetched?.key !== conditionsKey
  const conditions = conditionsKey && fetched?.key === conditionsKey ? fetched.conditions : null

  async function handleSave() {
    if (!user || !beach) return
    if (!rating) { toast.error('Dá as estrelas pra salvar'); return }
    if (futureHour) { toast.error('Essa hora ainda não chegou'); return }
    setSaving(true)
    const session = await saveSession(user.id, {
      beachId: beach.id, beachName: beach.name, date, startHour: hour,
      durationMinutes: duration, rating, notes, conditions,
    })
    setSaving(false)
    if (!session) { toast.error('Não deu pra salvar. Tenta de novo.'); return }
    track('session_logged', { source, beach: beach.id, has_conditions: !!conditions })
    setSaved(session)
    onSaved?.(session)
  }

  async function handleShare() {
    if (!saved) return
    setSharing(true)
    const result = await shareSessionCard(saved)
    setSharing(false)
    track('session_shared', { result })
    if (result === 'downloaded') toast.success('Imagem baixada. É só postar no story!')
    if (result === 'failed') toast.error('Não deu pra gerar a imagem')
  }

  const ratingInfo = conditions?.score != null ? getRatingInfo(conditions.score) : null

  return (
    <div className="fixed inset-0 z-[70] bg-background/90 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-card border border-border/60 rounded-t-3xl sm:rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto p-5 pb-8 shadow-2xl"
        style={{ animation: 'slideUpSheet 0.3s ease-out' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{saved ? 'Sessão salva!' : 'Como foi a sessão?'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Fechar">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {saved ? (
          <div className="space-y-5 text-center">
            <div className="h-16 w-16 rounded-full bg-rating-good/15 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-rating-good" />
            </div>
            <div>
              <div className="font-semibold">{saved.beach_name} · {saved.start_hour}h</div>
              <div className="flex justify-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map(i => <Star key={i} className={`h-5 w-5 ${i <= (saved.rating ?? 0) ? 'text-rating-fair fill-rating-fair' : 'text-muted'}`} />)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Posta no story e marca a galera: o cartão já sai com o mar daquela hora.</p>
            <Button className="w-full h-11" onClick={handleShare} disabled={sharing}>
              {sharing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Share2 className="h-4 w-4 mr-2" />}
              Compartilhar no story
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={onClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Praia */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Praia</div>
              {!pickBeach && beach ? (
                <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/8 px-3 py-2.5">
                  <span className="font-semibold">{beach.name}</span>
                  <button onClick={() => setPickBeach(true)} className="text-xs font-semibold text-primary">Trocar</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {byRegion.map(({ region, beaches }) => (
                    <div key={region}>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1">{region}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {beaches.map(b => (
                          <button key={b.id} onClick={() => { setBeachId(b.id); setPickBeach(false) }}
                            className={`${chip(b.id === beachId)} px-3 py-1.5 text-xs`}>
                            {b.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dia */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Dia</div>
              <div className="grid grid-cols-3 gap-2">
                <button className={`${chip(date === today)} py-2`} onClick={() => setDate(today)}>Hoje</button>
                <button className={`${chip(date === yesterday)} py-2`} onClick={() => setDate(yesterday)}>Ontem</button>
                {/* Botão que abre o calendário (09/out/2026): o campo de data invisível por cima do botão
                    recebia o clique, mas no computador o calendário só abre pelo iconezinho dele — o
                    usuário clicava e nada acontecia */}
                <button type="button" className={`${chip(date !== today && date !== yesterday)} py-2 relative`} onClick={openDatePicker}>
                  {date !== today && date !== yesterday
                    ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : 'Outro dia'}
                  <input ref={dateInput} type="date" value={date} max={today} tabIndex={-1} aria-label="Escolher outro dia"
                    onChange={e => e.target.value && setDate(e.target.value)}
                    className="absolute inset-x-0 bottom-0 h-px w-full opacity-0 pointer-events-none" />
                </button>
              </div>
            </div>

            {/* Hora */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Que horas você entrou?</div>
              <div className="grid grid-cols-5 gap-1.5">
                {HOURS.map(h => (
                  <button key={h} onClick={() => setHour(h)} className={`${chip(h === hour)} py-1.5 text-xs`}>{h}h</button>
                ))}
              </div>
            </div>

            {/* Duração */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Quanto tempo na água?</div>
              <div className="grid grid-cols-6 gap-1.5">
                {DURATIONS.map(m => (
                  <button key={m} onClick={() => setDuration(m)} className={`${chip(m === duration)} py-1.5 text-xs`}>{durationLabel(m)}</button>
                ))}
              </div>
            </div>

            {/* O mar daquela hora */}
            {beach && (
              <div className="rounded-xl border border-border/50 bg-background/50 p-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">O mar naquela hora, pelo app</div>
                {futureHour ? (
                  <div className="text-sm text-muted-foreground">Essa hora ainda não chegou.</div>
                ) : loadingConditions ? (
                  <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Buscando...</div>
                ) : conditions ? (
                  <div className="flex items-center gap-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm flex-1">
                      {conditions.waveHeight != null && <span className="flex items-center gap-1.5"><Waves className="h-3.5 w-3.5 text-primary" />{formatWaveRange(conditions.waveHeight)}</span>}
                      {conditions.windSpeed != null && <span className="flex items-center gap-1.5"><Wind className="h-3.5 w-3.5 text-primary" />{conditions.windDirection} {conditions.windSpeed} km/h</span>}
                      {conditions.swellPeriod != null && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" />{conditions.swellPeriod}s</span>}
                      {conditions.tideTrend && <span className="flex items-center gap-1.5"><ArrowUpDown className="h-3.5 w-3.5 text-primary" />maré {conditions.tideTrend.replace(' (virando)', '')}</span>}
                    </div>
                    {ratingInfo && conditions.score != null && (
                      <div className="text-center flex-shrink-0">
                        <div className={`text-2xl font-bold leading-none ${ratingInfo.color}`}>{conditions.score.toFixed(1)}</div>
                        <div className={`text-[10px] font-bold mt-1 ${ratingInfo.color}`}>{ratingInfo.label}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Sem registro do mar nessa hora (o app guarda os últimos 30 dias).</div>
                )}
              </div>
            )}

            {/* Estrelas */}
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">Como estava?</div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <button key={i} type="button" onClick={() => setRating(i)} className="p-1 active:scale-90 transition-transform" aria-label={`${i} estrelas`}>
                    <Star className={`h-9 w-9 transition-colors ${i <= rating ? 'text-rating-fair fill-rating-fair' : 'text-muted'}`} />
                  </button>
                ))}
                {rating > 0 && <span className="text-sm font-semibold ml-2">{STAR_LABELS[rating]}</span>}
              </div>
            </div>

            {showNotes ? (
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} maxLength={300} autoFocus
                placeholder="Algum detalhe? Pico, prancha, quem tava junto..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
            ) : (
              <button onClick={() => setShowNotes(true)} className="text-sm font-semibold text-primary">+ Adicionar uma nota</button>
            )}

            <Button className="w-full h-12 text-base" onClick={handleSave} disabled={saving || !beach}>
              {saving ? 'Salvando...' : beach ? 'Salvar sessão' : 'Escolha a praia'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
