# Core/CLI — implementação de 02/11/2026

**Continuação de 04/11/2026 — Etapa 2.** O [relatório de desempenho e recuperação](reports/2026-11-04-performance-recovery/README.md) descreve otimizações e diagnóstico independente, preservando estes contratos. Sua validação integral nas fontes finais está PENDENTE; resultados anteriores não são atribuídos automaticamente ao código modificado. A classificação permanece em 20 implementados e sete parciais, incluindo GL-19.

**Continuação aprovada em 03/11/2026 — etapa 1B.** O [relatório de segurança implementada](reports/2026-11-03-security-compatibility-implementation/README.md) acrescenta correções de origem de rename, fronteira coerente do destino, opção conservadora na troca gerenciada e diagnósticos de staging/protect. Essas garantias e seus testes próprios complementam este contrato; não reclassificam resultados históricos nem tornam GL-01/09/15/18/22 completos. A ausência de observação contínua e as operações Git diretas permanecem fronteiras explícitas, não justificativas para D-01/D-02.

Esta fase implementa o produto segundo GL-01 a GL-27 do pacote de 02/11/2026. As restrições de 18 e 19/10 sobre não editar o produto pertencem às rodadas históricas. O [relatório público de fechamento](reports/2026-11-02-closure/REPORT.md) identifica fontes e resultados desta fase. Os logs brutos e entregas locais anteriores têm retenção externa; os relatórios anteriores não certificam estas fontes. A existência de uma API não comprova todos os critérios de um requisito.

## Produto, laboratório e build

O produto é o Core TypeScript e a CLI que chamam o Git oficial. Electron, React, Monaco, Vite, o repositório demonstrativo e plugins de editor não participam do build independente. O laboratório existente permanece uma integração manual com contratos anteriores e não foi aberto nem certificado nesta rodada.

Pré-requisitos do código-fonte: Node.js 22.12 ou posterior, npm, Git oficial local e as dependências de desenvolvimento do lockfile. Se as dependências ainda não estiverem disponíveis, `npm.cmd ci --ignore-scripts` instala sem executar o postinstall do Electron; requer acesso ao registro. O build independente usa somente o pacote `esbuild` e APIs Node. Não requer executar setup, dev, workshop ou empacotamento.

```powershell
npm.cmd run build:core
node dist-core/cli/index.js --help
node dist-core/cli/index.js --cwd 'C:\caminho\repositorio' status --json
# Também disponível na raiz do checkout:
npm.cmd run cli:core -- --cwd 'C:\caminho\repositorio' status --json
```

A saída `dist-core/` é separada de `dist/` e `dist-debug/`. O script não remove nenhuma dessas pastas. O bundle usa somente módulos nativos do Node em runtime e inclui `build-manifest.json` com as entradas efetivamente compiladas. A API fica em `dist-core/core/index.js`. `npm run build`, `npm run cli`, o bin do pacote raiz e os launchers legados continuam ligados ao pacote do laboratório: não os confunda com a nova saída. Para desenvolvimento sem build: `node --import tsx src/cli/index.ts ...`.

## Modelo e decisões técnicas

As branches são referências Git reais `refs/heads/layer/<nome>`. Os históricos e objetos são Git; os índices alternativos são índices nativos. O estado próprio coordena identidade, reservas de caminhos, projeção física, destino de edição e recuperação. Não há histórico paralelo nem merge automático de Layer na base.

Reconhecer uma branch local ou candidata remota prefixada, ativar seus arquivos, escolher o destino de edição e abrir a Layer como branch de trabalho são quatro ações diferentes. Criar ou reconhecer não ativa. As Layers ativas coexistem fisicamente com a branch de trabalho. Um caminho tem uma única origem na composição; mudar o destino não transfere arquivos já pertencentes à base ou a outra Layer.

O destino de edição persiste por workspace até `edit-end`, uma troca de destino ou uma operação que encerre esse contexto. A seleção registra os caminhos preexistentes. A reconciliação acontece nas consultas/comandos do produto: arquivos novos elegíveis são reservados para o destino e continuam sem commit automático. Arquivos anteriores sem dono continuam exigindo atribuição explícita. Este desenho dispensa um processo observador permanente. Durante o target, regras gerenciadas em `info/exclude` já impedem que o add nativo comum absorva caminhos novos antes da reconciliação. O bloco usa exclusão abrangente, reabre a travessia de diretórios, preserva exceções exatas para arquivos anteriores sem dono obtidos pelo Git como elegíveis e mantém regras exatas das Layers por último. A propriedade continua sendo reconciliada por comandos, sem stage/commit automático. Force e negações do usuário em arquivos ignore de maior prioridade continuam bypass; GL-01/09/18 não são declarados universalmente completos.

```powershell
node dist-core/cli/index.js --cwd $repo init
node dist-core/cli/index.js --cwd $repo create scripts
node dist-core/cli/index.js --cwd $repo on scripts
node dist-core/cli/index.js --cwd $repo edit scripts
# Crie os novos arquivos por qualquer ferramenta comum.
node dist-core/cli/index.js --cwd $repo status --json
node dist-core/cli/index.js --cwd $repo add scripts -- scripts/novo.ps1
node dist-core/cli/index.js --cwd $repo commit scripts -m 'Scripts locais'
node dist-core/cli/index.js --cwd $repo edit-end
```

`$repo` nos exemplos é uma pasta que o usuário escolheu deliberadamente. Estes comandos são instruções de uso, não foram aplicados ao checkout ou à demonstração para produzir evidências. Para atribuir um arquivo local anterior sem dono, use `add <Layer> -- <arquivo>`. Não é necessário recriá-lo. Sem destino escolhido, novos arquivos seguem o fluxo da branch de trabalho mesmo com várias Layers ativas. A captura revisável antiga permanece como interface de compatibilidade; não é pré-requisito do novo modo de edição.

A reconciliação avalia a intenção de ignore do usuário sem o bloco temporário gerenciado: regras de info/exclude, core.excludesFile e .gitignore mantêm prioridade/negações nativas. Arquivos assim ignorados não são reservados automaticamente; inclusão deliberada continua separada. O helper fornece ao Git um arquivo exclusivo de regras limpas em temporário externo, sem alterar metadata, refs, índices, exclude ou worktree do repositório, e remove sua entrada em finally. As [contraprovas R-02/R-03](evidence/closure-2026-11-02/review-target-preview.json) distinguem falhas anteriores e testes dirigidos aprovados.

A prévia off/remove descobre os mesmos candidatos lógicos usados pela ação, sem persistir reservas. Mostra arquivos do target criados antes da consulta mesmo sem status intermediário, mais pendências/impedimentos. logicalComplete:false sinaliza falha de enumeração; a ação reavalia o estado antes de efeitos e a confirmação não substitui essa validação.

## Preparação e commit — GL-14

Prepare todos os arquivos desejados de uma origem e faça um commit normal dessa origem. Não existe divisão automática em vários commits. O conteúdo preparado B e a edição posterior C continuam distintos: o commit do índice registra B e preserva C no disco. As Layers usam seu índice Git próprio, preservando o índice da base e o de outras Layers.

```powershell
node dist-core/cli/index.js --cwd $repo add scripts -- scripts/um.ps1 scripts/dois.ps1
node dist-core/cli/index.js --cwd $repo diff scripts --staged
node dist-core/cli/index.js --cwd $repo commit scripts -m 'Mudanças completas'
```

A seleção de trechos é opcional, como em `git add -p`. A CLI oferece `hunks <base|nome>` e `stage-hunk` com token; não obriga esse fluxo. A seleção suportada é para arquivos de texto rastreados e patches compatíveis; não simula preparação parcial de casos recusados. `restore` substitui disco pelo índice, com backup e confirmação; `unstage` modifica a preparação e preserva os bytes do disco.

## Desativação e ciclo de vida

`off <nome>` exige pendências resolvidas. As opções são commitar o trabalho desejado, cancelar ou descartar explicitamente. `off <nome> --discard --yes` autoriza o descarte de pendências dessa Layer antes de desativar. Sem `--yes`, um terminal interativo apresenta a prévia e pede `sim`; sem TTY/JSON exige confirmação explícita. `--yes` sozinho em `off` não significa descarte. `--park` é recusado, inclusive por compatibilidade de CLI. Backups técnicos de falhas e shelves históricas continuam preservados; não há novo auto-park na desativação.

```powershell
node dist-core/cli/index.js --cwd $repo preview off scripts --json
node dist-core/cli/index.js --cwd $repo off scripts
node dist-core/cli/index.js --cwd $repo rename scripts ferramentas
node dist-core/cli/index.js --cwd $repo preview remove ferramentas --json
node dist-core/cli/index.js --cwd $repo remove ferramentas --yes
# Apenas se o usuário escolheu também descartar pendências:
node dist-core/cli/index.js --cwd $repo remove ferramentas --discard --yes
```

`remove` é remoção local explícita da referência/registro; não envia exclusão remota. A confirmação de remoção não autoriza automaticamente descartar pendências. A prévia informa efeitos e impedimentos; não é um token que dispense revalidar a ação. Colisões e alterações externas não autorizam escolher silenciosamente uma origem vencedora.

## Branch de trabalho, Git direto e GL-01/GL-22

`switch <branch>` mantém as Layers ativas quando a composição é compatível e recusa uma branch Layer pela rota comum. Ao sair do modo Layer como branch, o padrão retoma a origem como camada se ela estava ativa antes da abertura. `switch <branch> --off-current-layer` é a escolha explícita de sair sem reativar essa origem, preservando sua referência/histórico e as demais Layers. Não descarta pendências nem dispensa revalidação. Controls acrescentados ao histórico da Layer podem impedir a retomada como projeção; a escolha de não retomá-la oferece saída explícita desse caso, sem desligar outras Layers silenciosamente. `open-branch <nome>` é a entrada deliberada: a Layer torna-se a branch de trabalho, não é projetada duas vezes, e as demais Layers continuam disponíveis. `switch <branch-tradicional>` oferece a volta. Pendências, stage e conflitos continuam sendo validados; não há desligamento oculto das demais Layers.

```powershell
node dist-core/cli/index.js --cwd $repo create ia
node dist-core/cli/index.js --cwd $repo on ia
node dist-core/cli/index.js --cwd $repo open-branch scripts
node dist-core/cli/index.js --cwd $repo status --json
node dist-core/cli/index.js --cwd $repo switch main
```

A CLI gerenciada recusa a seleção comum de uma Layer. Além disso, `protect` instala proteção opcional por repositório: reserva branches Layer em worktrees Git próprias, sem checkout de seus arquivos. O Git recusa a seleção padrão de uma branch já usada em outro worktree antes da troca. Essa configuração é explícita, não altera o Git/configuração global e adiciona topologia Git local que fica visível às ferramentas. `unprotect` remove somente reservas comprovadamente próprias, preservando as refs Layer e qualquer conteúdo desconhecido. A entrada deliberada `open-branch` libera/ajusta sua reserva; ao retornar ao uso como camada a reserva pode ser recomposta.

```powershell
node dist-core/cli/index.js --cwd $repo protect
# A seleção padrão nativa fica sujeita à regra Git de branch em outro worktree.
node dist-core/cli/index.js --cwd $repo open-branch scripts
node dist-core/cli/index.js --cwd $repo switch main
node dist-core/cli/index.js --cwd $repo unprotect
```

Branches criadas por fora exigem reaplicar `protect`; remover/prunar as reservas externamente pode retirar a prevenção, com diagnóstico no próximo uso gerenciado. O prefixo `layer/` sozinho não cria um tipo protegido. Sem `protect`, Git direto pode selecionar a branch. Mesmo com proteção, `git switch --ignore-other-worktrees layer/scripts` é bypass nativo; processos externos que o usem continuam fora da prevenção padrão. Não há hook preventivo universal, substituição do Git ou interceptador global. Reconhecer mudança depois não equivale a impedir seus efeitos. A prevenção universal de GL-22 continua parcial por conflito com preservar as opções do Git; a evidência mínima e as alternativas devem constar do relatório, sem classificar o bypass como PASS de prevenção.

Para caminhos projetados já conhecidos, o produto mantém regras exatas no `info/exclude`, conferidas com o Git; isso permite o fluxo usual `git add .` sem incluir esses arquivos ignorados na base. Não constitui isolamento universal: `git add -f`, regras do usuário de maior prioridade que o bloco do target, edição de regras, `clean -fdx`, `reset --hard` e seleção nativa de branch têm efeitos nativos próprios. Uma recusa gerenciada não certifica a rota nativa. GL-01 deve ser avaliado por variante; não se declara compatibilidade total apenas porque o wrapper preservou a origem.

## Compartilhamento

Use os comandos normais do Git, escolhendo refs explicitamente quando necessário:

```powershell
git push remoto layer/scripts
git fetch remoto
node dist-core/cli/index.js --cwd $repo list --json
node dist-core/cli/index.js --cwd $repo preview on scripts --json
node dist-core/cli/index.js --cwd $repo on scripts
```

Receber e reconhecer uma Layer não ativa seus arquivos. O reconhecimento inclui refs remotas dos remotes configurados, preservando nomes hierárquicos de Layer. `on`/`register` criam tracking local quando há candidata remota única; `preview`/`log` consultam sem criar ref local. Se houver várias origens para o mesmo nome, o produto recusa ambiguidade: selecione a origem explicitamente com o Git, criando `layer/<nome>` a partir da ref desejada. Atualização externa com preparação ou projeção divergente é diagnosticada; não reinicialize índices para ocultar o problema. Push de branches ou opções abrangentes podem compartilhar o histórico das Layers; elas não são privadas por terem esse prefixo. Testes com remotos locais não certificam todos os provedores nem autenticação de contas reais.

## Armazenamento, migração e resgate

Instalações novas usam `layers` no diretório Git descoberto oficialmente. Repositórios legados continuam usando `git-layers` até migração explícita. Não concatene `.git` ao workspace: o caminho pode ser um gitfile. A implementação ainda conserva o envelope restritivo de topologias do Core; descobrir um gitfile não certifica múltiplos worktrees.

```powershell
node dist-core/cli/index.js --cwd $repo doctor --json
node dist-core/cli/index.js --cwd $repo recovery-export 'C:\pasta-nova-de-resgate'
# Primeiro use uma cópia descartável; depois, por decisão do dono dos dados:
node dist-core/cli/index.js --cwd $repo migrate --yes
node dist-core/cli/index.js --cwd $repo doctor --json
```

A migração copia e verifica inventário de caminhos, bytes e modos antes de publicar o destino. Conserva a origem legada, índices, reservas, shelves e backups; não reescreve o passado para apagar auto-park antigo. Um destino `layers` desconhecido, schema ou campos estruturais inválidos recusados pela abertura do Core, lock disputado ou recuperação pendente causam recusa. Essa checagem de abertura não valida toda a coerência semântica, nem reconstrói histórico perdido; diagnóstico e recuperação conservadora continuam sendo etapas distintas. Uma cópia interrompida permanece identificável para inspeção. Reabrir após migração verifica a procedência e diagnostica mudança posterior no legado. Não use a cópia legada e a nova alternadamente como se sincronizassem. Nenhum dado real do usuário foi migrado para validar este suporte.

`doctor` e `recovery-export` têm entrada independente da abertura normal dos metadados. Permitem registrar e copiar evidências quando `registry.json` está inválido. `doctor` com `safe:false` retorna código 3 e envelope `ok:false`, preservando os checks em `result`. Exportar não repara automaticamente e não autoriza sobrescrever destino existente. Locks reais permanecem bloqueios; não remova lock apenas pela aparência de um PID antigo. `recover` só aplica rollback que consiga provar seguro e preserva cópias quando há edição posterior.

## Limitações e evidências

Permanecem restrições conservadoras para hooks/assinatura, filtros e LFS, sparse/partial/shallow, alternates, submódulos, links e topologias sem validação. Isto é limitação da implementação, não proibição permanente nem ambiente ausente. Arquivos grandes, interrupções reais, concorrência, long paths, modos e recuperação têm o alcance efetivamente executado no relatório. Não há promessa de transação ACID contra outros programas ou recuperação de bytes nunca persistidos.

Os 27 requisitos não são declarados integralmente atendidos por este documento. Resultados, falhas, retestes, denominadores e hashes pertencem ao relatório e ao ZIP novos. Os comandos de validação incluem `npm.cmd run typecheck`, `npm.cmd run test:unit` e testes pertinentes com Git oficial e filesystem como observadores; executar um subconjunto não autoriza chamar a suíte completa de aprovada.

## Expectativas versionadas

O teste Windows de projeção CRLF/binário em caminho acentuado antes aceitava `off(..., true)` e reaparecimento da edição posterior. A expectativa de 02/11/2026 foi alterada por GL-16: a desativação suja deve recusar e preservar bytes/índice; `--park`/auto-park são recusados; após descarte explícito e reativação reaparece o conteúdo commitado normalizado pelo Git, sem ressuscitar a edição descartada. As invariantes de binário, CRLF e preservação do índice principal foram mantidas. Resultados anteriores pertencem à baseline histórica; o novo resultado exige execução desta fonte.

### Ajustes de preservação após a suíte ampla npm02

O papel Layer como branch usa o índice principal para staging Git normal, mantendo o índice privado anterior e seu checkpoint como estado retido distinto. O guard e o diagnóstico validam ambos em seus papéis; uma alteração externa no índice privado impede a saída em vez de autorizar sua reinicialização. `recover` sem journal pode reconhecer commit nativo desse papel conservando o staging principal legítimo. Journals validam papéis opcionais e a baseline/exceções do destino antes de qualquer restauração/publicação. Locks nativos do índice recusam mutações antes da transação. Esses incrementos e sete regressões foram adicionados **depois** do snapshot amplo npm02; sua evidência é a rodada focada identificada no relatório, sem atribuição retroativa de PASS amplo.

### Renomeação GL-20 e metadados nativos

O fechamento R05 substituiu a antiga transação que movia apenas refs. O protocolo atual native-copy-cas-v1 copia a branch com o Git oficial, preservando configuração/upstream/descrição e reflog suportados, e remove a referência anterior por CAS com OID esperado. A identidade interna, índice e arquivos permanecem; journal e recuperação conservadora tratam a publicação e mudanças externas. Confira as fontes em src/core/layer-rename.ts e as evidências R05 do fechamento. A afirmação anterior de que esta versão não transfere configuração/reflog estava desatualizada; não descreve o protocolo atual. Essa correção documental não reclassifica GL-20 integralmente nem certifica todos os backends/plataformas. Fontes: [git branch](https://git-scm.com/docs/git-branch) e [git update-ref](https://git-scm.com/docs/git-update-ref).
