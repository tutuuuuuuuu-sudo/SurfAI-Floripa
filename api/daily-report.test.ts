// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { reportTextToHtml } from './daily-report'

describe('reportTextToHtml (relatório por e-mail)', () => {
  it('troca *negrito* por <b>, mantém as quebras de linha e escapa o resto', () => {
    const html = reportTextToHtml('🏄 *Surf AI · Relatório Noite · 13/10*\n\nReceita < R$ 10 & conversão > 0%')
    expect(html).toContain('🏄 <b>Surf AI · Relatório Noite · 13/10</b><br><br>Receita &lt; R$ 10 &amp; conversão &gt; 0%')
  })
  it('asterisco sozinho fica como está', () => {
    expect(reportTextToHtml('nota 7* (estimada)')).toContain('nota 7* (estimada)')
  })
})
