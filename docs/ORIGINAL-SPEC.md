# Git Layers Lab — Prompt de arquitetura e implementação

> Especificação original preservada como histórico. O fluxo atual de desenvolvimento está em [DEVELOPMENT.md](DEVELOPMENT.md), os contratos em [AGENTS.md](../AGENTS.md) e o alcance implementado/testado em [TEST-REPORT.md](TEST-REPORT.md). Este documento não comprova que todos os itens abaixo estejam implementados.

## Instrução de execução

Implemente um aplicativo desktop experimental chamado **Git Layers Lab**, acompanhado de uma ferramenta de terminal chamada **git-layer**, executável como `git layer`. Entregue o projeto em um arquivo **git-layers-lab.zip**.

Não responda apenas com planejamento, trechos de código, uma demonstração visual ou um mockup. Produza arquivos reais, código funcional, testes automatizados, documentação e o ZIP. Use somente o ambiente de execução e diretórios de trabalho desta tarefa. Não crie repositórios remotos, Issues, Pull Requests ou publicações. Não acesse nem modifique projetos reais do usuário para testes. Repositórios Git locais descartáveis, criados dentro do ambiente desta tarefa, estão autorizados.

Este documento contém o contexto completo. Não depende de conversas anteriores. Resolva detalhes secundários de implementação com decisões conservadoras e documentadas. Não elimine requisitos de integridade para simplificar a implementação. Caso alguma parte não possa ser concluída ou executada no ambiente disponível, entregue os arquivos efetivamente produzidos e informe precisamente a limitação, sem declarar funcionalidades ou testes inexistentes.

## 1. Objetivo e limites do produto

Validar se é útil e tecnicamente consistente compor uma branch Git tradicional com conjuntos complementares de arquivos, chamados **Layers**, em um único diretório de trabalho.

O aplicativo tem três partes, com um único mecanismo de versionamento:

- **Core:** biblioteca de domínio e coordenação do Git Layers, independente da interface.
- **CLI:** comando externo `git-layer`, que usa o Core.
- **Desktop:** editor simples e cliente Git local, que também usa o Core.

O editor é uma interface de uso e inspeção do mesmo mecanismo da CLI. Não implemente um Git Layers diferente para cada interface.

Use o Git instalado no sistema. Não faça fork do Git, não substitua seu executável, não intercepte globalmente comandos existentes e não implemente o formato de objetos ou índices Git manualmente.

Não implemente push, pull, fetch, autenticação, GitHub, contas, telemetria, atualizações automáticas ou qualquer integração remota. O aplicativo final deve operar sem rede. A instalação das dependências e a consulta de documentação durante o desenvolvimento podem exigir rede; explique essa diferença no README.

A v0.1 é um laboratório funcional para repositórios de teste, não uma promessa de compatibilidade universal nem de proteção contra programas externos arbitrários.

## 2. Semântica central — não alterar

Existe exatamente uma branch tradicional ativa por workspace gerenciado. O `HEAD` real continua apontando para essa branch. Zero, uma ou várias Layers podem estar ativas ao mesmo tempo.

Exemplo:

```text
Branch main                    Layer layer/ai            Layer layer/scripts
README.md                      AGENTS.md                 scripts/debug.py
src/app.ts                     .codex/config.toml        tools/analyze.py
package.json
```

Todos os arquivos aparecem como arquivos reais no mesmo diretório. Não use links simbólicos, hardlinks ou uma montagem virtual como mecanismo de composição.

As Layers são branches Git convencionais em `refs/heads/layer/<nome>`. Cada Layer criada pela ferramenta começa com um histórico independente, sem pai na branch tradicional, e suas árvores contêm somente os arquivos próprios da Layer. É aceitável criar um commit raiz de árvore vazia para inicializá-la, identificando essa operação na interface.

Não use uma branch sintética de composição. Não faça checkout temporário de uma Layer, nem mesmo escondido da interface, para realizar commits.

O prefixo `layer/` é uma convenção da aplicação, não um novo tipo nativo de referência Git. Encontrar esse prefixo em um repositório existente não autoriza automaticamente a ativação: descubra as candidatas, valide e peça registro/ativação explícitos.

Arquivos versionados têm um único proprietário no conjunto ativo. Editá-los não muda o proprietário. Diretórios podem conter arquivos de proprietários distintos.

Arquivos novos, ainda não atribuídos a uma Layer, permanecem não rastreados e seguem o fluxo normal da branch tradicional quando preparados para commit. Criar um arquivo no disco não cria um commit nem o atribui automaticamente a uma Layer.

`git add .`, `git commit` e demais comandos tradicionais NÃO são transformados em operações conjuntas. Cuidam da branch tradicional. As Layers têm comandos próprios e painéis próprios para staging e commit.

Não implemente merge de Layer para branch tradicional, merge entre Layers, transferência entre proprietários ou commit conjunto nesta versão. Recuse essas ações claramente. Renomear dentro do mesmo proprietário é permitido.

## 3. Stack e organização do código

Use **TypeScript em modo strict**, **Electron**, **React** e **Monaco Editor**. Use Node.js para o Core e a CLI. Use um bundler compatível com Electron, React e os workers locais do Monaco. Prefira uma estrutura de projeto simples, com um package.json raiz, a um monorepo complexo.

Use versões estáveis, mantidas e mutuamente compatíveis, verificadas na implementação. Fixe a resolução com um lockfile gerado de verdade pelo gerenciador de pacotes. Não invente versões nem escreva um lockfile fictício. Documente as versões de Node, Git, Electron e dependências efetivamente utilizadas/testadas.

Use o Git CLI como fonte de verdade, por processos filhos com argumentos separados. Uma biblioteca auxiliar de processos é permitida, mas não use uma reimplementação JavaScript do Git como substituto do Git real.

Estrutura sugerida:

```text
git-layers-lab/
  src/
    core/
      git/
      ownership/
      layers/
      projection/
      transactions/
      capture/
      diagnostics/
    cli/
    desktop/
      main/
      preload/
      renderer/
  tests/
    unit/
    integration/
    e2e/
  scripts/
  docs/
  package.json
  package-lock.json
  README.md
```

O renderer não acessa o sistema de arquivos nem executa Git diretamente. A comunicação passa por uma API restrita no preload. O processo principal chama os serviços do Core. A CLI importa os mesmos serviços.

Use validação de entrada e saída nos limites da CLI, IPC e metadados. Centralize erros estruturados, códigos de saída, caminhos e execução do Git.

## 4. Modelo de dados e fonte de verdade

Descubra o repositório, seu diretório Git e caminhos internos usando comandos oficiais, como `git rev-parse`; não suponha que concatenar `<workspace>/.git` funciona em todo ambiente.

Na v0.1, suporte apenas repositórios não bare, com um único worktree normal, `HEAD` simbólico numa branch tradicional e pelo menos um commit antes de habilitar Layers. O editor pode abrir/inicializar um repositório vazio e permitir seu primeiro commit. Só então habilite Layers.

Detecte linked worktrees, múltiplos worktrees, sparse checkout, submódulos, repositórios incompletos/partial clone, objetos ausentes e estados de merge/rebase externos. Recuse o modo Layers nesses casos, com diagnóstico específico; não tente convertê-los silenciosamente. Restrições mais conservadoras sobre funcionalidades não testadas devem aparecer na documentação e na UI.

Estrutura lógica dos metadados locais, resolvida pelo Git:

```text
<git-dir>/git-layers/
  registry.json
  workspace.json
  indexes/<layer-id>.index
  reservations/<layer-id>.json
  captures/<session-id>.json
  shelves/<layer-id>/<snapshot-id>/
  transactions/<operation-id>/
  locks/
```

Use identificadores internos estáveis e seguros, não nomes de branches como caminhos de armazenamento. Todo arquivo de metadados deve ter versão de esquema. Versão desconhecida ou conteúdo inválido exige interrupção segura, nunca reinicialização destrutiva.

Fontes de verdade:

1. A referência e a árvore do commit da Layer definem seu histórico versionado.
2. Seu índice alternativo define o staging.
3. Reservas locais explícitas mantêm a propriedade de novos arquivos ainda não commitados, inclusive depois de unstage.
4. A projeção no disco contém alterações de trabalho, que podem diferir do índice.
5. Shelves preservam separadamente o índice, as reservas e os bytes locais quando uma Layer é desativada com alterações.

Não confunda um mapa de proprietários reconstruível com o histórico real. A propriedade ativa deve considerar a árvore versionada, o índice e as reservas. Um caminho com exclusão preparada não fica livre para outra origem antes de finalizar essa alteração de maneira coerente.

A propriedade da branch tradicional deve considerar tanto `HEAD` quanto seu índice, inclusive arquivos recém-adicionados e exclusões preparadas. Não roube um arquivo da base só porque ele ainda não está em um commit.

Registre o OID da Layer sobre o qual cada índice foi preparado. Se uma referência mudar externamente, não reinicialize um índice sujo nem faça commit sobre uma base desconhecida. Suspenda a mutação e ofereça diagnóstico/recuperação.

Não presuma comprimento fixo de SHA. Use as APIs de referências do Git, sem escrever arquivos em `refs/` ou depender do backend de armazenamento de refs.

## 5. Proteção do staging contra garbage collection

Índices alternativos guardados em diretórios privados não devem ser tratados como garantia suficiente de retenção dos objetos Git que referenciam.

Mantenha checkpoints alcançáveis para o conteúdo preparado das Layers e para operações recuperáveis, por exemplo sob `refs/git-layers/state/<layer-id>` e `refs/git-layers/transactions/<operation-id>`.

Uma implementação possível é apontar a referência privada para a árvore gerada a partir do índice. Outra é usar um commit interno de snapshot. Escolha uma representação válida, teste-a com Git real e documente-a. Esses checkpoints NÃO avançam `refs/heads/layer/<nome>` e NÃO aparecem no histórico normal de commits do usuário no aplicativo.

Se usar commits internos, diferencie-os dos commits solicitados pelo usuário e não exija uma identidade pessoal apenas para um stage que normalmente não a exigiria. Não publique nem exponha essas referências como Layers.

Preserve checkpoints antigos enquanto uma transação não estiver concluída. Não confie apenas em reflogs ou no prazo padrão de expiração. Não desative permanentemente o garbage collector como solução.

Inclua teste de stage, expiração/prune em repositório descartável e recuperação dos objetos preparados. Não execute manutenção concorrente agressiva em repositórios reais.

## 6. Exclusões locais e compatibilidade com Git tradicional

Gerencie somente um bloco claramente delimitado no arquivo local `info/exclude`, localizado pelo Git. Preserve as regras preexistentes fora desse bloco. Não modifique `.gitignore`, configuração global, aliases ou hooks do usuário para implantar Layers.

Exclua caminhos exatos reservados pelas Layers ativas. Não ignore uma pasta inteira apenas porque contém arquivos de uma Layer: a base pode possuir outros arquivos dentro dela.

Trate caracteres especiais de padrões corretamente. Nomes que não possam ser representados com segurança devem ser recusados antes de qualquer mutação. Nunca gere uma regra ampla por erro de escape.

IMPORTANTE: regras de `.gitignore` podem ter prioridade sobre `info/exclude`, e ignore não afeta arquivos já rastreados. Depois de planejar/aplicar exclusões, valide a exclusão efetiva de todos os caminhos protegidos com `git check-ignore` e testes do comportamento real de staging. Considere padrões de negação; não interprete qualquer linha de saída como prova de que o arquivo está ignorado.

Se a proteção não for efetiva, aborte a ativação/atribuição e explique a regra conflitante, preservando o estado anterior. Mudanças posteriores nos arquivos de ignore devem marcar a composição como insegura antes da próxima operação gerenciada.

Dentro do aplicativo, staging na base filtra proprietários explicitamente e rejeita arquivos de Layers com mensagem como: “Este arquivo pertence à Layer scripts. Prepare-o no painel dessa Layer.” Não dependa exclusivamente de ignore para a segurança dos comandos próprios.

No Git convencional externo, uma tentativa de adicionar um arquivo ignorado apresenta a mensagem normal do Git, não uma mensagem personalizada nossa. Não prometa interceptação de `git add -f`, `git clean -fdx`, `reset --hard`, checkout ou ferramentas externas.

## 7. Staging e commits reais das Layers

Cada Layer tem um índice alternativo dedicado, selecionado por `GIT_INDEX_FILE` apenas no processo filho correspondente. Nunca altere globalmente essa variável nem a deixe vazar para comandos da base.

Inicialize índices com comandos Git válidos; um arquivo vazio de zero bytes não é um índice inicializado. Preserve índices existentes entre chamadas.

`git layer add <layer> -- <caminhos...>`:

- Exige Layer ativa e registrada.
- Expande diretórios para uma lista explícita de arquivos elegíveis.
- Valida toda a lista antes de aplicar o lote.
- Recusa caminhos pertencentes à base ou a outra Layer ativa.
- Para arquivos novos, cria uma reserva de propriedade e prepara seu conteúdo.
- Para arquivos já pertencentes à Layer, atualiza o staging, inclusive exclusões.
- Se houver mistura de proprietários num diretório, mostre o problema e não faça uma atribuição parcial silenciosa.

Não execute `git add -A .` no índice de uma Layer: isso poderia capturar arquivos da base. Use caminhos autorizados, literais, com delimitação segura. A superação da regra de ignore, quando necessária para stage da Layer, deve ficar limitada a esses caminhos.

Ofereça stage/unstage por arquivo e staging parcial por hunk para arquivos de texto comuns. O patch deve ser validado contra o estado exato do índice, com proteção contra versões obsoletas. Binários, mudanças de modo e situações não suportadas podem exigir stage do arquivo inteiro, com indicação explícita. Um erro no patch não pode virar stage de tudo.

Para status e diff, use o commit da própria Layer como base da comparação staged, e índice versus disco para unstaged. Trocar apenas `GIT_INDEX_FILE` e executar `git status` indiscriminadamente é insuficiente, pois o `HEAD` real é o da branch tradicional.

Não reporte todos os arquivos da base como untracked de cada Layer. Arquivos sem proprietário ficam no grupo global de não rastreados.

Para commit de Layer:

1. Adquira o lock do coordenador e valide referências, índice, caminhos e composição.
2. Crie uma árvore a partir do índice da Layer, por `git write-tree` ou mecanismo Git equivalente.
3. Valide que a árvore contém somente caminhos dessa Layer e respeita a composição atual.
4. Crie o commit com `git commit-tree`, usando o último commit da Layer como pai.
5. Atualize apenas a referência da Layer com `git update-ref`, fornecendo o OID anterior esperado, para evitar sobrescrever atualizações concorrentes.
6. Registre a conclusão ou a necessidade de recuperação.

Não use simplesmente `git commit` com um índice alternativo, pois isso não redireciona a atualização de `HEAD` para a Layer. Não use `reset --hard` para atualizar o índice após o commit.

O commit deve registrar exatamente o staged. Alterações feitas no disco depois do stage permanecem unstaged. Mensagem vazia, falta de identidade, referência modificada externamente ou falha do Git não podem resultar em uma falsa mensagem de sucesso.

Implemente log, show, status, diff, stage, unstage, commit e restauração de arquivos da Layer. “Restaurar o arquivo a partir do índice” e “desfazer o staging” são ações diferentes. Antes de descartar bytes locais, crie uma cópia de recuperação e peça confirmação.

Hooks convencionais de commit e assinatura não são automaticamente equivalentes em uma implementação baseada em plumbing. Nesta versão, não anuncie suporte a hooks ou assinatura de commits de Layer. Detecte configurações que exigem recursos não suportados e recuse a operação, em vez de ignorá-las silenciosamente. Use repositórios de demonstração sem hooks/filtros externos/assinatura obrigatória.

## 8. Caminhos, colisões e projeção física

Uma composição é inválida quando houver caminho igual entre origens ativas, mesmo se o conteúdo dos arquivos for idêntico.

Valide também arquivo versus diretório, prefixos de caminhos, diferenças de caixa, equivalência Unicode relevante, nomes reservados do Windows, pontos/espaços finais problemáticos, caminhos absolutos, travessia com `..`, componentes `.git` e aliases perigosos do sistema de arquivos.

Use comparação por componentes, não apenas `startsWith`. Normalize a forma interna sem renomear silenciosamente caminhos reais. A política portátil pode ser conservadora e recusar nomes que funcionariam somente em determinado sistema; mostre o motivo.

Na v0.1, Layers contêm apenas arquivos regulares, com preservação do modo executável quando suportado. Recuse symlinks, junctions, reparse points, gitlinks/submódulos e caminhos que atravessam esses elementos. Não siga links durante cópia, remoção, exploração recursiva ou captura.

Também proteja arquivos não rastreados e ignorados que já existam no disco. Ativar uma Layer nunca sobrescreve um arquivo preexistente não gerenciado, nem o “adota” automaticamente porque os bytes coincidem.

Não use cópia indiscriminada da árvore toda para o workspace. Prepare os arquivos em área privada, valide os destinos, publique somente caminhos aprovados e mantenha um journal de progresso. Compare novamente hashes/modos antes de substituir ou remover arquivos.

Ao remover arquivos de uma Layer, não remova recursivamente diretórios compartilhados. Remova apenas os caminhos próprios, e remova diretórios apenas se estiverem vazios.

Respeite transformações nativas de texto/final de linha e atributos suportados de forma consistente em stage, diff e materialização. Não imponha silenciosamente LF nem corrompa binários. Bloqueie filtros externos, LFS, `working-tree-encoding` ou outras transformações não implementadas, informando a limitação. Teste LF, CRLF, UTF-8 e arquivos binários.

Para reduzir interferência nesta versão, não permita que Layers possuam arquivos `.gitignore`, `.gitattributes` ou `.gitmodules`; esses controles ficam na base. Isso é uma restrição da v0.1, não uma alteração do conceito geral de Layers.

## 9. Ativação, desativação e preservação de trabalho

Estados públicos mínimos: `inactive`, `active`, `parked` e `recovery-required`. Estados transitórios não podem ser apresentados como sucesso concluído.

Ativar valida toda a composição e materializa somente os arquivos da Layer. Se houver uma shelf pendente, restaura separadamente disco, índice e reservas, sem confundir unstaged com staged.

Desativar uma Layer não é excluir a branch nem fazer commit. Com uma Layer limpa, remova somente sua projeção validada. Com alterações, ofereça:

- “Guardar alterações localmente e desativar”.
- “Cancelar”.

Guardar deve preservar conteúdo staged, conteúdo unstaged, arquivos novos reservados, modos e marcadores de arquivos ausentes. Não use o stash da base para isso. Ao reativar, restaure a mesma distinção entre os estados.

Uma aba não salva no editor é um estado diferente do arquivo no disco. Antes de desativar, trocar branch, restaurar ou excluir um arquivo aberto, ofereça salvar ou cancelar. Não salve silenciosamente uma aba antiga por cima de um arquivo que foi rematerializado. Mantenha um rascunho local de recuperação dos buffers não salvos no armazenamento privado do aplicativo e avise sobre seu conteúdo sensível.

Se a restauração de uma Layer guardada colidir com a branch atual, mantenha a shelf intacta e não sobrescreva o destino.

Uma Layer inativa não bloqueia permanentemente os caminhos do workspace: outra composição pode possuí-los. O conflito é reavaliado quando ela voltar a ser ativada.

## 10. Troca segura da branch tradicional

Ofereça troca de branch dentro do aplicativo e por `git layer switch <branch-tradicional>` como operação gerenciada. Esse comando troca a branch tradicional; não seleciona uma Layer para edição.

Na v0.1, exija que a branch tradicional não tenha alterações tracked staged/unstaged nem buffers não salvos para essa troca. Apresente opções de commit ou stash apropriadas, sem executá-las automaticamente. Arquivos não rastreados podem permanecer, mas colisões devem bloquear a troca.

Layers podem ter alterações, desde que seu estado completo seja preservado. Antes de tocar nos arquivos:

- Obtenha a árvore/OID da branch de destino e valide-a contra todos os caminhos reservados pelas Layers ativas.
- Verifique arquivos locais não gerenciados, inclusive ignorados, e alterações nas regras de ignore/atributos.
- Em caso de conflito, aborte sem mudar `HEAD`, índices ou conteúdo. Identifique o caminho e os dois proprietários.

A implementação pode guardar temporariamente a projeção das Layers, trocar a base pelo Git e restaurá-las, usando journal. Não exponha isso como uma desativação definitiva. Documente que múltiplas escritas no sistema de arquivos não são atomicamente invisíveis a outros programas.

Use a variante de checkout/switch e as opções de segurança realmente suportadas pela versão de Git detectada; não invente flags. Nunca use força para “resolver” a colisão.

Se uma etapa falhar, tente restaurar apenas o estado cujo proprietário e versão possam ser comprovados. Se houver edição externa ou dúvida, preserve os backups, marque `recovery-required` e informe quais passos ocorreram. Não sobrescreva trabalho posterior para fingir rollback perfeito.

Trocas de branch realizadas por Git externo não podem ser interceptadas universalmente. Detecte divergências no refresh e antes de cada mutação. Pause operações gerenciadas e ofereça diagnóstico sem afirmar que consegue recuperar bytes nunca salvos.

## 11. Sessão temporária de captura de arquivos novos

Implemente a ideia de uma sessão de adição, sem criar um destino permanente global.

CLI:

```text
git layer capture scripts [--path <subdiretorio>]
```

GUI: botão “Capturar novos arquivos” numa Layer ativa.

No início, registre os caminhos que já existem no escopo da captura, inclusive arquivos não rastreados preexistentes. Durante a sessão, mantenha o workspace inteiro disponível. O usuário pode criar arquivos no editor, em outro terminal ou no gerenciador de arquivos.

Ao finalizar, compare os caminhos atuais com o retrato inicial. O watcher pode atualizar a prévia, mas não é a fonte única de verdade.

Mostre a lista de candidatos e uma seleção revisável. Arquivos gerados/ignorados não devem ser incluídos automaticamente sem indicação e aprovação. Não capture `.git`, metadados, arquivos da base, reservas anteriores ou arquivos de outras Layers.

Na CLI, `q` encerra a fase de observação e abre a revisão; confirmar registra/prepara os selecionados. `Ctrl+C` cancela sem apagar arquivos. Na GUI, use botões de finalizar, revisar, confirmar e cancelar.

A captura não modifica arquivos existentes, não transfere propriedade e não inclui arquivos anteriores apenas porque foram editados. Criação e remoção dentro da mesma sessão não precisam gerar um arquivo final. Documente a limitação de comparar caminhos: remover e recriar um caminho preexistente não o torna automaticamente um novo candidato.

Permita uma única sessão por workspace, visível tanto na CLI quanto na GUI. Uma captura interrompida permanece diagnosticável e pode ser cancelada/retomada; não finalize atribuições silenciosamente na próxima abertura.

Ao confirmar, atribua e prepare somente os caminhos selecionados, numa operação validada. Depois, novos arquivos voltam ao fluxo normal da branch tradicional. Capturar arquivos não faz commit.

## 12. Transações, concorrência e recuperação

Implemente lock entre processos do próprio Git Layers, fila de mutações no desktop e locks normais do Git. Não apague um lock do Git só porque uma operação falhou. Um lock do nosso coordenador não impede comandos Git externos.

Para operações que alterem disco, índices, exclusões ou metadados, use journal com identificação, estado anterior, passos preparados, passos aplicados e estado final. Faça backups e valide espaço/permite gravação antes de remover a única cópia de qualquer conteúdo.

Escreva metadados por arquivo temporário e publicação segura. Use técnicas de durabilidade compatíveis com o SO, documentando os limites. Não anuncie uma transação ACID envolvendo Git e todo o sistema de arquivos.

Atualização de refs usa OID esperado. Uma transação de refs do Git não torna arquivos e JSON automaticamente atômicos. Se a ref avançou e o processo caiu antes de atualizar metadados, a recuperação deve reconhecer o commit já existente, não duplicá-lo nem desfazê-lo à força.

Antes da próxima mutação, revalide HEAD, índice principal, referências relevantes, regras de ignore e hashes dos arquivos afetados. Uma mudança externa inesperada deve falhar de forma conservadora.

Ao reiniciar, detecte journals incompletos. Ofereça inspeção, recuperação compatível com o estado atual e exportação de cópias para um novo diretório escolhido pelo usuário. Nunca recupere por sobrescrita irrestrita.

Metadados inconsistentes não justificam apagar `git-layers/`, índices ou shelves. Não expurgue backups pendentes automaticamente. Apresente o espaço utilizado e documente a retenção.

Inclua testes de falha injetada entre etapas de stage, commit, ativação, desativação e troca de branch.

## 13. Editor e interface de inspeção

Interface em português brasileiro, com tema escuro e claro, contraste adequado, foco visível e navegação por teclado. Não use somente cores para indicar estados.

Layout:

- Barra superior: caminho do repositório, branch tradicional, Layers ativas e indicador de segurança/recuperação.
- Coluna esquerda: explorador real de arquivos e seção de Layers.
- Área central: abas do Monaco e visualizador de diff.
- Painel de controle de versão: grupos separados “Branch tradicional”, “Layer ai”, “Layer scripts” e “Não rastreados”.
- Painel de diagnóstico/atividade: comandos executados, resultados e invariantes verificadas.

Explorador: abrir pasta local, criar arquivo/pasta, renomear e excluir com confirmação/recuperação. Em cada arquivo, mostrar proprietário e estado. Em diretórios mistos, mostrar “Misto”, não um proprietário inventado. Não permita editar `.git` por esse explorador.

Editor: realce de sintaxe para linguagens usuais, inclusive JavaScript/TypeScript, Python, JSON, Markdown, HTML, CSS, YAML e TOML; números de linha, busca, substituição, undo/redo, indicação de linguagem e estado não salvo. Configure tokenização adicional quando necessária. Não prometa formatação automática: realce de sintaxe e formatter são recursos distintos.

Salve em UTF-8 sem conversão silenciosa de encoding e preserve o estilo de final de linha detectado. Não sobrescreva com texto um arquivo binário. Mostre binários como não editáveis em texto; arquivos excessivamente grandes exigem abertura limitada ou somente leitura com aviso.

Detecte alteração externa de um arquivo aberto. Ofereça comparar/recarregar/manter rascunho, sem descartar o buffer local silenciosamente.

Estado de arquivo: diferencie “não salvo no editor”, “modificado no disco”, “preparado”, “modificações depois do stage”, “sem alterações”, “novo”, “removido” e “conflito”. Pode existir mais de um estado ao mesmo tempo. Como não há remotos, não mostre “sincronizado com a nuvem”.

Selecionar uma Layer no painel escolhe somente qual histórico/staging está sendo inspecionado. Não muda o proprietário dos arquivos nem o destino padrão de novos arquivos.

Os botões de commit devem mostrar o destino: “Commit na main”, “Commit na Layer scripts”. Não implemente um botão ambíguo de commit global.

A UI deve exibir dados reais do Core, atualizar depois das operações e oferecer refresh manual. Watchers precisam de debounce e não podem causar loops de gravação.

## 14. Funcionalidades Git locais

### Fluxo obrigatório da v0.1

Implemente visualmente, com operações reais:

- Abrir/inicializar repositório local, configurar identidade somente no repositório com consentimento e realizar o primeiro commit.
- Status, diff staged/unstaged, stage/unstage por arquivo e por hunk suportado.
- Commit, histórico, detalhes de commit e comparação de revisões.
- Listar, criar, trocar e excluir com segurança branches tradicionais. Não exclua a branch atual nem force exclusão de histórico não integrado.
- Renomear/excluir arquivos, preparar exclusões e restaurar conteúdo com confirmação e backup.
- Operações de Layers descritas neste documento, incluindo captura e preservação ao desativar.
- Diagnóstico real de integridade e recuperação de operações incompletas.

Essas funções não podem ser botões decorativos nem respostas simuladas.

### Complementos locais, depois do núcleo e dos testes de segurança

Inclua suporte real a amend de commit, tags locais, stash da base, merge entre branches tradicionais, cherry-pick e revert de commits simples, com visualização/resolução de conflitos e ações de continuar/abortar quando aplicáveis.

Nesta versão, operações avançadas que reescrevem ou integram árvores podem exigir todas as Layers desativadas/guardadas e o estado da base adequado. Mostre a exigência antes de alterar algo. Não as faça operar acidentalmente em arquivos de Layers. Stash da base não usa `--all` para engolir arquivos ignorados de Layers.

Não implemente rebase interativo, bisect, administração de objetos, rede, submódulos ou suporte completo a todos os subcomandos do Git. “Cliente Git local” neste projeto significa o conjunto explícito acima, não uma réplica integral de toda a CLI do Git.

Se algum complemento não for concluído, registre-o como não implementado e não o apresente como funcional. Não sacrifique o fluxo obrigatório ou os testes de integridade para acrescentá-lo.

## 15. CLI pública

Implemente uma instalação local ou empacotamento que disponibilize o executável `git-layer` no PATH, sem substituir `git`. Inclua instruções testadas para invocação pelo Git e execução direta pela CLI do projeto. Não execute instalação global na máquina do usuário.

Interface mínima:

```text
git layer init
git layer list
git layer create <nome>
git layer register <nome>
git layer on <nome>
git layer off <nome> [--park]
git layer status [<nome>] [--json]
git layer add <nome> -- <arquivo-ou-diretorio>...
git layer unstage <nome> -- <caminho>...
git layer diff <nome> [--staged] [-- <caminho>...]
git layer commit <nome> -m <mensagem>
git layer log <nome>
git layer restore <nome> -- <caminho>...
git layer capture <nome> [--path <diretorio>]
git layer switch <branch-tradicional>
git layer doctor [--json]
git layer recover
git layer --help
```

Defina precisamente o alcance de restore na ajuda; o padrão deve ser restaurar o disco a partir do índice, com confirmação/backup, e não limpar staging escondidamente. A captura confirma estágio; `unstage` não abandona propriedade de um arquivo novo. Reservas abandonadas exigem uma ação explícita e segura, que pode ser implementada como `release` restrito a arquivos nunca commitados.

Suporte caminhos com espaços e acentos. Valide nomes com `git check-ref-format` e uma política própria de nomes seguros. Use `--` e pathspecs literais; uma string iniciada por hífen não pode virar opção Git.

Comandos destrutivos não interativos precisam de flags explícitas e escopo inequívoco. Não acrescente `--force` genérico para contornar integridade. Inclua ajuda, mensagens úteis e códigos de saída estáveis.

## 16. Segurança da aplicação e execução do Git

No Electron, habilite isolamento de contexto e sandbox, desabilite Node no renderer, restrinja o preload, valide o emissor e os argumentos IPC, bloqueie navegação inesperada e novas janelas, e use política de conteúdo restritiva.

Carregue Monaco, workers, ícones e estilos localmente. Teste o aplicativo empacotado, não apenas o servidor de desenvolvimento. Não dependa de CDN. Se utilizar protocolo local privilegiado para os workers, configure-o com escopo mínimo; não desabilite segurança do Electron para fazê-los funcionar.

Exiba conteúdo do repositório como dados. Não execute JavaScript/HTML aberto no editor, tarefas do projeto, hooks, filtros externos, diff drivers, fsmonitor externo, assinadores ou scripts automaticamente. Desabilite execuções incidentais nas leituras Git por opções locais ao processo; quando uma operação depender de recurso não suportado, recuse com explicação, sem alterar a configuração do usuário ou fingir suporte.

Não habilite Git LFS nem downloads preguiçosos de partial clone. Não invoque comandos de rede, gerenciadores de credenciais ou validação remota. Não valide assinaturas disparando programas externos sem necessidade.

Use `spawn`/`execFile` ou equivalente com `shell: false`, argumentos em array, limites de saída e tempo, códigos de saída interpretados por comando e cancelamento seguro. Diferença encontrada e erro de processo não são a mesma coisa.

Use formatos estruturados, porcelain e delimitadores NUL quando disponíveis. Não analise `git status` humano por cores ou espaços. Sanitize variáveis Git herdadas que redirecionariam repositório/índice inadvertidamente, reintroduzindo explicitamente apenas o contexto desejado. Não modifique o ambiente global.

Uma operação com vários arquivos não é imune a processos externos alterando-os ao mesmo tempo. Reduza a janela com revalidação e locks próprios; ao detectar divergência, interrompa e preserve versões. Não prometa isolamento de sistema operacional que não existe.

## 17. Diagnóstico e demonstração

Implemente um painel “Verificar integridade”, correspondente ao `doctor`, que examine:

- Branch real apontada por HEAD e integridade do índice principal.
- Referências, índices, reservas e checkpoints de cada Layer.
- Propriedade exclusiva dos caminhos e conflitos de plataforma.
- Efetividade das exclusões locais.
- Journals pendentes, shelves e alterações externas incompatíveis.
- Presença dos objetos necessários, com `git fsck` quando solicitado.

O painel deve mostrar a evidência resumida: refs, OIDs, contagens e caminhos relevantes. Não mostre “tudo certo” baseado apenas em estado React ou um booleano salvo. Objetos dangling não equivalem, por si só, a corrupção; interprete corretamente a saída do Git.

Inclua um criador de **repositório demonstrativo descartável**, em um diretório novo escolhido pelo usuário, recusando sobrescrever diretório não vazio. Ele deve criar commits e branches reais, sem remotos:

```text
main: README.md, src/app.ts, package.json
layer/ai: AGENTS.md, .codex/config.toml
layer/scripts: scripts/debug.py, tools/analyze.py
dev: variação compatível da main
collision-demo: branch tradicional que ocupa um caminho da Layer scripts
```

Inclua roteiro guiado para editar os três conjuntos, preparar estados diferentes, fazer commits independentes, capturar arquivos, desativar/reativar com alterações e testar a recusa de uma colisão. Não execute scripts do repositório demonstrativo automaticamente.

## 18. Testes e critérios de aceitação

Use testes unitários e testes de integração com Git real em diretórios temporários. Configure identidade e ambiente isolados nos testes, sem tocar no Git global. Para UI, use testes de fluxo com Playwright/Electron ou alternativa equivalente documentada. O suporte Electron do Playwright é experimental: verifique a combinação de versões e não declare teste executado quando o ambiente não permite abrir o aplicativo.

Cenários obrigatórios:

1. Sem Layers, o fluxo normal da branch tradicional funciona.
2. Ativar duas Layers mantém o HEAD real na branch tradicional e mostra todos os arquivos.
3. `git add .` nativo, no cenário suportado, não captura caminhos das Layers e continua adicionando novos arquivos normais.
4. Stage/commit de Layer não altera a referência nem os bytes do índice principal; também não modifica o staging de outra Layer.
5. A árvore de uma Layer nunca recebe arquivos da base por varredura ampla.
6. Stage de uma versão, edição posterior e commit preservam exatamente a versão staged e deixam a edição posterior unstaged.
7. Staging parcial funciona na base e nas Layers para hunks suportados; patch obsoleto falha sem stage integral acidental.
8. Reservas de arquivos novos sobrevivem a unstage, fechamento e reabertura.
9. Captura não atribui arquivos que existiam antes, não rouba arquivos de outra origem e não deixa um target permanente.
10. Cancelar captura preserva os arquivos físicos sem atribuição automática.
11. Colisão direta é recusada, mesmo com conteúdo igual.
12. Arquivo/diretório, maiúsculas/minúsculas, Unicode, nomes perigosos, symlinks e travessia de diretórios são tratados conforme a política declarada.
13. Arquivo preexistente não rastreado ou ignorado nunca é sobrescrito por ativação.
14. Desativação/reativação preserva separadamente staged, unstaged, novos, excluídos e modos de arquivos.
15. Guardar uma Layer não apaga arquivos de outros proprietários em diretório compartilhado.
16. Troca compatível de branch mantém a composição e seus estados; troca incompatível preserva o estado anterior.
17. Buffers não salvos não desaparecem na desativação, restauração, troca de branch ou reabertura recuperável.
18. Regra de `.gitignore` que anula a exclusão é detectada; o teste não aceita falso positivo de `check-ignore`.
19. Nomes com espaços, acentos e caracteres especiais de ignore/pathspec não capturam arquivos adicionais.
20. LF, CRLF, UTF-8, binários e permissões suportadas não sofrem conversões destrutivas silenciosas.
21. OID de Layer alterado entre preparação e commit causa falha conservadora, sem sobrescrever a nova ref.
22. Duas mutações concorrentes pela CLI/GUI são serializadas ou recusadas corretamente.
23. Falhas injetadas antes/depois de alterações relevantes permitem recuperação diagnosticável, sem apagar trabalho posterior.
24. Uma queda depois de avançar a referência não gera um segundo commit duplicado na recuperação.
25. Objetos staged em índices alternativos continuam disponíveis após coleta de lixo controlada, graças aos checkpoints.
26. Metadados inválidos, versões futuras de esquema e locks existentes causam erro seguro, não reinicialização.
27. `git clean -fdx`/forçar adição/troca externa, quando testados, só rodam em cópias descartáveis. O resultado demonstra o limite de proteção e a detecção possível, sem alegar recuperação de bytes nunca preservados.
28. Abrir arquivo HTML/JS não executa seu conteúdo; acesso IPC a caminhos fora do repositório ou ao `.git` é recusado, salvo a API interna estritamente autorizada.
29. O aplicativo não tenta rede em operação normal nem carrega Monaco por CDN.
30. O ZIP extraído em outro diretório pode instalar, compilar e iniciar usando somente arquivos entregues e pré-requisitos documentados.

Compare refs, árvores, conteúdo binário, estados de staging e hashes antes/depois; não use somente screenshots. Nos testes exclusivamente de Layer, leituras de inspeção não devem reescrever opcionalmente o índice principal.

Para recursos complementares realmente implementados, acrescente testes de sucesso, conflito, abort e pré-condições. Não use cobertura percentual como substituto desses cenários.

## 19. Compatibilidade, empacotamento e conteúdo do ZIP

Planeje código e configuração de build para Windows, macOS e Linux. Informe quais plataformas foram efetivamente compiladas e testadas. Um teste em Linux não comprova funcionamento no Windows/macOS.

Entregue sempre código-fonte completo, configurações, lockfile real quando gerado, assets locais, testes, documentação e scripts. Inclua build executável para a plataforma que o ambiente conseguir realmente produzir e verificar. Não invente `.exe`, `.app` ou resultados de assinatura/notarização. Ausência de executável deve ser explicitada, junto de instruções para gerar o pacote localmente.

O aplicativo empacotado pode incluir o runtime do Electron, mas continua dependendo do Git instalado. A CLI a partir do código-fonte pode depender do Node instalado. Documente pré-requisitos e diagnóstico de Git ausente.

O ZIP deve conter:

```text
git-layers-lab/
  [codigo-fonte e configuracoes]
  README.md
  docs/ARCHITECTURE.md
  docs/CLI.md
  docs/SAFETY.md
  docs/TESTING.md
  docs/TEST-REPORT.md
  docs/LIMITATIONS.md
  docs/DEMO.md
  docs/SOURCES.md
  [scripts de build, teste, demo e empacotamento]
  [artefatos executaveis realmente gerados, quando disponiveis]
```

Inclua atribuições/licenças de dependências quando exigidas. Não escolha silenciosamente uma licença definitiva para o código original do usuário; registre essa decisão como pendente, sem impedir o teste local.

README deve explicar como instalar dependências, iniciar o desktop, executar a CLI, habilitar `git layer`, criar a demonstração e rodar os testes. Prefira scripts npm e launchers simples documentados, sem exigir que o usuário edite o código.

Diferencie o ZIP de código-fonte, que precisa de dependências para desenvolvimento, de um executável empacotado. Não diga que um source ZIP é um aplicativo portátil autossuficiente.

Não inclua node_modules no source ZIP, caches, credenciais, dados pessoais, repositórios do usuário ou arquivos temporários de teste. Use scripts para gerar a demonstração em vez de depender de uma pasta `.git` escondida e esquecida no pacote. Inspecione o ZIP antes de entregá-lo.

## 20. Processo de implementação e entrega

Implemente em ordem:

1. Descoberta de repositório, executor Git seguro e fixtures descartáveis.
2. Modelo de propriedade, índices alternativos, commits e checkpoints.
3. Validação de caminhos, exclude, projeção, shelves e journal.
4. CLI e testes de integração dos invariantes.
5. Editor desktop e painéis ligados ao mesmo Core.
6. Captura, diagnóstico, recuperação e testes de interface.
7. Complementos Git locais, somente sem sacrificar o núcleo.
8. Build, inspeção do pacote, documentação e ZIP.

Essas são etapas dentro desta tarefa, não um pedido para parar no planejamento. Não declare sucesso antes de verificar os resultados disponíveis.

Na resposta final, forneça o link real para o ZIP, instruções curtas para abrir, uma síntese do implementado e uma tabela que separe:

- Implementado e testado.
- Implementado, mas não executado/testado neste ambiente.
- Não implementado ou deliberadamente fora da v0.1.

`TEST-REPORT.md` deve conter comandos executados, versões, plataforma, quantidades reais de testes e resultados. Não invente logs, screenshots, cobertura ou testes multiplataforma. Caso falte rede para instalar dependências, ainda entregue o código e explique o que não pôde ser compilado/testado; não fabrique o lockfile ou binários.

A entrega só deve se declarar completa quando o fluxo obrigatório funciona e os critérios críticos de integridade passaram. Caso contrário, marque-a como experimental parcial, preservando o trabalho útil entregue.

## 21. Referências técnicas para verificação

As escolhas de produto, esquema local e interface acima são uma arquitetura proposta. Os mecanismos Git e as APIs devem ser confirmados na documentação oficial durante a implementação. Fontes de referência consultadas na preparação deste documento, em 17/10/2026, horário de São Paulo:

```text
Git: comandos externos/PATH, GIT_INDEX_FILE e opções globais
https://git-scm.com/docs/git

Ignore, precedência e verificação
https://git-scm.com/docs/gitignore
https://git-scm.com/docs/git-check-ignore

Índices, árvores, commits e refs
https://git-scm.com/docs/git-add
https://git-scm.com/docs/git-read-tree
https://git-scm.com/docs/git-write-tree
https://git-scm.com/docs/git-commit-tree
https://git-scm.com/docs/git-update-ref
https://git-scm.com/docs/git-update-index

Caminhos internos e layout
https://git-scm.com/docs/git-rev-parse
https://git-scm.com/docs/gitrepository-layout

Diff e materialização
https://git-scm.com/docs/git-diff
https://git-scm.com/docs/git-checkout-index
https://git-scm.com/docs/git-cat-file
https://git-scm.com/docs/gitattributes

Operações potencialmente destrutivas e hooks
https://git-scm.com/docs/git-checkout
https://git-scm.com/docs/git-switch
https://git-scm.com/docs/git-clean
https://git-scm.com/docs/githooks

Retenção de objetos e integridade
https://git-scm.com/docs/git-gc
https://git-scm.com/docs/git-fsck

Electron e Monaco
https://www.electronjs.org/docs/latest/tutorial/security
https://github.com/microsoft/monaco-editor
https://microsoft.github.io/monaco-editor/

Testes da interface
https://playwright.dev/docs/api/class-electron
```

Prioridade final: arquivos e históricos reais preservados, sem contaminação entre proprietários, com estados explicáveis e recuperação honesta. Um editor visualmente completo não compensa um mecanismo de versionamento incorreto.
