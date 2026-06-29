@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks residuais...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando arquivos corrigidos...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/App.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/TrailsPage.tsx"

echo Fazendo commit...
git commit -m "fix: App.tsx remover conteudo duplicado; TrailsPage navigate as any"

echo Fazendo push...
git push

echo.
echo Pronto! Aguarde o deploy no Vercel.
pause
