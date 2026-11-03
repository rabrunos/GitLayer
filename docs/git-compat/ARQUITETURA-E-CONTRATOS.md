# Estado, requisitos e investigação técnica

**Contexto histórico — preparação/revisão de 18 e 19/10/2026:** o texto abaixo preserva o estado e as decisões daquelas rodadas. A implementação autorizada de 02/11/2026 segue os [contratos atuais do Core/CLI](../IMPLEMENTATION-2026-11-02.md), com evidências selecionadas no [relatório público de fechamento](../reports/2026-11-02-closure/REPORT.md). Os logs completos da implementação permanecem no arquivo externo verificado, conforme o relatório; o caminho original era `artifacts/implementation-2026-11-02/`. As restrições antigas de não editar produto e as descrições de auto-park ou proibição absoluta de Layer como branch não são os requisitos atuais. Evidência anterior não certifica as fontes novas.

Esta leitura se refere às fontes locais da preparação v2. O SHA e os fingerprints completos pertencem ao relatório da rodada. [ARCHITECTURE](../ARCHITECTURE.md) descreve a implementação; [SAFETY](../SAFETY.md) e [LIMITATIONS](../LIMITATIONS.md) descrevem seu envelope atual. Esses documentos não aprovam a arquitetura final nem proíbem sua evolução.

## Fatos do Git oficial

Blobs guardam conteúdo, trees associam nomes/modos/OIDs e commits ligam tree e pais. Refs são nomes mutáveis. Uma branch em `refs/heads/layer/x` continua branch para o executável Git oficial. O prefixo não cria um tipo especial nem bloqueia `switch`, `checkout` ou `worktree add`. [Layout v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/gitrepository-layout.adoc), [switch v2.53.0](https://git-scm.com/docs/git-switch/2.53.0).

O índice normalmente pertence ao worktree, não é uma cópia permanente por branch. `GIT_INDEX_FILE` seleciona outro arquivo de índice para o subprocesso. Stage 0 representa entrada resolvida; stages 1/2/3 representam base/ours/theirs de conflito. Flags como skip-worktree e extensões split/sparse afetam interpretação. Hash de bytes físicos do índice pode mudar por caches; compare também entradas semânticas. [Ambiente Git](https://git-scm.com/docs/git/2.53.0), [formato do índice v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/gitformat-index.adoc).

Push atualiza refs e envia os objetos necessários; não transporta staging só porque está em um índice. `--all` inclui branches sob `refs/heads/`, inclusive Layer; `--mirror` inclui refs sob `refs/`. Privacidade de metadados locais não garante que objetos ou refs não possam ser enviados. `.git` pode ser gitfile, e common-dir separa estado compartilhado de estado por worktree; descubra caminhos pelo Git em vez de supor pastas. [Push v2.53.0](https://git-scm.com/docs/git-push/2.53.0), [worktree v2.53.0](https://git-scm.com/docs/git-worktree/2.53.0).

## Implementação atual, sem mudanças nesta rodada

| Elemento | Leitura das fontes | Limite observável |
| --- | --- | --- |
| Core/CLI | `GitLayers` em `src/core/index.ts`; parser/dispatch em `src/cli/index.ts` | Headless; desktop compartilha Core, não é dependência do domínio |
| Descoberta e processo Git | `src/core/git.ts`: `git`, `discover`, `assertSupported` | Argv separado, Git instalado, políticas conservadoras próprias; não basta como oráculo independente |
| Refs Layer | `create/register/registerInternal` usam `refs/heads/layer/<nome>` | Criar Layer gera commit raiz vazio; não é branch derivada automaticamente da base |
| Stage Layer | Índice Git real privado e `write-tree` | `GIT_INDEX_FILE` por subprocesso; índice principal não recebe redirecionamento global |
| Retenção | `refs/git-layers/state/<id>` aponta para árvore; refs de transação preservam checkpoints | Árvores guardadas não são commits de usuário; retenção precisa de GC real em fixture |
| Armazenamento | Construtor usa `<gitDir>/git-layers`; JSON schema 1, indexes, reservations, shelves, captures, transactions, locks | Nenhuma migração para `layers` implementada/autorizada |
| Propriedade | Árvores, índices e reservas distinguem base/Layer/sem proprietário | Editar/criar no disco não escolhe proprietário; um caminho não pertence a duas origens ativas |
| Projeção | Arquivos físicos regulares, checkout-index e publicações validadas | Não é filesystem virtual ou checkout temporário de Layer |
| Exclusão nativa | Bloco delimitado em info/exclude e `check-ignore` | Ignore não protege contra Git forçado ou toda operação destrutiva |
| Concorrência/recuperação | Lock de coordenador; tokens, fingerprints, backups e journal | Não é transação ACID de Git+JSON+disco nem interceptação universal de programas externos |
| Operações avançadas | `assertSupported`/dispatch limitam topologias e complementos | Recusa conservadora é estado atual, não suporte nem veto permanente |

A inspeção de código não constitui resultado PASS. As linhas investigadas e os resultados nativos/Core/CLI ficam vinculados aos casos da rodada no relatório e nas evidências.

## Requisitos aprovados e perguntas em aberto

| ID | Direção desejada | Aplicação e lacuna |
| --- | --- | --- |
| U-01 | Git oficial como compatibilidade-alvo | Terceiros e SDKs adiados; GUI oficial inventariada sem execução |
| U-02 | Namespace `layer/<nome>` | Preservado; não substituir por `refs/layers/` |
| U-03 | Armazenamento chamado `layers`, minúsculo | Casos LAYOUT documentam destino ocupado/interrupção; nenhum migrador nesta rodada |
| U-04 | Reutilizar formatos, objetos, refs e índices reais | Testar índices com leitores/escritores Git; metadados próprios adicionais continuam questão técnica |
| U-05/U-06 | Produto independente de GUI, editor manual | Build/runner headless; não lançar Electron, Dev, Debug, UI ou empacotamento |
| U-07 | Ativar/desativar Layer em vez de selecioná-la como branch normal | Git nativo ainda trata namespace como branch; caracterizar bypass direto. Subcomando externo não altera seleção nativa |
| U-08 | `add .` normal na base não inclui indevidamente arquivos Layer | Observar índice principal e depois commit/tree em variante própria; `add -f` tem semântica distinta |
| U-09 | Revisar instruções e estado histórico | Histórico antes/depois preserva proteções e liberdade de engenharia futura |
| U-10 | Relatório portável para revisão | Markdown completo, JSON/JSONL, matriz de todos IDs, hashes, ZIP verificado |

Não foi escolhido mecanismo de interceptação: hooks, wrappers, fork, extensão ou integração upstream continuam alternativas de investigação futura. `post-checkout` roda depois da atualização; falha dele não prova bloqueio preventivo. Não se resolve U-07 por filtro visual ou mera instalação de `git-layer`. [Hooks v2.53.0](https://github.com/git/git/blob/v2.53.0/Documentation/githooks.adoc).

Também permanecem decisões futuras: política para comandos destrutivos explícitos, compartilhamento por worktree, retenção/expurgo, transferência de propriedade, conflitos e importação de refs. Não cabe ao harness implementar essas funcionalidades para produzir aprovação.

## Hipóteses a acompanhar

As suspeitas recebidas começam como HYPOTHESIS: doctor/export com metadados inválidos; lock deixado por morte real; snapshot/journal grande e interrupção; capture → off → cancel; ref Layer alterada/apagada/renomeada; checkout/clean/stash sobre ignorados; retenção por GC; custo de varreduras e journals acumulados. O relatório da execução registra confirmação, refutação contextual ou ausência de reprodução; esta ficha não antecipa o resultado.

Failpoint com `finally` e morte real são provas distintas. Uma operação recusada precisa de snapshots antes/depois. Uma saída não zero não garante ausência de efeitos. Um teste Git puro não certifica Core/CLI; um teste do wrapper não certifica invocação direta ao executável nativo.
