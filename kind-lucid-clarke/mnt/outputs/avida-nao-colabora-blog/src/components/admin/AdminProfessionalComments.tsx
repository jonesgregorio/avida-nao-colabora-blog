import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Star, Send, Loader2, Search, Sparkles } from 'lucide-react'
import { emailProfessionalCommentForUser } from '../../lib/emailTriggers'
import AIContentAssistant from './AIContentAssistant'

interface UserProfile {
  user_id: string
  full_name: string | null
  plan: string
}

interface Comment {
  id: string
  user_id: string
  comment_text: string
  report_month: string
  professional_name: string | null
  created_at: string
  user_name?: string | null
}

function monthLabel(iso: string) {
  const [year, month] = iso.split('-')
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
}

function currentYearMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function last12Months() {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export default function AdminProfessionalComments() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [reportMonth, setReportMonth] = useState(currentYearMonth())
  const [commentText, setCommentText] = useState('')
  const [professionalName, setProfessionalName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [showAI, setShowAI] = useState(false)

  useEffect(() => {
    supabase.from('profiles')
      .select('user_id,full_name,plan')
      .in('plan', ['therapeutic-plus', 'plus'])
      .order('full_name')
      .then(({ data }) => setUsers((data as UserProfile[]) ?? []))
  }, [])

  useEffect(() => {
    if (!selectedUser) return
    setLoadingComments(true)
    supabase.from('professional_comments')
      .select('id,user_id,comment_text,comment,report_month,professional_name,created_at')
      .eq('user_id', selectedUser.user_id)
      .order('report_month', { ascending: false })
      .then(({ data }) => {
        setComments(((data as (Comment & { comment?: string })[]) ?? []).map(c => ({
          ...c,
          comment_text: c.comment_text || c.comment || '',
        })))
        setLoadingComments(false)
      })
  }, [selectedUser])

  async function handleSubmit() {
    if (!selectedUser || !commentText.trim() || !user) return
    setSubmitting(true)
    setSubmitError(null)
    setSuccessMsg(null)

    const { error } = await supabase.from('professional_comments').insert({
      user_id: selectedUser.user_id,
      comment: commentText.trim(),
      comment_text: commentText.trim(),
      report_month: reportMonth,
      professional_name: professionalName.trim() || null,
      created_by: user.id,
    })

    if (error) {
      setSubmitError('Erro ao enviar comentário. Tente novamente.')
      setSubmitting(false)
      return
    }

    // Notify user
    await supabase.from('notifications').insert({
      user_id: selectedUser.user_id,
      title: 'Novo comentário do profissional',
      body: `Seu comentário mensal de ${monthLabel(reportMonth)} foi disponibilizado.`,
      type: 'professional_comment',
      is_read: false,
    })

    void emailProfessionalCommentForUser(selectedUser.user_id, `${selectedUser.user_id}:${reportMonth}`)

    setSuccessMsg(`Comentário de ${monthLabel(reportMonth)} enviado para ${selectedUser.full_name ?? 'usuário'}.`)
    setCommentText('')
    // Reload comments
    const { data } = await supabase.from('professional_comments')
      .select('id,user_id,comment_text,comment,report_month,professional_name,created_at')
      .eq('user_id', selectedUser.user_id)
      .order('report_month', { ascending: false })
    setComments(((data as (Comment & { comment?: string })[]) ?? []).map(c => ({
      ...c,
      comment_text: c.comment_text || c.comment || '',
    })))
    setSubmitting(false)
  }

  const filteredUsers = users.filter(u =>
    !userSearch || (u.full_name ?? '').toLowerCase().includes(userSearch.toLowerCase())
  )

  return (
    <div className="flex gap-6 h-full overflow-hidden">
      {/* Left: user selector */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-line pr-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-sage-800 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-purple-500" />
            Comentários individuais
          </h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar usuário Plus..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-300"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {filteredUsers.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-4">Nenhum usuário Plus encontrado</p>
          )}
          {filteredUsers.map(u => (
            <button
              key={u.user_id}
              onClick={() => { setSelectedUser(u); setCommentText(''); setSubmitError(null); setSuccessMsg(null) }}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors ${selectedUser?.user_id === u.user_id ? 'bg-purple-50 border border-purple-200 text-purple-800' : 'hover:bg-stone-50 text-stone-700'}`}
            >
              <p className="font-medium">{u.full_name ?? 'Sem nome'}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Plus</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right: comment form + history */}
      <div className="flex-1 overflow-y-auto">
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-stone-400 py-20">
            <Star className="w-8 h-8 opacity-20 mb-3" />
            <p className="text-sm">Selecione um usuário para escrever um comentário</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Form */}
            <div className="bg-white border border-purple-100 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-sage-800 mb-4">
                Novo comentário — {selectedUser.full_name ?? 'Usuário'}
              </h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">Mês de referência</label>
                  <select
                    value={reportMonth}
                    onChange={e => setReportMonth(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-line rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-200"
                  >
                    {last12Months().map(m => (
                      <option key={m} value={m}>{monthLabel(m)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-stone-500 mb-1 block">Nome do profissional (opcional)</label>
                  <input
                    value={professionalName}
                    onChange={e => setProfessionalName(e.target.value)}
                    placeholder="Nome ou deixe em branco"
                    className="w-full text-xs px-2.5 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                  />
                </div>
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-stone-500">Comentário</label>
                  <button
                    type="button"
                    onClick={() => setShowAI(true)}
                    className="flex items-center gap-1 text-xs text-forest-800 bg-mint border border-forest-200 px-2.5 py-1 rounded-lg hover:bg-mint transition-colors font-medium"
                  >
                    <Sparkles className="w-3 h-3" /> Gerar rascunho com IA
                  </button>
                </div>
                {showAI && (
                  <AIContentAssistant
                    contentType="professional_comment"
                    label="Gerar rascunho de comentário profissional"
                    defaultTheme={commentText || 'evolução emocional do mês'}
                    defaultTone="profissional"
                    onInsert={result => setCommentText(result)}
                    onClose={() => setShowAI(false)}
                  />
                )}
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Escreva sua observação sobre o mês do usuário..."
                  rows={6}
                  className="w-full text-sm px-3 py-2.5 border border-line rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>
              {submitError && <p className="text-xs text-red-600 mb-2">{submitError}</p>}
              {successMsg && <p className="text-xs text-green-600 mb-2">{successMsg}</p>}
              <button
                onClick={handleSubmit}
                disabled={submitting || !commentText.trim()}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar comentário
              </button>
            </div>

            {/* History */}
            <div>
              <h3 className="text-xs font-semibold text-stone-500 mb-3">Histórico de comentários</h3>
              {loadingComments ? (
                <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-stone-300 animate-spin" /></div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">Nenhum comentário enviado ainda</p>
              ) : comments.map(c => (
                <div key={c.id} className="bg-stone-50 border border-line rounded-xl p-4 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-purple-700 capitalize">{monthLabel(c.report_month)}</span>
                    <span className="text-[10px] text-stone-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {c.professional_name && <p className="text-[10px] text-stone-400 mb-1">{c.professional_name}</p>}
                  <p className="text-sm text-stone-700 whitespace-pre-wrap leading-relaxed">{c.comment_text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
