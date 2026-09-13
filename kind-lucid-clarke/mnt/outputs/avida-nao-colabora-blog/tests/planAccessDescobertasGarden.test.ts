import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getEffectivePlan,hasPlanAccess,type PlanKey } from '../src/lib/officialPlans.ts'
const descobertas=readFileSync(new URL('../src/components/DescobertasPage.tsx',import.meta.url),'utf8')
const garden=readFileSync(new URL('../src/components/MyGardenPage.tsx',import.meta.url),'utf8')
const maisPage=readFileSync(new URL('../src/components/MaisPage.tsx',import.meta.url),'utf8')
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8')
test('DescobertasPage aplica gate Essencial como defesa própria',()=>{assert.match(descobertas,/hasPlanAccess\(plan,\s*'essential'\)/);assert.match(descobertas,/disponível a partir do plano Essencial/i)})
// O gate de plano em si continua o mesmo (hasPlanAccess(...,'essential')); o que mudou é que
// o bloqueio final usa effectiveAccess (access OU desbloqueio temporário por campanha, ver
// tests/gardenTemporaryUnlock.test.ts) em vez de "access" puro — access nunca é contornado
// por conta própria, só quando o Admin ativa "Desbloqueio temporário" numa campanha real.
test('MyGardenPage aplica gate Essencial como defesa própria (com desbloqueio temporário opcional por campanha)',()=>{assert.match(garden,/hasPlanAccess\(getEffectivePlan\(profile\),\s*'essential'\)/);assert.match(garden,/const tempUnlocked=!access&&Boolean\(campaign\?\.temporary_unlock\)/);assert.match(garden,/if\s*\(\s*!effectiveAccess\s*\)\s*\{/);assert.match(garden,/Disponível a partir do plano Essencial/i)})
test('MaisPage não expõe mais o card Meu Jardim',()=>{assert.doesNotMatch(maisPage,/title:'Meu Jardim'/)})
test('App passa profile ao MyGardenPage',()=>{assert.match(app,/<MyGardenPage userId=\{user\.id\} profile=\{accessProfile\}/)})
function access(plan:PlanKey,unlimited=false){return hasPlanAccess(getEffectivePlan({plan,unlimited_access:unlimited}),'essential')}
test('matriz de acesso a Descobertas/Meu Jardim',()=>{assert.equal(access('free'),false);assert.equal(access('essential'),true);assert.equal(access('plus'),true)})
test('unlimited_access equivale a Plus',()=>{assert.equal(access('free',true),true)})
