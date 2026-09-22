begin;
update public.plan_features
set feature_description='Plano mensal baseado no mês-calendário encerrado. Requer ao menos 12 registros de acompanhamento distribuídos em 8 dias ativos. Entram na base check-ins, Diário, questionários, conteúdos sugeridos e vistos, conteúdos guiados/personalizados e outros sinais estruturados úteis; quando elegível, passa por revisão humana e deve ser liberado até o dia 5 do mês seguinte.',
presentation_revision=extract(epoch from now())::bigint*1000
where feature_key='personalized_self_care_plan';
commit;