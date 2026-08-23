import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceSupabaseDir = path.join(appRoot, 'supabase')
const targetSupabaseDir = path.join(appRoot, '.e2e-local', 'supabase')
const targetMigrationsDir = path.join(targetSupabaseDir, 'migrations')

// The repository contains historical migrations that share a numeric prefix.
// Hosted production already has its own migration history, but a clean local
// database needs unique versions. This generated directory is local-only and
// never changes the source migrations or a remote project.
const migrationFiles = (await readdir(path.join(sourceSupabaseDir, 'migrations')))
  .filter((file) => file.endsWith('.sql'))
  .sort((left, right) => {
    // Migration 008 defines a policy for saved_items, which is created in 009.
    // Only the generated local copy moves 009 just before 008.
    const localOrder = (file) => file === '046_consolidate_schemas.sql' ? `0078_${file}` : file === '009_plan_configs_and_saved_items.sql' ? `0079_${file}` : file
    return localOrder(left).localeCompare(localOrder(right))
  })

await rm(targetSupabaseDir, { recursive: true, force: true })
await mkdir(targetMigrationsDir, { recursive: true })
await cp(path.join(sourceSupabaseDir, 'functions'), path.join(targetSupabaseDir, 'functions'), { recursive: true })

const occurrences = new Map()
const renamed = []

for (const file of migrationFiles) {
  const match = /^(\d+)_(.+)$/.exec(file)
  if (!match) throw new Error(`Migration filename must start with a numeric version: ${file}`)

  const [, sourceVersion, rest] = match
  const version = file === '046_consolidate_schemas.sql' ? '0078' : file === '009_plan_configs_and_saved_items.sql' ? '0079' : sourceVersion
  const occurrence = (occurrences.get(version) ?? 0) + 1
  occurrences.set(version, occurrence)

  // `0031` sorts immediately after `003` and before `004`, preserving the
  // original filename order while giving the local CLI a unique version.
  const targetFile = occurrence === 1 ? `${version}_${rest}` : `${version}${occurrence - 1}_${rest}`
  const sourcePath = path.join(sourceSupabaseDir, 'migrations', file)
  const targetPath = path.join(targetMigrationsDir, targetFile)
  let content = await readFile(sourcePath, 'utf8')
  // Compatibility fixes required only when replaying the historical chain on a
  // fresh local database. Source migrations remain immutable for production.
  if (file === '010_align_admin_columns.sql') content = content.replace("'98%'", "'98'")
  if (file === '013_fix_admin_blog_sync.sql') content = content.replace('ALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;', 'ALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;\nALTER TABLE questionnaires ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT false;\n\nALTER TABLE questionnaires ENABLE ROW LEVEL SECURITY;')
  if (file === '046_consolidate_schemas.sql') content = content.replace('ALTER TABLE trails ENABLE ROW LEVEL SECURITY;', 'ALTER TABLE trails ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;\nALTER TABLE trails ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;\n\nALTER TABLE trails ENABLE ROW LEVEL SECURITY;')
  if (file === '057_plans_three_model.sql') content = content.replace('-- 4. plan_configs:', '-- 4. plan_configs:\nALTER TABLE plan_configs ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT false;')
  if (file === '024_fix_plan_features_is_display.sql') content = content.replace('feats.default_enabled', 'computed.default_enabled')
  if (file === '060_articles_paywall_3plans.sql') content = content.replace('DROP POLICY IF EXISTS "articles_therapeutic_plus" ON articles;', 'DROP POLICY IF EXISTS "articles_therapeutic_plus" ON articles;\nDROP POLICY IF EXISTS "articles_plus" ON articles;')
  if (file === '098_reconcile_category_duplicates.sql') content = content.replace('-- 1) Passa os radicais', "INSERT INTO categories (name, slug, is_active, order_index, match_terms) VALUES ('Cansaço emocional','cansaco-emocional',true,3,'cansa, exaust, fadiga'),('Sono e descanso','sono-e-descanso',true,4,'sono, energia, dormir, descanso') ON CONFLICT (name) DO NOTHING;\n\n-- 1) Passa os radicais")
  if (file === '120_care_source_new_tags.sql') content = content.replace('CREATE OR REPLACE FUNCTION public.admin_monthly_care_source', 'DROP FUNCTION IF EXISTS public.admin_monthly_care_source(UUID, DATE, DATE);\n\nCREATE FUNCTION public.admin_monthly_care_source')
  if (file === '20260819214900_permissions_p0_hardening.sql') content = content.replace('-- Catálogo público SEGURO:', 'ALTER TABLE public.questionnaires ADD COLUMN IF NOT EXISTS short_description text;\n\n-- Catálogo público SEGURO:')
  if (file === '20260816194000_restrict_sensitive_rpc_execution.sql') content = content.replace('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC;', "DO $$ BEGIN IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC; END IF; END $$;")
  if (file === '20260816194500_revoke_explicit_anon_sensitive_rpcs.sql') content = content.replace('REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;', "DO $$ BEGIN IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated; END IF; END $$;")
  await writeFile(targetPath, content)
  if (targetFile !== file) renamed.push(`${file} -> ${targetFile}`)
}

const sourceConfig = await readFile(path.join(sourceSupabaseDir, 'config.toml'), 'utf8')
const localConfig = sourceConfig
  .replace(/^project_id\s*=\s*".*"/m, 'project_id = "local-e2e"')
  .replace('site_url = "https://avidanaocolabora.com"', 'site_url = "http://127.0.0.1:4173"')
  .replace('additional_redirect_urls = ["https://www.avidanaocolabora.com", "https://avida-nao-colabora-blog.vercel.app"]', 'additional_redirect_urls = ["http://127.0.0.1:4173"]')

await writeFile(path.join(targetSupabaseDir, 'config.toml'), localConfig)

console.log(`Prepared ${migrationFiles.length} local migrations.`)
if (renamed.length) console.log(`Normalized duplicate local versions:\n${renamed.join('\n')}`)
