// Cartão da sessão pro story (1080×1920, 09/out/2026): praia marcada no contorno da ilha, estrelas,
// o mar daquela hora e a marca Surf AI. Cada post é propaganda de graça — trazer gente nova é o
// maior gargalo do app. Cores lidas do tema escuro do app (index.css), nunca escritas à mão.
import type { SurfSession } from './sessions'
import { formatDuration, STAR_LABELS } from './sessions'
import { formatWaveRange } from './surfData'
import { getRatingInfo } from './rating'
import { directionName } from './directions'
import { ISLAND_PATH, ISLAND_VIEWBOX, projectLatLng } from '@/components/landing/islandShape'
import { BEACH_REGISTRY } from '../../api/_beachRegistry'

const W = 1080
const H = 1920
const PAD = 96

// Lê as variáveis do tema escuro mesmo com o app no claro: um elemento com a classe "dark"
function darkTheme() {
  const probe = document.createElement('div')
  probe.className = 'dark'
  probe.style.display = 'none'
  document.body.appendChild(probe)
  const css = getComputedStyle(probe)
  const v = (name: string) => css.getPropertyValue(`--${name}`).trim()
  const theme = {
    background: v('background'), card: v('card'), foreground: v('foreground'),
    muted: v('muted-foreground'), border: v('border'), primary: v('primary'),
    star: v('rating-fair'),
  }
  const ratingVar = (cssVar: string) => css.getPropertyValue(cssVar.replace(/^var\((.*)\)$/, '$1')).trim()
  probe.remove()
  return { ...theme, ratingVar }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    ctx.lineTo(cx + radius * Math.cos(a), cy + radius * Math.sin(a))
  }
  ctx.closePath()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export async function renderSessionCard(s: SurfSession): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const t = darkTheme()
  const font = getComputedStyle(document.body).fontFamily || 'sans-serif'
  try { await document.fonts.load(`700 88px ${font}`) } catch { /* segue com a fonte que tiver */ }

  ctx.fillStyle = t.background
  ctx.fillRect(0, 0, W, H)

  // Marca
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = t.primary
  ctx.font = `700 44px ${font}`
  ctx.fillText('SURF AI', PAD, 170)
  const brandW = ctx.measureText('SURF AI ').width
  ctx.fillStyle = t.muted
  ctx.font = `500 44px ${font}`
  ctx.fillText('Floripa', PAD + brandW, 170)

  // Ilha com a praia marcada, à direita
  const islandH = 980
  const k = islandH / ISLAND_VIEWBOX.height
  const ix = W - PAD - ISLAND_VIEWBOX.width * k + 40
  const iy = 250
  ctx.save()
  ctx.translate(ix, iy)
  ctx.scale(k, k)
  const path = new Path2D(ISLAND_PATH)
  ctx.fillStyle = t.card
  ctx.fill(path)
  ctx.lineWidth = 2.2 / k
  ctx.strokeStyle = t.primary
  ctx.globalAlpha = 0.85
  ctx.stroke(path)
  ctx.restore()
  const beach = BEACH_REGISTRY.find(b => b.id === s.beach_id)
  if (beach) {
    const p = projectLatLng(beach.lat, beach.lng)
    const bx = ix + p.x * k, by = iy + p.y * k
    ctx.save()
    ctx.shadowColor = t.primary
    ctx.shadowBlur = 50
    ctx.fillStyle = t.primary
    ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = t.foreground
    ctx.lineWidth = 6
    ctx.beginPath(); ctx.arc(bx, by, 20, 0, Math.PI * 2); ctx.stroke()
  }

  // Praia, data e hora, estrelas, tempo na água
  const colW = 560
  ctx.fillStyle = t.foreground
  ctx.font = `700 96px ${font}`
  const nameLines = wrapText(ctx, s.beach_name, colW)
  let y = 420
  for (const line of nameLines) { ctx.fillText(line, PAD, y); y += 108 }
  const when = new Date(`${s.date}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  ctx.fillStyle = t.muted
  ctx.font = `500 40px ${font}`
  ctx.fillText(when, PAD, y)
  y += 56
  if (s.start_hour != null) { ctx.fillText(`entrou às ${s.start_hour}h`, PAD, y); y += 56 }

  if (s.rating) {
    y += 50
    for (let i = 0; i < 5; i++) {
      star(ctx, PAD + 38 + i * 92, y, 38)
      ctx.fillStyle = i < s.rating ? t.star : t.border
      ctx.fill()
    }
    y += 90
    ctx.fillStyle = t.foreground
    ctx.font = `600 48px ${font}`
    ctx.fillText(STAR_LABELS[s.rating], PAD, y)
    y += 20
  }
  if (s.duration_minutes) {
    y += 70
    ctx.fillStyle = t.muted
    ctx.font = `500 40px ${font}`
    ctx.fillText(`${formatDuration(s.duration_minutes)} na água`, PAD, y)
  }

  // O mar naquela hora
  const items: [string, string][] = []
  if (s.wave_height != null) items.push(['Onda', formatWaveRange(s.wave_height)])
  if (s.wind_speed != null && s.wind_direction) items.push(['Vento', `${s.wind_direction} ${s.wind_speed} km/h`])
  if (s.swell_period != null) items.push(['Período', `${s.swell_period}s`])
  if (s.tide_trend) items.push(['Maré', s.tide_trend.replace(' (virando)', '')])
  if (items.length || s.app_score != null) {
    const boxY = 1250, boxH = 540
    roundRect(ctx, PAD, boxY, W - PAD * 2, boxH, 48)
    ctx.fillStyle = t.card
    ctx.fill()
    ctx.strokeStyle = t.border
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.fillStyle = t.muted
    ctx.font = `600 34px ${font}`
    ctx.fillText('O MAR NAQUELA HORA', PAD + 56, boxY + 84)
    const cellW = (W - PAD * 2 - 112) / 2
    items.slice(0, 4).forEach(([label, value], i) => {
      const cx = PAD + 56 + (i % 2) * cellW
      const cy = boxY + 170 + Math.floor(i / 2) * 120
      ctx.fillStyle = t.muted
      ctx.font = `500 32px ${font}`
      ctx.fillText(label, cx, cy)
      ctx.fillStyle = t.foreground
      ctx.font = `700 48px ${font}`
      ctx.fillText(value, cx, cy + 56)
    })
    if (s.app_score != null) {
      const info = getRatingInfo(s.app_score)
      const color = t.ratingVar(info.scoreColor) || t.primary
      const sy = boxY + boxH - 56
      ctx.strokeStyle = t.border
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(PAD + 56, sy - 74); ctx.lineTo(W - PAD - 56, sy - 74); ctx.stroke()
      ctx.fillStyle = t.muted
      ctx.font = `500 32px ${font}`
      ctx.fillText('Nota do app', PAD + 56, sy)
      ctx.textAlign = 'right'
      ctx.fillStyle = color
      ctx.font = `700 64px ${font}`
      ctx.fillText(s.app_score.toFixed(1), W - PAD - 56 - 200, sy + 6)
      ctx.font = `700 34px ${font}`
      ctx.fillText(info.label, W - PAD - 56, sy)
      ctx.textAlign = 'left'
    }
  }

  ctx.fillStyle = t.muted
  ctx.font = `500 36px ${font}`
  ctx.textAlign = 'center'
  ctx.fillText('surfaifloripa.com.br', W / 2, H - 90)
  ctx.textAlign = 'left'

  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'))
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed'

// Celular: abre o compartilhar do sistema (Instagram aparece lá). Computador: baixa a imagem.
export async function shareSessionCard(s: SurfSession): Promise<ShareResult> {
  const blob = await renderSessionCard(s)
  if (!blob) return 'failed'
  const file = new File([blob], `surf-ai-${s.beach_id}-${s.date}.png`, { type: 'image/png' })
  const text = `Sessão de surf: ${s.beach_name}${s.wind_direction ? `, vento ${s.wind_direction} ${directionName(s.wind_direction)}` : ''}. Previsão no surfaifloripa.com.br`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      return err instanceof DOMException && err.name === 'AbortError' ? 'cancelled' : 'failed'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
