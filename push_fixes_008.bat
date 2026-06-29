@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando arquivos corrigidos...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminDashboard.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminSocialProof.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminProfessionals.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminPermissions.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminLogs.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/008_fix_column_mismatches.sql"

echo Status:
git diff --cached --stat

echo Fazendo commit...
git commit -m "fix: corrigir mismatches de colunas admin (Dashboard catch, SocialProof, Professionals, Permissions, Logs) + migration 008"

echo Fazendo push...
git push

echo.
echo Pronto! Agora execute a migration 008 no Supabase SQL Editor.
pause
