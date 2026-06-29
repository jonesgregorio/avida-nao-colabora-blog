@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks residuais...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando AdminQuestionnaires.tsx...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminQuestionnaires.tsx"

echo Fazendo commit...
git commit -m "feat: AdminQuestionnaires reescrito - editor completo com status, tipos de pergunta, opcoes, resultados e preview"

echo Fazendo push para o GitHub...
git push

echo.
echo Concluido! Vercel vai fazer o deploy automaticamente.
pause
