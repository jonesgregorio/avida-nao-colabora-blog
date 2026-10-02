-- Mantém os e-mails de mudança de plano alinhados à oferta oficial.
-- A lista {{beneficios_do_plano}} é resolvida no send-transactional-email a partir
-- do plano de destino, evitando que cada chamador mantenha uma cópia diferente.

update public.email_templates
set
  subject = 'Seu {{plano}} está pronto para você',
  body_text = $body$Olá, {{nome}}.

Seu plano {{plano}} já está ativo.

Isso não significa que você precise abrir tudo hoje. Pense nesses recursos como novos caminhos que ficam disponíveis para quando fizerem sentido no seu momento.

Entre os recursos disponíveis no seu plano estão:
{{beneficios_do_plano}}

E muito mais para explorar no seu ritmo. Alguns recursos ganham mais contexto conforme você registra seus dias e constrói histórico na plataforma.

Ver todos os detalhes do meu plano:
{{link_meu_plano}}

Seu espaço continua sendo seu: sem pressão, sem sequência obrigatória e no seu ritmo.

Com cuidado,
Equipe A Vida Não Colabora$body$,
  updated_at = now()
where template_key = 'plan_activated';

update public.email_templates
set
  subject = 'Seu espaço ganhou novos caminhos',
  body_text = $body$Olá, {{nome}}.

Seu plano mudou de {{plano_antigo}} para {{plano_novo}}.

A partir de agora, novos recursos passam a fazer parte do seu espaço. Você não precisa conhecer tudo de uma vez: explore aos poucos e use apenas o que fizer sentido para você.

Entre os recursos disponíveis no {{plano_novo}} estão:
{{beneficios_do_plano}}

E muito mais para explorar no seu ritmo. Se algum recurso depender de histórico ou de registros suficientes, ele vai ganhando forma com o uso — sem necessidade de preencher tudo de uma vez.

Ver todos os detalhes do meu plano:
{{link_meu_plano}}

Com cuidado,
Equipe A Vida Não Colabora$body$,
  updated_at = now()
where template_key = 'plan_upgraded';

update public.email_templates
set
  subject = 'Sua mudança de plano foi agendada',
  body_text = $body$Olá, {{nome}}.

Recebemos sua solicitação para mudar do plano {{plano_atual}} para o plano {{plano_novo}}.

A mudança será aplicada ao final do ciclo atual, em {{data_fim_ciclo}}. Até essa data, você continua com acesso aos recursos do plano {{plano_atual}}.

Quando a mudança acontecer, estes serão alguns dos recursos disponíveis no {{plano_novo}}:
{{beneficios_do_plano}}

E muito mais para explorar dentro do plano. Seus registros continuam preservados; o que muda é a disponibilidade dos recursos conforme as regras do novo plano.

Ver todos os detalhes da assinatura e do plano:
{{link_meu_plano}}

Com cuidado,
Equipe A Vida Não Colabora$body$,
  updated_at = now()
where template_key = 'plan_downgrade_scheduled';

update public.email_templates
set
  subject = 'Sua conta voltou para o plano Gratuito',
  body_text = $body$Olá, {{nome}}.

Seu ciclo do plano {{plano_anterior}} foi encerrado e sua conta voltou para o plano Gratuito. Seus dados e registros continuam preservados.

No Gratuito, você continua com acesso a:
{{beneficios_do_plano}}

E ainda pode acompanhar outras possibilidades e conteúdos disponíveis no seu espaço, sempre respeitando os limites do plano Gratuito.

Ver todos os detalhes ou escolher outro plano:
{{link_meu_plano}}

Com cuidado,
Equipe A Vida Não Colabora$body$,
  updated_at = now()
where template_key = 'plan_returned_to_free';
