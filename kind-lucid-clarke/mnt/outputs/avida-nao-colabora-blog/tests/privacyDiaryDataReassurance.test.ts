import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// Achado: a página real de Privacidade vem do CMS (site_pages), semeado em
// 20260903120000_site_content_cms.sql — PrivacyPage.tsx é só o fallback
// quando a linha não existe no banco. Uma alteração só no componente não
// muda o que o visitante vê em produção; por isso os dois precisam mudar
// juntos, e a mudança em produção precisa ser uma migration UPDATE (nunca
// editando a migration histórica do seed).
test('a Política de Privacidade (CMS e fallback) não lista dados do diário como um inventário técnico cru', () => {
  const migration = read('supabase/migrations/20260916070000_privacy_reassure_diary_data_wording.sql')
  assert.match(migration, /update public\.site_pages/)
  assert.match(migration, /where slug = 'privacidade'/)
  // idempotente: só troca se o texto antigo ainda bater — preserva edição manual do admin
  assert.match(migration, /body_md like '%/)
  assert.doesNotMatch(
    migration,
    /alter table|drop table/i,
    'só ajusta conteúdo (UPDATE), não deve alterar esquema',
  )

  const fallback = read('src/components/PrivacyPage.tsx')
  assert.doesNotMatch(
    fallback,
    /marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos que você registrar/,
    'lista crua de tudo que o diário processa não pode voltar ao fallback',
  )
  assert.match(fallback, /Ninguém da nossa equipe lê seus registros por rotina ou curiosidade/)
})
