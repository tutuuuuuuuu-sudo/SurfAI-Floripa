import { Button } from '@/components/ui/button'
import { MapPin } from 'lucide-react'

interface RegionFilterProps {
  activeRegion: string
  onRegionChange: (region: string) => void
}

const regions = [
  { id: 'all', name: 'Todas' },
  { id: 'Sul', name: 'Sul' },
  { id: 'Leste', name: 'Leste' },
  { id: 'Norte', name: 'Norte' },
  { id: 'Centro', name: 'Centro' }
]

export function RegionFilter({ activeRegion, onRegionChange }: RegionFilterProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
      {regions.map((region) => (
        <Button
          key={region.id}
          variant={activeRegion === region.id ? 'default' : 'outline'}
          size="sm"
          onClick={() => onRegionChange(region.id)}
          className="whitespace-nowrap"
        >
          {region.name}
        </Button>
      ))}
    </div>
  )
}
