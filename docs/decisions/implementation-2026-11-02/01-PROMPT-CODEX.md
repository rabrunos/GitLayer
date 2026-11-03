# Git Layer — missão de implementação do produto

**Pacote de decisões:** 2026-11-02 · implementação 1  
**Repositório:** `rabrunos/GitLayer`  
**Checkout esperado:** o projeto local aberto na sessão, normalmente `C:\Dev\GitLayer`  
**Público desta instrução:** Codex, responsável por investigar, escolher a solução técnica, implementar e validar.

## 1. Missão atual e autorização

Implemente os comportamentos do Git Layer aprovados pelo usuário e consolidados neste documento. Esta é a etapa de **implementação do produto**, não outra rodada limitada a estudar o Git, preparar documentação ou escrever cenários.

O usuário aprovou os 27 itens do formulário e, na mensagem de 02/11/2026 às 17:48:34 UTC, pediu o prompt para realizar as implementações. Ele permite rever, refatorar ou substituir a implementação atual. O objetivo é cumprir os comportamentos desejados com o máximo de reaproveitamento do Git oficial, não conservar o protótipo por obrigação.

Você está autorizado a modificar Core, CLI, scripts, testes, configuração/build do produto, documentação e AGENTS.md. Dependências podem mudar quando necessário e justificado, com lockfile coerente; não faça atualizações indiscriminadas. Investigue e execute o trabalho, em incrementos verificáveis. Não entregue apenas um plano quando houver implementação possível dentro deste escopo.

O **editor Electron é um laboratório manual separado**. Não abra Electron, Monaco, VS Code ou GeppIO como parte da validação. Não implemente extensões visuais nem redesenhe o laboratório nesta tarefa. Preserve suas fontes e as alterações do usuário. Se a mudança do produto afetar a integração do laboratório, procure conservar contratos/adaptadores do lado do núcleo quando isso fizer sentido; registre incompatibilidades residuais para uma tarefa específica do editor. Não restrinja o novo Core a uma arquitetura inadequada apenas para conservar o desktop, nem alegue GUI testada sem executá-la.

Não faça commit, push, PR, publicação, deploy nem instalação global no repositório de desenvolvimento. Commits, branches, push/fetch, corrupção e limpeza usados como testes são permitidos **somente em fixtures descartáveis e remotos locais/loopback controlados**. Não use o origin real como laboratório. A entrega desta tarefa é local, com fontes, testes, documentação e evidências.

## 2. Leitura inicial, origem das decisões e trabalho anterior

Antes de editar, leia o repositório local, AGENTS.md e instruções aplicáveis, a arquitetura atual, a CLI e o guia de validação existente. Registre branch, HEAD, status, alterações prévias e hashes pertinentes. Não exija árvore limpa: as alterações locais anteriores fazem parte da entrada e precisam ser preservadas e integradas, sem reset/checkout para o snapshot remoto.

O GitHub consultado em 02/11/2026 ainda apontava a main para `37887aad107bd751a3687bc660a6644ef5d90c54`. Isso identifica uma versão remota consultada, **não é uma ordem para voltar a ela nem prova de que o checkout local está nessa versão**. Os relatórios anteriores descrevem mudanças importantes não commitadas. Verifique o estado real antes de decidir o que falta.

Fontes do pacote:

- `03-RESPOSTAS-ORIGINAIS.json`: cópia byte-exata do formulário devolvido pelo usuário, incluindo texto-base, 27 aprovações e observações. O arquivo recebido disfarçado de MP3 já era JSON; não é áudio.
- `04-AUTORIZACAO-ATUAL-E-ITEM-14.txt`: mensagem posterior do usuário que autoriza esta fase e esclarece a condição do item 14.
- `02-DECISOES-CONSOLIDADAS.json`: os mesmos 27 IDs, com formulação consolidada, observações originais e critérios observáveis derivados. Não acrescenta aprovação fictícia de novas funções.
- `05-PROVENIENCIA-E-LIMITES.md`: fontes, fatos verificados e contexto histórico da infraestrutura.

**Precedência funcional:** a mensagem atual e seus esclarecimentos prevalecem sobre o formulário anterior; as respostas e observações do formulário prevalecem sobre o contexto histórico nele embutido; a conversa-base vale onde não foi substituída. Código, documentação antiga, relatórios e testes descrevem estados anteriores e não substituem requisitos aprovados. Respeite as instruções superiores e as regras de segurança do ambiente.

O campo `autoriza_implementacao: false` no JSON original pertencia à etapa do formulário. Ele deve permanecer intacto como registro histórico, mas **não invalida a autorização posterior desta tarefa**. Da mesma forma, textos antigos dizendo que os itens 26 e 27 ainda eram sugestões foram superados pelas respostas aprovadas. As duas respostas complementares de GL-22 foram preenchidas e não devem voltar a ser tratadas como perguntas sem resposta.

A decisão final de GL-14 é: somente comportamento nativo do Git, sem inventar outra semântica de commit. A documentação oficial confirma que seleção de trechos é uma opção nativa. A seção do requisito incorpora esse esclarecimento; não é necessário perguntar novamente ao usuário.

## 3. Autonomia técnica e atualização de instruções

O usuário e o ChatGPT definiram **o que o produto deve fazer**, não a solução de engenharia. É sua responsabilidade investigar alternativas, decidir arquitetura, formatos adicionais, APIs internas, comandos específicos, mecanismos de observação e integração, organização de módulos e estratégia de testes. Explique as decisões materiais com evidências, sem transformar cada detalhe de engenharia em pedido de aprovação.

Pode mudar radicalmente o Core/CLI se houver justificativa. Não existe obrigação de manter o algoritmo atual, o mecanismo de captura, as restrições do laboratório ou uma dependência do pacote desktop. Essa liberdade não autoriza perder histórico, apagar alterações prévias, reduzir segurança ou retirar requisitos para simplificar a implementação.

Revise AGENTS.md e documentos de trabalho no começo. As proibições de alterar produto em 18 e 19/10 eram restrições das rodadas de preparação/revisão da infraestrutura. Atualize sua aplicação para a tarefa atual, mantendo histórico e motivos. Preserve regras permanentes de proteção de dados, rastreabilidade e honestidade dos testes. Não reescreva as evidências antigas para fazê-las parecer atuais.

Use o Git oficial como fonte de semântica e como ferramenta real. Recursos existentes adequados devem ser reutilizados; um índice Git nativo é preferível a um formato próprio “quase igual”. Não crie outro sistema de commits, objetos, branches ou sincronização apenas para reproduzir a aparência do Git. O armazenamento adicional existe somente para coordenar o que é específico das Layers. Não há migração de linguagem ou framework prescrita neste prompt.

Não transforme a referência de “GitHub normal” em dependência do GitHub: o comportamento-base é o do Git oficial. A compatibilidade com aplicativos de terceiros não é condição de aceite do núcleo nesta fase. Integrações futuras são opcionais.

## 4. Modelo de uso que a implementação precisa respeitar

São conceitos distintos:

| Conceito | Comportamento aprovado |
|---|---|
| Branch de trabalho | A branch em que o usuário está trabalhando; normalmente tradicional, ou uma Layer aberta deliberadamente no modo próprio. |
| Layer reconhecida | Branch identificada por `layer/<nome>`; existir/reconhecer não implica ativar. |
| Layer ativa | Disponibiliza seus arquivos fisicamente junto da branch de trabalho. Pode haver várias. |
| Destino de edição | Escolha explícita de uma Layer para receber novos arquivos daquele trabalho. No máximo uma por contexto de edição; sem escolha vale o fluxo normal. |
| Layer aberta como branch | Modo deliberado de trabalhar diretamente em seu histórico, permitindo outras Layers como camadas. Não é sinônimo de target de edição. |

Arquivos não atribuídos continuam podendo ser atribuídos explicitamente. Arquivos que já têm origem não mudam de proprietário por edição ou mudança de target. Um caminho não pode ser simultaneamente de duas origens na composição ativa. Isso não proíbe que main e develop tenham versões do mesmo arquivo.

Um commit segue a semântica do Git. O usuário pode preparar tudo o que deseja registrar e fazer um commit só. Selecionar trechos é uma possibilidade opcional, não um novo fluxo obrigatório. A seletividade das Layers é a delimitação da origem correta, sem conteúdo de outra origem entrar acidentalmente.

Desativação não é armazenamento de trabalho para depois: pendências exigem commit, descarte deliberado ou cancelamento. Recuperação técnica de falhas continua necessária, sem reintroduzir o recurso rejeitado de auto-guardar edições na desativação.

## 5. Requisitos funcionais completos — GL-01 a GL-27

Os textos abaixo consolidam as respostas aprovadas. Os exemplos de verificação são critérios derivados para demonstrar o comportamento, não algoritmos obrigatórios nem uma lista fechada de testes. Preserve a identidade dos IDs para ligar requisito, implementação, cenário e evidência.

### M01 · Funcionamento básico

#### GL-01 — O Git tradicional continua sendo o padrão

O Git Layer acrescenta camadas ao Git oficial; não é um Git substituto. Preserve o significado dos comandos nativos e o fluxo normal de quem não escolheu usar Layers. Ter branches Layer no repositório não exige mudar o trabalho habitual. Os comandos específicos do produto direcionam operações às Layers sem redefinir silenciosamente git add, git commit, git switch, git push ou outros comandos existentes.

**Alcance e cuidados:** A meta de compatibilidade é ampla. Restrições antigas do protótipo não são requisitos aprovados. O conflito entre preservação do Git e prevenção da seleção acidental é tratado explicitamente em GL-22; não se autoriza resolvê-lo alterando o Git global.

**Demonstrações mínimas do comportamento:**
- Comparar o fluxo nativo de um repositório de controle com zero Layers e com Layers reconhecidas mas inativas.
- Com Layers ativas, demonstrar que git add . e o commit nativo não incorporam acidentalmente arquivos das camadas à branch de trabalho.
- Distinguir operações nativas executadas diretamente das operações mediadas pela CLI do produto; não declarar proteção da primeira por testar somente a segunda.

#### GL-02 — A branch tradicional continua selecionada

No uso normal, uma branch tradicional — main, develop ou qualquer outra escolhida pelo usuário — continua sendo a branch de trabalho. As Layers a complementam. A exceção aprovada em GL-22 permite uma Layer como branch de trabalho quando aberta deliberadamente; não imponha a antiga proibição absoluta desse estado.

**Demonstrações mínimas do comportamento:**
- Ativar/editar/commitar uma Layer não deve trocar involuntariamente a branch de trabalho.
- Diferenciar branch de trabalho, Layer ativa e destino de edição na consulta do estado.

#### GL-03 — Arquivos novos seguem o fluxo normal por padrão

Sem um destino de edição de Layer escolhido, novos arquivos seguem o fluxo normal de adicionar e fazer commit na branch de trabalho. Apenas criar um arquivo não o commita nem o atribui silenciosamente a uma Layer. Uma Layer ativa, mesmo sendo a única, não captura novos arquivos por isso.

**Demonstrações mínimas do comportamento:**
- Criar arquivos com nenhuma, uma e várias Layers ativas sem target: continuam no fluxo normal.
- Não absorver retroativamente arquivos preexistentes quando o usuário escolhe um destino de edição.

#### GL-04 — Reconhecer Layers pelo nome

Reconheça branches com o padrão layer/<nome> como Layers. Exemplos: layer/scripts, layer/ia e layer/testes. Reconhecer, disponibilizar para escolha e ativar são ações distintas: não ative apenas porque uma branch foi criada, encontrada ou recebida. Uma etapa interna de registro não deve obrigar o usuário a classificar manualmente uma branch cujo prefixo já a identifica.

**Alcance e cuidados:** O nome não prova que a composição é válida. Uma branch criada pelo Git pode conter arquivos também presentes na base; nesse caso reconheça sua identidade, diagnostique a incompatibilidade e preserve os dados. Não elimine esses arquivos para forçar a ativação.

**Demonstrações mínimas do comportamento:**
- Descobrir uma branch com o prefixo criada tanto pelo produto quanto pelo Git oficial, sem ativá-la automaticamente.
- Após receber referências pelo Git, identificar as candidatas corretamente sem sobrescrever arquivos ou descartar conteúdo incompatível.

#### GL-05 — Ter a função “Criar Layer”

Ofereça a função Criar Layer. Na representação aprovada, ela cria uma branch real com o prefixo acordado e permite que a Layer tenha seus próprios arquivos e histórico. O conceito deve permanecer claro, sem depender de uma interface gráfica ou de futura adoção pelo Git oficial.

**Alcance e cuidados:** O Codex decide o mecanismo de criação consistente com esses comportamentos. Não existe obrigação de reproduzir o algoritmo atual nem autorização para copiar silenciosamente todo o projeto para a nova Layer.

**Demonstrações mínimas do comportamento:**
- Criar uma Layer utilizável sem trocar acidentalmente a branch de trabalho e sem misturar arquivos da base em seu conteúdo.
- A criação não ativa implicitamente o conteúdo contra a vontade do usuário; os estados devem ser claros.


### M02 · Ativação, edição e destino dos arquivos

#### GL-06 — Ativar e desativar Layers

Ativar disponibiliza os arquivos da Layer fisicamente no projeto. Desativar retira somente seus arquivos do conjunto de trabalho, preservando seu histórico. A desativação respeita GL-16: alterações pendentes devem ser resolvidas antes, não guardadas automaticamente para reativação.

**Demonstrações mínimas do comportamento:**
- Arquivos ativados podem ser lidos e editados por ferramentas externas comuns, sem o editor de laboratório.
- Desativar uma Layer limpa preserva os arquivos da base e de outras Layers, inclusive em diretórios compartilhados.
- Reativar uma Layer limpa recupera seu conteúdo versionado e não apaga arquivos locais conflitantes.

#### GL-07 — Usar várias Layers ao mesmo tempo

Permita zero, uma ou várias Layers ativas simultaneamente. Elas convivem com a branch de trabalho, preservando a separação de arquivos e históricos e respeitando os conflitos. Ativar uma não desliga outra por conveniência.

**Demonstrações mínimas do comportamento:**
- Com duas Layers distintas, editar e commitar uma não modifica o trabalho preparado ou os arquivos da outra.
- A ordem de ativação não cria uma prioridade de sobrescrita entre origens.

#### GL-08 — Enxergar um único projeto

O projeto em uso é a união física dos arquivos da branch de trabalho e das Layers ativas. Não é preciso alternar de projeto ou de editor para acessá-los. Essa união de arquivos não é fusão de históricos nem um commit conjunto.

**Demonstrações mínimas do comportamento:**
- Ler no filesystem os arquivos de todas as origens ativas e conferir a ausência dos arquivos exclusivos das Layers desligadas.
- A interface de consulta distingue as origens sem alterar a forma de abrir os arquivos em ferramentas comuns.

#### GL-09 — Escolher o destino de edição

Separe ativação de destino de edição. Pode haver várias Layers ativas e, no máximo, uma escolhida como destino dos novos arquivos daquele trabalho. Sem escolha, vale a branch de trabalho. Encerrar o modo de edição volta ao padrão sem desativar automaticamente a Layer. A escolha não transfere arquivos já pertencentes à base ou a outra Layer.

**Alcance e cuidados:** Atribuir destino não significa fazer commit automático. Não confundir roteamento, preparação e gravação no histórico. A delimitação do modo de edição e sua persistência são escolhas de engenharia a justificar sem introduzir captura inesperada.

**Demonstrações mínimas do comportamento:**
- Entrar, trocar e sair do modo de edição por comandos; verificar o destino dos arquivos novos em cada intervalo.
- Manter a origem dos arquivos existentes e não adotar automaticamente os que já estavam sem atribuição antes da escolha.
- Mostrar de forma inequívoca qual destino está valendo; não depender de um editor aberto para funcionar.

#### GL-10 — Preservar a origem de cada arquivo

Cada arquivo atribuído conserva sua origem. Editar um arquivo, ativar outra Layer ou escolher outro destino não transfere a propriedade. Um arquivo já existente no workspace e ainda não atribuído pode ser destinado explicitamente a uma Layer. Na composição ativa, o mesmo caminho não pertence simultaneamente à branch de trabalho e a uma Layer, nem a duas Layers.

**Alcance e cuidados:** Essa exclusividade é da composição das Layers; não proíbe branches tradicionais diferentes de conter versões do mesmo caminho. Não foi aprovada uma função geral de transferir arquivos já versionados entre proprietários, nem uma proibição global de caminhos iguais em todas as branches inativas.

**Demonstrações mínimas do comportamento:**
- Atribuir a uma Layer um arquivo local preexistente e ainda não rastreado, sem exigir recriá-lo.
- Recusar mistura de proprietários sem preparar parte indevida de um lote.
- Conservar a propriedade após desfazer a preparação, quando aplicável ao novo contrato, sem vazamento acidental à base.

#### GL-18 — Não obrigar a manter a captura atual

O requisito é direcionar corretamente os novos arquivos ao destino explícito. O mecanismo antigo de captura não é obrigatório. Substituí-lo, integrá-lo ao modo de edição ou removê-lo é permitido, desde que os comportamentos de GL-03, GL-09 e GL-10 sejam atendidos e não haja atribuição indevida.

**Demonstrações mínimas do comportamento:**
- Criar arquivos por ferramenta externa durante o modo de edição e verificar a atribuição correta.
- Encerrar/cancelar o modo não apaga novos arquivos por surpresa nem mantém uma captura invisível.
- Não exigir que o usuário crie o arquivo por um comando especial ou pelo editor de laboratório.


### M03 · Preparação, commits e histórico

#### GL-11 — Preparar alterações separadamente

Cada origem mantém suas alterações preparadas para commit separadas. Preparar ou retirar da preparação trabalho de uma Layer não altera o trabalho preparado da base nem de outra Layer. Use as possibilidades reais do Git; não modele stage como um simples indicador booleano de arquivo alterado.

**Demonstrações mínimas do comportamento:**
- Preparar A na base e B em uma Layer; operações em B preservam A.
- Preparar uma versão B de um arquivo e depois editar o disco para C: os estados continuam distinguíveis e nenhum deles é silenciosamente substituído.

#### GL-12 — Fazer commits independentes

Os commits das Layers são commits Git reais, independentes dos da branch de trabalho e das outras Layers. Cada commit contém somente o trabalho corretamente selecionado para sua origem. Não há commit conjunto automático nem criação paralela de um histórico proprietário.

**Demonstrações mínimas do comportamento:**
- Inspecionar árvore/conteúdo do commit com Git oficial, não só a resposta da CLI.
- Conferir que o commit de uma Layer não avança a branch de trabalho nem a outra Layer.
- Edição posterior à preparação não entra automaticamente no commit já delimitado pela preparação.

#### GL-13 — Consultar o histórico de cada Layer

Permita consultar o histórico e as diferenças de cada Layer separadamente, usando o histórico real do Git. O conjunto de arquivos visíveis não deve aparecer artificialmente como uma única origem de alterações.

**Demonstrações mínimas do comportamento:**
- Consultar commits e diferenças de duas Layers e da base, conferindo que os resultados correspondem à origem escolhida.
- Manter coerência do histórico ao desligar, reativar, renomear e receber atualizações da Layer.

#### GL-14 — Escolher quais mudanças entram no commit

Resolução final: preservar a semântica nativa de preparação e commit do Git. Preparar todas as alterações desejadas de um arquivo e registrá-las juntas é um fluxo normal; preparar somente determinados trechos também é uma opção nativa. Não tornar essa opção obrigatória, não dividir commits automaticamente e não criar um novo tipo de commit. O filtro de propriedade das Layers limita a origem do conteúdo; não muda o significado de preparação, commit ou histórico. O arquivo inteiro continua pertencendo à mesma origem, mesmo quando só algumas de suas alterações são preparadas.

**Alcance e cuidados:** A condição do usuário foi satisfeita pela documentação oficial de git add -p/--patch e git commit. Não prometer que todo comando commit pega automaticamente tudo que foi salvo; opções nativas têm seus próprios significados. A dúvida do usuário sobre renomear não é uma exigência de perder histórico: mantenha o comportamento nativo do Git.

**Demonstrações mínimas do comportamento:**
- Fluxo simples: preparar todas as mudanças do arquivo e fazer um único commit.
- Fluxo opcional nativo: preparar um trecho, fazer commit e conferir que as demais mudanças permanecem no disco, na mesma origem.
- Preparar B, editar para C e fazer commit: o resultado deve respeitar a semântica da forma de commit utilizada, sem capturar C indevidamente.


### M04 · Trocar a branch e desativar Layers

#### GL-15 — Trocar a branch sem desligar Layers

Trocar a branch de trabalho não deve desligar as Layers por si só. Na troca compatível, elas continuam ativas. Na incompatível, apresente o impedimento sem sobrescrita, perda de trabalho ou desativação silenciosa. O mesmo princípio de manter as outras Layers se aplica ao modo explícito de GL-22.

**Demonstrações mínimas do comportamento:**
- Trocar entre duas branches compatíveis mantendo Layers e suas alterações separadas.
- Trocar para uma branch que ocupa um caminho de Layer: observar e reportar o comportamento real, sem alegar segurança apenas pelo código de saída.
- Verificar separadamente troca pelo Git oficial e eventual fluxo próprio; demonstrar os limites de cada rota.

#### GL-16 — Resolver pendências antes de desativar

Antes de desativar uma Layer com pendências, avisar e exigir que o usuário resolva. Ele pode registrar o trabalho em commit, descartar deliberadamente o que não quer manter ou cancelar a desativação. Não implementar o antigo fluxo de guardar automaticamente edições para reaparecerem na próxima ativação, seja por shelf, stash automático ou outro nome. Avisar não autoriza descartar. Um arquivo salvo no disco pode continuar pendente no Git.

**Alcance e cuidados:** Cópias técnicas para recuperação de falha não são o recurso rejeitado de guardar trabalho para depois. Um stash feito deliberadamente pelo usuário com Git oficial não é proibido por esta regra. O núcleo não pode alegar observar buffers não salvos de todos os editores externos.

**Demonstrações mínimas do comportamento:**
- Desativar com alterações preparadas, não preparadas, remoções e novos arquivos atribuídos: não perder nem guardar silenciosamente o trabalho.
- Cancelar conserva o estado. Descartar exige escolha explícita e alcance claro. Commit parcial não elimina uma pendência que ainda existe.
- Desativar depois de resolver as pendências e reativar: não ressuscitar automaticamente edições descartadas.


### M05 · Conflitos, recuperação e gerenciamento

#### GL-17 — Detectar conflitos sem sobrescrita silenciosa

Detecte incompatibilidades entre arquivos da branch e das Layers e entre as próprias Layers. Não escolha silenciosamente uma origem vencedora, não sobrescreva o conteúdo de outra e não resolva a colisão ativando/desativando algo sem informar. Conflitos de composição não autorizam criar uma função de merge entre Layers.

**Demonstrações mínimas do comportamento:**
- Cobrir colisão de caminho, arquivo/diretório e grafias relevantes à plataforma, inclusive conteúdo idêntico com origens diferentes.
- Conservar arquivos locais preexistentes, inclusive ignorados, e informar quais origens impedem a operação.
- Erro de uma operação deve ser acompanhado de inspeção dos efeitos reais e de recuperação quando necessária.

#### GL-19 — Restaurar e recuperar com clareza

Ofereça restauração clara, confirmação de descarte e diagnóstico/recuperação após falhas. Preserve o que for recuperável e não declare sucesso quando a operação continua bloqueada ou inconsistente. Recuperação não é promessa de recuperar bytes nunca persistidos ou já destruídos sem evidência. A segurança não deve depender de conseguir abrir normalmente todos os metadados.

**Demonstrações mínimas do comportamento:**
- Reproduzir falhas reais de exportação, metadados e locks conhecidas; comprovar a correção ou a substituição do mecanismo com oráculo independente.
- Interromper operações em pontos relevantes, reabrir e recuperar sem sobrescrever trabalho posterior nem duplicar commit.
- Distinguir bloqueio real, operação incompleta e diagnóstico saudável; exportar evidências sem exigir metadados já coerentes quando isso impediria o resgate.

#### GL-20 — Renomear e remover Layers

Permita renomear e remover Layers com familiaridade de branches. Considere o estado ativo, o destino de edição e alterações pendentes. Não apague trabalho nem mude a origem de arquivos silenciosamente. “Reorganizar” não é requisito adicional. Preserve o significado dos comandos nativos e trate alterações externas de nome/remoção de modo consistente com a segurança do produto.

**Alcance e cuidados:** Sair do prefixo layer/ pode mudar a classificação. Não implementar uma conversão silenciosa que o usuário não pediu; registrar o contrato de nome/identidade e demonstrá-lo. Uma nova função de transferência/fusão continua fora do escopo aprovado.

**Demonstrações mínimas do comportamento:**
- Renomear uma Layer preserva histórico e mantém referências de uso coerentes, ou informa bloqueio antes de agir.
- Remover uma Layer não remove arquivos de outras origens nem envia exclusão remota implicitamente.
- Renomeação/remoção pelo Git direto é diagnosticada/reconciliada sem reset destrutivo de dados ou falsa situação saudável.


### M06 · Selecionar uma Layer como branch

#### GL-22 — Abrir deliberadamente a Layer como branch

No uso comum, Layers são ativadas/desativadas e não selecionadas acidentalmente como branch de trabalho. Deve haver uma ação explícita para abrir uma Layer como branch de trabalho. Nesse modo, as outras Layers podem continuar sendo usadas normalmente e só são desativadas quando o usuário escolhe, respeitando conflitos. Depois, a Layer pode voltar ao papel de camada. Diferencie esse modo de simplesmente escolher o destino de edição.

**Alcance e cuidados:** As respostas GL22-OUTRAS e GL22-CONCILIACAO resolvem o comportamento desejado, não autorizam uma solução técnica específica. Existe tensão entre impedir uma seleção aceita pelo Git e não alterar o Git. O prompt principal exige investigação precoce e reporte honesto de eventual incompatibilidade; não transformar prevenção em mero diagnóstico sem declarar requisito parcial.

**Demonstrações mínimas do comportamento:**
- Abrir deliberadamente layer/scripts como branch de trabalho, mantendo layer/ia como camada; verificar histórico, stage e arquivos de ambas.
- A mesma origem não deve ser aplicada duas vezes como base e como projeção adicional; não inventar um conflito consigo mesma.
- Demonstrar prevenção/diagnóstico real de seleção acidental e suas fronteiras: CLI gerenciada, git oficial por caminho absoluto e uso sem a ferramenta.
- Demonstrar a saída desse modo e transições com pendências, sem desligar as demais Layers silenciosamente.


### M07 · Compartilhamento e independência

#### GL-21 — Compartilhar pelo Git normal

Use Git oficial, seus commits, referências e transportes para compartilhar Layers com GitHub, GitLab e outros servidores Git compatíveis. Não crie serviço de hospedagem obrigatório ou outro sistema de histórico. Recursos adicionais devem ser somente os específicos do Git Layer. Compartilhamento de histórico é diferente de ativação e estado de edição local.

**Alcance e cuidados:** A observação do usuário em GL-21 reforça exatamente o reaproveitamento do Git. Testes locais do protocolo não certificam todos os provedores remotos; não fazer push em contas reais para produzir uma demonstração.

**Demonstrações mínimas do comportamento:**
- Em remotos locais descartáveis, enviar, clonar/receber, reconhecer e usar uma Layer sem transportar por engano alterações não commitadas.
- Atualizar seu histórico preservando ou explicitamente resolvendo trabalho local; não reinicializar índice/arquivos para esconder divergências.
- Documentar o alcance real de envio de branches e de opções abrangentes do Git; não prometer que históricos de Layers são privados ou invisíveis ao Git.

#### GL-23 — Funcionar diretamente no terminal

O produto funciona diretamente pelo terminal com Git oficial, sem depender de Electron, Monaco, VS Code ou editor de laboratório em execução. Desenvolver e validar deve ser possível por comandos. Disponibilize build/uso da CLI de forma independente do desktop e declare seus pré-requisitos reais.

**Alcance e cuidados:** Não se impõe linguagem, framework, formato de executável ou política de runtime. A escolha cabe ao Codex. Instaladores públicos, assinatura, atualizador e publicação não viram requisitos implícitos desta tarefa.

**Demonstrações mínimas do comportamento:**
- Executar os fluxos públicos completos e a validação sem abrir GUI.
- Comprovar que o caminho de build/uso do produto não precisa inicializar o laboratório ou preparar a demonstração do usuário.
- Documentar como usar a CLI e quais dependências realmente são necessárias; não apresentar o pacote Electron como única distribuição do núcleo.

#### GL-24 — Tratar integrações de editor como extras

Integrações visuais são complementos futuros e opcionais. VS Code e GeppIO podem receber integração posterior, mas não são dependências do núcleo nem escopo de implementação desta rodada. O editor de laboratório serve aos testes manuais do usuário e só deve ser alterado quando houver tarefa específica.

**Alcance e cuidados:** GeppIO aparece no JSON como contexto posterior de integração opcional e catálogo provisório; não é uma autorização para trabalhar no repositório GeppIO nem adicionar funcionalidades dele.

**Demonstrações mínimas do comportamento:**
- Os comportamentos aprovados são exercitáveis sem integração visual.
- A documentação separa claramente produto, laboratório e integrações futuras; não declarar plugin pronto por criar contratos do Core.

#### GL-25 — Usar “layers” e aproveitar o que o Git oferece

A organização adicional deve usar o nome layers e aproveitar ao máximo estruturas e capacidades do Git. Reutilize formatos nativos quando forem adequados, em vez de inventar versões “parecidas”. Não duplique objetos/histórico só para imitar a aparência de pastas. Crie somente o estado próprio necessário. A localização exata e a estratégia de armazenamento ficam para investigação do Codex.

**Alcance e cuidados:** Agora está autorizada a implementação do novo layout e dos mecanismos de migração, não a migração automática dos projetos reais ou da demonstração do usuário durante os testes. A independência de .git como pasta literal e de arquivos soltos de refs deve ser considerada na investigação.

**Demonstrações mínimas do comportamento:**
- Explicar o que foi reutilizado do Git e o que realmente precisou ser próprio.
- Implementar e testar transição dos dados antigos quando aplicável, em cópias descartáveis; preservar histórico, trabalho e recuperação existentes.
- Não sobrescrever uma organização layers desconhecida nem apagar backups/shelves históricos para adaptar o novo comportamento.


### M08 · Duas ideias adicionais para avaliação

#### GL-26 — Consultar a situação atual

Ofereça uma consulta clara no terminal sobre branch de trabalho, seu papel, Layers reconhecidas/ativas, destino de edição e pendências por origem. O usuário deve entender o estado sem abrir uma interface gráfica.

**Alcance e cuidados:** Era sugestão na mensagem-base e foi aprovada no JSON. Não manter o rótulo histórico de “ainda não aprovado” como estado atual.

**Demonstrações mínimas do comportamento:**
- Consultar estado antes/depois de ativar, editar, commitar, trocar branch e abrir Layer como branch de trabalho.
- Mostrar problemas reais de recuperação/bloqueio em vez de declarar situação saudável apesar deles.

#### GL-27 — Conferir o efeito antes de uma ação

Permita conferir os efeitos e impedimentos antes de ativar, desativar ou remover uma Layer: quais arquivos aparecerão/sairão e que trabalho será afetado. A forma de oferecer a prévia cabe ao Codex. A aprovação não obriga diálogo interativo em toda operação nem impede automação explícita e segura.

**Alcance e cuidados:** Era sugestão na mensagem-base e agora é requisito aprovado; não confundir prévia com autorização irrestrita de descarte.

**Demonstrações mínimas do comportamento:**
- A prévia não aplica a ação nem altera a propriedade dos arquivos.
- A operação efetiva revalida o estado para não executar cegamente uma prévia desatualizada.
- As confirmações de descarte continuam claras e não são respondidas automaticamente pela automação de produção.


## 6. Pontos que exigem investigação, sem inventar aprovação

### 6.1. Preservar Git e prevenir seleção acidental de Layer

Investigue este ponto cedo, antes de construir toda a implementação sobre uma hipótese. GL-01 pede manter o Git oficial e seus comandos; GL-22 pede prevenir seleção acidental de uma branch `layer/...` e permitir uma entrada deliberada.

O prefixo por si só não faz o executável Git tratar a referência como um tipo especial. A prevenção oferecida por um comando próprio, por um hook, por uma interface ou por uma integração não deve ser apresentada como proteção universal de todas as invocações do Git sem demonstração.

Faça provas pequenas em fixtures. Diferencie pelo menos Git nativo por caminho absoluto, comandos próprios, processos externos usando Git, ausência da ferramenta e uso explícito da Layer como branch. Investigue mecanismos suportados, versões e limitações; se considerar hooks ou outros mecanismos, confira quando são chamados e se podem realmente impedir a ação antes dos efeitos. Detectar depois ou tentar reverter não equivale a impedir antes. Não forneça uma “solução” que perca trabalho nesse intervalo.

Não substitua ou faça fork do Git instalado, não mude aliases globais, não intercepte silenciosamente o comando git e não instale controles globais no computador para forçar a prova. Não remova o requisito nem finja que basta ocultar uma opção em uma interface futura. Um mecanismo de produto que precise de configuração explícita por repositório deve ter alcance, instalação, reversão e coexistência investigados e testados em fixtures, sem ser instalado nos projetos reais do usuário durante a tarefa.

Se as exigências literais não puderem coexistir sob as restrições aprovadas, documente o caso mínimo, a fonte oficial, o esperado/observado e alternativas com consequências para o usuário. Mantenha esse requisito **parcial/bloqueado por conflito de requisitos**, em vez de declará-lo concluído com uma redução silenciosa. Continue a implementação independente que for segura; não transforme uma decisão pendente em desculpa para entregar apenas estudo de todo o produto. Não escolha uma alteração material do comportamento do Git em nome do usuário.

O comportamento das outras Layers **já está decidido**: elas podem continuar usadas junto da Layer aberta como branch; não desativá-las automaticamente. Não reabra essa escolha por comodidade de implementação.

### 6.2. Git nativo, colisões e comandos destrutivos

Há diferença entre o funcionamento de uma operação gerenciada e de um comando Git direto. Teste ambos. `git add .` e commit nativo, troca de branch, restore/reset, clean, stash, rebase/merge/cherry-pick/revert, rename/delete de referências, GC e outros fluxos relevantes não devem ser substituídos por mocks da aplicação.

Não redefina comandos destrutivos nativos para significar outra coisa. Também não prometa que arquivos projetados ficam automaticamente protegidos contra tudo. Use a matriz existente para demonstrar quais garantias são efetivas, quando uma operação altera dados e quando a composição exige intervenção. Resultado recusado não é suporte ao fluxo; aviso posterior não é prevenção de perda.

O objetivo é maximizar a convivência real com Git oficial. Não congele restrições antigas a hooks, assinatura, filtros, worktrees ou formatos apenas porque o protótipo as recusava. Investigue e amplie onde necessário para os requisitos aprovados. Não desative silenciosamente recursos configurados pelo usuário para fazer o produto passar. Capacidades não verificadas ou ainda incompatíveis devem constar do relatório, sem alegação de compatibilidade total.

Não transforme o catálogo de comandos em uma obrigação de criar uma CLI paralela para cada comando Git. Reutilize o Git e componha somente as funções específicas das Layers. “Merge de branches normais do Git” não é a mesma funcionalidade que “misturar automaticamente uma Layer na base”; a segunda não foi aprovada como função própria.

### 6.3. Criação, reconhecimento, papel e persistência

Criação de Layer, reconhecimento por nome, recebimento de referências remotas, ativação e abertura deliberada como branch têm efeitos diferentes. Uma branch prefixada com conteúdo conflitante não pode ser ignorada como se não fosse Layer, nem ter seu conteúdo filtrado/destruído para ficar compatível.

O modo de edição não pode apropriar-se retroativamente dos arquivos sem dono nem transferir arquivos versionados. Defina e documente o alcance temporal/contextual do target e como ele é encerrado; não introduza uma captura permanente invisível. Não há obrigação de um watcher específico nem autorização para depender do editor.

Renomear/remover uma Layer pode afetar nomes locais, contexto de trabalho e metadados. Estude a reconciliação com alterações feitas pelo Git oficial. Não use reset de índices ou descarte de arquivos como atalho de recuperação.

Quando o contexto não decidir um detalhe comum de engenharia, escolha uma solução coerente, testável e reversível. Quando a escolha mudar de modo material o que o usuário pode fazer ou implicar perda/transferência de dados, explicite a lacuna; não apresente sua inferência como decisão anterior do usuário.

## 7. Reutilização da base de validação, sem reiniciar o projeto de testes

A base já foi construída e revisada. Procure a versão atual no checkout, especialmente `docs/git-compat/`, `scripts/git-compat/`, `tests/git-compat/` e os relatórios em `artifacts/git-compat/`. Leia os comandos existentes antes de executá-los. Eles são referências úteis, não nomes que você deva recriar se o checkout já evoluiu.

Contexto histórico de 19/10/2026, não aprovação da implementação que você fará agora:

| Evidência histórica | Alcance |
|---|---|
| 347 IDs na matriz, 344 originais preservados e três regressões acrescentadas | Denominador histórico; a matriz pode crescer e expectativas podem evoluir com rastreabilidade. |
| 344 variantes PASS, seis ENV_BLOCKED e 21 NOT_RUN | Inclui 243 caracterizações exclusivamente nativas, 76 variantes de produto/requisitos e 25 controles de infraestrutura. Não são 344 funcionalidades prontas. |
| 41 variantes de produto com suporte verificado; 17 com PRODUCT_GAP | PASS de caracterização pode provar uma lacuna, não seu conserto. |
| 86/86 testes de infraestrutura na verificação final separada | Fonte da infraestrutura posterior à correção offline do sanitizador, não fusão com outra rodada do produto. |
| 81 testes de integração: 78 PASS e três skips | Conjunto declarado; não equivale a npm test completo nem certifica os skips. |
| MODEL-008 ainda pendente | Campanha abrangente de interrupções não estava concluída; ampliar conforme os fluxos novos exigirem. |

As evidências antigas indicaram execução ampla custosa e timeouts quando suítes pesadas eram sobrepostas. Use seleções pertinentes no ciclo curto e coordene verificações amplas sem competição desnecessária. Não prometa executar toda a matriz em segundos nem aumente prazos para ocultar travamento; registre os orçamentos e causas investigadas.

**Atenção às versões arquivadas:** no ZIP `Git-Layers-Infraestrutura-Revisada-v2.zip`, `source/` representa a rodada operacional all; `audit/context/current-infrastructure/` contém a infraestrutura final posterior ao ajuste offline do sanitizador. Consulte os manifests. Não restaure automaticamente esses arquivos antigos sobre o checkout vivo. Se precisar recuperar a base de validação ausente, use as cópias disponíveis com conferência e merge consciente, preservando dados. Não use a ausência dessa base no GitHub antigo como razão para descartar o trabalho local.

Os controles de infraestrutura precisam continuar garantindo: baseline própria de cada rodada; fonte e runner estáveis durante a execução; seleção inválida/vazia tratada corretamente; resultado do supervisor prevalecendo sobre proposta do worker; falhas e timeouts preservados; relatório coerente com os resultados; ZIP portátil e verificado. Não reduza essas garantias para acelerar a implementação.

O novo comportamento pode substituir o esperado antigo. Por exemplo, abrir uma Layer deliberadamente como branch agora deve ser suportado, e auto-guardar ao desativar não deve continuar só porque um teste antigo aprova esse fluxo. Versione expectativas com requisito, motivo e evidência de regressão. Preserve IDs e arquivos históricos; a matriz de trabalho pode mudar explicitamente. Não “corrija” teste reintroduzindo um defeito, nem use um catch-all para aceitar qualquer erro de uma versão nova.

## 8. Defeitos anteriores a reproduzir e corrigir quando aplicáveis

Nesta tarefa, a antiga orientação de “somente registrar, não corrigir o produto” não vale mais. Os defeitos relevantes aos requisitos aprovados devem ser reproduzidos e corrigidos ou eliminados por substituição justificada do mecanismo. Não assuma que continuam presentes se o checkout mudou.

| Área anteriormente observada | Risco e ligação com o novo produto |
|---|---|
| Exportação de recuperação falhando com destino novo | GL-19 exige um resgate realmente utilizável, não apenas uma função listada. |
| Lock abandonado e doctor declarando estado saudável | Diagnóstico e recuperação devem mostrar o bloqueio real e tratar sua saída com segurança, sem apagar lock disputado arbitrariamente. |
| Metadados inválidos impedindo doctor/recover/export | O próprio caminho de resgate não deve depender exclusivamente de uma abertura normal bem-sucedida. |
| Captura que não podia ser cancelada após desativação | O novo modo de edição/captura não pode criar um estado sem saída. Se o mecanismo deixar de existir, testar o fluxo substituto. |
| Projeção grande retirada antes da falha do journal | Falhas de tamanho/IO precisam manter o estado ou recuperação comprovável, sem sumiço silencioso de trabalho. |
| Referências externas alteradas, apagadas ou renomeadas | Reconciliar ou recusar de modo claro, preservando histórico, preparação, arquivos e dados de resgate. |
| Seleção nativa da Layer ainda permitida | Validar GL-22 e suas fronteiras reais, sem confundir recusa do wrapper com bloqueio do executável nativo. |
| Varreduras, subprocessos e journals acumulados | Medir e melhorar gargalos reais sem eliminar proteções. Desempenho não foi aprovado como “toda operação em X ms”. |
| Janelas de concorrência, interrupção e GC | Revalidar o novo desenho, retenção de trabalho e comportamento de recuperação sob falhas reais. |
| Caminhos longos no Windows | Sucesso em fixture curta não certifica caminhos arbitrários; testar e declarar o envelope real, sem mascarar defeito como problema do empacotador. |

Uma arquitetura substituída não precisa manter defeitos ou estados artificiais antigos. Precisa manter o requisito de segurança observável que esses testes protegiam, com mapeamento da regressão para o novo fluxo.

## 9. Migração, instruções e compatibilidade de dados

O nome desejado da organização adicional é `layers`; o legado utiliza `git-layers`. Implemente a estratégia adequada e suas verificações, sem transformar esta preferência em uma prescrição de diretório físico que ignore a topologia do Git.

Diferencie implementação de suporte a migração de execução em dados reais. Crie fixtures/cópias descartáveis que representem versões anteriores; teste índices, reservas, alterações, históricos, estados ativos e de recuperação. Não destrua shelves antigos só porque o novo produto não criará novos shelves na desativação. Preserve ou ofereça tratamento explícito do trabalho legado.

Não migre automaticamente `C:\Dev\GitLayerTest`, repositórios pessoais, perfis, backups ou o próprio repositório de desenvolvimento para testar o novo layout. O usuário receberá um procedimento claro e seus limites. Falha, interrupção, destino ocupado por conteúdo desconhecido e tentativa de reabertura devem ter comportamento definido e comprovado. Não é necessário prometer suporte de programas de terceiros para cumprir a obrigação de não sobrescrever arquivos desconhecidos.

Atualize ajuda pública, README, arquitetura, segurança, limitações e AGENTS para refletir os contratos novos, sem deixar instruções atuais afirmando que sempre é proibido usar Layer como branch, que captura antiga é obrigatória ou que deve haver auto-park. Conserve a documentação histórica identificada como tal. Decisões técnicas escolhidas pelo Codex devem ficar separadas das decisões funcionais do usuário.

## 10. Desenvolvimento e validação de ponta a ponta

### 10.1. Plano executável, seguido de implementação

Após a leitura e a baseline, faça um plano local por dependências e mapeie GL-01 a GL-27 para código atual, lacunas, testes e evidências. Use-o para executar, não como entrega substituta. Investigue cedo as fronteiras críticas de GL-01/GL-22 e a convivência com Git direto. Resolva detalhes técnicos comuns de forma autônoma.

Implemente incrementalmente. Para cada incremento, inclua documentação/contrato pertinente e teste que observe o efeito com Git oficial e filesystem independentes do adaptador do produto. Preserve o ambiente do usuário e os dados anteriores. Não gere código de domínio “fake” apenas dentro do teste para fazê-lo passar.

### 10.2. Fluxos finais que precisam ser demonstrados

Os fluxos abaixo sintetizam requisitos já aprovados; não substituem nem limitam a matriz:

1. **Uso padrão:** repositório sem Layers e com Layers reconhecidas/inativas; arquivos novos e Git habitual sem mudança silenciosa.
2. **Composição:** branch de trabalho com duas Layers ativas, arquivos físicos, consulta clara e históricos separados.
3. **Destino explícito:** escolher/sair/trocar target; arquivos novos corretamente destinados; arquivos preexistentes e outras origens preservados.
4. **Arquivo local anterior:** atribuir explicitamente a uma Layer um arquivo que já estava no workspace e ainda não tinha origem.
5. **Git direto:** `git add .`, outras formas pertinentes de add e commit nativo com Layers ativas; inspecionar índice e commit da base e das Layers.
6. **Commit da Layer:** origem correta, stage independente, preparação integral ou seletiva nativa; edição posterior no disco preservada.
7. **Troca compatível e incompatível:** preservar Layers quando possível e impedir/diagnosticar corretamente colisões sem desligamento oculto; separar rotas nativas e gerenciadas.
8. **Desativação com pendências:** aviso, cancelamento, commit e descarte explícito; nenhuma reativação automática do trabalho descartado e nenhum auto-park novo.
9. **Branch de uma Layer:** entrada deliberada, outras Layers em uso, ausência de projeção duplicada da mesma origem e retorno coerente ao outro modo.
10. **Ciclo de vida:** criar, reconhecer, renomear e remover, incluindo mudanças observadas fora da ferramenta; preservar dados e separar efeitos remotos.
11. **Compartilhamento:** remoto Git descartável, envio/recebimento e outro clone; reconhecer Layer sem ativação automática ou histórico alternativo.
12. **Falha e recuperação:** lock, metadado inválido, interrupção real, erro de IO/volume e mudança posterior; estado e bytes depois da falha contam tanto quanto exit code.
13. **Organização nova:** criação e migração em fixtures, legado preservado, reinício e destino desconhecido tratados sem perda.
14. **Autonomia de uso:** build/CLI independente do editor, consultas e prévias utilizáveis pelo terminal.

Quando o Git oficial tiver múltiplas formas legítimas de uma operação, teste os caminhos relevantes sem reduzir tudo ao wrapper. Não normalize diferenças semânticas como se fossem somente texto. Uma mudança nos bytes físicos do índice pode refletir cache; confira também conteúdo semântico adequado ao contrato. Conferir apenas a saída “ok” do Core não é oráculo suficiente.

### 10.3. Controles, ambiente e evidência

Utilize fixtures pequenas, isoladas, com raízes e processos comprovadamente próprios. Não altere configuração global pessoal, PATH permanente, política do PowerShell ou Git instalado. Isole HOME/configs/identidade/credenciais por processo quando necessário; valide o isolamento efetivo das chamadas internas, sem assumir que o Core herdou variáveis que ele descarta. Não encerre processos por nome de maneira ampla.

Para testes de suporte a hooks, filtros, assinatura e transportes, use configurações e helpers sintéticos seguros. Para GC/corrupção, não compartilhe objetos mutáveis com repositórios reais. Não exponha um servidor fora do loopback sem autorização adicional. Testes com rede externa ou contas reais não são necessários para começar a demonstrar transporte Git.

Use as capacidades realmente disponíveis. Windows local é o ambiente principal documentado; outros sistemas/versões só recebem certificação após execução correspondente. Não obrigue instalação de WSL/GUI para executar o Core. Registre Git/Node/OS, executável Git utilizado, versão, flags, arquivos de entrada e limitações; não force a instalação da versão do catálogo apenas para igualar um número.

Execute testes da infraestrutura quando mexer nela; seleções rápidas e afetadas após incrementos; verificações amplas apropriadas ao terminar, com fontes congeladas. Se mudar código depois, a nova versão precisa dos testes pertinentes e de proveniência separada. Não somar PASS de snapshots distintos como uma rodada completa. Repita a integração preexistente relevante ou explique concretamente o que não foi executado e por quê.

Estenda os cenários necessários à nova autorização — em especial destino de edição, ausência de auto-guardar, modo Layer como branch com outras Layers e migração. Amplie MODEL-008 segundo as operações alteradas; não declare cobertura exaustiva por ter alguns failpoints. Morte real, exceção tratada, queda de energia e concorrência externa não são a mesma prova.

Mantenha dimensões separadas: cenário especificado, teste implementado, seleção, execução, suporte do produto e defeito conhecido. `ENV_BLOCKED` exige capacidade realmente ausente. `NOT_RUN` não é PASS. Recusa testada não é suporte ao recurso recusado. Um teste que confirma um defeito conhecido não demonstra que a implementação desta tarefa corrigiu esse requisito.

## 11. Critérios de conclusão e entrega para revisão

A missão só pode ser apresentada como completamente concluída se os comportamentos aprovados estiverem implementados e sustentados por evidências no escopo declarado. A validação de GL-24 é a independência e o adiamento explícito dos plugins, não a implementação de plugins nesta rodada. Não prometa “100% de todos os cenários possíveis do Git”.

Se houver bloqueio genuíno, entregue o restante que for seguro, sem alegar conclusão total. Indique exatamente o requisito afetado, a reprodução, o estado do código, a decisão faltante e a consequência. Não encerre somente com “o Git não suporta”: demonstre a fronteira e as alternativas. Por outro lado, não modifique o Git oficial ou enfraqueça silenciosamente GL-01 para fingir que completou GL-22.

Entregue código local, testes e documentação atualizados, e **um relatório técnico completo com ZIP de evidências autossuficiente**. Crie um diretório novo e identificável sob `artifacts/` — pode aproveitar a infraestrutura existente. Não sobrescreva entregas históricas nem reutilize sucesso antigo. O caminho exato escolhido deve estar na resposta final.

O relatório em Markdown deve incluir, no mínimo:

1. **Resumo executivo:** o que foi implementado, o que foi substituído, o que continua parcial/bloqueado e o que não pertence a esta rodada.
2. **Baseline e autoria:** estado inicial, trabalho prévio do usuário preservado, arquivos atribuíveis à tarefa, alterações em AGENTS e motivo da mudança de fase.
3. **Matriz dos 27 requisitos:** ID, comportamento final, localização da implementação, cenários/variantes, evidência, status de suporte e limitações. Um PASS nativo sem produto não conclui a linha.
4. **GL-14:** comprovação de semântica nativa, fluxo integral, seleção opcional e independência de proprietários, sem divisão automática de commits.
5. **GL-22 em detalhe:** prevenção pretendida, entrada deliberada, convivência das outras Layers, rotas efetivamente cobertas e bypass/limites reproduzidos. Não deixar o ponto escondido numa frase genérica de segurança.
6. **Arquitetura escolhida:** alternativas relevantes, recursos Git reutilizados, estado exclusivo do produto, decisões do Codex e trade-offs. Distinguir isso das decisões funcionais do usuário.
7. **Uso real:** comandos de build/instalação/uso da CLI, pré-requisitos e exemplos de todos os fluxos principais. Não depender do editor para a demonstração.
8. **Dados e migração:** legado, novos formatos/versões se houver, prova de preservação, recuperação, procedimento para usuário e operações que não foram aplicadas em dados reais.
9. **Defeitos:** cada hipótese anterior reproduzida/refutada/não observada, causa encontrada, correção e contraprova; problemas novos permanecem registrados.
10. **Testes e ambiente:** comandos exatos, cwd sintético/real apropriado, versões, início/fim, exit/sinal/timeout, limites e fingerprints; contagens calculadas, sem denominações ambíguas.
11. **Esperado versus observado:** conteúdo/refs/índice/arquivos antes e depois de cada fluxo material, inclusive falhas e cancelamentos; links para evidências reais.
12. **Desempenho:** medições sob condições declaradas, regressões investigadas, subprocessos/varreduras pertinentes e limites sem promessas inventadas.
13. **Segurança e preservação:** que dados foram tocados, isolamento, cleanup e processos próprios, nenhum reset do trabalho do usuário, nenhum push/publicação real ou GUI iniciada.
14. **Histórico de tentativas:** falhas e retestes separados; fontes diferentes não somadas como uma aprovação conjunta.
15. **Pendências e decisões:** capacidades ausentes, recursos parciais, itens que precisam de escolha de produto e próximo trabalho concreto, sem esconder isso no denominador.
16. **Índice da entrega:** caminhos de fontes/patches/documentos, matrizes JSON, resultados, manifests, hashes e reprodução. Permitir revisão sem esta conversa e sem acesso ao checkout do usuário.

O ZIP deve conter o relatório, decisões efetivas, fontes ou patches suficientes para revisar a implementação, scripts/testes pertinentes, resultados estruturados, evidências e manifesto de hashes/tamanhos. Não incluir credenciais, dados pessoais desnecessários, node_modules, caches, binários do editor ou repositórios reais como fixtures. Mantenha nomes internos portáveis. Reabra o arquivo com leitor convencional e confronte hashes, caminhos, links e contagens; a prova final do ZIP fechado deve referenciar o seu hash externo, evitando autorreferência. Use os mecanismos já revisados, sem inventar uma nova cadeia de relatórios por conveniência.

Na resposta final, em português, forneça os caminhos reais do relatório, do ZIP e da validação final. Resuma mudanças, resultados e limites de forma direta. Confirme explicitamente o que foi ou não alterado/publicado, de acordo com o que realmente ocorreu. O usuário enviará esses arquivos ao ChatGPT para revisão antes de seguir.

## 12. Limites do que foi aprovado

Não acrescente como requisitos desta rodada: transferência geral de arquivos versionados entre proprietários; prioridade de sobrescrita entre Layers; merge automático de Layer na base; commit conjunto automático; auto-park na desativação; serviço de nuvem próprio; integração visual obrigatória; modificação do Git instalado; nova semântica de commit; promessa de recuperar dados nunca salvos.

Esses limites não são veto a investigar soluções futuras quando o usuário pedir. São proteção contra ampliar a tarefa atual ou trocar o comportamento aprovado por outro mais fácil.

**Execute a implementação e sua validação. A preparação anterior serve de ferramenta para esse trabalho; ela não é motivo para repetir indefinidamente uma etapa de documentação.**

## Fontes e terminologia

[D1] Respostas do formulário: `03-RESPOSTAS-ORIGINAIS.json`, IDs GL-01 a GL-27, respostas complementares GL22-OUTRAS e GL22-CONCILIACAO.  
[D2] Mensagem posterior: `04-AUTORIZACAO-ATUAL-E-ITEM-14.txt`.  
[D3] Estado remoto consultado: https://github.com/rabrunos/GitLayer/tree/37887aad107bd751a3687bc660a6644ef5d90c54 — não é imposição sobre o checkout local.  
[D4] Infraestrutura fornecida em `Git-Layers-Infraestrutura-Revisada-v2.zip`, relatório de 19/10/2026; não reexecutada nesta consolidação.

Verificação externa pontual em 02/11/2026, distinta das decisões do usuário:  
[G1] https://git-scm.com/docs/git-add — preparação integral e `-p`/`--patch`.  
[G2] https://git-scm.com/docs/git-commit — semântica normal de commit e opções.  
[G3] https://git-scm.com/docs/git-switch — seleção de branch pelo Git.  
[G4] https://git-scm.com/docs/gitrepository-layout — organização e topologias do repositório.  
[G5] https://git-scm.com/docs/githooks — pontos e limites de integração; não equivale a autorização de instalar controles globais.  
[G6] https://git-scm.com/docs/git-branch — operações nativas de branches.

Consulte fontes oficiais correspondentes à versão efetivamente usada ao investigar detalhes. O pacote não contém uma nova alegação de leitura integral de todos os comandos do Git nem prova de implementação do produto.
