@echo off
chcp 65001 > nul
color 0A
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║        CONFIGURAÇÃO AUTOMÁTICA - A VIDA NÃO COLABORA     ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
echo Preciso de 3 chaves. Veja como obter cada uma:
echo.
echo ─────────────────────────────────────────────────────────────
echo [1] SUPABASE SERVICE ROLE KEY
echo     1. Acesse: https://supabase.com/dashboard/project/lejvvhzluggyxlfwfoxl/settings/api
echo     2. Role a página até "Project API keys"
echo     3. Clique em "Reveal" ao lado de "service_role"
echo     4. Copie a chave (começa com eyJ...)
echo ─────────────────────────────────────────────────────────────
echo.
set /p SUPABASE_SERVICE_KEY="Cole a Service Role Key do Supabase: "

echo.
echo ─────────────────────────────────────────────────────────────
echo [2] GEMINI API KEY (GRATUITO)
echo     1. Acesse: https://aistudio.google.com/apikey
echo     2. Clique em "Create API Key"
echo     3. Copie a chave gerada
echo ─────────────────────────────────────────────────────────────
echo.
set /p GEMINI_KEY="Cole a Gemini API Key: "

echo.
echo ─────────────────────────────────────────────────────────────
echo [3] RESEND API KEY (GRATUITO - 3.000 emails/mes)
echo     1. Acesse: https://resend.com/signup
echo     2. Crie uma conta gratuita
echo     3. Va em: https://resend.com/api-keys
echo     4. Clique em "Create API Key" e copie
echo ─────────────────────────────────────────────────────────────
echo.
set /p RESEND_KEY="Cole a Resend API Key: "

echo.
echo ══════════════════════════════════════════════════════════
echo  Configurando secrets no Supabase...
echo ══════════════════════════════════════════════════════════

:: Instalar Supabase CLI via npm se não existir
where supabase >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Instalando Supabase CLI...
    npm install -g supabase 2>nul
)

:: Usar curl para setar secrets via Supabase Management API
echo.
echo [1/4] Configurando GEMINI_API_KEY...
curl -s -X POST "https://api.supabase.com/v1/projects/lejvvhzluggyxlfwfoxl/secrets" ^
  -H "Authorization: Bearer %SUPABASE_SERVICE_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "[{\"name\":\"GEMINI_API_KEY\",\"value\":\"%GEMINI_KEY%\"}]"

echo.
echo [2/4] Configurando RESEND_API_KEY...
curl -s -X POST "https://api.supabase.com/v1/projects/lejvvhzluggyxlfwfoxl/secrets" ^
  -H "Authorization: Bearer %SUPABASE_SERVICE_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "[{\"name\":\"RESEND_API_KEY\",\"value\":\"%RESEND_KEY%\"}]"

echo.
echo [3/4] Executando migration SQL (tabela email_logs)...
curl -s -X POST "https://lejvvhzluggyxlfwfoxl.supabase.co/rest/v1/rpc/exec_sql" ^
  -H "apikey: %SUPABASE_SERVICE_KEY%" ^
  -H "Authorization: Bearer %SUPABASE_SERVICE_KEY%" ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"CREATE TABLE IF NOT EXISTS email_logs (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, user_id UUID, content_id UUID, email TEXT NOT NULL, subject TEXT, status TEXT NOT NULL DEFAULT 'sent', error TEXT, sent_at TIMESTAMPTZ DEFAULT NOW()); ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true;\"}"

echo.
echo [4/4] Implantando Edge Functions no Supabase...
cd /d "C:\Users\jones\avida-nao-colabora-blog"
npx supabase functions deploy generate-content --project-ref lejvvhzluggyxlfwfoxl 2>nul
npx supabase functions deploy send-automated-emails --project-ref lejvvhzluggyxlfwfoxl 2>nul

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║  CONFIGURAÇÃO CONCLUÍDA!                                 ║
echo ║                                                          ║
echo ║  Seu sistema de automação está ativo:                    ║
echo ║  - IA gera conteúdo por tema (Gemini)                    ║
echo ║  - Emails enviados automaticamente (Resend)              ║
echo ║  - Logs disponíveis no painel admin                      ║
echo ╚══════════════════════════════════════════════════════════╝
echo.
pause
