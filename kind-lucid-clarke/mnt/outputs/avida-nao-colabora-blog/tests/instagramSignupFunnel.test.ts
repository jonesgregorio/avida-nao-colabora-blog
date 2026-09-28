import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
const read=(p:string)=>fs.readFileSync(path.resolve(process.cwd(),p),'utf8')

test('/ig usa landing dedicada mobile-first',()=>{const main=read('src/main.tsx'),landing=read('src/components/InstagramLanding.tsx');assert.match(main,/pathname === '\/ig'/);assert.match(landing,/Como você está hoje\?/);assert.match(landing,/Fazer meu primeiro check-in grátis/);assert.match(landing,/Sem cartão\. Privado\./);assert.match(landing,/não substitui psicoterapia/)})
test('landing preserva UTMs e abre cadastro explícito',()=>{const s=read('src/components/InstagramLanding.tsx');for(const k of ['utm_source','utm_medium','utm_campaign','utm_content'])assert.ok(s.includes(k));assert.match(s,/modo.*cadastro/);assert.match(s,/signup_cta_click/);assert.match(s,/ig_landing_view/)})
test('home abre diretamente o cadastro',()=>{const s=read('src/components/Hero.tsx');assert.match(s,/\/login\?modo=cadastro/);assert.doesNotMatch(s,/onNavigate\('auth'\)/)})
test('auth respeita modo cadastro e reduz campos',()=>{const s=read('src/components/Auth.tsx');assert.match(s,/get\('modo'\).*cadastro/);assert.doesNotMatch(s,/confirmPassword/);assert.doesNotMatch(s,/Nome completo/);assert.match(s,/autoComplete="new-password"/);assert.match(s,/disabled=\{loading\}/)})
test('analytics do funil não envia conteúdo emocional nem credenciais',()=>{const s=read('src/components/Auth.tsx')+read('src/components/InstagramLanding.tsx');for(const ev of ['ig_landing_view','signup_cta_click','signup_view','signup_start','signup_submit','signup_success','signup_error','email_verification_required','email_verified'])assert.ok(s.includes(ev));assert.doesNotMatch(s,/trackEvent\([^\n]*(password|emotion|mood|diary)/i)})
