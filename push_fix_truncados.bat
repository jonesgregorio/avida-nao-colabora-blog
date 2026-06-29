@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks residuais...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\MERGE_HEAD" 2>nul

echo Adicionando arquivos corrigidos...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/App.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/types/index.ts"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/Articles.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/DailyContentWidget.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/QuestionnairePlayer.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/TrailsPage.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminAnalytics.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminAutomated.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminQuestionnaires.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminSavedItems.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/.env"

echo Fazendo commit...
git commit -m "fix: corrigir 10 arquivos truncados que quebravam o build Vercel"

echo Fazendo push...
git push

echo.
echo Pronto! Verifique o Vercel para o novo deploy.
pause
