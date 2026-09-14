import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import AdminSEOCockpit from './AdminSEOCockpit'

type SelfTestCheck = { key: string; label: string; ok: boolean; detail: string; duration_ms: number }
type SelfTestRun = {
  id: string
  source: 'manual' | 'scheduled'
  status: 'passed' | 'warning' | 'failed'
  passed: number
  total: number
  checks: SelfTestCheck[]
  created_at: string
}

export default function AdminSEOCockpitWithSelfTest({ onEditArticle }: { onEditArticle?: (id: string) => void }) {
  const [latest, setLatest] = useState<SelfTestRun | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = useCallback(async () => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('seo-control-selftest', { body: { history: true } })
      if (invokeError) throw invokeError
      const first = (data?.history?.[0] || null) as SelfTestRun | null
      setLatest(first)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico do autoteste.')
    }
  }, [])

  useEffect(() => { void loadHistory() }, [loadHistory])

  async function runNow() {
    setRunning(true)
    setError('')
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('seo-control-selftest', { body: { source: 'manual' } })
      if (invokeError) throw invokeError
      if (!data?.result) throw new Error(data?.error || 'O autoteste não retornou um resultado.')
      setLatest(data.result as SelfTestRun)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível executar o autoteste.')
    } finally {
      setRunning(false)
    }
  }

  const allOk = latest?.passed === latest?.total && latest?.total === 12

  return <div>
    <section className="mx-auto mt-5 max-w-7xl px-4 sm:px-6">
      <div className={`rounded-2xl border p-4 sm:p-5 ${allOk ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3 min-w-0">
            <div className={`mt-0.5 rounded-xl p-2 ${allOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest-600">Autoteste do SEO Control Center</p>
              <h2 className="mt-1 font-serif text-2xl text-forest-900">{latest ? `${latest.passed}/${latest.total} testes aprovados` : 'Ainda sem execução registrada'}</h2>
              <p className="mt-1 max-w-3xl text-xs text-ink-soft">Valida Google, Search Analytics, sitemap, inspeção de URL, robots.txt, banco, provedor de IA, estrutura usada pelos adaptadores do corretor, redirects e automação diária sem alterar artigos reais.</p>
              {latest && <p className="mt-1 text-[11px] text-ink-soft">Última execução: {new Date(latest.created_at).toLocaleString('pt-BR')} · {latest.source === 'scheduled' ? 'automática' : 'manual'}</p>}
            </div>
          </div>
          <button type="button" onClick={() => void runNow()} disabled={running} className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Executar autoteste agora
          </button>
        </div>

        {error && <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

        {latest?.checks?.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {latest.checks.map(check => <div key={check.key} className="rounded-xl border border-white/80 bg-white px-3 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-forest-900">{check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}{check.label}</div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{check.detail}</p>
          </div>)}
        </div> : null}

        <p className="mt-3 text-[11px] text-ink-soft">A execução automática ocorre diariamente às 06:40 UTC, depois da sincronização principal do Search Console. O autoteste não publica, edita ou remove conteúdo.</p>
      </div>
    </section>
    <AdminSEOCockpit onEditArticle={onEditArticle} />
  </div>
}
