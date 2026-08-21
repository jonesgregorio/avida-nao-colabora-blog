# Migrations Supabase — padrão, histórico e procedimentos

Este documento é a referência oficial para migrations do projeto. Ele existe porque
o histórico carrega decisões que **não podem ser desfeitas** e que precisam ser
conhecidas antes de qualquer manutenção de banco.

## 1. Como o pipeline aplica migrations

`.github/workflows/apply-migrations.yml` roda em push para `main` quando algum
`.sql` do diretório de migrations muda. Ele:

1. resolve o intervalo do push (`github.event.before`..`HEAD`);
2. chama `.github/scripts/validate-migrations.sh`;
3. aplica **somente** as migrations novas aprovadas, em ordem alfabética do nome,
   via Management API (`POST /v1/projects/{ref}/database/query`).

**Consequência importante:** o pipeline executa SQL cru. Ele **não** grava nem lê
uma tabela de versões (`supabase_migrations.schema_migrations`). Não existe ledger
mantido por este fluxo. A rastreabilidade real do que foi aplicado é o **histórico
do Git**, e é por isso que as regras da seção 3 são invioláveis.

Como a ordem de aplicação é o nome do arquivo, dois arquivos com o mesmo
identificador tornam essa ordem ambígua.

## 2. Padrão obrigatório para migrations novas

```
YYYYMMDDHHMMSS_descricao.sql
```

- timestamp em **UTC**, 14 dígitos;
- descrição em minúsculas, dígitos e underscore;
- exemplo: `20260821143000_add_article_locale.sql`.

O padrão antigo `NNN_descricao.sql` está **encerrado para arquivos novos**. O CI
reprova qualquer migration nova fora do padrão acima.

Gerar o timestamp:

```bash
date -u +%Y%m%d%H%M%S
```

Como o timestamp é gerado no momento da criação, ele naturalmente fica acima do
último aplicado e não colide com nada. O último identificador em uso é
`20260820232500`.

## 3. Regras invioláveis

Uma migration que já entrou na `main` foi aplicada em produção. A partir daí:

| Ação | Permitido? | Por quê |
|---|---|---|
| Adicionar migration nova | **Sim** | é o único caminho de mudança de schema |
| Editar migration existente | **Não** | reexecutar o arquivo inteiro pode duplicar ou desfazer estado real |
| Renomear migration existente | **Não** | o nome novo entra como "nova" e o pipeline aplica de novo |
| Remover migration existente | **Não** | não desfaz o que já foi aplicado e destrói a rastreabilidade |

Precisa corrigir algo que uma migration antiga fez? **Escreva uma migration nova**
que aplique a correção. Nunca edite a antiga.

O CI aplica essas regras em dois pontos: no Pull Request (`migrations-guard`, antes
do merge) e no workflow de aplicação (antes de tocar o banco).

## 4. Histórico: identificadores duplicados

O diretório tem **164 migrations**: 127 no padrão legado `NNN_` e 37 no padrão
timestamp.

Nove identificadores aparecem duas vezes — **18 arquivos ao todo**:

| Identificador | Arquivos | Adicionados em |
|---|---|---|
| `003` | `003_articles_status_column.sql`, `003_z_prereqs.sql` | ambos 02/07/2026 |
| `060` | `060_questionnaires_mvp_and_rls.sql`, `060_articles_paywall_3plans.sql` | 09/07 e 11/07/2026 |
| `061` | `061_fix_questionnaire_runtime_schema.sql`, `061_editorial_cms.sql` | 09/07 e 11/07/2026 |
| `062` | `062_diary_entry_type_checkin.sql`, `062_articles_editorial_fields.sql` | 09/07 e 11/07/2026 |
| `067` | `067_diary_limit_ignores_checkin.sql`, `067_cron_publish_scheduled.sql` | 09/07 e 11/07/2026 |
| `068` | `068_welcome_email_copy.sql`, `068_media_storage_bucket.sql` | 10/07 e 11/07/2026 |
| `069` | `069_notifications_center.sql`, `069_cron_run_automations.sql` | 10/07 e 11/07/2026 |
| `070` | `070_diary_checkin_save_fix.sql`, `070_automation_internal_token.sql` | ambos 11/07/2026 |
| `096` | `096_touch_last_seen.sql`, `096_ticket_messages_internal_rls.sql` | 18/07 e 18/08/2026 |

**Causa:** sessões de trabalho paralelas escolheram o mesmo próximo número sem ver
o que a outra tinha criado. O caso `096` mostra que o problema continuou até agosto
de 2026 — um mês depois dos demais.

**Por que não renomear:** todos esses arquivos já foram executados no banco de
produção. Renomear qualquer um deles faria o pipeline tratá-lo como migration nova
e aplicá-lo outra vez. Como não existe ledger de versões (seção 1), não há como o
pipeline perceber que aquilo já rodou. Renomear também quebraria a correspondência
entre o histórico do Git e o que existe no banco, que hoje é a única rastreabilidade
disponível.

Portanto: **duplicidades históricas ficam como estão.** O padrão da seção 2 e as
barreiras do CI existem para impedir que a lista acima cresça.

### Ordem de aplicação dentro de um mesmo identificador

Para o par `003`, a ordem alfabética coloca `003_articles_status_column.sql` antes
de `003_z_prereqs.sql`, apesar do nome sugerir pré-requisitos. Ambos já foram
aplicados manualmente antes do pipeline existir, então isso é registro histórico,
não um problema ativo. Serve como exemplo do risco que o padrão novo elimina.

## 5. O que foi aplicado por qual caminho

O workflow de migrations foi criado em **05/07/2026** (commit `c26d2d1`). Isso
divide o histórico:

- **55 migrations** adicionadas até 05/07/2026 → aplicadas **fora** do pipeline
  (dashboard ou CLI, manualmente);
- **110 migrations** adicionadas depois → aplicadas **pelo pipeline** no merge.

Existe um caso de arquivo removido: `051_email_plan_name_bold.sql` foi adicionado
em 04/07/2026 às 23:40 e removido às 23:53 do mesmo dia, **antes** do pipeline
existir. Nunca foi aplicado automaticamente. É a única remoção do histórico e não
representa divergência com produção. Hoje não existe nenhum arquivo `051_`.

## 6. Procedimento para criar uma migration

1. gere o timestamp: `date -u +%Y%m%d%H%M%S`;
2. crie `supabase/migrations/<timestamp>_descricao.sql`;
3. escreva SQL **idempotente** (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`
   antes de `CREATE POLICY`);
4. teste o SQL primeiro dentro de `BEGIN; ... ROLLBACK;`;
5. abra o PR e confirme que `migrations-guard` passou;
6. após o merge, confirme o run de **Apply Supabase Migrations** verde;
7. **não** execute a mesma migration manualmente depois do merge — ela já foi
   aplicada pelo pipeline.

Para RLS, validar pelo menos os papéis `anon`, `authenticated` e, quando aplicável,
`service_role`/admin.

## 7. Rollback

Não existe rollback automático. O pipeline aplica; ele não desfaz.

Se uma migration causar problema:

1. **não** edite nem remova o arquivo aplicado;
2. escreva uma migration nova que reverta o efeito (o "down" explícito);
3. siga o procedimento normal da seção 6.

Reverter o commit no Git **não** desfaz o efeito no banco — só remove o arquivo do
repositório, o que é exatamente a violação descrita na seção 3. Se um revert de PR
remover um arquivo de migration, o `migrations-guard` vai reprovar e apontar isso.

## 8. Recuperação

Se o pipeline falhar no meio de um push com várias migrations, as anteriores à que
falhou **já foram aplicadas**. O log do workflow mostra cada arquivo e seu HTTP
status, então dá para identificar exatamente onde parou.

Para retomar:

1. leia o log e identifique o último arquivo com HTTP < 300;
2. corrija a causa da falha **em uma migration nova**, não no arquivo que falhou;
3. se o arquivo que falhou não chegou a aplicar nada (falhou na primeira instrução),
   ele pode ser reexecutado manualmente pelo dashboard — mas só depois de confirmar
   no banco que nenhum efeito parcial ficou.

Como as migrations são idempotentes por convenção (seção 6, item 3), reexecutar um
arquivo que aplicou parcialmente deve ser seguro. Confirme antes de assumir.

## 9. Validação de banco shadow

O histórico com identificadores duplicados impede assumir que um `supabase db reset`
limpo reproduza produção fielmente. Uma normalização dedicada do histórico seria
necessária para isso, e ela **não** pode ser feita renomeando arquivos já aplicados.

Enquanto essa normalização não acontecer, o banco de produção — e não um reset
local — é a referência de schema. Tratar como manutenção específica, comparando o
histórico real do banco antes de qualquer mudança.
