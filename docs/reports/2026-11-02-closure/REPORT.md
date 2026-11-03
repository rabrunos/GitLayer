# Fechamento do Git Layer — 02/11/2026

**Validação local concluída nos snapshots declarados.** Full02: 229 casos, 225 PASS, quatro SKIP; infra02: 111/111 PASS; typecheck e build/smoke PASS. A broad2 terminou exit 0 com 361 selecionadas: 355 PASS, seis ENV_BLOCKED, zero FAIL. O domínio funcional de 173 arquivos permaneceu idêntico antes/depois da campanha. A [cópia nova do commit A](../../evidence/closure-2026-11-02/fresh-commit.json) passou instalação/typecheck/build/help/smoke/verificadores. O [payload classificado foi arquivado e verificado](../../evidence/closure-2026-11-02/cleanup.json), com preservações locais declaradas. O código A foi observado na main do servidor; esta é a [atestação anterior ao commit documental B](../../evidence/closure-2026-11-02/finalization.json), cuja prova final é informada na entrega após publicação.


A rodada anterior implementou Core/CLI e terminou localmente. Esta missão posterior autoriza corrigir R-01 a R-05, validar o estado destinado ao GitHub, preservar e organizar os dados, fazer commits e sincronizar main. Os limites de Git direto continuam explícitos. Publicação de release, distribuição de binários, deploy, laboratório e plugins permanecem fora do escopo.

## Autoridade e autoria

A [missão de fechamento](../../decisions/2026-11-02-closure.md) é a autorização atual. As [decisões funcionais recebidas](../../decisions/implementation-2026-11-02/README.md) conservam quatro arquivos originais byte a byte, incluindo os 27 requisitos, as respostas e a condição GL-14. O [manifesto de procedência](../../decisions/implementation-2026-11-02/SOURCE-MANIFEST.json) registra hashes e tamanhos; não é uma assinatura independente. A autorização posterior de commit/push substitui a proibição histórica, sem reescrever as fontes anteriores.

O usuário definiu comportamentos. O Codex escolheu refs Git, índices alternativos, projeção física, contexto persistido de edição/papel, journaling, layout e proteção opt-in. Essas escolhas não são novos requisitos aprovados. A exclusão temporária do target é mecanismo de preparação comum, não ACL; o fato de o Git conservar force e bypass não autoriza ocultar apropriação indevida ou prévia incompleta.

## Baseline e trabalho anterior preservado

O fechamento começou em main, HEAD `37887aad107bd751a3687bc660a6644ef5d90c54`, com desenvolvimento acumulado modificado e untracked. Uma baseline externa verificada preserva **324 arquivos**. Ela é a entrada desta rodada e inclui trabalho legítimo anterior do usuário e da implementação; `git diff HEAD` não atribui todo esse trabalho ao fechamento.

A primeira implementação tinha outra baseline, com **301 cópias** verificadas. São conjuntos de fases diferentes. Seu encerramento local tinha 56 arquivos no domínio de fontes/testes/configuração e fingerprint `919665cce4149ed4232d36dbef6d42dc5b8dbd798f0defd755d37478e3f6edd5`, com `currentFullSuite:false`. A suíte anterior de 190 testes (186 PASS, quatro SKIP) precedia mudanças posteriores; seleções focadas não foram somadas para chamá-la de suíte ampla das fontes finais. Este fechamento exige uma execução nova.

A baseline de 324 arquivos já foi preservada e verificada externamente no lote `closure-2026-11-02-eba4a209`. Patches, briefs, ZIPs e logs brutos classificados foram arquivados nesse lote com inventários, hashes e recibos verificados. As preservações locais intencionais estão declaradas no compacto de cleanup. Não se infere preservação nem ausência de ignorados por um status Git limpo.

## Revisão R-01 a R-05

| Item | Defeito/expectativa confrontados | Correção e prova disponível | Estado do fechamento |
| --- | --- | --- | --- |
| R-01 | Receitas ainda exigiam park, suspensão após commit nativo compatível e falha antiga de exportação. | Antes real: duas falhas, exit 1. Depois dirigido: 15/15 PASS, 518081 ms, 834 comandos registrados pelo harness, fontes/runner estáveis. [Mapa executável](../../../tests/git-compat/expectations-closure-2026-11-02.json), [histórico](../../git-compat/history/FECHAMENTO-MATRIZ-2026-11-02.md) e [prova pública](../../evidence/closure-2026-11-02/review-expectations.json). | Contratos runtime atualizados, sem desativar módulos ou apagar chaves anteriores. Primeira seleção ampla com falhas preservada; broad2 concluída sem FAIL, com seis recursos bloqueados. |
| R-02 | O blanket do target escondia info/exclude e core.excludesFile; arquivo ignorado era reservado e podia ser retirado pelo descarte. | Antes: info/global FAIL, .gitignore controle PASS. Depois: três fontes preservadas, edit-end/descarte e inclusão explícita corretos; sete controles nativos de prioridade/negação. [Evidência pública](../../evidence/closure-2026-11-02/review-target-preview.json). | Corrigido; os três casos de ignore e os controles também passaram na suíte headless final. |
| R-03 | Prévia off/remove omitia arquivos criados após abrir target, mas a ação os reconciliava e descartava. | Antes: duas falhas. Depois: Core/CLI enumeram newcomers sem status; bytes do repositório idênticos; recusa normal e descarte revalidam arquivo posterior à prévia. [Teste](../../../tests/integration/review-target-preview.test.ts). | Os seis casos passaram juntos novamente em full-final-02 (229 casos); ConPTY real de confirmação/cancelamento passou no dirigido de 15 variantes. Primeira seleção ampla com falhas preservada; broad2 concluída sem FAIL, com seis recursos bloqueados. |
| R-04 | As fontes finais anteriores não tinham uma suíte ampla correspondente. | Agora npm test terminou 229 casos: 225 PASS, zero FAIL, quatro SKIP; infra 111/111 e typecheck exit 0 no domínio de 61 arquivos/fingerprint 1bd7. [Consolidado público](../../evidence/closure-2026-11-02/validation.json). | Full02/infra02 e broad2 concluídos; primeira broad com falhas preservada como snapshot distinto. |
| R-05 | Rename anterior não transferia configuração/upstream/descrição/reflog. | Cópia nativa Git+CAS+publicação conservadora preservam dados de branch. Os 16 casos passaram juntos novamente em full-final-02. [Módulo](../../../src/core/layer-rename.ts), [nota](../R05-RENAME-2026-11-02.md) e [prova](../../evidence/closure-2026-11-02/R05-RENAME.json). | GL-20 continua parcial pelo envelope e janela de inspeção descritos abaixo, não por perda da configuração no fluxo normal. |

R-02 e R-03 são defeitos reproduzidos, não hipóteses promovidas a fato por leitura estática. As falhas anteriores foram mantidas com exit 1. A correção compartilhada usa o matcher do Git, sem implementar um matcher alternativo no teste.

## R-02: intenção de ignore preservada

O helper [ignore.ts](../../../src/core/ignore.ts) consulta o Git oficial por `ls-files`, com `.gitignore` por diretório e os arquivos global/local de exclusões na prioridade nativa. Somente o bloco gerenciado é retirado da entrada lógica. Uma fixture de controle separada usa `check-ignore` sem esse bloco para estabelecer o esperado. Foram comparadas negações de .gitignore sobre info/global, info sobre global, regra positiva local sobre negação global, última regra, diretório ancestral ignorado e .gitignore mais profundo.

O Git instalado recusou `--exclude-from=-` e `/dev/stdin`. A solução usa um arquivo de entrada exclusivo, em temporário externo ao repositório inspecionado, removido em finally; arquivo alterado ou adição desconhecida não autoriza limpeza recursiva. O contrato read-only da prévia significa nenhuma alteração de metadata, refs, índices, exclude ou worktree do repositório. O I/O transitório externo está declarado, sem fingir inexistência de qualquer escrita no computador.

Arquivo ignorado continua sem atribuição automática e seus bytes sobrevivem ao encerramento do target e ao descarte da Layer. Inclusão deliberada por add da Layer é uma escolha separada e foi comprovada por blob/commit Git. A regra do usuário não é apagada nem reescrita. A semântica nativa das exclusões é descrita na [documentação oficial de ls-files](https://git-scm.com/docs/git-ls-files); os controles executados delimitam o suporte da versão instalada.

## R-03: prévia lógica e revalidação

A descoberta de candidatos é compartilhada por prévia e mutação. A prévia constrói reservas virtuais, informa `unreconciled`, `disappears`, alterações pendentes e `LAYER_DIRTY`, sem gravá-las. Se não conseguir enumerar candidatos, retorna `logicalComplete:false` com impedimento. Impedimentos do guard continuam visíveis; prévia não concede autorização de descarte.

Os testes criaram `new.txt` externamente depois de escolher target e chamaram off/remove preview diretamente, sem status/add/edit-end intermediários. O esperado era incluir esse caminho e preservar todo o estado. A ação normal recusou com os bytes intactos. Depois foi criado `later.txt`; o descarte escolhido deliberadamente reavaliou o estado e retirou ambos. O índice da base e seu arquivo sentinela permaneceram preservados. A CLI pública produziu a mesma enumeração; a confirmação interativa usa essa prévia. O novo caso ConPTY real cancelou sem alterar metadata/exclude/config/refs/índices físicos e semânticos/disco; a confirmação posterior retirou somente a Layer e seu novo arquivo, preservando outras origens.

## Matriz dos 27 requisitos

Os status abaixo descrevem implementação dentro do envelope, não compatibilidade universal nem resultado de toda a receita. Mantêm-se **20 implemented e sete partial**. A correção R-05 preserva o fluxo normal, mas seu envelope e a recuperação conservadora mantêm GL-20 parcial. O JSON registra os nomes exatos dos testes e as limitações. Teste especificado, teste implementado, seleção, execução e suporte são dimensões distintas.

| ID | Suporte | Comportamento e implementação | Teste/cenário |
| --- | --- | --- | --- |
| GL-01 | partial | Git oficial, índices nativos e proteção de preparação por origem. [código](../../../src/core/index.ts) | [GL01-05 recognized inactive layers preserve native default flow](../../../tests/integration/product-v1.test.ts) |
| GL-02 | implemented | Branch de trabalho/papel deliberado distintos de Layer ativa. [código](../../../src/core/index.ts) | [GL01-05 recognized inactive layers preserve native default flow](../../../tests/integration/product-v1.test.ts) |
| GL-03 | implemented | Sem target, novos arquivos seguem o fluxo tradicional. [código](../../../src/core/index.ts) | [GL01-05 recognized inactive layers preserve native default flow](../../../tests/integration/product-v1.test.ts) |
| GL-04 | implemented | Reconhecimento local/remoto por prefixo e tracking único explícito no uso. [código](../../../src/core/index.ts) | [GL01-05 recognized inactive layers preserve native default flow](../../../tests/integration/product-v1.test.ts) |
| GL-05 | implemented | Layer criada como ref/commit Git real e começa inativa. [código](../../../src/core/index.ts) | [GL01-05 recognized inactive layers preserve native default flow](../../../tests/integration/product-v1.test.ts) |
| GL-06 | implemented | Ativação física e desativação restrita aos caminhos próprios. [código](../../../src/core/index.ts) | [GL01-08 two active layers isolate native add and commit](../../../tests/integration/product-v1.test.ts) |
| GL-07 | implemented | Várias Layers ativas e índices/históricos independentes. [código](../../../src/core/index.ts) | [GL01-08 two active layers isolate native add and commit](../../../tests/integration/product-v1.test.ts) |
| GL-08 | implemented | Workspace físico único sem fusão de históricos. [código](../../../src/core/index.ts) | [GL01-08 two active layers isolate native add and commit](../../../tests/integration/product-v1.test.ts) |
| GL-09 | partial | Target explícito com exclusão antecipada e propriedade reconciliada por comando. A intenção de ignore do usuário é avaliada sem o bloco temporário gerenciado; regras locais/globais e negações mantêm o significado Git, com scratch externo exclusivo e sem escrita no repositório. [código](../../../src/core/index.ts) | [GL03-09-10-18 explicit edit intervals reserve without staging or adopting old files](../../../tests/integration/product-v1.test.ts) |
| GL-10 | implemented | Propriedade persistente, atribuição explícita de arquivo anterior e reserva após unstage. [código](../../../src/core/index.ts) | [GL03-09-10-18 explicit edit intervals reserve without staging or adopting old files](../../../tests/integration/product-v1.test.ts) |
| GL-11 | implemented | Staging Git real separado por origem; B no índice e C no disco. [código](../../../src/core/index.ts) | [GL11-12-14 staged B commit preserves disk C and independent base stage](../../../tests/integration/product-v1.test.ts) |
| GL-12 | implemented | Commit Git real independente com atualização condicionada ao OID. [código](../../../src/core/index.ts) | [GL11-12-14 staged B commit preserves disk C and independent base stage](../../../tests/integration/product-v1.test.ts) |
| GL-13 | implemented | Histórico/diff por origem e ref real atual. [código](../../../src/core/index.ts) | [GL13 log observes native Layer branch commit without prior status](../../../tests/integration/product-v1.test.ts) |
| GL-14 | implemented | Preparar tudo e um commit; hunks opcionais; sem divisão automática. [código](../../../src/core/index.ts) | [GL11-12-14 staged B commit preserves disk C and independent base stage](../../../tests/integration/product-v1.test.ts) |
| GL-15 | partial | Troca gerenciada conserva Layers compatíveis e recusa colisões. [código](../../../src/core/index.ts) | [GL15 managed compatible switch keeps another layer staged and dirty](../../../tests/integration/product-v1.test.ts) |
| GL-16 | implemented | Sem novo auto-park; commit, cancelamento ou descarte explícito. [código](../../../src/core/index.ts) | [GL16 dirty off refuses then explicit discard never resurrects edits](../../../tests/integration/product-v1.test.ts) |
| GL-17 | implemented | Colisões/paths/propriedade revalidados sem escolher origem vencedora. [código](../../../src/core/index.ts) | [GL17 collision branch refuses before physical effects](../../../tests/integration/product-v1.test.ts) |
| GL-18 | partial | Criação externa com target; captura legada é opcional. [código](../../../src/core/index.ts) | [GL03-09-10-18 explicit edit intervals reserve without staging or adopting old files](../../../tests/integration/product-v1.test.ts) |
| GL-19 | partial | Doctor/export independentes e recuperação conservadora com journals/backups/refs. [código](../../../src/core/rescue.ts) | [GL19 rename interrupted after ref update recovers without loss](../../../tests/integration/product-v1.test.ts) |
| GL-20 | partial | Renomeação local preserva configuração branch, upstream, descrição, multivalores e histórico do reflog usando cópia nativa Git, CAS e publicação conservadora do config local, mantendo commits, índice, propriedade e arquivos. Nenhuma alteração remota é enviada. A remoção local recusa pendências sem descarte explícito, retira somente a origem escolhida e mantém o commit removido por referência técnica de recuperação. [código](../../../src/core/layer-rename.ts) | [GL20 rename active layer retains ownership target and staged bytes](../../../tests/integration/product-v1.test.ts) |
| GL-21 | implemented | Históricos e refs usam transporte Git normal e remotos bare locais de teste. [código](../../../src/core/index.ts) | [share-local-bare-and-recognize-clone](../../../tests/git-compat/cases/implementation.mjs) |
| GL-22 | partial | Entrada deliberada, outras Layers compatíveis e proteção nativa padrão opt-in. [código](../../../src/core/index.ts) | [GL22 deliberate Layer branch maintains other layers and returns coherently](../../../tests/integration/product-v1.test.ts) |
| GL-23 | implemented | Build/CLI independentes do laboratório em dist-core. [código](../../../scripts/build-core.mjs) | [implementation CLI help exposes terminal-only product commands and explicit discard](../../../tests/unit/implementation-cli.test.mjs) |
| GL-24 | implemented | Editor/plugins são extras fora desta rodada. [código](../../../scripts/build-core.mjs) | [implementation CLI help exposes terminal-only product commands and explicit discard](../../../tests/unit/implementation-cli.test.mjs) |
| GL-25 | implemented | Layout layers e migração explícita com legado retido. [código](../../../src/core/layout.ts) | [GL25: fresh layout uses layers; legacy opens in place without implicit migration](../../../tests/integration/layout-rescue.test.ts) |
| GL-26 | implemented | Consulta branch/papel, Layers, target, pendências e bloqueios. [código](../../../src/core/index.ts) | [GL19-26 abandoned lock is visible in status and doctor without deletion](../../../tests/integration/product-v1.test.ts) |
| GL-27 | implemented | A prévia lógica somente leitura inclui arquivos elegíveis do target ainda não reconciliados; a ação revalida o estado atual de forma independente. [código](../../../src/core/index.ts) | [GL27 preview is read-only and apply revalidates a new collision](../../../tests/integration/product-v1.test.ts) |

### GL-14

Preparar tudo e fazer um commit normal continua sendo o fluxo simples. Índice Git real registra B enquanto o disco pode estar em C; o commit usa B e mantém C. Hunks são opcionais, aplicados pelo Git ao índice, sem dividir commits automaticamente, criar formato de histórico ou mudar propriedade. Binários, criação/remoção, modos e patches fora do envelope não recebem uma preparação parcial fictícia. Os testes observam contagem de commits, árvores/blobs, refs, índice semântico e bytes das outras origens.

### GL-20: preservação nativa e envelope restante

A operação usa git branch -c para conservar todos os valores pertinentes de configuração, upstream, descrição, multivalores e histórico do reflog; depois uma transação CAS verifica o destino e retira a origem com OIDs esperados. O config local é publicado sob config.lock próprio e fingerprints. O reflog mantém o evento nativo verdadeiro de cópia; não se fabrica um evento de branch -m. Nenhuma branch remota é publicada ou excluída.

Destino com ref/config/reflog existente é ocupado. Branch Layer atualmente selecionada, configuração fora do config local principal, aliases de caixa/Unicode, nomes ancestrais, worktrees externos e backend distinto de files recebem recusa conservadora. Na janela entre a cópia nativa e seu primeiro snapshot durável, recover preserva ambas as refs/config/histórico/backups e exige inspeção em vez de adivinhar rollback. A prova dessa recusa não é suporte à recuperação automática.

O protocolo consulta `--show-ref-format`. O handler está ausente na [fonte oficial Git 2.43.0](https://raw.githubusercontent.com/git/git/v2.43.0/builtin/rev-parse.c) e presente na [fonte oficial Git 2.44.0](https://raw.githubusercontent.com/git/git/v2.44.0/builtin/rev-parse.c); a [documentação 2.44.0](https://git-scm.com/docs/git-rev-parse/2.44.0) também descreve a opção. Sem essa feature, rename retorna `RENAME_UNSUPPORTED` antes dos efeitos. Essa disponibilidade da feature desde 2.44 não é uma campanha runtime dessa versão nem altera retroativamente o alvo histórico 2.43 do laboratório. O Git realmente executado neste fechamento foi 2.53.0.windows.2.

### GL-22 e Git direto

O prefixo `layer/` não bloqueia seleção nativa. Hooks posteriores podem falhar depois dos efeitos e não foram adotados como prevenção universal. A solução opt-in reserva branches em worktrees próprias sem checkout; o Git recusa a seleção comum antes dos efeitos na rota testada. A entrada deliberada `open-branch` ajusta a reserva necessária e conserva outras Layers compatíveis. A mesma origem não é projetada duas vezes.

A topologia é visível ao Git e restringe operações em branches reservadas. `unprotect` exige identidade/reciprocidade e não autoriza apagar dados desconhecidos. Branches externas precisam de proteção correspondente. Remoção/prune externos e `--ignore-other-worktrees` continuam bypass nativos. Force, ignore de prioridade superior, clean e switch destrutivos conservam seus efeitos. Portanto GL-01/09/15/18/22 não são convertidos em proteção universal por um PASS do wrapper.

## Arquitetura, dados e uso

O Core usa refs `refs/heads/layer/<nome>`, objetos, árvores e commits nativos. Cada Layer projetada possui índice próprio; a branch de trabalho usa o índice principal. Destino de edição é distinto de Layer ativa e da branch escolhida. Uma Layer deliberadamente aberta como branch usa o índice principal, retendo seu índice privado/checkpoint para retorno seguro. O fluxo gerenciado não cria branch sintética de composição nem histórico conjunto.

Novos repositórios usam `layers` no diretório descoberto pelo Git; legado `git-layers` abre no lugar até migração explícita. A migração copia/verifica e conserva a origem, índices, reservas, shelves, backups e journals históricos; não migra dados reais para testar. Destino desconhecido, recuperação pendente e proteção incompatível recusam. A validação de abertura é estrutural; não equivale a reparar toda incoerência semântica. O marcador vincula origem/destino absolutos: a relocação de um repositório já migrado não tem remapeamento automático. Essa fronteira deriva da leitura do código, sem campanha runtime de relocação.

Doctor/export têm entrada independente da abertura normal de metadata. Locks reais, inclusive índices privados, não são apagados. Recover valida o plano e deve recusar locks antes de processar journals; um commit já avançado é reconhecido sem duplicá-lo. Exportar é evidência de metadata/estado Git selecionado, sem prometer clone de objetos, todos os bytes correntes do worktree ou restauração offline automática. Consulte [migração e resgate](../../STORAGE-MIGRATION.md), [segurança](../../SAFETY.md) e [limitações](../../LIMITATIONS.md).

Build e uso não dependem do laboratório:

```powershell
npm.cmd run build:core
node dist-core/cli/index.js --cwd $repo init
node dist-core/cli/index.js --cwd $repo create scripts
node dist-core/cli/index.js --cwd $repo on scripts
node dist-core/cli/index.js --cwd $repo edit scripts
# Crie arquivos pela ferramenta externa de sua escolha.
node dist-core/cli/index.js --cwd $repo preview off scripts --json
node dist-core/cli/index.js --cwd $repo add scripts -- scripts/novo.ps1
node dist-core/cli/index.js --cwd $repo commit scripts -m 'Mudanças escolhidas'
node dist-core/cli/index.js --cwd $repo edit-end
node dist-core/cli/index.js --cwd $repo off scripts
```

A [CLI](../../CLI.md) detalha target, hunks, restore, rename/remove, open-branch, proteção, resgate e migração. Descarte é explícito; confirmar remove não implica autorizar descarte. Compartilhamento é Git normal, com bare local e clone descartável como oráculos, sem serviço próprio. Reconhecer uma ref recebida não ativa arquivos. O build usa Node/Git e esbuild disponível; não distribui uma release neste lote.

## Execuções e reprodução

Ambiente já observado nos testes dirigidos: Windows x64, Node v24.14.1 e Git 2.53.0.windows.2. O observador chama o executável oficial por caminho absoluto/argv; paths pessoais do host e configs reais não entram nas provas públicas. HOME/USERPROFILE/XDG, identidade, configuração e helpers são sintéticos por subprocesso. Fixtures usam nonce e ancestralidade; cleanup não visita repositórios pessoais.

| Execução | Resultado terminal | Alcance |
| --- | --- | --- |
| R-01 antes | Exit1; duas falhas esperadas, produto/runner estáveis. | Prova de expectativas obsoletas, não de perda de dados. |
| R-01 infraestrutura dirigida | 10/10 PASS, exit 0. | Seleção/registro/fase/renderização sintética; não certifica Git/Core. |
| R-01 runtime dirigido | 15/15 PASS, exit 0; 518081 ms; 834 comandos registrados pelo harness. | Fontes/runner estáveis; 834 não conta todos os processos Git internos das chamadas CLI. Inclui ConPTY real. |
| R-02/R-03 antes | Cinco testes: um PASS e quatro FAIL, exit 1; 127701 ms externos; fonte estável. | Info/global e prévias reproduzidos; .gitignore foi controle. |
| R-02 prioridade | Um teste com sete controles nativos: PASS, exit 0; 10884 ms externos. | Negação, ordem e hierarquia, sem matcher simulado. |
| R-02/R-03 depois | Seis testes, seis PASS, zero FAIL/SKIP, exit 0; 145556 ms externos; fonte estável. | Fluxos e bytes descritos na evidência pública; não substitui a suíte ampla final. |
| R-05 tentativas dirigidas | before01: 1 FAIL; after03: 14 PASS/2 FAIL; after04: 1 PASS/1 FAIL; after05: 2/2 PASS. | Falhas e revisões estritas de oráculo/cleanup preservadas. Não se somam 14+2 como uma suíte atual. |
| Suíte headless full-final-01 | npm test exit 0; 227 casos, 223 PASS, zero FAIL, quatro SKIP; 1780650 ms externos. | Os 16 casos R-05 e seis R-02/R-03 passaram juntos nessa execução. |
| Infraestrutura infra-final-01 | 108/108 PASS, exit 0, 86479 ms externos. | Controles de runner, documentação, empacotamento e supervisão; não substitui execução do produto. |
| Typecheck typecheck-final-01 | exit 0, 3272 ms externos. | Compilação TypeScript, sem equivalência a teste runtime. |
| Ferramenta de arquivo, unidade | Quatro/quatro PASS, exit 0. | Filesystem real de fixtures: inventário/movimento/recusas/links. Não prova que o checkout já foi limpo. |
| Primeira matriz ampla | 361 selecionadas: 348 PASS, sete FAIL, seis ENV_BLOCKED; exit 1; 2954329 ms; 12941 comandos registrados. | Fontes/runner estáveis. Sete falhas diagnosticadas na infraestrutura; razões ambientais preservadas. A broad2 posterior concluiu 355 PASS/seis ENV_BLOCKED/zero FAIL. |
| Typecheck typecheck-final-02 | Exit 0, 2751 ms; domínio de 61 arquivos/fingerprint 1bd7 estável. | Execução posterior à correção de infraestrutura; separada do typecheck anterior. |
| Arquivo após correção de junctions | 6/6 PASS, exit 0, fonte estável. | Filesystem real, duas contraprovas antes preservadas; não comprova cleanup do checkout. |
| Build/smoke build-smoke-final-01 | PASS; três comandos do wrapper, sete fluxos, 82 comandos internos registrados, quatro snapshots. | Runtime compilado copiado sem dependências; Node/Git instalados. A cópia nova de A tem prova separada abaixo. |
| Suíte headless full-final-02 | 229 casos, 225 PASS, zero FAIL, quatro SKIP; exit 0; 1736013 ms externos. | 16 R05, seis R02/R03 e seis archive passaram juntos, sem somar snapshots. |
| Infraestrutura infra-final-02 | 111/111 PASS, zero FAIL/SKIP; exit 0; 85691 ms externos. | Domínio de 61 inputs estável; scripts/tests têm referência funcional de 173 distinta. |
| Matriz broad2 | 361 selecionadas: 355 PASS, seis ENV_BLOCKED, zero FAIL; exit 0; 1636261 ms; 12995 comandos registrados. | Fonte/runner estáveis, deltas vazios. Não certifica os seis recursos bloqueados nem compatibilidade universal. |
| Cópia nova do commit A | PASS; instalação pelo lockfile, typecheck/build/help/smoke/verificadores, 358 arquivos preservados. | 16 registros externos; sete fluxos/82 comandos/quatro snapshots. Não repetiu a suíte npm completa ou broad. |
| Arquivo de evidências | Verificado: 194 operações,613966 arquivos,2467819045 bytes. | 142 raízes+43 filhos+9 descendentes; dois contêineres sem payload e um run sem propriedade permanecem. Não são143 renames de raiz. |
| Código A no GitHub/main | Observado igual em 02:00:38.979Z, ahead/behind0/0. | A verificação final do commit documental B é posterior a esta atestação e será informada na entrega, separada do próprio hash do commit. |

No snapshot anterior, a suíte de 227 testes, infra 108 e typecheck compartilharam o domínio de 61 arquivos do produto e fingerprint `ce8f35a75b2a24d7177fe2bb3845a2d729aec768acbd92b0d2a0f2bfe407e718`, com manifests antes/depois idênticos. Esse domínio não inclui os scripts e testes próprios da infraestrutura; ce8f não identifica sozinho todos os inputs de compat:infra. A matriz possui manifests próprios de fonte/runner. Os quatro skips são três recusas de criação de symlink por permissão Windows/EPERM e um roundtrip Bash omitido pelo perfil win32. Git Bash existe: esse teste não o executa no Windows; não é ausência de Bash. Junctions e PowerShell/ConPTY têm provas separadas. O [JSON de validação](../../evidence/closure-2026-11-02/validation.json) publica nomes/motivos exatos, tempos, hashes e domínios, sem stdout pessoal.

O fingerprint R-02/R-03 depois é `2d696a97818b332028ba75726d39f35d4acfc944da3d7aa1b04eea2ff6f4481d`, no domínio dos seis arquivos listados no compacto. Não se compara diretamente a fingerprints de domínios maiores. Os testes finais possuem manifesto próprio de 61 inputs e o freeze funcional de 173 já publicado; qualquer correção funcional posterior exige nova verificação proporcional.

As sete falhas do primeiro broad foram três expectativas antigas de help de shells (TOOLS-011), dois localizadores de debugger antes do processo filho (RECOVERY-005/006), um literal histórico de AGENTS (HARNESS-021) e um cwd incorreto no novo HARNESS-025. A primeira rodada permanece exit 1; corrigir o harness não altera retroativamente seus resultados. A broad2 executou novamente todas as 361 selecionadas e terminou 355 PASS/seis ENV_BLOCKED/zero FAIL, exit 0. Os seis ENV_BLOCKED são limitações das sondas/recursos da instalação efetiva: `--resolved` e `--delete-merged` não foram anunciados no help; os builtins `history`/`url-parse` e os caminhos de `git-shell`/Gitweb CGI não foram encontrados pelas sondas descritas. As operações não foram certificadas por substitutos. Isso não declara ausência de Bash: a variante Bash executou e falhou por expectativa de help na primeira broad; passou no dirigido r2 e na broad2.

Comandos reproduzíveis dos testes dirigidos e seleções pertinentes:

```powershell
node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts
npm.cmd run typecheck
npm.cmd test
node scripts/git-compat/runner.mjs --suite broad --jobs 1 --seed 20261102 --list
node scripts/git-compat/runner.mjs --suite broad --jobs 1 --seed 20261102
# Comando da broad2 efetivamente executada:
node scripts/git-compat/runner.mjs --suite broad --jobs 2 --seed 20261102
npm.cmd run build:core
```

A matriz preserva os 344 IDs recebidos e contém 358 IDs de trabalho. O inventário carregado nesta fase lista 366 variantes implementadas e 386 linhas totais; broad seleciona 361 variantes/333 IDs e all seleciona 366/338. Esses números definem a **seleção**. A primeira execução broad terminou com 348 PASS, sete FAIL e seis ENV_BLOCKED; os 25 NOT_RUN da matriz total são cinco variantes não selecionadas e 20 SPEC_ONLY fora do escopo. Os resultados não se confundem com suporte. Optional/stress, SPEC_ONLY e itens fora do escopo conservam suas classificações. As sequências geradas usam os contratos versionados; MODEL-006/007 passaram na broad2. MODEL-008 permanece não exaustivo. Não certifica toda syscall, queda de energia, morte abrupta, plataforma ou interferência externa por ter alguns failpoints.

## Desempenho

O [benchmark real](../../evidence/closure-2026-11-02/performance.json) comparou a baseline externa 324 desta rodada com o Core atual em quatro casos sequenciais, três amostras por métrica/caso, dez arquivos da base e zero/uma Layer com dez arquivos. Setup foi excluído; as fontes Core e bundles têm manifests próprios. Essa baseline não é o conjunto 301 da primeira implementação.

| Métrica | Baseline mediana ms | Atual mediana ms | Diferença | Git por amostra |
| --- | ---: | ---: | ---: | --- |
| status, zero Layers | 2226,5343 | 1906,9385 | -14,354% | 61→53, exato |
| status, uma Layer | 3218,9408 | 3054,4860 | -5,109% | 81→73, exato |
| verifyExcludes, zero Layers | 0,0092 | 0,0080 | -0,0012 ms | 0→0 |
| verifyExcludes, uma Layer | 189,2511 | 189,2851 | +0,0340 ms | 4→4, exato |

O status deixou de fazer um refresh redundante antes do guard, que mantém a revalidação; as contagens mostram oito subprocessos a menos. O tempo também inclui diferenças da implementação e efeitos de cache/carga: três amostras não isolam causalidade, não são teste de significância ou promessa de latência/SLO. O microbenchmark de verifyExcludes chama um método interno real; status chama a API pública. Com uma Layer, ambas as versões já usaram um check-ignore para dez arquivos: nenhuma melhora nova de batching é demonstrada aqui.

As quatro auditorias reais tiveram scopes/chaves sintéticos idênticos, sem valores de configuração publicados e sem limitação de config de sistema observada. O git.ts da baseline e atual é idêntico e preserva a allowlist GIT_CONFIG_*. A ressalva genérica sobre adaptadores históricos no relatório bruto não é um defeito observado dessa baseline. Não se infere isolamento universal nem desempenho de outras plataformas.

## Preservação, limpeza e publicação

Projeto a versionar, extras operacionais legítimos, gerados reproduzíveis, evidências únicas e origem incerta são categorias diferentes. Ignorado ou untracked não significa lixo. Baseline/briefs/ZIPs/logs relevantes são preservados em arquivo externo novo e verificados antes da retirada; fontes novas e trabalho anterior não são removidos como resíduo. A demonstração, perfis, rascunhos e dados reais não são fixtures de cleanup.

Não se usa reset destrutivo, git clean abrangente, GC no checkout ou push forçado para fabricar igualdade. A main deve ser comparada à referência real consultada no servidor depois do envio, além de HEAD/origin/main e diferença esquerda/direita zero. A cópia nova de A reproduziu instalação/build/smoke e os pontos de entrada sem briefs ou arquivos ignorados anteriores. Isso não substitui a observação real do servidor nem a verificação final de B, que permanecem etapas separadas.

Nenhum laboratório foi aberto/desenvolvido e nenhum plugin visual foi implementado. Testes de terminal headless não são testes de janela Electron. Não há certificação de todos os Windows/Git, hooks/assinatura, filtros/LFS, topologias arbitrárias, todos os reparse points/long paths ou tolerância a energia. O desenvolvimento legítimo anterior do laboratório deve ser preservado/versionado conforme a revisão do conjunto, sem atribuição falsa ao fechamento.

## Índice público e protocolo de entrega

- [Estado e entrada para revisão](../../STATUS.md), [missão atual](../../decisions/2026-11-02-closure.md), [decisões recebidas](../../decisions/implementation-2026-11-02/README.md).
- [Matriz dos 27 requisitos JSON com código, testes e limites](requirements.json), [validação headless/infra/typecheck](../../evidence/closure-2026-11-02/validation.json), [R-01](../../evidence/closure-2026-11-02/review-expectations.json), [R-02/R-03](../../evidence/closure-2026-11-02/review-target-preview.json), [R-05](../../evidence/closure-2026-11-02/R05-RENAME.json), [performance](../../evidence/closure-2026-11-02/performance.json).
- [Core](../../../src/core/index.ts), [Git](../../../src/core/git.ts), [ignore](../../../src/core/ignore.ts), [rename](../../../src/core/layer-rename.ts), [resgate](../../../src/core/rescue.ts), [CLI](../../../src/cli/index.ts).
- [Contratos](../../IMPLEMENTATION-2026-11-02.md), [uso CLI](../../CLI.md), [migração](../../STORAGE-MIGRATION.md), [contribuição](../../../CONTRIBUTING.md), [guia headless](../../git-compat/README.md).

O código A foi criado, sua cópia nova passou instalação/build/smoke e sua igualdade no servidor foi observada. O payload classificado foi arquivado e verificado com preservações declaradas. Esta atestação antecede o commit documental B; seu SHA final e confronto remoto posterior são informados na entrega conforme a seção 9 da missão. R-01 dirigido, ConPTY, R-02/R-03, R-05 em conjunto, typecheck, infra, suíte headless e benchmark possuem as provas descritas acima; seus limites permanecem. Typecheck-final-02 e build-smoke-final-01 têm resultados próprios no novo compacto. A publicação final de B não é convertida em PASS antecipado por este texto. Os logs brutos classificados têm retenção externa verificada; o revisor poderá começar pelos links públicos e scripts do projeto, sem solicitar novo ZIP.
## Snapshot após as correções de infraestrutura

`full-final-02`, `infra-final-02` e `typecheck-final-02` conservaram o fingerprint `1bd7178ce452b116bf8759de41edec1fed21bbfde1dcf773f97a6aa64e41bed6` no domínio de 61 inputs. Full: 229 casos, 225 PASS, zero FAIL/cancel/todo, quatro SKIP; tempo Node 1735498,6694 ms e wrapper 1736013 ms. Infra: 111/111 PASS, zero FAIL/SKIP; tempo Node 85143,9393 ms e wrapper 85691 ms. Os motivos dos skips permanecem os três controles de symlink/EPERM e o roundtrip Bash omitido no perfil Windows, sem inferir ausência de Git Bash.

O manifesto funcional antes dessas verificações contém 173 arquivos de fontes, scripts, testes e configurações, com fingerprint `084267c2e9660a22fb79df668fbf84416d839d98382de45caac9c694a45133c2`. O SHA-256 dos bytes do JSON original é `3ee580862b9b9fb605376f50388a059b56f3966846394279ffae7314918277ea`; são rótulos diferentes. Documentação tem validação separada. A verificação depois de todas as suítes confirmou o mesmo fingerprint e os mesmos 173 paths/hashes; o manifesto após tem SHA-256 `96a95bf9f902dca36331b492cf44902dd0e6acf106d04f55387b07196c2ff9ed`.

As correções da ferramenta de arquivo passaram 6/6 testes juntos, também repetidos no full02. As contraprovas preservadas (1 FAIL e dois FAIL) observaram criação através de junction de destino e escrita/movimentação através de junction nos registros de operação. O fix recusa esses ancestrais antes de criar diretórios/registros ou mover fontes. Os sete dirigidos r2 passaram 7/7 e a broad2 posterior concluiu todas as 361 selecionadas, com 355 PASS/seis ENV_BLOCKED/zero FAIL.

Build/smoke executou três comandos do wrapper, sete fluxos reais, 82 comandos registrados e quatro snapshots. O runtime compilado foi copiado sem node_modules; Node/Git instalados continuam necessários. Não é instalação limpa nem cópia nova de commit. Consulte [build/smoke](../../evidence/closure-2026-11-02/build-smoke.json), [inputs funcionais](../../evidence/closure-2026-11-02/functional-inputs.json), [correções de infraestrutura](../../evidence/closure-2026-11-02/infrastructure-corrections.json) e a [primeira broad preservada](../../evidence/closure-2026-11-02/matrix-broad-first.json).

## Broad2 e estabilidade funcional

A [broad2 completa](../../evidence/closure-2026-11-02/matrix-broad.json) terminou exit 0, 361 selecionadas: 355 PASS, seis ENV_BLOCKED, zero FAIL, em 1636261 ms, jobs 2 e seed 20261102. Foram 12995 comandos registrados pelo harness; processos Git internos da CLI não são contados como invocações diretas do observador. O fingerprint de fonte foi `41c28c7186257d5d81b619a7b4f983a89334a8ff2c27c05d485e4ecab98355da` e o de runner `e6fbb13d52fdccf8e4d7428fc159f606a5bd6ec1ef841cfb90742c79b14db91f`, ambos estáveis durante a execução e com deltas vazios. A documentação posterior desta atualização não é relabelada como input daquela execução.

O catálogo permanece 358 IDs/386 linhas: 366 variantes implementadas, 20 SPEC_ONLY, known NONE nas 386 linhas. Os 25 NOT_RUN são cinco omitidas da seleção e 20 SPEC_ONLY fora do escopo. Os seis ENV_BLOCKED conservam seus recursos/motivos específicos; os quatro SKIP da suíte npm são uma dimensão distinta. O [manifesto funcional](../../evidence/closure-2026-11-02/functional-inputs.json) conferiu 173 arquivos iguais antes/depois de todas as suítes, fingerprint `084267c2e9660a22fb79df668fbf84416d839d98382de45caac9c694a45133c2`. Isso não comprova movimentação externa ou publicação. A instalação em cópia nova de A foi comprovada depois, em execução separada.

## Cópia nova do commit A

O commit de código **fc68d8cc1eb1faccf7dbb654eeb632b0caa9f4fb** foi clonado em raiz externa nova por Git oficial com **--no-local**, sem alternates; os três arquivos de objetos inspecionados tinham nlink 1. Os 358 arquivos versionados conservaram paths, tamanhos e SHA-256 antes/depois e o status final da cópia ficou limpo. Os inputs ignorados antigos estavam ausentes no início. A [prova estruturada](../../evidence/closure-2026-11-02/fresh-commit.json) conserva hashes do resultado, manifests, política de ambiente e runtime.

A instalação **npm ci --ignore-scripts --no-audit --no-fund --include=dev --include=optional**, typecheck, build, help compilado e verificadores públicos/git-compat terminaram exit 0. O smoke terminou PASS em 123977,7994 ms, sete fluxos, 82 comandos registrados e quatro snapshots. O wrapper externo tem 16 registros, incluindo clone e observadores Git. Não é uma nova execução integral de npm test ou broad. O I/O de arquivo externo simultâneo não autoriza comparação de latência.

O primeiro arquivo parou para inspeção após 34 movimentos verificados. A retomada completou142 movimentos de raiz; após recusas EPERM preservadas, a decomposição explícita em 43 filhos e 9 descendentes arquivou todos os 9731 arquivos restantes exatamente uma vez. As quatro operações históricas com erro continuam sem completion. O gate **ARCHIVE_PAYLOAD_VERIFIED_WITH_DECLARED_LOCAL_PRESERVATIONS_BEFORE_DOC_B** foi comprovado depois de A e antes de B. Não se atribui causa universal a EPERM nem se afirma arquivo concluído antes de A.

## Código A observado no servidor

A [observação real de A](../../evidence/closure-2026-11-02/code-checkpoint.json), concluída em **2026-11-03T02:00:38.979Z**, confirmou HEAD, origin/main após fetch, ls-remote e main pela API GitHub em **fc68d8cc1eb1faccf7dbb654eeb632b0caa9f4fb**, com ahead/behind 0/0. A árvore Git e cinco blobs públicos (STATUS, relatório, requisitos, Core e CLI) coincidiram com a API no ref A. Isso é evidência pontual do código publicado, não a certificação final do commit documental B. Naquela observação ainda havia um arquivo de entrada untracked; não se declarou checkout final limpo. Nenhuma execução de CI remoto foi observada.

## Arquivo verificado e preservações locais

O [compacto auditado](../../evidence/closure-2026-11-02/cleanup.json) registra **194 movimentos verificados**, com 613966 arquivos e 2467819045 bytes: 142 movimentos atômicos de raiz, 43 filhos de primeiro nível e 9 de segundo nível. Uma raiz lógica foi decomposta em dois níveis; não ocorreram143 renames de raiz. Os9731 arquivos/152732447 bytes desse conjunto foram cobertos exatamente uma vez, com 1108 diretórios originais cobertos e dois nós contêineres preservados.

O contêiner implementation retém somente delivery-final-01 vazio; portanto a raiz implementation não é literalmente vazia, embora ambos estejam sem payload. O run histórico sem prova de propriedade foi mantido. Os 17 metadados de raízes protegidas permaneceram iguais e dez extras operacionais legítimos foram mantidos, incluindo dependências, perfis e demonstrações. Não se apagaram metadados ou diretórios apenas para fabricar limpeza. As tentativas EPERM anteriores, seus manifests e recibos incompletos foram conservados; a unidade da variante namespace passou 6/6, mas sua tentativa real falhou e não demonstra a causa do erro. O arquivo final usou o módulo público fixado f78b, sem alterar o produto.

A auditoria independente conferiu os 194 pares de recibos, completions/inventory hashes e identidades pertinentes; ela não releu independentemente todo o conteúdo arquivado. O próprio módulo de arquivo fez hashing/inventário completo antes/depois de cada movimento. Os 173 inputs funcionais permaneceram byte a byte iguais à campanha e ao código A depois do arquivo, fingerprint **084267c2e9660a22fb79df668fbf84416d839d98382de45caac9c694a45133c2**; o SHA-256 do JSON após arquivo é **2eb89f7e768fde2fbd59217e147f5107b4408aad69b591be6be0fd64b734c87d**, uma medida distinta.

A [finalização estruturada](../../evidence/closure-2026-11-02/finalization.json) também conserva a revisão dos 358 arquivos preparados de A, 33 fontes prévias do laboratório intactas e o check de whitespace exit 2 com 1161 diagnósticos classificados, sem reescrever originais ou fontes testadas para obter verde. Esta revisão documental é preparada antes de B; o SHA final de B e a prova de igualdade HEAD/origin/main/servidor/API serão fornecidos após os passos reais da entrega, sem alegação antecipada de push ou CI remoto.
