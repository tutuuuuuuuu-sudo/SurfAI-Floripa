import { useState } from 'react'
import { MapPin, ChevronDown, Heart } from 'lucide-react'
import type { BeachCondition } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'

const REGIONS = ['Norte', 'Centro', 'Sul'] as const

// Escolher a praia sem rolagem lateral (09/out/2026 — a fileira de 14 botões rolando pro lado era
// "muito feia", e no computador aparecia até a barra de rolagem). Um botão com a praia escolhida e
// a nota de agora; tocando, abre a lista por região, de norte a sul, favoritas primeiro.
export function BeachPicker({ spots, selectedId, favorites, onSelect }: {
  spots: BeachCondition[]
  selectedId: string
  favorites: string[]
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = spots.find(s => s.id === selectedId)
  const byLat = [...spots].sort((a, b) => (b.lat ?? 0) - (a.lat ?? 0))
  const groups = [
    ...(favorites.length ? [{ label: 'Favoritas', list: byLat.filter(s => favorites.includes(s.id)) }] : []),
    ...REGIONS.map(region => ({ label: region, list: byLat.filter(s => s.region === region) })),
  ].filter(g => g.list.length)

  const pick = (id: string) => { onSelect(id); setOpen(false) }
  const rating = selected ? getRatingInfo(selected.score) : null

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-4 text-left" aria-expanded={open}>
        <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">Previsão de</div>
          <div className="text-lg font-bold leading-tight truncate">{selected?.name ?? 'Escolha a praia'}</div>
        </div>
        {selected && rating && (
          <div className="text-right flex-shrink-0">
            <div className={`text-xl font-bold leading-none ${rating.color}`}>{selected.score.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">agora</div>
          </div>
        )}
        <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border/40 p-3 space-y-3" style={{ animation: 'slideUp 0.2s ease-out' }}>
          {groups.map(g => (
            <div key={g.label}>
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground/80 mb-1.5 flex items-center gap-1">
                {g.label === 'Favoritas' && <Heart className="h-3 w-3" />}{g.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.list.map(s => {
                  const r = getRatingInfo(s.score)
                  const active = s.id === selectedId
                  return (
                    <button
                      key={s.id}
                      onClick={() => pick(s.id)}
                      className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 text-foreground/80 hover:border-primary/40'
                      }`}
                    >
                      {s.name}
                      <span className={`${r.color} tabular-nums`}>{s.score.toFixed(1)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
