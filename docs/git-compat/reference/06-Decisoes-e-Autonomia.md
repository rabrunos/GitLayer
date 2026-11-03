# Decisões do usuário e autonomia técnica — v2

**18/10/2026. Esta revisão substitui as orientações conflitantes do pacote v1.**

## 1. O trabalho autorizado agora

Esta rodada prepara a base de engenharia para o **Git Layer**, produto de Core/CLI integrado ao uso do Git oficial. O Codex deve estudar o repositório, atualizar documentação e instruções, implementar a infraestrutura de testes, converter cenários em testes reais, executar o que for viável e produzir relatório detalhado.

**Não é uma rodada de implementação ou correção do produto.** Não alterar comportamento de `src/core/`, `src/cli/` nem do desktop; não migrar armazenamento; não implementar interceptação de branches; não desenvolver funcionalidades novas para fazer testes passarem. Falhas da infraestrutura, fixtures, asserções ou documentação são corrigidas agora. Defeitos reais do produto são reproduzidos, registrados e preservados para a fase seguinte.

Esta delimitação é da tarefa atual, não uma proibição permanente de evoluir o Core. A frase anterior sobre “corrigir erros” deve ser interpretada conforme esta distinção, explicitada depois pelo usuário.

## 2. Papéis após esta preparação

O usuário e o ChatGPT discutem o que o produto deve fazer, sua utilidade e o comportamento percebido. O Codex, que terá o código e a validação local, investiga alternativas técnicas, escolhe e justifica a implementação, executa os testes e entrega evidências.

O ChatGPT não deve congelar um algoritmo, uma biblioteca ou uma organização interna para cada ideia futura. O Codex não deve modificar uma expectativa de usuário apenas para acomodar uma solução conveniente. Quando houver um conflito real entre comportamentos desejados, o relatório deve explicar a incompatibilidade e as escolhas de produto necessárias, sem pedir ao usuário que decida detalhes técnicos de rotina.

Autonomia de engenharia não equivale a autorização permanente para publicar, alterar dados pessoais ou modificar o Git instalado. O escopo da tarefa de cada rodada continua valendo.

## 3. Decisões já registradas

| ID | Direção confirmada | Aplicação nesta rodada |
|---|---|---|
| U-01 | A referência de compatibilidade é o Git oficial. Outros projetos de mesmo nome, libgit2/JGit, IDEs e ferramentas de terceiros não são alvo de compatibilidade agora. | Classificar e adiar roteiros externos, sem usá-los como bloqueio da entrega. Preservar o inventário, sem executar aplicações alheias. |
| U-02 | Enquanto não houver eventual integração oficial futura, usar nomes `layer/<nome>` para as branches que representam Layers. | Manter `refs/heads/layer/<nome>`; não trocar para `refs/layers/`, nem impor outro namespace. Integração upstream é intenção futura, não fato ou garantia. |
| U-03 | Preferência para o nome do armazenamento privado: `layers`, em minúsculas, em vez de `git-layers`. | Documentar o destino desejado e preparar os casos de migração. Não renomear nem migrar dados nesta rodada. |
| U-04 | Reutilizar ao máximo objetos, índices, referências, comandos e formatos reais do Git. O que precisar ser próprio deve ser familiar e coerente com o Git, sem duplicação desnecessária. | Estudar e provar o uso dos formatos existentes. Não inventar um índice “parecido” quando um índice Git real atende. Não predeterminar a futura implementação de metadados adicionais. |
| U-05 | O produto deve funcionar por comandos, sem depender do editor de laboratório, VS Code ou extensão visual. | Harness headless. Nenhuma janela, automação visual, renderer ou sessão do editor para validar Core/CLI. |
| U-06 | O editor de laboratório é para os testes manuais do usuário; só será alterado quando houver pedido específico. | Preservar código, UX, configurações e scripts do desktop. Não executar Dev/Debug/UI nem empacotar Electron nesta tarefa. |
| U-07 | Layers devem ser ativadas/desativadas, não selecionadas como branches tradicionais no comportamento desejado do produto instalado. | Registrar como requisito futuro, investigar o limite do Git nativo e criar casos de caracterização. Não apresentar um filtro de UI, erro posterior ou mero wrapper como comprovação universal. |
| U-08 | Uma adição normal à base não deve incluir indevidamente arquivos de uma Layer. | Criar asserções independentes de índice e, em seguida, commit/árvore, usando o Git oficial real. `add .` e adição forçada são variantes distintas. |
| U-09 | A documentação, ideias antigas, restrições e o `AGENTS.md` podem ser reorganizados pelo Codex para preparar o avanço. | Revisar instruções agora, com diff e justificativa. Preservar proteções de dados e evidências; reclassificar limites históricos como estado atual, não veto eterno. |
| U-10 | O Codex deverá entregar um relatório completo para o usuário devolver ao ChatGPT. | Markdown autossuficiente + dados estruturados + evidências portáveis + inventário por ID. Não depender só de texto na conversa ou logs dispersos. |

## 4. O que não foi decidido pelo usuário

Não estão definidos algoritmo de projeção, interceptação, hooks/wrappers, backend de metadados, distribuição binária, política completa de conflitos, remoção de Layers, importação de refs, compartilhamento entre worktrees, retenção, formato final de JSON público ou comportamento para todos os comandos destrutivos.

Não transformar listas de alternativas do v1 em decisões obrigatórias. O Codex deve investigar quando uma funcionalidade entrar no escopo futuro e registrar suas razões. A matriz deve permitir acrescentar contratos sem reescrever o oráculo a cada implementação.

A intenção de compatibilidade ampla não é uma afirmação de que o protótipo já suporta tudo. Também não significa que uma operação destrutiva explicitamente solicitada pelo usuário deva perder sua semântica sem uma decisão de produto. Caracterizar o Git e identificar o risco não resolve essa política automaticamente.

## 5. Preservar dados não é compatibilidade com terceiros

Não há exigência de integrar outro aplicativo chamado git-layer. Ainda assim, arquivos desconhecidos em um destino de armazenamento não podem ser apagados ou apropriados automaticamente. Essa proteção existe para preservar trabalho do usuário, não para prestar suporte a outra ferramenta.

Não executar launchers desconhecidos do PATH. Não alterar PATH/global Git, hooks ou serviços pessoais para contornar colisões durante testes. Tudo necessário à caracterização deve existir em fixture isolada.

## 6. Estados que a documentação deve distinguir

- **Fato do Git oficial:** comportamento documentado e/ou observado na versão identificada.
- **Estado atual do projeto:** comportamento do commit/snapshot testado, inclusive restrições e falhas.
- **Comportamento desejado:** requisito do usuário com ID U-xx ou decisão posterior.
- **Decisão técnica:** escolha investigada pelo Codex para uma tarefa autorizada; não precisa ser aprovada detalhe por detalhe.
- **Hipótese:** suspeita ainda não reproduzida; não pode virar bug confirmado nem garantia.

O código é a fonte da verdade sobre o que está implementado. As instruções mais recentes e os requisitos aprovados definem o que é desejado. Um arquivo antigo não pode transformar uma limitação temporária em especificação permanente.
