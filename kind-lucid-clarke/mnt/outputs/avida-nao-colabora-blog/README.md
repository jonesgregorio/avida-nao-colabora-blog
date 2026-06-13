# A Vida Não Colabora — Templo das Palavras

Blog de saúde mental com diário de bem-estar, questionários, planos de autocuidado e conteúdo automatizado.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend/DB:** Supabase (Auth, PostgreSQL, Storage)
- **Hospedagem recomendada:** Vercel ou Netlify

## Funcionalidades

- 6 artigos sobre ansiedade, depressão, fibromialgia, autocuidado, escrita terapêutica e história pessoal
- Questionário de autoavaliação com resultado personalizado
- Diário de bem-estar com registro por data e humor
- Sistema de autenticação completo (cadastro, login, reset de senha)
- 3 planos: Gratuito, Essencial (R$19,90/mês), Terapêutico (R$39,90/mês)
- Mini-desafios: 7 Dias de Sono, 5 Dias de Dor Crônica, 7 Dias de Respiração
- Meditações guiadas (uma por dia da semana) — Plano Essencial+
- Questionário aprofundado + plano de autocuidado gerado automaticamente — Plano Terapêutico
- Diário avançado com marcadores (sono, dor, compulsão, gatilhos) — Plano Terapêutico
- Perfil com upload de foto de avatar
- Paginação de artigos

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Execute os arquivos em `supabase/migrations/` no SQL Editor do Supabase:
   - `001_initial_schema.sql`
   - `002_seed_data.sql`

### 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha com suas credenciais do Supabase:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

### 3. Instalar e rodar

```bash
npm install
npm run dev
```

### 4. Build para produção

```bash
npm run build
```

## Deploy

### Vercel
1. Conecte o repositório GitHub ao Vercel
2. Configure as variáveis de ambiente no painel do Vercel
3. Deploy automático em cada push para main

### Netlify
1. Arraste a pasta `dist/` para o Netlify, ou conecte o repositório
2. Configure build command: `npm run build`
3. Publish directory: `dist`

## Domínio

Configure `avidanascolabora.com` nos DNS do seu domínio apontando para a hospedagem escolhida.

## Estrutura

```
src/
  components/   # Todos os componentes React
  hooks/        # useAuth (autenticação)
  lib/          # Cliente Supabase
  types/        # TypeScript types
supabase/
  migrations/   # Schema SQL e seed de dados
```

## Contato de emergência

CVV — Centro de Valorização da Vida: **188** (24h, gratuito)
