import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, BarChart3, CalendarClock, CheckCircle2, ChevronDown, ChevronUp,
  Flower2, History, LayoutDashboard, Loader2, Megaphone, Plus, RefreshCw,
  Save, Search, Settings2, Sprout, Users, X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Tab = 'overview' | 'users' | 'catalog' | 'queue' | 'campaigns' | 'rules' | 'analytics' | 'history'
type GardenStatus = 'draft' | 'ready' | 'queued' | 'active' | 'paused' | 'archived'

type Garden = {
  id: string
  slug: string
  label: string
  description: string
  theme_index: number
  status: GardenStatus
  queue_position: number | null
  release_at: string | null
  cover_image: string | null
  stage_images: string[]
  completion_title: string
  completion_message: string
}

type UserGarden = {
  user_id: string
  full_name: string | null
  email: string | null
  total_growth: number
  cycle_number: number
  garden_progress: number
  progress_pct: number
  stage: number
  garden_slug: string | null
  garden_label: string | null
  last_activity: string | null
  override_active: boolean
}

type Campaign = {
  id: string
  name: string
  garden_slug: string | null
  campaign_type: string
  status: string
  audience: string
  headline: string
  body: string
  cta_label: string
  starts_at: string | null
  ends_at: string | null
  temporary_unlock: boolean
  keep_after_start: boolean
}

type Settings = {
  id: boolean
  release_mode: 'global' | 'free' | 'hybrid'
  points_per_cycle: number
  daily_growth_cap: number | null
  stage_thresholds: number[]
}

type AuditRow = {
  id: number
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

type GardenStats = {
  total: number
  complete: number
  near: number
  inactive: number
  avg: number
  popular: string
}

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'users', label: 'Usuários', icon: Users },
  { id: 'catalog', label: 'Catálogo', icon: Flower2 },
  { id: 'queue', label: 'Fila', icon: CalendarClock },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'rules', label: 'Regras', icon: Settings2 },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'history', label: 'Histórico', icon: History },
]

const STATUS_LABEL: Record<GardenStatus, string> = {
  draft: 'Rascunho', ready: 'Pronto', queued: 'Na fila', active: 'Ativo', paused: 'Pausado', archived: 'Arquivado',
}

const STAGE_LABEL = ['Recém-plantado', 'Primeiros brotos', 'Flores', 'Árvore', 'Vida', 'Recanto', 'Completo']

function pct(v: number) { return `${Math.max(0, Math.min(100, Math.round(v)))}%` }
function fmtDate(v?: string | null) { return v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—' }

export default function AdminGardenManagement() {
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [gardens, setGardens] = useState<Garden[]>([])
  const [users, setUsers] = useState<UserGarden[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [settings, setSettings] = useState<Settings>({ id: true, release_mode: 'global', points_per_cycle: 60, daily_growth_cap: null, stage_thresholds: [3,10,18,28,39,50] })
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserGarden | null>(null)
  const [overrideGrowth, setOverrideGrowth] = useState('')
  const [overrideGarden, setOverrideGarden] = useState('')
  const [newCampaignOpen, setNewCampaignOpen] = useState(false)

  const auditAction = useCallback(async (action: string, entityType: string, entityId?: string, metadata: Record<string, unknown> = {}) => {
    await supabase.rpc('admin_garden_audit', { p_action: action, p_entity_type: entityType, p_entity_id: entityId ?? null, p_metadata: metadata })
  }, [])

  const load = useCallback(async () => {
    setLoading(true); setError('')
    const [g, u, c, s, a] = await Promise.all([
      supabase.from('garden_catalog').select('*').order('theme_index'),
      supabase.rpc('admin_garden_users'),
      supabase.from('garden_campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('garden_settings').select('*').eq('id', true).maybeSingle(),
      supabase.from('garden_admin_audit').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    const firstError = g.error || u.error || c.error || s.error || a.error
    if (firstError) setError(firstError.message)
    setGardens((g.data as Garden[] | null) ?? [])
    setUsers((u.data as UserGarden[] | null) ?? [])
    setCampaigns((c.data as Campaign[] | null) ?? [])
    if (s.data) setSettings(s.data as Settings)
    setAudit((a.data as AuditRow[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const queue = useMemo(() => gardens.filter(g => g.status === 'active' || g.status === 'queued').sort((a,b) => (a.queue_position ?? 999) - (b.queue_position ?? 999)), [gardens])
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(u => `${u.full_name ?? ''} ${u.email ?? ''} ${u.garden_label ?? ''}`.toLowerCase().includes(q))
  }, [users, query])

  const stats = useMemo<GardenStats>(() => {
    const total = users.length
    const complete = users.filter(u => u.progress_pct >= 83 || u.stage === 6).length
    const near = users.filter(u => u.progress_pct >= 75 && u.stage < 6).length
    const inactive = users.filter(u => !u.last_activity || Date.now() - new Date(u.last_activity).getTime() > 7 * 86400000).length
    const avg = total ? users.reduce((n,u) => n + u.progress_pct, 0) / total : 0
    const byGarden = new Map<string, number>()
    users.forEach(u => { if (u.garden_label) byGarden.set(u.garden_label, (byGarden.get(u.garden_label) ?? 0) + 1) })
    const popular = [...byGarden].sort((a,b) => b[1]-a[1])[0]?.[0] ?? '—'
    return { total, complete, near, inactive, avg, popular }
  }, [users])

  async function withSave(task: () => Promise<void>) {
    setSaving(true); setError(''); setNotice('')
    try { await task(); setNotice('Alterações salvas.'); await load() }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível salvar.') }
    finally { setSaving(false) }
  }

  async function updateGarden(garden: Garden, patch: Partial<Garden>) {
    await withSave(async () => {
      const { error: e } = await supabase.from('garden_catalog').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', garden.id)
      if (e) throw e
      await auditAction('garden.update', 'garden', garden.slug, patch as Record<string, unknown>)
    })
  }

  async function createGarden(input: { slug: string; label: string; description: string; theme_index: number; cover_image: string; stage_images: string[] }) {
    await withSave(async () => {
      const { error: e } = await supabase.from('garden_catalog').insert({
        slug: input.slug.trim(), label: input.label.trim(), description: input.description.trim(),
        theme_index: input.theme_index, status: 'draft',
        cover_image: input.cover_image.trim() || null,
        stage_images: input.stage_images.map(s => s.trim()).filter(Boolean),
      })
      if (e) throw e
      await auditAction('garden.create', 'garden', input.slug, { label: input.label })
    })
  }

  async function moveQueue(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= queue.length) return
    const next = [...queue]
    ;[next[index], next[target]] = [next[target], next[index]]
    await withSave(async () => {
      for (let i=0;i<next.length;i++) {
        const { error: e } = await supabase.from('garden_catalog').update({ queue_position: i + 1, updated_at: new Date().toISOString() }).eq('id', next[i].id)
        if (e) throw e
      }
      await auditAction('queue.reorder', 'queue', undefined, { order: next.map(g => g.slug) })
    })
  }

  async function makeNext(garden: Garden) {
    const current = queue.filter(g => g.id !== garden.id)
    const next = [garden, ...current]
    await withSave(async () => {
      for (let i=0;i<next.length;i++) {
        const { error: e } = await supabase.from('garden_catalog').update({ queue_position: i + 1, status: i === 0 ? 'active' : 'queued', updated_at: new Date().toISOString() }).eq('id', next[i].id)
        if (e) throw e
      }
      await auditAction('queue.set_next', 'garden', garden.slug)
    })
  }

  async function saveSettings() {
    await withSave(async () => {
      const { error: e } = await supabase.from('garden_settings').upsert({ ...settings, id: true, updated_at: new Date().toISOString() })
      if (e) throw e
      await auditAction('rules.update', 'settings', 'global', settings as unknown as Record<string, unknown>)
    })
  }

  function openUser(u: UserGarden) {
    setSelectedUser(u)
    setOverrideGrowth(String(u.total_growth))
    setOverrideGarden(u.garden_slug ?? '')
  }

  async function saveUserOverride() {
    if (!selectedUser) return
    const growth = Number(overrideGrowth)
    if (!Number.isFinite(growth) || growth < 0) { setError('Informe um progresso total válido.'); return }
    await withSave(async () => {
      const { error: e } = await supabase.from('garden_user_overrides').upsert({
        user_id: selectedUser.user_id,
        forced_total_growth: Math.round(growth),
        forced_garden_slug: overrideGarden || null,
        note: 'Ajuste manual pelo painel Gestão de Jardins',
        updated_at: new Date().toISOString(),
      })
      if (e) throw e
      await auditAction('user.override', 'user_garden', selectedUser.user_id, { forced_total_growth: Math.round(growth), forced_garden_slug: overrideGarden || null })
      setSelectedUser(null)
    })
  }

  async function clearUserOverride() {
    if (!selectedUser) return
    await withSave(async () => {
      const { error: e } = await supabase.from('garden_user_overrides').delete().eq('user_id', selectedUser.user_id)
      if (e) throw e
      await auditAction('user.override.clear', 'user_garden', selectedUser.user_id)
      setSelectedUser(null)
    })
  }

  if (loading) return <div className="min-h-[26rem] grid place-items-center"><Loader2 className="h-7 w-7 animate-spin text-forest-600" /></div>

  return (
    <div className="space-y-5 p-1">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="admin-kicker">Ecossistema de cuidado</p>
          <h2 className="font-serif text-3xl text-forest-900">Gestão de Jardins</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-soft">Acompanhe o crescimento, organize a fila, publique campanhas e altere as regras sem depender de código.</p>
        </div>
        <button type="button" className="admin-btn-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Atualizar</button>
      </div>

      {(error || notice) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

      <div className="admin-tabs-wrap overflow-x-auto">
        <nav className="admin-tabs min-w-max" aria-label="Gestão de Jardins">
          {TABS.map(t => { const Icon=t.icon; return <button key={t.id} type="button" onClick={()=>setTab(t.id)} className={`admin-tab ${tab===t.id?'is-active':''}`}><Icon className="h-4 w-4" />{t.label}</button> })}
        </nav>
      </div>

      {tab === 'overview' && <Overview stats={stats} users={users} queue={queue} campaigns={campaigns} onTab={setTab} />}
      {tab === 'users' && <UsersPanel users={filteredUsers} query={query} setQuery={setQuery} onOpen={openUser} />}
      {tab === 'catalog' && <CatalogPanel gardens={gardens} onUpdate={updateGarden} onCreate={createGarden} saving={saving} />}
      {tab === 'queue' && <QueuePanel queue={queue} gardens={gardens} onMove={moveQueue} onMakeNext={makeNext} onUpdate={updateGarden} saving={saving} />}
      {tab === 'campaigns' && <CampaignPanel campaigns={campaigns} gardens={gardens} open={newCampaignOpen} setOpen={setNewCampaignOpen} reload={load} audit={auditAction} />}
      {tab === 'rules' && <RulesPanel settings={settings} setSettings={setSettings} save={saveSettings} saving={saving} />}
      {tab === 'analytics' && <AnalyticsPanel users={users} gardens={gardens} />}
      {tab === 'history' && <HistoryPanel rows={audit} />}

      {selectedUser && <UserOverrideModal user={selectedUser} gardens={gardens} growth={overrideGrowth} setGrowth={setOverrideGrowth} garden={overrideGarden} setGarden={setOverrideGarden} onClose={()=>setSelectedUser(null)} onSave={saveUserOverride} onClear={clearUserOverride} saving={saving} />}
    </div>
  )
}

function Overview({ stats, users, queue, campaigns, onTab }: { stats: GardenStats; users: UserGarden[]; queue: Garden[]; campaigns: Campaign[]; onTab:(t:Tab)=>void }) {
  const activeCampaigns = campaigns.filter(c=>c.status==='active'||c.status==='scheduled').length
  const cards = [
    ['Usuários com jardim', stats.total, Users], ['Progresso médio', pct(stats.avg), Activity], ['Próximos de 100%', stats.near, Sprout], ['Jardins completos', stats.complete, CheckCircle2], ['Sem evolução há 7 dias', stats.inactive, History], ['Campanhas ativas/agendadas', activeCampaigns, Megaphone],
  ] as const
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label,value,Icon])=><div key={label} className="admin-card p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-wide text-ink-soft">{label}</p><Icon className="h-4 w-4 text-forest-500"/></div><p className="mt-3 font-serif text-3xl text-forest-900">{value}</p></div>)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="admin-card p-5"><div className="flex items-center justify-between"><div><h3 className="font-serif text-xl text-forest-900">Distribuição de progresso</h3><p className="text-xs text-ink-soft">Onde os usuários estão concentrados agora.</p></div><button className="admin-btn-secondary" onClick={()=>onTab('users')}>Ver usuários</button></div><ProgressBuckets users={users}/></div>
      <div className="admin-card p-5"><p className="text-xs uppercase tracking-wide text-ink-soft">Fila atual</p><h3 className="mt-1 font-serif text-xl text-forest-900">{queue[0]?.label ?? 'Nenhum jardim ativo'}</h3><p className="mt-2 text-sm text-ink-soft">Próximo: <strong>{queue[1]?.label ?? 'não definido'}</strong></p><p className="mt-3 text-sm text-ink-soft">Mais escolhido: <strong>{stats.popular}</strong></p><button className="admin-btn-secondary mt-4" onClick={()=>onTab('queue')}>Gerenciar fila</button></div>
    </div>
  </div>
}

function ProgressBuckets({ users }: {users:UserGarden[]}) {
  const groups = [[0,25],[26,50],[51,75],[76,99],[100,100]].map(([a,b]) => ({label:`${a}–${b}%`,count:users.filter(u=>u.progress_pct>=a&&u.progress_pct<=b).length}))
  const max=Math.max(1,...groups.map(g=>g.count))
  return <div className="mt-6 space-y-3">{groups.map(g=><div key={g.label} className="grid grid-cols-[70px_1fr_40px] items-center gap-3 text-xs"><span>{g.label}</span><div className="h-2 rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-600" style={{width:`${g.count/max*100}%`}}/></div><span className="text-right font-semibold">{g.count}</span></div>)}</div>
}

function UsersPanel({users,query,setQuery,onOpen}:{users:UserGarden[];query:string;setQuery:(v:string)=>void;onOpen:(u:UserGarden)=>void}) {
  return <div className="admin-card overflow-hidden"><div className="admin-toolbar m-4"><div className="relative min-w-[260px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-soft"/><input className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm" placeholder="Buscar usuário ou jardim..." value={query} onChange={e=>setQuery(e.target.value)}/></div><span className="text-xs text-ink-soft">{users.length} usuários</span></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-paper-soft text-left text-xs text-ink-soft"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Jardim</th><th className="px-4 py-3">Progresso</th><th className="px-4 py-3">Estágio</th><th className="px-4 py-3">Última evolução</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y divide-line">{users.map(u=><tr key={u.user_id} className="hover:bg-paper-soft/60"><td className="px-4 py-3"><p className="font-medium text-forest-900">{u.full_name||'Sem nome'}</p><p className="text-xs text-ink-soft">{u.email}</p></td><td className="px-4 py-3">{u.garden_label||'—'}{u.override_active&&<span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">ajuste manual</span>}</td><td className="px-4 py-3 min-w-[160px]"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-600" style={{width:pct(u.progress_pct)}}/></div><span className="text-xs font-semibold">{pct(u.progress_pct)}</span></div></td><td className="px-4 py-3 text-xs">{STAGE_LABEL[u.stage]??`Etapa ${u.stage}`}</td><td className="px-4 py-3 text-xs text-ink-soft">{fmtDate(u.last_activity)}</td><td className="px-4 py-3 text-right"><button className="admin-btn-secondary" onClick={()=>onOpen(u)}>Gerenciar</button></td></tr>)}</tbody></table></div></div>
}

function CatalogPanel({gardens,onUpdate,onCreate,saving}:{gardens:Garden[];onUpdate:(g:Garden,p:Partial<Garden>)=>Promise<void>;onCreate:(g:{slug:string;label:string;description:string;theme_index:number;cover_image:string;stage_images:string[]})=>Promise<void>;saving:boolean}) {
  const [open,setOpen]=useState(false)
  const nextIndex=gardens.length?Math.max(...gardens.map(g=>g.theme_index))+1:0
  const blank={slug:'',label:'',description:'',theme_index:nextIndex,cover_image:'',stage1:'',stage2:'',stage3:'',stage4:''}
  const [form,setForm]=useState(blank)
  const [busy,setBusy]=useState(false)
  function openForm(){ setForm({...blank,theme_index:nextIndex}); setOpen(true) }
  async function create(){
    if(!form.slug.trim()||!form.label.trim())return
    setBusy(true)
    await onCreate({slug:form.slug,label:form.label,description:form.description,theme_index:form.theme_index,cover_image:form.cover_image,stage_images:[form.stage1,form.stage2,form.stage3,form.stage4]})
    setBusy(false); setOpen(false)
  }
  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <p className="max-w-xl text-xs text-ink-soft">Um jardim novo entra como "Rascunho" (não aparece pra ninguém). Fotos + a configuração de água/fauna/luz continuam sendo um trabalho à parte — sem isso, o jardim usa a aparência de um dos 8 já existentes até ganhar a própria.</p>
      <button type="button" className="admin-btn-primary shrink-0" onClick={openForm}><Plus className="h-4 w-4"/>Novo jardim</button>
    </div>
    {open&&<div className="admin-card p-5">
      <div className="flex justify-between"><h3 className="font-serif text-xl text-forest-900">Cadastrar jardim</h3><button onClick={()=>setOpen(false)} aria-label="Fechar"><X className="h-4 w-4"/></button></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input label="Slug (identificador único, ex.: jardim-de-inverno)" value={form.slug} onChange={v=>setForm({...form,slug:v})}/>
        <Input label="Nome de exibição" value={form.label} onChange={v=>setForm({...form,label:v})}/>
        <Input label="Descrição editorial" value={form.description} onChange={v=>setForm({...form,description:v})}/>
        <label className="text-xs text-ink-soft">Índice do tema (posição interna, sugerido automaticamente)<input type="number" min="0" className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={form.theme_index} onChange={e=>setForm({...form,theme_index:Number(e.target.value)})}/></label>
        <Input label="Imagem de capa (URL)" value={form.cover_image} onChange={v=>setForm({...form,cover_image:v})}/>
        <div/>
        <Input label="Foto — recém-plantado (URL)" value={form.stage1} onChange={v=>setForm({...form,stage1:v})}/>
        <Input label="Foto — pegando (URL)" value={form.stage2} onChange={v=>setForm({...form,stage2:v})}/>
        <Input label="Foto — maduro (URL)" value={form.stage3} onChange={v=>setForm({...form,stage3:v})}/>
        <Input label="Foto — completo (URL)" value={form.stage4} onChange={v=>setForm({...form,stage4:v})}/>
      </div>
      <button className="admin-btn-primary mt-4" disabled={busy||saving||!form.slug.trim()||!form.label.trim()} onClick={()=>void create()}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Cadastrar como rascunho</button>
    </div>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{gardens.map(g=><article key={g.id} className="admin-card overflow-hidden"><div className="aspect-[16/8] bg-stone-100">{g.cover_image&&<img src={g.cover_image} alt="" className="h-full w-full object-cover"/>}</div><div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-ink-soft">{g.slug}</p><h3 className="font-serif text-xl text-forest-900">{g.label}</h3></div><span className="rounded-full bg-forest-50 px-2 py-1 text-[10px] text-forest-700">{STATUS_LABEL[g.status]}</span></div><p className="mt-2 line-clamp-2 text-xs text-ink-soft">{g.description||'Sem descrição editorial.'}</p><div className="mt-4 flex gap-2"><select className="flex-1 rounded-lg border border-line bg-white px-2 py-2 text-xs" value={g.status} disabled={saving} onChange={e=>void onUpdate(g,{status:e.target.value as GardenStatus})}>{Object.entries(STATUS_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><button className="admin-btn-secondary" disabled={saving} onClick={()=>void onUpdate(g,{release_at:new Date().toISOString(),status:'queued'})}>Fila</button></div></div></article>)}</div>
  </div>
}

function QueuePanel({queue,gardens,onMove,onMakeNext,onUpdate,saving}:{queue:Garden[];gardens:Garden[];onMove:(i:number,d:number)=>Promise<void>;onMakeNext:(g:Garden)=>Promise<void>;onUpdate:(g:Garden,p:Partial<Garden>)=>Promise<void>;saving:boolean}) {
  const outside=gardens.filter(g=>!queue.some(q=>q.id===g.id)&&g.status!=='archived')
  return <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="admin-card p-5"><div className="flex items-center justify-between"><div><h3 className="font-serif text-xl text-forest-900">Ordem dos próximos jardins</h3><p className="text-xs text-ink-soft">Reordenar não altera ciclos já atribuídos aos usuários.</p></div></div><div className="mt-4 space-y-2">{queue.map((g,i)=><div key={g.id} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-forest-50 text-xs font-bold text-forest-800">{i+1}</span>{g.cover_image&&<img src={g.cover_image} alt="" className="h-12 w-20 rounded-lg object-cover"/>}<div className="min-w-0 flex-1"><p className="truncate font-medium text-forest-900">{g.label}</p><p className="text-xs text-ink-soft">{i===0?'Atual':'Na fila'} · {g.release_at?fmtDate(g.release_at):'sem agendamento'}</p></div><div className="flex gap-1"><button className="admin-btn-secondary !p-2" disabled={saving||i===0} onClick={()=>void onMove(i,-1)} aria-label="Subir"><ChevronUp className="h-4 w-4"/></button><button className="admin-btn-secondary !p-2" disabled={saving||i===queue.length-1} onClick={()=>void onMove(i,1)} aria-label="Descer"><ChevronDown className="h-4 w-4"/></button>{i>0&&<button className="admin-btn-secondary" disabled={saving} onClick={()=>void onMakeNext(g)}>Definir como próximo</button>}</div></div>)}</div></div><div className="admin-card p-5"><h3 className="font-serif text-xl text-forest-900">Adicionar à fila</h3><p className="text-xs text-ink-soft">Jardins prontos, pausados ou em rascunho.</p><div className="mt-4 space-y-2">{outside.map(g=><div key={g.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"><span className="text-sm">{g.label}</span><button className="admin-btn-secondary" disabled={saving} onClick={()=>void onUpdate(g,{status:'queued',queue_position:queue.length+1})}>Adicionar</button></div>)}</div></div></div>
}

function CampaignPanel({campaigns,gardens,open,setOpen,reload,audit}:{campaigns:Campaign[];gardens:Garden[];open:boolean;setOpen:(v:boolean)=>void;reload:()=>Promise<void>;audit:(a:string,t:string,id?:string,m?:Record<string,unknown>)=>Promise<void>}) {
  const [form,setForm]=useState({name:'',garden_slug:'',campaign_type:'launch',audience:'all',headline:'',body:'',starts_at:'',ends_at:'',temporary_unlock:false})
  const [busy,setBusy]=useState(false)
  async function create(){ if(!form.name.trim())return;setBusy(true);const {data,error}=await supabase.from('garden_campaigns').insert({...form,garden_slug:form.garden_slug||null,starts_at:form.starts_at||null,ends_at:form.ends_at||null,status:form.starts_at?'scheduled':'draft'}).select('id').single();if(!error&&data){await audit('campaign.create','campaign',data.id,{name:form.name});setOpen(false);setForm({name:'',garden_slug:'',campaign_type:'launch',audience:'all',headline:'',body:'',starts_at:'',ends_at:'',temporary_unlock:false});await reload()}setBusy(false)}
  async function toggle(c:Campaign){setBusy(true);const status=c.status==='active'?'paused':'active';await supabase.from('garden_campaigns').update({status,updated_at:new Date().toISOString()}).eq('id',c.id);await audit('campaign.status','campaign',c.id,{status});await reload();setBusy(false)}
  return <div className="space-y-4"><div className="flex justify-end"><button className="admin-btn-primary" onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/>Nova campanha</button></div>{open&&<div className="admin-card p-5"><div className="flex justify-between"><h3 className="font-serif text-xl">Nova campanha de jardim</h3><button onClick={()=>setOpen(false)}><X className="h-4 w-4"/></button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Input label="Nome" value={form.name} onChange={v=>setForm({...form,name:v})}/><label className="text-xs text-ink-soft">Jardim<select className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={form.garden_slug} onChange={e=>setForm({...form,garden_slug:e.target.value})}><option value="">Todos / teaser</option>{gardens.map(g=><option key={g.slug} value={g.slug}>{g.label}</option>)}</select></label><label className="text-xs text-ink-soft">Tipo<select className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={form.campaign_type} onChange={e=>setForm({...form,campaign_type:e.target.value})}><option value="launch">Lançamento</option><option value="featured">Destaque</option><option value="seasonal">Sazonal</option><option value="reactivation">Retorno</option><option value="achievement">Conquista</option><option value="prelaunch">Pré-lançamento</option></select></label><label className="text-xs text-ink-soft">Público<select className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={form.audience} onChange={e=>setForm({...form,audience:e.target.value})}><option value="all">Todos</option><option value="completed_one">Concluiu pelo menos 1</option><option value="at_100">Está em 100%</option><option value="inactive">Inativos</option><option value="new_users">Novos usuários</option><option value="garden_users">Usuários de um jardim</option></select></label><Input label="Título" value={form.headline} onChange={v=>setForm({...form,headline:v})}/><Input label="Texto" value={form.body} onChange={v=>setForm({...form,body:v})}/><Input label="Início" type="datetime-local" value={form.starts_at} onChange={v=>setForm({...form,starts_at:v})}/><Input label="Fim" type="datetime-local" value={form.ends_at} onChange={v=>setForm({...form,ends_at:v})}/></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.temporary_unlock} onChange={e=>setForm({...form,temporary_unlock:e.target.checked})}/>Desbloqueio temporário durante a campanha</label><button className="admin-btn-primary mt-4" disabled={busy} onClick={()=>void create()}>{busy?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Salvar campanha</button></div>}<div className="grid gap-3 md:grid-cols-2">{campaigns.map(c=><article key={c.id} className="admin-card p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-wide text-ink-soft">{c.campaign_type} · {c.audience}</p><h3 className="font-serif text-xl text-forest-900">{c.name}</h3></div><span className="rounded-full bg-forest-50 px-2 py-1 text-[10px] text-forest-700">{c.status}</span></div><p className="mt-2 text-sm">{c.headline}</p><p className="mt-1 text-xs text-ink-soft">{c.body}</p><p className="mt-3 text-xs text-ink-soft">{fmtDate(c.starts_at)} → {fmtDate(c.ends_at)}</p><button className="admin-btn-secondary mt-4" disabled={busy} onClick={()=>void toggle(c)}>{c.status==='active'?'Pausar':'Ativar'}</button></article>)}</div></div>
}

function RulesPanel({settings,setSettings,save,saving}:{settings:Settings;setSettings:(s:Settings)=>void;save:()=>Promise<void>;saving:boolean}) {
  return <div className="admin-card max-w-3xl p-6"><h3 className="font-serif text-2xl text-forest-900">Regras de crescimento e distribuição</h3><p className="mt-1 text-sm text-ink-soft">A fila global já está operacional. Livre escolha e híbrido ficam registrados como política para a experiência de seleção do usuário.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs text-ink-soft">Modo de entrega<select className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={settings.release_mode} onChange={e=>setSettings({...settings,release_mode:e.target.value as Settings['release_mode']})}><option value="global">Fila global</option><option value="free">Livre escolha</option><option value="hybrid">Híbrido</option></select></label><label className="text-xs text-ink-soft">Pontos por ciclo<input type="number" className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={settings.points_per_cycle} onChange={e=>setSettings({...settings,points_per_cycle:Number(e.target.value)})}/></label><label className="text-xs text-ink-soft">Limite diário (opcional)<input type="number" className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={settings.daily_growth_cap??''} onChange={e=>setSettings({...settings,daily_growth_cap:e.target.value?Number(e.target.value):null})}/><span className="mt-1 block text-[10px] text-amber-700">Ainda não aplicado no cálculo — fica salvo, mas não limita o crescimento hoje.</span></label><label className="text-xs text-ink-soft">Marcos visuais<input className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={settings.stage_thresholds.join(', ')} onChange={e=>setSettings({...settings,stage_thresholds:e.target.value.split(',').map(v=>Number(v.trim())).filter(Number.isFinite)})}/></label></div><button className="admin-btn-primary mt-6" disabled={saving} onClick={()=>void save()}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Salvar regras</button></div>
}

function AnalyticsPanel({users,gardens}:{users:UserGarden[];gardens:Garden[]}) {
  const stages=[0,1,2,3,4,5,6].map(s=>({s,count:users.filter(u=>u.stage>=s).length}))
  return <div className="grid gap-4 xl:grid-cols-[1fr_1fr]"><div className="admin-card p-5"><h3 className="font-serif text-xl text-forest-900">Funil de evolução</h3><div className="mt-5 space-y-3">{stages.map(x=><div key={x.s}><div className="mb-1 flex justify-between text-xs"><span>{STAGE_LABEL[x.s]}</span><strong>{x.count}</strong></div><div className="h-7 rounded-lg bg-forest-50"><div className="grid h-full place-items-center rounded-lg bg-forest-600 text-[10px] text-white" style={{width:`${users.length?Math.max(8,x.count/users.length*100):0}%`}}>{users.length?Math.round(x.count/users.length*100):0}%</div></div></div>)}</div></div><div className="admin-card p-5"><h3 className="font-serif text-xl text-forest-900">Uso por jardim</h3><div className="mt-5 space-y-3">{gardens.map(g=>{const count=users.filter(u=>u.garden_slug===g.slug).length;const complete=users.filter(u=>u.garden_slug===g.slug&&u.stage===6).length;return <div key={g.slug} className="rounded-xl border border-line p-3"><div className="flex justify-between"><span className="text-sm font-medium">{g.label}</span><span className="text-xs text-ink-soft">{count} usuários</span></div><p className="mt-1 text-xs text-ink-soft">{count?Math.round(complete/count*100):0}% no estágio completo</p></div>})}</div></div></div>
}

function HistoryPanel({rows}:{rows:AuditRow[]}) { return <div className="admin-card overflow-hidden"><div className="p-5"><h3 className="font-serif text-xl text-forest-900">Histórico administrativo</h3><p className="text-xs text-ink-soft">As últimas 100 alterações do módulo.</p></div><div className="divide-y divide-line">{rows.map(r=><div key={r.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[170px_1fr_160px]"><span className="text-xs text-ink-soft">{fmtDate(r.created_at)}</span><span className="text-sm"><strong>{r.action}</strong> · {r.entity_type}{r.entity_id?` · ${r.entity_id}`:''}</span><span className="truncate text-right text-[10px] text-ink-soft">{Object.keys(r.metadata??{}).length?JSON.stringify(r.metadata):''}</span></div>)}</div></div> }

function UserOverrideModal({user,gardens,growth,setGrowth,garden,setGarden,onClose,onSave,onClear,saving}:{user:UserGarden;gardens:Garden[];growth:string;setGrowth:(v:string)=>void;garden:string;setGarden:(v:string)=>void;onClose:()=>void;onSave:()=>Promise<void>;onClear:()=>Promise<void>;saving:boolean}) {
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs text-ink-soft">Controle manual</p><h3 className="font-serif text-2xl text-forest-900">{user.full_name||user.email}</h3></div><button onClick={onClose}><X className="h-5 w-5"/></button></div><div className="mt-5 grid gap-4"><label className="text-xs text-ink-soft">Crescimento total<input type="number" min="0" className="mt-1 w-full rounded-xl border border-line p-2.5 text-sm" value={growth} onChange={e=>setGrowth(e.target.value)}/><span className="mt-1 block">Atual: {user.total_growth}. Cada 60 unidades inicia um novo ciclo.</span></label><label className="text-xs text-ink-soft">Forçar jardim<select className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={garden} onChange={e=>setGarden(e.target.value)}><option value="">Seguir fila</option>{gardens.filter(g=>g.status!=='archived').map(g=><option key={g.slug} value={g.slug}>{g.label}</option>)}</select></label></div><div className="mt-6 flex flex-wrap justify-between gap-2"><button className="admin-btn-secondary text-red-700" disabled={saving} onClick={()=>void onClear()}>Remover ajuste</button><div className="flex gap-2"><button className="admin-btn-secondary" onClick={onClose}>Cancelar</button><button className="admin-btn-primary" disabled={saving} onClick={()=>void onSave()}>{saving?<Loader2 className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}Aplicar</button></div></div></div></div>
}

function Input({label,value,onChange,type='text'}:{label:string;value:string;onChange:(v:string)=>void;type?:string}) { return <label className="text-xs text-ink-soft">{label}<input type={type} className="mt-1 w-full rounded-xl border border-line bg-white p-2.5 text-sm" value={value} onChange={e=>onChange(e.target.value)}/></label> }
