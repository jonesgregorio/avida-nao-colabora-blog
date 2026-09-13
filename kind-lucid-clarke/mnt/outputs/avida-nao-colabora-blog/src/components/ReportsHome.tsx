import { CalendarCheck2, CalendarDays, ChevronRight, FileText, LockKeyhole, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import type { StoredReport } from '../lib/reportGeneration'
import { formatPeriodShort, monthTitle } from '../lib/reportPeriods'

type Kind = 'weekly' | 'monthly'
interface Props { reports: StoredReport[]; historyType: Kind; setHistoryType:(v:Kind)=>void; canReadMonthly:boolean; onPricing:()=>void; onOpen:(type:Kind, report?:StoredReport|null)=>void }
function label(r:StoredReport){ return r.report_type==='monthly'?monthTitle(r.period_start):formatPeriodShort({start:r.period_start,end:r.period_end}) }

const REPORT_TYPES = {
 weekly: {
  eyebrow: 'Fechamento curto',
  title: 'Relatório Semanal',
  description: 'Uma retrospectiva objetiva dos últimos dias para perceber o que mais apareceu, o que ajudou e o que mudou em relação à semana anterior.',
  bullets: ['Leitura rápida do período', 'Até 3 destaques e 1 ponto de atenção', 'Comparação com a semana anterior'],
  footer: 'Ideal para entender a semana sem transformar o relatório em plano de tarefas.',
 },
 monthly: {
  eyebrow: 'Leitura aprofundada',
  title: 'Relatório Mensal Aprofundado',
  description: 'Uma leitura mais ampla do mês, cruzando sinais recorrentes, comparações, conexões e trajetória para dar contexto ao período.',
  bullets: ['Padrões e conexões do mês', 'Comparação com períodos anteriores', 'Leitura visual e exploração detalhada'],
  footer: 'Disponível no Plus após o fechamento do mês.',
 },
} as const

export default function ReportsHome({reports,historyType,setHistoryType,canReadMonthly,onPricing,onOpen}:Props){
 const weekly=reports.find(r=>r.report_type==='weekly')??null, monthly=reports.find(r=>r.report_type==='monthly')??null, history=reports.filter(r=>r.report_type===historyType)
 return <div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9 text-ink">
  <header className="mb-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
   <div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-forest-600">Entender períodos</p><h1 className="mt-1 font-serif text-4xl md:text-5xl text-forest-900">Relatórios</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-ink-soft">Semanal e mensal cumprem papéis diferentes: um ajuda a fechar os últimos dias; o outro aprofunda um mês inteiro.</p></div>
   <div className="rounded-[22px] border border-line bg-white p-4 flex gap-3"><LockKeyhole className="w-4 h-4 text-forest-700 mt-0.5"/><p className="text-xs leading-5 text-ink-soft">Seus relatórios ficam disponíveis apenas na sua conta e usam os dados estruturados permitidos para cada plano.</p></div>
  </header>

  <section className="mb-5 rounded-[26px] border border-line bg-white p-4 sm:p-6">
   <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-2xl text-forest-900">Escolha o tipo de leitura</h2><p className="mt-1 text-sm text-ink-soft">A diferença entre os dois relatórios fica explícita antes de você abrir.</p></div><span className="text-[11px] text-ink-soft">Sem meta, nota ou ranking</span></div>
   <div className="grid gap-4 md:grid-cols-2">
    {([[weekly,'weekly'],[monthly,'monthly']] as const).map(([report,type])=>{const cfg=REPORT_TYPES[type];const monthlyLocked=type==='monthly'&&!canReadMonthly;return <article key={type} className={`flex min-h-[390px] flex-col rounded-[24px] border p-5 sm:p-6 ${type==='weekly'?'border-forest-100 bg-gradient-to-br from-[#f6f8f1] to-[#e7efe1]':'border-[#ecd9c9] bg-gradient-to-br from-[#fffaf5] to-[#f8eadf]'}`}>
      <div className="flex items-start justify-between gap-3"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${type==='weekly'?'bg-white text-forest-800':'bg-white text-[#c5672f]'}`}>{type==='weekly'?<CalendarDays className="w-7 h-7"/>:<CalendarCheck2 className="w-7 h-7"/>}</span><span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] ${type==='weekly'?'bg-forest-900 text-white':'bg-[#c5672f] text-white'}`}>{cfg.eyebrow}</span></div>
      <h3 className="mt-5 font-serif text-2xl text-forest-900">{cfg.title}</h3><p className="mt-3 text-sm leading-6 text-ink-soft">{cfg.description}</p>
      <div className="mt-5 space-y-2.5">{cfg.bullets.map(item=><div key={item} className="flex items-start gap-2 text-sm text-forest-900"><span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${type==='weekly'?'bg-forest-600':'bg-[#c5672f]'}`}/><span>{item}</span></div>)}</div>
      <button type="button" onClick={()=>monthlyLocked?onPricing():onOpen(type,report)} disabled={Boolean(canReadMonthly&&type==='monthly'&&!report)||Boolean(type==='weekly'&&!report)} className={`mt-6 w-full rounded-2xl px-4 py-3 text-sm font-medium text-white disabled:opacity-45 ${type==='weekly'?'bg-forest-900':'bg-[#9f542d]'}`}>{monthlyLocked?'Conhecer o Plus':report?`Abrir ${type==='weekly'?'retrospectiva semanal':'leitura mensal'}`:'Sem relatório disponível'}</button>
      <p className="mt-auto pt-5 text-xs leading-5 text-ink-soft">{cfg.footer}</p>
    </article>})}
   </div>
  </section>

  <section className="mb-5 grid gap-3 sm:grid-cols-2" aria-label="Como os relatórios se complementam">
   <div className="rounded-[22px] border border-line bg-paper-soft/45 p-4 sm:p-5"><div className="flex items-center gap-2 text-forest-900"><TrendingUp className="w-4 h-4 text-forest-600"/><p className="text-sm font-semibold">Semanal responde: “como foram meus últimos dias?”</p></div><p className="mt-2 text-xs leading-5 text-ink-soft">Mais curto, comparativo e direto. Serve para fechar uma semana sem repetir o conteúdo aprofundado do mês.</p></div>
   <div className="rounded-[22px] border border-line bg-paper-soft/45 p-4 sm:p-5"><div className="flex items-center gap-2 text-forest-900"><Sparkles className="w-4 h-4 text-[#c5672f]"/><p className="text-sm font-semibold">Mensal responde: “o que este mês mostra quando vejo o conjunto?”</p></div><p className="mt-2 text-xs leading-5 text-ink-soft">Mais amplo, visual e detalhado. Reúne padrões, mudanças, conexões e histórico para contextualizar o período.</p></div>
  </section>

  <section className="rounded-[26px] border border-line bg-white p-4 sm:p-6"><div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-serif text-2xl text-forest-900">Histórico de relatórios</h2><p className="mt-1 text-sm text-ink-soft">Reabra leituras anteriores sem misturar semanas e meses.</p></div><span className="text-xs text-ink-soft">{history.length} {history.length===1?'relatório':'relatórios'}</span></div>
   <div className="mt-5 grid grid-cols-2 rounded-2xl border border-line bg-paper-soft p-1">{(['weekly','monthly'] as Kind[]).map(k=><button key={k} type="button" onClick={()=>setHistoryType(k)} className={`rounded-xl px-3 py-2.5 text-sm transition-all ${historyType===k?'bg-white shadow-sm text-forest-900 font-medium':'text-ink-soft'}`}>{k==='weekly'?'Semanais':'Mensais'}</button>)}</div>
   <div className="mt-4 space-y-3">{historyType==='monthly'&&!canReadMonthly?<div className="rounded-2xl bg-paper-soft/50 p-6 text-center text-sm text-forest-900">O histórico mensal faz parte do plano Plus.</div>:history.length?history.map(r=><article key={r.id} className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:flex-row sm:items-center"><span className={`flex h-11 w-11 items-center justify-center rounded-full ${r.report_type==='weekly'?'bg-mint':'bg-[#fff0e3]'}`}><FileText className={`w-4 h-4 ${r.report_type==='weekly'?'text-forest-700':'text-[#c5672f]'}`}/></span><div className="flex-1"><p className="font-medium text-forest-900">{r.report_type==='weekly'?'Relatório Semanal':'Relatório Mensal Aprofundado'} — {label(r)}</p><p className="mt-1 text-xs text-ink-soft">{r.period_start} a {r.period_end}</p></div><button type="button" onClick={()=>onOpen(r.report_type as Kind,r)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-xs font-medium text-forest-900 hover:bg-paper-soft">Ver relatório <ChevronRight className="w-4 h-4"/></button></article>):<div className="rounded-2xl border border-dashed border-line p-7 text-center text-sm text-ink-soft">Ainda não há relatórios anteriores nesta categoria.</div>}</div>
   <div className="mt-6 flex gap-3 rounded-2xl bg-paper-soft/60 p-4"><ShieldCheck className="w-5 h-5 text-forest-700 flex-shrink-0"/><p className="text-xs leading-5 text-ink-soft">Os relatórios organizam os dados disponíveis sem transformar frequência em meta de desempenho e sem substituir avaliação profissional.</p></div>
  </section>
 </div>
}