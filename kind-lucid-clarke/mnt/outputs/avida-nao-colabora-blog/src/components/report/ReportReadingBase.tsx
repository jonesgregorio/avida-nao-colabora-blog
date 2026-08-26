import { AlertCircle, Check, Info } from 'lucide-react'
import type { MonthlyContent, ReportContent, WeeklyContent } from '../../lib/reportGeneration'

type CountedItem = { label: string; count: number }

function positiveCount(value: unknown): number {
  const count = Number(value)
  return Number.isFinite(count) && count > 0 ? count : 0
}

function addCounted(target: CountedItem[], label: string, count: unknown) {
  const normalized = positiveCount(count)
  if (normalized > 0) target.push({ label, count: normalized })
}

function confirmedSignals(content: ReportContent): CountedItem[] {
  const items: CountedItem[] = []

  for (const emotion of content.topEmotions ?? []) {
    addCounted(items, `Emoção registrada: ${emotion.label}`, emotion.count)
  }

  if (content.kind === 'weekly') {
    const weekly = content as WeeklyContent
    for (const marker of weekly.emotionalMarkers ?? weekly.triggers ?? []) {
      addCounted(items, `Marcador emocional: ${marker.tag}`, marker.count)
    }
    for (const context of weekly.topContexts ?? []) {
      addCounted(items, `Contexto marcado: ${context.tag}`, context.count)
    }
  } else {
    const monthly = content as MonthlyContent
    for (const marker of monthly.topEmotionalMarkers ?? monthly.topTriggers ?? []) {
      addCounted(items, `Marcador emocional: ${marker.tag}`, marker.count)
    }
    for (const context of monthly.topContexts ?? []) {
      addCounted(items, `Contexto marcado: ${context.tag}`, context.count)
    }
    for (const need of monthly.topNeeds ?? []) {
      addCounted(items, `Necessidade marcada: ${need.tag}`, need.count)
    }
    for (const trigger of monthly.realTriggers ?? []) {
      addCounted(items, `Gatilho informado: ${trigger.tag}`, trigger.count)
    }
  }

  return items.slice(0, 14)
}

function contextualSignals(content: ReportContent): string[] {
  const items: string[] = []
  const total = positiveCount(content.checkinCount) + positiveCount(content.diaryCount)
  if (total > 0) items.push(`${total} registro${total === 1 ? '' : 's'} considerado${total === 1 ? '' : 's'} no período`)
  if (positiveCount(content.avgEnergy) > 0) items.push(`Energia média observada: ${Number(content.avgEnergy).toFixed(1)}/5`)
  if (positiveCount(content.avgAnxiety) > 0) items.push(`Ansiedade percebida média: ${Number(content.avgAnxiety).toFixed(1)}/5`)

  if (content.kind === 'weekly') {
    const weekly = content as WeeklyContent
    const activeDays = positiveCount(weekly.data_quality?.active_days)
    if (activeDays > 0) items.push(`${activeDays} dia${activeDays === 1 ? '' : 's'} com dados no período`)
    if ((weekly.patterns?.length ?? 0) > 0) items.push(`${weekly.patterns.length} recorrência${weekly.patterns.length === 1 ? '' : 's'} descrita${weekly.patterns.length === 1 ? '' : 's'} a partir do conjunto dos registros`)
  } else {
    const monthly = content as MonthlyContent
    if (positiveCount(monthly.avgSleep) > 0) items.push(`Sono médio observado: ${Number(monthly.avgSleep).toFixed(1)}/5`)
    if ((monthly.patterns?.length ?? 0) > 0) items.push(`${monthly.patterns.length} padrão${monthly.patterns.length === 1 ? '' : 'ões'} observado${monthly.patterns.length === 1 ? '' : 's'} no conjunto do mês`)
    if ((monthly.relations?.length ?? 0) > 0) items.push(`${monthly.relations.length} relação${monthly.relations.length === 1 ? '' : 'ões'} percebida${monthly.relations.length === 1 ? '' : 's'} entre sinais do período`)
  }

  const questionnaire = (content as ReportContent & { questionnaire_signals?: { completed_count?: number } }).questionnaire_signals
  const questionnaireCount = positiveCount(questionnaire?.completed_count)
  if (questionnaireCount > 0) items.push(`${questionnaireCount} questionário${questionnaireCount === 1 ? '' : 's'} concluído${questionnaireCount === 1 ? '' : 's'} usado${questionnaireCount === 1 ? '' : 's'} apenas como contexto complementar`)

  return items.slice(0, 8)
}

function missingSignals(content: ReportContent): string[] {
  const items: string[] = []
  if ((content.topEmotions?.length ?? 0) === 0) items.push('Sem emoções estruturadas registradas no período')
  if (positiveCount(content.avgEnergy) === 0) items.push('Sem dados suficientes de energia')
  if (positiveCount(content.avgAnxiety) === 0) items.push('Sem dados suficientes de ansiedade percebida')

  if (content.kind === 'weekly') {
    const weekly = content as WeeklyContent
    if ((weekly.emotionalMarkers?.length ?? weekly.triggers?.length ?? 0) === 0) items.push('Sem marcadores emocionais registrados')
    if ((weekly.topContexts?.length ?? 0) === 0) items.push('Sem contextos estruturados suficientes')
    if (weekly.data_quality?.has_enough_data === false || weekly.hasEnoughData === false) items.push('Poucos registros para uma leitura mais consistente')
  } else {
    const monthly = content as MonthlyContent
    if ((monthly.topEmotionalMarkers?.length ?? monthly.topTriggers?.length ?? 0) === 0) items.push('Sem marcadores emocionais registrados')
    if ((monthly.topContexts?.length ?? 0) === 0) items.push('Sem contextos estruturados suficientes')
    if ((monthly.topNeeds?.length ?? 0) === 0) items.push('Sem necessidades estruturadas suficientes')
    if ((monthly.realTriggers?.length ?? 0) === 0) items.push('Sem gatilhos reais informados no período')
    if (monthly.hasEnoughData === false) items.push('Poucos registros para uma leitura mais consistente')
  }

  return [...new Set(items)].slice(0, 7)
}

function Group({ title, description, tone, children }: {
  title: string
  description: string
  tone: 'confirmed' | 'context' | 'missing'
  children: React.ReactNode
}) {
  const toneClasses = tone === 'confirmed'
    ? 'border-forest-100 bg-mint/35'
    : tone === 'context'
      ? 'border-line bg-white/80'
      : 'border-coral/50 bg-coral/20'
  const Icon = tone === 'confirmed' ? Check : tone === 'context' ? Info : AlertCircle
  const iconClasses = tone === 'missing' ? 'text-[#c2673f] bg-white' : 'text-forest-600 bg-white'

  return (
    <div className={`rounded-xl border p-3.5 ${toneClasses}`}>
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${iconClasses}`}><Icon className="w-3.5 h-3.5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-forest-900">{title}</p>
          <p className="text-[11px] text-ink-soft leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

export default function ReportReadingBase({ content }: { content: ReportContent }) {
  const confirmed = confirmedSignals(content)
  const contextual = contextualSignals(content)
  const missing = missingSignals(content)

  return (
    <section className="mb-4 rounded-2xl border border-line bg-paper-soft p-4 sm:p-5" aria-labelledby="report-reading-base-title">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 id="report-reading-base-title" className="font-serif text-lg text-forest-900">Base desta leitura</h3>
          <p className="text-xs text-ink-soft mt-1 leading-relaxed">Veja o que veio diretamente dos seus registros, o que foi observado ao combinar os dados do período e onde ainda faltam informações.</p>
        </div>
        <span
          className="w-8 h-8 rounded-full bg-mint flex items-center justify-center text-forest-600 flex-shrink-0"
          title="Contagens são ocorrências registradas. Leituras contextuais combinam sinais do período e não representam diagnóstico, causa ou certeza."
          aria-label="Como interpretar a base desta leitura"
        ><Info className="w-4 h-4" /></span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Group title="Confirmado nos registros" description="Marcações estruturadas que aparecem nos seus check-ins e diários, com a quantidade de ocorrências." tone="confirmed">
          {confirmed.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {confirmed.map(item => <span key={`${item.label}-${item.count}`} className="rounded-full bg-white border border-forest-100 px-2.5 py-1 text-[11px] text-forest-800">{item.label} · {item.count}x</span>)}
            </div>
          ) : <p className="text-xs text-ink-soft">Nenhuma marcação estruturada suficiente neste período.</p>}
        </Group>

        <Group title="Leitura contextual" description="Médias, recorrências e relações observadas quando os registros do período são considerados em conjunto." tone="context">
          {contextual.length > 0 ? (
            <ul className="space-y-1.5">{contextual.map(item => <li key={item} className="text-xs text-stone-700 flex gap-2"><span className="text-forest-400">•</span><span>{item}</span></li>)}</ul>
          ) : <p className="text-xs text-ink-soft">Ainda não há sinais contextuais suficientes para destacar.</p>}
        </Group>

        <Group title="Sem dados suficientes" description="Itens que não foram registrados ou ainda não apareceram o bastante para sustentar uma leitura." tone="missing">
          {missing.length > 0 ? (
            <ul className="space-y-1.5">{missing.map(item => <li key={item} className="text-xs text-stone-700 flex gap-2"><span className="text-[#c2673f]">•</span><span>{item}</span></li>)}</ul>
          ) : <p className="text-xs text-ink-soft">Não há uma lacuna relevante entre os principais campos usados neste relatório.</p>}
        </Group>
      </div>

      <p className="mt-3 pt-3 border-t border-line text-[11px] text-ink-soft leading-relaxed">
        <strong className="text-forest-800">Como ler:</strong> contagens representam ocorrências marcadas nos registros. Leituras contextuais combinam sinais do período; elas não significam diagnóstico, causa ou certeza sobre você. A ausência de dados é mostrada explicitamente em vez de ser preenchida por suposição.
      </p>
    </section>
  )
}
