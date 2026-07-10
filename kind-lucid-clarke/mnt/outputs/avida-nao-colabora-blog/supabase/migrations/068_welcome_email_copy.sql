-- ============================================================================
-- Migration 068: melhora o texto do e-mail de boas-vindas (§ e-mail transacional)
--
-- Com a confirmação de e-mail desligada no Auth (login imediato), o e-mail de
-- boas-vindas do próprio app passa a ser o primeiro contato com o usuário.
-- Este UPDATE deixa o texto mais acolhedor, em português, com linguagem neutra
-- de gênero e uma chamada clara para entrar na conta. O HTML de marca é gerado
-- pela Edge Function a partir do body_text (body_html continua vazio).
-- ============================================================================

UPDATE email_templates
SET
  subject   = 'Boas-vindas ao A Vida Não Colabora',
  preheader = 'Sua conta está pronta. Comece no seu ritmo, com calma.',
  body_text = $b$Olá, {{nome}}. Que bom ter você aqui.

Sua conta no A Vida Não Colabora foi criada e já está pronta para uso.

Este é o seu espaço para desacelerar, entender o que sente e cuidar de você no seu próprio ritmo — especialmente nos dias em que a vida não colabora.

Um bom jeito de começar:

- registre seu primeiro check-in de humor no diário;
- responda ao questionário inicial para se conhecer um pouco melhor;
- explore os conteúdos de apoio ao autocuidado;
- veja o que o seu plano oferece.

Não existe jeito certo nem pressa. Vá com calma — a gente caminha junto com você.

Sempre que quiser, é só acessar sua conta:
{{link_login}}

Com cuidado,
Equipe A Vida Não Colabora$b$,
  updated_at = now()
WHERE template_key = 'welcome';
