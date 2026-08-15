import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles, Edit2, Copy, Send, Play, Pause, Archive,
  List, ChevronDown, ChevronUp, X, Check, AlertTriangle,
  Clock, Zap, Users, Filter, RefreshCw, Mail, Info
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface CustomEmailTemplate {
  id: string
  name: string
  objective: string
  target_audience: string
  tone: string
  email_type: string
  related_plan: string
  ai_instruction: string
  cta_label: string
  cta_url: string
  subject: string
  preheader: string
  body_html: string
  footer_text: string
  internal_notes: string
  status: 'draft' | 'active' | 'paused' | 'archived'
  is_ai_generated: boolean
  ai_prompt: string
  created_by_admin_id: string | null
  created_at: string
  updated_at: string
}

interface EmailAutomation {
  id: string
  template_id: string
  name: string
  trigger_type: 'manual' | 'scheduled' | 'recurring' | 'event' | 'segment'
  trigger_event: string | null
  schedule_type: string | null
  scheduled_at: string | null
  recurrence_rule: string | null
  target_segment: Record<string, unknown>
  conditions: Record<string, unknown>
  exclusion_rules: Record<string, unknown>
  cooldown_days: number
  max_sends_per_month: number
  status: 'draft' | 'active' | 'paused' | 'archived'
  last_run_at: string | null
  next_run_at: string | null
  created_by_admin_id: string | null
  created_at: string
  updated_at: string
}

interface EmailLogItem {
  id: string
  template_id: string | null
  automation_id: string | null
  user_id: string | null
  to_email: string | null
  email: string | null
  subject: string | null
  status: string
  trigger_reason: string | null
  error_message: string | null
  sent_at: string | null
  created_at: string
}

interface AIResult {
  subject: string
  preheader: string
  body: string
  ctaLabel: string
  ctaUrl: string
  alternativeSubjects: string[]
  notes: string
}

type EditorStep = 'form' | 'result' | 'preview' | 'automation' | 'conditions'

// ─── Constantes ──────────────────────────────────────────────────────────────

const OBJECTIVES = [
  { value: 'boas-vindas', label: 'Boas-vindas' },
  { value: 'primeiro-checkin', label: 'Incentivar primeiro check-in' },
  { value: 'diario-emocional', label: 'Incentivar diário emocional' },
  { value: 'reengajamento', label: 'Reengajar usuário inativo' },
  { value: 'relatorio-disponivel', label: 'Avisar relatório disponível' },
  { value: 'autocuidado-disponivel', label: 'Avisar plano de autocuidado disponível' },
  { value: 'orientacao-respondida', label: 'Avisar orientação respondida' },
  { value: 'suporte-respondido', label: 'Avisar resposta de suporte' },
  { value: 'recurso-plano', label: 'Explicar recurso do plano' },
  { value: 'institucional', label: 'Comunicação institucional' },
  { value: 'assinatura', label: 'Aviso de assinatura/plano' },
  { value: 'conteudo', label: 'Conteúdo recomendado' },
  { value: 'outro', label: 'Outro' },
]

const AUDIENCES = [
  { value: 'all', label: 'Todos os usuários' },
  { value: 'free', label: 'Gratuito' },
  { value: 'essential', label: 'Essencial' },
  { value: 'plus', label: 'Plus' },
  { value: 'active', label: 'Usuários ativos' },
  { value: 'inactive', label: 'Usuários inativos' },
  { value: 'no-checkin', label: 'Usuários que nunca fizeram check-in' },
  { value: 'no-diary', label: 'Usuários que nunca escreveram no diário' },
  { value: 'report-available', label: 'Usuários com relatório disponível' },
  { value: 'selfcare-available', label: 'Usuários com plano de autocuidado disponível' },
  { value: 'guidance-answered', label: 'Usuários com orientação respondida' },
  { value: 'payment-pending', label: 'Usuários com pagamento pendente' },
  { value: 'cancel-scheduled', label: 'Usuários com cancelamento agendado' },
  { value: 'custom', label: 'Segmento personalizado' },
]

const TONES = [
  { value: 'acolhedor', label: 'Acolhedor' },
  { value: 'leve', label: 'Leve' },
  { value: 'direto', label: 'Direto' },
  { value: 'institucional', label: 'Institucional' },
  { value: 'reengajamento-suave', label: 'Reengajamento suave' },
  { value: 'explicativo', label: 'Explicativo' },
  { value: 'conversao-sem-pressao', label: 'Conversão sem pressão' },
]

const CTA_OPTIONS = [
  { value: 'Fazer check-in', label: 'Fazer check-in' },
  { value: 'Abrir diário', label: 'Abrir diário' },
  { value: 'Ver relatório', label: 'Ver relatório' },
  { value: 'Ver plano de autocuidado', label: 'Ver plano de autocuidado' },
  { value: 'Acessar orientação', label: 'Acessar orientação' },
  { value: 'Acessar suporte', label: 'Acessar suporte' },
  { value: 'Conhecer planos', label: 'Conhecer planos' },
  { value: 'Ler conteúdo recomendado', label: 'Ler conteúdo recomendado' },
]

const LINK_OPTIONS = [
  { value: '/diario?modo=checkin', label: '/diario?modo=checkin — Fazer check-in' },
  { value: '/diario', label: '/diario — Abrir diário' },
  { value: '/meu-relatorio', label: '/meu-relatorio — Relatório' },
  { value: '/plano-de-autocuidado', label: '/plano-de-autocuidado' },
  { value: '/orientacao', label: '/orientacao' },
  { value: '/suporte', label: '/suporte' },
  { value: '/meu-plano', label: '/meu-plano' },
  { value: '/conteudos-guiados', label: '/conteudos-guiados' },
]

const EMAIL_TYPES = [
  { value: 'reengajamento', label: 'Reengajamento' },
  { value: 'transacional', label: 'Transacional' },
  { value: 'conteudo', label: 'Conteúdo' },
  { value: 'produto', label: 'Produto' },
  { value: 'assinatura', label: 'Assinatura' },
  { value: 'suporte', label: 'Suporte' },
  { value: 'sistema', label: 'Sistema' },
]

const TRIGGER_EVENTS = [
  { value: 'account_created', label: 'Usuário criou conta' },
  { value: 'first_login', label: 'Usuário fez primeiro login' },
  { value: 'no_checkin_after_signup', label: 'Sem check-in após X dias do cadastro' },
  { value: 'inactive_checkin', label: 'Usuário há X dias sem check-in' },
  { value: 'inactive_diary', label: 'Usuário há X dias sem diário' },
  { value: 'inactive_access', label: 'Usuário há X dias sem acessar' },
  { value: 'weekly_report_available', label: 'Relatório semanal disponível' },
  { value: 'monthly_report_available', label: 'Relatório mensal disponível' },
  { value: 'selfcare_available', label: 'Plano de autocuidado disponível' },
  { value: 'guidance_answered', label: 'Orientação respondida' },
  { value: 'support_replied', label: 'Suporte respondido' },
  { value: 'payment_confirmed', label: 'Pagamento confirmado' },
  { value: 'payment_failed', label: 'Pagamento recusado' },
  { value: 'subscription_cancelled', label: 'Assinatura cancelada' },
  { value: 'downgrade_scheduled', label: 'Downgrade agendado' },
  { value: 'upgrade_confirmed', label: 'Upgrade confirmado' },
]

const TEMPLATE_VARIABLES = [
  { variable: '{{nome}}', description: 'Nome do usuário (fallback: "Olá")' },
  { variable: '{{email}}', description: 'E-mail do usuário' },
  { variable: '{{plano}}', description: 'Plano atual (Gratuito/Essencial/Plus)' },
  { variable: '{{data_atual}}', description: 'Data de hoje' },
  { variable: '{{app_url}}', description: 'URL base do app' },
  { variable: '{{checkin_url}}', description: 'Link para fazer check-in' },
  { variable: '{{diario_url}}', description: 'Link para abrir diário' },
  { variable: '{{relatorio_url}}', description: 'Link para o relatório' },
  { variable: '{{mapa_url}}', description: 'Link para o mapa emocional' },
  { variable: '{{plano_autocuidado_url}}', description: 'Link para plano de autocuidado' },
  { variable: '{{orientacao_url}}', description: 'Link para orientação' },
  { variable: '{{suporte_url}}', description: 'Link para suporte' },
  { variable: '{{meu_plano_url}}', description: 'Link para gerenciar plano' },
  { variable: '{{dias_sem_checkin}}', description: 'Dias desde o último check-in' },
  { variable: '{{dias_sem_diario}}', description: 'Dias desde o último diário' },
  { variable: '{{nome_relatorio}}', description: 'Nome do relatório disponível' },
]

const APP_URL = 'https://www.avidanaocolabora.com'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Rascunho', color: 'text-ink-soft bg-paper-200' },
  active:   { label: 'Ativo',    color: 'text-green-700 bg-green-50' },
  paused:   { label: 'Pausado',  color: 'text-amber-700 bg-amber-50' },
  archived: { label: 'Arquivado', color: 'text-red-700 bg-red-50' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function buildEmailHtml(subject: string, preheader: string, body: string, ctaLabel: string, ctaUrl: string, footer: string) {
  const fullCtaUrl = ctaUrl.startsWith('http') ? ctaUrl : `${APP_URL}${ctaUrl}`
  const paragraphs = body
    .split('\n\n')
    .map(p => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`)
    .join('')
  const footerText = footer || 'Você está recebendo este e-mail porque tem uma conta em A Vida Não Colabora.<br><a href="{{app_url}}/preferencias-email" style="color:#6b7280">Gerenciar preferências de e-mail</a>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:'Georgia',serif">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;color:#f5f5f0">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:32px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
        <tr>
          <td style="background:#2f4232;padding:28px 40px;text-align:center">
            <span style="color:#ffffff;font-family:'Georgia',serif;font-size:22px;font-weight:normal;letter-spacing:.5px">A Vida Não Colabora</span>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;color:#1a1a1a">
            ${paragraphs}
            ${ctaLabel && ctaUrl ? `
            <div style="text-align:center;margin:32px 0">
              <a href="${fullCtaUrl}" style="display:inline-block;background:#2f4232;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-family:sans-serif">${ctaLabel}</a>
            </div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;font-family:sans-serif;line-height:1.6">
            ${footerText}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminEmailCreatorIA() {
  const [templates, setTemplates] = useState<CustomEmailTemplate[]>([])
  const [automations, setAutomations] = useState<EmailAutomation[]>([])
  const [logs, setLogs] = useState<EmailLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'editor' | 'logs'>('list')
  const [editing, setEditing] = useState<CustomEmailTemplate | null>(null)
  const [logFilter, setLogFilter] = useState<string>('')
  const [confirmActivate, setConfirmActivate] = useState<string | null>(null)

  // ── Carregar dados ──────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: tpls }, { data: auts }, { data: lgLogs }] = await Promise.all([
      supabase.from('custom_email_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('email_automations').select('*').order('created_at', { ascending: false }),
      supabase.from('email_logs').select('id,template_id,automation_id,user_id,to_email,email,subject,status,trigger_reason,error_message,sent_at,created_at')
        .or('trigger_reason.like.template_ia%,automation_id.not.is.null,status.eq.test_send')
        .order('created_at', { ascending: false }).limit(200),
    ])
    setTemplates((tpls ?? []) as CustomEmailTemplate[])
    setAutomations((auts ?? []) as EmailAutomation[])
    setLogs((lgLogs ?? []) as EmailLogItem[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Salvar template ─────────────────────────────────────────────────────────

  async function saveTemplate(data: Partial<CustomEmailTemplate>) {
    const { data: user } = await supabase.auth.getUser()
    if (editing?.id) {
      const { data: upd } = await supabase
        .from('custom_email_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
        .select('*').single()
      if (upd) {
        setTemplates(prev => prev.map(t => t.id === editing.id ? (upd as CustomEmailTemplate) : t))
        setEditing(upd as CustomEmailTemplate)
      }
    } else {
      const { data: ins } = await supabase
        .from('custom_email_templates')
        .insert({ ...data, created_by_admin_id: user.user?.id, status: 'draft' })
        .select('*').single()
      if (ins) {
        setTemplates(prev => [ins as CustomEmailTemplate, ...prev])
        setEditing(ins as CustomEmailTemplate)
      }
    }
  }

  // ── Duplicar template ───────────────────────────────────────────────────────

  async function duplicateTemplate(tpl: CustomEmailTemplate) {
    const { data: user } = await supabase.auth.getUser()
    const { data: ins } = await supabase
      .from('custom_email_templates')
      .insert({
        ...tpl,
        id: undefined,
        name: `${tpl.name} (cópia)`,
        status: 'draft',
        created_by_admin_id: user.user?.id,
        created_at: undefined,
        updated_at: undefined,
      })
      .select('*').single()
    if (ins) setTemplates(prev => [ins as CustomEmailTemplate, ...prev])
  }

  // ── Alterar status ──────────────────────────────────────────────────────────

  async function changeStatus(id: string, status: CustomEmailTemplate['status']) {
    await supabase.from('custom_email_templates').update({ status }).eq('id', id)
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    setConfirmActivate(null)
  }

  // ── Arquivar ────────────────────────────────────────────────────────────────

  async function archiveTemplate(id: string) {
    await changeStatus(id, 'archived')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-serif text-forest-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-plus" />
            Criador de templates com IA
          </h2>
          <p className="text-sm text-ink-soft mt-1">
            Crie e-mails alinhados ao tom da marca, revise o conteúdo e defina quando devem ser enviados.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setEditing(null); setView('editor') }}
            className="flex items-center gap-1.5 px-4 py-2 bg-forest-700 text-white rounded-lg text-sm hover:bg-forest-800 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Criar template com IA
          </button>
          <button
            onClick={() => setView('logs')}
            className="flex items-center gap-1.5 px-4 py-2 border border-line text-forest-900 rounded-lg text-sm hover:bg-paper-100 transition-colors"
          >
            <List className="w-4 h-4" />
            Ver logs
          </button>
        </div>
      </div>

      {/* Aviso anti-spam */}
      <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 items-start">
        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-800">
          Evite enviar muitos e-mails para o mesmo usuário. E-mails de reengajamento devem ser usados com moderação.
          Cada automação tem cooldown configurável para evitar spam.
        </p>
      </div>

      {view === 'list' && (
        <TemplateList
          templates={templates}
          automations={automations}
          loading={loading}
          confirmActivate={confirmActivate}
          onEdit={tpl => { setEditing(tpl); setView('editor') }}
          onDuplicate={duplicateTemplate}
          onChangeStatus={changeStatus}
          onArchive={archiveTemplate}
          onConfirmActivate={setConfirmActivate}
          onViewLogs={() => setView('logs')}
        />
      )}

      {view === 'editor' && (
        <TemplateEditor
          initial={editing}
          automations={automations.filter(a => a.template_id === editing?.id)}
          onSave={saveTemplate}
          onClose={() => setView('list')}
          onSaved={tpl => { setEditing(tpl); load() }}
        />
      )}

      {view === 'logs' && (
        <LogsPanel
          logs={logs}
          templates={templates}
          filter={logFilter}
          onFilterChange={setLogFilter}
          onBack={() => setView('list')}
          onRefresh={load}
        />
      )}
    </div>
  )
}

// ─── Lista de templates ───────────────────────────────────────────────────────

function TemplateList({
  templates, automations, loading, confirmActivate,
  onEdit, onDuplicate, onChangeStatus, onArchive, onConfirmActivate, onViewLogs: _onViewLogs,
}: {
  templates: CustomEmailTemplate[]
  automations: EmailAutomation[]
  loading: boolean
  confirmActivate: string | null
  onEdit: (t: CustomEmailTemplate) => void
  onDuplicate: (t: CustomEmailTemplate) => void
  onChangeStatus: (id: string, s: CustomEmailTemplate['status']) => void
  onArchive: (id: string) => void
  onConfirmActivate: (id: string | null) => void
  onViewLogs: () => void
}) {
  const visible = templates.filter(t => t.status !== 'archived')

  if (loading) return <div className="text-center py-16 text-ink-soft">Carregando templates…</div>

  if (visible.length === 0) return (
    <div className="text-center py-16 text-ink-soft">
      <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium text-forest-900">Nenhum template criado ainda.</p>
      <p className="text-sm mt-1">Clique em "Criar template com IA" para começar.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {visible.map(tpl => {
        const aut = automations.find(a => a.template_id === tpl.id)
        const st = STATUS_LABELS[tpl.status] ?? STATUS_LABELS.draft
        return (
          <div key={tpl.id} className="bg-white border border-line rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-forest-900 truncate">{tpl.name}</span>
                {tpl.is_ai_generated && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    <Sparkles className="w-3 h-3" /> IA
                  </span>
                )}
                <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <div className="flex gap-3 mt-1 text-xs text-ink-soft flex-wrap">
                <span>{EMAIL_TYPES.find(t => t.value === tpl.email_type)?.label ?? tpl.email_type}</span>
                <span>·</span>
                <span>{AUDIENCES.find(a => a.value === tpl.target_audience)?.label ?? tpl.target_audience}</span>
                {aut && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {aut.trigger_type === 'manual' ? 'Manual' : aut.name}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>Editado {formatDate(tpl.updated_at)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <button onClick={() => onEdit(tpl)} title="Editar"
                className="p-2 hover:bg-paper-100 rounded-lg transition-colors text-ink-soft hover:text-forest-900">
                <Edit2 className="w-4 h-4" />
              </button>
              <button onClick={() => onDuplicate(tpl)} title="Duplicar"
                className="p-2 hover:bg-paper-100 rounded-lg transition-colors text-ink-soft hover:text-forest-900">
                <Copy className="w-4 h-4" />
              </button>

              {tpl.status === 'active' ? (
                <button onClick={() => onChangeStatus(tpl.id, 'paused')} title="Pausar"
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                  <Pause className="w-3 h-3" /> Pausar
                </button>
              ) : tpl.status === 'paused' ? (
                <button onClick={() => onConfirmActivate(tpl.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                  <Play className="w-3 h-3" /> Ativar
                </button>
              ) : tpl.status === 'draft' ? (
                <button onClick={() => onConfirmActivate(tpl.id)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs bg-forest-50 text-forest-700 border border-forest-200 rounded-lg hover:bg-forest-100 transition-colors">
                  <Play className="w-3 h-3" /> Ativar
                </button>
              ) : null}

              <button onClick={() => onArchive(tpl.id)} title="Arquivar"
                className="p-2 hover:bg-red-50 rounded-lg transition-colors text-ink-soft hover:text-red-600">
                <Archive className="w-4 h-4" />
              </button>
            </div>

            {/* Confirmação de ativação */}
            {confirmActivate === tpl.id && (
              <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col gap-2">
                <p className="text-sm text-amber-800">
                  <strong>Atenção:</strong> Este template será enviado automaticamente conforme as regras configuradas. Deseja ativar?
                </p>
                <div className="flex gap-2">
                  <button onClick={() => onChangeStatus(tpl.id, 'active')}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors">
                    <Check className="w-3 h-3" /> Confirmar ativação
                  </button>
                  <button onClick={() => onConfirmActivate(null)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs border border-line rounded-lg hover:bg-paper-100 transition-colors">
                    <X className="w-3 h-3" /> Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Templates arquivados */}
      {templates.filter(t => t.status === 'archived').length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-ink-soft cursor-pointer hover:text-forest-900">
            Ver templates arquivados ({templates.filter(t => t.status === 'archived').length})
          </summary>
          <div className="mt-2 space-y-2 opacity-60">
            {templates.filter(t => t.status === 'archived').map(tpl => (
              <div key={tpl.id} className="bg-white border border-line rounded-xl p-3 flex items-center justify-between gap-4">
                <span className="text-sm text-forest-900">{tpl.name}</span>
                <button onClick={() => onChangeStatus(tpl.id, 'draft')}
                  className="text-xs px-2 py-1 border border-line rounded-lg hover:bg-paper-100 transition-colors">
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ─── Editor de template ───────────────────────────────────────────────────────

function TemplateEditor({
  initial, automations, onSave, onClose, onSaved: _onSaved,
}: {
  initial: CustomEmailTemplate | null
  automations: EmailAutomation[]
  onSave: (data: Partial<CustomEmailTemplate>) => Promise<void>
  onClose: () => void
  onSaved: (tpl: CustomEmailTemplate) => void
}) {
  const isNew = !initial?.id
  const [step, setStep] = useState<EditorStep>(isNew ? 'form' : 'result')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingVariant, setGeneratingVariant] = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [showTestModal, setShowTestModal] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Campos do formulário IA
  const [name, setName] = useState(initial?.name ?? '')
  const [objective, setObjective] = useState(initial?.objective ?? '')
  const [targetAudience, setTargetAudience] = useState(initial?.target_audience ?? 'all')
  const [tone, setTone] = useState(initial?.tone ?? 'acolhedor')
  const [emailType, setEmailType] = useState(initial?.email_type ?? 'reengajamento')
  const [relatedPlan] = useState(initial?.related_plan ?? 'nenhum')
  const [aiInstruction, setAiInstruction] = useState(initial?.ai_instruction ?? '')
  const [ctaLabel, setCtaLabel] = useState(initial?.cta_label ?? '')
  const [ctaUrl, setCtaUrl] = useState(initial?.cta_url ?? '/diario?modo=checkin')
  const [customCtaUrl, setCustomCtaUrl] = useState('')

  // Campos do resultado
  const [subject, setSubject] = useState(initial?.subject ?? '')
  const [preheader, setPreheader] = useState(initial?.preheader ?? '')
  const [body, setBody] = useState(initial?.body_html ?? '')
  const [footerText, setFooterText] = useState(initial?.footer_text ?? '')
  const [internalNotes, setInternalNotes] = useState(initial?.internal_notes ?? '')
  const [altSubjects, setAltSubjects] = useState<string[]>([])

  // Automação
  const [triggerType, setTriggerType] = useState<EmailAutomation['trigger_type']>(
    automations[0]?.trigger_type ?? 'manual'
  )
  const [triggerEvent, setTriggerEvent] = useState(automations[0]?.trigger_event ?? '')
  const [inactivityDays, setInactivityDays] = useState(7)
  const [scheduledAt, setScheduledAt] = useState(automations[0]?.scheduled_at ?? '')
  const [cooldownDays, setCooldownDays] = useState(automations[0]?.cooldown_days ?? 7)
  const [maxPerMonth, setMaxPerMonth] = useState(automations[0]?.max_sends_per_month ?? 4)

  // Condições
  const [condPlan, setCondPlan] = useState('')
  const [condNoCheckinDays, setCondNoCheckinDays] = useState('')
  const [condNoDiaryDays, setCondNoDiaryDays] = useState('')
  const [condNoAccessDays, setCondNoAccessDays] = useState('')
  const [excNoAccessH, setExcNoAccessH] = useState(true)
  const [excAlreadySent, setExcAlreadySent] = useState(true)
  const [excOptedOut, setExcOptedOut] = useState(true)

  const effectiveCtaUrl = ctaUrl === 'custom' ? customCtaUrl : ctaUrl

  // ── Gerar com IA ────────────────────────────────────────────────────────────

  async function generateWithAI(variantInstruction = '') {
    if (!name || !objective) {
      setError('Preencha o nome e o objetivo antes de gerar.')
      return
    }
    setGenerating(true)
    setGeneratingVariant(variantInstruction)
    setError('')

    const audienceLabel = AUDIENCES.find(a => a.value === targetAudience)?.label ?? targetAudience
    const toneLabel = TONES.find(t => t.value === tone)?.label ?? tone
    const objLabel = OBJECTIVES.find(o => o.value === objective)?.label ?? objective

    const brandContext = `Você é redator especializado na marca "A Vida Não Colabora" — um app de autocuidado emocional.
Tom obrigatório: acolhedor, humano, leve, sem cobrança, sem culpa, sem julgamento, sem promessa de cura, sem linguagem médica, sem diagnóstico, sem urgência agressiva, sem gatilhos de medo.
Evite: "você precisa", "saúde mental em risco", "cure", "terapia", "consulta", "paciente", "última chance", "você falhou".
Prefira: "sem pressão", "no seu ritmo", "comece pequeno", "seu espaço continua aqui", "se fizer sentido para você".
Você pode usar variáveis como {{nome}}, {{plano}}, {{checkin_url}}, {{relatorio_url}}, etc.`

    const mainPrompt = `${brandContext}

Crie um template de e-mail com as seguintes características:
- Nome: ${name}
- Objetivo: ${objLabel}
- Público-alvo: ${audienceLabel}
- Tom de voz: ${toneLabel}
- Tipo: ${EMAIL_TYPES.find(t => t.value === emailType)?.label ?? emailType}
- CTA principal: ${ctaLabel || 'adequado ao objetivo'}
- Link de destino: ${effectiveCtaUrl}
- Plano relacionado: ${relatedPlan}
- Instrução específica: ${aiInstruction || 'Use o contexto da marca para criar um e-mail relevante.'}
${variantInstruction ? `- Variação solicitada: ${variantInstruction}` : ''}

Retorne SOMENTE um JSON válido com esta estrutura exata (sem markdown, sem explicações fora do JSON):
{
  "subject": "assunto do e-mail",
  "preheader": "texto de pré-visualização curto",
  "body": "corpo do e-mail em texto simples com parágrafos separados por linha em branco. Use **texto** para negrito. Pode incluir variáveis como {{nome}}.",
  "ctaLabel": "texto do botão",
  "ctaUrl": "url do botão",
  "alternativeSubjects": ["assunto alternativo 1", "assunto alternativo 2"],
  "notes": "observações internas sobre o template"
}`

    try {
      const { data, error: fnErr } = await supabase.functions.invoke('generate-content', {
        body: { prompt: mainPrompt, provider: 'gemini' }
      })
      if (fnErr) throw new Error(fnErr.message)
      const raw: string = typeof data === 'string' ? data : (data?.text ?? data?.content ?? JSON.stringify(data))

      // Extrair JSON da resposta
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Resposta da IA não continha JSON válido.')
      const result: AIResult = JSON.parse(jsonMatch[0])

      setSubject(result.subject ?? '')
      setPreheader(result.preheader ?? '')
      setBody(result.body ?? '')
      if (result.ctaLabel) setCtaLabel(result.ctaLabel)
      if (result.ctaUrl) setCtaUrl(result.ctaUrl)
      setAltSubjects(result.alternativeSubjects ?? [])
      if (result.notes && !internalNotes) setInternalNotes(result.notes)
      setStep('result')
    } catch (e) {
      setError(`Erro ao gerar com IA: ${e instanceof Error ? e.message : 'Tente novamente.'}`)
    } finally {
      setGenerating(false)
      setGeneratingVariant('')
    }
  }

  // ── Salvar ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!name || !subject || !body) {
      setError('Preencha nome, assunto e corpo antes de salvar.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const html = buildEmailHtml(subject, preheader, body, ctaLabel, effectiveCtaUrl, footerText)
      await onSave({
        name, objective, target_audience: targetAudience, tone, email_type: emailType,
        related_plan: relatedPlan, ai_instruction: aiInstruction,
        cta_label: ctaLabel, cta_url: effectiveCtaUrl,
        subject, preheader, body_html: html,
        footer_text: footerText, internal_notes: internalNotes,
        is_ai_generated: true,
        ai_prompt: aiInstruction,
      })
      setSuccess('Template salvo como rascunho.')
    } catch (e) {
      setError(`Erro ao salvar: ${e instanceof Error ? e.message : 'Tente novamente.'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Salvar automação ────────────────────────────────────────────────────────

  async function handleSaveAutomation() {
    if (!initial?.id) {
      setError('Salve o template primeiro antes de configurar a automação.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { data: user } = await supabase.auth.getUser()
      const payload = {
        template_id: initial.id,
        name: `Automação — ${name}`,
        trigger_type: triggerType,
        trigger_event: triggerType === 'event' ? triggerEvent : null,
        scheduled_at: triggerType === 'scheduled' ? scheduledAt : null,
        schedule_type: triggerType === 'recurring' ? 'weekly' : null,
        target_segment: { plan: condPlan || null, audience: targetAudience },
        conditions: {
          no_checkin_days: condNoCheckinDays ? Number(condNoCheckinDays) : null,
          no_diary_days: condNoDiaryDays ? Number(condNoDiaryDays) : null,
          no_access_days: condNoAccessDays ? Number(condNoAccessDays) : null,
          inactivity_days: inactivityDays,
        },
        exclusion_rules: {
          no_access_last_24h: excNoAccessH,
          already_sent_recently: excAlreadySent,
          opted_out: excOptedOut,
        },
        cooldown_days: cooldownDays,
        max_sends_per_month: maxPerMonth,
        status: 'draft',
        created_by_admin_id: user.user?.id,
      }

      if (automations[0]?.id) {
        await supabase.from('email_automations').update(payload).eq('id', automations[0].id)
      } else {
        await supabase.from('email_automations').insert(payload)
      }
      setSuccess('Regra de envio salva. Template ainda está em rascunho — ative quando estiver pronto.')
    } catch (e) {
      setError(`Erro ao salvar automação: ${e instanceof Error ? e.message : 'Tente novamente.'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Envio de teste ──────────────────────────────────────────────────────────

  async function handleSendTest() {
    if (!testEmail) { setError('Informe o e-mail de teste.'); return }
    if (!subject || !body) { setError('Salve o template antes de enviar o teste.'); return }
    setTestSending(true)
    setError('')
    try {
      const html = buildEmailHtml(subject, preheader, body, ctaLabel, effectiveCtaUrl, footerText)
      const templateId = initial?.id ?? 'draft'
      const { error: fnErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          to_email: testEmail,
          template_key: 'admin_custom_message',
          variables: {
            assunto: `[TESTE] ${subject}`,
            corpo: body,
            nome: 'Admin',
            plano: 'Gratuito',
            app_url: APP_URL,
            checkin_url: `${APP_URL}/diario?modo=checkin`,
            diario_url: `${APP_URL}/diario`,
            relatorio_url: `${APP_URL}/meu-relatorio`,
            mapa_url: `${APP_URL}/mapa-emocional`,
            plano_autocuidado_url: `${APP_URL}/plano-de-autocuidado`,
            orientacao_url: `${APP_URL}/orientacao`,
            suporte_url: `${APP_URL}/suporte`,
            meu_plano_url: `${APP_URL}/meu-plano`,
          },
          metadata: {
            is_test: true,
            template_ia_id: templateId,
            custom_html: html,
          },
        }
      })
      if (fnErr) throw new Error(fnErr.message)
      setSuccess(`Teste enviado para ${testEmail}. O status aparece nos logs como test_send.`)
      setShowTestModal(false)
    } catch (e) {
      setError(`Erro no envio de teste: ${e instanceof Error ? e.message : 'Tente novamente.'}`)
    } finally {
      setTestSending(false)
    }
  }

  const previewHtml = buildEmailHtml(
    subject || 'Assunto do e-mail',
    preheader,
    body || 'Corpo do e-mail aparecerá aqui após geração.',
    ctaLabel,
    effectiveCtaUrl,
    footerText
  )

  const steps: { id: EditorStep; label: string }[] = [
    { id: 'form', label: '1. Instruções' },
    { id: 'result', label: '2. Conteúdo' },
    { id: 'preview', label: '3. Preview' },
    { id: 'automation', label: '4. Envio' },
    { id: 'conditions', label: '5. Condições' },
  ]

  return (
    <div className="space-y-4">
      {/* Cabeçalho do editor */}
      <div className="flex items-center justify-between gap-4">
        <button onClick={onClose} className="flex items-center gap-1 text-sm text-ink-soft hover:text-forest-900 transition-colors">
          <ChevronDown className="w-4 h-4 rotate-90" /> Voltar à lista
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setShowTestModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-line text-sm rounded-lg hover:bg-paper-100 transition-colors"
          >
            <Send className="w-4 h-4" /> Enviar teste
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-forest-700 text-white text-sm rounded-lg hover:bg-forest-800 transition-colors disabled:opacity-60"
          >
            <Check className="w-4 h-4" /> {saving ? 'Salvando…' : 'Salvar rascunho'}
          </button>
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex gap-2 items-start">
          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Abas do editor */}
      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {steps.map(s => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              step === s.id
                ? 'border-forest-700 text-forest-900'
                : 'border-transparent text-ink-soft hover:text-forest-900'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Passo 1: Formulário da IA ─────────────────────────────────────── */}
      {step === 'form' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5 bg-white border border-line rounded-xl p-6">
            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Nome interno do template *</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Reengajamento após 7 dias sem check-in"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Objetivo *</label>
                <select value={objective} onChange={e => setObjective(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  <option value="">Selecione…</option>
                  {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Tipo de e-mail</label>
                <select value={emailType} onChange={e => setEmailType(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  {EMAIL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Público-alvo</label>
                <select value={targetAudience} onChange={e => setTargetAudience(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Tom de voz</label>
                <select value={tone} onChange={e => setTone(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  {TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">CTA principal</label>
                <select value={ctaLabel} onChange={e => setCtaLabel(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  <option value="">Deixar a IA decidir</option>
                  {CTA_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Link de destino</label>
                <select value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  {LINK_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  <option value="custom">URL personalizada</option>
                </select>
                {ctaUrl === 'custom' && (
                  <input value={customCtaUrl} onChange={e => setCustomCtaUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full border border-line rounded-lg px-3 py-2 text-sm mt-2 focus:outline-none focus:border-forest-400"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Instrução para a IA</label>
              <textarea
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                rows={4}
                placeholder="Explique o que esse e-mail precisa comunicar. Ex: Crie um e-mail acolhedor para usuários que estão há 7 dias sem fazer check-in, convidando a voltar sem culpa."
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 resize-none"
              />
            </div>

            <button
              onClick={() => generateWithAI()}
              disabled={generating || !name || !objective}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-forest-700 text-white rounded-lg text-sm font-medium hover:bg-forest-800 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Gerando template…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Gerar template com IA</>
              )}
            </button>
          </div>

          {/* Painel de variáveis */}
          <VariablesPanel show={showVariables} onToggle={() => setShowVariables(v => !v)} />
        </div>
      )}

      {/* ── Passo 2: Resultado / Editor ──────────────────────────────────── */}
      {step === 'result' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5 bg-white border border-line rounded-xl p-6">
            {/* Botões de variantes */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Gerar novamente', icon: RefreshCw, variant: '' },
                { label: 'Mais acolhedor', icon: Sparkles, variant: 'Deixe mais acolhedor, empático e humano.' },
                { label: 'Mais curto', icon: ChevronUp, variant: 'Encurte o texto ao máximo mantendo o tom.' },
                { label: 'Mais direto', icon: Zap, variant: 'Seja mais direto e objetivo.' },
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={() => generateWithAI(btn.variant)}
                  disabled={generating}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs border border-line rounded-lg hover:bg-paper-100 transition-colors disabled:opacity-50"
                >
                  {generating && generatingVariant === btn.variant ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <btn.icon className="w-3 h-3" />
                  )}
                  {btn.label}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Assunto *</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
              />
              {altSubjects.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-ink-soft">Alternativas sugeridas pela IA:</p>
                  {altSubjects.map((s, i) => (
                    <button key={i} onClick={() => setSubject(s)}
                      className="block w-full text-left text-xs px-3 py-1.5 bg-paper-100 hover:bg-paper-200 rounded-lg transition-colors text-forest-900">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Preheader</label>
              <input value={preheader} onChange={e => setPreheader(e.target.value)}
                placeholder="Texto curto exibido na pré-visualização do cliente de e-mail"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Corpo do e-mail *</label>
              <textarea
                value={body} onChange={e => setBody(e.target.value)}
                rows={12}
                placeholder="Corpo do e-mail. Use **texto** para negrito, linha em branco para novo parágrafo e variáveis como {{nome}}."
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 resize-y font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Texto do botão CTA</label>
                <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Link do botão CTA</label>
                <input value={effectiveCtaUrl} onChange={e => {
                  if (ctaUrl !== 'custom') setCtaUrl('custom')
                  setCustomCtaUrl(e.target.value)
                }}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Rodapé personalizado</label>
              <textarea value={footerText} onChange={e => setFooterText(e.target.value)}
                rows={3} placeholder="Deixe em branco para usar o rodapé padrão da marca."
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Observações internas</label>
              <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)}
                rows={2} placeholder="Notas de uso, contexto ou restrições. Não aparece no e-mail."
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 resize-none"
              />
            </div>
          </div>

          <VariablesPanel show={showVariables} onToggle={() => setShowVariables(v => !v)} />
        </div>
      )}

      {/* ── Passo 3: Preview ─────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="bg-white border border-line rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-ink-soft">Assunto: <strong className="text-forest-900">{subject || '(sem assunto)'}</strong></p>
              {preheader && <p className="text-xs text-ink-soft">Preheader: {preheader}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${previewMode === 'desktop' ? 'bg-forest-700 text-white border-forest-700' : 'border-line hover:bg-paper-100'}`}>
                Desktop
              </button>
              <button onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${previewMode === 'mobile' ? 'bg-forest-700 text-white border-forest-700' : 'border-line hover:bg-paper-100'}`}>
                Mobile
              </button>
            </div>
          </div>

          <div className={`mx-auto border border-line rounded-xl overflow-hidden ${previewMode === 'mobile' ? 'max-w-sm' : 'max-w-2xl'}`}>
            <iframe
              srcDoc={previewHtml}
              title="Preview do e-mail"
              className="w-full border-none"
              style={{ height: previewMode === 'mobile' ? '700px' : '600px' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* ── Passo 4: Regras de envio ────────────────────────────────────── */}
      {step === 'automation' && (
        <div className="bg-white border border-line rounded-xl p-6 space-y-6">
          <div>
            <h3 className="font-medium text-forest-900 mb-1">Quando este e-mail deve ser enviado?</h3>
            <p className="text-sm text-ink-soft">Configure a regra de disparo. O template só envia quando estiver ativo.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(['manual','scheduled','recurring','event','segment'] as const).map(t => {
              const labels: Record<string, string> = {
                manual: 'Manual', scheduled: 'Agendado', recurring: 'Recorrente',
                event: 'Por evento', segment: 'Segmento'
              }
              return (
                <button key={t} onClick={() => setTriggerType(t)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition-colors ${
                    triggerType === t ? 'bg-forest-700 text-white border-forest-700' : 'border-line hover:bg-paper-100 text-forest-900'
                  }`}>
                  {t === 'manual' && <Clock className="w-4 h-4" />}
                  {t === 'scheduled' && <Clock className="w-4 h-4" />}
                  {t === 'recurring' && <RefreshCw className="w-4 h-4" />}
                  {t === 'event' && <Zap className="w-4 h-4" />}
                  {t === 'segment' && <Users className="w-4 h-4" />}
                  {labels[t]}
                </button>
              )
            })}
          </div>

          {triggerType === 'manual' && (
            <div className="p-4 bg-paper-100 rounded-xl text-sm text-ink-soft">
              O template ficará disponível para uso manual. Não enviará automaticamente.
              Você poderá usá-lo na seção Admin para enviar para usuários específicos.
            </div>
          )}

          {triggerType === 'scheduled' && (
            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">Data e horário do envio</label>
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
              />
              <p className="text-xs text-ink-soft mt-1">O envio será realizado uma vez na data definida.</p>
            </div>
          )}

          {triggerType === 'recurring' && (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">Configuração detalhada de recorrência disponível após salvar a automação.</p>
            </div>
          )}

          {triggerType === 'event' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Evento disparador</label>
                <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)}
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  <option value="">Selecione um evento…</option>
                  {TRIGGER_EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
              {['inactive_checkin', 'inactive_diary', 'inactive_access', 'no_checkin_after_signup'].includes(triggerEvent) && (
                <div>
                  <label className="block text-sm font-medium text-forest-900 mb-1">Após quantos dias?</label>
                  <input type="number" min={1} max={90} value={inactivityDays}
                    onChange={e => setInactivityDays(Number(e.target.value))}
                    className="w-24 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
                  />
                </div>
              )}
            </div>
          )}

          {triggerType === 'segment' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-forest-900 mb-1">Plano</label>
                <select value={condPlan} onChange={e => setCondPlan(e.target.value)}
                  className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
                  <option value="">Todos</option>
                  <option value="free">Gratuito</option>
                  <option value="essential">Essencial</option>
                  <option value="plus">Plus</option>
                </select>
              </div>
            </div>
          )}

          <div className="border-t border-line pt-4 space-y-3">
            <h4 className="text-sm font-medium text-forest-900">Limites anti-spam</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ink-soft mb-1">Cooldown entre envios (dias)</label>
                <input type="number" min={1} max={90} value={cooldownDays}
                  onChange={e => setCooldownDays(Number(e.target.value))}
                  className="w-24 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
                />
              </div>
              <div>
                <label className="block text-xs text-ink-soft mb-1">Máx. envios por mês por usuário</label>
                <input type="number" min={1} max={30} value={maxPerMonth}
                  onChange={e => setMaxPerMonth(Number(e.target.value))}
                  className="w-24 border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveAutomation}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-forest-700 text-white text-sm rounded-lg hover:bg-forest-800 transition-colors disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar regra de envio'}
          </button>
        </div>
      )}

      {/* ── Passo 5: Condições ───────────────────────────────────────────── */}
      {step === 'conditions' && (
        <div className="bg-white border border-line rounded-xl p-6 space-y-6">
          <div>
            <h3 className="font-medium text-forest-900 mb-1">Condições de envio</h3>
            <p className="text-sm text-ink-soft">Defina quando o e-mail deve ou não ser enviado para cada usuário.</p>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-medium text-forest-900">Enviar apenas para o plano</h4>
            <select value={condPlan} onChange={e => setCondPlan(e.target.value)}
              className="border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400 bg-white">
              <option value="">Todos os planos</option>
              <option value="free">Gratuito</option>
              <option value="essential">Essencial</option>
              <option value="plus">Plus</option>
            </select>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-forest-900">Enviar apenas se…</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-ink-soft">Sem check-in há mais de X dias</label>
                <input type="number" min={0} value={condNoCheckinDays}
                  onChange={e => setCondNoCheckinDays(e.target.value)}
                  placeholder="0 = ignorar"
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-forest-400"
                />
              </div>
              <div>
                <label className="text-xs text-ink-soft">Sem diário há mais de X dias</label>
                <input type="number" min={0} value={condNoDiaryDays}
                  onChange={e => setCondNoDiaryDays(e.target.value)}
                  placeholder="0 = ignorar"
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-forest-400"
                />
              </div>
              <div>
                <label className="text-xs text-ink-soft">Sem acesso há mais de X dias</label>
                <input type="number" min={0} value={condNoAccessDays}
                  onChange={e => setCondNoAccessDays(e.target.value)}
                  placeholder="0 = ignorar"
                  className="w-full border border-line rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-forest-400"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-forest-900">Não enviar se…</h4>
            <div className="space-y-2">
              {[
                { key: 'noAccess24h', label: 'Usuário acessou nas últimas 24h', state: excNoAccessH, setState: setExcNoAccessH },
                { key: 'alreadySent', label: `Usuário já recebeu este e-mail nos últimos ${cooldownDays} dias`, state: excAlreadySent, setState: setExcAlreadySent },
                { key: 'optedOut', label: 'Usuário desativou e-mails de lembrete/reengajamento', state: excOptedOut, setState: setExcOptedOut },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={item.state} onChange={e => item.setState(e.target.checked)}
                    className="rounded border-line text-forest-700 focus:ring-forest-400"
                  />
                  <span className="text-sm text-forest-900">{item.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-soft mt-2">
              Também são bloqueados automaticamente: e-mails inválidos, usuários bloqueados, bounces graves anteriores e usuários com assinatura cancelada (para e-mails de produto).
            </p>
          </div>

          <button
            onClick={handleSaveAutomation}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-forest-700 text-white text-sm rounded-lg hover:bg-forest-800 transition-colors disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Salvando…' : 'Salvar condições'}
          </button>
        </div>
      )}

      {/* Modal de envio de teste */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-forest-900 flex items-center gap-2">
                <Send className="w-4 h-4" /> Enviar e-mail de teste
              </h3>
              <button onClick={() => setShowTestModal(false)}>
                <X className="w-5 h-5 text-ink-soft" />
              </button>
            </div>
            <p className="text-sm text-ink-soft">
              O e-mail será marcado como [TESTE] e enviado com variáveis fictícias.
              Aparecerá nos logs como <code className="bg-paper-100 px-1 rounded">test_send</code>.
            </p>
            <div>
              <label className="block text-sm font-medium text-forest-900 mb-1">E-mail de destino</label>
              <input
                type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-400"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button onClick={handleSendTest} disabled={testSending || !testEmail}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-forest-700 text-white text-sm rounded-lg hover:bg-forest-800 transition-colors disabled:opacity-60">
                {testSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {testSending ? 'Enviando…' : 'Enviar teste'}
              </button>
              <button onClick={() => setShowTestModal(false)}
                className="px-4 py-2 border border-line text-sm rounded-lg hover:bg-paper-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Painel de variáveis ──────────────────────────────────────────────────────

function VariablesPanel({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-forest-900 hover:bg-paper-100 transition-colors"
      >
        <span className="flex items-center gap-1.5"><Info className="w-4 h-4" /> Variáveis disponíveis</span>
        {show ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {show && (
        <div className="p-4 border-t border-line space-y-2">
          {TEMPLATE_VARIABLES.map(v => (
            <div key={v.variable} className="flex flex-col">
              <code className="text-xs bg-paper-100 px-2 py-1 rounded text-forest-800 font-mono">{v.variable}</code>
              <span className="text-xs text-ink-soft mt-0.5">{v.description}</span>
            </div>
          ))}
          <p className="text-xs text-ink-soft pt-2 border-t border-line">
            Use essas variáveis no corpo e assunto. Serão substituídas pelos dados reais ao enviar.
            Se o dado não existir, será usado um valor padrão seguro.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Painel de logs ───────────────────────────────────────────────────────────

function LogsPanel({
  logs, templates: _templates, filter, onFilterChange, onBack, onRefresh,
}: {
  logs: EmailLogItem[]
  templates: CustomEmailTemplate[]
  filter: string
  onFilterChange: (f: string) => void
  onBack: () => void
  onRefresh: () => void
}) {
  const filtered = logs.filter(l => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      l.subject?.toLowerCase().includes(q) ||
      l.to_email?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.status?.toLowerCase().includes(q) ||
      l.trigger_reason?.toLowerCase().includes(q)
    )
  })

  const statusColor: Record<string, string> = {
    sent:      'bg-green-50 text-green-700',
    failed:    'bg-red-50 text-red-700',
    skipped:   'bg-amber-50 text-amber-700',
    test_send: 'bg-purple-50 text-purple-700',
    pending:   'bg-blue-50 text-blue-700',
    cancelled: 'bg-paper-100 text-ink-soft',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-soft hover:text-forest-900 transition-colors">
          <ChevronDown className="w-4 h-4 rotate-90" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              value={filter} onChange={e => onFilterChange(e.target.value)}
              placeholder="Filtrar logs…"
              className="pl-8 pr-3 py-2 text-sm border border-line rounded-lg focus:outline-none focus:border-forest-400 w-48"
            />
          </div>
          <button onClick={onRefresh} title="Atualizar"
            className="p-2 hover:bg-paper-100 rounded-lg transition-colors text-ink-soft">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-ink-soft">
          <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-50">
                  <th className="text-left px-4 py-3 font-medium text-ink-soft text-xs">Destinatário</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-soft text-xs">Assunto</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-soft text-xs">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-soft text-xs">Motivo</th>
                  <th className="text-left px-4 py-3 font-medium text-ink-soft text-xs">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(log => (
                  <tr key={log.id} className="hover:bg-paper-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono text-forest-900 truncate max-w-[160px]">
                      {log.to_email ?? log.email ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft truncate max-w-[200px]">
                      {log.subject ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${statusColor[log.status] ?? 'bg-paper-100 text-ink-soft'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft truncate max-w-[140px]">
                      {log.trigger_reason ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-soft whitespace-nowrap">
                      {formatDate(log.sent_at ?? log.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-line text-xs text-ink-soft bg-paper-50">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''}
            {filter ? ` filtrado${filtered.length !== 1 ? 's' : ''}` : ''}
          </div>
        </div>
      )}
    </div>
  )
}
