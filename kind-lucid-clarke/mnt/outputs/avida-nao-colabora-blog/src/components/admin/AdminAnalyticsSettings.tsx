import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Save, Check, Loader2 } from 'lucide-react'

// Extraído do antigo AnalyticsPageLegacy (aba "Configurações"). Vive em
// Sistema → Configurações → Analytics: é configuração técnica (rastreamento,
// retenção, privacidade) que o site lê de analytics_settings, não uma tela
// de análise.

type SettingsConfig = { track_pageviews: boolean; track_scroll: boolean; track_cta: boolean; track_errors: boolean; track_web_vitals: boolean; anonymize: boolean; retention_days: number }
const DEFAULT_CFG: SettingsConfig = { track_pageviews: true, track_scroll: true, track_cta: true, track_errors: true, track_web_vitals: true, anonymize: true, retention_days: 365 }
const TOGGLES: { key: keyof SettingsConfig; label: string; hint: string }[] = [
  { key: 'track_pageviews', label: 'Visualizações de página', hint: 'page_view a cada navegação' },
  { key: 'track_scroll', label: 'Profundidade de leitura', hint: 'scroll_50 / 75 / 100 nos artigos' },
  { key: 'track_cta', label: 'Cliques em CTA', hint: 'botões marcados com data-cta' },
  { key: 'track_errors', label: 'Erros 404', hint: 'artigos inexistentes' },
  { key: 'track_web_vitals', label: 'Core Web Vitals', hint: 'LCP, CLS, FCP, TTFB' },
  { key: 'anonymize', label: 'Anonimizar visitante', hint: 'sem IP, sessão aleatória (LGPD)' },
]
type CustomInteraction = 'click' | 'submit' | 'view'
interface CustomEvent { id: string; name: string; description: string | null; selector: string | null; url_pattern: string | null; interaction_type: CustomInteraction; is_active: boolean }

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-ink-soft py-6 text-center">{text}</p>
}

export default function AdminAnalyticsSettings() {
  const [cfg, setCfg] = useState<SettingsConfig>(DEFAULT_CFG)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ces, setCes] = useState<CustomEvent[]>([])
  const [nName, setNName] = useState(''); const [nSel, setNSel] = useState(''); const [nUrl, setNUrl] = useState(''); const [nInteraction, setNInteraction] = useState<CustomInteraction>('click')

  async function load() {
    const [sRes, cRes] = await Promise.all([
      supabase.from('analytics_settings').select('config').eq('id', 1).maybeSingle(),
      supabase.from('analytics_custom_events').select('*').order('created_at', { ascending: false }),
    ])
    if (sRes.data?.config) setCfg({ ...DEFAULT_CFG, ...(sRes.data.config as Partial<SettingsConfig>) })
    setCes((cRes.data as CustomEvent[]) ?? [])
  }
  useEffect(() => { void load() }, [])

  async function save() {
    setSaving(true); setSaved(false)
    await supabase.from('analytics_settings').upsert({ id: 1, config: cfg, updated_at: new Date().toISOString() })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }
  async function addCE() {
    const name = nName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (!name || !nSel.trim()) return
    try { document.querySelector(nSel.trim()) } catch { return }
    await supabase.from('analytics_custom_events').insert({ name, selector: nSel.trim(), url_pattern: nUrl.trim() || null, interaction_type: nInteraction })
    setNName(''); setNSel(''); setNUrl(''); setNInteraction('click'); load()
  }
  async function toggleCE(c: CustomEvent) { await supabase.from('analytics_custom_events').update({ is_active: !c.is_active }).eq('id', c.id); load() }
  async function delCE(c: CustomEvent) { await supabase.from('analytics_custom_events').delete().eq('id', c.id); load() }

  const card = 'bg-white border border-line rounded-2xl p-5'
  const inp = 'border border-line rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-forest-400'
  return (
    <div className="p-5 sm:p-6 space-y-5">
      <div>
        <h2 className="font-serif text-xl text-forest-900">Configurações de Analytics</h2>
        <p className="text-xs text-ink-soft mt-0.5">Rastreamento, retenção e privacidade dos dados de Analytics. O site público lê estas opções de <code>analytics_settings</code>.</p>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="font-serif text-lg text-forest-900">Rastreamento</h3>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Salvo' : 'Salvar'}</button>
        </div>
        <div className="space-y-1">{TOGGLES.map(t => (
          <label key={t.key} className="flex items-center justify-between py-2.5 border-b border-line last:border-0 cursor-pointer">
            <span><span className="text-sm text-forest-900">{t.label}</span><span className="block text-xs text-ink-soft">{t.hint}</span></span>
            <button type="button" onClick={() => setCfg(c => ({ ...c, [t.key]: !c[t.key] }))} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${cfg[t.key] ? 'bg-forest-600' : 'bg-stone-300'}`}><span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${cfg[t.key] ? 'left-[22px]' : 'left-0.5'}`} /></button>
          </label>
        ))}
          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <span><span className="text-sm text-forest-900">Retenção dos dados</span><span className="block text-xs text-ink-soft">dias antes de expurgar eventos antigos</span></span>
            <input type="number" min={30} max={1095} value={cfg.retention_days} onChange={e => setCfg(c => ({ ...c, retention_days: Number(e.target.value) }))} className={`${inp} w-24 text-right`} />
          </label>
        </div>
      </div>

      <div className={card}>
        <h3 className="font-serif text-lg text-forest-900 mb-1">Eventos personalizados</h3>
        <p className="text-xs text-ink-soft mb-4">Defina eventos extras por seletor CSS. O site aplica somente definições ativas e ignora seletor inválido sem interromper a navegação.</p>
        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-[140px]"><label className="block text-xs text-ink-soft mb-1">Nome</label><input value={nName} onChange={e => setNName(e.target.value)} placeholder="ex.: clique_whatsapp" className={`${inp} w-full`} /></div>
          <div className="flex-1 min-w-[140px]"><label className="block text-xs text-ink-soft mb-1">Seletor CSS</label><input value={nSel} onChange={e => setNSel(e.target.value)} placeholder="[data-cta='whatsapp']" className={`${inp} w-full`} /></div>
          <div className="min-w-[120px]"><label className="block text-xs text-ink-soft mb-1">Interação</label><select value={nInteraction} onChange={e => setNInteraction(e.target.value as CustomInteraction)} className={`${inp} w-full`}><option value="click">Clique</option><option value="submit">Envio de formulário</option><option value="view">Visualização</option></select></div>
          <div className="flex-1 min-w-[140px]"><label className="block text-xs text-ink-soft mb-1">Padrão de URL</label><input value={nUrl} onChange={e => setNUrl(e.target.value)} placeholder="/contato" className={`${inp} w-full`} /></div>
          <button onClick={addCE} className="inline-flex items-center gap-2 bg-forest-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-forest-800"><Plus className="w-4 h-4" /> Adicionar</button>
        </div>
        {ces.length === 0 ? <Empty text="Nenhum evento personalizado ainda." /> : (
          <div className="space-y-2">{ces.map(c => (
            <div key={c.id} className="flex items-center justify-between border border-line rounded-xl px-3 py-2">
              <div><span className="text-sm text-forest-900 font-mono">{c.name}</span>{(c.selector || c.url_pattern) && <span className="block text-xs text-ink-soft">{c.interaction_type || 'click'} · {c.selector} {c.url_pattern && `· ${c.url_pattern}`}</span>}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleCE(c)} className={`text-xs px-2 py-1 rounded-lg ${c.is_active ? 'bg-mint text-forest-700' : 'bg-stone-100 text-stone-400'}`}>{c.is_active ? 'ativo' : 'inativo'}</button>
                <button onClick={() => delCE(c)} className="text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}</div>
        )}
      </div>

      <div className={card}>
        <h3 className="font-serif text-lg text-forest-900 mb-3">Privacidade &amp; LGPD</h3>
        <ul className="space-y-2 text-sm text-ink">
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> Sem IP completo — visitante anonimizado por sessão.</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> Não registra conteúdo de diário, check-in ou respostas sensíveis.</li>
          <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-600" /> Dados de Analytics só o admin acessa (RLS).</li>
        </ul>
      </div>
    </div>
  )
}
