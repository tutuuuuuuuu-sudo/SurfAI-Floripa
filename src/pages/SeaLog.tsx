import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Lock, Waves } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useIsAdmin } from '@/lib/admin'
import { BEACH_REGISTRY } from '../../api/_beachRegistry'

// Registro do mar real (01/out/2026) — uso interno, só admin. Anota o tamanho que o dono do app
// viu (ou que o boletim.surf mostrou) e mostra lado a lado o que o app dizia na mesma hora, pra
// calibrar a altura de onda (api/_beachHeight.ts) com dado real.

type Source = 'eu' | 'boletim.surf' | 'outro'
interface Item {
  id: number; beach_id: string; observed_at: string; height_min: number; height_max: number
  source: Source; note: string | null; app_height: number | null; app_period: number | null
}

const SOURCES: { id: Source; label: string }[] = [
  { id: 'eu', label: 'Eu vi' }, { id: 'boletim.surf', label: 'boletim.surf' }, { id: 'outro', label: 'Outro' },
]
const beachName = (id: string) => BEACH_REGISTRY.find(b => b.id === id)?.name ?? id
const m = (n: number) => `${n.toFixed(1).replace('.', ',')}`
// "agora" no formato do campo de data e hora do celular (horário local)
function nowLocal(): string {
  const d = new Date(); d.setSeconds(0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

async function authHeader(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : null
}

async function fetchItems(): Promise<Item[] | null> {
  const h = await authHeader()
  if (!h) return null
  const res = await fetch('/api/sea-log', { headers: h }).catch(() => null)
  return res?.ok ? ((await res.json()) as { items: Item[] }).items : null
}

export default function SeaLog() {
  const navigate = useNavigate()
  const isAdmin = useIsAdmin()
  const [items, setItems] = useState<Item[]>([])
  const [beachId, setBeachId] = useState('campeche')
  const [when, setWhen] = useState(nowLocal)
  const [min, setMin] = useState('')
  const [max, setMax] = useState('')
  const [source, setSource] = useState<Source>('eu')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    fetchItems().then(list => { if (!cancelled && list) setItems(list) })
    return () => { cancelled = true }
  }, [isAdmin])

  const save = async () => {
    const lo = Number(min.replace(',', '.')), hi = Number((max || min).replace(',', '.'))
    if (!(lo >= 0) || !(hi >= lo) || hi > 10 || !min) { toast.error('Confira o tamanho (ex.: de 0,5 até 0,6).'); return }
    const h = await authHeader()
    if (!h) return
    setSaving(true)
    const res = await fetch('/api/sea-log', {
      method: 'POST',
      headers: { ...h, 'Content-Type': 'application/json' },
      body: JSON.stringify({ beachId, observedAt: new Date(when).toISOString(), min: lo, max: hi, source, note }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) { toast.error('Não deu pra salvar. Tente de novo.'); return }
    toast.success('Registro salvo.')
    setMin(''); setMax(''); setNote(''); setWhen(nowLocal())
    fetchItems().then(list => { if (list) setItems(list) })
  }

  if (isAdmin === null) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-sm text-primary">Carregando...</div>
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
        <Lock className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground mb-4">Essa ferramenta é de uso interno.</p>
        <Button variant="ghost" onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    )
  }

  const compared = items.filter(i => i.app_height != null)
  const avg = compared.length
    ? Math.round(compared.reduce((s, i) => s + ((i.app_height! - i.height_max) / i.height_max) * 100, 0) / compared.length)
    : null
  const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm'

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar"><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-base font-semibold">Registro do mar real</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-5 px-4 py-5">
        <p className="text-sm text-muted-foreground">
          Anote o tamanho que você viu (ou que o boletim.surf mostrou). A gente compara com o que o app
          dizia na mesma praia e hora pra acertar a altura das ondas. Só você vê esta tela.
        </p>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Waves className="h-4 w-4 text-primary" />Novo registro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">Praia</span>
              <select className={field} value={beachId} onChange={e => setBeachId(e.target.value)}>
                {BEACH_REGISTRY.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">Quando</span>
              <input type="datetime-local" className={field} value={when} onChange={e => setWhen(e.target.value)} />
            </label>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold">Tamanho que você viu (metros)</span>
              <div className="flex items-center gap-2">
                <input inputMode="decimal" placeholder="de (ex. 0,5)" className={field} value={min} onChange={e => setMin(e.target.value)} />
                <span className="text-sm text-muted-foreground">até</span>
                <input inputMode="decimal" placeholder="até (ex. 0,6)" className={field} value={max} onChange={e => setMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-semibold">De onde veio</span>
              <div className="flex gap-2">
                {SOURCES.map(s => (
                  <button key={s.id} onClick={() => setSource(s.id)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs transition-colors ${source === s.id ? 'border-primary bg-primary/10 font-bold text-primary' : 'border-border text-muted-foreground'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">Observação (opcional)</span>
              <input className={field} placeholder="ex.: séries de 1 m, mar mexido" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <Button className="w-full" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar registro'}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Real x o que o app mostrava</CardTitle>
            {avg != null && (
              <p className="text-xs text-muted-foreground">
                Em média o topo da faixa do app ficou {avg > 0 ? `${avg}% acima` : avg < 0 ? `${-avg}% abaixo` : 'igual'} do real
                ({compared.length} {compared.length === 1 ? 'registro' : 'registros'}).
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
            {items.map(i => {
              const diff = i.app_height != null ? Math.round(((i.app_height - i.height_max) / i.height_max) * 100) : null
              const when = new Date(i.observed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
              return (
                <div key={i.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{beachName(i.beach_id)}</span>
                    <span className="text-xs text-muted-foreground">{when} · {SOURCES.find(s => s.id === i.source)?.label}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    <div><div className="text-[11px] text-muted-foreground">Real</div>{m(i.height_min)}–{m(i.height_max)} m</div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">App mostrava</div>
                      {i.app_height != null ? `${m(i.app_height * 0.8)}–${m(i.app_height)} m` : 'sem leitura nessa hora'}
                    </div>
                  </div>
                  {diff != null && (
                    <div className={`mt-1.5 text-xs font-semibold ${diff > 20 ? 'text-destructive' : diff < -20 ? 'text-muted-foreground' : 'text-primary'}`}>
                      {diff > 20 ? `App ${diff}% acima do real` : diff < -20 ? `App ${-diff}% abaixo do real` : 'App dentro do real'}
                    </div>
                  )}
                  {i.note && <div className="mt-1 text-xs text-muted-foreground">{i.note}</div>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
