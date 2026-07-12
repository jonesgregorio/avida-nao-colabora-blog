-- ============================================================================
-- 079 — Padroniza nomenclatura: "Minha Evolução" → "Mapa Emocional"
-- ============================================================================
-- A área no menu chama-se OFICIALMENTE "Mapa Emocional". Alguns textos já
-- gravados no banco (templates de e-mail seedados no 049 e notificações antigas)
-- ainda diziam "Minha Evolução", gerando confusão: o usuário recebia o aviso
-- mas não achava esse item no site. Aqui reescrevemos os textos VISÍVEIS.
-- Identificadores internos (view 'my-evolution', rota alias) NÃO mudam.
-- ============================================================================

-- ── Templates de e-mail ──
UPDATE email_templates SET
  body_text = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                body_text,
                'na sua área de evolução',        'no seu Mapa Emocional'),
                'dentro da sua área Minha Evolução','dentro do seu Mapa Emocional'),
                'na sua área Minha Evolução',     'no seu Mapa Emocional'),
                'na área Minha Evolução',         'no seu Mapa Emocional'),
                'Minha Evolução',                 'Mapa Emocional'),
  body_html = REPLACE(body_html, 'Minha Evolução', 'Mapa Emocional'),
  subject   = REPLACE(subject,   'Minha Evolução', 'Mapa Emocional'),
  preheader = REPLACE(preheader, 'Minha Evolução', 'Mapa Emocional')
WHERE body_text LIKE '%Minha Evolução%'
   OR body_text LIKE '%área de evolução%'
   OR body_html LIKE '%Minha Evolução%'
   OR subject   LIKE '%Minha Evolução%'
   OR preheader LIKE '%Minha Evolução%';

-- ── Notificações já gravadas (histórico) ──
DO $$
BEGIN
  UPDATE notifications
     SET body  = REPLACE(REPLACE(body,  'Acesse Minha Evolução', 'Acesse o Mapa Emocional'), 'Minha Evolução', 'Mapa Emocional'),
         title = REPLACE(title, 'Minha Evolução', 'Mapa Emocional')
   WHERE body LIKE '%Minha Evolução%' OR title LIKE '%Minha Evolução%';
EXCEPTION WHEN undefined_table OR undefined_column THEN
  RAISE NOTICE 'notifications: coluna/tabela ausente — ignorado (%).', SQLERRM;
END $$;
