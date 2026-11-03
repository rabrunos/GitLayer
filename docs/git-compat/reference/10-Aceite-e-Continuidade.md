# Aceite e uso nas próximas rodadas

## Entrega de preparação aceita

Há documentação consistente, AGENTS revisado com histórico, catálogo versionado, matriz por ID, runner headless funcional, testes reais das áreas viáveis, validação do próprio runner, seleção/reprodução, resultados honestos e relatório completo portável. O aceite da preparação não significa ausência de defeitos no produto nem suporte a todos os comandos.

É obrigatório declarar o restante: casos só especificados, funcionalidade ausente, contrato indefinido, ambiente não disponível, itens fora do escopo e casos não selecionados. Uma lista de 344 entradas ou 344 skips não atende à entrega de testes reais. Da mesma forma, o Codex não deve corrigir o produto nesta rodada para forçar uma aparência de conclusão.

## Verificação dos limites

Fontes de produto preservadas, sem lançamento de editor, sem migração real, sem alteração do Git instalado/global, sem publicação/commit remoto, sem dados pessoais em fixtures ou evidências. Alterações de documentação/testes/configuração devem estar identificadas. Scripts previamente existentes não devem ser removidos silenciosamente.

## Rota de uma funcionalidade futura

O usuário descreve o comportamento e o problema que pretende resolver. O ChatGPT ajuda a esclarecer utilidade e expectativas, sem fixar toda a implementação. O Codex recebe a tarefa autorizada, consulta a documentação e o código, investiga alternativas, escolhe e registra a solução técnica, acrescenta critérios/testes necessários, implementa e usa o runner para demonstrar o resultado.

Não é preciso obrigar o usuário a aprovar algoritmo a algoritmo. Se duas expectativas de produto realmente forem incompatíveis, o Codex apresenta evidências e alternativas de comportamento. Uma limitação do protótipo pode ser superada; uma expectativa do usuário não pode ser reduzida silenciosamente para acomodar código antigo.

Cada rodada deve associar requisito → investigação/decisão → alteração → teste → evidência. Mudança de mecanismo interno não deve invalidar testes focados no comportamento, salvo quando o contrato foi explicitamente alterado ou a expectativa anterior era incorreta com justificativa.

## Dois artefatos diferentes

O ZIP recebido agora é material de referência e autorização de trabalho para o Codex. Não contém a implementação do runner nem resultados de Git executado.

O ZIP que o Codex produzirá ao concluir a tarefa conterá o relatório e as evidências reais. O usuário devolverá esse segundo ZIP ao ChatGPT para análise. Esses dois pacotes não podem ser confundidos no relatório.
