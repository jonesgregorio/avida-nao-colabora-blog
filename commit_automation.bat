@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks residuais...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando arquivos de automacao...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminAutomated.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/functions/generate-content/index.ts"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/functions/send-automated-emails/index.ts"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/004_automated_emails.sql"

echo Fazendo commit...
git commit -m "feat: automacao de conteudo com IA (Gemini) + envio de email (Resend) + logs"

echo Fazendo push para o GitHub...
git push

echo.
echo Concluido! Agora configure as chaves conforme o guia.
pause
