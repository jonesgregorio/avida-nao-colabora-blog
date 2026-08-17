-- Carta estruturada da Orientação Mensal como coluna própria (idempotente).
-- Não remove response/ai_draft_json: ambos continuam sendo fallback para
-- registros antigos. final_response_json é a fonte de verdade nova, quando
-- presente; senão a UI cai para ai_draft_json.final_response e depois para
-- response (texto simples).
ALTER TABLE monthly_guidance_requests
  ADD COLUMN IF NOT EXISTS final_response_json jsonb;

COMMENT ON COLUMN monthly_guidance_requests.final_response_json IS
  'Carta estruturada final (title, user_request_summary, emotional_context_summary, gentle_guidance, practical_next_steps, connection_with_self_care_plan, suggested_reflection_question, final_message_draft, data_quality_notice, review_badge). Fallback: ai_draft_json.final_response, depois response.';
