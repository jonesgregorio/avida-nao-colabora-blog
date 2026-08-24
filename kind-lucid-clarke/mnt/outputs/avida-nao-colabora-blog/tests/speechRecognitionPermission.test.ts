import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const guard = readFileSync(new URL('../src/lib/speechRecognitionPermission.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('ditado solicita acesso real ao microfone antes de iniciar o reconhecimento', () => {
  assert.match(main, /installSpeechRecognitionPermissionGuard\(\)/)
  assert.match(guard, /getUserMedia\(\{ audio: true \}\)/)
  assert.match(guard, /stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/)
  assert.match(guard, /originalStart\.call\(this\)/)
})

test('bloqueio real do navegador abre ajuda imediata e não confunde com falha do serviço de voz', () => {
  assert.match(guard, /showMicrophonePermissionHelp/)
  assert.match(guard, /Microfone → Permitir/)
  assert.match(guard, /o próprio Chrome abrirá automaticamente o pedido de acesso/)
  assert.match(guard, /verifiedMicrophone\.has\(instance\)/)
  assert.match(guard, /recognition-service-unavailable/)
})

test('parar ditado durante pedido de permissão não chama stop antes do reconhecimento iniciar', () => {
  assert.match(guard, /if \(pending\.has\(instance\)\)/)
  assert.match(guard, /cancelled\.add\(instance\)/)
  assert.match(guard, /this\.onend\?\.call\(this\)/)
})
