@echo off
echo Parando auto_push...
taskkill /F /IM powershell.exe /T 2>nul
timeout /t 2 /nobreak >nul
del /f /q "C:\Users\jones\avida-nao-colabora-blog\.git\index.lock" 2>nul
cd /d "C:\Users\jones\avida-nao-colabora-blog"
echo Adicionando arquivos...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminAnalytics.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/hooks/useAnalytics.ts"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/005_analytics_events.sql"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/Articles.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/QuestionnairePlayer.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/TrailsPage.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/DailyContentWidget.tsx"
echo Status:
git status --short
echo Commitando...
git commit -m "feat: analytics dashboard completo + rastreamento de eventos"
echo Pushando...
git push origin main
pause
