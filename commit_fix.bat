@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks residuais...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Fazendo commit do App.tsx corrigido...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/App.tsx"
git commit -m "fix: App.tsx completo - corrige truncamento que quebrou o build Vercel"

echo Fazendo push para o GitHub...
git push

echo.
echo Concluido!
pause
