@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando AdminQuestionnaires.tsx corrigido...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminQuestionnaires.tsx"

echo Status:
git diff --cached --stat

echo Fazendo commit...
git commit -m "fix: AdminQuestionnaires.tsx remover conteudo duplicado pos-funcao"

echo Fazendo push...
git push

echo.
echo Pronto!
pause
