// Reexporta a mesma implementação usada pelas Edge Functions para o frontend.
// Assim Fábrica IA e automação editorial compartilham prompt, parser, tipos e
// validação sem manter cópias divergentes.
export * from '../../supabase/functions/_shared/articleGenerationContract'
