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

  // Gráfico de barras horizontais (emoções/gatilhos).
  const rankBars = (title: string, items: { label: string; count: number }[]) => {
    if (!items || !items.length) return
    label(title)
    const max = Math.max(...items.map(i => i.count), 1)
    const nameW = 130, barMaxW = contentW - nameW - 24
    items.forEach(it => {
      ensure(15)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...INK)
      pdf.text((pdf.splitTextToSize(it.label, nameW) as string[])[0], M, y + 7)
      const w = Math.max(2, (it.count / max) * barMaxW)
      pdf.setFillColor(47, 93, 71); pdf.roundedRect(M + nameW, y + 1.5, w, 7, 2, 2, 'F')
      pdf.setFontSize(8); pdf.setTextColor(...MUTED); pdf.text(String(it.count), M + nameW + w + 4, y + 7)
      y += 15
    })
    y += 4
  }
  // Mini gráfico de linha por dia (energia/ansiedade), escala 1–5.
  const lineChart = (title: string, data: { day: number; value: number }[], rgb: [number, number, number]) => {
    if (!data || data.length < 2) return
    label(title)
    const h = 58, w = contentW
    ensure(h + 12)
    const y0 = y
    pdf.setDrawColor(228); pdf.setLineWidth(0.5)
    ;[1, 3, 5].forEach(v => { const yy = y0 + h - ((v - 1) / 4) * h; pdf.line(M, yy, M + w, yy) })
    const n = data.length
    const px = (i: number) => M + (n === 1 ? w / 2 : (i / (n - 1)) * w)
    const py = (v: number) => y0 + h - ((Math.min(5, Math.max(1, v)) - 1) / 4) * h
    pdf.setDrawColor(...rgb); pdf.setLineWidth(1.4)
    for (let i = 1; i < n; i++) pdf.line(px(i - 1), py(data[i - 1].value), px(i), py(data[i].value))
    pdf.setFillColor(...rgb); data.forEach((d, i) => pdf.circle(px(i), py(d.value), 1.3, 'F'))
    y += h + 12
  }
  const GREEN: [number, number, number] = [47, 158, 111]
  const ORANGE: [number, number, number] = [217, 139, 60]

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
    label('Dados principais'); body(`Emoção + frequente ${c.dominantEmotion ?? '—'}   ·   Energia ${c.avgEnergy || '—'}/5   ·   Ansiedade ${c.avgAnxiety || '—'}/5   ·   Check-ins ${c.checkinCount ?? 0}   ·   Diários ${c.diaryCount ?? 0}${c.topTrigger ? `   ·   Gatilho ${c.topTrigger}` : ''}`)
    heading('Gráficos de síntese')
    lineChart('Energia por dia', c.energyByDay, GREEN)
    lineChart('Ansiedade por dia', c.anxietyByDay, ORANGE)
    rankBars('Emoções mais frequentes', c.topEmotions.map(e => ({ label: e.label, count: e.count })))
    rankBars('Gatilhos mais citados', c.triggers.map(t => ({ label: t.tag, count: t.count })))
    heading('O que seus registros parecem indicar'); body(c.interpretation)
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
    heading('Gráficos de síntese')
    lineChart('Energia por dia', c.energyByDay, GREEN)
    lineChart('Ansiedade por dia', c.anxietyByDay, ORANGE)
    rankBars('Emoções mais frequentes', c.topEmotions.map(e => ({ label: e.label, count: e.count })))
    rankBars('Gatilhos mais citados', c.topTriggers.map(t => ({ label: t.tag, count: t.count })))
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
