import { useEffect, useState } from 'react'
import { CheckCircle2, Gauge, Loader2, PauseCircle, ShieldCheck } from 'lucide-react'
import {
  fetchIdea1RolloutSettings,
  saveIdea1RolloutSettings,
  type Idea1RolloutSettings,
} from '../../lib/idea1Rollout'

const PRESETS = [0, 10, 25, 50, 75, 100]

export default function AdminIdea1Rollout() {
  const [settings, setSettings] = useState<Idea1RolloutSettings>({ enabled: true, percentage: 100 })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const current = await fetchIdea1RolloutSettings()
      if (!active) return
      setSettings(current)
      setLoading(false)
    })()
    return () => { active = false }
  }, [])

  async function save() {
    if (saving) return
    setSaving(true)
    setMessage(null)
    try {
      const saved = await saveIdea1RolloutSettings(settings)
      setSettings(saved)
      setMessage({ type: 'ok', text: 'Liberação progressiva atualizada.' })
    } catch {
      setMessage({ type: 'err', text: 'Não foi possível salvar agora. Nenhuma regra de acesso foi alterada.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 sm:p-8" role="status">
        <div className="flex items-center gap-3 text-sm text-ink-soft">
          <Loader2 className="w-5 h-5 animate-spin text-forest-600" /> Carregando configuração de liberação…
        </div>
      </div>
    )
  }

  const effectivePercentage = settings.enabled ? settings.percentage : 0

  return (
    <div className="max-w-5xl mx-auto p-6 sm:p-8 space-y-5">
      <section className="rounded-3xl border border-line bg-paper-soft p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-forest-700">
              <Gauge className="w-5 h-5" />
              <p className="text-xs font-semibold uppercase tracking-[0.12em]">Liberação progressiva · Ideia 1</p>
            </div>
            <h2 className="font-serif text-2xl text-forest-900 mt-2">Novos convites de Foco da Semana</h2>
            <p className="text-sm text-ink-soft mt-2 leading-relaxed">
              Nesta fase, o controle vale somente para usuários que ainda não escolheram um Foco da Semana. Quem já tem um foco salvo ou uma reflexão pendente continua vendo e usando normalmente.
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${settings.enabled ? 'border-forest-200 bg-mint text-forest-800' : 'border-amber-200 bg-amber-50 text-[#765414]'}`}>
            {settings.enabled ? <CheckCircle2 className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
            {settings.enabled ? `${settings.percentage}% liberado` : 'Pausado'}
          </span>
        </div>

        <div className="mt-6 grid lg:grid-cols-[1fr_260px] gap-5">
          <div className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-forest-900">Liberação ativa</p>
                <p className="text-xs text-ink-soft mt-1">Desligar funciona como pausa operacional imediata para novos convites.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.enabled}
                onClick={() => setSettings(current => ({ ...current, enabled: !current.enabled }))}
                className={`relative w-12 h-7 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 ${settings.enabled ? 'bg-forest-700' : 'bg-[#747b76]'}`}
              >
                <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${settings.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                <span className="sr-only">{settings.enabled ? 'Pausar liberação' : 'Ativar liberação'}</span>
              </button>
            </div>

            <div className="mt-5 pt-5 border-t border-line">
              <div className="flex items-end justify-between gap-3">
                <label htmlFor="idea1-rollout-percentage" className="text-sm font-semibold text-forest-900">Percentual da coorte</label>
                <strong className="font-serif text-2xl text-forest-900">{settings.percentage}%</strong>
              </div>
              <input
                id="idea1-rollout-percentage"
                type="range"
                min="0"
                max="100"
                step="1"
                value={settings.percentage}
                onChange={event => setSettings(current => ({ ...current, percentage: Number(event.target.value) }))}
                className="w-full mt-3 accent-forest-800"
                disabled={!settings.enabled}
              />
              <div className="flex flex-wrap gap-2 mt-4" aria-label="Percentuais rápidos">
                {PRESETS.map(value => (
                  <button
                    key={value}
                    type="button"
                    disabled={!settings.enabled}
                    onClick={() => setSettings(current => ({ ...current, percentage: value }))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${settings.percentage === value ? 'border-forest-700 bg-forest-900 text-white' : 'border-line bg-paper-soft text-forest-800 hover:border-forest-300'}`}
                  >
                    {value}%
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-2xl border border-forest-100 bg-mint/35 p-4 sm:p-5">
            <ShieldCheck className="w-6 h-6 text-forest-700" />
            <p className="font-serif text-lg text-forest-900 mt-3">Coorte estável</p>
            <p className="text-xs text-ink-soft mt-2 leading-relaxed">
              Aproximadamente <strong className="text-forest-900">{effectivePercentage} em cada 100 usuários</strong> recebem o novo convite. O grupo é calculado pelo identificador da conta e não muda a cada acesso.
            </p>
          </aside>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-sand-50 px-4 py-3 text-xs text-ink-soft leading-relaxed">
          Este controle <strong className="text-forest-900">não altera planos, assinaturas, Stripe, Diário, Mapa Emocional, relatórios, conteúdos ou acessos contratados</strong>. Focos já salvos também não são ocultados.
        </div>

        {message && (
          <p role="status" className={`mt-4 text-sm ${message.type === 'ok' ? 'text-forest-700' : 'text-[#8a3b23]'}`}>{message.text}</p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-forest-900 hover:bg-forest-800 disabled:opacity-60 px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Salvando…' : 'Salvar liberação'}
          </button>
        </div>
      </section>
    </div>
  )
}
