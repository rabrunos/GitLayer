# Fontes e proveniência — v2

**Revisão: 18/10/2026.** O texto de estudo, as decisões, os roteiros e o protocolo são elaboração do pacote. Documentação técnica deve ser confirmada contra a versão efetiva ao implementar os testes.

## 1. Origem do material

A v2 parte dos arquivos reais do ZIP `Git-Layers-Estudo-e-Matriz-v1.zip`, preserva os 320 IDs e o catálogo upstream transcrito no v1, e incorpora as decisões e esclarecimentos posteriores do usuário de 18/10/2026. O v1 permanece histórico; o prompt v2 prevalece sobre ele.

Recorte do catálogo herdado: `git/git`, tag `v2.56.0`, `command-list.txt`, blob `63ae2a67c9405547f0e982567c06708099e60900`. A contagem preservada é 161 comandos/ferramentas, 14 guias, 8 interfaces de usuário/repositório e 11 formatos/protocolos. Não é uma afirmação da versão instalada nem do exame integral de todas as opções. O Codex deverá revalidar o inventário e registrar diferenças, sem atualizar o baseline silenciosamente.

Na preparação v2, foram novamente lidos pelo conector GitHub a branch main, `AGENTS.md`, `docs/ARCHITECTURE.md`, `.gitignore` e `package.json`, no commit `37887aad107bd751a3687bc660a6644ef5d90c54`. O restante do contexto de código/testes pertence às leituras anteriores da mesma revisão, não a uma nova execução.

Foram consultadas novamente as páginas oficiais sobre layout, comando Git/ambiente, switch, hooks, índice, add, push e worktrees para esclarecer o uso de índices reais e a diferença entre subcomando externo e seleção nativa de branch.

## 2. O que não foi feito neste pacote

Não houve execução de Git/Core/CLI, instalação de dependências, compilação do projeto, execução dos cenários, alteração remota ou modificação do AGENTS do repositório. O trabalho local foi somente criar/revisar os arquivos de referência e verificar sua consistência e o ZIP.

Todos os 344 cenários continuam **SPEC_ONLY / NOT_RUN**. As fontes por cenário são também uma agenda de verificação para o Codex. Uma URL anexada não significa que todas as variantes/opções dessa página foram estudadas.

## 3. Fontes técnicas

| ID | Referência |
|---|---|
| S01 | [Git — site oficial](https://git-scm.com/). Referência de versões; o baseline anexado não deve ser chamado de versão local. |
| S02 | [command-list.txt v2.56.0](https://github.com/git/git/blob/v2.56.0/command-list.txt). Catálogo upstream fixado. |
| S03 | [git](https://git-scm.com/docs/git). Comandos, ambiente, subcomandos externos e GIT_INDEX_FILE. |
| S04 | [gitdatamodel](https://git-scm.com/docs/gitdatamodel). Objetos e referências. |
| S05 | [gitformat-pack](https://git-scm.com/docs/gitformat-pack). Armazenamento empacotado. |
| S06 | [gitformat-index](https://git-scm.com/docs/gitformat-index) e [git-add](https://git-scm.com/docs/git-add). Índice, formato e preparação de conteúdo. |
| S07 | [git-merge](https://git-scm.com/docs/git-merge) e [git-rebase](https://git-scm.com/docs/git-rebase). Integração e conflitos. |
| S08 | [gitrepository-layout](https://git-scm.com/docs/gitrepository-layout). Diretórios, gitfile, índice e formato de repositório. |
| S09 | [git-worktree](https://git-scm.com/docs/git-worktree). Estado compartilhado e por worktree. |
| S10 | [git-refs](https://git-scm.com/docs/git-refs) e [git-init](https://git-scm.com/docs/git-init). Backends e formatos. |
| S11 | [git-update-ref](https://git-scm.com/docs/git-update-ref) e [git-rev-parse](https://git-scm.com/docs/git-rev-parse). Refs e descoberta. |
| S12 | [githooks](https://git-scm.com/docs/githooks), [git-hook](https://git-scm.com/docs/git-hook) e [gitcli](https://git-scm.com/docs/gitcli). Convenções e eventos. |
| S13 | [git-checkout](https://git-scm.com/docs/git-checkout). Seleção de contexto e ignorados. |
| S14 | [git-clean](https://git-scm.com/docs/git-clean). Remoção e ignorados. |
| S15 | [git-stash](https://git-scm.com/docs/git-stash). Conteúdo guardado e restauração. |
| S16 | [git-push](https://git-scm.com/docs/git-push). Refs e objetos publicados. |
| S17 | [t/README v2.56.0](https://github.com/git/git/blob/v2.56.0/t/README). Disciplina de testes upstream. |
| S18 | Referência externa do v1 retirada do escopo. Nenhum requisito de compatibilidade com outro projeto de mesmo nome permanece. |
| S19 | [git-clone](https://git-scm.com/docs/git-clone). Topologias, refs e transporte. |
| S20 | [git-bundle](https://git-scm.com/docs/git-bundle). Objetos e referências em bundle. |
| S21 | Referência de ambiente do v1 não utilizada para prometer capacidades. Nesta tarefa, a execução no Codex local foi escolhida pelo usuário; ferramentas/permissões deverão ser detectadas. |
| S22 | [git-help](https://git-scm.com/docs/git-help). Inventário e tipos de documentação. |
| S23 | [git-status](https://git-scm.com/docs/git-status). Saídas estruturadas e estado. |
| S24 | [git-update-index](https://git-scm.com/docs/git-update-index). Flags e manipulação nativa do índice. |
| S25 | [gitattributes](https://git-scm.com/docs/gitattributes) e [gitignore](https://git-scm.com/docs/gitignore). Transformações e exclusões. |
| S26 | [git-fetch](https://git-scm.com/docs/git-fetch), [gitprotocol-v2](https://git-scm.com/docs/gitprotocol-v2), [git-credential](https://git-scm.com/docs/git-credential). Transporte e helpers. |
| S27 | [git-submodule](https://git-scm.com/docs/git-submodule) e [git-sparse-checkout](https://git-scm.com/docs/git-sparse-checkout). Projeções/topologias. |
| S28 | [git-gc](https://git-scm.com/docs/git-gc), [git-maintenance](https://git-scm.com/docs/git-maintenance), [git-fsck](https://git-scm.com/docs/git-fsck). Retenção e diagnóstico. |
| S29 | [git-history](https://git-scm.com/docs/git-history), [git-replay](https://git-scm.com/docs/git-replay), [git-repo](https://git-scm.com/docs/git-repo). Entradas do recorte v1 a verificar por versão/capacidade. |
| S30 | [gitrevisions](https://git-scm.com/docs/gitrevisions), [git-config](https://git-scm.com/docs/git-config), [git-bisect](https://git-scm.com/docs/git-bisect). Seleção/configuração/investigação de histórico. |
| S31 | [git-branch](https://git-scm.com/docs/git-branch). Branches e operações do namespace. |
| S32 | [git-switch](https://git-scm.com/docs/git-switch). Seleção de branch e worktree. |

URLs sem tag podem evoluir. O resultado final do Codex deverá indicar qual manual/tag/binário embasou cada comportamento relevante. Respeitar licenças e atribuição ao adaptar testes upstream; nenhum teste oficial executado sem Layers certifica a extensão.

## 4. Fontes do projeto

| ID | Arquivo no commit consultado |
|---|---|
| P01 | [docs/ARCHITECTURE.md](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md). |
| P02 | [src/core/index.ts](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts), [storage.ts](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/storage.ts), [git.ts](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/git.ts). |
| P03 | [src/cli/index.ts](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/cli/index.ts). |
| P04 | [docs/TEST-REPORT.md](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/TEST-REPORT.md), [docs/SAFETY.md](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/SAFETY.md). Evidências históricas, não reexecutadas na v2. |
| P05 | [AGENTS.md](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/AGENTS.md), [.gitignore](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/.gitignore) e [package.json](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/package.json). |

## 5. Decisões de origem humana

U-01 a U-10 são sínteses das mensagens do usuário nesta conversa, consolidadas em `06-Decisoes-e-Autonomia.md`. Não são conclusões extraídas de manuais Git. O esclarecimento final restringe a tarefa a documentação/harness e reserva implementação do produto para futuras rodadas.
