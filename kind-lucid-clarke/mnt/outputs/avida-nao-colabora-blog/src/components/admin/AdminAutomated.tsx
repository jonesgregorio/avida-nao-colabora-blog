import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Plus, Pencil, Trash2, Zap, ToggleLeft, ToggleRight,
  Sparkles, Send, Loader2, CheckCircle, AlertCircle, Mail
} from 'lucide-react'

interface AutoContent {
  id: string
  title: string
  type: string
  plan_required: string
  frequency: string
  content: string
  active: boolean
  created_at: string
}

interface EmailLog {
  id: string
  email: string
  subject: string
  status: string
  sent_at: string
}

const TYPES = [
  'Sugestão de artigo', 'Meditação guiada em texto', 'Exercício emocional',
  'Mini-desafio', 'Avaliação semanal', 'Relatório mensal',
  'Plano semanal de autocuidado', 'Lembrete de diário', 'Preparação para sessão',
]

const FREQUENCIES = ['Diário', 'Semanal', 'Quinzenal', 'Mensal']

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', essential: 'Essencial',
  therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
}

const FREQ_COLORS: Record<string, string> = {
  Diário: 'bg-red-100 text-red-700',
  Semanal: 'bg-blue-100 text-blue-700',
  Quinzenal: 'bg-purple-100 text-purple-700',
  Mensal: 'bg-stone-100 text-stone-600',
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

export default function AdminAutomated() {
  const [items, setItems] = useState<AutoContent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AutoContent | null>(null)
  const [activeTab, setActiveTab] = useState<'conteudos' | 'logs'>('conteudos')
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // Form
  const [title, setTitle] = useState('')
  const [tema, setTema] = useState('')
  const [type, setType] = useState(TYPES[0])
  const [planRequired, setPlanRequired] = useState('free')
  const [frequency, setFrequency] = useState(FREQUENCIES[1])
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('automated_contents')
      .select('*')
      .order('created_at', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function loadLogs() {
    setLogsLoading(true)
    const { data } = await supabase
      .from('email_logs')
      .select('id, email, subject, status, sent_at')
      .order('sent_at', { ascending: false })
      .limit(100)
    setLogs(data || [])
    setLogsLoading(false)
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (activeTab === 'logs') loadLogs() }, [activeTab])

  function flash(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function openNew() {
    setEditing(null); setTitle(''); setTema(''); setType(TYPES[0])
    setPlanRequired('free'); setFrequency(FREQUENCIES[1]); setContent('')
    setShowForm(true)
  }

  function openEdit(item: AutoContent) {
    setEditing(item); setTitle(item.title); setTema(''); setType(item.type)
    setPlanRequired(item.plan_required); setFrequency(item.frequency)
    setContent(item.content); setShowForm(true)
  }

  // ── Gerar conteúdo com Gemini via Edge Function ───────────────────────────
  async function generateWithAI() {
    if (!tema.trim()) { flash('Digite um tema antes de gerar', 'err'); return }
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: { tema: tema.trim(), tipo: type, frequencia: frequency },
      })
      if (error) throw error
      if (data.error) throw new Error(data.error)
      setContent(data.content)
      if (!title.trim()) setTitle(`${type} — ${tema.trim()}`)
      flash('Conteúdo gerado com sucesso!')
    } catch (e: any) {
      flash('Erro ao gerar: ' + e.message, 'err')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!title.trim()) { flash('Título é obrigatório', 'err'); return }
    if (!content.trim()) { flash('Gere ou escreva o conteúdo', 'err'); return }
    setSaving(true)
    const payload = { title, type, plan_required: planRequired, frequency, content, active: true }
    try {
      if (editing) {
        await supabase.from('automated_contents').update(payload).eq('id', editing.id)
      } else {
        await supabase.from('automated_contents').insert(payload)
      }
      flash('Salvo com sucesso!'); setShowForm(false); load()
    } catch (e: any) {
      flash('Erro: ' + e.message, 'err')
    } finally {
      setSaving(false)
    }
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from('automated_contents').update({ active: !active }).eq('id', id)
    setItems(is => is.map(i => i.id === id ? { ...i, active: !active } : i))
  }

  async function remove(id: string) {
    if (!confirm('Excluir este conteúdo automático?')) return
    await supabase.from('automated_contents').delete().eq('id', id)
    load()
  }

  // ── Disparar envio manual agora ───────────────────────────────────────────
  async function sendNow() {
    if (!confirm('Disparar e-mails agora para todos os usuários elegíveis?')) return
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke('send-automated-emails', {})
      if (error) throw error
      flash(`✅ ${data.sent} e-mail(s) enviado(s)!`)
      loadLogs()
    } catch (e: any) {
      flash('Erro no envio: ' + e.message, 'err')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg shadow-lg ${
          toast.type === 'ok' ? 'bg-emerald-700 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Conteúdos Automáticos</h1>
          <p className="text-stone-400 text-xs mt-1">Gere com IA e envie automaticamente por e-mail</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={sendNow}
            disabled={sending}
            className="flex items-center gap-2 border border-stone-300 text-stone-700 px-3 py-2 rounded-lg text-sm hover:bg-stone-50 disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? 'Enviando...' : 'Disparar agora'}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-stone-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-stone-700"
          >
            <Plus size={14} /> Novo conteúdo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(['conteudos', 'logs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-stone-900 text-stone-900 font-medium'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab === 'conteudos' ? `Conteúdos (${items.length})` : 'Logs de envio'}
          </button>
        ))}
      </div>

      {/* ── TAB: Conteúdos ── */}
      {activeTab === 'conteudos' && (
        <>
          {/* Formulário */}
          {showForm && (
            <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6 space-y-4">
              <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide">
                {editing ? 'Editar conteúdo' : 'Novo conteúdo automático'}
              </h2>

              {/* IA Generator */}
              <div className="bg-gradient-to-r from-emerald-50 to-stone-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Gerar conteúdo com IA</span>
                </div>
                <div className="flex gap-2">
                  <input
                    value={tema}
                    onChange={e => setTema(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && generateWithAI()}
                    placeholder="Ex: ansiedade no trabalho, luto, relacionamentos tóxicos..."
                    className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 bg-white"
                  />
                  <button
                    onClick={generateWithAI}
                    disabled={generating}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {generating ? 'Gerando...' : 'Gerar com IA'}
                  </button>
                </div>
                <p className="text-xs text-emerald-600 mt-2">
                  💡 Digite o tema e pressione Enter ou clique em "Gerar". O título e conteúdo serão preenchidos automaticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Título</label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Será preenchido pela IA ou escreva manualmente"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Tipo</label>
                  <select value={type} onChange={e => setType(e.target.value)} className={inputCls}>
                    {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Plano mínimo</label>
                  <select value={planRequired} onChange={e => setPlanRequired(e.target.value)} className={inputCls}>
                    {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Frequência de envio</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value)} className={inputCls}>
                    {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-stone-500">Conteúdo do e-mail</label>
                  {content && (
                    <span className="text-xs text-stone-400">{content.length} caracteres</span>
                  )}
                </div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={8}
                  placeholder="O conteúdo gerado pela IA aparecerá aqui. Você pode editar antes de salvar."
                  className={inputCls}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-4 py-2 bg-stone-800 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar conteúdo'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border border-stone-200 text-stone-600 text-sm rounded-lg hover:bg-stone-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista */}
          {loading ? (
            <p className="text-stone-400 text-sm">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <Zap size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum conteúdo automático ainda.</p>
              <button onClick={openNew} className="mt-3 text-sm text-emerald-600 hover:underline">
                Criar o primeiro com IA
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FREQ_COLORS[item.frequency] || 'bg-stone-100 text-stone-600'}`}>
                        {item.frequency}
                      </span>
                      <span className="text-xs text-stone-400">{item.type}</span>
                      <span className="text-xs text-stone-400">• {PLAN_LABELS[item.plan_required]}</span>
                    </div>
                    <p className="font-semibold text-stone-800">{item.title}</p>
                    <p className="text-sm text-stone-400 mt-1 line-clamp-2">{item.content}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggle(item.id, item.active)}
                      className="flex items-center gap-1.5"
                      title={item.active ? 'Pausar' : 'Ativar'}
                    >
                      {item.active
                        ? <ToggleRight size={20} className="text-emerald-600" />
                        : <ToggleLeft size={20} className="text-stone-300" />
                      }
                      <span className={`text-xs ${item.active ? 'text-emerald-600' : 'text-stone-400'}`}>
                        {item.active ? 'Ativo' : 'Pausado'}
                      </span>
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => remove(item.id)}
                      className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TAB: Logs ── */}
      {activeTab === 'logs' && (
        <>
          {logsLoading ? (
            <p className="text-stone-400 text-sm">Carregando logs...</p>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <Mail size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum e-mail enviado ainda.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">E-mail</th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden md:table-cell">Assunto</th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs">Status</th>
                    <th className="text-left px-4 py-3 text-stone-500 font-medium text-xs hidden lg:table-cell">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 text-stone-700 font-mono text-xs">{log.email}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs hidden md:table-cell truncate max-w-xs">{log.subject}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          log.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {log.status === 'sent' ? 'Enviado' : 'Falhou'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400 text-xs hidden lg:table-cell">
                        {new Date(log.sent_at).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
