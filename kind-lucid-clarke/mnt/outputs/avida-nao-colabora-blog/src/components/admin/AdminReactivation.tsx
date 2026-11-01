import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, ShieldCheck, Mail, Clock3, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Operations = { total: number; sent: number; delivered: number; failed: number; pending: number; last_sent_at: string | null; recent: Array<{ created_at: string; status: string; template_key: string; sent_at: string | null; delivered_at: string | null; error: string | null }> }

type Summary = {
  registered: number
  activated: number
  tracked_multi_day: number
  tracked_one_day: number
  tracking_missing: number
  eligible_d7: number
  retained_d7: number
}

export default function AdminReactivation() {
  const [data, setData] = useState<Summary | null>(null)
  const [operations, setOperations] = useState<Operations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState('')
  const sendAuthorizedTest = async () => {
    if (!window.confirm('Enviar um único e-mail de TESTE para jonesgregory.jg@gmail.com? O link de descadastro do e-mail é real.')) return
    setTestBusy(true); setTestResult('')
    try {
      const { data: recipients, error: recipientError } = await supabase.rpc('admin_reactivation_test_recipient')
      if (recipientError) throw recipientError
      const target = (recipients as Array<{ user_id: string; email: string }> | null)?.[0]
      if (!target || target.email.toLowerCase() !== 'jonesgregory.jg@gmail.com') throw new Error('Destinatário de teste não encontrado')
      const { data, error: sendError } = await supabase.functions.invoke('send-transactional-email', {
        body: { user_id: target.user_id, to_email: target.email, template_key: 'selfcare_reactivation_test',
          variables: { nome: 'Jones', cta_link: 'https://avidanaocolabora.com/', link_preferencias: 'https://avidanaocolabora.com/perfil' },
          idempotency_key: `selfcare_reactivation_test:${target.user_id}:v1`,
          metadata: { kind: 'authorized_reactivation_test' } }
      })
      if (sendError || data?.error || data?.skipped) throw new Error(sendError?.message ?? data?.error ?? 'Envio ignorado')
      setTestResult('Solicitação processada. Confira a caixa de entrada e o histórico de e-mails para confirmar a entrega.')
      void load()
    } catch (e) { setTestResult(e instanceof Error ? e.message : 'Erro ao solicitar envio') }
    finally { setTestBusy(false) }
  }
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const [response, ops] = await Promise.all([supabase.rpc('admin_retention_summary'), supabase.rpc('admin_reactivation_operations')])
    if (response.error || ops.error) setError(response.error?.message ?? ops.error?.message ?? 'Falha ao carregar dados')
    else { setData(response.data as Summary); setOperations(ops.data as Operations) }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const cards = [
    ['Contas registradas', data?.registered],
    ['Com registro de diário', data?.activated],
    ['Atividade em vários dias', data?.tracked_multi_day],
    ['Sem navegação rastreada', data?.tracking_missing],
  ]

  return <div className="p-4 sm:p-6 space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="admin-kicker">Relacionamento</p>
        <h2 className="font-serif text-2xl text-forest-900">Retenção e Reativação</h2>
        <p className="text-sm text-ink-soft mt-1">Acompanhamento agregado sem acesso ao conteúdo emocional dos registros.</p>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading} className="admin-btn-secondary">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
      </button>
    </div>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map(([label, value]) => <div key={String(label)} className="admin-card p-4">
        <p className="text-xs text-ink-soft">{label}</p>
        <p className="font-serif text-2xl text-forest-900 mt-2">{loading ? '…' : value ?? '—'}</p>
      </div>)}
    </div>
    <section className="admin-card p-4 space-y-2">
      <h3 className="font-serif text-xl text-forest-900">Retenção no sétimo dia (D7)</h3>
      <p className="text-2xl font-semibold text-forest-900">{data ? `${data.retained_d7} / ${data.eligible_d7}` : '—'}</p>
      <p className="text-xs text-ink-soft">Contas com visita rastreada no sétimo dia após o cadastro, entre contas com pelo menos sete dias. A ausência de rastreamento pode subestimar o retorno real.</p>
    </section>
    <section className="admin-card p-4 space-y-4">
      <h3 className="font-serif text-xl text-forest-900">Histórico de reativação</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">{([['Tentativas',operations?.total],['Enviados',operations?.sent],['Entregues',operations?.delivered],['Falhas',operations?.failed]] as const).map(([name,value]) => <div key={name} className="rounded-xl bg-paper-soft p-3"><p className="text-ink-soft">{name}</p><p className="text-xl font-semibold text-forest-900">{value ?? '—'}</p></div>)}</div>
      <p className="text-sm text-ink-soft">Pendentes: {operations?.pending ?? '—'} · Último envio: {operations?.last_sent_at ? new Date(operations.last_sent_at).toLocaleString('pt-BR') : 'Nenhum'}</p>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left border-b"><th className="py-2">Data</th><th>Status</th><th>Template</th><th>Detalhes</th></tr></thead><tbody>{operations?.recent.map((item,i) => <tr key={`${item.created_at}-${i}`} className="border-b"><td className="py-2">{new Date(item.created_at).toLocaleString('pt-BR')}</td><td>{item.status}</td><td>{item.template_key}</td><td>{item.error ?? '—'}</td></tr>)}</tbody></table>{operations?.recent.length === 0 && <p className="py-4 text-ink-soft">Nenhuma tentativa de reativação registrada.</p>}</div>
    </section>
    <section className="admin-card p-4 space-y-3">
      <h3 className="font-serif text-xl text-forest-900">Teste autorizado de entrega</h3>
      <p className="text-sm text-ink-soft">Destinatário fixo: jonesgregory.jg@gmail.com. Teste separado da campanha automática; exige autenticação administrativa reforçada. O descadastro no e-mail é real.</p>
      <button type="button" className="admin-btn-secondary" disabled={testBusy} onClick={() => void sendAuthorizedTest()}>{testBusy ? 'Enviando…' : 'Enviar e-mail de teste'}</button>
      {testResult && <p role="status" className="text-sm text-ink-soft">{testResult}</p>}
    </section>
    <section className="admin-card p-4 space-y-4">
      <h3 className="font-serif text-xl text-forest-900">Automação de reativação</h3>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-paper-soft p-3"><Clock3 className="w-4 h-4 mb-2 text-forest-700" />Agendamento: diariamente às 10h15 (Brasília)</div>
        <div className="rounded-xl bg-paper-soft p-3"><ShieldCheck className="w-4 h-4 mb-2 text-forest-700" />Somente usuários com consentimento explícito</div>
        <div className="rounded-xl bg-paper-soft p-3"><Mail className="w-4 h-4 mb-2 text-forest-700" />Limite técnico atual: até 20 tentativas por execução</div>
      </div>
      <div className="flex gap-2 text-sm text-ink-soft"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        O painel ainda não consulta o estado da chave de envio nem a quantidade de candidatos. Nenhum envio pode ser ativado por esta tela. Não interprete estes indicadores como confirmação de envio.
      </div>
    </section>
  </div>
}
