import { Loader2 } from 'lucide-react'
import type { DrawerTab, User360 } from './adminUsersModel'
import { PLAN_LABELS } from '../../lib/planConstants'

// Abas somente-leitura da Ficha 360º (Etapa 1). Recebem o retrato agregado
// vindo da RPC admin_user_360 — sem texto livre de diário nem conteúdo privado.

function fmtDate(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
function fmtDateTime(v: string | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}
function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return '—'
  const cur = (currency || 'BRL').toUpperCase()
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format(amount) }
  catch { return `${cur} ${amount.toFixed(2)}` }
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-stone-50 border border-line rounded-xl p-3">
      <p className="text-[10px] text-stone-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-forest-900">{value}</p>
      {hint && <p className="text-[10px] text-stone-400 mt-0.5">{hint}</p>}
    </div>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-stone-50 border border-line p-4 text-xs text-stone-500">{children}</p>
}
function TagBars({ items }: { items: { label: string; count: number }[] }) {
  if (!items?.length) return <Empty>Sem marcadores registrados nos últimos meses.</Empty>
  const max = Math.max(...items.map(i => i.count), 1)
  return (
    <div className="space-y-2">
      {items.map(i => (
        <div key={i.label} className="grid grid-cols-[1fr_auto_90px] items-center gap-3 text-xs">
          <span className="text-ink truncate">{i.label}</span>
          <span className="text-stone-400 tabular-nums">{i.count}</span>
          <span className="h-1.5 rounded-full bg-[#edf0e8] overflow-hidden">
            <span className="block h-full rounded-full bg-forest-700" style={{ width: `${(i.count / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export default function AdminUser360Tabs({ tab, data, loading, error }: { tab: DrawerTab; data: User360 | null; loading: boolean; error?: string | null }) {
  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-stone-400 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Carregando dados do usuário…</div>
  }
  if (error) {
    return /not_?authorized|not authorized/i.test(error)
      ? <Empty>Sessão sem verificação em duas etapas (AAL2). Saia e entre de novo no painel para ver o retrato do usuário.</Empty>
      : <Empty>Não foi possível carregar o retrato do usuário: {error}</Empty>
  }
  if (!data) {
    return <Empty>O retrato agregado ainda não está disponível para este usuário.</Empty>
  }

  if (tab === 'jornada') {
    const stages: { label: string; done: boolean; at?: string | null }[] = [
      { label: 'Cadastro', done: true, at: data.header?.last_seen_at ? undefined : undefined },
      { label: 'Primeiro check-in', done: (data.checkins?.total ?? 0) > 0, at: data.checkins?.first_at },
      { label: 'Primeira entrada no diário', done: (data.diary?.total ?? 0) > 0, at: data.diary?.first_at },
      { label: 'Primeiro questionário', done: (data.questionnaires?.total ?? 0) > 0, at: data.questionnaires?.last_at },
      { label: 'Primeiro relatório', done: (data.reports?.total ?? 0) > 0, at: data.reports?.last_generated_at },
      { label: 'Plano de autocuidado', done: (data.care_plans?.generated ?? 0) > 0, at: data.care_plans?.last_generated_at },
      { label: 'Uso recorrente (diário nos últimos 30 dias)', done: (data.diary?.last_30d ?? 0) >= 2, at: data.diary?.last_at },
    ]
    return (
      <div className="space-y-2">
        <p className="text-xs text-stone-400 mb-2">Onde este usuário está na jornada de cuidado.</p>
        {stages.map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-line bg-stone-50 p-3">
            <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s.done ? 'bg-forest-700 text-white' : 'bg-stone-200 text-stone-400'}`}>{s.done ? '✓' : ''}</span>
            <span className="flex-1 text-sm text-ink">{s.label}</span>
            <span className="text-[11px] text-stone-400">{s.done ? fmtDate(s.at) : 'ainda não'}</span>
          </div>
        ))}
      </div>
    )
  }

  if (tab === 'diario') {
    const d = data.diary
    if (!d || d.total === 0) return <Empty>Nenhuma entrada de diário registrada.</Empty>
    return (
      <Grid>
        <Stat label="Total de entradas" value={d.total} />
        <Stat label="Nos últimos 30 dias" value={d.last_30d} />
        <Stat label="Dias com registro" value={d.active_days} />
        <Stat label="Aprofundamentos" value={d.deepenings} />
        <Stat label="Primeira entrada" value={fmtDate(d.first_at)} />
        <Stat label="Última entrada" value={fmtDate(d.last_at)} />
      </Grid>
    )
  }

  if (tab === 'checkins') {
    const c = data.checkins
    if (!c || c.total === 0) return <Empty>Nenhum check-in registrado.</Empty>
    return (
      <Grid>
        <Stat label="Total de check-ins" value={c.total} />
        <Stat label="Nos últimos 30 dias" value={c.last_30d} />
        <Stat label="Dias com check-in" value={c.active_days} />
        <Stat label="Primeiro" value={fmtDate(c.first_at)} />
        <Stat label="Último" value={fmtDate(c.last_at)} />
      </Grid>
    )
  }

  if (tab === 'mapa') {
    const m = data.mapa
    return (
      <div className="space-y-4">
        <Grid>
          <Stat label="Humor médio (90 dias)" value={m?.avg_mood_90d != null ? `${m.avg_mood_90d} / 5` : '—'} />
          <Stat label="Marcadores emocionais" value={(m?.top_emotions?.length ?? 0)} hint="distintos, 6 meses" />
        </Grid>
        <div>
          <p className="text-xs font-semibold text-stone-700 mb-2">Emoções mais registradas</p>
          <TagBars items={m?.top_emotions ?? []} />
        </div>
        <div>
          <p className="text-xs font-semibold text-stone-700 mb-2">Contextos mais frequentes</p>
          <TagBars items={m?.top_contexts ?? []} />
        </div>
        <div>
          <p className="text-xs font-semibold text-stone-700 mb-2">Necessidades mais frequentes</p>
          <TagBars items={m?.top_needs ?? []} />
        </div>
        <p className="text-[10px] text-stone-400">Só sinais estruturados — o texto livre do diário nunca é exibido no Admin.</p>
      </div>
    )
  }

  if (tab === 'questionarios') {
    const q = data.questionnaires
    if (!q || q.total === 0) return <Empty>Nenhum questionário iniciado.</Empty>
    return (
      <Grid>
        <Stat label="Iniciados" value={q.total} />
        <Stat label="Concluídos" value={q.completed} />
        <Stat label="Último início" value={fmtDate(q.last_at)} />
        <Stat label="Última conclusão" value={fmtDate(q.last_completed_at)} />
      </Grid>
    )
  }

  if (tab === 'autocuidado') {
    const p = data.care_plans
    if (!p || p.total === 0) return <Empty>Nenhum plano de autocuidado gerado.</Empty>
    return (
      <Grid>
        <Stat label="Planos gerados" value={p.generated} />
        <Stat label="Pendentes" value={p.pending} />
        <Stat label="Com falha" value={p.failed} />
        <Stat label="Total no histórico" value={p.total} />
        <Stat label="Último gerado" value={fmtDate(p.last_generated_at)} />
        <Stat label="Última revisão" value={fmtDate(p.last_reviewed_at)} />
      </Grid>
    )
  }

  if (tab === 'conteudos') {
    const c = data.content
    return (
      <Grid>
        <Stat label="Artigos lidos" value={c?.articles_read ?? 0} />
        <Stat label="Última leitura" value={fmtDate(c?.last_read_at)} />
        <Stat label="Conteúdos guiados recebidos" value={c?.guided_sent ?? 0} />
        <Stat label="Abertos" value={c?.guided_opened ?? 0} />
        <Stat label="Concluídos" value={c?.guided_completed ?? 0} />
      </Grid>
    )
  }

  if (tab === 'relatorios') {
    const r = data.reports
    if (!r || r.total === 0) return <Empty>Nenhum relatório gerado para este usuário.</Empty>
    return (
      <Grid>
        <Stat label="Total" value={r.total} />
        <Stat label="Semanais" value={r.weekly} />
        <Stat label="Mensais" value={r.monthly} />
        <Stat label="Gerados com sucesso" value={r.generated} />
        <Stat label="Em processamento" value={r.building} />
        <Stat label="Com falha" value={r.failed} hint={r.failed > 0 ? 'requer atenção' : undefined} />
        <Stat label="Último gerado" value={fmtDate(r.last_generated_at)} />
      </Grid>
    )
  }

  if (tab === 'historico') {
    const h = data.history
    const s = data.subscription
    return (
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-stone-700 mb-2">Minha História</p>
          <Grid>
            <Stat label="Marcos pessoais" value={h?.milestones ?? 0} />
            <Stat label="Meses em destaque" value={h?.highlighted_months ?? 0} />
            <Stat label="Meses ocultos" value={h?.hidden_months ?? 0} />
            <Stat label="Mudanças de plano" value={data.plan_history_count ?? 0} />
          </Grid>
        </div>
        {s && (
          <div>
            <p className="text-xs font-semibold text-stone-700 mb-2">Assinatura (referência — fonte é o Stripe)</p>
            <Grid>
              <Stat label="Plano" value={PLAN_LABELS[s.plan_key ?? ''] ?? s.plan_key ?? '—'} />
              <Stat label="Status" value={s.status ?? '—'} />
              <Stat label="Renova em" value={fmtDate(s.current_period_end)} />
              <Stat label="Cancelamento agendado" value={s.cancel_at_period_end ? 'Sim' : 'Não'} />
            </Grid>
          </div>
        )}
        {(data.subscription_events?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-semibold text-stone-700 mb-2">Eventos recentes de assinatura</p>
            <div className="space-y-1.5">
              {data.subscription_events!.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-stone-50 px-3 py-2 text-xs">
                  <span className="text-ink">{e.event_type}{e.previous_plan && e.new_plan ? ` · ${e.previous_plan} → ${e.new_plan}` : ''}</span>
                  <span className="text-stone-400">{fmtDateTime(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {(data.payment_events?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs font-semibold text-stone-700 mb-2">Pagamentos recentes</p>
            <div className="space-y-1.5">
              {data.payment_events!.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-stone-50 px-3 py-2 text-xs">
                  <span className="text-ink">{e.description || e.type || 'pagamento'} · <span className={e.status === 'failed' ? 'text-red-600' : 'text-stone-500'}>{e.status}</span></span>
                  <span className="text-stone-400">{fmtMoney(e.amount, e.currency)} · {fmtDate(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {!h && !s && (data.subscription_events?.length ?? 0) === 0 && (data.payment_events?.length ?? 0) === 0 && (
          <Empty>Sem histórico registrado ainda.</Empty>
        )}
      </div>
    )
  }

  return null
}
