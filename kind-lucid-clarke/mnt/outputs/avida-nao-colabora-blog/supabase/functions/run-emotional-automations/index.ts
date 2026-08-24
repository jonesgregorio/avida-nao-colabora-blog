import { installEmotionalProviderReliability } from './providerReliability.ts'

// Instala uma camada pequena e isolada de resiliência somente para chamadas
// aos provedores de IA emocional. Chamadas ao Supabase e a outros serviços
// continuam usando fetch sem qualquer alteração.
installEmotionalProviderReliability()

// Mantém o runner emocional intacto para reduzir risco de regressão nas regras
// de relatórios, planos, períodos e privacidade já auditadas.
await import('./runner.ts')
