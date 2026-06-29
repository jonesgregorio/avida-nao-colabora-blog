import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { FileText, Download, Users, CheckCircle, XCircle, Settings, TableIcon } from 'lucide-react'

const PDF_PLANS = ['therapeutic', 'therapeutic-plus']

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

interface PDFStats {
  totalEligible: number
  totalUsers: number
  byPlan: Record<string, number>
}

function exportCSV(stats: PDFStats) {
  const rows = [
    ['Plano', 'Usuários', 'Elegível para PDF'],
    ...Object.entries(stats.byPlan).map(([plan, count]) => [
      PLAN_LABELS[plan] || plan,
      String(count),
      PDF_PLANS.includes(plan) ? 'Sim' : 'Não',
    ]),
    [],
    ['Total de usuários', String(stats.totalUsers), ''],
    ['Elegíveis para PDF', String(stats.totalEligible), ''],
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `relatorio-pdf-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const REPORT_TYPES = [
  { id: 'emotional_monthly', label: 'Relatório Emocional Mensal', desc: 'Resumo do humor, energia e anotações do mês', plans: ['therapeutic', 'therapeutic-plus'] },
  { id: 'diary_export', label: 'Exportação do Diário', desc: 'Histórico completo de entradas do diário', plans: ['therapeutic', 'therapeutic-plus'] },
  { id: 'mood_evolution', label: 'Evolução do Humor', desc: 'Gráfico e análise da evolução emocional', plans: ['therapeutic', 'therapeutic-plus'] },
  { id: 'anxiety_stress', label: 'Relatório de Ansiedade e Estresse', desc: 'Métricas de ansiedade, estresse e sono', plans: ['therapeutic-plus'] },
  { id: 'therapeutic_goals', label: 'Metas Terapêuticas', desc: 'Progresso nas metas e tarefas terapêuticas', plans: ['therapeutic-plus'] },
]

export default function AdminPDF() {
  const [stats, setStats] = useState<PDFStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase.from('profiles').select('plan')
      if (!profiles) { setLoading(false); return }

      const byPlan: Record<string, number> = {}
      let totalEligible = 0
      for (const p of profiles) {
        const plan = p.plan || 'free'
        byPlan[plan] = (byPlan[plan] || 0) + 1
        if (PDF_PLANS.includes(plan)) totalEligible++
      }

      setStats({ totalEligible, totalUsers: profiles.length, byPlan })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-stone-400 text-sm p-8">Carregando...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 mb-1">Relatórios PDF</h1>
          <p className="text-stone-400 text-sm">Geração de relatórios em PDF para usuários com planos Terapêutico e Terapêutico Plus.</p>
        </div>
        {stats && (
          <button
            onClick={() => exportCSV(stats)}
            className="flex items-center gap-2 border border-stone-200 text-stone-600 px-4 py-2 rounded-lg text-sm hover:bg-stone-50"
          >
            <TableIcon className="w-4 h-4" /> Exportar CSV
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">Usuários elegíveis</span>
            <Users className="w-4 h-4 text-stone-300" />
          </div>
          <p className="text-2xl font-bold text-violet-600">{stats?.totalEligible ?? 0}</p>
          <p className="text-xs text-stone-400 mt-1">Com acesso a exportação PDF</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">Planos com PDF</span>
            <FileText className="w-4 h-4 text-stone-300" />
          </div>
          <p className="text-2xl font-bold text-stone-700">2</p>
          <p className="text-xs text-stone-400 mt-1">Terapêutico e Terapêutico Plus</p>
        </div>
        <div className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">Tipos de relatório</span>
            <Download className="w-4 h-4 text-stone-300" />
          </div>
          <p className="text-2xl font-bold text-stone-700">{REPORT_TYPES.length}</p>
          <p className="text-xs text-stone-400 mt-1">Disponíveis na plataforma</p>
        </div>
      </div>

      {/* Report types */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Tipos de relatório disponíveis
        </h2>
        <div className="space-y-3">
          {REPORT_TYPES.map(rt => (
            <div key={rt.id} className="flex items-start gap-3 p-3 rounded-lg border border-stone-100 hover:bg-stone-50">
              <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium text-stone-800">{rt.label}</p>
                  <div className="flex gap-1">
                    {rt.plans.map(p => (
                      <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${p === 'therapeutic-plus' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                        {PLAN_LABELS[p]}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-stone-400">{rt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan access table */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Acesso por plano
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-2 text-stone-400 font-medium">Plano</th>
                <th className="text-center py-2 text-stone-400 font-medium">Exportação PDF</th>
                <th className="text-center py-2 text-stone-400 font-medium">Rel. emocional</th>
                <th className="text-center py-2 text-stone-400 font-medium">Exp. diário</th>
                <th className="text-center py-2 text-stone-400 font-medium">Metas terap.</th>
                <th className="text-right py-2 text-stone-400 font-medium">Usuários</th>
              </tr>
            </thead>
            <tbody>
              {(['free', 'essential', 'therapeutic', 'therapeutic-plus'] as const).map(plan => {
                const eligible = PDF_PLANS.includes(plan)
                const plus = plan === 'therapeutic-plus'
                const Check = () => <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                const X = () => <XCircle className="w-4 h-4 text-stone-200 mx-auto" />
                return (
                  <tr key={plan} className="border-b border-stone-50">
                    <td className="py-2.5 font-medium text-stone-800">{PLAN_LABELS[plan]}</td>
                    <td className="py-2.5 text-center">{eligible ? <Check /> : <X />}</td>
                    <td className="py-2.5 text-center">{eligible ? <Check /> : <X />}</td>
                    <td className="py-2.5 text-center">{eligible ? <Check /> : <X />}</td>
                    <td className="py-2.5 text-center">{plus ? <Check /> : <X />}</td>
                    <td className="py-2.5 text-right text-stone-500">{stats?.byPlan[plan] ?? 0}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>Geração de PDF:</strong> Os relatórios são gerados automaticamente no cliente usando os dados do diário e perfil do usuário.
        Usuários com planos elegíveis encontram o botão "Exportar PDF" nas seções de diário e relatórios.
      </div>
    </div>
  )
}
