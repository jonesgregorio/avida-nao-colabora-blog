import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '..')
const drawer = fs.readFileSync(path.join(root, 'src/components/DiaryDetailsDrawer.tsx'), 'utf8')
const fields = fs.readFileSync(path.join(root, 'src/components/DiaryFormFields.tsx'), 'utf8')

describe('Diary details progressive mockup', () => {
  it('reduces optional details to five progressive sections plus discreet Plus deepening', () => {
    expect(drawer).toContain('Adicionar mais detalhes (opcional)')
    expect(drawer).toContain('Energia e sono')
    expect(drawer).toContain('Sentimentos principais')
    expect(drawer).toContain('Contexto do dia')
    expect(drawer).toContain('O que você precisa agora?')
    expect(drawer).toContain('O que pode ajudar um pouco?')
    expect(drawer).toContain('Aprofundar sinais')
    expect(drawer).toContain('Salvar detalhes')
  })

  it('offers a writable + outro path in every tag-based group', () => {
    expect((drawer.match(/allowCustom/g) || []).length).toBeGreaterThanOrEqual(5)
    expect(fields).toContain('+ outro')
    expect(fields).toContain('Escreva em poucas palavras')
    expect(fields).toContain('onToggle(clean)')
  })

  it('uses one light visual family for all main feeling tags and caps them at five', () => {
    expect(drawer).toContain('allowCustom uniformLight maxSelected={5}')
    expect(fields).toContain("'border-forest-200 bg-mint/35 text-forest-700 hover:bg-mint/60'")
    expect(fields).toContain('selected.length < maxSelected')
  })
})
