import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8').replace(/\r\n/g,'\n')
const estudio=read('../src/components/admin/AdminEstudio.tsx')
const index=read('../src/components/admin/index.tsx')
const layout=read('../src/components/admin/AdminLayout.tsx')
const types=read('../src/components/admin/types.ts')

test('Estúdio Social permanece registrado como área própria e aparece como Marketing',()=>{
 assert.match(types,/\|\s*'estudio'/)
 assert.match(index,/'estudio', 'cuidado'/)
 assert.match(index,/const AdminEstudio = lazy/)
 assert.match(index,/case 'estudio': return <AdminEstudio \/>/)
 assert.match(layout,/id: 'estudio', label: 'Marketing'/)
})
test('o Estúdio preserva as sete ferramentas, com secundárias em Avançado',()=>{for(const id of ['novo','calendario','grade','destaques','inspiracao','comunidade','desempenho'])assert.match(estudio,new RegExp(`id: '${id}'`));assert.match(estudio,/Ferramentas avançadas/)})
test('assistente mantém cinco passos e rascunho local',()=>{assert.match(estudio,/const STEPS = \['Ideia', 'Visual', 'Formatos', 'Textos', 'Pacote'\]/);assert.match(estudio,/localStorage\.setItem\(DRAFT_KEY/)})
test('formatos declaram dimensões do Instagram',()=>{assert.match(estudio,/1080 × 1350 · 4:5/);assert.match(estudio,/1080 × 1920 · 9:16/)})