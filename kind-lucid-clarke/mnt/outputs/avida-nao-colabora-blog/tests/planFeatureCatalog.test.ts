import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const catalog = readFileSync(new URL('../src/lib/planFeatureCatalog.ts', import.meta.url), 'utf8')
const official = readFileSync(new URL('../src/lib/officialPlans.ts', import.meta.url), 'utf8')
const adminCatalog = readFileSync(new URL('../src/components/admin/AdminPlanFeatureCatalog.tsx', import.meta.url), 'utf8')
const adminPlansPage = readFileSync(new URL('../src/components/admin/AdminPlanosPage.tsx', import.meta.url), 'utf8')
const pricing = readFileSync(new URL('../src/components/Pricing.tsx', import.meta.url), 'utf8')
const migration = readFileSync(new URL('../supabase/migrations/20260827013000_plan_feature_catalog_presentation.sql', import.meta.url), 'utf8')

test('catálogo editável é camada de apresentação e mantém entitlement técnico em officialPlans', () => {
  assert.match(catalog, /entitlement técnico[\s\S]*officialPlans\.ts/i)
  assert.match(catalog, /DEFAULT_PLAN_ACCESS/)
  assert.match(catalog, /OWN_FEATURE_KEYS/)
  assert.match(official, /export function hasPlanAccess/)
  assert.match(official, /export const OFFICIAL_FEATURES/)
  assert.doesNotMatch(catalog, /export function hasPlanAccess/)
})

test('falha ou atraso de migration usa catálogo oficial como fallback', () => {
  assert.match(catalog, /buildFallbackPlanFeatureCatalog/)
  assert.match(catalog, /if \(featureError \|\| accessError \|\| !Array\.isArray\(featureRows\)\) return fallback/)
  assert.match(catalog, /catch \{\s*return fallback\s*\}/)
  assert.match(pricing, /buildFallbackPlanFeatureCatalog/)
})

test('recursos do sistema têm chave protegida e novos itens são apenas comerciais', () => {
  assert.match(adminCatalog, /Chave interna — não editável/)
  assert.match(adminCatalog, /feature_kind: 'commercial'/)
  assert.match(adminCatalog, /is_system: false/)
  assert.match(adminCatalog, /Este item é textual e não libera recursos técnicos/)
  assert.doesNotMatch(adminCatalog, /feature_kind: 'technical'.*is_system: false/)
})

test('arquivamento preserva histórico em vez de excluir recurso', () => {
  assert.match(adminCatalog, /is_active: nextActive/)
  assert.match(adminCatalog, /archived_at:/)
  assert.match(adminCatalog, /Funcionalidade arquivada\. Ela deixa de aparecer no site, mas o histórico é preservado/)
  assert.doesNotMatch(adminCatalog, /from\('plan_features'\)\.delete\(/)
})

test('migration é aditiva e protege texto personalizado contra sincronização legada', () => {
  for (const column of ['feature_kind', 'is_system', 'is_active', 'show_on_pricing', 'show_on_my_plan', 'show_on_comparison', 'show_on_upgrade', 'presentation_revision']) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`))
  }
  assert.match(migration, /preserve_plan_feature_presentation/)
  assert.match(migration, /NEW\.presentation_revision = OLD\.presentation_revision/)
  assert.match(adminCatalog, /presentation_revision: Date\.now\(\)/)
  assert.doesNotMatch(migration, /DROP TABLE/i)
  assert.doesNotMatch(migration, /DELETE FROM public\.plan_features/i)
})

test('Admin e página pública consomem a mesma fonte de nomes', () => {
  assert.match(adminPlansPage, /loadPlanFeatureCatalog/)
  assert.match(adminPlansPage, /getCatalogPlanBenefits/)
  assert.match(pricing, /loadPlanFeatureCatalog/)
  assert.match(pricing, /getCatalogPlanBenefits/)
  assert.doesNotMatch(adminPlansPage, /const PLANS = \[/)
  assert.doesNotMatch(pricing, /PLAN_BENEFITS/)
})

test('texto específico por plano permanece separado de disponibilidade técnica', () => {
  assert.match(catalog, /custom_label/)
  assert.match(catalog, /custom_description/)
  assert.match(adminCatalog, /Nome específico \(opcional\)/)
  assert.match(adminCatalog, /Em recursos do sistema, a disponibilidade técnica continua sendo controlada na tela de permissões/)
  assert.match(adminCatalog, /editing\.kind === 'commercial'/)
})
