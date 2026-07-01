import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { MessageSquare, CheckCircle, Clock, Send, Loader2, Bell } from 'lucide-react'
import AIContentAssistant from './AIContentAssistant'

interface GuidanceRequest {
  id: string
  user_id: string
  month_key: string
  message: string
  context: string | null
  expected_help: string | null
  response: string | null
  status: string
  responded_at: string | null
  created_at: string
  user?: { full_name?: string; email?: string; plan?: string }
}

const inputCls = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function AdminGuidanceRequests() {
  const [requests, setRequests] = useState<GuidanceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'answered'>('all')
  const [selected, setSelected] = useState<GuidanceRequest | null>(null)
  const [response, setResponse] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const [showAI, setShowAI] = useState(false)

  function showToast(msg: string, err = false) {
    setToast({ msg, err }); setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('monthly_guidance_requests')
      .select('*, user:profiles(full_name, plan)')
      .order('created_at', { ascending: false })
      .limit(100)
    setRequests(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = requests.filter(r => filter === 'all' || r.status === filter)

  async function respond() {
    if (!selected || !response.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('monthly_guidance_requests')
      .update({ response: response.trim(), status: 'answered', responded_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', selected.id)
    if (error) { showToast('Erro: ' + error.message, true); setSaving(false); return }

    // Notificar usuário
    await supabase.from('notifications').insert({
      user_id: selected.user_id,
      title: 'Sua orientação foi respondida',
      body: `Sua orientação de ${monthLabel(selected.month_key)} foi respondida. Acesse Minha Evolução para ver.`,
      type: 'system',
      action_view: 'my-evolution',
      action_label: 'Ver orientação',
      is_read: false,
    })

    showToast('Resposta enviada e usuário notificado!')
    setSaving(false)
    setSelected(null)
    setResponse('')
    load()
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm px-4 py-2 rounded-lg shadow-lg ${toast.err ? 'bg-red-600' : 'bg-stone-800'}`}>
          {toast.msg}
        </div>
      )}

      <h1 className="text-2xl font-bold text-stone-800 mb-6">Orientações Mensais</h1>

      <div className="flex gap-2 mb-4">
        {(['all', 'open', 'answered'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
          >
            {f === 'all' ? 'Todas' : f === 'open' ? 'Aguardando' : 'Respondidas'}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="max-w-2xl space-y-5">
          <button onClick={() => { setSelected(null); setResponse('') }} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1">
            ← Voltar
          </button>

          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-stone-800">{(selected.user as any)?.full_name ?? selected.user_id}</p>
                <p className="text-xs text-stone-400">{monthLabel(selected.month_key)} · {new Date(selected.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${selected.status === 'answered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {selected.status === 'answered' ? 'Respondida' : 'Aguardando'}
              </span>
            </div>
            <div className="space-y-3 bg-stone-50 rounded-lg p-4">
              <div>
                <p className="text-xs text-stone-500 font-medium mb-1">Sobre o que quer orientação</p>
                <p className="text-sm text-stone-700">{selected.message}</p>
              </div>
              {selected.context && (
                <div>
                  <p className="text-xs text-stone-500 font-medium mb-1">O que já tentou</p>
                  <p className="text-sm text-stone-600">{selected.context}</p>
                </div>
              )}
              {selected.expected_help && (
                <div>
                  <p className="text-xs text-stone-500 font-medium mb-1">Tipo de ajuda esperada</p>
                  <p className="text-sm text-stone-600">{selected.expected_help}</p>
                </div>
              )}
            </div>

            {selected.response ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-xs text-emerald-600 font-medium mb-1">Resposta enviada</p>
                <p className="text-sm text-stone-700">{selected.response}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-stone-600 font-medium">Resposta</label>
                  <button
                    type="button"
                    onClick={() => setShowAI(true)}
                    className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 font-medium"
                  >
                    ✦ Rascunho com IA
                  </button>
                </div>
                {showAI && (
                  <AIContentAssistant
                    contentType="monthly_guidance"
                    contextTitle={selected.message}
                    defaultTone="acolhedor"
                    label="Gerar rascunho de resposta"
                    onInsert={text => { setResponse(text); setShowAI(false) }}
                    onClose={() => setShowAI(false)}
                  />
                )}
                <textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  rows={6}
                  placeholder="Escreva sua resposta de orientação mensal..."
                  className={inputCls}
                />
                <div className="flex gap-2">
                  <button
                    onClick={respond}
                    disabled={saving || !response.trim()}
                    className="flex items-center gap-2 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {saving ? 'Enviando...' : 'Enviar resposta + Notificar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {loading ? (
            <p className="text-stone-400 text-sm">Carregando...</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma orientação {filter === 'open' ? 'aguardando' : filter === 'answered' ? 'respondida' : ''} encontrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(r => (
                <div
                  key={r.id}
                  className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 cursor-pointer transition-colors"
                  onClick={() => { setSelected(r); setResponse(r.response ?? '') }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-stone-800 text-sm">{(r.user as any)?.full_name ?? r.user_id}</p>
                        <span className="text-xs text-stone-400">·</span>
                        <span className="text-xs text-stone-400">{monthLabel(r.month_key)}</span>
                      </div>
                      <p className="text-sm text-stone-600 line-clamp-2">{r.message}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      {r.status === 'open' ? (
                        <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3" /> Aguardando
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Respondida
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-stone-400 mt-2">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
