@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando arquivos corrigidos...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminSocialProof.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminProfessionals.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminLogs.tsx"

echo Status:
git diff --cached --stat

echo Fazendo commit...
git commit -m "fix: reverter nomes de colunas para corresponder ao banco real (SocialProof: name/text/active/key, Professionals: active, Logs: target_type/target_id)"

echo Fazendo push...
git push

echo.
echo Pronto!
pause
