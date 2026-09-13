import { BarChart3, CalendarCheck2, CalendarDays, ChevronRight, FileText, Layers3, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import type { StoredReport } from '../lib/reportGeneration'
import { formatPeriodShort, monthTitle } from '../lib/reportPeriods'

type Kind = 'weekly' | 'monthly'
interface Props { reports: StoredReport[]; historyType: Kind; setHistoryType:(v:Kind)=>void; canReadMonthly:boolean; onPricing:()=>void; onOpen:(type:Kind, report?:StoredReport|null)=>void }
function label(r:StoredReport){ return r.report_type==='monthly'?monthTitle(r.period_start):formatPeriodShort({start:r.period_start,end:r.period_end}) }

const REPORT_OPTIONS = {
 weekly: {
  eyebrow:'Ritmo recente',
  title:'Relatório Semanal',
  question:'Como foram meus últimos dias?',
  description:'Uma retrospectiva curta para entender o período sem transformar a semana em uma avaliação de desempenho.',
  features:['Síntese da semana','Comparação com a semana anterior','Até 3 destaques e 1 ponto para observar'],
 },
 monthly: {
  eyebrow:'Visão aprofundada',
  title:'Relatório Mensal Aprofundado',
  question:'O que se repetiu, mudou e se conectou neste mês?',
  description:'Uma leitura mais ampla, feita para comparar sinais ao longo do mês e enxergar relações que uma única semana não mostra.',
  features:['Padrões e conexões do mês','Comparação com o mês anterior','Trajetória, gráficos e leitura aprofundada'],
 },
} as const

export default function ReportsHome({reports,historyType,setHistoryType,canReadMonthly,onPricing,onOpen}:Props){
 const weekly=reports.find(r=>r.report_type==='weekly')??null
 const monthly=reports.find(r=>r.report_type==='monthly')??null
 const history=reports.filter(r=>r.report_type===historyType)
 return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
  <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
   <div className="max-w-3xl"><p className="text-[11px] uppercase tracking-[.14em] font-semibold text-forest-600">Fechar um período para compreender melhor</p><h1 className="mt-1 font-serif text-4xl md:text-5xl text-forest-900">Relatórios</h1><p className="mt-2 text-sm leading-6 text-ink-soft">O semanal ajuda a olhar para o ritmo recente. O mensal aprofunda padrões, comparações e conexões. Eles têm papéis diferentes e não repetem a mesma leitura.</p></div>
   <div className="rounded-2xl border border-line bg-white p-4 lg:w-[290px] flex gap-3"><LockKeyhole className="w-4 h-4 shrink-0 text-forest-700"/><p className="text-xs leading-5 text-ink-soft">Seus relatórios ficam disponíveis apenas na sua conta e usam os dados previstos para cada período.</p></div>
  </header>

  <section className="mb-5 rounded-[28px] border border-line bg-white p-4 sm:p-6">
   <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[.14em] font-semibold text-forest-600">Escolha a profundidade</p><h2 className="mt-1 font-serif text-2xl text-forest-900">Duas leituras, dois objetivos</h2></div><p className="text-xs text-ink-soft sm:max-w-sm">Comece pelo semanal para entender o agora; use o mensal quando quiser uma visão mais longa.</p></div>
   <div className="mt-5 grid gap-4 md:grid-cols-2">
    {(['weekly','monthly'] as Kind[]).map(type=>{
     const report=type==='weekly'?weekly:monthly
     const option=REPORT_OPTIONS[type]
     const locked=type==='monthly'&&!canReadMonthly
     return <article key={type} className={`relative flex min-h-[390px] flex-col rounded-[24px] border p-5 sm:p-6 ${type==='weekly'?'border-forest-100 bg-gradient-to-b from-[#f3f7ef] to-white':'border-[#efd9c7] bg-gradient-to-b from-[#fff6ee] to-white'}`}>
      <div className="flex items-start justify-between gap-3"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${type==='weekly'?'bg-[#e1ecdc] text-forest-800':'bg-[#ffead9] text-[#b95d25]'}`}>{type==='weekly'?<CalendarDays className="w-6 h-6"/>:<CalendarCheck2 className="w-6 h-6"/>}</span><span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[.1em] ${type==='weekly'?'bg-white text-forest-700':'bg-white text-[#a85224]'}`}>{option.eyebrow}</span></div>
      <h3 className="mt-5 font-serif text-2xl text-forest-900">{option.title}</h3>
      <p className="mt-1 text-sm font-medium text-forest-800">{option.question}</p>
      <p className="mt-3 text-sm leading-6 text-ink-soft">{option.description}</p>
      <div className="mt-5 space-y-2.5">{option.features.map((feature,index)=><div key={feature} className="flex items-start gap-2.5 text-xs leading-5 text-ink-soft"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${type==='weekly'?'bg-mint text-forest-700':'bg-[#fff0e3] text-[#b95d25]'}`}>{index===0?<Sparkles className="w-3 h-3"/>:index===1?<BarChart3 className="w-3 h-3"/>:<Layers3 className="w-3 h-3"/>}</span>{feature}</div>)}</div>
      <button type="button" onClick={()=>locked?onPricing():onOpen(type,report)} disabled={Boolean(!locked&&!report)} className="mt-6 w-full rounded-xl bg-forest-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-45">{locked?'Conhecer o Plus':report?`Abrir ${type==='weekly'?'retrospectiva semanal':'leitura mensal aprofundada'}`:'Sem relatório disponível'}</button>
      <p className="mt-auto pt-4 text-xs text-ink-soft">{type==='weekly'?'Disponível a partir do Essencial após o fechamento da semana.':'Disponível no Plus após o fechamento do mês.'}</p>
     </article>
    })}
   </div>
  </section>

  <section className="rounded-[28px] border border-line bg-white p-4 sm:p-6">
   <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] uppercase tracking-[.14em] font-semibold text-forest-600">Revisitar</p><h2 className="mt-1 font-serif text-2xl text-forest-900">Histórico de relatórios</h2><p className="mt-1 text-sm text-ink-soft">Acesse leituras anteriores organizadas por período.</p></div></div>
   <div className="mt-5 grid grid-cols-2 rounded-2xl bg-paper-soft p-1" role="tablist" aria-label="Tipo de histórico">{(['weekly','monthly'] as Kind[]).map(k=><button key={k} type="button" role="tab" aria-selected={historyType===k} onClick={()=>setHistoryType(k)} className={`min-h-11 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors ${historyType===k?'bg-white text-forest-900 shadow-sm':'text-ink-soft'}`}>{k==='weekly'?'Semanais':'Mensais'}</button>)}</div>
   <div className="mt-4 space-y-3">{historyType==='monthly'&&!canReadMonthly?<div className="rounded-2xl bg-paper-soft/50 p-6 text-center text-sm text-forest-900">O histórico mensal faz parte do plano Plus.</div>:history.length?history.map(r=><article key={r.id} className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:flex-row sm:items-center"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${r.report_type==='weekly'?'bg-mint text-forest-700':'bg-[#fff0e3] text-[#b95d25]'}`}><FileText className="w-4 h-4"/></span><div className="flex-1"><p className="font-medium text-forest-900">{r.report_type==='weekly'?'Relatório Semanal':'Relatório Mensal Aprofundado'} — {label(r)}</p><p className="mt-1 text-xs text-ink-soft">{r.report_type==='weekly'?'Retrospectiva curta do período':'Leitura aprofundada do mês'} · {r.period_start} a {r.period_end}</p></div><button type="button" onClick={()=>onOpen(r.report_type as Kind,r)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-xs font-medium text-forest-900">Ver relatório <ChevronRight className="w-4 h-4"/></button></article>):<div className="rounded-2xl border border-dashed border-line p-7 text-center text-sm text-ink-soft">Ainda não há relatórios anteriores nesta categoria.</div>}</div>
   <div className="mt-6 flex gap-3 rounded-2xl bg-paper-soft/60 p-4"><ShieldCheck className="w-5 h-5 shrink-0 text-forest-700"/><p className="text-xs leading-5 text-ink-soft">Os relatórios organizam dados do período sem diagnosticar, sem transformar frequência em meta e sem substituir o Plano de Autocuidado.</p></div>
  </section>
 </div>
}