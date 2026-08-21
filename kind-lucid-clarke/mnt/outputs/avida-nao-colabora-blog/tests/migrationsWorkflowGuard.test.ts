import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repoRoot = new URL('../../../../../', import.meta.url)

const applyWorkflow = readFileSync(
  new URL('.github/workflows/apply-migrations.yml', repoRoot),
  'utf8',
)
const ciWorkflow = readFileSync(new URL('.github/workflows/ci.yml', repoRoot), 'utf8')
const validateScriptPath = new URL('.github/scripts/validate-migrations.sh', repoRoot)
const validateScript = readFileSync(validateScriptPath, 'utf8')

const MIGRATIONS_DIR = 'kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations'

test('workflow de aplicação não usa mais o diff cru que reaplica migration antiga', () => {
  assert.equal(
    /git diff --name-only\s+HEAD\^\s+HEAD/.test(applyWorkflow),
    false,
    'git diff --name-only HEAD^ HEAD inclui migrations modificadas e as reaplica inteiras',
  )
  assert.match(applyWorkflow, /validate-migrations\.sh/)
})

test('workflow de aplicação busca histórico suficiente para comparar o push inteiro', () => {
  assert.match(applyWorkflow, /fetch-depth:\s*0/)
  assert.match(applyWorkflow, /github\.event\.before/)
})

test('workflow de aplicação executa somente a lista validada de migrations novas', () => {
  assert.match(applyWorkflow, /migrations-novas\.txt/)
  assert.equal(
    applyWorkflow.includes('for f in $FILES'),
    false,
    'a aplicação não pode iterar sobre o diff bruto',
  )
})

test('CI bloqueia alteração de migration antes do merge', () => {
  assert.match(ciWorkflow, /migrations-guard/)
  assert.match(ciWorkflow, /validate-migrations\.sh/)
  assert.match(ciWorkflow, /merge-base/)
})

test('script de validação classifica adição, modificação, remoção e renomeação', () => {
  assert.match(validateScript, /--diff-filter|--name-status/)
  for (const status of ['A)', 'M)', 'D)', 'R*)']) {
    assert.ok(validateScript.includes(status), `script deve tratar o status ${status}`)
  }
})

function hasGitBash() {
  const probe = spawnSync('bash', ['-c', 'command -v git'], { encoding: 'utf8' })
  return probe.status === 0
}

test(
  'comportamento real do script: adição passa, modificação/remoção/renomeação falham',
  { skip: hasGitBash() ? false : 'bash com git indisponível neste ambiente' },
  () => {
    const workdir = mkdtempSync(join(tmpdir(), 'migrations-guard-'))
    const scriptSource = readFileSync(validateScriptPath, 'utf8')

    const sh = (command: string) => {
      const result = spawnSync('bash', ['-c', command], {
        cwd: workdir,
        encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
      })
      return result
    }

    try {
      mkdirSync(join(workdir, MIGRATIONS_DIR), { recursive: true })
      mkdirSync(join(workdir, '.github', 'scripts'), { recursive: true })
      writeFileSync(join(workdir, '.github', 'scripts', 'validate-migrations.sh'), scriptSource)
      writeFileSync(join(workdir, MIGRATIONS_DIR, '001_historica.sql'), 'select 1;\n')

      const init = sh(
        'git init -q -b main . && git config user.email t@t.t && git config user.name t' +
          ' && git add -A && git commit -qm base',
      )
      assert.equal(init.status, 0, `git init falhou: ${init.stderr}`)

      const runGuard = () => sh('bash .github/scripts/validate-migrations.sh HEAD~1 HEAD')

      // Cenário A — migration nova: permitido.
      writeFileSync(join(workdir, MIGRATIONS_DIR, '20260101000000_nova.sql'), 'select 2;\n')
      sh('git add -A && git commit -qm nova')
      const added = runGuard()
      assert.equal(added.status, 0, `adição deveria passar. saída: ${added.stdout}${added.stderr}`)
      assert.match(added.stdout, /20260101000000_nova\.sql/)

      // Cenário M — migration histórica editada: bloqueado.
      writeFileSync(join(workdir, MIGRATIONS_DIR, '001_historica.sql'), 'select 1; select 99;\n')
      sh('git add -A && git commit -qm editada')
      const modified = runGuard()
      assert.equal(modified.status, 1, 'modificação de migration histórica deve reprovar')
      assert.match(modified.stdout, /MODIFICADA/)

      // Cenário R — migration histórica renomeada: bloqueado.
      sh('git revert --no-edit -n HEAD && git commit -qm restaura')
      sh(`git mv ${MIGRATIONS_DIR}/001_historica.sql ${MIGRATIONS_DIR}/002_renomeada.sql`)
      sh('git add -A && git commit -qm renomeada')
      const renamed = runGuard()
      assert.equal(renamed.status, 1, 'renomeação de migration histórica deve reprovar')
      assert.match(renamed.stdout, /RENOMEADA|REMOVIDA/)

      // Cenário D — migration histórica removida: bloqueado.
      sh(`git rm -q ${MIGRATIONS_DIR}/002_renomeada.sql && git commit -qm removida`)
      const deleted = runGuard()
      assert.equal(deleted.status, 1, 'remoção de migration histórica deve reprovar')
      assert.match(deleted.stdout, /REMOVIDA/)
    } finally {
      rmSync(workdir, { recursive: true, force: true })
    }
  },
)
