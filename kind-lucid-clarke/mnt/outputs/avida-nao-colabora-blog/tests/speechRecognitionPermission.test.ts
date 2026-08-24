import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const guard = readFileSync(new URL('../src/lib/speechRecognitionPermission.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

test('ditado consulta o estado da permissão antes de tocar no dispositivo de áudio', () => {
  assert.match(main, /installSpeechRecognitionPermissionGuard\(\)/)
  assert.match(guard, /getMicrophonePermissionState/)
  assert.match(guard, /navigator\.permissions\.query/)
  assert.match(guard, /name: 'microphone'/)
  assert.match(guard, /if \(state === 'granted'\)/)
  assert.match(guard, /startRecognition\(true\)/)
})

test('permissão já concedida inicia reconhecimento diretamente e encerra esse ramo', () => {
  const grantedBlock = guard.match(/if \(state === 'granted'\) \{[\s\S]*?startRecognition\(true\)[\s\S]*?return\n\s*\}/)?.[0] || ''
  assert.match(grantedBlock, /startRecognition\(true\)\s*return/)
})

test('estado prompt usa getUserMedia para abrir o pedido nativo e libera a faixa antes do reconhecimento', () => {
  assert.match(guard, /getUserMedia\(\{ audio: true \}\)/)
  assert.match(guard, /stream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/)
  assert.match(guard, /setTimeout\(\(\) => startRecognition\(true\), 180\)/)
})

test('bloqueio real do navegador abre ajuda imediata e não confunde com falha do serviço de voz', () => {
  assert.match(guard, /showMicrophonePermissionHelp/)
  assert.match(guard, /Microfone → Permitir/)
  assert.match(guard, /o próprio Chrome abrirá automaticamente o pedido de acesso/)
  assert.match(guard, /permissionConfirmed\.has\(instance\)/)
  assert.match(guard, /recognition-service-unavailable/)
})

test('parar ditado durante pedido de permissão não chama stop antes do reconhecimento iniciar', () => {
  assert.match(guard, /if \(pending\.has\(instance\)\)/)
  assert.match(guard, /cancelled\.add\(instance\)/)
  assert.match(guard, /this\.onend\?\.call\(this\)/)
})
