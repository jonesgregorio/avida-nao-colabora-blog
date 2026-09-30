-- Limpeza dos dados de TESTE do Suporte (2 tickets e 3 mensagens, criados em 25/07 e
-- 22/08 pelo próprio administrador, confirmado por ele). Escopo: somente estas linhas
-- pelos IDs abaixo; qualquer ticket novo/real NÃO é afetado.
-- Não toca: templates de resposta (support_reply_templates), usuários, demais tabelas.
-- Os 2 arquivos do bucket "support-attachments" não são apagados aqui (storage.objects
-- não deve ser alterado por SQL); remover pelo painel Storage se quiser.

delete from public.ticket_messages
where ticket_id in (
  '904ea38a-ef4c-4e33-89f5-c5031afc2077',
  '992cbb0a-5a0c-451b-a811-d38c9b655fef'
);

delete from public.support_tickets
where id in (
  '904ea38a-ef4c-4e33-89f5-c5031afc2077',
  '992cbb0a-5a0c-451b-a811-d38c9b655fef'
);
