import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { AppLogo } from '@/components/AppLogo'
import { ArrowLeft, Waves } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <div className="space-y-6 max-w-sm w-full">
        <div className="flex justify-center">
          <AppLogo size={64} variant="icon" />
        </div>

        <div className="space-y-2">
          <p className="text-7xl font-black text-primary/20 leading-none select-none">404</p>
          <h1 className="text-2xl font-black">Essa onda não existe</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            A página que você procura foi embora com a maré.
            Vamos voltar para as condições de surf?
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={() => navigate('/')} className="w-full font-bold">
            <Waves className="h-4 w-4 mr-2" />
            Ver condições agora
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="w-full text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    </div>
  )
}
