import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sql = read('supabase/migrations/20260930230000_garden_release_modes.sql')
const page = read('src/components/MyGardenPage.tsx')
const admin = read('src/components/admin/AdminGardenManagement.tsx')

test('modo free não grava o jardim sozinho; global e híbrido continuam gravando a fila', () => {
  assert.match(sql, /select coalesce\(\(select s\.release_mode from garden_settings s where s\.id = true\), 'global'\) into v_mode/)
  assert.match(sql, /if v_mode <> 'free' then\s+insert into garden_user_cycles/)
  // o jardim forçado pelo Admin e o ciclo já gravado continuam vencendo antes da fila
  const forced = sql.indexOf('p_forced_slug is not null')
  const stored = sql.indexOf('from garden_user_cycles c where c.user_id = p_user_id and c.cycle_number = p_cycle')
  const queue = sql.indexOf("order by g.queue_position nulls last")
  assert.ok(forced > 0 && forced < stored && stored < queue)
})

test('escolha e troca: só free/hybrid, só jardins disponíveis, jardim forçado trava, ciclos passados intactos', () => {
  assert.match(sql, /if v_mode not in \('free', 'hybrid'\) then raise exception/)
  assert.match(sql, /if v_forced is not null then raise exception/)
  assert.match(sql, /g\.status in \('active', 'queued'\) and \(g\.release_at is null or g\.release_at <= now\(\)\)/)
  // só toca o ciclo ATUAL da própria pessoa logada
  assert.match(sql, /values \(v_uid, v_cycle, p_slug, v_theme\)/)
  assert.doesNotMatch(sql, /delete from|update garden_user_cycles/i)
  assert.match(sql, /'needs_choice', \(v_mode = 'free' and v_current is null and v_forced is null\)/)
  assert.match(sql, /'can_switch', \(v_mode in \('free', 'hybrid'\) and v_forced is null\)/)
})

test('RPCs novas são só para usuários autenticados', () => {
  assert.match(sql, /revoke all on function public\.get_my_garden_choice\(\) from public, anon/)
  assert.match(sql, /revoke all on function public\.choose_my_garden\(text\) from public, anon/)
  assert.match(sql, /grant execute on function public\.get_my_garden_choice\(\) to authenticated/)
  assert.match(sql, /grant execute on function public\.choose_my_garden\(text\) to authenticated/)
  assert.doesNotMatch(sql, /to anon/)
})

test('Meu Jardim mostra a escolha quando o modo pede e oferece troca quando permitido', () => {
  assert.match(page, /loadMyGardenChoice\(\)\.then\(c=>\{if\(alive\)setChoice\(c\)\}\)/)
  assert.match(page, /const showChooser=Boolean\(choice&&\(choice\.needs_choice\|\|chooserOpen\)&&choice\.options\.length>0\)/)
  assert.match(page, /choice\?\.can_switch&&!choice\.needs_choice&&!showChooser/)
  assert.match(page, /Trocar de jardim/)
  assert.match(page, /setReloadTick\(t=>t\+1\)/)
})

test('trocar de jardim no mesmo ciclo não dispara a celebração de jardim concluído', () => {
  assert.match(page, /const cycleAdvanced=prevCycle==null\|\|Number\.isNaN\(prevCycle\)\|\|\(next\.garden_cycle\?\?0\)>prevCycle/)
  assert.match(page, /nextIndex>prev&&cycleAdvanced/)
  assert.match(page, /window\.localStorage\.setItem\(cycleKey,String\(next\.garden_cycle\?\?0\)\)/)
})

test('Admin explica o que cada modo faz de verdade (sem "só fica registrado")', () => {
  assert.doesNotMatch(admin, /ficam registrados como política/)
  assert.match(admin, /A pessoa escolhe o jardim de cada novo ciclo/)
  assert.match(admin, /a pessoa pode trocar de jardim durante o ciclo/)
  assert.match(admin, /Um jardim forçado pelo Admin para uma pessoa prevalece/)
})
