import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/user/UserLayout.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('área logada preserva logo oficial e mantém a entrada principal como Hoje', () => {
  assert.match(source, /import \{ LogoIcon \} from '\.\.\/Logo'/)
  assert.match(source, /label: 'Hoje'/)
  assert.match(source, /<LogoIcon className=/)
})

test('desktop reduz destinos principais e agrupa detalhes por intenção', () => {
  for (const [id, label] of [['home','Hoje'], ['diary','Registrar'], ['descobertas','Evolução'], ['cuidar','Cuidar'], ['my-garden','Meu Jardim'], ['articles','Conteúdos'], ['mais','Conta']]) {
    assert.match(source, new RegExp(`id: '${id}'[\\s\\S]{0,80}label: '${label}'`), `destino principal ausente: ${label}`)
  }
  assert.match(source, /match: \['descobertas', 'my-evolution', 'my-report', 'my-history'\]/)
  assert.match(source, /match: \['cuidar', 'self-care', 'monthly-guidance', 'professional-comments', 'questionarios', 'questionnaire', 'questionarios-evolucao'\]/)
  assert.match(source, /match: \['mais', 'my-plan', 'profile', 'support', 'support-ticket', 'notifications'\]/)
})

test('mobile usa cinco intenções claras e substitui Mais por Conta', () => {
  assert.match(source, /const MOBILE_IDS = \['home', 'diary', 'descobertas', 'cuidar', 'mais'\]/)
  assert.match(source, /aria-label="Navegação principal"/)
  assert.match(source, /label: 'Conta'/)
  assert.doesNotMatch(source, /Mais recursos/)
  assert.match(source, /pb-24 lg:pb-0/)
})

test('Hoje recebe orquestração e páginas analíticas recebem contexto de Evolução', () => {
  assert.match(source, /<TodayJourney profile=\{profile\} onNavigate=\{onNavigate\}/)
  assert.match(source, /<EvolutionContext currentView=\{currentView\} onNavigate=\{onNavigate\}/)
})

test('nova arquitetura não ressuscita módulos legados nem gamificação', () => {
  assert.doesNotMatch(source, /label: 'Caixa de Cuidado'/)
  assert.doesNotMatch(source, /label: 'Trilhas'/)
  assert.doesNotMatch(source, /label: 'Meditações'/)
})

test('shell continua usando exclusivamente os tokens visuais oficiais do projeto', () => {
  assert.match(source, /bg-paper/)
  assert.match(source, /bg-sand-50/)
  assert.match(source, /text-forest-900/)
  assert.match(source, /bg-mint/)
  assert.match(source, /border-line/)
})
