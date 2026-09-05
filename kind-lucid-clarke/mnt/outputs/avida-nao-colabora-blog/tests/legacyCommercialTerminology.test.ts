import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const activeCommercialFiles = [
  '../src/components/Pricing.tsx',
  '../src/components/HomeContent.tsx',
  '../src/components/MyPlanPageCore.tsx',
  '../src/components/SupportPage.tsx',
  '../src/lib/officialPlans.ts',
  '../src/lib/planCatalogPresentation.ts',
  '../src/lib/faqContent.ts',
]

const forbidden = [
  /Terapêutico Plus/giu,
  /Terapêutico/giu,
  /Comentário profissional/giu,
]

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

test('nomenclaturas comerciais aposentadas não retornam às superfícies ativas', () => {
  for (const relative of activeCommercialFiles) {
    const file = fileURLToPath(new URL(relative, import.meta.url))
    assert.equal(fs.existsSync(file), true, `arquivo comercial não encontrado: ${relative}`)
    const source = stripComments(fs.readFileSync(file, 'utf8'))
    for (const pattern of forbidden) {
      pattern.lastIndex = 0
      assert.equal(pattern.test(source), false, `${relative} reintroduziu nomenclatura comercial aposentada: ${pattern}`)
    }
  }
})
