import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const migration = read('supabase/migrations/20260907240000_admin_communications.sql')
const comp = read('src/components/admin/AdminCommunicationCampaigns.tsx')
const area = read('src/components/admin/AdminAreaComunicacao.tsx')

test('a tabela de campanhas guarda alvo, status e agendamento e é admin-only (RLS)', () => {
  assert.match(migration, /create table if not exists public\.admin_communications/i)
  assert.match(migration, /target_kind\s+text[\s\S]*?check \(target_kind in \('all','plan','segment','user'\)\)/i)
  assert.match(migration, /status[\s\S]*?check \(status in \('draft','scheduled','sending','sent','failed','canceled'\)\)/i)
  assert.match(migration, /create policy "admin_communications_all"[\s\S]*?using \(public\.is_admin\(\)\) with check \(public\.is_admin\(\)\)/i)
})

test('a entrega in-app é idempotente por campanha', () => {
  assert.match(migration, /'campaign', c\.id::text/)
  assert.match(migration, /where not exists \(\s*\n\s*select 1 from public\.notifications n\s*\n\s*where n\.user_id = a\.user_id\s*\n\s*and n\.action_data->>'campaign' = c\.id::text/i)
})

test('o alvo por segmento reaproveita admin_segment_match (Etapa 6)', () => {
  assert.match(migration, /from public\.admin_segment_match\(\s*\n?\s*\(select s\.filter from public\.admin_segments s where s\.id = p_segment_id\)/i)
})

test('e-mail em massa NÃO é disparado pela campanha', () => {
  assert.match(migration, /if c\.channel = 'email' then\s*\n\s*raise exception 'envio de e-mail em massa passa pelo pipeline de e-mail/i)
  assert.match(comp, /Envio de e-mail em massa passa pelo pipeline de e-mail/)
})

test('as funções internas/cron não são expostas ao cliente', () => {
  assert.match(migration, /revoke all on function public\._deliver_communication\(uuid\) from public, anon, authenticated/i)
  assert.match(migration, /revoke all on function public\.admin_process_due_communications\(\) from public, anon, authenticated/i)
  assert.match(migration, /grant execute on function public\.admin_communication_send\(uuid\) to authenticated/i)
})

test('há um cron para processar campanhas agendadas, tolerante a pg_cron ausente', () => {
  assert.match(migration, /cron\.schedule\('process-scheduled-communications', '\*\/5 \* \* \* \*'/)
  assert.match(migration, /exception when others then\s*\n\s*raise notice 'pg_cron indisponível/i)
})

test('a tela tem rascunho, agendamento, teste, contagem antes do envio e confirmação', () => {
  assert.match(comp, /supabase\.rpc\('admin_communication_estimate'/)
  assert.match(comp, /supabase\.rpc\('admin_communication_send'/)
  assert.match(comp, /Salvar rascunho/)
  assert.match(comp, /Enviar teste/)
  assert.match(comp, /window\.confirm\(/)
  assert.match(comp, /destinatário\(s\)/)
  assert.match(comp, /logAdminAction\('config', 'communication_send'/)
  assert.match(area, /tab === 'campanhas'\s*&& <AdminCommunicationCampaigns initialCampaignId=\{initialCampaignId\} \/>/)
})
