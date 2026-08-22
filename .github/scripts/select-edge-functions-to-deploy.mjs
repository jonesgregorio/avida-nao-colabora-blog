import { execFileSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const APP_PREFIX = 'kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/'
const FUNCTIONS_PREFIX = `${APP_PREFIX}supabase/functions/`
const CONFIG_PATH = `${APP_PREFIX}supabase/config.toml`

export function listEdgeFunctions(functionsDir) {
  return readdirSync(functionsDir)
    .filter((name) => name !== '_shared')
    .filter((name) => statSync(join(functionsDir, name)).isDirectory())
    .filter((name) => statSync(join(functionsDir, name, 'index.ts')).isFile())
    .sort()
}

export function selectEdgeFunctions(changedFiles, availableFunctions) {
  const changed = new Set()
  let deployAll = false

  for (const file of changedFiles) {
    if (file === CONFIG_PATH || file.startsWith(`${FUNCTIONS_PREFIX}_shared/`)) {
      deployAll = true
      continue
    }

    if (!file.startsWith(FUNCTIONS_PREFIX)) continue
    const functionName = file.slice(FUNCTIONS_PREFIX.length).split('/')[0]
    if (availableFunctions.includes(functionName)) changed.add(functionName)
  }

  return deployAll ? availableFunctions : [...changed].sort()
}

function changedFilesBetween(before, sha) {
  const base = /^0+$/.test(before) ? `${sha}^` : before
  return execFileSync('git', ['diff', '--name-only', base, sha], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
}

if (import.meta.main) {
  const [before, sha] = process.argv.slice(2)
  if (!before || !sha) {
    console.error('Uso: select-edge-functions-to-deploy.mjs <before-sha> <sha>')
    process.exit(2)
  }

  const functions = listEdgeFunctions(join(process.cwd(), 'supabase', 'functions'))
  const selected = selectEdgeFunctions(changedFilesBetween(before, sha), functions)
  console.error(`Selecionadas ${selected.length} de ${functions.length} Edge Functions para deploy.`)
  process.stdout.write(selected.join('\n'))
  if (selected.length > 0) process.stdout.write('\n')
}
