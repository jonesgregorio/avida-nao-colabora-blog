@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Removendo locks...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo Adicionando App.tsx corrigido...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/App.tsx"

echo Status:
git diff --cached --stat

echo Fazendo commit...
git commit -m "fix: App.tsx remover conteudo duplicado pos-funcao (esbuild error)"

echo Fazendo push...
git push

echo.
echo Pronto!
pause
