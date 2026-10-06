# Criação e publicação de artigos

A Fábrica IA e as automações usam o mesmo contrato editorial. O briefing contém referências oficiais selecionadas e o catálogo público para diferenciar a intenção e oferecer links reais. As referências são uma base curada, não pesquisa automática de toda a web: alegações novas exigem conferir uma fonte apropriada na revisão.

## Antes de publicar

1. Confira a resposta inicial, finalidade distinta, precisão e exemplos identificados como fictícios.
2. Confira as referências, suas alegações e os destinos dos links internos.
3. Confira autoria real e texto alternativo da fotografia escolhida. Na Fábrica, a descrição do fornecedor é traduzida; a tradução não substitui conferir a imagem.
4. Complete título/descrição de SEO, palavra-chave e termos secundários, resumo, capa, pergunta e CTA.
5. Confirme a revisão editorial no editor e publique ou agende.

O editor usa o validador compartilhado e verifica o catálogo novamente. Alterar um campo ou restaurar uma versão invalida a confirmação. Rascunhos de artigo não recebem uma revisão fictícia. Publicações de origem IA ganham transparência editorial sem atribuir revisão clínica.

## Automação

Artigos gerados ficam como rascunho até revisão humana, inclusive automações legadas configuradas como `auto_publish`. Novas automações oferecem aprovação obrigatória. Publicação em massa de artigos direciona ao editor; práticas e pausas mantêm o fluxo existente.

Não há expansão automática para atingir uma contagem de palavras. O limite técnico de 300 caracteres evita conteúdo vazio, mas não representa recomendação de extensão ou avaliação de qualidade pelo Google.

O catálogo é conferido até 500 registros. Ao atingir esse limite ou falhar a consulta, geração/publicação interrompem a operação com aviso em vez de supor uma lista completa. A similaridade por título/termo principal é uma triagem: intenção e originalidade precisam de revisão editorial.

Essas verificações protegem os fluxos de admin e o executor editorial; não constituem uma nova restrição de banco para todas as APIs. Nenhuma política de acesso foi alterada.

## Validação

Testes funcionais cobrem publicação de texto útil mais curto, revisão/autoria, fontes, URLs internas inexistentes, H1 duplicado, seleção de artigos públicos, sobreposição de temas e transparência idempotente de IA.

Após o merge, os workflows existentes publicam frontend e Edge Functions. Conferir os dois deployments antes de considerar a mudança disponível em produção.

## Entregas por acesso

- Público: explicação completa e uma ação possível, sem cadastro.
- Gratuito com conta: exercício inicial ligado ao diário, respeitando limites do plano e oferecendo alternativa em papel.
- Essencial: roteiro, modelo copiável, exemplo fictício preenchido, adaptação para pouca energia e revisão semanal.
- Plus: as entregas Essencial mais cenários e alternativas, critérios para escolher, revisão mensal e plano de acompanhamento adaptável.

O plano é passado na geração individual, em massa, no assistente do editor e no executor editorial. A validação compartilhada exige os blocos preenchidos do plano antes de publicar/agendar. Não mede precisão ou utilidade por contagem: o editor informa que a checagem é estrutural.

A Fábrica e o executor tentam completar blocos faltantes uma única vez. Falhas mantêm o rascunho e os avisos, sem publicar. A seleção automática de relacionados prioriza temas e acessos disponíveis ao leitor, sem recomendar um conteúdo Plus para o Público ou Essencial.

Para um artigo existente, abra o editor e use **Entregas do artigo → Preparar aprofundamento com IA**. A proposta fica no formulário; salvar ou publicar continua sendo uma ação explícita. A ferramenta não sobrescreve em lote os artigos publicados e não usa registros pessoais dos leitores para inventar personalização. Fontes, adequação do modelo e profundidade precisam ser conferidas pelo editor.
