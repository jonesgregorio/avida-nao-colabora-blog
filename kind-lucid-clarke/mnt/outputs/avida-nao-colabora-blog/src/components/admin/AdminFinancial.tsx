import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DollarSign, TrendingUp, Users, CreditCard, ArrowUpRight } from 'lucide-react'

// Preços padrão usados como fallback se plan_configs não tiver dados
const DEFAULT_PRICES: Record<string, number> = {
  free: 0,
  essential: 29.9,
  therapeutic: 59.9,
  'therapeutic-plus': 89.9,
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  essential: 'Essencial',
  therapeutic: 'Terapêutico',
  'therapeutic-plus': 'Terapêutico Plus',
}

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-200',
  essential: 'bg-emerald-400',
  therapeutic: 'bg-violet-400',
  'therapeutic-plus': 'bg-amber-400',
}

interface PlanStat {
  plan: string
  count: number
  revenue: number
}

interface FinancialStats {
  totalUsers: number
  payingUsers: number
  mrr: number
  arr: number
  planStats: PlanStat[]
  conversionRate: number
}

function StatCard({ icon: Icon, label, value, sub, color = 'text-stone-700' }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">{label}</span>
        <Icon className="w-4 h-4 text-stone-300" />
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function AdminFinancial() {
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pricesFromDB, setPricesFromDB] = useState(false)
  const [planPrices, setPlanPrices] = useState<Record<string, number>>(DEFAULT_PRICES)

  useEffect(() => {
    async function load() {
      // Carrega preços reais do plan_configs; usa defaults se tabela vazia
      const [{ data: profiles }, { data: planConfigs }] = await Promise.all([
        supabase.from('profiles').select('plan'),
        supabase.from('plan_configs').select('plan_key, price'),
      ])

      if (!profiles) { setLoading(false); return }

      // Converte preços do banco ("R$ 29,90" → 29.9)
      const PLAN_PRICES: Record<string, number> = { ...DEFAULT_PRICES }
      if (planConfigs && planConfigs.length > 0) {
        setPricesFromDB(true)
        for (const pc of planConfigs) {
          const num = parseFloat(
            (pc.price || '0').replace(/[^\d,]/g, '').replace(',', '.')
          )
          if (!isNaN(num)) PLAN_PRICES[pc.plan_key] = num
        }
        setPlanPrices({ ...PLAN_PRICES })
      }

      const counts: Record<string, number> = {}
      for (const p of profiles) {
        const plan = p.plan || 'free'
        counts[plan] = (counts[plan] || 0) + 1
      }

      const planStats: PlanStat[] = Object.entries(counts).map(([plan, count]) => ({
        plan,
        count,
        revenue: count * (PLAN_PRICES[plan] ?? 0),
      })).sort((a, b) => b.revenue - a.revenue)

      const totalUsers = profiles.length
      const payingUsers = profiles.filter(p => p.plan && p.plan !== 'free').length
      const mrr = planStats.reduce((s, p) => s + p.revenue, 0)

      setStats({
        totalUsers,
        payingUsers,
        mrr,
        arr: mrr * 12,
        planStats,
        conversionRate: totalUsers > 0 ? Math.round((payingUsers / totalUsers) * 100) : 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="text-stone-400 text-sm p-8">Carregando...</div>
  if (!stats) return <div className="text-stone-400 text-sm p-8">Sem dados.</div>

  const maxCount = Math.max(...stats.planStats.map(p => p.count), 1)

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-1">Gestão Financeira</h1>
      <p className="text-stone-400 text-sm mb-1">Receita estimada com base nos planos ativos dos usuários.</p>
      <p className="text-xs text-stone-400 mb-6">
        Preços: {pricesFromDB
          ? <span className="text-emerald-600 font-medium">carregados da tabela plan_configs</span>
          : <span className="text-amber-600 font-medium">valores padrão (configure em Planos para sincronizar)</span>
        }
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={DollarSign} label="MRR Estimado" value={fmt(stats.mrr)} sub="Receita mensal recorrente" color="text-emerald-600" />
        <StatCard icon={TrendingUp} label="ARR Estimado" value={fmt(stats.arr)} sub="Receita anual recorrente" color="text-violet-600" />
        <StatCard icon={Users} label="Usuários pagantes" value={String(stats.payingUsers)} sub={`de ${stats.totalUsers} total`} />
        <StatCard icon={CreditCard} label="Conversão" value={`${stats.conversionRate}%`} sub="Free → pago" color={stats.conversionRate > 20 ? 'text-emerald-600' : 'text-amber-600'} />
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-5">Receita por plano</h2>
        <div className="space-y-4">
          {stats.planStats.map(ps => (
            <div key={ps.plan}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${PLAN_COLORS[ps.plan] || 'bg-stone-300'}`} />
                  <span className="text-sm text-stone-700 font-medium">{PLAN_LABELS[ps.plan] || ps.plan}</span>
                  <span className="text-xs text-stone-400">{ps.count} usuário{ps.count !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-stone-800">{fmt(ps.revenue)}</span>
                  <span className="text-xs text-stone-400 ml-1">/ mês</span>
                </div>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${PLAN_COLORS[ps.plan] || 'bg-stone-300'}`}
                  style={{ width: `${Math.round((ps.count / maxCount) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 p-5 mb-6">
        <h2 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-4">Tabela de preços</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left py-2 text-stone-400 font-medium">Plano</th>
                <th className="text-right py-2 text-stone-400 font-medium">Preço/mês</th>
                <th className="text-right py-2 text-stone-400 font-medium">Usuários</th>
                <th className="text-right py-2 text-stone-400 font-medium">Receita/mês</th>
                <th className="text-right py-2 text-stone-400 font-medium">Receita/ano</th>
              </tr>
            </thead>
            <tbody>
              {stats.planStats.map(ps => (
                <tr key={ps.plan} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="py-2.5 font-medium text-stone-800">{PLAN_LABELS[ps.plan] || ps.plan}</td>
                  <td className="py-2.5 text-right text-stone-500">{fmt(planPrices[ps.plan] ?? 0)}</td>
                  <td className="py-2.5 text-right text-stone-700">{ps.count}</td>
                  <td className="py-2.5 text-right font-medium text-emerald-700">{fmt(ps.revenue)}</td>
                  <td className="py-2.5 text-right text-stone-500">{fmt(ps.revenue * 12)}</td>
                </tr>
              ))}
              <tr className="bg-stone-50 font-bold">
                <td className="py-2.5 text-stone-800">Total</td>
                <td />
                <td className="py-2.5 text-right text-stone-700">{stats.totalUsers}</td>
                <td className="py-2.5 text-right text-emerald-700">{fmt(stats.mrr)}</td>
                <td className="py-2.5 text-right text-stone-600">{fmt(stats.arr)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex gap-3">
        <ArrowUpRight className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Valores estimados.</strong> Os dados são calculados com base nos planos atribuídos aos perfis.
          Para receita real, integre um gateway de pagamento (Stripe, Pagar.me, Mercado Pago).
        </div>
      </div>
    </div>
  )
}
