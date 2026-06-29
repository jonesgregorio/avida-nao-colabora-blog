@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminAutomated.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/DailyContentWidget.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/App.tsx"

git commit -m "feat: geracao de conteudo com IA gratuita (Pollinations) + DailyContentWidget no home"
git push

echo Concluido!
pause
