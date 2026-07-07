import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { AdminView } from './types'
import {
  FileText, Users, TrendingUp, AlertCircle, CheckCircle,
  BookOpen, MessageSquare, Zap, CreditCard,
} from 'lucide-react'

interface Stats {
  totalUsers: number
  totalArticles: number
  publishedArticles: number
  draftArticles: number
  totalDiaryEntries: number
  totalTrails: number
  openTickets: number
  automatedContents: number
  planCounts: Record<string, number>
  articlesNoImage: number
  articlesNoDiaryQ: number
  articlesNoCTA: number
  articlesShort: number
}

const EMPTY: Stats = {
  totalUsers: 0, totalArticles: 0, publishedArticles: 0, draftArticles: 0,
  totalDiaryEntries: 0, totalTrails: 0, openTickets: 0, automatedContents: 0,
  planCounts: {}, articlesNoImage: 0, articlesNoDiaryQ: 0, articlesNoCTA: 0, articlesShort: 0,
}

export default function AdminDashboard({ onNavigate }: { onNavigate: (v: AdminView) => void }) {
  const [stats, setStats] = useState<Stats>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [
          { count: totalUsers },
          { count: totalArticles },
          { count: publishedArticles },
          { count: draftArticles },
          { count: totalDiaryEntries },
          { data: articles },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('articles').select('*', { count: 'exact', head: true }),
          supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'published'),
          supabase.from('articles').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
          supabase.from('diary_entries').select('*', { count: 'exact', head: true }),
          supabase.from('articles').select('id,image_url,cover_image_url,cover_image,diary_question,cta_text,content').eq('status', 'published'),
        ])

        // Audit published articles
        const arts = articles || []
        type ArtRow = { image_url?: string; cover_image_url?: string; cover_image?: string; diary_question?: string; cta_text?: string; content?: string }
        const articlesNoImage = arts.filter((a: ArtRow) => !a.image_url && !a.cover_image_url && !a.cover_image).length
        const articlesNoDiaryQ = arts.filter((a: ArtRow) => !a.diary_question).length
        const articlesNoCTA = arts.filter((a: ArtRow) => !a.cta_text).length
        const articlesShort = arts.filter((a: ArtRow) => a.content && a.content.split(/\s+/).length < 1000).length

        // Plan counts
        const { data: profiles } = await supabase.from('profiles').select('plan')
        const planCounts: Record<string, number> = {}
        ;(profiles || []).forEach((p: { plan: string }) => {
          planCounts[p.plan] = (planCounts[p.plan] || 0) + 1
        })

        // Support tickets
        let openTickets = 0
        try {
          const { count } = await supabase
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'open')
          openTickets = count || 0
        } catch { /* tabela pode não existir */ }

        // Trails
        let totalTrails = 0
        try {
          const { count } = await supabase
            .from('trails')
            .select('*', { count: 'exact', head: true })
          totalTrails = count || 0
        } catch { /* tabela pode não existir */ }

        // Automated contents
        let automatedContents = 0
        try {
          const { count } = await supabase
            .from('automated_contents')
            .select('*', { count: 'exact', head: true })
            .eq('active', true)
          automatedContents = count || 0
        } catch { /* tabela pode não existir */ }

        setStats({
          totalUsers: totalUsers || 0,
          totalArticles: totalArticles || 0,
          publishedArticles: publishedArticles || 0,
          draftArticles: draftArticles || 0,
          totalDiaryEntries: totalDiaryEntries || 0,
          totalTrails: totalTrails || 0,
          openTickets: openTickets || 0,
          automatedContents: automatedContents || 0,
          planCounts,
          articlesNoImage,
          articlesNoDiaryQ,
          articlesNoCTA,
          articlesShort,
        })
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cards = [
    { label: 'Usuários', value: stats.totalUsers, icon: Users, color: 'text-blue-600 bg-blue-50', nav: 'users' as AdminView },
    { label: 'Artigos publicados', value: stats.publishedArticles, icon: FileText, color: 'text-green-600 bg-green-50', nav: 'articles' as AdminView },
    { label: 'Rascunhos', value: stats.draftArticles, icon: FileText, color: 'text-amber-600 bg-amber-50', nav: 'articles' as AdminView },
    { label: 'Registros no diário', value: stats.totalDiaryEntries, icon: TrendingUp, color: 'text-purple-600 bg-purple-50', nav: 'analytics' as AdminView },
    { label: 'Trilhas ativas', value: stats.totalTrails, icon: BookOpen, color: 'text-teal-600 bg-teal-50', nav: 'trails' as AdminView },
    { label: 'Tickets abertos', value: stats.openTickets, icon: MessageSquare, color: 'text-red-600 bg-red-50', nav: 'support' as AdminView },
    { label: 'Automações ativas', value: stats.automatedContents, icon: Zap, color: 'text-indigo-600 bg-indigo-50', nav: 'automated' as AdminView },
    { label: 'Total de artigos', value: stats.totalArticles, icon: CreditCard, color: 'text-stone-600 bg-stone-100', nav: 'articles' as AdminView },
  ]

  const alerts: { msg: string; nav: AdminView; type: 'warn' | 'error' }[] = []
  if (stats.articlesNoImage > 0) alerts.push({ msg: `${stats.articlesNoImage} artigo(s) publicado(s) sem imagem de capa`, nav: 'articles', type: 'warn' })
  if (stats.articlesNoDiaryQ > 0) alerts.push({ msg: `${stats.articlesNoDiaryQ} artigo(s) sem pergunta para o diário`, nav: 'articles', type: 'warn' })
  if (stats.articlesNoCTA > 0) alerts.push({ msg: `${stats.articlesNoCTA} artigo(s) sem CTA configurado`, nav: 'articles', type: 'warn' })
  if (stats.articlesShort > 0) alerts.push({ msg: `${stats.articlesShort} artigo(s) com menos de 1.000 palavras`, nav: 'articles', type: 'warn' })
  if (stats.openTickets > 0) alerts.push({ msg: `${stats.openTickets} mensagem(ns) de suporte aguardando resposta`, nav: 'support', type: 'error' })

  const PLAN_LABELS: Record<string, string> = {
    free: 'Gratuito', essential: 'Essencial', therapeutic: 'Terapêutico', 'therapeutic-plus': 'Plus',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-forest-900 mb-6">Dashboard</h1>

      {loading ? (
        <div className="flex items-center gap-3 text-stone-400">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
          Carregando métricas...
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {cards.map((card, i) => {
              const Icon = card.icon
              return (
                <div
                  key={i}
                  onClick={() => onNavigate(card.nav)}
                  className="bg-white rounded-xl p-4 border border-line shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-bold text-forest-900">{card.value}</p>
                  <p className="text-xs text-stone-500 mt-0.5 leading-snug">{card.label}</p>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Alerts */}
            <div className="lg:col-span-2">
              <div className={`rounded-xl border p-5 ${alerts.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-2 mb-3">
                  {alerts.length > 0
                    ? <AlertCircle className="w-4 h-4 text-amber-600" />
                    : <CheckCircle className="w-4 h-4 text-green-600" />
                  }
                  <h2 className={`font-semibold text-sm ${alerts.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                    {alerts.length > 0 ? `${alerts.length} alerta(s) encontrado(s)` : 'Tudo em ordem!'}
                  </h2>
                </div>
                {alerts.length > 0 ? (
                  <ul className="space-y-1.5">
                    {alerts.map((a, i) => (
                      <li key={i}
                        onClick={() => onNavigate(a.nav)}
                        className={`text-sm cursor-pointer hover:underline ${a.type === 'error' ? 'text-red-700' : 'text-amber-700'}`}
                      >
                        {a.type === 'error' ? '🔴' : '🟡'} {a.msg}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-green-700">Nenhum alerta pendente no momento.</p>
                )}
              </div>
            </div>

            {/* Plan distribution */}
            <div className="bg-white rounded-xl border border-line p-5">
              <h2 className="font-semibold text-stone-700 text-sm mb-3">Distribuição de planos</h2>
              {Object.keys(stats.planCounts).length === 0 ? (
                <p className="text-stone-400 text-sm">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {Object.entries(stats.planCounts).map(([plan, count]) => {
                    const total = stats.totalUsers || 1
                    const pct = Math.round((count / total) * 100)
                    return (
                      <div key={plan}>
                        <div className="flex justify-between text-xs text-stone-600 mb-1">
                          <span>{PLAN_LABELS[plan] || plan}</span>
                          <span>{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-1.5">
                          <div className="bg-forest-600 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-line p-5">
            <h2 className="font-semibold text-forest-900 mb-3 text-sm">Ações rápidas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: '✏️ Novo artigo', nav: 'article-editor' as AdminView },
                { label: '🖼️ Imagens', nav: 'images' as AdminView },
                { label: '⭐ Prova social', nav: 'social-proof' as AdminView },
                { label: '💳 Planos', nav: 'plans' as AdminView },
                { label: '📊 Analytics', nav: 'analytics' as AdminView },
                { label: '🗺️ Trilhas', nav: 'trails' as AdminView },
                { label: '💬 Suporte', nav: 'support' as AdminView },
                { label: '📋 Questionários', nav: 'questionnaires' as AdminView },
              ].map(item => (
                <button
                  key={item.nav}
                  onClick={() => onNavigate(item.nav)}
                  className="text-left text-sm px-3 py-2.5 bg-stone-50 hover:bg-stone-100 rounded-lg text-stone-700 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
