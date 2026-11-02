-- Rotação editorial de reativação: modelos 1, 3 e 6. Mantém regras de elegibilidade existentes.
INSERT INTO public.email_templates (template_key,subject,preheader,body_text,body_html,category,is_active)
VALUES
('value_reactivation_return', 'Você não precisa estar bem para voltar 💚', 'Seu espaço continua aqui, sem cobranças.', 'Oi, {{nome}}!

Tem dias em que a vida simplesmente não colabora.

A rotina pesa, os pensamentos se acumulam e até encontrar um momento para nós mesmos parece difícil.

Se você está vivendo dias assim, queremos te lembrar de uma coisa:

Você não precisa estar bem para voltar.

Seu espaço no A Vida Não Colabora continua aqui. Sem cobranças, sem julgamentos e sem a necessidade de explicar sua ausência.

Quando sentir vontade, volte para registrar como está se sentindo.

Voltar ao meu espaço:
{{cta_link}}

Preferências e descadastro:
{{link_preferencias}}

Com carinho,
Equipe A Vida Não Colabora', '', 'selfcare_reminder', true),
('value_reactivation_reflection', 'Como você tem se sentido ultimamente?', 'Um convite para perceber como você está, no seu ritmo.', 'Oi, {{nome}}!

Quando foi a última vez que você parou para perceber como realmente estava se sentindo?

Não como respondeu quando alguém perguntou se estava tudo bem. Mas como você estava de verdade.

Entre tantas tarefas, compromissos e preocupações, às vezes acabamos deixando nossas próprias emoções para depois.

No A Vida Não Colabora, você pode reservar um pequeno momento para reconhecer o que está vivendo. Sem precisar encontrar as palavras certas.

Hoje, como você está?

Registrar como me sinto:
{{cta_link}}

Preferências e descadastro:
{{link_preferencias}}

Com carinho,
Equipe A Vida Não Colabora', '', 'selfcare_reminder', true),
('value_reactivation_light', 'A vida não colaborou por aí também? 💚', 'Sem pressa: seu diário e check-in continuam aqui.', 'Oi, {{nome}}!

A gente sabe como é.

Você pensa em tirar um tempinho para si, mas aparece uma tarefa, uma preocupação, uma mensagem, um imprevisto… E, quando percebe, o dia acabou.

A vida nem sempre colabora. Foi justamente por isso que criamos esse espaço.

Não para adicionar mais uma obrigação à sua rotina, mas para oferecer um lugar onde você possa simplesmente ser você.

Se hoje sobrar um minutinho, seu diário e seu check-in estão por aqui. E, se não sobrar, tudo bem também.

Voltar quando eu quiser:
{{cta_link}}

Preferências e descadastro:
{{link_preferencias}}

Com carinho,
Equipe A Vida Não Colabora', '', 'selfcare_reminder', true)
ON CONFLICT (template_key) DO UPDATE SET subject=EXCLUDED.subject,preheader=EXCLUDED.preheader,body_text=EXCLUDED.body_text,body_html=EXCLUDED.body_html,category=EXCLUDED.category,is_active=EXCLUDED.is_active,updated_at=now();
