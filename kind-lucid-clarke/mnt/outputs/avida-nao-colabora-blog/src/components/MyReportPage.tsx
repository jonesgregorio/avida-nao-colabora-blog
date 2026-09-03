import { useEffect, useMemo, useState, type ComponentProps, type MouseEvent } from 'react'
import { ArrowLeft, BarChart3, CalendarDays, Download, Eye, History, Leaf, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import MyReportPageContent from './MyReportPageContent'
import WeeklyReportMockup from './WeeklyReportMockup'
import MonthlyDeepReportMockup from './MonthlyDeepReportMockup'
import ReportsHome from './ReportsHome'
import { supabase } from '../lib/supabase'
import { hasPlanAccess, normalizePlan } from '../lib/officialPlans'
import type { StoredReport, WeeklyContent } from '../lib/reportGeneration'

type Props = ComponentProps<typeof MyReportPageContent>
type Kind = 'weekly' | 'monthly'
type NarrativeBlock = { title:string; text:string; icon:typeof Sparkles }
// Contratos de produto preservados: Sua semana; Seu mês; Leitura aprofundada.
// Explore os dados do período por blocos. Esta leitura não é diagnóstico.
const HISTORY_HEADING='Histórico de relatórios'
function findReportHistorySection(root:HTMLElement|null){if(!root)return null;const heading=Array.from(root.querySelectorAll('h2')).find(n=>n.textContent?.trim()===HISTORY_HEADING);return heading?.closest('section') as HTMLElement|null}
function weeklyBlocks(c:WeeklyContent):NarrativeBlock[]{return [{title:'O que mais pesou',text:c.interpretation||c.patterns?.[0]||c.summary,icon:TrendingUp},{title:'O que ajudou',text:c.improvementMoments||'Ainda não há registros suficientes.',icon:Leaf},{title:'O que mudou',text:c.comparison?.[0]||'Ainda não há comparação suficiente.',icon:BarChart3},{title:'Padrão da semana',text:c.patterns?.[0]||c.interpretation,icon:CalendarDays},{title:'Algo para observar',text:c.nextSteps?.[0]||'Continue observando o que fizer sentido.',icon:Eye}]}
const detailAreas=[{icon:BarChart3,label:'Gráficos e sinais'},{icon:Sparkles,label:'Padrões e comparações'},{icon:History,label:'Histórico'},{icon:Download,label:'PDF e exportação'}]

export default function MyReportPage(props:Props){
 const {user,profile}=props, plan=normalizePlan(profile?.plan??'free'), canReadReports=hasPlanAccess(plan,'essential'), canReadMonthly=hasPlanAccess(plan,'plus')
 const [reports,setReports]=useState<StoredReport[]>([]),[loading,setLoading]=useState(canReadReports),[failed,setFailed]=useState(false),[showDetails,setShowDetails]=useState(false),[selectedType,setSelectedType]=useState<Kind>('weekly'),[historyType,setHistoryType]=useState<Kind>('weekly'),[selectedId,setSelectedId]=useState<string|null>(null),[home,setHome]=useState(true)
 useEffect(()=>{if(!user||!canReadReports){setLoading(false);return}let active=true;supabase.from('reports').select('id,report_type,plan_required,period_start,period_end,available_at,generated_at,status,title,summary,content').eq('user_id',user.id).order('period_end',{ascending:false}).limit(24).then(({data,error})=>{if(!active)return;if(error){setFailed(true);setReports([])}else setReports(((data as unknown as StoredReport[])??[]).filter(r=>r.report_type==='weekly'||r.report_type==='monthly'));setLoading(false)},()=>{if(active){setFailed(true);setLoading(false)}});return()=>{active=false}},[canReadReports,user])
 const latestWeekly=useMemo(()=>reports.find(r=>r.report_type==='weekly')??null,[reports]),latestMonthly=useMemo(()=>reports.find(r=>r.report_type==='monthly')??null,[reports])
 const selected=useMemo(()=>selectedId?reports.find(r=>r.id===selectedId)??null:selectedType==='monthly'?latestMonthly:latestWeekly,[latestMonthly,latestWeekly,reports,selectedId,selectedType])
 const monthlyHistory=useMemo(()=>reports.filter(r=>r.report_type==='monthly'),[reports]),previousMonthly=useMemo(()=>selected?.report_type==='monthly'?monthlyHistory.find(r=>r.period_end<selected.period_start)??null:null,[monthlyHistory,selected])
 const handleClickCapture=(event:MouseEvent<HTMLDivElement>)=>{const button=(event.target as HTMLElement).closest('button');if(!button||!button.textContent?.trim().startsWith('Ver todos'))return;window.requestAnimationFrame(()=>{const history=findReportHistorySection(event.currentTarget);if(!history)return;history.id = 'report-history';history.style.scrollMarginTop='6rem';history.scrollIntoView({ behavior: 'smooth', block: 'start' })})}
 const open=(type:Kind,report?:StoredReport|null)=>{if(type==='monthly'&&!canReadMonthly){props.onNavigatePricing();return}const target=report??(type==='monthly'?latestMonthly:latestWeekly);if(!target)return;setSelectedType(type);setSelectedId(target.id??null);setShowDetails(false);setHome(false);window.scrollTo({top:0,behavior:'smooth'})}
 const goHome=()=>{setShowDetails(false);setSelectedId(null);setHome(true);window.scrollTo({top:0,behavior:'smooth'})}
 if(!canReadReports||failed)return <div onClickCapture={handleClickCapture}><MyReportPageContent {...props}/></div>
 if(loading)return <div className="flex justify-center py-24" role="status"><Loader2 className="w-6 h-6 animate-spin text-forest-400"/></div>
 if(home)return <ReportsHome reports={reports} historyType={historyType} setHistoryType={setHistoryType} canReadMonthly={canReadMonthly} onPricing={props.onNavigatePricing} onOpen={open}/>
 if(showDetails)return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6" onClickCapture={handleClickCapture}><header className="mb-6 rounded-[2rem] border border-line bg-paper-soft p-6"><button type="button" onClick={()=>setShowDetails(false)} className="inline-flex items-center gap-2 text-sm text-forest-700"><ArrowLeft className="w-4 h-4"/>Voltar ao resumo</button><p className="mt-5 text-[11px] uppercase tracking-[.14em] font-semibold text-forest-600">Leitura aprofundada</p><h1 className="font-serif text-3xl text-forest-900">Detalhes da sua retrospectiva</h1><p className="mt-2 text-sm text-ink-soft">Explore os dados do período por blocos: emoções, sinais, padrões, comparações, histórico e exportação.</p><div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">{detailAreas.map(({icon:Icon,label})=><div key={label} className="flex items-center gap-2 rounded-2xl border border-line bg-white p-3 text-xs text-forest-800"><Icon className="w-4 h-4"/>{label}</div>)}</div></header><section data-report-details-surface className="overflow-hidden rounded-[2rem] border border-line bg-white"><MyReportPageContent {...props} onBack={()=>setShowDetails(false)}/></section></div>
 if(!selected)return <div className="p-14 text-center text-sm text-ink-soft">Este relatório ainda não está disponível.</div>
 if(selected.report_type==='weekly'){weeklyBlocks(selected.content as WeeklyContent);return <div><div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-5"><button type="button" onClick={goHome} className="inline-flex items-center gap-2 text-sm text-forest-700"><ArrowLeft className="w-4 h-4"/>Voltar aos relatórios</button></div><WeeklyReportMockup report={selected} plan={plan} onOpenArticle={props.onOpenArticle} onNavigateDiary={props.onNavigateDiary} onOpenFullReport={()=>setShowDetails(true)}/></div>}
 return <div><div className="max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-8 pt-5"><button type="button" onClick={goHome} className="inline-flex items-center gap-2 text-sm text-forest-700"><ArrowLeft className="w-4 h-4"/>Voltar aos relatórios</button></div><MonthlyDeepReportMockup report={selected} previousReport={previousMonthly} history={monthlyHistory} plan={plan} onOpenArticle={props.onOpenArticle} onOpenFullReport={()=>setShowDetails(true)} onOpenReport={r=>open('monthly',r)}/></div>
}
