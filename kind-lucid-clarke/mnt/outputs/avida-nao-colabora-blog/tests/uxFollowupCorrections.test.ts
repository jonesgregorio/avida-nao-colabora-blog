import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const layout = read('src/components/user/UserLayout.tsx')
const articles = read('src/components/Articles.tsx')
const care = read('src/components/SelfCarePlanPage.tsx')
const reports = read('src/components/ReportsHome.tsx')
const discoveries = read('src/components/DescobertasPage.tsx')
const history = read('src/components/MyHistoryPage.tsx')

test('Conta fica compacta no sidebar e Perfil permanece no avatar', () => {
  assert.match(layout, /label: 'Conta'.*description: 'Meu Plano e Suporte'/s)
  const accountBlock = layout.match(/const ACCOUNT_NAV:[\s\S]*?\n\]/)?.[0] ?? ''
  assert.doesNotMatch(accountBlock, /label: 'Perfil'/)
  assert.match(layout, /label="Minha conta" onClick=\{\(\) => go\('profile'\)\}/)
  assert.match(layout, /label: 'Meu Plano'/)
  assert.match(layout, /label: 'Suporte'/)
})

test('Conteúdos diferencia catálogo, histórico de leitura e prática', () => {
  assert.match(articles, /'all' \| 'history' \| 'practice'/)
  assert.match(articles, /fetchReadSlugs/)
  assert.match(articles, /Minhas leituras/)
  assert.match(articles, /readSlugs\.has\(it\.slug\)/)
  assert.doesNotMatch(articles, /\['read', 'Ler'/)
  assert.match(articles, /Praticar/)
})

test('Cuidar usa o nome completo e explica a experiência do Plano de Autocuidado', () => {
  assert.match(layout, /label: 'Plano de Autocuidado'/)
  assert.match(care, /Como usar seu plano/)
  assert.match(care, /Três passos, sem obrigação de completar tudo/)
  assert.match(care, /1\. Escolha/)
  assert.match(care, /2\. Experimente/)
  assert.match(care, /3\. Conte como foi/)
  assert.match(care, /Em prática neste ciclo/)
})

test('Relatórios deixam semanal e mensal visual e conceitualmente distintos', () => {
  assert.match(reports, /Fechamento curto/)
  assert.match(reports, /Leitura aprofundada/)
  assert.match(reports, /Semanal responde: “como foram meus últimos dias\?”/)
  assert.match(reports, /Mensal responde: “o que este mês mostra quando vejo o conjunto\?”/)
  assert.match(reports, /retrospectiva semanal/)
  assert.match(reports, /leitura mensal/)
  assert.match(reports, /type==='weekly'\?'retrospectiva semanal':'leitura mensal'/)
})

test('Descobertas oferece próximo passo sem mudar o motor de detecção', () => {
  assert.match(discoveries, /buildHomeDiscoveries/)
  assert.match(discoveries, /O que você quer fazer com essa percepção\?/)
  assert.match(discoveries, /Explorar no Mapa/)
  assert.match(discoveries, /Levar para o cuidado/)
  assert.match(discoveries, /Registrar algo novo/)
  assert.match(discoveries, /Nenhum trecho do texto livre do seu diário é usado nesta área/)
})

test('Minha História usa o nome completo e preserva as funções existentes', () => {
  assert.match(layout, /label: 'Minha História'/)
  assert.match(history, />Minha História</)
  assert.match(history, /Resumo por ano/)
  assert.match(history, /Adicionar marco pessoal/)
  assert.match(history, /Gerenciar história/)
  assert.match(history, /Sua trajetória em ordem cronológica/)
})
