import { ContainerScroll } from './ContainerScroll'
import productScreenshot from '@/assets/landing/product-screenshot.png'

export default function ProductShowcaseSection() {
  return (
    <section className="relative py-4">
      <ContainerScroll
        titleComponent={
          <div className="space-y-4">
            <span className="inline-block text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/25 rounded-full px-4 py-1.5">
              Interface real do SurfAI Floripa
            </span>
            <h2 className="text-3xl md:text-4xl font-black">
              Não é ilustração. <span className="text-primary">É o app rodando agora.</span>
            </h2>
            <p className="text-foreground/70 max-w-lg mx-auto">
              Essa é a tela que qualquer pessoa vê hoje ao abrir um pico — com o score, a análise e os dados que a nossa IA calculou nesse instante.
            </p>
          </div>
        }
      >
        <img
          src={productScreenshot}
          alt="Tela do SurfAI Floripa mostrando o score de condições em tempo real do Campeche"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover object-top"
        />
      </ContainerScroll>
    </section>
  )
}
