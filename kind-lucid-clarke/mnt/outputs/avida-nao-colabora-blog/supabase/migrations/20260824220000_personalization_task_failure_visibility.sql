-- run-automations processava até 10 user_personalization_tasks pendentes por
-- hora e, em caso de falha (erro de IA, snapshot malformado etc.), apenas
-- ignorava e seguia (catch{} silencioso) -- sem gravar nada, sem limite de
-- tentativas. Uma tarefa que falha de forma determinística ocupa uma das 10
-- vagas por hora indefinidamente, sem nenhuma visibilidade no Admin. Adiciona
-- last_error/attempts para tornar a falha visível e um teto de tentativas
-- para parar de tentar tarefas quebradas (evita backlog silencioso).

ALTER TABLE user_personalization_tasks
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;
