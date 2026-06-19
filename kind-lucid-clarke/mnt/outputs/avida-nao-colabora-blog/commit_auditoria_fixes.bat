@echo off
echo ============================================
echo  COMMIT - Correcoes da Auditoria
echo ============================================
echo Parando auto_push...
taskkill /F /IM powershell.exe /T 2>nul
timeout /t 2 /nobreak >nul
del /f /q "C:\Users\jones\avida-nao-colabora-blog\.git\index.lock" 2>nul

cd /d "C:\Users\jones\avida-nao-colabora-blog"

echo Adicionando scripts Python (service key removida)...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/scripts/create_new_articles.py"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/scripts/expand_articles.py"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/scripts/fix_images.py"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/expand_short_articles.py"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/insert_missing_category_articles.py"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/insert_new_articles.py"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/update_unique_images.py"

echo Adicionando migrations...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/006_fix_diary_and_plans.sql"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations/007_missing_tables.sql"

echo Adicionando correcoes de frontend...
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/DailyContentWidget.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminSavedItems.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/components/admin/AdminQuestionnaires.tsx"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/src/types/index.ts"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/vercel.json"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/AUDITORIA_COMPLETA.md"
git add "kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/commit_auditoria_fixes.bat"

echo.
echo Status:
git status --short

echo.
echo Commitando...
git commit -m "fix: correcoes completas da auditoria de seguranca e banco

SEGURANCA:
- SERVICE_KEY removida de 7 scripts Python (agora usa os.environ)

BANCO DE DADOS (aplicado no Supabase):
- 14 colunas adicionadas em diary_entries (energy, anxiety_level, stress_level,
  gratitude, small_pride, free_note, emotional_tags, self_esteem, irritability,
  overload, recurring_thoughts, emotional_need, relationships, habits)
- CHECK constraint de plan atualizado para incluir therapeutic-plus
- Tabelas criadas: trail_articles, saved_items (com RLS)
- RLS analytics_events corrigido (profiles.id -> profiles.user_id)

FRONTEND:
- DailyContentWidget: active -> is_active (campo correto em automated_contents)
- AdminSavedItems: saved_articles -> saved_items (tabela correta)
- AdminQuestionnaires: min_plan -> plan_required (campo correto)
- types/index.ts: View type com 'admin' duplicado removido
- vercel.json: rewrites adicionado para SPA (evita 404 em rotas diretas)

DOCUMENTACAO:
- AUDITORIA_COMPLETA.md: relatorio completo com 15 secoes e notas por area"

echo.
echo Pushando...
git push origin main

echo.
echo ============================================
echo  PRONTO! Verifique o Vercel em alguns minutos.
echo  https://vercel.com/jonesgregorios-projects/avida-nao-colabora-blog
echo ============================================
pause
