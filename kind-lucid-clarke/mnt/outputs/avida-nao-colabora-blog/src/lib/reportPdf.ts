// ─────────────────────────────────────────────────────────────────────────────
// PDF NATIVO do relatório (jsPDF por texto) — hierarquia visual, cards, tabela,
// mini-gráficos, rodapé paginado e logo. Sem "fotografar" a tela.
//
// Regras: nada de emoji/setas Unicode (jsPDF não renderiza) — bullets são
// DESENHADOS. Linguagem de autopercepção. PDF só com o conteúdo do relatório.
// ─────────────────────────────────────────────────────────────────────────────
import { formatPeriodShort, formatDateBR, monthTitle, ymd } from './reportPeriods'
import { recommendGuidedContent } from './questionnaireResult'
import type { StoredReport, WeeklyContent, MonthlyContent } from './reportGeneration'

const DISCLAIMER = 'Este relatório é uma ferramenta de autoconhecimento e não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.'

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
<path d="M16 25.5C16 25.5 6 19 6 12.4C6 9.1 8.5 6.6 11.6 6.6C13.6 6.6 15.2 7.7 16 9.2C16.8 7.7 18.4 6.6 20.4 6.6C23.5 6.6 26 9.1 26 12.4C26 19 16 25.5 16 25.5Z" stroke="#1c4a37" stroke-width="1.9" stroke-linejoin="round"/>
<path d="M16 21C16 17.7 17.6 15.2 20.4 14.3" stroke="#1c4a37" stroke-width="1.7" stroke-linecap="round"/>
<path d="M21 14C19.3 14.6 18 16 17.5 17.8C19.3 17.2 20.6 15.8 21 14Z" fill="#1c4a37"/></svg>`

function svgToPng(svg: string, px = 96): Promise<string> {
  return new Promise(resolve => {
    try {
      const img = new Image()
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = px; c.height = px
        const ctx = c.getContext('2d'); if (!ctx) return resolve('')
        ctx.drawImage(img, 0, 0, px, px); resolve(c.toDataURL('image/png'))
      }
      img.onerror = () => resolve('')
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
    } catch { resolve('') }
  })
}

// Remove qualquer caractere fora do Latin-1 (emoji/ícones) que o jsPDF não renderiza.
function clean(s: string): string {
  return String(s ?? '')
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[←-⇿•●]/g, '-')
    .replace(/[^ -ÿ]/g, '')
    .replace(/\s+/g, ' ').trim()
}

type RGB = [number, number, number]

export async function exportReportPdf(report: StoredReport, plan: string, filename: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const M = 46
  const contentW = pageW - M * 2
  const FOOTER = 44
  let y = M

  const FOREST: RGB = [28, 74, 55]
  const GREEN: RGB = [47, 158, 111]
  const ORANGE: RGB = [217, 139, 60]
  const LABEL: RGB = [90, 120, 100]
  const INK: RGB = [58, 58, 58]
  const MUTED: RGB = [150, 150, 150]
  const LINE: RGB = [223, 220, 212]
  const CARD: RGB = [246, 249, 246]
  const MINT: RGB = [233, 242, 235]

  const ensure = (h: number) => { if (y + h > pageH - FOOTER) { pdf.addPage(); y = M } }

  const heading = (text: string, gapBefore = 14) => {
    ensure(30 + gapBefore); y += gapBefore
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12.5); pdf.setTextColor(...FOREST)
    pdf.text(clean(text), M, y); y += 6
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.6); pdf.line(M, y, M + contentW, y); y += 13
  }
  const subLabel = (text: string) => {
    ensure(16); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.setTextColor(...LABEL)
    pdf.text(clean(text).toUpperCase(), M, y); y += 12
  }
  const para = (text: string, gap = 8, size = 10) => {
    const t = clean(text); if (!t) return
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(size); pdf.setTextColor(...INK)
    for (const ln of pdf.splitTextToSize(t, contentW) as string[]) { ensure(14); pdf.text(ln, M, y); y += 14 }
    y += gap
  }
  const bullets = (items: string[]) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10)
    for (const it of items) {
      const lines = pdf.splitTextToSize(clean(it), contentW - 16) as string[]
      lines.forEach((ln, k) => {
        ensure(14)
        if (k === 0) { pdf.setFillColor(...GREEN); pdf.circle(M + 3, y - 3, 1.4, 'F') }
        pdf.setTextColor(...INK); pdf.text(ln, M + 14, y); y += 14
      })
    }
    y += 6
  }
  const noteBox = (title: string, text: string, tone: 'mint' | 'amber' = 'mint') => {
    const t = clean(text); const lines = pdf.splitTextToSize(t, contentW - 24) as string[]
    const h = 16 + (title ? 12 : 0) + lines.length * 12 + 8
    ensure(h)
    if (tone === 'amber') { pdf.setFillColor(255, 248, 235); pdf.setDrawColor(240, 210, 150) }
    else { pdf.setFillColor(...MINT); pdf.setDrawColor(...LINE) }
    pdf.setLineWidth(0.6); pdf.roundedRect(M, y, contentW, h, 6, 6, 'FD')
    let iy = y + 15
    if (title) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...LABEL); pdf.text(clean(title).toUpperCase(), M + 12, iy); iy += 12 }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(...(tone === 'amber' ? [140, 90, 20] as RGB : FOREST))
    lines.forEach(ln => { pdf.text(ln, M + 12, iy); iy += 12 })
    y += h + 10
  }

  // Cards de métricas (3 por linha).
  const cards = (items: { label: string; value: string; sub?: string }[]) => {
    const perRow = 3, gap = 10, ch = 52
    const cw = (contentW - gap * (perRow - 1)) / perRow
    for (let i = 0; i < items.length; i += perRow) {
      const row = items.slice(i, i + perRow)
      ensure(ch + 10)
      row.forEach((it, j) => {
        const x = M + j * (cw + gap)
        pdf.setDrawColor(...LINE); pdf.setFillColor(...CARD); pdf.setLineWidth(0.6); pdf.roundedRect(x, y, cw, ch, 6, 6, 'FD')
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(...LABEL)
        pdf.text((pdf.splitTextToSize(clean(it.label).toUpperCase(), cw - 16) as string[])[0], x + 9, y + 14)
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.setTextColor(...FOREST)
        pdf.text((pdf.splitTextToSize(clean(it.value), cw - 16) as string[])[0], x + 9, y + 32)
        if (it.sub) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.8); pdf.setTextColor(...MUTED); pdf.text((pdf.splitTextToSize(clean(it.sub), cw - 16) as string[])[0], x + 9, y + 44) }
      })
      y += ch + 10
    }
  }

  // Tabela Item | Sugestão (plano de autocuidado).
  const kvTable = (rows: [string, string][]) => {
    const c1 = 148, c2 = contentW - c1
    rows.forEach((r, i) => {
      const lines = pdf.splitTextToSize(clean(r[1]), c2 - 20) as string[]
      const h = Math.max(22, lines.length * 12 + 10)
      ensure(h)
      pdf.setFillColor(...(i % 2 === 0 ? CARD : [255, 255, 255] as RGB)); pdf.rect(M, y, contentW, h, 'F')
      pdf.setDrawColor(...LINE); pdf.setLineWidth(0.5); pdf.rect(M, y, contentW, h); pdf.line(M + c1, y, M + c1, y + h)
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...FOREST)
      ;(pdf.splitTextToSize(clean(r[0]), c1 - 20) as string[]).forEach((ln, k) => pdf.text(ln, M + 10, y + 15 + k * 11))
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(...INK)
      lines.forEach((ln, k) => pdf.text(ln, M + c1 + 10, y + 15 + k * 12))
      y += h
    })
    y += 10
  }

  // Mini-gráficos.
  const chartLine = (title: string, data: { day: number; value: number }[], rgb: RGB) => {
    subLabel(title)
    if (!data || data.length < 2) { noteBox('', 'Gráfico indisponível por falta de registros suficientes.'); return }
    const h = 56, w = contentW; ensure(h + 12); const y0 = y
    pdf.setDrawColor(230); pdf.setLineWidth(0.5)
    ;[1, 3, 5].forEach(v => { const yy = y0 + h - ((v - 1) / 4) * h; pdf.line(M, yy, M + w, yy) })
    const n = data.length
    const px = (i: number) => M + (n === 1 ? w / 2 : (i / (n - 1)) * w)
    const py = (v: number) => y0 + h - ((Math.min(5, Math.max(1, v)) - 1) / 4) * h
    pdf.setDrawColor(...rgb); pdf.setLineWidth(1.4)
    for (let i = 1; i < n; i++) pdf.line(px(i - 1), py(data[i - 1].value), px(i), py(data[i].value))
    pdf.setFillColor(...rgb); data.forEach((d, i) => pdf.circle(px(i), py(d.value), 1.3, 'F'))
    y += h + 12
  }
  const chartBars = (title: string, items: { label: string; count: number }[]) => {
    subLabel(title)
    if (!items || !items.length) { noteBox('', 'Gráfico indisponível por falta de registros suficientes.'); return }
    const max = Math.max(...items.map(i => i.count), 1); const nameW = 130, barMax = contentW - nameW - 26
    items.forEach(it => {
      ensure(15)
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...INK)
      pdf.text((pdf.splitTextToSize(clean(it.label), nameW) as string[])[0], M, y + 7)
      const bw = Math.max(2, (it.count / max) * barMax)
      pdf.setFillColor(...FOREST); pdf.roundedRect(M + nameW, y + 1.5, bw, 7, 2, 2, 'F')
      pdf.setFontSize(8); pdf.setTextColor(...MUTED); pdf.text(String(it.count), M + nameW + bw + 4, y + 7)
      y += 15
    })
    y += 6
  }

  // ── Cabeçalho premium ──
  const logo = await svgToPng(LOGO_SVG)
  if (logo) pdf.addImage(logo, 'PNG', M, y, 20, 20)
  pdf.setFont('times', 'normal'); pdf.setFontSize(13); pdf.setTextColor(...FOREST)
  pdf.text('A Vida Não Colabora', M + (logo ? 27 : 0), y + 14)
  y += 32

  const isMonthly = report.content.kind === 'monthly'
  const planLabel = plan === 'plus' ? 'Plus' : plan === 'essential' ? 'Essencial' : 'Gratuito'
  const typeTitle = isMonthly ? 'Relatório Mensal Aprofundado' : 'Relatório Semanal'
  const periodTitle = isMonthly ? monthTitle(report.period_start) : formatPeriodShort({ start: report.period_start, end: report.period_end })
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18); pdf.setTextColor(...FOREST)
  pdf.text(clean(typeTitle), M, y); y += 22
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); pdf.setTextColor(...INK)
  pdf.text(clean(periodTitle.charAt(0).toUpperCase() + periodTitle.slice(1)), M, y); y += 16
  const gen = report.generated_at ? formatDateBR(ymd(new Date(report.generated_at))) : formatDateBR(report.available_at)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...MUTED)
  pdf.text(`Período analisado: ${formatPeriodShort({ start: report.period_start, end: report.period_end })}   ·   Gerado em: ${gen}   ·   Plano: ${planLabel}`, M, y); y += 14
  pdf.setFont('times', 'italic'); pdf.setFontSize(10); pdf.setTextColor(...LABEL)
  pdf.text(isMonthly ? 'Uma leitura acolhedora dos seus registros emocionais do mês.' : 'Uma síntese dos seus registros emocionais da semana.', M, y); y += 8
  pdf.setDrawColor(...FOREST); pdf.setLineWidth(1.1); pdf.line(M, y, M + contentW, y); y += 4

  // Recomendações (títulos, respeitando plano)
  const tags = (report.content as { recommendTags?: string[] }).recommendTags ?? []
  let recTitles: string[] = []
  if (tags.length) { try { recTitles = (await recommendGuidedContent(plan, tags, 3)).map(r => clean(r.title)) } catch { /* noop */ } }

  const status = (v: number) => (v > 0 ? '' : 'Dados insuficientes')

  if (report.content.kind === 'weekly') {
    const c = report.content as WeeklyContent
    const total = (c.checkinCount ?? 0) + (c.diaryCount ?? 0)
    const atencao = c.avgAnxiety >= 4 ? 'Ansiedade percebida elevada' : (c.topTrigger ? `Gatilho recorrente: ${c.topTrigger}` : 'Sem ponto de atenção destacado')

    heading('Leitura rápida da semana', 10)
    cards([
      { label: 'Registros analisados', value: String(total), sub: 'Check-ins e diários' },
      { label: 'Check-ins', value: String(c.checkinCount ?? 0) },
      { label: 'Diários', value: String(c.diaryCount ?? 0) },
      { label: 'Energia média', value: c.avgEnergy ? `${c.avgEnergy}/5` : '—/5', sub: status(c.avgEnergy) },
      { label: 'Ansiedade percebida', value: c.avgAnxiety ? `${c.avgAnxiety}/5` : '—/5', sub: status(c.avgAnxiety) },
      { label: 'Emoção predominante', value: c.dominantEmotion ?? '—' },
    ])
    if (c.topTrigger) noteBox('Principal gatilho', c.topTrigger)
    noteBox('Ponto de atenção', atencao)
    if (!c.hasEnoughData) noteBox('Sobre a precisão deste relatório', 'Este relatório foi gerado com poucos registros no período. Por isso, algumas análises aparecem como iniciais ou indisponíveis. Para relatórios mais completos, registre check-ins e diários ao longo da semana.', 'amber')

    heading('Resumo da semana'); para(c.summary)
    heading('Emoções frequentes'); chartBars('Emoções mais frequentes', c.topEmotions.map(e => ({ label: e.label, count: e.count })))
    heading('Energia e ansiedade'); chartLine('Energia por dia', c.energyByDay, GREEN); chartLine('Ansiedade por dia', c.anxietyByDay, ORANGE)
    heading('Gatilhos'); chartBars('Gatilhos mais citados', c.triggers.map(t => ({ label: t.tag, count: t.count })))
    heading('O que mudou em relação à semana anterior'); if (c.comparison.length) bullets(c.comparison); else para('Ainda não há uma semana anterior suficiente para comparação.')
    heading('O que seus registros parecem indicar'); para(c.interpretation)
    if (c.patterns?.length) { heading('Principais padrões da semana'); bullets(c.patterns) }
    if (c.attentionPoints?.length) { heading('Pontos de atenção da semana'); bullets(c.attentionPoints) }
    if (c.improvementMoments) { heading('Momentos de melhora'); para(c.improvementMoments) }
    if (recTitles.length) { heading('Conteúdos guiados recomendados'); bullets(recTitles) }
    heading('Próximos passos'); bullets(c.nextSteps)
  } else {
    const c = report.content as MonthlyContent
    const total = (c.checkinCount ?? 0) + (c.diaryCount ?? 0)
    const atencao = c.attentionDays?.[0] ? `Dia ${c.attentionDays[0].day} — ${c.attentionDays[0].reason}` : 'Sem dias de maior atenção destacados'

    heading('Leitura rápida do mês', 10)
    cards([
      { label: 'Registros analisados', value: String(total), sub: 'Check-ins e diários' },
      { label: 'Check-ins', value: String(c.checkinCount ?? 0) },
      { label: 'Diários', value: String(c.diaryCount ?? 0) },
      { label: 'Energia média', value: c.avgEnergy ? `${c.avgEnergy}/5` : '—/5', sub: status(c.avgEnergy) },
      { label: 'Ansiedade percebida', value: c.avgAnxiety ? `${c.avgAnxiety}/5` : '—/5', sub: status(c.avgAnxiety) },
      { label: 'Emoção predominante', value: c.topEmotions?.[0]?.label ?? '—' },
    ])
    noteBox('Ponto de atenção', atencao)
    noteBox('Prioridade sugerida do mês', c.selfCarePlan.priority)
    if (!c.hasEnoughData) noteBox('Sobre a precisão deste relatório', 'Este relatório foi gerado com poucos registros no período. Por isso, algumas análises aparecem como iniciais ou indisponíveis. Para relatórios mais completos, registre check-ins, diários e questionários ao longo do mês.', 'amber')

    heading('Resumo geral do mês'); para(c.summary)
    if (c.narrative?.length) { heading('Como o mês se desenhou'); bullets(c.narrative.map(n => `${n.phase}: ${n.text}`)) }
    heading('Principais padrões emocionais'); if (c.patterns.length) bullets(c.patterns); else para('Ainda não há dados suficientes para esta leitura.')
    heading('Emoções predominantes'); chartBars('Emoções mais frequentes', c.topEmotions.map(e => ({ label: e.label, count: e.count }))); para(c.predominantEmotions)
    heading('Energia, ansiedade e descanso'); para(c.energyAnxietySleep)
    if (c.relations?.length) { heading('Relações percebidas'); bullets(c.relations) }
    heading('Gráficos de síntese'); chartLine('Energia por dia', c.energyByDay, GREEN); chartLine('Ansiedade por dia', c.anxietyByDay, ORANGE)
    heading('Gatilhos mais recorrentes'); para(c.triggersText); chartBars('Gatilhos mais citados', c.topTriggers.map(t => ({ label: t.tag, count: t.count })))
    heading('Dias de maior atenção'); if (c.attentionDays.length) bullets(c.attentionDays.map(d => `Dia ${d.day} — ${d.reason}`)); else para('Ainda não há dados suficientes para esta leitura.')
    heading('Momentos de melhora'); para(c.improvementMoments)
    heading('Comparação com o mês anterior'); bullets(c.monthlyComparison)
    if (recTitles.length) { heading('Conteúdos guiados recomendados'); bullets(recTitles) }
    heading('Plano de autocuidado sugerido')
    kvTable([
      ['Prioridade do mês', c.selfCarePlan.priority],
      ['Cuidado principal', c.selfCarePlan.mainCare],
      ['Prática recomendada', c.selfCarePlan.practice],
      ['Ponto de atenção', c.selfCarePlan.attention],
      ['Pequeno compromisso', c.selfCarePlan.commitment],
    ])
    heading('Perguntas para reflexão'); bullets(c.reflectionQuestions)
    heading('Síntese para orientação'); noteBox('', c.guidanceSynthesis)
  }

  heading('Aviso importante'); para(DISCLAIMER, 4, 9)

  // ── Rodapé paginado em todas as páginas ──
  const total = pdf.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i)
    const fy = pageH - 26
    pdf.setDrawColor(...LINE); pdf.setLineWidth(0.5); pdf.line(M, fy - 9, pageW - M, fy - 9)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(...MUTED)
    pdf.text('A Vida Não Colabora — Relatório de autoconhecimento emocional', M, fy)
    pdf.text(`Página ${i} de ${total}`, pageW - M, fy, { align: 'right' })
    pdf.setFontSize(6.5)
    pdf.text('Não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência.', M, fy + 9)
  }

  pdf.save(filename)
}
