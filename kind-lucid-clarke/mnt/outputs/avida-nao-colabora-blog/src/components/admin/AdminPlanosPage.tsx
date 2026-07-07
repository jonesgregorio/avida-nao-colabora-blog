import { useState } from 'react'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import AdminPlans from './AdminPlans'

// Planos e assinaturas — fiel ao mockup (#planos): 3 price-cards + Regras de acesso.
const PLANS = [
  {
    name: 'Gratuito', tagline: 'Comece a se entender', price: 'R$ 0', highlight: false,
    benefits: ['Blog aberto', 'Diário emocional básico', 'Questionário inicial', 'Algumas práticas guiadas'],
  },
  {
    name: 'Essencial', tagline: 'Acompanhe seus padrões', price: 'R$ 19,90/mês', highlight: true,
    benefits: ['Diário ilimitado', 'Mapa emocional completo', 'Histórico e gráficos', 'Conteúdos guiados completos', 'Relatório semanal automático'],
  },
  {
    name: 'Plus', tagline: 'Receba orientação para agir', price: 'R$ 39,90/mês', highlight: false,
    benefits: ['Tudo do Essencial', 'Plano de autocuidado mensal', 'Relatório mensal aprofundado', 'Comentário profissional mensal', 'Orientação mensal por mensagem'],
  },
]

const RULES: [string, string, string, string][] = [
  ['Diário emocional', 'Básico', 'Completo', 'Completo'],
  ['Mapa emocional', 'Inicial', 'Completo', 'Completo'],
  ['Conteúdos guiados', 'Parcial', 'Completo', 'Completo'],
  ['Plano de autocuidado', 'Não incluso', 'Não incluso', 'Mensal'],
  ['Orientação profissional', 'Não incluso', 'Não incluso', '1 por mês'],
]

export default function AdminPlanosPage() {
  const [config, setConfig] = useState(false)

  if (config) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <button onClick={() => setConfig(false)} className="inline-flex items-center gap-1.5 text-sm text-forest-700 hover:text-forest-900 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar aos planos
        </button>
        <AdminPlans />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-3xl text-forest-900">Planos e assinaturas</h1>
          <p className="text-sm text-ink-soft mt-1">Configure preços, limites, permissões e integração de pagamento.</p>
        </div>
        <button onClick={() => setConfig(true)} className="inline-flex items-center gap-2 border border-line bg-white px-4 py-2 rounded-xl text-sm text-forest-800 font-medium hover:border-forest-300 transition-colors">
          <RefreshCw className="w-4 h-4" /> Configurar preços e permissões
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(p => (
          <div key={p.name} className={`bg-white rounded-2xl p-6 flex flex-col ${p.highlight ? 'border-2 border-forest-900 shadow-md' : 'border border-line'}`}>
            {p.highlight && <span className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full bg-mint text-forest-700 mb-2">Mais escolhido</span>}
            <h2 className="font-serif text-2xl text-forest-900">{p.name}</h2>
            <p className="text-sm text-ink-soft">{p.tagline}</p>
            <div className="font-serif text-3xl text-forest-900 my-3">{p.price}</div>
            <ul className="space-y-2 flex-1 mb-5">
              {p.benefits.map(b => (
                <li key={b} className="flex items-start gap-2 text-sm text-ink">
                  <span className="text-forest-600 font-bold leading-5">✓</span>{b}
                </li>
              ))}
            </ul>
            <button onClick={() => setConfig(true)} className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${p.highlight ? 'bg-forest-900 text-white hover:bg-forest-800' : 'border border-line text-forest-800 hover:border-forest-300'}`}>
              Editar
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-line rounded-2xl p-6 mt-5">
        <h2 className="font-serif text-2xl text-forest-900 mb-4">Regras de acesso</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Funcionalidade</th>
                <th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Gratuito</th>
                <th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide bg-mint/30">Essencial</th>
                <th className="px-4 py-3 text-ink-soft font-medium uppercase text-xs tracking-wide">Plus</th>
              </tr>
            </thead>
            <tbody>
              {RULES.map(r => (
                <tr key={r[0]} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-forest-900 font-medium">{r[0]}</td>
                  <td className="px-4 py-3 text-center text-ink">{r[1]}</td>
                  <td className="px-4 py-3 text-center text-ink bg-mint/30">{r[2]}</td>
                  <td className="px-4 py-3 text-center text-ink">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
