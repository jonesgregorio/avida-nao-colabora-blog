-- ============================================================================
-- Migration 062: entry_type 'checkin' em diary_entries (§8)
-- O check-in rápido NÃO deve consumir o limite de 5 registros/mês do Gratuito.
-- Passa a existir um tipo próprio 'checkin'; o limite conta apenas 'diary'.
-- Idempotente e seguro em banco limpo ou existente.
-- ============================================================================

begin;

alter table diary_entries drop constraint if exists diary_entries_entry_type_check;
alter table diary_entries
  add constraint diary_entries_entry_type_check
  check (entry_type in ('diary', 'checkin', 'questionnaire', 'evaluation'));

commit;
