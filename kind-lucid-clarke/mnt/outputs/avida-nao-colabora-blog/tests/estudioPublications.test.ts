import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import {
  rowToPublicacao, inputToRow, metricsToRow, statusLabel,
  type PublicacaoInput,
} from '../src/lib/estudioPublications.ts'

const input: PublicacaoInput = {
  status: 'pronto',
  titulo: 'Você não precisa dar conta de tudo',
  ideia: 'post sobre culpa e descanso',
  objetivos: ['salvar', 'compartilhar'],
  estilo: 'template',
  promptImagem: 'ilustração minimalista',
  legenda: 'Descansar não é prêmio.',
  hashtags: '#saudeemocional',
  primeiroComentario: 'Leia no blog.',
  formatos: ['feed-45', 'story'],
  publishMode: 'agendar',
  scheduledFor: '2026-09-03T19:00',
  postUrl: null,
}

test('inputToRow mapeia camelCase → snake_case e marca published_at só quando publicado', () => {
  const row = inputToRow(input)
  assert.equal(row.prompt_imagem, 'ilustração minimalista')
  assert.equal(row.primeiro_comentario, 'Leia no blog.')
  assert.equal(row.scheduled_for, '2026-09-03T19:00')
  assert.equal(row.published_at, null)
  assert.equal(inputToRow({ ...input, status: 'publicado' }).published_at !== null, true)
})

test('rowToPublicacao converte de volta e sanea tipos', () => {
  const p = rowToPublicacao({
    id: 'abc', status: 'rascunho', titulo: 't', objetivos: ['x', 1, 'y'],
    formatos: null, publish_mode: 'manual', alcance: 300, salvos: 'nao', created_at: '2026-08-31',
  })
  assert.equal(p.id, 'abc')
  assert.deepEqual(p.objetivos, ['x', 'y'])
  assert.deepEqual(p.formatos, [])
  assert.equal(p.publishMode, 'manual')
  assert.equal(p.alcance, 300)
  assert.equal(p.salvos, null)
})

test('metricsToRow usa as colunas certas', () => {
  const row = metricsToRow({ alcance: 3100, salvos: 200, compartilhamentos: 90, cliquesBlog: 44, cadastros: 7 })
  assert.equal(row.cliques_blog, 44)
  assert.equal(row.compartilhamentos, 90)
})

test('statusLabel cobre os três estados', () => {
  assert.equal(statusLabel('rascunho'), 'Rascunho')
  assert.equal(statusLabel('pronto'), 'Pronto para publicar')
  assert.equal(statusLabel('publicado'), 'Publicado')
})

test('store não é importável no node (usa supabase) — validação por texto', () => {
  const src = readFileSync(new URL('../src/lib/estudioPublicationsStore.ts', import.meta.url), 'utf8')
  assert.match(src, /const TABLE = 'estudio_publicacoes'/)
  assert.match(src, /from\(TABLE\)/)
  assert.doesNotMatch(src, /service_role|SERVICE_ROLE|API_KEY/)
})

test('migration da tabela é aditiva, admin-only e datada acima das existentes', () => {
  const dir = new URL('../supabase/migrations/', import.meta.url)
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  const mine = '20260831140000_estudio_publicacoes.sql'
  assert.ok(files.includes(mine), 'a migration precisa existir')
  // datada acima da maior anterior
  const prev = files[files.indexOf(mine) - 1]
  assert.ok(prev < mine, `timestamp deve ser maior que ${prev}`)

  const sql = readFileSync(new URL(mine, dir), 'utf8')
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.estudio_publicacoes/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /USING \(public\.is_admin\(\)\)\s*\n\s*WITH CHECK \(public\.is_admin\(\)\)/)
  assert.match(sql, /REVOKE ALL ON public\.estudio_publicacoes FROM anon/)
  assert.doesNotMatch(sql, /\bDROP TABLE\b|\bALTER TABLE public\.(profiles|articles|subscriptions)\b/)
  // marketing não toca no Diário
  assert.match(sql, /nunca contém dados do Diário/)
})
