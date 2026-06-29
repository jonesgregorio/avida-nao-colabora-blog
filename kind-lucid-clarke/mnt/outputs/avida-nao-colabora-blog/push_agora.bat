@echo off
chcp 65001 > nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"
echo Enviando commits pendentes para o GitHub...
git push
echo.
echo Concluido.
pause
