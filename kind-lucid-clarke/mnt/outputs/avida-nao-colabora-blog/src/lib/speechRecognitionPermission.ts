type RecognitionErrorLike = { error?: string; message?: string }

type RecognitionLike = {
  onerror: ((event: RecognitionErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionCtor = {
  new (): RecognitionLike
  prototype: RecognitionLike
  __diaryMicrophoneGuardInstalled?: boolean
}

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionCtor
  webkitSpeechRecognition?: RecognitionCtor
}

type MicrophonePermissionState = PermissionState | 'unknown'

const pending = new WeakSet<object>()
const permissionConfirmed = new WeakSet<object>()
const cancelled = new WeakSet<object>()

function microphoneErrorCode(error: unknown) {
  const name = error instanceof DOMException ? error.name : String((error as { name?: string } | null)?.name || '')
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'not-allowed'
  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'NotReadableError' ||
    name === 'TrackStartError' ||
    name === 'OverconstrainedError'
  ) return 'audio-capture'
  return 'audio-capture'
}

async function getMicrophonePermissionState(): Promise<MicrophonePermissionState> {
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    return status.state
  } catch {
    return 'unknown'
  }
}

function showMicrophonePermissionHelp() {
  if (typeof document === 'undefined' || document.getElementById('diary-microphone-permission-help')) return

  const overlay = document.createElement('div')
  overlay.id = 'diary-microphone-permission-help'
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-labelledby', 'diary-microphone-permission-title')
  overlay.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:2147483647', 'display:flex', 'align-items:center',
    'justify-content:center', 'padding:20px', 'background:rgba(17,45,36,.45)'
  ].join(';')

  const card = document.createElement('div')
  card.style.cssText = [
    'width:min(460px,100%)', 'border-radius:20px', 'background:#fff', 'padding:24px',
    'box-shadow:0 24px 70px rgba(0,0,0,.22)', 'font-family:Inter,system-ui,sans-serif', 'color:#163c31'
  ].join(';')

  const title = document.createElement('h2')
  title.id = 'diary-microphone-permission-title'
  title.textContent = 'Permita o microfone para continuar'
  title.style.cssText = 'margin:0 0 10px;font-size:20px;line-height:1.25'

  const text = document.createElement('p')
  text.textContent = 'O navegador já está com o microfone bloqueado para este site. No Chrome, clique no ícone de controles do site à esquerda do endereço, escolha Microfone → Permitir e recarregue a página.'
  text.style.cssText = 'margin:0;color:#52665f;font-size:14px;line-height:1.55'

  const note = document.createElement('p')
  note.textContent = 'Quando a permissão ainda estiver em “Perguntar”, o próprio Chrome abrirá automaticamente o pedido de acesso ao clicar em “Prefiro falar”.'
  note.style.cssText = 'margin:12px 0 0;color:#52665f;font-size:13px;line-height:1.5'

  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = 'Entendi'
  button.style.cssText = 'margin-top:18px;border:0;border-radius:12px;background:#175642;color:#fff;padding:10px 16px;font-weight:600;cursor:pointer'
  button.onclick = () => overlay.remove()

  card.append(title, text, note, button)
  overlay.append(card)
  overlay.addEventListener('click', event => { if (event.target === overlay) overlay.remove() })
  document.body.append(overlay)
  button.focus()
}

function patchRecognition(Ctor: RecognitionCtor) {
  if (Ctor.__diaryMicrophoneGuardInstalled) return
  const proto = Ctor.prototype
  const originalStart = proto.start
  const originalStop = proto.stop
  if (typeof originalStart !== 'function' || typeof originalStop !== 'function') return

  proto.start = function permissionAwareStart(this: RecognitionLike) {
    const instance = this as object
    cancelled.delete(instance)
    permissionConfirmed.delete(instance)

    const appOnError = this.onerror
    this.onerror = event => {
      const code = String(event?.error || '').toLowerCase()
      if (permissionConfirmed.has(instance) && (code === 'not-allowed' || code === 'service-not-allowed')) {
        appOnError?.call(this, {
          error: 'recognition-service-unavailable',
          message: 'O site tem permissão para usar o microfone, mas o serviço de reconhecimento de voz do navegador recusou o início.',
        })
        return
      }
      appOnError?.call(this, event)
    }

    const startRecognition = (confirmed: boolean) => {
      pending.delete(instance)
      if (confirmed) permissionConfirmed.add(instance)
      if (cancelled.has(instance)) return
      try {
        originalStart.call(this)
      } catch {
        appOnError?.call(this, {
          error: 'recognition-service-unavailable',
          message: 'O microfone está disponível, mas o reconhecimento de voz não conseguiu iniciar.',
        })
        this.onend?.call(this)
      }
    }

    const rejectRecognition = (code: string, message?: string) => {
      pending.delete(instance)
      if (cancelled.has(instance)) return
      if (code === 'not-allowed') showMicrophonePermissionHelp()
      appOnError?.call(this, { error: code, message })
      this.onend?.call(this)
    }

    pending.add(instance)
    void getMicrophonePermissionState().then(state => {
      if (cancelled.has(instance)) {
        pending.delete(instance)
        return
      }

      if (state === 'granted') {
        // Importante no desktop/Windows: se o navegador já concedeu permissão,
        // não abra e feche um stream getUserMedia antes do SpeechRecognition.
        // Essa troca pode disputar/reinicializar o dispositivo de entrada.
        startRecognition(true)
        return
      }

      if (state === 'denied') {
        rejectRecognition('not-allowed', 'O navegador está com o microfone bloqueado para este site.')
        return
      }

      const mediaDevices = navigator.mediaDevices
      if (!mediaDevices?.getUserMedia) {
        // Navegadores sem Permissions API/getUserMedia ainda podem implementar
        // o prompt diretamente no SpeechRecognition.
        startRecognition(false)
        return
      }

      void mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop())
        permissionConfirmed.add(instance)
        if (cancelled.has(instance)) {
          pending.delete(instance)
          return
        }
        // Dá ao sistema operacional um instante para liberar o dispositivo após
        // o prompt inicial antes de o serviço de reconhecimento assumir o áudio.
        window.setTimeout(() => startRecognition(true), 180)
      }).catch(error => {
        const code = microphoneErrorCode(error)
        rejectRecognition(code, error instanceof Error ? error.message : undefined)
      })
    }).catch(() => {
      const mediaDevices = navigator.mediaDevices
      if (!mediaDevices?.getUserMedia) {
        startRecognition(false)
        return
      }
      void mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop())
        window.setTimeout(() => startRecognition(true), 180)
      }).catch(error => {
        rejectRecognition(microphoneErrorCode(error), error instanceof Error ? error.message : undefined)
      })
    })
  }

  proto.stop = function permissionAwareStop(this: RecognitionLike) {
    const instance = this as object
    if (pending.has(instance)) {
      pending.delete(instance)
      cancelled.add(instance)
      this.onend?.call(this)
      return
    }
    originalStop.call(this)
  }

  Ctor.__diaryMicrophoneGuardInstalled = true
}

export function installSpeechRecognitionPermissionGuard() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return
  const w = window as SpeechWindow
  const constructors = [w.SpeechRecognition, w.webkitSpeechRecognition].filter(Boolean) as RecognitionCtor[]
  for (const Ctor of new Set(constructors)) patchRecognition(Ctor)
}
