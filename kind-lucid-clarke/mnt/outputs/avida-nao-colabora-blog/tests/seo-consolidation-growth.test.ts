import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=(p:string)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const guide=read('api/guide.js')
const clusters=read('src/lib/seoGuides.ts')
const migration=read('supabase/migrations/20260917184500_seo_consolidation_internal_linking.sql')

test('guias SSR usam slugs públicos reais e não aliases antigos',()=>{
  assert.match(guide,/como-conversar-sobre-os-seus-limites-sem-transformar-tudo-em/)
  assert.match(guide,/como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigaca/)
  assert.doesNotMatch(guide,/como-conversar-sobre-seus-limites-sem-transformar-tudo-em-conflito/)
  assert.doesNotMatch(guide,/como-usar-o-diario-gratuito-sem-transformar-isso-em-obrigacao/)
})

test('seis guias ganham conteúdo SSR útil, perguntas e múltiplas leituras',()=>{
  for(const key of ['diario-emocional','emocoes-autoconhecimento','sobrecarga-emocional','autocuidado-emocional','sono-descanso-energia','relacoes-limites']) assert.match(guide,new RegExp(`'${key}'`))
  assert.match(guide,/Perguntas para observar/)
  assert.match(guide,/g\.readings\.map/)
  assert.match(guide,/g\.sections\.map/)
  assert.match(guide,/Não substitui avaliação, diagnóstico ou acompanhamento profissional/)
})

test('hub de guias oferece orientação editorial substancial',()=>{
  const hub=read('api/guides.js')
  assert.match(hub,/Como usar estes guias/)
  assert.match(hub,/Se você ainda não sabe por onde começar/)
  assert.match(hub,/Leitura e prática podem caminhar juntas/)
  assert.match(hub,/O que estes materiais não fazem/)
  assert.match(hub,/avaliação profissional pode ser necessária/)
})

test('títulos SEO server-side são curtos e separados do H1 editorial',()=>{
  assert.match(guide,/seoTitle:'Diário emocional: como começar'/)
  assert.match(guide,/seoTitle:'Sono e descanso: organizar a rotina'/)
  assert.match(guide,/seoTitle:'Relações e limites: colocar limites'/)
  assert.match(guide,/title=`\$\{g\.seoTitle\} — A Vida Não Colabora`/)
})

test('diário inclui a página antes órfã na jornada curada',()=>{
  assert.match(clusters,/3-perguntas-para-fechar-o-dia-com-mais-clareza/)
})

test('migration remove alvos inexistentes e cria links públicos recíprocos',()=>{
  assert.match(migration,/3-perguntas-para-fechar-o-dia-com-mais-clareza/)
  assert.match(migration,/perguntas-simples-para-entender-como-voce-esta-hoje/)
  assert.doesNotMatch(migration,/como-identificar-padroes-nos-seus-registros-emocionais/)
  assert.doesNotMatch(migration,/como-perceber-ciclos-que-se-repetem-ao-longo-do-mes/)
  assert.doesNotMatch(migration,/como-ler-seu-mes-emocional-com-mais-profundidade/)
})

test('pacote não altera superfícies sensíveis',()=>{
  const source=(guide+'\n'+clusters+'\n'+migration).replace(/--.*$/gm,'')
  assert.doesNotMatch(source,/stripe|subscription|user_subscriptions|profiles|diary_entries|garden_/i)
})


test('P2 conecta conteúdo público de sono já existente ao cluster oficial',()=>{
  assert.match(clusters,/como-as-telas-atrapalham-o-sono-e-o-que-mudar-gxmen-y7n/)
  assert.match(guide,/como-as-telas-atrapalham-o-sono-e-o-que-mudar-gxmen-y7n/)
})

test('P2 preserva exatamente seis clusters oficiais',()=>{
  for(const cluster of ['Diário emocional','Emoções e autoconhecimento','Sobrecarga emocional','Autocuidado emocional','Sono, descanso e energia','Relações e limites']) assert.match(clusters,new RegExp(cluster))
})
