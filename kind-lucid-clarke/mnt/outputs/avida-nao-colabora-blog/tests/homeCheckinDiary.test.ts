import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const home = readFileSync(new URL('../src/components/LoggedHome.tsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const sync = readFileSync(new URL('../src/lib/homeCheckinDiary.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

test('check-in da Home também é sincronizado com o histórico do Diário', () => {
  assert.match(home, /syncHomeCheckinToDiary/)
  assert.match(sync, /from\('diary_entries'\)/)
  assert.match(sync, /entry_type: 'checkin'/)
  assert.match(sync, /HOME_CHECKIN_MARKER = 'home_checkin'/)
  assert.match(sync, /markers: \[HOME_CHECKIN_MARKER\]/)
  assert.match(sync, /contains\('markers', \[HOME_CHECKIN_MARKER\]\)/)
})

test('check-in existente é retrocompatível e volta ao histórico ao abrir a Home', () => {
  assert.match(home, /storedScore != null/)
  assert.match(home, /await syncHomeCheckinToDiary\(\{ userId: user\.id, date, score: storedScore/)
  assert.match(home, /setCheckinSaved\(storedScore != null\)/)
})

test('depois de salvo o check-in fica fechado e o Diário abre um registro separado', () => {
  assert.match(home, /checkinSaved \? <div/)
  assert.match(home, /Check-in de hoje registrado/)
  assert.match(home, /Ele já está salvo e também faz parte do seu histórico/)
  assert.match(home, /Fazer meu registro/)
  assert.match(home, /if \(checkinSaved\) return/)
  assert.match(home, /onNavigate\('diary'\)/)
})

test('escolher a nota não persiste antes do salvamento explícito', () => {
  const chooseScoreBlock = home.match(/function chooseScore[\s\S]*?\n  }/)?.[0] || ''
  assert.match(chooseScoreBlock, /setScore\(nextScore\)/)
  assert.doesNotMatch(chooseScoreBlock, /daily_life_collaboration|upsert|syncHomeCheckinToDiary/)
})
