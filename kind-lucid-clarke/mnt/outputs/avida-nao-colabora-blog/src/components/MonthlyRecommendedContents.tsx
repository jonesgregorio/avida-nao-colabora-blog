import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { recommendGuidedContent, type RecommendedContent } from '../lib/questionnaireResult'
export default function MonthlyRecommendedContents({plan,tags,onOpen}:{plan:string;tags:string[];onOpen?:(slug:string)=>void}){
 const [items,setItems]=useState<RecommendedContent[]>([]),tagKey=tags.join('|')
 useEffect(()=>{let active=true;const requested=tagKey.split('|').filter(Boolean);if(!requested.length){setItems([]);return()=>{active=false}};recommendGuidedContent(plan,requested,3).then(x=>{if(active)setItems(x)}).catch(()=>{});return()=>{active=false}},[plan,tagKey])
 if(!items.length)return <p className="text-sm text-ink-soft">Continue registrando para receber recomendações mais relacionadas ao seu momento.</p>
 return <div className="grid gap-3 sm:grid-cols-3">{items.map(item=><button key={item.slug??item.title} type="button" onClick={()=>{if(item.slug)onOpen?.(item.slug)}} className="rounded-xl border border-line bg-paper-soft/30 p-3 text-left"><span className="mb-3 flex h-16 items-center justify-center rounded-lg bg-mint"><BookOpen className="w-6 h-6 text-forest-600"/></span><p className="text-xs font-medium text-forest-900">{item.title}</p></button>)}</div>
}