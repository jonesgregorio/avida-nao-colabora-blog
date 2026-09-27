import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const source = fs.readFileSync(path.resolve(process.cwd(), 'src/components/admin/AdminVisitsSourceCard.tsx'), 'utf8')

describe('AdminVisitsSourceCard — atribuição Google', () => {
  it('separa busca orgânica, anúncio e Google sem evidência suficiente', () => {
    expect(source).toContain("'Google — Busca orgânica'")
    expect(source).toContain("'Google — Anúncio'")
    expect(source).toContain("'Google — outra origem'")
    expect(source).toContain("clickId === 'gclid'")
    expect(source).toContain("method === 'referrer'")
  })

  it('não apresenta Google genérico como prova automática de busca orgânica', () => {
    expect(source).toContain("return 'Google — outra origem'")
    expect(source).toContain('os dados disponíveis não permitem afirmar qual tipo')
  })
})
