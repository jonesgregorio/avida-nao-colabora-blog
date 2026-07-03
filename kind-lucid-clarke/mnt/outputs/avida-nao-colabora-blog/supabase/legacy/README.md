# Schemas Legados

Os arquivos nesta pasta são **legados** e **não devem ser aplicados manualmente**.

Todo o conteúdo foi consolidado nas migrations oficiais em `supabase/migrations/`.

| Arquivo | Conteúdo consolidado em |
|---------|------------------------|
| `automation_schema.sql` | `003_z_prereqs.sql` + `046_consolidate_schemas.sql` |
| `admin_schema.sql` | `007_missing_tables.sql` + `046_consolidate_schemas.sql` |
| `interactive_schema.sql` | `007_missing_tables.sql` + `046_consolidate_schemas.sql` |
| `new_features_schema.sql` | `043_articles_columns_and_indexes.sql` + `046_consolidate_schemas.sql` |
| `update_article_images.sql` | `046_consolidate_schemas.sql` (backfill image_url) |

## Como aplicar as migrations

Acesse o [Painel do Supabase](https://app.supabase.com) → SQL Editor e execute os arquivos
em `supabase/migrations/` em ordem numérica (001 → 046).

Ou use o Supabase CLI:

```bash
supabase db push
```
