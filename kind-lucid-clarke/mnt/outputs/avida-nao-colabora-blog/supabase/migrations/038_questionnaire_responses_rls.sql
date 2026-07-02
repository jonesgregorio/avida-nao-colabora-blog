-- ============================================================
-- Migration 038: RLS aprimorada para questionnaire_responses
-- ============================================================
-- O código em QuestionnairePlayer.tsx exige autenticação antes
-- de salvar resposta (if (!user || saving || saved) return).
-- A policy atual permite insert anônimo (WITH CHECK (true)).
-- Esta migration restringe para exigir autenticação e garante
-- que o usuário só possa inserir respostas próprias.

-- Remove policies anteriores e as desta migration (idempotente)
DROP POLICY IF EXISTS "Anyone can insert questionnaire" ON questionnaire_responses;
DROP POLICY IF EXISTS "users_insert_own_responses" ON questionnaire_responses;
DROP POLICY IF EXISTS "auth_users_insert_own_responses" ON questionnaire_responses;
DROP POLICY IF EXISTS "admin_insert_any_response" ON questionnaire_responses;

-- Exige autenticação para inserir resposta.
-- Usuário só pode inserir resposta cujo user_id seja o seu.
CREATE POLICY "auth_users_insert_own_responses" ON questionnaire_responses
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Admin pode inserir qualquer resposta
CREATE POLICY "admin_insert_any_response" ON questionnaire_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
  );
