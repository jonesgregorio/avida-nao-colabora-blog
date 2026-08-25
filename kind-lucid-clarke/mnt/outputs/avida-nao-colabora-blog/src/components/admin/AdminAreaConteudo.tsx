import { useState } from 'react'
import { FileText, Sparkles, FileCode, Zap, CalendarDays, Clock, Tag, Image, Search, Star } from 'lucide-react'
import AdminArticles from './AdminArticles'
import AdminCategories from './AdminCategories'
import AdminMediaLibrary from './AdminMediaLibrary'
import AdminSEOCockpit from './AdminSEOCockpit'
import AdminSocialProof from './AdminSocialProof'
import AdminTemplatesIA from './AdminTemplatesIA'
import AdminFabricaIA from './AdminFabricaIA'
import AdminCalendarioEditorial from './AdminCalendarioEditorial'
import AdminAutomacoesBlog from './AdminAutomacoesBlog'
import AdminScheduled from './AdminScheduled'

// Conteúdo & IA — área única que reúne TUDO de conteúdo:
//   • tipos de conteúdo (artigos)
//   • geração com IA + templates de prompt
//   • automações (cron), calendário editorial e agendamentos
//   • apoio (categorias, mídia, SEO, home/depoimentos)
// A aba "Conteúdo diário" (antes renomeada para "Práticas e pausas") foi
// REMOVIDA (não só renomeada): a investigação mostrou que o único consumidor
// real de `automated_contents` era a Edge Function send-automated-emails, que
// mandava o MESMO e-mail para todo usuário elegível todo dia — exatamente a
// "Conteúdo Diário automático para todos" que a Regra Definitiva nº 1 proíbe,
// só que por e-mail em vez de widget in-app. O cron que a disparava nunca foi
// de fato agendado em produção (ficou comentado desde a migration 004), mas o
// admin autor + a função de disparo continuavam prontos para reativação.
// AdminAutomated.tsx e send-automated-emails/index.ts foram removidos; a
// tabela automated_contents e os logs de e-mail permanecem no banco (dado
// histórico, sem novos registros).
// Nenhuma outra funcionalidade foi perdida — o resto desta área já estava
// consolidado em 3 itens de menu (Fábrica IA, Calendário, Automações) + abas
// de apoio. "Recomendações IA" (entregas personalizadas) migrou para Orientação.
const TABS = [
  { id: 'artigos',      label: 'Artigos',            icon: FileText },
  { id: 'gerar-ia',     label: 'Gerar com IA',       icon: Sparkles },
  { id: 'templates',    label: 'Templates de IA',    icon: FileCode },
  { id: 'automacoes',   label: 'Automações',         icon: Zap },
  { id: 'calendario',   label: 'Calendário',         icon: CalendarDays },
  { id: 'programados',  label: 'Programados',        icon: Clock },
  { id: 'categorias',   label: 'Categorias',         icon: Tag },
  { id: 'imagens',      label: 'Mídia',              icon: Image },
  { id: 'seo',          label: 'SEO',                icon: Search },
  { id: 'depoimentos',  label: 'Home e Depoimentos', icon: Star },
] as const

type Tab = typeof TABS[number]['id']

interface Props {
  onEditArticle: (id?: string) => void
  initialTab?: string
  // Sem isso a tela de IA continuava duplicada em dois lugares (Conteúdo & IA
  // e IA Emocional apontando pro mesmo componente). Agora existe só uma vez,
  // dentro de IA Emocional, e este link leva até lá.
  onOpenCentralIA?: () => void
}

export default function AdminAreaConteudo({ onEditArticle, initialTab, onOpenCentralIA }: Props) {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = initialTab ?? localStorage.getItem('admin-conteudo-tab') ?? 'artigos'
      return (TABS.find(t => t.id === saved)?.id ?? 'artigos') as Tab
    } catch { return 'artigos' }
  })

  function switchTab(id: Tab) {
    setTab(id)
    try { localStorage.setItem('admin-conteudo-tab', id) } catch { /* noop */ }
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-6 pt-8 pb-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl text-forest-900">Conteúdo &amp; IA</h1>
            <p className="text-sm text-ink-soft mt-1">Conteúdos, geração por IA, automações, calendário editorial e agendamentos — tudo num só lugar.</p>
          </div>
          {onOpenCentralIA && (
            <button onClick={onOpenCentralIA} className="text-xs font-medium text-forest-700 border border-line rounded-xl px-3 py-1.5 hover:border-forest-300 whitespace-nowrap">
              Ver uso de IA (editorial + emocional) →
            </button>
          )}
        </div>
      </div>
      <div className="border-b border-line bg-white sticky top-0 z-10">
        <nav className="flex gap-0 px-4 overflow-x-auto" aria-label="Abas de Conteúdo &amp; IA">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'border-forest-700 text-forest-900'
                    : 'border-transparent text-ink-soft hover:text-forest-900 hover:border-line'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="flex-1">
        {tab === 'artigos'     && <AdminArticles contentType="article" onEdit={onEditArticle} onNew={() => onEditArticle()} />}
        {tab === 'gerar-ia'    && <AdminFabricaIA />}
        {tab === 'templates'   && <AdminTemplatesIA />}
        {tab === 'automacoes'  && <AdminAutomacoesBlog />}
        {tab === 'calendario'  && <AdminCalendarioEditorial onEditArticle={onEditArticle} />}
        {tab === 'programados' && <AdminScheduled />}
        {tab === 'categorias'  && <AdminCategories />}
        {tab === 'imagens'     && <AdminMediaLibrary />}
        {tab === 'seo'         && <AdminSEOCockpit onEditArticle={onEditArticle} />}
        {tab === 'depoimentos' && <AdminSocialProof />}
      </div>
    </div>
  )
}
