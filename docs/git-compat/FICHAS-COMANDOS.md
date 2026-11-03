# Fichas versionadas de comandos Git

Git observado: `2.53.0.windows.2`; catálogo fixado: `2.56.0`. São 161 fichas: 82 com notas semânticas dirigidas, 79 com triagem de efeitos e exame de opções incompleto, 0 só catálogo/fonte por revisar. Nenhuma ficha isolada significa PASS ou suporte do Git Layer.

Os rótulos de opções foram extraídos dos `.adoc` distribuídos com o Git instalado. Includes, opções herdadas, subcomandos e configuração não são expandidos; o número de rótulos não representa todas as opções do Git. As listas reviewed_options são focos de exame, não afirmação de execução. Seis fichas sem manual local receberam exame primário web dirigido; seus rótulos locais continuam zero e as fontes/limites são identificados. Os hashes e as diferenças de versão estão no [inventário](inventario-git.json). As fichas completas, com todos rótulos extraídos, estão em [JSON](fichas-comandos.json).

## Índice

- [git-add](#git-add)
- [git-am](#git-am)
- [git-annotate](#git-annotate)
- [git-apply](#git-apply)
- [git-archimport](#git-archimport)
- [git-archive](#git-archive)
- [git-backfill](#git-backfill)
- [git-bisect](#git-bisect)
- [git-blame](#git-blame)
- [git-branch](#git-branch)
- [git-bugreport](#git-bugreport)
- [git-bundle](#git-bundle)
- [git-cat-file](#git-cat-file)
- [git-check-attr](#git-check-attr)
- [git-check-ignore](#git-check-ignore)
- [git-check-mailmap](#git-check-mailmap)
- [git-check-ref-format](#git-check-ref-format)
- [git-checkout](#git-checkout)
- [git-checkout-index](#git-checkout-index)
- [git-cherry](#git-cherry)
- [git-cherry-pick](#git-cherry-pick)
- [git-citool](#git-citool)
- [git-clean](#git-clean)
- [git-clone](#git-clone)
- [git-column](#git-column)
- [git-commit](#git-commit)
- [git-commit-graph](#git-commit-graph)
- [git-commit-tree](#git-commit-tree)
- [git-config](#git-config)
- [git-count-objects](#git-count-objects)
- [git-credential](#git-credential)
- [git-credential-cache](#git-credential-cache)
- [git-credential-store](#git-credential-store)
- [git-cvsexportcommit](#git-cvsexportcommit)
- [git-cvsimport](#git-cvsimport)
- [git-cvsserver](#git-cvsserver)
- [git-daemon](#git-daemon)
- [git-describe](#git-describe)
- [git-diagnose](#git-diagnose)
- [git-diff](#git-diff)
- [git-diff-files](#git-diff-files)
- [git-diff-index](#git-diff-index)
- [git-diff-pairs](#git-diff-pairs)
- [git-diff-tree](#git-diff-tree)
- [git-difftool](#git-difftool)
- [git-fast-export](#git-fast-export)
- [git-fast-import](#git-fast-import)
- [git-fetch](#git-fetch)
- [git-fetch-pack](#git-fetch-pack)
- [git-filter-branch](#git-filter-branch)
- [git-fmt-merge-msg](#git-fmt-merge-msg)
- [git-for-each-ref](#git-for-each-ref)
- [git-for-each-repo](#git-for-each-repo)
- [git-format-patch](#git-format-patch)
- [git-format-rev](#git-format-rev)
- [git-fsck](#git-fsck)
- [git-gc](#git-gc)
- [git-get-tar-commit-id](#git-get-tar-commit-id)
- [git-grep](#git-grep)
- [git-gui](#git-gui)
- [git-hash-object](#git-hash-object)
- [git-help](#git-help)
- [git-history](#git-history)
- [git-hook](#git-hook)
- [git-http-backend](#git-http-backend)
- [git-http-fetch](#git-http-fetch)
- [git-http-push](#git-http-push)
- [git-imap-send](#git-imap-send)
- [git-index-pack](#git-index-pack)
- [git-init](#git-init)
- [git-instaweb](#git-instaweb)
- [git-interpret-trailers](#git-interpret-trailers)
- [git-last-modified](#git-last-modified)
- [git-log](#git-log)
- [git-ls-files](#git-ls-files)
- [git-ls-remote](#git-ls-remote)
- [git-ls-tree](#git-ls-tree)
- [git-mailinfo](#git-mailinfo)
- [git-mailsplit](#git-mailsplit)
- [git-maintenance](#git-maintenance)
- [git-merge](#git-merge)
- [git-merge-base](#git-merge-base)
- [git-merge-file](#git-merge-file)
- [git-merge-index](#git-merge-index)
- [git-merge-one-file](#git-merge-one-file)
- [git-merge-tree](#git-merge-tree)
- [git-mergetool](#git-mergetool)
- [git-mktag](#git-mktag)
- [git-mktree](#git-mktree)
- [git-multi-pack-index](#git-multi-pack-index)
- [git-mv](#git-mv)
- [git-name-rev](#git-name-rev)
- [git-notes](#git-notes)
- [git-p4](#git-p4)
- [git-pack-objects](#git-pack-objects)
- [git-pack-redundant](#git-pack-redundant)
- [git-pack-refs](#git-pack-refs)
- [git-patch-id](#git-patch-id)
- [git-prune](#git-prune)
- [git-prune-packed](#git-prune-packed)
- [git-pull](#git-pull)
- [git-push](#git-push)
- [git-quiltimport](#git-quiltimport)
- [git-range-diff](#git-range-diff)
- [git-read-tree](#git-read-tree)
- [git-rebase](#git-rebase)
- [git-receive-pack](#git-receive-pack)
- [git-reflog](#git-reflog)
- [git-refs](#git-refs)
- [git-remote](#git-remote)
- [git-repack](#git-repack)
- [git-replace](#git-replace)
- [git-replay](#git-replay)
- [git-repo](#git-repo)
- [git-request-pull](#git-request-pull)
- [git-rerere](#git-rerere)
- [git-reset](#git-reset)
- [git-restore](#git-restore)
- [git-rev-list](#git-rev-list)
- [git-rev-parse](#git-rev-parse)
- [git-revert](#git-revert)
- [git-rm](#git-rm)
- [git-send-email](#git-send-email)
- [git-send-pack](#git-send-pack)
- [git-sh-i18n](#git-sh-i18n)
- [git-sh-setup](#git-sh-setup)
- [git-shell](#git-shell)
- [git-shortlog](#git-shortlog)
- [git-show](#git-show)
- [git-show-branch](#git-show-branch)
- [git-show-index](#git-show-index)
- [git-show-ref](#git-show-ref)
- [git-sparse-checkout](#git-sparse-checkout)
- [git-stage](#git-stage)
- [git-stash](#git-stash)
- [git-status](#git-status)
- [git-stripspace](#git-stripspace)
- [git-submodule](#git-submodule)
- [git-svn](#git-svn)
- [git-switch](#git-switch)
- [git-symbolic-ref](#git-symbolic-ref)
- [git-tag](#git-tag)
- [git-unpack-file](#git-unpack-file)
- [git-unpack-objects](#git-unpack-objects)
- [git-update-index](#git-update-index)
- [git-update-ref](#git-update-ref)
- [git-update-server-info](#git-update-server-info)
- [git-upload-archive](#git-upload-archive)
- [git-upload-pack](#git-upload-pack)
- [git-url-parse](#git-url-parse)
- [git-var](#git-var)
- [git-verify-commit](#git-verify-commit)
- [git-verify-pack](#git-verify-pack)
- [git-verify-tag](#git-verify-tag)
- [git-version](#git-version)
- [git-whatchanged](#git-whatchanged)
- [git-worktree](#git-worktree)
- [git-write-tree](#git-write-tree)
- [gitk](#gitk)
- [gitweb](#gitweb)
- [scalar](#scalar)

## git-add

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Add file contents to the index.

Lê: disco; índice; ignore; atributos. Escreve: índice; blobs.

Prepara conteúdo no instante do add; edições posteriores são unstaged. Ignore exclui novos caminhos por padrão, não impede adição forçada. Não cria commit.

Opções/subcomandos em foco: `-A`, `-u`, `-f`, `-N`, `--renormalize`, `--chmod`, `--pathspec-from-file`, `--pathspec-file-nul`. Rótulos extraídos: 31; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-001, INIT-002, INDEX-001, INDEX-002, INDEX-003, INDEX-004, INDEX-005, INDEX-006, INDEX-007, INDEX-008, INDEX-009, INDEX-010, INDEX-011, INDEX-016, INDEX-017, INDEX-018, INDEX-020, COMMIT-014, MERGE-010, PATH-001, PATH-002, PATH-003, PATH-004, PATH-005, PATH-006, PATH-007, PATH-008, PATH-009, PATH-010, PATH-011, PATH-012, PATH-013, PATH-014, PATH-015, TOOLS-010, TOOLS-012, LAYER-001, LAYER-008, RECOVERY-003, RECOVERY-011, HARNESS-006, HARNESS-009, HOOK-012, MODEL-006, MODEL-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-add.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-add.adoc).

## git-am

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Apply a series of patches from a mailbox.

Lê: mbox; autoria/mensagem; índice/disco. Escreve: commits/refs; índice/disco; rebase-apply.

Difere de apply porque cria commits e preserva metadados de mensagem. Helpers/editor devem ser sintéticos; nenhuma conta ou email real.

Opções/subcomandos em foco: `--3way`, `--continue`, `--abort`, `--skip`, `--keep-cr`, `--signoff`. Rótulos extraídos: 52; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-005, PATCH-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-am.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-am.adoc).

## git-annotate

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Annotate file lines with commit information.

Lê: commits e linhas do arquivo. Escreve: stdout de anotação.

Interface de anotação relacionada a blame; atribuição de linha depende de opções de renome/cópia e revisão selecionada.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-annotate.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-annotate.adoc).

## git-apply

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Apply a patch to files and/or to the index.

Lê: patch; índice/disco; blobs para três vias. Escreve: índice e/ou disco; rejeições se solicitado.

Check verifica aplicabilidade sem aplicar; cached usa só índice. Três vias pode criar conflito e reject pode deixar efeitos parciais. Capturar ambos estados.

Opções/subcomandos em foco: `--check`, `--index`, `--cached`, `--3way`, `--reverse`, `--reject`, `--binary`. Rótulos extraídos: 39; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-001, PATCH-002, PATCH-003, PATCH-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-apply.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-apply.adoc).

## git-archimport

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY.

Lê: Arquivos, branches e metadados Arch via tla. Escreve: Objetos, branches e tags Git; temporários.

Converte um projeto; merges dependem de ancestrais disponíveis. Parte dos metadados de troca de patches se perde.

Opções/configuração dirigidas: `-f`: acelera, sem renomes de diretórios/permissões; `-T`: tag por commit; `-D`: amplia ancestrais; `-a`: autoregistra repositórios remotos; `-t`: define temporários.

Riscos: -a pode acessar rede; raízes incompatíveis são recusadas.

Versão/capacidade: Histórico do manual sem alterações 2.53–2.56; isto não prova igualdade de implementação nem mínimos de opções. Última alteração documental indicada: 2.35.0.

Roteiros relacionados: LEGACY-007. Exame dirigido; não integral. Sem execução adicional, disponibilidade/serviços não inferidos; escopo e IDs originais preservados.

Fonte consultada: [manual primário e histórico](https://git-scm.com/docs/git-archimport). O link upstream original permanece no JSON; sua abertura raw falhou e não conta como leitura.


## git-archive

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create an archive of files from a named tree.

Lê: tree/revisão; atributos export-ignore/export-subst. Escreve: arquivo tar/zip ou stdout.

Exporta conteúdo de tree, não staging/JSON privado automaticamente. Arquivo de distribuição não é backup completo do repositório.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 16; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-008, PROTO-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-archive.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-archive.adoc).

## git-backfill

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Download missing objects in a partial clone.

Lê: promisor e objetos faltantes em partial clone. Escreve: objetos baixados e packs.

Preenche objetos ausentes; cenário só pode usar servidor/promisor local controlado e não certificar suporte do Core pela presença do comando.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-backfill.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-backfill.adoc).

## git-bisect

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Use binary search to find the commit that introduced a bug.

Lê: grafo e resultados good/bad. Escreve: refs/estado bisect; HEAD/disco durante seleção.

Busca por regressão muda revisões e pode executar teste sintético. Estado de bisect externo e Layers exige caracterização separada.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-bisect.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-bisect.adoc).

## git-blame

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show what revision and author last modified each line of a file.

Lê: histórico; arquivo; revisão e line range. Escreve: stdout de autoria/revisão por linha.

Renomes/cópias e conteúdo não commitado afetam atribuição. Não é autoridade de propriedade Layer de um caminho.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 11; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-blame.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-blame.adoc).

## git-branch

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: List, create, or delete branches.

Lê: refs; upstream; configuração; histórico. Escreve: refs; reflogs; configuração quando renomeia/exclui.

Prefixo Layer aparece como branch nativa. Renomear/apagar externamente requer caracterização de referência esperada pelo registro, sem reconciliação inventada.

Opções/subcomandos em foco: `--list`, `--show-current`, `-m`, `-M`, `-d`, `-D`, `--set-upstream-to`. Rótulos extraídos: 49; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-001, BRANCH-009, BRANCH-010, BRANCH-011, BRANCH-012, BRANCH-015, BRANCH-019, STASH-013, LAYER-015. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-branch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-branch.adoc).

## git-bugreport

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Collect information for user to file a bug report.

Lê: versão/configuração e informações de diagnóstico. Escreve: relatório em arquivo.

Pode coletar dados locais. Somente fixture/conteúdo sintético; não exportar inventário pessoal no pacote de evidências.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 7; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-bugreport.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-bugreport.adoc).

## git-bundle

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Move objects and refs by archive.

Lê: refs/objetos; pacote bundle. Escreve: arquivo bundle; objetos/refs quando consumido.

Pode ter pré-requisitos e conjunto limitado de refs. Verificação de bundle não certifica persistência de JSON/índices privados Layer que não são transportados automaticamente.

Opções/subcomandos em foco: `create`, `verify`, `list-heads`, `unbundle`. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-bundle.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-bundle.adoc).

## git-cat-file

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Provide contents or details of repository objects.

Lê: objetos e revisões. Escreve: stdout; nenhuma alteração solicitada.

Cat-file verifica tipo/conteúdo; ls-tree verifica nomes/modos/OIDs da tree. Opções variam por comando. Blob canônico e arquivo com CRLF podem ter bytes diferentes legitimamente.

Opções/subcomandos em foco: `-p`, `-t`, `-s`, `--batch`, `--batch-check`, `-z`, `-r`. Rótulos extraídos: 25; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-009, INDEX-019, COMMIT-001, COMMIT-007, COMMIT-008, COMMIT-014, MERGE-002, MERGE-014, MERGE-015, REWRITE-004, REWRITE-008, STASH-003, REMOTE-010, REMOTE-016, PATH-009, INSPECT-012, OBJECT-001, OBJECT-002, OBJECT-004, OBJECT-005, OBJECT-010, LAYER-003, LAYER-010, LAYOUT-009, LAYOUT-012, HARNESS-005, MODEL-005, MODEL-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-cat-file.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-cat-file.adoc).

## git-check-attr

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Display gitattributes information.

Lê: atributos do índice/disco/tree e configuração. Escreve: stdout/status.

Text/EOL/filtros/encoding mudam conversão; consultas precisam contexto explícito. Presença de filtro configurado não significa execução aprovada pelo Core conservador.

Opções/subcomandos em foco: `--all`, `--cached`, `--source`, `--stdin`, `-z`. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-014, PATH-007, PATH-008, PATH-012, PATH-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-check-attr.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-check-attr.adoc).

## git-check-ignore

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Debug gitignore / exclude files.

Lê: caminhos; índice; ignore hierárquico/configuração. Escreve: stdout/status.

Distingue regra, origem, linha e efeito. --no-index altera tratamento de tracked. info/exclude é local e negação mais específica pode mudar o resultado.

Opções/subcomandos em foco: `--verbose`, `--non-matching`, `--no-index`, `--stdin`, `-z`. Rótulos extraídos: 9; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-005, BRANCH-005, WORKTREE-006, PATH-014, HARNESS-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-check-ignore.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-check-ignore.adoc).

## git-check-mailmap

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show canonical names and email addresses of contacts.

Lê: stdin/argv e .mailmap. Escreve: stdout de identidade canônica.

Canonicalização de nomes/emails para apresentação não altera autoria persistida nos objetos originais.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-check-mailmap.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-check-mailmap.adoc).

## git-check-ref-format

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Ensures that a reference name is well formed.

Lê: nome de ref em argv. Escreve: stdout/status.

Valida sintaxe; não cria ref nem garante que ela exista ou que checkout seja permitido no contexto.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-012, REF-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-check-ref-format.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-check-ref-format.adoc).

## git-checkout

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Switch branches or restore working tree files.

Lê: refs; trees; índice; arquivos; configuração. Escreve: HEAD; índice; disco; reflog.

Seleção de branch não conhece a convenção Layer. Checkout também restaura caminhos; switch é dedicado à troca. Flags destrutivas exigem variantes próprias e snapshots após erro.

Opções/subcomandos em foco: `--detach`, `--orphan`, `--force`, `--merge`. Rótulos extraídos: 35; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-002, BRANCH-004, BRANCH-005, BRANCH-006, BRANCH-008, BRANCH-013, BRANCH-016, BRANCH-018, BRANCH-020, MERGE-010, TOOLS-012, HOOK-005, MODEL-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-checkout.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-checkout.adoc).

## git-checkout-index

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Copy files from the index to the working tree.

Lê: índice; blobs; atributos. Escreve: disco ou arquivos temporários.

Materializa o índice, sem selecionar branch. Prefixo/temporários permitem preparar projeção; sobrescrita é uma escolha explícita, não prova de preservação de proprietário.

Opções/subcomandos em foco: `--all`, `--force`, `--prefix`, `--temp`, `--stage`, `--stdin`, `-z`. Rótulos extraídos: 16; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-008, RECOVERY-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-checkout-index.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-checkout-index.adoc).

## git-cherry

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Find commits yet to be applied to upstream.

Lê: históricos upstream/head e patch equivalence. Escreve: stdout de commits equivalentes ou exclusivos.

Comparação por patch não prova identidade de commits, pais ou metadados. Não fundir com cherry-pick.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-cherry.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-cherry.adoc).

## git-cherry-pick

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Apply the changes introduced by some existing commits.

Lê: commits/pais; HEAD; índice/disco; sequencer. Escreve: commits/refs; índice/disco; estado de conflito/continuação.

Rebase reaplica história, cherry-pick reaplica mudança, revert cria mudança inversa. As opções são específicas de cada comando. Não inferir suporte do produto por comportamento nativo.

Opções/subcomandos em foco: `--continue`, `--abort`, `--skip`, `--quit`, `--no-commit`. Rótulos extraídos: 22; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REWRITE-007, REWRITE-008, REWRITE-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-cherry-pick.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-cherry-pick.adoc).

## git-citool

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_GUI_INVENTORY_ONLY.

Resumo NAME do manual local: Graphical alternative to git-commit.

Lê: índice/disco/configuração/hooks. Escreve: GUI e commit/índice quando acionado.

GUI oficial inventariada sem execução. Preservar o item no catálogo não o torna teste headless aprovado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-citool.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-citool.adoc).

## git-clean

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Remove untracked files from the working tree.

Lê: disco; índice; ignore. Escreve: remove arquivos/diretórios não rastreados.

Dry-run lista; -x inclui ignorados; -X remove apenas ignorados. Diretórios e repositórios aninhados têm regras próprias. Nenhuma ref/backup é criado para bytes removidos.

Opções/subcomandos em foco: `-n`, `-f`, `-d`, `-x`, `-X`, `-e`. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: STASH-010, STASH-011, STASH-012, HARNESS-006, MODEL-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-clean.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-clean.adoc).

## git-clone

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Clone a repository into a new directory.

Lê: repositório origem; refs/objetos; configuração explícita. Escreve: novo repositório; refs; índice/disco conforme modo.

Clones locais podem usar hardlinks ou copiar por otimização. Para GC/corrupção escolher isolamento, sem empréstimo de objetos pessoais. Bare/mirror não equivalem a worktree comum.

Opções/subcomandos em foco: `--bare`, `--mirror`, `--no-local`, `--no-hardlinks`, `--depth`, `--filter`, `--single-branch`. Rótulos extraídos: 48; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-005, INIT-006, INIT-007, INIT-008, INIT-009, INIT-010, LAYOUT-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-clone.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-clone.adoc).

## git-column

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Display data in columns.

Lê: linhas stdin e opções de layout. Escreve: stdout em colunas.

Helper de apresentação. Largura/alinhamento não é oráculo para parsing de estado Git; prefira saída estruturada do comando origem.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 7; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-column.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-column.adoc).

## git-commit

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Record changes to the repository.

Lê: índice; HEAD; identidade; configuração; hooks. Escreve: tree/commit; HEAD/ref; reflog; estado de operação.

Commit normal usa o índice; -a prepara tracked, não todo arquivo novo. Amend cria outro commit. Testar árvore, pais e autoria separados de mensagens.

Opções/subcomandos em foco: `-a`, `--amend`, `--only`, `--include`, `--allow-empty`, `--no-verify`, `-m`. Rótulos extraídos: 56; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-001, INDEX-011, INDEX-017, COMMIT-001, COMMIT-002, COMMIT-003, COMMIT-004, COMMIT-005, COMMIT-006, COMMIT-007, COMMIT-008, COMMIT-009, COMMIT-010, COMMIT-011, COMMIT-012, COMMIT-014, LAYER-001, RECOVERY-003, HOOK-001, HOOK-002, HOOK-003, HOOK-010, HOOK-011, HOOK-012, MODEL-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-commit.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-commit.adoc).

## git-commit-graph

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Write and verify Git commit-graph files.

Lê: commits e commit-graphs existentes. Escreve: arquivo commit-graph; diagnóstico em verify.

Índice auxiliar de aceleração. Alterá-lo não redefine OIDs; testar integridade separada de desempenho.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-commit-graph.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-commit-graph.adoc).

## git-commit-tree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create a new commit object.

Lê: tree; pais; mensagem; identidade. Escreve: objeto commit; stdout OID.

Plumbing cria objeto sem atualizar branch automaticamente. Pais múltiplos definem merge; nenhum pai define raiz. O produto usa update-ref condicionado em etapa separada.

Opções/subcomandos em foco: `-p`, `-m`, `-F`, `-S`. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-commit-tree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-commit-tree.adoc).

## git-config

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Get and set repository or global options.

Lê: arquivos config e includes por escopo. Escreve: configuração explicitamente selecionada; stdout em leitura.

Config global/system devem ser substituídas no ambiente de fixture. Não executar alias/helper desconhecido só por estar configurado. Includes exigem limites de caminho claros.

Opções/subcomandos em foco: `get`, `set`, `list`, `--local`, `--file`, `--show-origin`, `--show-scope`. Rótulos extraídos: 48; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-006, ENV-007, ENV-008, ENV-009, ENV-012, ENV-014, INIT-011, REMOTE-001, WORKTREE-006, PATH-012, HARNESS-004, HARNESS-022, HOOK-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-config.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-config.adoc).

## git-count-objects

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Count unpacked number of objects and their disk consumption.

Lê: object store e packs. Escreve: stdout de contagem/tamanho.

Mede representação física e armazenamento; não determina sozinho quantidade de conteúdo do usuário ou retenção necessária.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-010, REF-015, HARNESS-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-count-objects.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-count-objects.adoc).

## git-credential

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Retrieve and store user credentials.

Lê: descrição de protocolo e helpers configurados. Escreve: stdin/stdout dos helpers; credenciais conforme ação.

fill/approve/reject têm efeitos distintos. Testar somente helper e valores sintéticos, sem consultar cofre pessoal.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-credential.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-credential.adoc).

## git-credential-cache

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Helper to temporarily store passwords in memory.

Lê: protocolo de credenciais e socket. Escreve: daemon/socket e segredo em memória.

É helper com processo/estado, não função pura sem efeitos. Isolar socket e encerrar só descendentes próprios.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-credential-cache.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-credential-cache.adoc).

## git-credential-store

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Helper to store credentials on disk.

Lê: protocolo e arquivo selecionado. Escreve: credenciais em arquivo texto.

Não usar arquivo padrão pessoal. Fixture explícita prova mecanismo, sem credenciais reais nem alegação de segurança de cofre.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-credential-store.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-credential-store.adoc).

## git-cvsexportcommit

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY.

Lê: Commit/pai Git e checkout CVS. Escreve: Checkout CVS; commit CVS opcional.

Exporta um changeset; merge exige pai explícito. Por padrão verifica checkout e não autocommita.

Opções/configuração dirigidas: `-c`: commita CVS após aplicação limpa; `-u`: atualiza arquivos CVS antes; `-W`: reseta checkout compartilhado ao pai; `-p`: patch sem fuzz; `-f`: ignora desatualização; `-w`: seleciona checkout.

Riscos: -W altera disco; -f relaxa proteção; -c publica no CVS.

Versão/capacidade: Histórico do manual sem alterações 2.53–2.56; isto não prova igualdade de implementação nem mínimos de opções. Última alteração documental indicada: 2.35.0.

Roteiros relacionados: LEGACY-005. Exame dirigido; não integral. Sem execução adicional, disponibilidade/serviços não inferidos; escopo e IDs originais preservados.

Fonte consultada: [manual primário e histórico](https://git-scm.com/docs/git-cvsexportcommit). O link upstream original permanece no JSON; sua abertura raw falhou e não conta como leitura.


## git-cvsimport

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY.

Lê: Logs/revisões CVS via cvsps 2. Escreve: Commits/branches/tags Git e mapas auxiliares.

Importação inicial ou incremental; cvsps≥2.1, incompatível com cvsps≥3. Evitar trabalho próprio nas branches importadas.

Opções/configuração dirigidas: `-i`: preserva índice/worktree; `-r`: separa branches de entrada; `-A`: mapeia autores; `-R`: grava cvs-revisions; `-z`: ajusta janela temporal.

Riscos: Timestamps, imports vendor, branches e tags podem produzir conversão incorreta.

Versão/capacidade: Histórico do manual sem alterações 2.53–2.56; isto não prova igualdade de implementação nem mínimos de opções. Última alteração documental indicada: 2.43.1.

Roteiros relacionados: LEGACY-005. Exame dirigido; não integral. Sem execução adicional, disponibilidade/serviços não inferidos; escopo e IDs originais preservados.

Fonte consultada: [manual primário e histórico](https://git-scm.com/docs/git-cvsimport). O link upstream original permanece no JSON; sua abertura raw falhou e não conta como leitura.


## git-cvsserver

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY.

Lê: Protocolo CVS, branches/objetos Git e configuração. Escreve: Commits Git, banco de revisões CVS e logs.

Emula CVS; branches Git viram módulos. Clientes não criam tags/branches nem fazem merges Git.

Opções/configuração dirigidas: `--base-path`: prefixa CVSROOT; `--strict-paths`: restringe diretórios; `--export-all`: dispensa gitcvs.enabled, exige allowlist; `gitcvs.enabled`: habilita acesso; `gitcvs.dbName`: localiza banco DBI.

Riscos: Regenerar banco após merges pode mudar numeração CVS; autenticação/serviço exigem administração.

Versão/capacidade: Histórico do manual sem alterações 2.53–2.56; isto não prova igualdade de implementação nem mínimos de opções. Última alteração documental indicada: 2.50.0.

Roteiros relacionados: LEGACY-006. Exame dirigido; não integral. Sem execução adicional, disponibilidade/serviços não inferidos; escopo e IDs originais preservados.

Fonte consultada: [manual primário e histórico](https://git-scm.com/docs/git-cvsserver). O link upstream original permanece no JSON; sua abertura raw falhou e não conta como leitura.


## git-daemon

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: A really simple server for Git repositories.

Lê: refs/objetos e configuração de export. Escreve: servidor e conexões de transporte.

Somente loopback e raiz sintética exclusiva quando executado. Nunca expor porta pública ou serviço persistente.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 28; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-003. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-daemon.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-daemon.adoc).

## git-describe

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Give an object a human readable name based on an available ref.

Lê: grafo e refs/tags candidatas. Escreve: stdout de nome derivado.

Nome depende de refs disponíveis e opções; não substitui OID exato na trilha de auditoria.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 14; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-describe.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-describe.adoc).

## git-diagnose

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Generate a zip archive of diagnostic information.

Lê: estado Git e diagnóstico do ambiente. Escreve: arquivo ZIP diagnóstico.

ZIP pode conter configuração e caminhos; não anexar coleta pessoal. É diagnóstico, não exportação de recuperação Layer.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 5; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-diagnose.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-diagnose.adoc).

## git-diff

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show changes between commits, commit and working tree, etc.

Lê: pares de trees/índice/disco conforme variante. Escreve: stdout/status; helpers opcionais controlados.

Diff-files compara índice/disco; diff-index árvore/contexto; diff-tree árvores. --exit-code 1 indica diferenças. Usar --cached quando o alvo é stage, sem confundir com disco.

Opções/subcomandos em foco: `--cached`, `--name-status`, `--exit-code`. Rótulos extraídos: 7; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-008, INDEX-009, INDEX-010, INDEX-013, INDEX-015, COMMIT-004, MERGE-007, STASH-005, WORKTREE-012, PATH-005, PATH-013, INSPECT-002, INSPECT-003, INSPECT-004, PATCH-001, PATCH-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-diff.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-diff.adoc).

## git-diff-files

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compares files in the working tree and the index.

Lê: pares de trees/índice/disco conforme variante. Escreve: stdout/status; helpers opcionais controlados.

Diff-files compara índice/disco; diff-index árvore/contexto; diff-tree árvores. --exit-code 1 indica diferenças. Usar --cached quando o alvo é stage, sem confundir com disco.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 7; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-diff-files.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-diff-files.adoc).

## git-diff-index

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compare a tree to the working tree or index.

Lê: pares de trees/índice/disco conforme variante. Escreve: stdout/status; helpers opcionais controlados.

Diff-files compara índice/disco; diff-index árvore/contexto; diff-tree árvores. --exit-code 1 indica diferenças. Usar --cached quando o alvo é stage, sem confundir com disco.

Opções/subcomandos em foco: `--cached`, `-z`. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-diff-index.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-diff-index.adoc).

## git-diff-pairs

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compare the content and mode of provided blob pairs.

Lê: pares de OID/modo via entrada. Escreve: stdout/status de diff.

Compara pares de blobs; não descobre por si o estado do worktree ou ownership. Manter separação entre objeto e arquivo físico.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-diff-pairs.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-diff-pairs.adoc).

## git-diff-tree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compares the content and mode of blobs found via two tree objects.

Lê: pares de trees/índice/disco conforme variante. Escreve: stdout/status; helpers opcionais controlados.

Diff-files compara índice/disco; diff-index árvore/contexto; diff-tree árvores. --exit-code 1 indica diferenças. Usar --cached quando o alvo é stage, sem confundir com disco.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-diff-tree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-diff-tree.adoc).

## git-difftool

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show changes using common diff tools.

Lê: pares de revisão/caminho e configuração. Escreve: helper externo temporários/GUI conforme tool.

Pode iniciar aplicação externa; inventariar sem abrir GUI. Helper sintético não certifica ferramenta de terceiros.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 19; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-001. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-difftool.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-difftool.adoc).

## git-fast-export

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Git data exporter.

Lê: histórico ou stream de comandos/bytes. Escreve: stream exportado ou objetos/refs importados.

Formato de intercâmbio cobre trees/commits/refs, não JSON privado automaticamente. Importação pode atualizar refs; fixture exclusiva e entrada sintética controlada.

Opções/subcomandos em foco: `--all`, `--export-marks`, `--import-marks`. Rótulos extraídos: 19; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-fast-export.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-fast-export.adoc).

## git-fast-import

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Backend for fast Git data importers.

Lê: histórico ou stream de comandos/bytes. Escreve: stream exportado ou objetos/refs importados.

Formato de intercâmbio cobre trees/commits/refs, não JSON privado automaticamente. Importação pode atualizar refs; fixture exclusiva e entrada sintética controlada.

Opções/subcomandos em foco: `--all`, `--export-marks`, `--import-marks`, `--done`. Rótulos extraídos: 21; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-fast-import.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-fast-import.adoc).

## git-fetch

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Download objects and refs from another repository.

Lê: remoto local de fixture; refs/refspecs; objetos. Escreve: objetos; remote-tracking; FETCH_HEAD; shallow conforme opções.

Busca sem integrar no worktree normal. Tags/prune/refspecs mudam alcance; lazy-fetch/partial clone são capacidades separadas. Não utilizar origin do projeto.

Opções/subcomandos em foco: `--prune`, `--tags`, `--no-tags`. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-008, REMOTE-002, REMOTE-003, REMOTE-004, REMOTE-013, REMOTE-015, PATCH-009, PROTO-003, PROTO-004, PROTO-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-fetch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-fetch.adoc).

## git-fetch-pack

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Receive missing objects from another repository.

Lê: anúncio e objetos do servidor. Escreve: objetos/packs locais e saída de refs.

Papel cliente de baixo nível; atualização de tracking feita por fetch é etapa distinta. Endpoint só local/loopback.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 18; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-001. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-fetch-pack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-fetch-pack.adoc).

## git-filter-branch

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Rewrite branches.

Lê: grafo; filtros shell; índice/trees. Escreve: histórico reescrito; refs e cópias originais.

Reescrita nativa destrutiva com execução de filtros. Fixture deve controlar comandos e retenção; não introduzir esse mecanismo no produto.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 15; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-filter-branch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-filter-branch.adoc).

## git-fmt-merge-msg

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Produce a merge commit message.

Lê: descrições de pais e FETCH_HEAD-like stdin. Escreve: mensagem de merge em stdout.

Gera texto, não executa merge nem cria commit; autoria/pais/tree precisam verificações próprias.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 9; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-fmt-merge-msg.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-fmt-merge-msg.adoc).

## git-for-each-ref

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Output information on each ref.

Lê: refs; objetos para campos/peeling. Escreve: stdout; nenhuma alteração pedida.

Consultar nomes lógicos/OIDs evita depender de refs soltas. --verify é de show-ref; filtros/formatos dependem do comando. Nomes Layer continuam visíveis no namespace heads.

Opções/subcomandos em foco: `--format`, `--sort`, `--count`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-019, REF-001, LAYOUT-009, LAYOUT-012, HARNESS-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-for-each-ref.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-for-each-ref.adoc).

## git-for-each-repo

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Run a Git command on a list of repositories.

Lê: configuração com lista de caminhos e argv Git. Escreve: efeitos do comando executado em cada repositório.

Cada caminho deve pertencer à raiz de fixture. Não permitir configuração pessoal expandir seleção para repositórios reais.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-for-each-repo.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-for-each-repo.adoc).

## git-format-patch

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Prepare patches for e-mail submission.

Lê: faixa de commits e metadados. Escreve: arquivos patch/mbox ou stdout.

Preserva informação para intercâmbio de commits; aplicar com am difere de aplicar patch de worktree. Não envia email por si.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 57; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-005, LEGACY-001. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-format-patch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-format-patch.adoc).

## git-format-rev

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Lê: revisões/texto stdin; objetos; notes. Escreve: stdout formatado.

Novo no recorte entre 2.53 e 2.56; experimental, ausente local. Modos revs/text diferem; NUL e registros repetidos são contratos próprios, sem travessia obrigatória.

Opções/subcomandos em foco: `--stdin-mode`, `--format`, `--null-output`, `--null-input`, `-z`, `--notes`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Added to upstream catalogue after 2.53.0 and by 2.56.0; local builtin absent. Exact introducing release not asserted.

Roteiros relacionados: INSPECT-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-format-rev.adoc).

## git-fsck

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Verifies the connectivity and validity of the objects in the database.

Lê: objetos; refs; reflogs; índices considerados. Escreve: diagnóstico; lost-found quando solicitado.

Integridade e alcançabilidade são perguntas distintas. Objeto dangling pode ser válido; falta/corrupção confirmada precisa OID e diagnóstico estritos, sem reduzir erro a uma frase.

Opções/subcomandos em foco: `--full`, `--strict`, `--unreachable`, `--no-reflogs`, `--lost-found`. Rótulos extraídos: 17; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-010, STASH-013, REF-008, REF-010, REF-015, LAYOUT-005, RECOVERY-014, MODEL-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-fsck.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-fsck.adoc).

## git-gc

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Cleanup unnecessary files and optimize the local repository.

Lê: refs/reflogs; objetos; packs; expiração. Escreve: packs/índices; remoção de objetos segundo alcance e política.

Índice alternativo sozinho não é garantia universal de retenção para produto. Testar checkpoints alcançáveis e objetos necessários com GC real só na fixture sem alternates externos.

Opções/subcomandos em foco: `--prune`, `--expire`, `--cruft`, `--aggressive`, `-a`, `-d`, `-n`. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-008, RECOVERY-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-gc.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-gc.adoc).

## git-get-tar-commit-id

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Extract commit ID from an archive created using git-archive.

Lê: tar gerado por archive em stdin. Escreve: OID extraído em stdout.

Recupera metadado do arquivo quando presente, não reconstrói refs/índices/metadados Layer.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-get-tar-commit-id.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-get-tar-commit-id.adoc).

## git-grep

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Print lines matching a pattern.

Lê: disco/índice/trees conforme modo e padrões. Escreve: stdout/status de busca.

Distinguir --cached e tree de busca no disco. Status de nenhuma correspondência não é falha de integridade do repositório.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 74; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-grep.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-grep.adoc).

## git-gui

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_GUI_INVENTORY_ONLY.

Resumo NAME do manual local: A portable graphical interface to Git.

Lê: repositório/configuração/estado. Escreve: GUI; índice/commits conforme interação.

GUI oficial apenas inventariada. Não lançar nem contabilizar sua existência como execução funcional.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-gui.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-gui.adoc).

## git-hash-object

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compute object ID and optionally create an object from a file.

Lê: bytes stdin/disco; atributos quando escolhidos. Escreve: objeto somente com -w.

OID depende de tipo e conteúdo canônico. Sem -w calcula sem persistir. Transformações de atributos precisam ser controladas para comparar blob com bytes no disco.

Opções/subcomandos em foco: `-w`, `--stdin`, `--stdin-paths`, `--path`, `--no-filters`, `-t`. Rótulos extraídos: 7; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATH-009, OBJECT-001, LAYER-004, LAYER-013, RECOVERY-005, RECOVERY-007, RECOVERY-008, RECOVERY-010, MODEL-001, MODEL-003, MODEL-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-hash-object.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-hash-object.adoc).

## git-help

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Display help information about Git.

Lê: inventário/documentação instalada. Escreve: stdout; viewer somente quando pedido.

Usar listagens -a/-g/interfaces para inventário, sem abrir browser/viewer do usuário. Ajuda não certifica operação do comando.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 17; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-001, ENV-002, ENV-008, ENV-011, TOOLS-011, LEGACY-008, HARNESS-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-help.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-help.adoc).

## git-history

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Lê: grafo; índice para fixup; mensagem. Escreve: objetos; branches descendentes; índice/disco quando HEAD reescrito.

Novo no catálogo entre 2.53 e 2.56; experimental e ausente no builtin local. Dry-run ainda escreve objetos. Default pode atualizar várias branches; não executado nesta instalação.

Opções/subcomandos em foco: `drop`, `fixup`, `reword`, `split`, `--dry-run`, `--update-refs`, `--empty`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Added to upstream catalogue after 2.53.0 and by 2.56.0; local builtin absent. Exact introducing release not asserted.

Roteiros relacionados: REWRITE-015. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-history.adoc).

## git-hook

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Run git hooks.

Lê: configuração e scripts sintéticos locais. Escreve: efeitos definidos pelo hook; stdout/status.

Um helper sintético comprova interface oficial; não compatibilidade com aplicação externa. Post-checkout acontece após troca e erro não desfaz automaticamente a árvore.

Discrepância versionada: [GIT253-REFERENCE-TRANSACTION-ABORTED](ESTUDO-GIT.md#discrepância-versionada-reference-transaction). HOOK-008 observa prepared → aborted após recusa; o manual e o código upstream divergem.

Opções/subcomandos em foco: `run`, `--ignore-missing`, `--to-stdin`. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-012, HOOK-001, HOOK-002, HOOK-003, HOOK-004, HOOK-005, HOOK-006, HOOK-007, HOOK-008, HOOK-009, HOOK-010, HOOK-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-hook.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-hook.adoc).

## git-http-backend

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Server side implementation of Git over HTTP.

Lê: CGI/env; requisições; refs/objetos. Escreve: resposta HTTP e objetos/refs em receive.

Implementação oficial do lado servidor; ambiente CGI precisa fixture. Não instalar servidor público/serviço para esta rodada.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-http-backend.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-http-backend.adoc).

## git-http-fetch

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Download from a remote Git repository via HTTP.

Lê: endpoint HTTP e objetos faltantes. Escreve: objetos locais.

Cliente de transporte, não equivalente a clone/pull completo. Servidor e erros de rede devem ser sintéticos controlados.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 9; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-http-fetch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-http-fetch.adoc).

## git-http-push

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Push objects over HTTP/DAV to another repository.

Lê: refs/objetos locais e endpoint DAV. Escreve: objetos/refs no destino.

Exige capacidade do servidor; documentação pode permanecer sem end-to-end quando não há endpoint local apropriado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-http-push.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-http-push.adoc).

## git-imap-send

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Send a collection of patches from stdin to an IMAP folder.

Lê: mensagens stdin e configuração IMAP. Escreve: conexão e envio de email/pasta remota.

Ponte oficial inventariada; nenhum envio/conta pessoal autorizado. Adiamento por escopo não é ENV_BLOCKED automático.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 9; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: LEGACY-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-imap-send.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-imap-send.adoc).

## git-index-pack

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Build pack index file for an existing packed archive.

Lê: objetos ou stream pack. Escreve: packs/índices ou objetos descompactados.

Pack é representação física; OIDs e conteúdo lógico permanecem o oráculo. Flags variam por comando. Entradas truncadas/corrompidas precisam estado após erro e limite de recursos.

Opções/subcomandos em foco: `--stdin`, `--fix-thin`, `--strict`. Rótulos extraídos: 17; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-index-pack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-index-pack.adoc).

## git-init

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create an empty Git repository or reinitialize an existing one.

Lê: template/configuração explícita; caminho novo. Escreve: layout Git; configuração local; HEAD inicial.

Unborn HEAD é válido, sem commit ainda. SHA-256/reftable precisam detecção por capacidade. Inicialização base não implica que Layers já funcionam antes do primeiro commit.

Opções/subcomandos em foco: `--bare`, `--initial-branch`, `--object-format`, `--ref-format`, `--separate-git-dir`. Rótulos extraídos: 10; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-004, ENV-012, INIT-001, INIT-002, INIT-003, INIT-004, INIT-011, REF-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-init.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-init.adoc).

## git-instaweb

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Instantly browse your working repository in gitweb.

Lê: repo e configuração de servidor/browser. Escreve: servidor local e navegador.

Pode abrir UI e serviço; inventário documental nesta fase. Não é dependência da CLI/Core.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-003. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-instaweb.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-instaweb.adoc).

## git-interpret-trailers

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Add or parse structured information in commit messages.

Lê: mensagem stdin/arquivo e configuração. Escreve: texto transformado; arquivo com opção de gravação.

Trailers estruturam mensagem, não mudam tree. Helpers configurados podem executar comandos e precisam controle de fixture.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 14; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-010, INSPECT-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-interpret-trailers.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-interpret-trailers.adoc).

## git-last-modified

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: EXPERIMENTAL: Show when files were last modified.

Lê: histórico e caminhos selecionados. Escreve: stdout de última revisão por arquivo.

Experimental no manual local; conteúdo e opções não devem ser inferidos apenas por nome. Formato de saída liga-se a format-rev nas versões novas.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-last-modified.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-last-modified.adoc).

## git-log

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show commit logs.

Lê: objetos; refs; revisões; opções de travessia. Escreve: stdout; nenhuma escrita pedida.

Travessia e apresentação são dimensões separadas. Bases desconectadas, merges, shallow e replace afetam alcance. Não assumir histórico Layer descendente de main.

Opções/subcomandos em foco: `--format`, `--first-parent`. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-005, INSPECT-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-log.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-log.adoc).

## git-ls-files

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show information about files in the index and the working tree.

Lê: índice; disco; regras de exclusão. Escreve: stdout; nenhuma alteração solicitada.

Stage/mode/OID/caminho são observação do índice; -v e --debug ajudam flags. Use -z para nomes sem assumir linhas. Arquivo ignorado pode continuar tracked se já está no índice.

Opções/subcomandos em foco: `--stage`, `--unmerged`, `--others`, `--ignored`, `--exclude-standard`, `--debug`, `-v`, `-z`. Rótulos extraídos: 39; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-001, INDEX-002, INDEX-006, INDEX-007, INDEX-010, INDEX-012, INDEX-014, INDEX-018, INDEX-019, INDEX-020, BRANCH-016, MERGE-004, MERGE-005, MERGE-006, MERGE-008, MERGE-009, REWRITE-002, REWRITE-009, REWRITE-011, STASH-004, STASH-007, REMOTE-006, WORKTREE-002, WORKTREE-007, WORKTREE-010, WORKTREE-011, WORKTREE-014, PATH-001, PATH-004, PATH-010, PATH-011, PATCH-002, PATCH-003, OBJECT-006, OBJECT-007, OBJECT-009, LAYER-002, LAYER-003, LAYER-005, LAYER-006, LAYER-007, LAYER-008, LAYER-009, LAYER-010, LAYER-011, LAYER-013, LAYER-016, LAYOUT-009, LAYOUT-011, RECOVERY-001, RECOVERY-002, HARNESS-001, HARNESS-005, MODEL-001, MODEL-002, MODEL-003, MODEL-004, MODEL-005, MODEL-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-ls-files.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-ls-files.adoc).

## git-ls-remote

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: List references in a remote repository.

Lê: anúncio de refs remoto local. Escreve: stdout de OIDs/refs.

Consulta transporte sem importar objetos/atualizar branches por si; endpoint de teste nunca é origin real.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 14; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REMOTE-002, REMOTE-007, REMOTE-008, REMOTE-009, REMOTE-010, REMOTE-016. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-ls-remote.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-ls-remote.adoc).

## git-ls-tree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: List the contents of a tree object.

Lê: objetos e revisões. Escreve: stdout; nenhuma alteração solicitada.

Cat-file verifica tipo/conteúdo; ls-tree verifica nomes/modos/OIDs da tree. Opções variam por comando. Blob canônico e arquivo com CRLF podem ter bytes diferentes legitimamente.

Opções/subcomandos em foco: `-t`, `-s`, `-z`, `-r`, `--full-tree`. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-014, REMOTE-016, OBJECT-003, LAYER-002, LAYER-005, LAYER-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-ls-tree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-ls-tree.adoc).

## git-mailinfo

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Extracts patch and authorship from a single e-mail message.

Lê: email bruto stdin e opções de encoding. Escreve: arquivos de mensagem/patch; metadados stdout.

Separa patch e autoria de mensagem; preservar bytes e encoding na fixture. Não implica envio ou autenticação.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 10; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-mailinfo.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-mailinfo.adoc).

## git-mailsplit

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Simple UNIX mbox splitter program.

Lê: mbox/maildir sintético. Escreve: arquivos numerados de mensagens.

Helper local de parsing; evitar usar mailbox pessoal. Ausência/ordem/bytes são o oráculo, sem executar produto externo.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-mailsplit.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-mailsplit.adoc).

## git-maintenance

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Run tasks to optimize Git repository data.

Lê: configuração/objetos/índices auxiliares. Escreve: dados de manutenção; scheduler somente em start/register.

Usar run em fixture; não registrar tarefa global/scheduler para satisfazer cenário. Tasks podem escrever commit-graph/MIDX e mudar desempenho sem alterar semântica de commits.

Opções/subcomandos em foco: `run`, `--task`, `--auto`, `start`, `stop`, `register`, `unregister`. Rótulos extraídos: 5; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-014, TOOLS-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-maintenance.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-maintenance.adoc).

## git-merge

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Join two or more development histories together.

Lê: HEAD; outro histórico; índice/disco; atributos; hooks. Escreve: objetos; HEAD/ref; índice/disco; MERGE_HEAD/ORIG_HEAD.

Classes de conflito exigem stages e bytes, não só exit code. Merge pode produzir avanço rápido sem commit; --no-commit isolado não impede fast-forward.

Opções/subcomandos em foco: `--no-commit`, `--no-ff`, `--ff-only`, `--squash`, `--abort`, `--continue`. Rótulos extraídos: 9; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: MERGE-001, MERGE-002, MERGE-003, MERGE-004, MERGE-005, MERGE-006, MERGE-007, MERGE-008, MERGE-009, MERGE-010, MERGE-011, MERGE-012, MERGE-013, MERGE-014, TOOLS-013, HOOK-004, HOOK-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-merge.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-merge.adoc).

## git-merge-base

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Find as good common ancestors as possible for a merge.

Lê: grafo de commits. Escreve: stdout/status de ancestralidade.

Pode retornar múltiplas bases; --is-ancestor responde relação booleana. Não determina sozinho ausência de conflitos de conteúdo.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-005, TOOLS-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-merge-base.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-merge-base.adoc).

## git-merge-file

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Run a three-way file merge.

Lê: trees/blobs; arquivos ou stages do índice. Escreve: objetos/arquivos/índice conforme comando.

Merge-tree calcula composição de árvores; merge-file faz merge textual; merge-index chama merge program sobre entradas não resolvidas. Não são equivalentes à operação gerenciada Layer.

Opções/subcomandos em foco: `--stdout`, `--ours`, `--theirs`. Rótulos extraídos: 10; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-merge-file.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-merge-file.adoc).

## git-merge-index

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Run a merge for files needing merging.

Lê: trees/blobs; arquivos ou stages do índice. Escreve: objetos/arquivos/índice conforme comando.

Merge-tree calcula composição de árvores; merge-file faz merge textual; merge-index chama merge program sobre entradas não resolvidas. Não são equivalentes à operação gerenciada Layer.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-merge-index.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-merge-index.adoc).

## git-merge-one-file

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: The standard helper program to use with git-merge-index.

Lê: estágios/blobs e arquivos via merge-index. Escreve: arquivo/índice conforme integração.

Helper legado de merge de arquivo; cenário sintético não implementa política de conflito Layer.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-merge-one-file.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-merge-one-file.adoc).

## git-merge-tree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Perform merge without touching index or working tree.

Lê: trees/blobs; arquivos ou stages do índice. Escreve: objetos/arquivos/índice conforme comando.

Merge-tree calcula composição de árvores; merge-file faz merge textual; merge-index chama merge program sobre entradas não resolvidas. Não são equivalentes à operação gerenciada Layer.

Opções/subcomandos em foco: `--write-tree`, `--trivial-merge`, `--stdin`. Rótulos extraídos: 10; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: MERGE-015. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-merge-tree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-merge-tree.adoc).

## git-mergetool

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Run merge conflict resolution tools to resolve merge conflicts.

Lê: conflitos índice/disco e tool configurada. Escreve: helper/GUI; disco e índice resolvidos.

Sem lançamento de ferramentas visuais nesta fase. Teste de helper inofensivo comprova protocolo, não aplicação externa.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 10; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-001. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-mergetool.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-mergetool.adoc).

## git-mktag

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Creates a tag object with extra validation.

Lê: descrição de árvore ou tag via stdin; objetos existentes. Escreve: objeto tree ou tag; stdout OID.

Mktree recebe modo/tipo/OID/nome; mktag valida objeto tag. Não atualizam refs sozinhos. Opções pertencem a cada manual, não são intercambiáveis.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-mktag.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-mktag.adoc).

## git-mktree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Build a tree-object from ls-tree formatted text.

Lê: descrição de árvore ou tag via stdin; objetos existentes. Escreve: objeto tree ou tag; stdout OID.

Mktree recebe modo/tipo/OID/nome; mktag valida objeto tag. Não atualizam refs sozinhos. Opções pertencem a cada manual, não são intercambiáveis.

Opções/subcomandos em foco: `-z`, `--missing`, `--batch`. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-003. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-mktree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-mktree.adoc).

## git-multi-pack-index

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Write and verify multi-pack-indexes.

Lê: packs e índices existentes. Escreve: MIDX/bitmap; packs em manutenção.

Estrutura auxiliar para lookup/manutenção; efeitos físicos não alteram OIDs lógicos. Expiração e repack exigem fixture sem alternates externos.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 8; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-multi-pack-index.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-multi-pack-index.adoc).

## git-mv

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Move or rename a file, a directory, or a symlink.

Lê: caminhos; índice; disco. Escreve: índice/disco; metadados submódulo quando pertinente.

Rm --cached preserva disco; mv altera caminho no índice/disco. Renome no histórico é inferido de conteúdo, não objeto rename persistido. Opções específicas não são intercambiáveis.

Opções/subcomandos em foco: `--force`, `--dry-run`, `-r`. Rótulos extraídos: 7; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-013, PATH-002, LAYER-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-mv.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-mv.adoc).

## git-name-rev

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Find symbolic names for given revs.

Lê: grafo e refs candidatas. Escreve: stdout de nomes para revisões.

Nome relativo é apresentação e depende das refs; registrar OID exato como identidade da evidência.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 8; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-name-rev.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-name-rev.adoc).

## git-notes

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Add or inspect object notes.

Lê: objetos e namespace de notes. Escreve: commits/trees e ref de notes.

Notes têm histórico separado e transporte por refspec próprio; não reescrevem o commit anotado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 29; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-notes.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-notes.adoc).

## git-p4

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY.

Lê: Depot/changelists Perforce, commits Git e client spec. Escreve: Refs/objetos/worktree Git; workspace e changelists Perforce.

clone importa; sync atualiza; rebase combina sync com rebase. submit exige workspace Perforce separado.

Opções/configuração dirigidas: `clone @all`: importa histórico; `sync --branch`: seleciona ref; `--import-local`: usa refs/heads/p4; `submit --dry-run`: apenas enumera; `submit --prepare-p4-only`: altera workspace sem submit; `submit --shelve`: cria shelf.

Riscos: Submit pode publicar; prepare não é somente leitura; identidades exigem política.

Versão/capacidade: Histórico do manual sem alterações 2.53–2.56; isto não prova igualdade de implementação nem mínimos de opções. Última alteração documental indicada: 2.52.0.

Roteiros relacionados: LEGACY-004. Exame dirigido; não integral. Sem execução adicional, disponibilidade/serviços não inferidos; escopo e IDs originais preservados.

Fonte consultada: [manual primário e histórico](https://git-scm.com/docs/git-p4). O link upstream original permanece no JSON; sua abertura raw falhou e não conta como leitura.


## git-pack-objects

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create a packed archive of objects.

Lê: objetos ou stream pack. Escreve: packs/índices ou objetos descompactados.

Pack é representação física; OIDs e conteúdo lógico permanecem o oráculo. Flags variam por comando. Entradas truncadas/corrompidas precisam estado após erro e limite de recursos.

Opções/subcomandos em foco: `--stdout`, `--stdin`, `--revs`, `--fix-thin`. Rótulos extraídos: 42; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-pack-objects.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-pack-objects.adoc).

## git-pack-redundant

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Find redundant pack files.

Lê: packs/índices existentes. Escreve: stdout de packs redundantes.

Listagem não apaga automaticamente os packs. Não remover arquivos só porque comando os listou sem contrato de cenário isolado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-pack-redundant.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-pack-redundant.adoc).

## git-pack-refs

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Pack heads and tags for efficient repository access.

Lê: refs do backend. Escreve: armazenamento compactado de refs.

Nome/OID lógico deve permanecer; não usar existência de arquivo loose como único observador. Backend pode ser files/reftable.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-001, RECOVERY-013, HARNESS-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-pack-refs.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-pack-refs.adoc).

## git-patch-id

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compute unique ID for a patch.

Lê: patches stdin. Escreve: identificador de mudança stdout.

Identidade de patch tolera diferenças de apresentação conforme modo; não equivale ao OID do commit ou prova de mesmos metadados.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-patch-id.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-patch-id.adoc).

## git-prune

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Prune all unreachable objects from the object database.

Lê: refs/reflogs; objetos; packs; expiração. Escreve: packs/índices; remoção de objetos segundo alcance e política.

Índice alternativo sozinho não é garantia universal de retenção para produto. Testar checkpoints alcançáveis e objetos necessários com GC real só na fixture sem alternates externos.

Opções/subcomandos em foco: `--expire`, `-a`, `-d`, `-n`. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-prune.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-prune.adoc).

## git-prune-packed

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Remove extra objects that are already in pack files.

Lê: refs/reflogs; objetos; packs; expiração. Escreve: packs/índices; remoção de objetos segundo alcance e política.

Índice alternativo sozinho não é garantia universal de retenção para produto. Testar checkpoints alcançáveis e objetos necessários com GC real só na fixture sem alternates externos.

Opções/subcomandos em foco: `-d`, `-n`. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-prune-packed.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-prune-packed.adoc).

## git-pull

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Fetch from and integrate with another repository or a local branch.

Lê: remoto/refspec; configuração de integração. Escreve: fetch e integração via merge/rebase; índice/disco/refs.

É composição com políticas e conflitos; teste de fetch ou merge isolado não cobre automaticamente pull.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 9; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REMOTE-005, REMOTE-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-pull.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-pull.adoc).

## git-push

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Update remote refs along with associated objects.

Lê: refs/OIDs e objetos locais; anúncio remoto. Escreve: refs e objetos do remoto; tracking/config com opções.

Transfere refs e objetos alcançáveis selecionados, não staging. --all inclui heads Layer; --mirror pode publicar refs privadas. Transporte só para bare local de fixture.

Opções/subcomandos em foco: `--all`, `--mirror`, `--tags`, `--atomic`, `--force-with-lease`, `--dry-run`, `--porcelain`. Rótulos extraídos: 46; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REMOTE-007, REMOTE-008, REMOTE-009, REMOTE-010, REMOTE-011, REMOTE-012, REMOTE-013, REMOTE-015, REMOTE-016, PROTO-004, HOOK-006, HOOK-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-push.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-push.adoc).

## git-quiltimport

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Applies a quilt patchset onto the current branch.

Lê: patchset quilt e metadados. Escreve: commits/refs e índice/disco.

Ponte oficial pode usar arquivos sintéticos locais. Não exigir aplicação externa real nem declarar compatibilidade com ecossistema terceiro.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-quiltimport.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-quiltimport.adoc).

## git-range-diff

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Compare two commit ranges (e.g. two versions of a branch).

Lê: duas faixas de commits. Escreve: comparação de séries stdout.

Relaciona revisões de patch series; não é merge nem prova de equivalência binária das trees finais.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 8; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-range-diff.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-range-diff.adoc).

## git-read-tree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Reads tree information into the index.

Lê: uma ou mais trees; índice. Escreve: índice; disco com -u.

Carrega árvores no índice selecionado. Merge de trees pode produzir stages 1/2/3; write-tree exige resolução. GIT_INDEX_FILE permite ensaio isolado sem índice principal.

Opções/subcomandos em foco: `--empty`, `--reset`, `-m`, `-u`, `--prefix`. Rótulos extraídos: 17; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-016, INDEX-019, OBJECT-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-read-tree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-read-tree.adoc).

## git-rebase

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Reapply commits on top of another base tip.

Lê: commits/pais; HEAD; índice/disco; sequencer. Escreve: commits/refs; índice/disco; estado de conflito/continuação.

Rebase reaplica história, cherry-pick reaplica mudança, revert cria mudança inversa. As opções são específicas de cada comando. Não inferir suporte do produto por comportamento nativo.

Opções/subcomandos em foco: `--continue`, `--abort`, `--skip`, `--quit`, `--onto`, `--rebase-merges`. Rótulos extraídos: 61; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-009, REWRITE-001, REWRITE-002, REWRITE-003, REWRITE-004, REWRITE-005, REWRITE-006, HOOK-003, HOOK-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-rebase.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-rebase.adoc).

## git-receive-pack

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Receive what is pushed into the repository.

Lê: protocolo push; refs/objetos anunciados. Escreve: objetos/quarentena; refs; hooks do destino.

Papel servidor; política pode rejeitar atualização após receber objetos. Observar estado final, não só exit do cliente.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REMOTE-012, PROTO-002, HOOK-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-receive-pack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-receive-pack.adoc).

## git-reflog

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Manage reflog information.

Lê: logs locais e refs. Escreve: logs/refs em delete/expire; stdout em show.

Reflog é local, depende de configuração e expiração; não é backup permanente. Expirar antes de GC muda retenção e deve ocorrer somente em fixture.

Opções/subcomandos em foco: `show`, `expire`, `delete`, `exists`, `--all`, `--expire`, `--expire-unreachable`. Rótulos extraídos: 10; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-013, STASH-013, REF-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-reflog.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-reflog.adoc).

## git-refs

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Low-level access to refs.

Lê: backend e refs do repositório. Escreve: backend em migrate; diagnóstico em verify.

Migração de backend é operação nativa de fixture, não migração do armazenamento Layer. A disponibilidade local e o suporte do Core a cada backend são conclusões distintas.

Opções/subcomandos em foco: `migrate`, `verify`, `--ref-format`, `--dry-run`. Rótulos extraídos: 6; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-005, REF-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-refs.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-refs.adoc).

## git-remote

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Manage set of tracked repositories.

Lê: configuração local; refs de tracking. Escreve: configuração; refs de tracking; transporte em algumas ações.

Adicionar URL local não transporta sozinho; prune/show/update podem consultar remoto. Nenhuma origem real/pessoal deve entrar no ambiente de testes.

Opções/subcomandos em foco: `add`, `get-url`, `set-url`, `rename`, `remove`, `prune`, `show`, `update`. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REMOTE-001, REMOTE-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-remote.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-remote.adoc).

## git-repack

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Pack unpacked objects in a repository.

Lê: refs/reflogs; objetos; packs; expiração. Escreve: packs/índices; remoção de objetos segundo alcance e política.

Índice alternativo sozinho não é garantia universal de retenção para produto. Testar checkpoints alcançáveis e objetos necessários com GC real só na fixture sem alternates externos.

Opções/subcomandos em foco: `--expire`, `--cruft`, `-a`, `-d`, `-n`. Rótulos extraídos: 36; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-repack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-repack.adoc).

## git-replace

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create, list, delete refs to replace objects.

Lê: objetos e refs/replace. Escreve: refs de substituição; objetos em alguns modos.

Substituição muda leitura do grafo sem reescrever todos objetos. Oráculo deve registrar GIT_NO_REPLACE_OBJECTS quando precisa visão física. Core atual pode recusar.

Opções/subcomandos em foco: `-l`, `-d`, `--graft`, `--convert-graft-file`. Rótulos extraídos: 11; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-replace.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-replace.adoc).

## git-replay

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: EXPERIMENTAL: Replay commits on a new base, works with bare repos too.

Lê: commits e nova base. Escreve: novos objetos; atualizações de ref descritas/solicitadas.

Experimental; pode trabalhar bare. Não assumir paridade de opções de rebase ou suporte a todos conflitos; detectar capacidade local.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REWRITE-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-replay.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-replay.adoc).

## git-repo

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Retrieve information about the repository.

Lê: estado e localização do repositório. Escreve: stdout de informação.

Interface de consulta do repositório; a semântica de cada subcomando deve ser ligada ao manual da versão e observação nativa.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-012, REF-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-repo.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-repo.adoc).

## git-request-pull

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Generates a summary of pending changes.

Lê: histórico base/tip e URL textual. Escreve: resumo de alterações stdout.

Gera pedido textual, não publica PR, não faz push nem envia mensagem por si. Não usar serviço real como fixture.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PATCH-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-request-pull.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-request-pull.adoc).

## git-rerere

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Reuse recorded resolution of conflicted merges.

Lê: conflito e cache de resoluções. Escreve: rr-cache; disco/índice conforme autoupdate.

Reutiliza resoluções, não prova que elas são corretas para requisito. Cache isolado e asserções de stages/bytes são necessários.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: MERGE-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-rerere.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-rerere.adoc).

## git-reset

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Set `HEAD` or the index to a known state.

Lê: commit/tree; índice; disco; HEAD. Escreve: HEAD/ref; ORIG_HEAD; índice e/ou disco.

Soft conserva índice/disco; mixed altera índice; hard também substitui tracked no disco. Reset por caminho não troca HEAD. Política Layer para destruição continua pendente.

Opções/subcomandos em foco: `--soft`, `--mixed`, `--hard`, `--merge`, `--keep`, `--patch`. Rótulos extraídos: 16; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-015, REWRITE-012, REWRITE-013, MODEL-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-reset.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-reset.adoc).

## git-restore

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Restore working tree files.

Lê: tree fonte ou índice; caminhos. Escreve: índice e/ou disco.

Sem --staged restaura disco; com --staged altera o índice. --source pode escolher outra árvore. Não confundir unstage com descarte de alterações locais.

Opções/subcomandos em foco: `--source`, `--staged`, `--worktree`, `--ours`, `--theirs`, `--patch`. Rótulos extraídos: 26; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-014, MERGE-010, PATH-006, MODEL-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-restore.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-restore.adoc).

## git-rev-list

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Lists commit objects in reverse chronological order.

Lê: objetos; refs; revisões; opções de travessia. Escreve: stdout; nenhuma escrita pedida.

Travessia e apresentação são dimensões separadas. Bases desconectadas, merges, shallow e replace afetam alcance. Não assumir histórico Layer descendente de main.

Opções/subcomandos em foco: `--all`, `--format`, `--objects`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-005, MERGE-001, REWRITE-001, REWRITE-005, REWRITE-014, REWRITE-015, REMOTE-005, INSPECT-006, REF-007, REF-013, RECOVERY-006, HARNESS-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-rev-list.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-rev-list.adoc).

## git-rev-parse

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Pick out and massage parameters.

Lê: configuração de descoberta; revisões; refs. Escreve: stdout; nenhuma alteração solicitada.

Descobrir índice/git-dir/common-dir e formato real. Não fixar tamanho SHA-1 nem interpretar revisão ambígua como caminho; separar argumentos adequadamente.

Opções/subcomandos em foco: `--absolute-git-dir`, `--git-common-dir`, `--git-path`, `--show-object-format`, `--show-ref-format`, `--verify`, `--end-of-options`. Rótulos extraídos: 51; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-003, ENV-004, ENV-005, ENV-010, ENV-011, ENV-014, INIT-004, INIT-008, INIT-012, BRANCH-011, WORKTREE-001, WORKTREE-004, WORKTREE-009, REF-004, LAYOUT-001, LAYOUT-002, LAYOUT-003, LAYOUT-004, LAYOUT-005, LAYOUT-007, LAYOUT-008, LAYOUT-012, HARNESS-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-rev-parse.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-rev-parse.adoc).

## git-revert

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Revert some existing commits.

Lê: commits/pais; HEAD; índice/disco; sequencer. Escreve: commits/refs; índice/disco; estado de conflito/continuação.

Rebase reaplica história, cherry-pick reaplica mudança, revert cria mudança inversa. As opções são específicas de cada comando. Não inferir suporte do produto por comportamento nativo.

Opções/subcomandos em foco: `--continue`, `--abort`, `--skip`, `--quit`, `--no-commit`. Rótulos extraídos: 17; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REWRITE-010, REWRITE-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-revert.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-revert.adoc).

## git-rm

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Remove files from the working tree and from the index.

Lê: caminhos; índice; disco. Escreve: índice/disco; metadados submódulo quando pertinente.

Rm --cached preserva disco; mv altera caminho no índice/disco. Renome no histórico é inferido de conteúdo, não objeto rename persistido. Opções específicas não são intercambiáveis.

Opções/subcomandos em foco: `--cached`, `--force`, `--dry-run`, `--ignore-unmatch`, `-r`. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-012, LAYER-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-rm.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-rm.adoc).

## git-send-email

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Send a collection of patches as emails.

Lê: patches/mensagens; configuração SMTP. Escreve: email enviado e estado de transporte.

Nenhum envio real autorizado. Item oficial inventariado e adiado conforme escopo, sem confundir com incapacidade do Core.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 69; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: LEGACY-001. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-send-email.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-send-email.adoc).

## git-send-pack

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Push objects over Git protocol to another repository.

Lê: refs/objetos locais e servidor receive-pack. Escreve: objetos/refs do destino.

Cliente plumbing de push; refs/objetos finais e rejeições do servidor precisam observação independente em bare local.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-send-pack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-send-pack.adoc).

## git-sh-i18n

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Git's i18n setup code for shell scripts.

Lê: ambiente gettext e strings. Escreve: funções/saída shell de tradução.

Biblioteca shell oficial, não aplicação Git de domínio. Testar carregamento exige shell sintético e não muda suporte Layer.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-sh-i18n.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-sh-i18n.adoc).

## git-sh-setup

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Common Git shell script setup code.

Lê: ambiente/configuração/estado Git. Escreve: funções shell e efeitos do script consumidor.

Biblioteca de setup para scripts oficiais; não executar scripts desconhecidos só para inventariar presença.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-sh-setup.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-sh-setup.adoc).

## git-shell

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Restricted login shell for Git-only SSH access.

Lê: comando SSH/argv e configuração autorizada. Escreve: execução restrita de operações servidor.

Shell de login restrito não é sandbox universal para todo helper. Nesta rodada inventariar sem trocar shell/login do usuário.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-shell.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-shell.adoc).

## git-shortlog

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Summarize 'git log' output.

Lê: commits ou log stdin; mailmap. Escreve: agrupamento/contagens stdout.

Agrupa autoria, não mede propriedade de arquivos ou esforço; canonicalização de mailmap pode alterar agrupamento sem mudar objetos.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 12; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-shortlog.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-shortlog.adoc).

## git-show

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show various types of objects.

Lê: objetos; refs; revisões; opções de travessia. Escreve: stdout; nenhuma escrita pedida.

Travessia e apresentação são dimensões separadas. Bases desconectadas, merges, shallow e replace afetam alcance. Não assumir histórico Layer descendente de main.

Opções/subcomandos em foco: `--format`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-011, COMMIT-003, REWRITE-010, PATH-007, INSPECT-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-show.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-show.adoc).

## git-show-branch

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show branches and their commits.

Lê: refs e grafo. Escreve: matriz de commits stdout.

Visualização textual de relações; não troca branches nem certifica seleção Layer bloqueada.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 19; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-013. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-show-branch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-show-branch.adoc).

## git-show-index

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show packed archive index.

Lê: índice de pack stdin. Escreve: offsets/OIDs/CRC stdout.

Pack index é distinto de staging index. Não aplicar conclusões deste formato ao arquivo index do worktree.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-show-index.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-show-index.adoc).

## git-show-ref

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: List references in a local repository.

Lê: refs; objetos para campos/peeling. Escreve: stdout; nenhuma alteração pedida.

Consultar nomes lógicos/OIDs evita depender de refs soltas. --verify é de show-ref; filtros/formatos dependem do comando. Nomes Layer continuam visíveis no namespace heads.

Opções/subcomandos em foco: `--verify`, `--heads`, `--tags`. Rótulos extraídos: 13; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INIT-003, INIT-005, INIT-006, INIT-007, COMMIT-013, COMMIT-014, BRANCH-010, BRANCH-016, BRANCH-019, STASH-008, REMOTE-003, REMOTE-004, REMOTE-011, INSPECT-011, PATCH-011, REF-001, REF-002, REF-003, REF-006, TOOLS-014, LAYER-002, LAYER-014, LAYER-016, LAYOUT-004, LAYOUT-010, MODEL-002, MODEL-004, MODEL-009, MODEL-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-show-ref.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-show-ref.adoc).

## git-sparse-checkout

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Reduce your working tree to a subset of tracked files.

Lê: padrões sparse; índice; disco. Escreve: padrões; configuração; flags/sparse index; disco.

Sparse checkout e sparse index são dimensões relacionadas, diferentes. Diretório ausente no disco não é ausência na tree nem liberação de propriedade.

Opções/subcomandos em foco: `init`, `set`, `add`, `list`, `reapply`, `disable`, `--cone`, `--sparse-index`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: WORKTREE-010, WORKTREE-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-sparse-checkout.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-sparse-checkout.adoc).

## git-stage

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Add file contents to the staging area.

Lê: disco; índice; ignore; atributos. Escreve: índice; blobs.

Prepara conteúdo no instante do add; edições posteriores são unstaged. Ignore exclui novos caminhos por padrão, não impede adição forçada. Não cria commit.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-stage.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-stage.adoc).

## git-stash

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Stash the changes in a dirty working directory away.

Lê: HEAD; índice; disco; ignore. Escreve: objetos; refs/stash; reflog; índice/disco.

Push comum guarda tracked; -u inclui não rastreados; -a também ignorados. Apply/pop podem conflitar e --index tenta restaurar staging. Shelf do produto é mecanismo distinto.

Opções/subcomandos em foco: `push`, `pop`, `apply`, `--index`, `--include-untracked`, `--all`, `--keep-index`. Rótulos extraídos: 21; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REWRITE-006, STASH-001, STASH-002, STASH-003, STASH-004, STASH-005, STASH-006, STASH-007, STASH-008, STASH-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-stash.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-stash.adoc).

## git-status

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show the working tree status.

Lê: HEAD; índice; disco; ignore; submódulos. Escreve: stdout; atualização opcional de cache do índice.

Porcelain é interface estruturada; status pode refrescar caches legítimos. Snapshot semântico evita falso positivo só por bytes físicos do índice.

Opções/subcomandos em foco: `--branch`, `--untracked-files`, `--ignored`, `-z`. Rótulos extraídos: 21; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-003, ENV-005, ENV-009, ENV-011, ENV-013, INIT-002, INIT-012, INDEX-003, INDEX-004, COMMIT-002, BRANCH-003, BRANCH-006, BRANCH-017, MERGE-003, MERGE-011, REWRITE-003, REWRITE-007, REWRITE-012, REWRITE-013, STASH-001, STASH-002, STASH-006, WORKTREE-008, WORKTREE-013, PATH-003, PATH-015, INSPECT-001, PATCH-006, LAYER-001, LAYER-004, LAYER-007, LAYER-011, LAYER-012, RECOVERY-002, RECOVERY-004, RECOVERY-008, RECOVERY-009, RECOVERY-014, HARNESS-001, HARNESS-002, HARNESS-008, HARNESS-009, HARNESS-010, MODEL-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-status.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-status.adoc).

## git-stripspace

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Remove unnecessary whitespace.

Lê: texto stdin. Escreve: texto limpo stdout.

Helper de normalização textual; não aplicar ao conteúdo de blob usado como oráculo byte a byte sem contrato.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 4; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-007. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-stripspace.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-stripspace.adoc).

## git-submodule

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Initialize, update or inspect submodules.

Lê: gitlinks; .gitmodules; configuração; repositórios filhos. Escreve: gitfiles; módulos; índice/configuração; arquivos conforme ação.

Gitlink modo 160000 não é diretório regular da tree. Submódulo pode ter índice e dirty state próprios. Somente origens locais sintéticas autorizadas.

Opções/subcomandos em foco: `add`, `update`, `init`, `deinit`, `status`, `--recursive`, `--cached`. Rótulos extraídos: 30; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: WORKTREE-007, WORKTREE-008, WORKTREE-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-submodule.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-submodule.adoc).

## git-svn

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY.

Resumo NAME do manual local: Bidirectional operation between a Subversion repository and Git.

Lê: Subversion/configuração e refs locais. Escreve: transporte/refs/objetos conforme operação.

Ponte oficial inventariada; end-to-end com outro sistema adiado. Não usar serviço/conta pessoal para demonstrar integração.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 30; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: LEGACY-003. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-svn.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-svn.adoc).

## git-switch

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Switch branches.

Lê: refs; trees; índice; arquivos; configuração. Escreve: HEAD; índice; disco; reflog.

Seleção de branch não conhece a convenção Layer. Checkout também restaura caminhos; switch é dedicado à troca. Flags destrutivas exigem variantes próprias e snapshots após erro.

Opções/subcomandos em foco: `--detach`, `--orphan`, `--force`, `--merge`. Rótulos extraídos: 25; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-002, BRANCH-003, BRANCH-004, BRANCH-007, BRANCH-008, BRANCH-013, BRANCH-014, BRANCH-017, BRANCH-018, BRANCH-020, RECOVERY-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-switch.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-switch.adoc).

## git-symbolic-ref

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Read, modify and delete symbolic refs.

Lê: symref como HEAD. Escreve: symref e reflog quando alterado.

Distingue HEAD simbólico de detached; não atualiza índice/disco por si. Falha de consulta pode indicar ref direta e deve ser interpretada com status/OID.

Opções/subcomandos em foco: `--short`, `--quiet`, `--delete`, `--no-recurse`. Rótulos extraídos: 8; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: BRANCH-001, BRANCH-007, BRANCH-009, BRANCH-016, BRANCH-017, BRANCH-020, WORKTREE-003, WORKTREE-014, REF-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-symbolic-ref.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-symbolic-ref.adoc).

## git-tag

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create, list, delete or verify tags.

Lê: objetos/revisões; identidade; configuração. Escreve: refs/tags; objeto tag anotado; assinatura quando pedida.

Tag leve é ref; anotada é objeto com metadados. Mutação e assinatura exigem fixture/chaves sintéticas. Não confundir tags nativas com complemento recusado pelo produto.

Opções/subcomandos em foco: `-a`, `-s`, `-u`, `-f`, `-d`, `--list`, `--verify`. Rótulos extraídos: 38; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-012, HOOK-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-tag.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-tag.adoc).

## git-unpack-file

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Creates a temporary file with a blob's contents.

Lê: blob por OID. Escreve: arquivo temporário com conteúdo.

Criar temporário não muda índice ou refs; controlar cwd/destino e remover somente arquivo próprio da fixture.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: OBJECT-010. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-unpack-file.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-unpack-file.adoc).

## git-unpack-objects

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Unpack objects from a packed archive.

Lê: objetos ou stream pack. Escreve: packs/índices ou objetos descompactados.

Pack é representação física; OIDs e conteúdo lógico permanecem o oráculo. Flags variam por comando. Entradas truncadas/corrompidas precisam estado após erro e limite de recursos.

Opções/subcomandos em foco: `--strict`. Rótulos extraídos: 5; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-unpack-objects.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-unpack-objects.adoc).

## git-update-index

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Register file contents in the working tree to the index.

Lê: stdin/disco; blobs; índice. Escreve: entradas/flags/extensões do índice; blobs quando necessário.

Flags skip-worktree/assume-unchanged não são propriedade nem segurança contra comando destrutivo. Formatos 2/3/4 e extensões requerem observação semântica e capacidades.

Opções/subcomandos em foco: `--cacheinfo`, `--index-info`, `--index-version`, `--split-index`, `--skip-worktree`, `--assume-unchanged`, `--chmod`, `-z`. Rótulos extraídos: 39; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: WORKTREE-011, WORKTREE-012, WORKTREE-013, PATH-010, OBJECT-009, LAYOUT-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-update-index.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-update-index.adoc).

## git-update-ref

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Update the object name stored in a ref safely.

Lê: valor atual da ref; novo OID; stdin transacional. Escreve: refs/symrefs; reflogs conforme configuração.

OID anterior implementa compare-and-swap. Batch transacional valida múltiplas atualizações; ref lógica pode usar files ou reftable. Não escrever arquivos de refs presumidos.

Discrepância versionada: [GIT253-REFERENCE-TRANSACTION-ABORTED](ESTUDO-GIT.md#discrepância-versionada-reference-transaction). HOOK-008 observa prepared → aborted após recusa; o manual e o código upstream divergem.

Opções/subcomandos em foco: `--stdin`, `--create-reflog`, `--no-deref`, `-d`, `-m`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-002, REF-003, LAYER-014, LAYER-015, RECOVERY-001, RECOVERY-003, RECOVERY-006, RECOVERY-011, RECOVERY-013, HOOK-008, MODEL-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-update-ref.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-update-ref.adoc).

## git-update-server-info

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Update auxiliary info file to help dumb servers.

Lê: refs e packs locais. Escreve: info/refs e objects/info/packs.

Auxilia transporte dumb; atualização de metadados de anúncio não significa push ou servidor configurado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-005. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-update-server-info.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-update-server-info.adoc).

## git-upload-archive

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Send archive back to git-archive.

Lê: pedido de archive remoto. Escreve: stream do arquivo.

Papel servidor de archive; só bytes alcançados pelo pedido, não exporta JSON/índices privados por definição.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-upload-archive.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-upload-archive.adoc).

## git-upload-pack

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Send objects packed back to git-fetch-pack.

Lê: requisição fetch; objetos/refs locais. Escreve: stream pack; possíveis auxiliares.

Papel servidor de leitura de objetos; filtros/lazy fetch e hooks podem adicionar efeitos e precisam ambiente controlado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 5; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: PROTO-001, PROTO-009. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-upload-pack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-upload-pack.adoc).

## git-url-parse

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Lê: URLs em argv. Escreve: stdout/status; sem conexão de transporte.

Novo no catálogo entre 2.53 e 2.56; ausente local. Valida sintaxe inclusive esquema não transportável; extração não prova conectividade ou autenticação.

Opções/subcomandos em foco: `--component`, `-c`. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Added to upstream catalogue after 2.53.0 and by 2.56.0; local builtin absent. Exact introducing release not asserted.

Roteiros relacionados: REMOTE-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-url-parse.adoc).

## git-var

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show a Git logical variable.

Lê: configuração/ambiente de identidade/caminhos. Escreve: valor lógico stdout.

Consulta pode refletir configuração, não comprova commit já criado. Não despejar variáveis/identidades pessoais no relatório.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-006, ENV-010, COMMIT-006. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-var.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-var.adoc).

## git-verify-commit

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Check the GPG signature of commits.

Lê: objetos commit e assinatura; keyring. Escreve: stdout/status; ferramenta de assinatura.

Valida assinatura segundo ambiente/chaves. Chave ausente, assinatura inválida e commit não assinado são resultados diferentes.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: COMMIT-011, HOOK-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-verify-commit.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-verify-commit.adoc).

## git-verify-pack

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Validate packed Git archive files.

Lê: packs/índices. Escreve: diagnóstico stdout/status.

Verifica representação física; validar tree/blob por Git continua necessário para integridade do conteúdo esperado.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 5; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: REF-009, REF-012. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-verify-pack.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-verify-pack.adoc).

## git-verify-tag

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Check the GPG signature of tags.

Lê: objeto tag e assinatura; keyring. Escreve: stdout/status; ferramenta de assinatura.

Tag leve não é objeto tag assinado. Somente chaves sintéticas; não importar/usar identidade pessoal.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 3; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-012, HOOK-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-verify-tag.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-verify-tag.adoc).

## git-version

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Display version information about Git.

Lê: build do executável Git. Escreve: stdout de versão/capacidades anunciadas.

--build-options identifica build, hashes e opções compiladas; anúncio não prova cenário exercitado nem versão do produto.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 1; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: ENV-001, ENV-002, ENV-013, BRANCH-018, TOOLS-011, LAYOUT-006, HARNESS-003, HARNESS-011, HARNESS-012, HARNESS-022. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-version.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-version.adoc).

## git-whatchanged

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Show logs with differences each commit introduces.

Lê: histórico e opções de diff. Escreve: stdout de log/diff.

Interface histórica relacionada a log. Não representa operação de escrita apesar do nome; resultado depende revisão e opções.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 0; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INSPECT-014. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-whatchanged.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-whatchanged.adoc).

## git-worktree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Manage multiple working trees.

Lê: refs; common-dir; gitfile; worktrees registrados. Escreve: administração por worktree; HEAD/índice/disco do novo contexto.

Objetos e muitas refs são compartilhados; índice/HEAD são por worktree. Proibição de mesma branch em uso não é proibição especial de Layer. Não reutilizar caminhos .git presumidos.

Opções/subcomandos em foco: `add`, `list`, `remove`, `prune`, `lock`, `unlock`, `repair`, `move`. Rótulos extraídos: 26; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: WORKTREE-001, WORKTREE-002, WORKTREE-003, WORKTREE-004, WORKTREE-005, WORKTREE-006, WORKTREE-014, LAYOUT-008. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-worktree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-worktree.adoc).

## git-write-tree

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** BUILTIN_LISTED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: Create a tree object from the current index.

Lê: índice e objetos. Escreve: objetos tree; stdout OID.

Não faz commit nem atualiza ref. O resultado depende das entradas semânticas; índice com conflito impede árvore comum. Índice alternativo é operável pelo Git oficial.

Opções/subcomandos em foco: `--missing-ok`, `--prefix`. Rótulos extraídos: 2; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: INDEX-016, INDEX-019, INDEX-020, OBJECT-007, LAYOUT-011. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/git-write-tree.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/git-write-tree.adoc).

## gitk

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_GUI_INVENTORY_ONLY.

Resumo NAME do manual local: The Git repository browser.

Lê: grafo/configuração. Escreve: janela do browser Git.

GUI oficial somente inventariada, sem execução visual nem certificado de interação com Layers.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 14; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-002. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/gitk.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/gitk.adoc).

## gitweb

**Grau:** TARGETED_SEMANTIC_REVIEW. **Disponibilidade:** NOT_FOUND_IN_BUILTINS_OR_EXEC_PATH. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Lê: Objetos/refs Git, configuração Perl e lista de projetos. Escreve: Respostas HTML/raw/patch/feeds; configuração operacional separada.

Frontend CGI de consulta, adequado a bare; não representa stage Layer nem equivale ao transporte smart HTTP.

Opções/configuração dirigidas: `$projectroot`: delimita raiz; `$projects_list`: lista projetos; `$strict_export`: restringe acesso à lista; `$export_ok`: exige marcador; `blob_plain/patch`: expõe conteúdo/changeset.

Riscos: Lista sozinha não impede URL direta; instaweb inicia servidor/browser.

Versão/capacidade: Histórico do manual sem alterações 2.53–2.56; isto não prova igualdade de implementação nem mínimos de opções. Última alteração documental indicada: 2.50.0.

Roteiros relacionados: TOOLS-003. Exame dirigido; não integral. Sem execução adicional, disponibilidade/serviços não inferidos; escopo e IDs originais preservados.

Fonte consultada: [manual primário e histórico](https://git-scm.com/docs/gitweb). O link upstream original permanece no JSON; sua abertura raw falhou e não conta como leitura.


## scalar

**Grau:** SEMANTIC_TRIAGE_OPTION_REVIEW_INCOMPLETE. **Disponibilidade:** OFFICIAL_EXEC_PATH_FILE_PRESENT_NOT_INVOKED. **Escopo:** OFFICIAL_HEADLESS_WHEN_AVAILABLE.

Resumo NAME do manual local: A tool for managing large Git repositories.

Lê: configuração/repositórios grandes; manutenção. Escreve: registro/configuração/clone/manutenção conforme ação.

Oficial e opcional; register pode alterar manutenção fora do repo. Não registrar scheduler/global real nesta rodada.

Opções/subcomandos em foco: não examinados semanticamente nesta ficha. Rótulos extraídos: 16; consultar JSON.

Versão/capacidade: Verified local availability only where listed; option minimum version not universally established.

Roteiros relacionados: TOOLS-004. Ligação nominal não comprova teste implementado.

Fontes: [upstream 2.56](https://github.com/git/git/blob/v2.56.0/Documentation/scalar.adoc), [manual local 2.53](https://github.com/git/git/blob/v2.53.0/Documentation/scalar.adoc).

## Guias, interfaces e formatos

- **gitcore-tutorial** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitcore-tutorial.adoc).
- **gitcredentials** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitcredentials.adoc).
- **gitcvs-migration** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado ausente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitcvs-migration.adoc).
- **gitdatamodel** (guide): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitdatamodel.adoc).
- **gitdiffcore** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitdiffcore.adoc).
- **giteveryday** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/giteveryday.adoc).
- **gitfaq** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitfaq.adoc).
- **gitglossary** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitglossary.adoc).
- **gitnamespaces** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitnamespaces.adoc).
- **gitremote-helpers** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitremote-helpers.adoc).
- **gitsubmodules** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitsubmodules.adoc).
- **gittutorial** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gittutorial.adoc).
- **gittutorial-2** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gittutorial-2.adoc).
- **gitworkflows** (guide): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitworkflows.adoc).
- **gitattributes** (userinterface): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitattributes.adoc).
- **gitcli** (userinterface): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitcli.adoc).
- **githooks** (userinterface): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/githooks.adoc).
- **gitignore** (userinterface): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitignore.adoc).
- **gitmailmap** (userinterface): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitmailmap.adoc).
- **gitmodules** (userinterface): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitmodules.adoc).
- **gitrepository-layout** (userinterface): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitrepository-layout.adoc).
- **gitrevisions** (userinterface): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitrevisions.adoc).
- **gitformat-bundle** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitformat-bundle.adoc).
- **gitformat-chunk** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitformat-chunk.adoc).
- **gitformat-commit-graph** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitformat-commit-graph.adoc).
- **gitformat-index** (format-protocol): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitformat-index.adoc).
- **gitformat-pack** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitformat-pack.adoc).
- **gitformat-signature** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitformat-signature.adoc).
- **gitprotocol-capabilities** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitprotocol-capabilities.adoc).
- **gitprotocol-common** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitprotocol-common.adoc).
- **gitprotocol-http** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitprotocol-http.adoc).
- **gitprotocol-pack** (format-protocol): INVENTORY_ONLY_NOT_FULLY_REVIEWED; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitprotocol-pack.adoc).
- **gitprotocol-v2** (format-protocol): TARGETED_CONCEPT_REVIEW; manual instalado presente; [fonte upstream](https://github.com/git/git/blob/v2.56.0/Documentation/gitprotocol-v2.adoc).
