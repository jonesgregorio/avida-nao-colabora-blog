import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const workflow = readFileSync('docs/seo/seo-audit.workflow.yml', 'utf8')
const script = readFileSync('scripts/seo-audit.mjs', 'utf8')

describe('auditoria diária de SEO', () => {
  it('roda todo dia às 18h de Brasília e manualmente', () => {
    expect(workflow).toMatch(/cron: '0 21 \* \* \*'/)
    expect(workflow).toMatch(/workflow_dispatch:/)
  })
  it('só lê o repositório e escreve Issues', () => {
    expect(workflow).toMatch(/contents: read/)
    expect(workflow).toMatch(/issues: write/)
    expect(workflow).not.toMatch(/contents: write/)
  })
  it('o script não escreve no banco nem chama fluxos de pagamento', () => {
    expect(script).not.toMatch(/insert into|update \w+ set|delete from/i)
    expect(script).not.toMatch(/stripe/i)
  })
})
