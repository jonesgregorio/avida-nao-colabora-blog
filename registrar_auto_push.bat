@echo off
chcp 65001 > nul
echo ============================================
echo  Configurando auto-push automatico no GitHub
echo ============================================
echo.

:: Configurar git se necessario
cd /d "C:\Users\jones\avida-nao-colabora-blog"
git config user.email "jonlesjonles30@gmail.com" 2>nul
git config user.name "Jones Gregório" 2>nul

:: Primeiro fazer o push pendente agora
echo [1/3] Enviando commits pendentes para o GitHub...
git push
echo.

:: Criar a tarefa agendada que roda o PowerShell watcher no login
echo [2/3] Registrando tarefa no Agendador de Tarefas do Windows...

schtasks /create /tn "AvIdaAutoGitPush" /tr "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File \"C:\Users\jones\avida-nao-colabora-blog\auto_push.ps1\"" /sc ONLOGON /ru "%USERNAME%" /f

if %ERRORLEVEL% == 0 (
    echo Tarefa criada com sucesso!
) else (
    echo Erro ao criar tarefa. Tentando metodo alternativo...
    schtasks /create /tn "AvIdaAutoGitPush" /tr "powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File C:\Users\jones\avida-nao-colabora-blog\auto_push.ps1" /sc ONLOGON /f
)

:: Iniciar o watcher agora sem esperar o proximo login
echo [3/3] Iniciando o watcher agora...
start "" /min powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\Users\jones\avida-nao-colabora-blog\auto_push.ps1"

echo.
echo ============================================
echo  Configuracao concluida!
echo  - Push pendente enviado
echo  - Watcher iniciado em segundo plano
echo  - Tarefa registrada para iniciar no login
echo ============================================
echo.
pause
