import { Sun, CloudSun, Cloud, CloudRain, CloudLightning } from 'lucide-react'
import type { WeatherCondition } from '../../api/_weatherCode'

// Ícone de cada condição do tempo (api/_weatherCode.ts) — usado na Home (agora) e na página do dia
export const WEATHER_ICONS: Record<WeatherCondition['icon'], typeof Sun> = {
  'sun': Sun, 'cloud-sun': CloudSun, 'cloud': Cloud, 'rain': CloudRain, 'storm': CloudLightning,
}
