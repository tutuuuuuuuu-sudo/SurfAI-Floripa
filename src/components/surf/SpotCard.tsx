import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BeachCondition } from '@/lib/surfData'
import { getRatingInfo } from '@/lib/rating'
import { getTainhaInfo } from '@/lib/tainha'
import { LatestComment, formatCommentTime } from '@/lib/comments'
import { Waves, Wind, Clock, Thermometer, ThumbsUp, Fish, MessageCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface SpotCardProps {
  spot: BeachCondition
  latestComment?: LatestComment
}

function getUserLevel(): string | null {
  try { return JSON.parse(localStorage.getItem('pref_skill') ?? 'null') } catch { return null }
}

function getPersonalizedBadge(spot: BeachCondition, level: string | null): string | null {
  if (!level) return null
  const { waveHeight: w, windSpeed: wind, swellPeriod: period } = spot
  if (level === 'Iniciante'     && w <= 0.9 && wind <= 15)              return 'Ideal para você'
  if (level === 'Intermediário' && w >= 0.5 && w <= 1.8 && wind <= 22) return 'Bom para você'
  if (level === 'Avançado'      && w >= 1.0 && period >= 9)             return 'Ótimo para você'
  return null
}

export function SpotCard({ spot, latestComment }: SpotCardProps) {
  const navigate = useNavigate()
  const rating = getRatingInfo(spot.score)
  const personalBadge = getPersonalizedBadge(spot, getUserLevel())
  const tainha = getTainhaInfo(spot.id)

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Iniciante': return 'bg-chart-2/20 text-chart-2 border-chart-2/30'
      case 'Intermediário': return 'bg-accent/20 text-accent border-accent/30'
      case 'Avançado': return 'bg-primary/20 text-primary border-primary/30'
      default: return 'bg-muted'
    }
  }

  return (
    <Card
      className="hover:shadow-lg transition-all cursor-pointer border-border/50 hover:border-primary/30"
      onClick={() => navigate(`/spot/${spot.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">{spot.name}</CardTitle>
            <Badge variant="outline" className="text-xs">{spot.region}</Badge>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${rating.color}`}>
              {Number(spot.score).toFixed(1)}
            </div>
            <div className={`text-xs font-bold ${rating.color}`}>{rating.label}</div>
            <div className="flex gap-0.5 mt-1 justify-end">
              {[1,2,3,4,5].map(i => (
                <div
                  key={i}
                  className={`h-1.5 w-4 rounded-full ${i <= rating.bars ? rating.bg : 'bg-muted'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5">
            <Waves className="h-4 w-4 text-primary flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">{Number(spot.waveHeight).toFixed(1)}m</div>
              <div className="text-xs text-muted-foreground">Ondas</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Wind className="h-4 w-4 text-accent flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">{Math.round(spot.windSpeed)}km/h</div>
              <div className="text-xs text-muted-foreground">{spot.windDirection}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold">{Math.round(spot.swellPeriod)}s</div>
              <div className="text-xs text-muted-foreground">Período</div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-2">
          <Thermometer className="h-4 w-4 text-chart-2" />
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold">{spot.waterConditions.temperature}°C</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{spot.waterConditions.wetsuit.thickness}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={getLevelColor(spot.level)} variant="outline">
            {spot.level}
          </Badge>
          {personalBadge && (
            <Badge className="bg-green-500/15 text-green-500 border-green-500/30" variant="outline">
              <ThumbsUp className="h-3 w-3 mr-1" />
              {personalBadge}
            </Badge>
          )}
          {tainha.status === 'liberada' && (
            <Badge className="bg-green-500/15 text-green-500 border-green-500/30" variant="outline">
              <Fish className="h-3 w-3 mr-1" />Liberada
            </Badge>
          )}
          {tainha.status === 'parcial' && (
            <Badge className="bg-yellow-500/15 text-yellow-500 border-yellow-500/30" variant="outline">
              <Fish className="h-3 w-3 mr-1" />Área parcial
            </Badge>
          )}
          {tainha.status === 'fechada' && (
            <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline">
              <Fish className="h-3 w-3 mr-1" />Fechada — tainha
            </Badge>
          )}
        </div>

        {latestComment && (
          <div className="flex items-start gap-2 pt-1 border-t border-border/40">
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
              <span className="font-medium text-foreground/70">{latestComment.user_name}:</span>{' '}
              &ldquo;{latestComment.content}&rdquo;{' '}
              <span className="text-muted-foreground/60">· {formatCommentTime(latestComment.created_at)}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
