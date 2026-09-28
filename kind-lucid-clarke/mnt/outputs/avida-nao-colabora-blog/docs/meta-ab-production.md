# Meta A/B — contrato de produção

## Objetivo
Comparar duas rotas de aquisição sem enviar conteúdo emocional para a Meta.

## Variante A — landing de check-in
`https://www.avidanaocolabora.com/ig?utm_source=facebook&utm_medium=paid_social&utm_campaign=avnc_ab_signup&utm_content=ab_ig_landing`

## Variante B — Home
`https://www.avidanaocolabora.com/?utm_source=facebook&utm_medium=paid_social&utm_campaign=avnc_ab_signup&utm_content=ab_site_home`

O `fbclid` é acrescentado pela Meta quando aplicável e é classificado apenas pelo tipo, sem ser copiado para os eventos próprios.

## Eventos internos usados no funil
- `campaign_landing_view`
- `ig_checkin_start` (somente variante /ig)
- `ig_checkin_complete` (somente variante /ig)
- `signup_click`
- `registration_complete` / `email_confirmation_success`

## Conversões Meta
- `PageView`: somente após consentimento de marketing.
- `CompleteRegistration`: somente depois da confirmação do e-mail.
- Pixel e Conversions API usam o mesmo `event_id` de cadastro para deduplicação.

## Privacidade
Não enviar à Meta pontuação do check-in, sentimentos selecionados, texto de diário, respostas de questionários ou qualquer outro conteúdo emocional.

## Leitura do experimento
O Admin compara `ig_landing` e `site_home`. A interface considera o teste abastecido para leitura apenas quando cada variante possui ao menos 100 visitas registradas. Isso é um limiar operacional de amostra, não uma declaração automática de significância estatística.
