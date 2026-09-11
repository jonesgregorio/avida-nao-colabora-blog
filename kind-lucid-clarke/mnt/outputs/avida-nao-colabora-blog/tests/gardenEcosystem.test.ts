import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const ui=fs.readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const sql=fs.readFileSync(new URL('../supabase/migrations/20260909123000_garden_balanced_growth_v4.sql',import.meta.url),'utf8')
const engine=fs.readFileSync(new URL('../src/lib/livingGardenEngine.ts',import.meta.url),'utf8')
const livingGarden=fs.readFileSync(new URL('../src/components/garden/LivingGarden.tsx',import.meta.url),'utf8')

test('garden growth blocks a single checkin and uses balanced 60-step cycles',()=>{
 assert.match(sql,/raw_growth < 3 THEN 0/)
 assert.match(sql,/active_days < 2 AND diversity < 2 THEN 0/)
 assert.match(sql,/garden_progress < 3 THEN 0/)
 assert.match(sql,/garden_progress < 10 THEN 1/)
 assert.match(sql,/floor\(growth \/ 60\.0\)::int AS garden_index/)
 assert.match(sql,/\(growth % 60\)::int AS garden_progress/)
 assert.match(sql,/entry_type = 'checkin'/)
 assert.match(sql,/entry_type = 'diary'/)
 assert.match(sql,/questionnaire_responses/)
 assert.match(sql,/reading_history/)
 assert.match(sql,/care_plan_action_state/)
 assert.match(sql,/user_history_items/)
})

test('garden has no terminal cycle and creates a new garden automatically',()=>{
 assert.match(sql,/'completed_gardens', garden_index/)
 assert.match(sql,/'growth_model_version', 4/)
 assert.match(ui,/O jardim nunca termina/)
 assert.match(ui,/outro surgirá automaticamente/)
 assert.match(ui,/Memórias do Jardim/)
 assert.match(ui,/themeFor\(gardenIndex\)/)
})

test('garden RPC is private to authenticated owner context',()=>{
 assert.match(sql,/auth\.uid\(\)/)
 assert.match(sql,/SECURITY DEFINER/)
 assert.match(sql,/REVOKE ALL[\s\S]*PUBLIC, anon/)
 assert.match(sql,/GRANT EXECUTE[\s\S]*authenticated/)
})

test('garden scene has ecosystem dependencies and grounded composition',()=>{
 // cada elemento só aparece depois do anterior — composição com dependências reais, do
 // primeiro broto até um canto de descanso junto à água (substitui o SVG por estágios fixos).
 assert.match(ui,/stage:1,name:'Primeiros brotos'/)
 assert.match(ui,/stage:2,name:'Flores'/)
 assert.match(ui,/stage:3,name:'Árvore'/)
 assert.match(ui,/stage:4,name:'Vida'/)
 assert.match(ui,/stage:5,name:'Recanto'/)
 assert.match(ui,/stage:6,name:'Luz'/)
 assert.match(ui,/unlocked=ELEMENTS\.filter\(e=>stage>=e\.stage\)/)
 // a cena de fundo (imagem + movimento) é a mesma composição, ancorada ao jardim e ao
 // progresso contínuo — não um enfeite solto.
 assert.match(ui,/<LivingGarden theme=\{theme\} progress=\{gardenProgress\}\/>/)
})

test('garden uses a detailed layered scene with visible fauna and depth',()=>{
 // a cena real (fotorrealista + canvas) tem fauna própria — não é mais SVG estático.
 assert.match(engine,/function drawFlyer/)
 assert.match(engine,/function drawSwallows/)
 assert.match(engine,/function drawKoi/)
 assert.match(engine,/function drawWater/)
 // profundidade real: cada partícula/animal tem seu próprio campo de profundidade (paralaxe
 // individual), não uma sombra estática por camada.
 assert.match(engine,/depth: 0\.\d+ \+ R\(\) \* 0\.\d+/)
 assert.match(engine,/pointer\.tx \* \d+ \* p\.depth/)
 // as camadas (imagem em 4 estágios + água + ar) são montadas pelo componente React.
 assert.match(livingGarden,/theme\.stages\.map/)
 assert.match(livingGarden,/canvas ref=\{waterRef\}/)
 assert.match(livingGarden,/canvas ref=\{airRef\}/)
})

test('garden explicitly avoids gamified pressure and uses official care-plan name',()=>{
 assert.match(ui,/Sem streak/i)
 assert.match(ui,/Sem punição/i)
 assert.match(ui,/Um Check-in isolado não cria uma transformação/)
 assert.match(ui,/Plano de Autocuidado/)
 assert.doesNotMatch(ui,/Plano Vivo|Plano vivo|plano vivo/)
 assert.doesNotMatch(ui,/\+\d+ XP|Nível \{/)
})
