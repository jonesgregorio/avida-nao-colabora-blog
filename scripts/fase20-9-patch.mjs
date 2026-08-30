import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = 'kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog'

function patch(path, replacements) {
  const full = join(root, path)
  let text = readFileSync(full, 'utf8')
  for (const [from, to] of replacements) {
    const parts = text.split(from)
    if (parts.length !== 2) {
      throw new Error(`${path}: esperava exatamente 1 ocorrência de: ${from.slice(0, 90)}`)
    }
    text = parts.join(to)
  }
  writeFileSync(full, text)
}

patch('src/lib/adaptiveCheckin.ts', [[
  'Certo. Continue registrando como você está agora. Se esse contexto também estiver presente hoje, você pode marcá-lo nos detalhes do check-in.',
  'Certo. Se fizer sentido para você registrar este momento, esse contexto também pode ser marcado nos detalhes do check-in.',
]])

patch('supabase/functions/run-emotional-automations/runner.ts', [[
  'Energia e ansiedade variaram sem uma relação muito marcada neste mês. Continuar registrando ajuda a perceber conexões mais claras.',
  'Energia e ansiedade variaram sem uma relação muito marcada neste mês. Se fizer sentido para você, novos registros podem ajudar a contextualizar mudanças ao longo do tempo.',
]])

patch('src/components/MyReportPageContent.tsx', [
  [
    'Gráfico indisponível: são necessários registros com energia/ansiedade em pelo menos 2 dias do período. Continue registrando para acompanhar sua semana.',
    'Gráfico indisponível: são necessários registros com energia/ansiedade em pelo menos 2 dias do período. Se houver novos registros quando fizer sentido para você, esta leitura pode ganhar mais contexto.',
  ],
  [
    'Ainda não há check-ins com emoções neste período. Continue registrando para ver seu panorama emocional.',
    'Ainda não há check-ins com emoções neste período. Se você registrar outros momentos quando quiser, este panorama poderá ganhar mais contexto.',
  ],
  [
    'Este relatório foi gerado com poucos registros no período. Por isso, algumas análises aparecem como iniciais ou indisponíveis. Continue registrando check-ins e diários para que os próximos relatórios tragam insights mais precisos.',
    'Este relatório foi gerado com poucos registros no período. Por isso, algumas análises aparecem como iniciais ou indisponíveis. Se fizer sentido para você, novos registros podem trazer mais contexto para observar mudanças ao longo do tempo.',
  ],
  [
    "c.improvementMoments || 'Continue registrando para que seus momentos de melhora fiquem mais visíveis.'",
    "c.improvementMoments || 'Ainda não há registros suficientes para destacar momentos de melhora neste período.'",
  ],
  [
    'Continue registrando no diário. Ao assinar o Essencial, você recebe relatórios semanais fechados aos domingos, com resumo, emoções, energia, ansiedade e conteúdos recomendados.',
    'Ao assinar o Essencial, seus registros disponíveis podem compor relatórios semanais fechados aos domingos, com resumo, emoções, energia, ansiedade e conteúdos recomendados.',
  ],
  [
    'Complete seus check-ins e registros para que seus relatórios tragam insights mais precisos sobre você.',
    'Os registros que você escolher fazer podem dar mais contexto às leituras, sem meta de frequência ou obrigação de completar a semana.',
  ],
  [
    'sub="de 7 dias"',
    'sub="registros na semana"',
  ],
  [
    'Continue registrando seus check-ins e diários para que seu relatório fique ainda mais completo.',
    'O relatório usa o que estiver registrado no período; você não precisa completar uma quantidade de dias.',
  ],
  [
    'value={`${weeklyPreview.checkinCount ?? 0}/7`}',
    'value={weeklyPreview.checkinCount ?? 0}',
  ],
  [
    'Pequenos registros diários geram grandes clarezas. Continue um passo de cada vez.',
    'Um registro pode ser útil quando fizer sentido para você — sem obrigação de manter uma sequência.',
  ],
  [
    '{weeklyPreview.checkinCount ?? 0}/7</td>',
    '{weeklyPreview.checkinCount ?? 0}</td>',
  ],
  [
    'Continue registrando seus check-ins e diário para que o próximo relatório tenha mais informações.',
    'Quando houver registros no período, o próximo relatório poderá usar essas informações como contexto.',
  ],
])

const testPath = join(root, 'tests/healthyGamificationFinalQa.test.ts')
mkdirSync(dirname(testPath), { recursive: true })
writeFileSync(testPath, `import test from 'node:test'\nimport assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\n\nconst read = (path: string) => readFileSync(new URL(\`../\${path}\`, import.meta.url), 'utf8')\nconst reports = read('src/components/MyReportPageContent.tsx')\nconst adaptive = read('src/lib/adaptiveCheckin.ts')\nconst emotionalRunner = read('supabase/functions/run-emotional-automations/runner.ts')\n\ntest('Fase 20.9 remove metas de frequência e chamadas de continuidade obrigatória', () => {\n  assert.doesNotMatch(reports, /Continue registrando|Complete seus check-ins|checkinCount \\?\\? 0}\\/7|de 7 dias/)\n  assert.doesNotMatch(adaptive, /Certo\\. Continue registrando como você está agora/)\n  assert.doesNotMatch(emotionalRunner, /Continuar registrando ajuda a perceber conexões mais claras/)\n\n  assert.match(reports, /sem meta de frequência ou obrigação de completar a semana/)\n  assert.match(reports, /você não precisa completar uma quantidade de dias/)\n  assert.match(reports, /sem obrigação de manter uma sequência/)\n  assert.match(adaptive, /Se fizer sentido para você registrar este momento/)\n  assert.match(emotionalRunner, /Se fizer sentido para você, novos registros podem ajudar a contextualizar mudanças/)\n})\n\ntest('QA final não introduz mecânicas de pontuação ou streak nas superfícies auditadas', () => {\n  const userFacing = [reports, adaptive].join('\\n')\n  assert.doesNotMatch(userFacing, /\\bXP\\b|\\bstreak\\b|ranking de usuário|pontuação de continuidade|meta de 7\\/7/i)\n})\n\ntest('automação emocional mantém a fronteira explícita de privacidade', () => {\n  assert.match(emotionalRunner, /nunca recebe texto livre do diário: somente colunas analíticas agregadas/)\n  assert.doesNotMatch(emotionalRunner, /select\\([^)]*(?:text|content|body)[^)]*\\).*diary_entries/i)\n})\n`)

console.log('Fase 20.9: patches e teste de regressão aplicados.')
