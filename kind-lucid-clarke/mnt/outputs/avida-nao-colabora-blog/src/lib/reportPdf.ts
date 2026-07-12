// ─────────────────────────────────────────────────────────────────────────────
// PDF NATIVO do relatório (jsPDF por texto — não "fotografa" a tela).
// Paginação por bloco: nunca corta uma linha no meio da quebra de página.
// Inclui a logo do blog no cabeçalho.
// ─────────────────────────────────────────────────────────────────────────────
import { formatPeriodShort, formatDateBR, ymd } from './reportPeriods'
import { recommendGuidedContent } from './questionnaireResult'
import type { StoredReport, WeeklyContent, MonthlyContent } from './reportGeneration'

const DISCLAIMER = 'Este relatório é uma ferramenta de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

// Logo (coração + folha) com a cor da marca, para rasterizar em PNG.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
<path d="M16 25.5C16 25.5 6 19 6 12.4C6 9.1 8.5 6.6 11.6 6.6C13.6 6.6 15.2 7.7 16 9.2C16.8 7.7 18.4 6.6 20.4 6.6C23.5 6.6 26 9.1 26 12.4C26 19 16 25.5 16 25.5Z" stroke="#1c4a37" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M16 21C16 17.7 17.6 15.2 20.4 14.3" stroke="#1c4a37" stroke-width="1.7" stroke-linecap="round"/>
<path d="M21 14C19.3 14.6 18 16 17.5 17.8C19.3 17.2 20.6 15.8 21 14Z" fill="#1c4a37"/></svg>`

function svgToPng(svg: string, px = 96): Promise<string> {
  return new Promise(resolve => {
    try {
      const img = new Image()
      const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = px; c.height = px
        const ctx = c.getContext('2d')
        if (!ctx) return resolve('')
        ctx.drawImage(img, 0, 0, px, px)
        resolve(c.toDataURL('image/png'))
      }
      img.onerror = () => resolve('')
      img.src = url
    } catch { resolve('') }
  })
}

export async function exportReportPdf(report: StoredReport, plan: string, filename: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const M = 48
  const contentW = pageW - M * 2
  let y = M

  const FOREST: [number, number, number] = [28, 74, 55]
  const LABEL: [number, number, number] = [47, 93, 71]
  const INK: [number, number, number] = [60, 60, 60]
  const MUTED: [number, number, number] = [140, 140, 140]

  const ensure = (space: number) => { if (y + space > pageH - M) { pdf.addPage(); y = M } }
  const heading = (text: string) => {
    ensure(34)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(...FOREST)
    pdf.text(text, M, y); y += 7
    pdf.setDrawColor(220); pdf.setLineWidth(0.6); pdf.line(M, y, M + contentW, y); y += 15
  }
  const label = (text: string) => {
    ensure(20)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...LABEL)
    pdf.text(text.toUpperCase(), M, y); y += 13
  }
  const body = (text: string, gap = 6) => {
    if (!text) return
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5); pdf.setTextColor(...INK)
    for (const ln of pdf.splitTextToSize(text, contentW) as string[]) { ensure(15); pdf.text(ln, M, y); y += 15 }
    y += gap
  }
  const bullet = (text: string, mark = '•') => {
    pdf.setFontSize(10.5)
    const lines = pdf.splitTextToSize(text, contentW - 16) as string[]
    lines.forEach((ln, i) => {
      ensure(15)
      if (i === 0) { pdf.setFont('helvetica', 'bold'); pdf.setTextColor(150, 175, 155); pdf.text(mark, M, y) }
      pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...INK); pdf.text(ln, M + 16, y); y += 15
    })
  }
  const space = (n = 6) => { y += n }

  // ── Cabeçalho: logo + marca ──
  const logo = await svgToPng(LOGO_SVG)
  if (logo) pdf.addImage(logo, 'PNG', M, y, 22, 22)
  pdf.setFont('times', 'normal'); pdf.setFontSize(15); pdf.setTextColor(...FOREST)
  pdf.text('A Vida Não Colabora', M + (logo ? 30 : 0), y + 16)
  y += 38

  // ── Título + período ──
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(...FOREST)
  for (const ln of pdf.splitTextToSize(report.title, contentW) as string[]) { pdf.text(ln, M, y); y += 19 }
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...MUTED)
  const gen = report.generated_at ? formatDateBR(ymd(new Date(report.generated_at))) : formatDateBR(report.available_at)
  pdf.text(`Período ${formatPeriodShort({ start: report.period_start, end: report.period_end })}  ·  Gerado em ${gen}`, M, y)
  y += 10
  pdf.setDrawColor(220); pdf.setLineWidth(0.6); pdf.line(M, y, M + contentW, y); y += 18

  // Conteúdos recomendados (busca respeitando o plano)
  const tags = (report.content as { recommendTags?: string[] }).recommendTags ?? []
  let recTitles: string[] = []
  if (tags.length > 0) {
    try { recTitles = (await recommendGuidedContent(plan, tags, 3)).map(r => r.title) } catch { recTitles = [] }
  }

  if (report.content.kind === 'weekly') {
    const c = report.content as WeeklyContent
    heading('Resumo da semana'); body(c.summary)
    label('Médias'); body(`Humor ${c.avgMood || '—'}/5   ·   Energia ${c.avgEnergy || '—'}/5   ·   Ansiedade ${c.avgAnxiety || '—'}/5`)
    if (c.topEmotions.length) { label('Emoções mais frequentes'); body(c.topEmotions.map(e => `${e.label} (${e.count})`).join('   ·   ')) }
    if (c.triggers.length) { label('Gatilhos mais citados'); body(c.triggers.map(t => `${t.tag} (${t.count})`).join('   ·   ')) }
    if (c.comparison.length) { label('Comparação com a semana anterior'); c.comparison.forEach(l => bullet(l, '→')); space() }
    if (recTitles.length) { label('Conteúdos guiados recomendados'); recTitles.forEach(t => bullet(t)); space() }
    label('Próximos passos'); c.nextSteps.forEach(s => bullet(s, '→'))
  } else {
    const c = report.content as MonthlyContent
    heading('Resumo geral do mês'); body(c.summary)
    label('Médias'); body(`Energia ${c.avgEnergy || '—'}/5   ·   Ansiedade ${c.avgAnxiety || '—'}/5${c.avgSleep ? `   ·   Sono ${c.avgSleep}/5` : ''}`)
    label('Principais padrões emocionais'); c.patterns.forEach(p => bullet(p)); space()
    label('Emoções predominantes')
    if (c.topEmotions.length) body(c.topEmotions.map(e => `${e.label} (${e.count})`).join('   ·   '), 3)
    body(c.predominantEmotions)
    label('Energia, ansiedade e descanso'); body(c.energyAnxietySleep)
    label('Gatilhos mais recorrentes'); body(c.triggersText)
    label('Dias de maior atenção')
    if (c.attentionDays.length) c.attentionDays.forEach(d => bullet(`Dia ${d.day} — ${d.reason}`)); else body('Sem dias suficientes para destacar.')
    space()
    label('Momentos de melhora'); body(c.improvementMoments)
    label('Comparação com o mês anterior'); c.monthlyComparison.forEach(l => bullet(l, '→')); space()
    if (recTitles.length) { label('Conteúdos guiados recomendados'); recTitles.forEach(t => bullet(t)); space() }
    heading('Plano de autocuidado sugerido')
    label('Prioridade do mês'); body(c.selfCarePlan.priority, 3)
    label('Cuidado principal'); body(c.selfCarePlan.mainCare, 3)
    label('Prática recomendada'); body(c.selfCarePlan.practice, 3)
    label('Ponto de atenção'); body(c.selfCarePlan.attention, 3)
    label('Pequeno compromisso'); body(c.selfCarePlan.commitment)
    label('Perguntas para reflexão'); c.reflectionQuestions.forEach(q => bullet(q, '?')); space()
    label('Síntese para orientação'); body(c.guidanceSynthesis)
  }

  // ── Rodapé: aviso ──
  space(6)
  ensure(40)
  pdf.setDrawColor(230); pdf.setLineWidth(0.5); pdf.line(M, y, M + contentW, y); y += 12
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...MUTED)
  for (const ln of pdf.splitTextToSize(DISCLAIMER, contentW) as string[]) { ensure(11); pdf.text(ln, M, y); y += 11 }

  pdf.save(filename)
}
