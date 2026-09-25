-- Mantém a cópia pública da Política de Privacidade alinhada ao fallback da aplicação.
-- Não altera permissões, RLS, Diário, Check-ins, planos ou funcionalidades.

update public.site_pages
set body_md = $privacy$
**Última atualização: Setembro de 2026**

No **A Vida Não Colabora**, privacidade é parte essencial da experiência. Utilizamos apenas as informações necessárias para manter sua conta, disponibilizar os recursos escolhidos, administrar assinaturas, manter a segurança da plataforma e cumprir obrigações legais.

## Seus registros são privados

O que você escreve no **Diário** e nos **Check-ins** é particular.

**Os administradores do A Vida Não Colabora não têm acesso ao conteúdo desses registros. Eles não são publicados, compartilhados com outros usuários nem ficam disponíveis para leitura pela nossa equipe.**

Esses espaços foram criados para que você possa escrever e se expressar com liberdade, preservando sua privacidade.

## Orientação Profissional

No **Plano Plus**, quando você solicitar uma Orientação Profissional, serão consideradas **somente as informações que você decidir fornecer especificamente naquela solicitação**.

O profissional não recebe acesso ao seu Diário, aos seus Check-ins ou aos demais registros privados da sua conta.

## Informações da conta

Para manter o serviço funcionando, podemos utilizar informações básicas necessárias para cadastro, acesso à conta, assinatura, comunicação, segurança e cumprimento de obrigações legais.

Não vendemos seus dados pessoais e não transformamos seus registros privados em conteúdo público.

## Segurança

Adotamos medidas de segurança destinadas à proteção das informações mantidas pela plataforma e ao controle de acessos.

Podemos utilizar serviços tecnológicos necessários para o funcionamento do A Vida Não Colabora, sempre observando as medidas aplicáveis de proteção e privacidade.

## Seus direitos

Você pode solicitar informações sobre seus dados pessoais, correção ou exclusão quando aplicável, além de exercer os demais direitos previstos na **Lei Geral de Proteção de Dados Pessoais (LGPD)**.

Solicitações ou dúvidas sobre privacidade podem ser encaminhadas pelos canais oficiais do A Vida Não Colabora.

## Alterações

Esta Política poderá ser atualizada para acompanhar mudanças na plataforma ou na legislação. Alterações relevantes poderão ser comunicadas aos usuários.
$privacy$,
updated_at = now()
where slug = 'privacidade';
