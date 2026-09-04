-- ============================================================================
-- CMS de conteúdo institucional
-- ----------------------------------------------------------------------------
-- Torna editáveis pelo Admin (com histórico de versões):
--   * páginas longas: Sobre, Termos, Privacidade, Aviso de Responsabilidade
--   * textos curtos do Hero / Home (site_snippets)
--   * perguntas frequentes (faq_items)
--
-- O front usa o banco quando há conteúdo; se a linha não existir ou o corpo
-- estiver vazio, cai no texto embutido no código (fallback). Assim nada quebra
-- se o banco estiver indisponível e a migração é segura de aplicar.
--
-- ADITIVO: apenas cria tabelas/policies/trigger e semeia o texto atual.
-- ============================================================================

create table if not exists public.site_pages (
  slug        text primary key,
  title       text not null default '',
  body_md     text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.site_snippets (
  key         text primary key,
  label       text not null default '',
  value       text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

create table if not exists public.faq_items (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'Geral',
  question    text not null,
  answer      text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
create index if not exists idx_faq_items_active_sort on public.faq_items (is_active, sort_order);

create table if not exists public.site_content_revisions (
  id          uuid primary key default gen_random_uuid(),
  ref_type    text not null check (ref_type in ('page','snippet','faq')),
  ref_id      text not null,
  snapshot    jsonb not null,
  note        text,
  created_at  timestamptz not null default now(),
  created_by  uuid
);
create index if not exists idx_site_revisions_ref
  on public.site_content_revisions (ref_type, ref_id, created_at desc);

alter table public.site_pages             enable row level security;
alter table public.site_snippets          enable row level security;
alter table public.faq_items              enable row level security;
alter table public.site_content_revisions enable row level security;

-- leitura pública do conteúdo do site
drop policy if exists site_pages_read on public.site_pages;
create policy site_pages_read on public.site_pages
  for select to anon, authenticated using (true);

drop policy if exists site_snippets_read on public.site_snippets;
create policy site_snippets_read on public.site_snippets
  for select to anon, authenticated using (true);

drop policy if exists faq_items_read on public.faq_items;
create policy faq_items_read on public.faq_items
  for select to anon, authenticated using (is_active or public.is_admin());

-- escrita apenas admin (AAL2 exigido dentro de is_admin())
drop policy if exists site_pages_admin on public.site_pages;
create policy site_pages_admin on public.site_pages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists site_snippets_admin on public.site_snippets;
create policy site_snippets_admin on public.site_snippets
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists faq_items_admin on public.faq_items;
create policy faq_items_admin on public.faq_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists site_revisions_admin on public.site_content_revisions;
create policy site_revisions_admin on public.site_content_revisions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.site_content_revisions from anon;

-- trigger: carimba autor/data e guarda a versão anterior antes de cada UPDATE
create or replace function public.site_content_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_id text;
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    -- to_jsonb(old)->>'x' funciona em qualquer tabela sem referência de coluna cruzada
    v_ref_id := coalesce(
      to_jsonb(old) ->> 'slug',
      to_jsonb(old) ->> 'key',
      to_jsonb(old) ->> 'id'
    );
    insert into public.site_content_revisions (ref_type, ref_id, snapshot, created_by)
    values (
      case tg_table_name
        when 'site_pages' then 'page'
        when 'site_snippets' then 'snippet'
        else 'faq'
      end,
      v_ref_id,
      to_jsonb(old),
      auth.uid()
    );
  end if;
  return new;
end
$$;

drop trigger if exists trg_site_pages_snapshot on public.site_pages;
create trigger trg_site_pages_snapshot before insert or update on public.site_pages
  for each row execute function public.site_content_snapshot();

drop trigger if exists trg_site_snippets_snapshot on public.site_snippets;
create trigger trg_site_snippets_snapshot before insert or update on public.site_snippets
  for each row execute function public.site_content_snapshot();

drop trigger if exists trg_faq_items_snapshot on public.faq_items;
create trigger trg_faq_items_snapshot before insert or update on public.faq_items
  for each row execute function public.site_content_snapshot();

-- ── SEED — textos curtos do Hero / Home ────────────────────────────────────
insert into public.site_snippets (key, label, value) values
  ('hero_kicker',       'Hero · selo (linha pequena acima do título)', 'A Vida Não Colabora'),
  ('hero_title',        'Hero · título — 1ª linha',                    'A vida nem sempre colabora.'),
  ('hero_title_accent', 'Hero · título — 2ª linha (verde)',            'Você não precisa organizar tudo sozinho.'),
  ('hero_subtitle',     'Hero · subtítulo',                            'Escreva como foi seu dia. Aos poucos, o A Vida Não Colabora ajuda você a perceber o que pesa, o que ajuda e o que está mudando.'),
  ('hero_cta',          'Hero · texto do botão principal',             'Começar gratuitamente'),
  ('hero_reassurance',  'Hero · linha de segurança abaixo do botão',   'Privado · sem julgamentos · no seu ritmo')
on conflict (key) do nothing;

-- ── SEED — páginas institucionais (markdown do blog: ##, **, listas) ───────
insert into public.site_pages (slug, title, body_md) values
('sobre', 'Sobre nós', $md$O **A Vida Não Colabora** nasceu para ser um espaço de acolhimento, reflexão e organização emocional — para quem sente que as coisas às vezes pesam demais, e que carrega tudo sem apoio.

## Nossa missão

Nossa missão é oferecer um espaço seguro, gentil e sem julgamentos para que as pessoas possam registrar como estão se sentindo, entender seus padrões emocionais e criar pequenos hábitos de autocuidado no dia a dia.

Acreditamos que o autoconhecimento é um caminho poderoso — e que cada pessoa merece ferramentas para se entender melhor, sem pressão e no seu próprio ritmo.

## Para quem é

Este espaço foi criado para pessoas que:

- Querem entender melhor suas emoções
- Vivem altos e baixos emocionais frequentes
- Precisam de um lugar seguro para registrar o que sentem
- Querem criar uma rotina de autocuidado de forma sustentável
- Buscam acompanhar sua evolução emocional ao longo do tempo
- Desejam apoio sem julgamento e sem pressa

## O que oferecemos

- **Diário de bem-estar** — espaço para registrar sentimentos com diferentes níveis de profundidade conforme o plano.
- **Questionários de autoavaliação** — perguntas acolhedoras para entender como você está se sentindo.
- **Gráficos e relatórios** — visualize seus padrões emocionais e evolução ao longo do tempo.
- **Pequenas práticas de autocuidado** — ações pequenas e práticas para criar hábitos positivos no dia a dia.
- **Artigos e conteúdos** — textos reflexivos sobre bem-estar emocional, autoconhecimento e autocuidado.
- **Planos personalizados** — sugestões e planos de autocuidado adaptados ao que você está vivendo.

## O que não prometemos

- Não fazemos diagnósticos de qualquer tipo
- Não substituímos acompanhamento psicológico, psiquiátrico ou médico
- Não tratamos condições de saúde mental
- Não prometemos cura ou resultado clínico de qualquer natureza
- Não somos um serviço de emergência ou crise

## Sobre o autoconhecimento

O autoconhecimento é um processo contínuo, não linear e profundamente pessoal. Ele não exige perfeição — exige presença e disposição para olhar para si com honestidade e gentileza.

Registrar o que sentimos, perceber padrões e nomear emoções são práticas simples que, ao longo do tempo, podem transformar nossa relação conosco e com o mundo ao redor.

Aqui, nenhuma emoção é errada. Nenhum caminho é mais válido do que outro. Você está no lugar certo, da forma que você é.

## Aviso importante

Este serviço não substitui acompanhamento psicológico, psiquiátrico, médico ou atendimento de emergência. Se você estiver em crise, ligue para o **CVV: 188** (gratuito, 24h) ou acesse cvv.org.br.$md$),

('termos', 'Termos de Uso', $md$**Última atualização: Agosto de 2026**

## Aviso de não emergência

**Este serviço NÃO é adequado para situações de crise ou emergência.** Se você estiver pensando em se machucar, em suicídio, ou estiver em perigo, por favor:

- Ligue para o CVV: 188 (gratuito, 24h)
- Ligue para o SAMU: 192
- Vá ao pronto-socorro mais próximo

## 1. Uso aceitável

O A Vida Não Colabora é uma plataforma de apoio ao autoconhecimento e organização emocional. Ao usar este serviço, você concorda em utilizá-lo de forma responsável e respeitosa.

É proibido usar a plataforma para fins ilegais, compartilhar conteúdo que prejudique terceiros, tentar acessar dados de outros usuários ou burlar sistemas de segurança.

## 2. O que a plataforma é — e o que não é

**O que somos:**

- Uma ferramenta de autoconhecimento
- Um espaço de organização emocional
- Um diário digital de bem-estar
- Uma plataforma de conteúdos sobre autocuidado
- Um recurso de suporte emocional complementar

**O que não somos:**

- Um serviço de saúde mental clínico
- Um substituto para psicólogo ou psiquiatra
- Um serviço de diagnóstico
- Um serviço de emergência ou crise
- Uma plataforma médica de qualquer tipo

## 3. Responsabilidade do usuário

Você é responsável por manter suas credenciais de acesso em segurança e por todas as atividades realizadas em sua conta.

Ao usar este serviço, você reconhece que ele é uma ferramenta complementar de autocuidado e que decisões sobre sua saúde mental devem ser tomadas com o auxílio de profissionais habilitados.

## 4. Limitações do serviço

Declaramos explicitamente que:

- Não realizamos diagnósticos de condições de saúde mental
- Não prescrevemos tratamentos, medicamentos ou intervenções clínicas
- Não garantimos resultados terapêuticos de qualquer natureza
- Relatórios e gráficos são para fins de autoconhecimento, não clínicos
- O Plano Plus inclui orientação mensal por mensagem e comentário profissional — não é psicoterapia clínica
- Não substituímos acompanhamento profissional continuado

## 5. Planos e pagamentos

Os planos pagos são cobrados mensalmente via Stripe. Você pode cancelar a qualquer momento sem multa. O cancelamento é efetivo no final do período já pago.

Reservamo-nos o direito de alterar preços com aviso prévio de 30 dias. Assinantes ativos serão notificados por e-mail.

## 6. Propriedade intelectual

Todo o conteúdo da plataforma (artigos, exercícios, pausas emocionais, design) é propriedade do A Vida Não Colabora. O conteúdo pessoal que você registra no diário é seu e pode ser exportado ou excluído a qualquer momento.

## 7. Contato

Dúvidas sobre estes termos: contato@avidanaocolabora.com.br$md$),

('privacidade', 'Política de Privacidade', $md$**Última atualização: Agosto de 2026**

Sua privacidade é fundamental para nós. Esta política explica de forma clara como tratamos seus dados — especialmente informações ligadas à sua jornada emocional, que exigem cuidado reforçado.

## 1. Quais dados coletamos

- **Dados de conta:** nome, e-mail, preferências e informações de perfil. A autenticação e a senha são gerenciadas pelo Supabase Auth; o aplicativo não recebe sua senha em texto legível para armazenamento.
- **Dados do diário e check-ins:** textos, notas, humor, energia, sono, dor, marcadores emocionais, contextos, necessidades, ações de cuidado e gatilhos que você registrar.
- Dados de questionários, relatórios, mapas emocionais, planos de autocuidado e orientações vinculados à sua conta.
- **Dados de uso e comunicação:** páginas e funcionalidades utilizadas, notificações, preferências de e-mail, tickets de suporte e histórico relacionado ao funcionamento do serviço.
- Dados de assinatura e cobrança necessários para identificar o plano e acompanhar pagamentos; os dados do cartão são processados pelo Stripe e não são armazenados pelo aplicativo.

## 2. Por que tratamos esses dados

- Para autenticar sua conta, manter o serviço seguro e disponibilizar as funcionalidades contratadas.
- Para oferecer diário, check-ins, mapa emocional, relatórios, planos e demais recursos do produto.
- Para personalizar conteúdos e recomendações conforme seus registros, preferências e plano.
- Para responder solicitações de suporte, administrar preferências de comunicação e melhorar a operação do serviço.
- Para processar e acompanhar assinaturas e pagamentos de forma segura.

## 3. Como os dados são usados

Usamos seus dados para operar, proteger e melhorar o serviço e para entregar as funcionalidades que você utiliza. Não vendemos ou alugamos seus dados pessoais a anunciantes.

Recursos de inteligência artificial podem processar o conteúdo ou resumos necessários para gerar artigos, relatórios, planos, recomendações e outros recursos. Enviamos ao provedor somente o contexto necessário para aquela geração e mantemos mecanismos de validação e fallback no backend.

Em funcionalidades do Plus que incluem revisão profissional, o profissional recebe o relatório ou o contexto necessário para produzir a devolutiva prevista naquele recurso. Isso não significa acesso livre ou rotineiro da equipe ao seu diário completo.

## 4. Armazenamento, segurança e retenção

O aplicativo utiliza Supabase para autenticação, banco de dados e armazenamento e Vercel para hospedagem da aplicação web. As conexões de produção utilizam HTTPS. Pagamentos são processados pelo Stripe, e o aplicativo não armazena os dados completos do seu cartão.

Enquanto sua conta estiver ativa, conservamos os dados necessários para prestar o serviço e manter os históricos que você utiliza. Ao concluir a exclusão por autoatendimento, removemos a conta e os dados pessoais vinculados ao aplicativo. Prestadores externos podem conservar registros próprios quando isso for necessário para segurança, prevenção a fraude, auditoria ou cumprimento de obrigação legal, conforme as políticas e prazos aplicáveis a cada prestador.

## 5. Prestadores e compartilhamento necessário

Para operar o serviço, podemos utilizar os seguintes prestadores conforme a funcionalidade:

- **Supabase:** autenticação, banco de dados, armazenamento e funções de backend.
- **Vercel:** hospedagem e entrega da aplicação web.
- **Stripe:** processamento e gestão de assinaturas e pagamentos.
- **Resend e infraestrutura de e-mail configurada:** envio de comunicações transacionais e outras mensagens permitidas pelas suas preferências.
- **Provedores de inteligência artificial configurados no backend**, como Google Gemini, Groq e, quando habilitado, OpenAI: processamento do contexto necessário para funcionalidades de IA.
- **Autoridades ou terceiros legitimados:** quando houver obrigação legal ou ordem válida aplicável.

Quando um recurso do Plus prevê participação profissional, o compartilhamento fica limitado ao relatório ou contexto necessário para aquela devolutiva e ao fluxo apresentado na própria plataforma.

## 6. Seus direitos e controles de privacidade

Nos termos da legislação aplicável, você pode exercer direitos relacionados aos seus dados, incluindo:

- Acessar os dados vinculados à sua conta e obter uma cópia em formato legível.
- Corrigir informações incompletas, inexatas ou desatualizadas.
- Solicitar eliminação, anonimização ou outras medidas quando aplicáveis.
- Revogar consentimentos e ajustar preferências de comunicação quando o tratamento depender dessa escolha.
- Solicitar informações sobre o tratamento e a portabilidade nos casos previstos em lei.

Usuários autenticados podem usar **Meu perfil → Privacidade e seus dados** para baixar uma cópia dos dados da conta ou iniciar a exclusão definitiva. A exclusão exige confirmação adicional com a senha atual.

## 7. Dados emocionais — confidencialidade

**Tratamos dados do diário e informações emocionais com cuidado reforçado.**

O diário não é uma área pública nem uma caixa de leitura livre para a equipe. Seus registros são protegidos por controles de acesso e podem ser processados automaticamente para gerar recursos da própria conta. Quando uma funcionalidade contratada prevê revisão profissional, é fornecido o relatório ou contexto necessário para aquela finalidade, conforme descrito no recurso.

## 8. Como falar sobre privacidade

Para dúvidas, solicitações adicionais ou exercício de direitos que não estejam disponíveis no autoatendimento, utilize a página de contato ou o formulário de suporte da plataforma. Assim sua solicitação fica registrada e pode ser acompanhada pela equipe.$md$),

('aviso-responsabilidade', 'Aviso de Responsabilidade', $md$Se você está passando por uma crise emocional severa, pensamentos de se machucar ou situação de emergência, procure ajuda imediata.

**CVV – Centro de Valorização da Vida:** ligue 188 (24h) ou acesse cvv.org.br.

## O que é este serviço

A Vida Não Colabora é uma plataforma digital de apoio ao autoconhecimento emocional e organização do bem-estar pessoal. Não somos um serviço de saúde mental clínico e não oferecemos diagnóstico, tratamento, psicoterapia ou acompanhamento médico.

## O que não fazemos

- Não realizamos diagnósticos de qualquer natureza
- Não substituímos psicólogos, psiquiatras ou qualquer profissional de saúde
- Não oferecemos tratamento clínico
- Não garantimos resultados terapêuticos
- Não nos responsabilizamos por decisões tomadas com base apenas nas informações deste site

## O que fazemos

Oferecemos um espaço seguro para registro emocional, organização de pensamentos, conteúdos educativos sobre saúde emocional e ferramentas de autoconhecimento. Nosso objetivo é apoiar — não substituir — o cuidado profissional.

## Quando buscar ajuda profissional

Se você percebe sintomas persistentes de ansiedade, depressão, crises emocionais frequentes, pensamentos de autolesão ou qualquer condição que afete significativamente sua qualidade de vida, procure um profissional de saúde mental.$md$)
on conflict (slug) do nothing;

-- ── SEED — FAQ ────────────────────────────────────────────────────────────
insert into public.faq_items (category, question, answer, sort_order) values
('Conta e acesso', 'Como crio minha conta?', 'Clique em "Começar gratuitamente" em qualquer página, informe seu nome, e-mail e crie uma senha. Depois do cadastro, enviamos um link de confirmação para o endereço informado. O acesso à área logada é liberado somente após confirmar o e-mail. Se o link não chegar, verifique a caixa de spam ou use a opção de reenviar na tela de confirmação.', 10),
('Conta e acesso', 'Esqueci minha senha. O que faço?', 'Na tela de login, clique em "Esqueci minha senha". Você receberá um link de redefinição no e-mail cadastrado. O link expira em 1 hora.', 20),
('Conta e acesso', 'Posso usar no celular?', 'Sim. A plataforma funciona em qualquer navegador mobile (Chrome, Safari, Firefox). Não há necessidade de instalar aplicativo — acesse pelo navegador do seu celular normalmente.', 30),
('Conta e acesso', 'Posso excluir minha conta?', 'Sim. Em Meu perfil > Privacidade e seus dados, você pode excluir a conta por autoatendimento. Para sua segurança, é necessário informar a senha atual e digitar EXCLUIR. A conta e os dados pessoais vinculados ao aplicativo são removidos ao concluir o processo; se houver cadastro de cobrança no Stripe, ele é encerrado antes da exclusão para impedir novas cobranças. Registros que prestadores precisem conservar por obrigação legal, segurança ou auditoria seguem os prazos aplicáveis desses prestadores.', 40),
('Planos e pagamento', 'O plano gratuito tem prazo de validade?', 'Não. O plano Gratuito é para sempre, sem limite de tempo. Você pode usar as funcionalidades básicas pelo tempo que quiser, sem precisar inserir cartão de crédito.', 50),
('Planos e pagamento', 'Qual a diferença entre os planos?', 'O plano Gratuito dá acesso ao diário básico (5 registros/mês), blog aberto e questionário inicial. O Essencial libera diário ilimitado, histórico completo, mapa emocional e relatório semanal. O Plus inclui tudo do Essencial mais plano de autocuidado mensal, relatório aprofundado e orientação por mensagem com profissional.', 60),
('Planos e pagamento', 'Como funciona o pagamento?', 'Os planos pagos são cobrados mensalmente via cartão de crédito, processados com segurança pelo Stripe (padrão PCI DSS nível 1). Não armazenamos dados do seu cartão.', 70),
('Planos e pagamento', 'Posso cancelar quando quiser?', 'Sim, sem multa. Ao cancelar, seu acesso ao plano pago continua até o final do período já pago. Após isso, sua conta volta automaticamente para o plano Gratuito e seus dados ficam preservados.', 80),
('Planos e pagamento', 'Existe reembolso?', 'Analisamos pedidos de reembolso caso a caso. Em geral, oferecemos reembolso proporcional nos primeiros 7 dias após a assinatura se o serviço não atendeu ao esperado. Entre em contato pelo formulário abaixo.', 90),
('Diário e funcionalidades', 'Meus registros do diário são privados?', 'Sim. Seus registros ficam protegidos por controles de acesso e não são disponibilizados publicamente. O conteúdo pode ser processado automaticamente para gerar mapas, relatórios, planos e recomendações. Em recursos do Plus que preveem revisão profissional, o profissional recebe o relatório ou o contexto necessário para a devolutiva, conforme o fluxo apresentado a você; isso não transforma o diário em uma área de leitura livre pela equipe.', 100),
('Diário e funcionalidades', 'Posso exportar meus dados?', 'Sim. Em Meu perfil > Privacidade e seus dados, clique em "Baixar meus dados". A plataforma prepara um arquivo JSON legível com os dados vinculados à sua conta, incluindo perfil, diário, check-ins, questionários, relatórios, planos, preferências, suporte, histórico de uso e informações de assinatura/cobrança aplicáveis.', 110),
('Diário e funcionalidades', 'Os conteúdos do blog são para todos?', 'Os conteúdos marcados como "Público" podem ser lidos por qualquer pessoa, sem precisar criar conta. Conteúdos dos planos Essencial e Plus ficam disponíveis somente para assinantes dos respectivos planos.', 120),
('Diário e funcionalidades', 'O que é o mapa emocional?', 'O mapa emocional é uma visualização dos seus registros ao longo do tempo — humor, energia, sintomas e padrões emocionais — apresentados em gráficos e resumos. Disponível no plano Essencial e Plus.', 130),
('Saúde e segurança', 'Vocês fazem diagnósticos?', 'Não. A plataforma é uma ferramenta de autoconhecimento e organização emocional. Não realizamos diagnósticos de qualquer tipo. Se você precisar de avaliação clínica, procure um profissional de saúde mental habilitado.', 140),
('Saúde e segurança', 'E se eu estiver em crise?', 'Se você estiver em crise ou pensando em se machucar, procure ajuda imediatamente: CVV 188 (gratuito, 24h) ou SAMU 192. Esta plataforma não é um serviço de emergência.', 150),
('Saúde e segurança', 'O Plano Plus substitui o acompanhamento com psicólogo?', 'Não. São recursos diferentes e complementares do Plus: o comentário profissional fica ligado ao relatório mensal e oferece uma devolutiva breve sobre aquela leitura; a orientação mensal por mensagem parte de uma pergunta específica enviada por você. Nenhum dos dois substitui psicoterapia ou acompanhamento clínico continuado.', 160)
on conflict do nothing;
