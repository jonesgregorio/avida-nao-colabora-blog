import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Mail, RefreshCw, UserCheck, UserX, Search } from 'lucide-react'

interface Subscriber {
  id: string
  email: string
  status: 'subscribed' | 'unsubscribed'
  source: string
  subscribed_at: string
  unsubscribed_at: string | null
  confirmation_sent_at: string | null
  created_at: string
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Newsletter do rodapé ("Receba conteúdos que acolhem"): visitantes sem conta,
// sem relação com profiles/usuários da plataforma. Espelha aqui quem se
// inscreveu e quem pediu para cancelar, lido direto da tabela pelo Data API
// (RLS: só admin com AAL2 — is_admin() — enxerga alguma linha).
export default function AdminNewsletter() {
  const [items, setItems] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }).limit(500)
    if (filter !== 'all') query = query.eq('status', filter)
    const { data } = await query
    setItems((data as Subscriber[]) ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const filtered = search.trim()
    ? items.filter(i => i.email.toLowerCase().includes(search.trim().toLowerCase()))
    : items

  const totalSubscribed = items.filter(i => i.status === 'subscribed').length
  const totalUnsubscribed = items.filter(i => i.status === 'unsubscribed').length

  return (
    <div className="p-4 sm:p-5 flex flex-col gap-4 h-full min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Mail className="w-4 h-4 text-forest-700" />
          <span><strong className="text-forest-900">{totalSubscribed}</strong> inscritos ativos</span>
          <span className="text-line">•</span>
          <span><strong className="text-forest-900">{totalUnsubscribed}</strong> cancelamentos</span>
        </div>
        <button onClick={load} className="admin-btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          { id: 'all', label: 'Todos' },
          { id: 'subscribed', label: 'Inscritos' },
          { id: 'unsubscribed', label: 'Cancelaram' },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.id ? 'bg-forest-900 text-white border-forest-900' : 'bg-white border-line text-ink-soft hover:border-forest-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="w-4 h-4 text-ink-soft absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por e-mail…"
            className="w-full pl-9 pr-3 py-1.5 border border-line rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-300"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto border border-line rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 sticky top-0">
            <tr className="text-left text-xs text-ink-soft uppercase tracking-wide">
              <th className="px-4 py-2.5">E-mail</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Inscrito em</th>
              <th className="px-4 py-2.5">Cancelado em</th>
              <th className="px-4 py-2.5">Confirmação enviada</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Carregando…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft">Nenhuma inscrição encontrada.</td></tr>
            )}
            {!loading && filtered.map(row => (
              <tr key={row.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-medium text-forest-900">{row.email}</td>
                <td className="px-4 py-2.5">
                  {row.status === 'subscribed' ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-mint text-forest-800 border border-forest-200">
                      <UserCheck className="w-3 h-3" /> Inscrito
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                      <UserX className="w-3 h-3" /> Cancelou
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-ink-soft">{fmt(row.subscribed_at)}</td>
                <td className="px-4 py-2.5 text-ink-soft">{fmt(row.unsubscribed_at)}</td>
                <td className="px-4 py-2.5 text-ink-soft">{fmt(row.confirmation_sent_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
