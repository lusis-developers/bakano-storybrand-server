export async function generateMktPrompt(metrics: any): Promise<string> {
  const ads: any[] = Array.isArray(metrics) ? metrics : []
  const toNumber = (v: any) => {
    const n = typeof v === 'string' ? parseFloat(v) : (typeof v === 'number' ? v : 0)
    return Number.isFinite(n) ? n : 0
  }
  const sum = (arr: any[], key: string) => arr.reduce((acc: number, it: any) => acc + toNumber(it?.metrics?.[key]), 0)
  const sumAction = (arr: any[]) => {
    let total = 0
    for (const it of arr) {
      const actions = it?.metrics?.actions
      if (Array.isArray(actions)) {
        for (const a of actions) {
          const t = String(a?.action_type || '')
          if (t.includes('messag') || t.includes('onsite_conversion')) {
            total += toNumber(a?.value)
          }
        }
      }
    }
    return total
  }
  const format = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const periodStart = (() => {
    const ds = ads.map(a => a?.metrics?.date_start).filter(Boolean)
    return ds.length ? ds.sort()[0] : ''
  })()
  const periodEnd = (() => {
    const de = ads.map(a => a?.metrics?.date_stop).filter(Boolean)
    return de.length ? de.sort()[de.length - 1] : ''
  })()
  const totalSpend = sum(ads, 'spend')
  const totalReach = sum(ads, 'reach')
  const totalClicks = sum(ads, 'clicks')
  const totalInlineLinkClicks = sum(ads, 'inline_link_clicks')
  const totalMessages = sumAction(ads)
  const avgCtr = (() => {
    const vals = ads.map(a => toNumber(a?.metrics?.ctr)).filter(v => Number.isFinite(v))
    if (!vals.length) return 0
    return vals.reduce((acc, v) => acc + v, 0) / vals.length
  })()
  const winners = [...ads]
    .map(a => ({ id: a?.id, name: a?.name, clicks: toNumber(a?.metrics?.clicks), ctr: toNumber(a?.metrics?.ctr) }))
    .sort((a, b) => (b.clicks - a.clicks) || (b.ctr - a.ctr))
    .slice(0, 3)
  const winnersText = winners.map(w => `${w.name} (clicks: ${format(w.clicks)}, ctr: ${format(w.ctr)})`).join(', ')
  const topInline = (() => {
    const sorted = [...ads].map(a => ({ name: a?.name, ilc: toNumber(a?.metrics?.inline_link_clicks) }))
      .sort((a, b) => b.ilc - a.ilc)
    const first = sorted[0]
    return first && first.ilc > 0 ? `${first.name} (${format(first.ilc)} link clicks)` : ''
  })()
  const costPerMessage = totalMessages > 0 ? totalSpend / totalMessages : 0
  const systemPrompt = `
Actúa como un Consultor Senior de Marketing Digital experto en traducir métricas complejas a lenguaje de negocios sencillo y amigable.

Tu tarea es analizar los datos brutos de las campañas de Facebook Ads que te proporcionaré al final de este prompt (en formato JSON) y generar un "Informe de Rendimiento Mensual" dirigido al dueño del negocio, quien NO es una persona técnica.

**Tono y Estilo:**
- Profesional pero cercano y empático.
- Cero tecnicismos sin explicación (si usas "CTR", explica que es "interés de la gente").
- Enfocado en resultados tangibles: mensajes recibidos, personas alcanzadas y eficiencia del gasto.

**Instrucciones específicas para el análisis:**
1. **Periodo:** Nota que los datos van del {{DATE_START}} al {{DATE_STOP}}.
2. **Objetivo:** El foco parece ser la venta de postres (Panettones, Tartas, Packs) y conseguir mensajes (WhatsApp/Messenger).
3. **Identifica a los Ganadores:** Busca qué productos trajeron más mensajes al menor costo. (Fíjate en "Peach Melba", "Chocolate y Frutos Rojos" y los "Panettones").
4. **Identifica oportunidades:** Menciona qué anuncios tuvieron buen alcance pero quizá necesitan ajustes.

**Estructura del Informe que debes generar:**

1.  **👋 Resumen Ejecutivo (La "Foto Grande"):**
    * Saludo amigable.
    * Inversión aproximada: {{TOTAL_SPEND}} USD.
    * Conversaciones generadas: {{TOTAL_MESSAGES}}.
    * Alcance total: {{TOTAL_REACH}} personas.
    * Interacciones: {{TOTAL_CLICKS}} clics y {{TOTAL_INLINE_CLICKS}} clics a enlaces.
    * Indicadores adicionales: CTR promedio {{AVG_CTR}}%.

2.  **🏆 Los Productos Estrella (Lo que mejor funcionó):**
    * Basado en los datos: {{TOP_WINNERS}}.
    * Explica por qué creemos que gustaron (basado en el CTR alto o bajo costo por mensaje).
    * Destaca campañas relevantes si los datos lo respaldan.
    * Top en clics a enlaces: {{TOP_INLINE}}.

3.  **💰 Eficiencia de la Inversión:**
    * Costo por mensaje estimado: {{COST_PER_MESSAGE}} USD.
    * Menciona si hubo algún anuncio que nos salió un poco más costoso y qué sugerirías.

4.  **🚀 Próximos Pasos Recomendados:**
    * Da 2 o 3 sugerencias sencillas para el próximo mes.

**DATOS BRUTOS (JSON):**
{{RAW_JSON}}
`
  const prompt = systemPrompt
    .replaceAll('{{DATE_START}}', periodStart || 'N/A')
    .replaceAll('{{DATE_STOP}}', periodEnd || 'N/A')
    .replaceAll('{{TOTAL_SPEND}}', format(totalSpend))
    .replaceAll('{{TOTAL_REACH}}', format(totalReach))
    .replaceAll('{{TOTAL_MESSAGES}}', format(totalMessages))
    .replaceAll('{{TOTAL_CLICKS}}', format(totalClicks))
    .replaceAll('{{TOTAL_INLINE_CLICKS}}', format(totalInlineLinkClicks))
    .replaceAll('{{AVG_CTR}}', format(avgCtr))
    .replaceAll('{{TOP_WINNERS}}', winnersText || 'Sin datos destacados')
    .replaceAll('{{TOP_INLINE}}', topInline || 'Sin datos destacados')
    .replaceAll('{{COST_PER_MESSAGE}}', totalMessages > 0 ? format(costPerMessage) : 'N/A')
    .replaceAll('{{RAW_JSON}}', JSON.stringify(ads))

  return prompt
}
