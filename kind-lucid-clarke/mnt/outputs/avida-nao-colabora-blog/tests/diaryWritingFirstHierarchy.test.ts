import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const diaryPath = path.join(root, 'src/components/DiaryExperience.tsx')
const moodPath = path.join(root, 'src/components/DiaryMoodSelector.tsx')
const diary = fs.readFileSync(diaryPath, 'utf8')
const mood = fs.readFileSync(moodPath, 'utf8')

describe('Fase 21.2 — Diário com escrita como protagonista', () => {
  it('mantém a escrita como entrada principal', () => {
    expect(diary).toContain('O que você quer colocar para fora hoje?')
    expect(diary).toContain('Comece pelo texto. Humor e outros detalhes ficam opcionais para depois.')
    expect(diary).toContain('Guardar meu registro')
  })

  it('mantém o contexto emocional opcional e recolhido', () => {
    expect(mood).toContain('Quer acrescentar algo sobre este momento?')
    expect(mood).toContain('Opcional — ajuda a organizar seu histórico.')
    expect(mood).toContain('Como você está se sentindo?')
    expect(mood).toContain('Escolha apenas se isso ajudar a dar contexto ao que você escreveu.')
    expect(mood).not.toContain('É diferente da pergunta da página inicial')
  })

  it('não transforma sentimentos em resposta sobre colaboração do dia', () => {
    expect(mood).not.toContain('como o dia, no geral, colaborou')
    expect(mood).toContain('Outros sentimentos')
  })
})
