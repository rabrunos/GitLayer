# Matriz de cenários Git / Git Layer — v2

**344 roteiros-base; 320 IDs preservados do v1 e 24 novos. Nenhum foi executado neste pacote.**

A classificação de escopo prevalece sobre a descrição histórica de um roteiro. Itens externos ou gráficos adiados não devem ser executados nesta rodada. Casos de layout futuro não autorizam migrar ou implementar produto.

Requisitos U-xx: `06-Decisoes-e-Autonomia.md`. Protocolo: `04-Protocolo-de-Testes.md`. Especificações humanas geradas do JSON correspondente para evitar divergência.

Os perfis listados são candidatos, não variantes automaticamente válidas. O Codex deve confirmar pré-condições e capacidades. Fontes por roteiro são referências para validação; não significam exame integral de todas as opções.

## Distribuição por família

| Família | Área | Roteiros |
|---|---|---:|
| ENV | Versão, descoberta, configuração e invocação | 14 |
| INIT | Inicialização, clone e topologias | 12 |
| INDEX | Staging, remoção, restauração e índice | 20 |
| COMMIT | Commits, autores e histórico reescrito | 14 |
| BRANCH | Branches, checkout e HEAD | 20 |
| MERGE | Merge e classes de conflito | 15 |
| REWRITE | Rebase, cherry-pick, revert e replay | 15 |
| STASH | Stash, limpeza e recuperação nativa | 13 |
| REMOTE | Remotos, fetch, pull, push e namespaces | 16 |
| WORKTREE | Worktrees, submódulos e índices especiais | 14 |
| PATH | Caminhos, tipos de arquivo e atributos | 15 |
| INSPECT | Consultas, diffs e histórico | 14 |
| PATCH | Patches, arquivos de distribuição e importação | 12 |
| OBJECT | Objetos, árvores e plumbing do índice | 12 |
| REF | Referências, logs, backend e manutenção | 15 |
| PROTO | Transporte e auxiliares cliente/servidor | 12 |
| TOOLS | Ferramentas gráficas, auxiliares e ecossistema | 15 |
| LEGACY | Interoperabilidade legada e email | 8 |
| LAYER | Invariantes e ciclo de vida das Layers | 16 |
| LAYOUT | Namespace layers e futura migração | 12 |
| RECOVERY | Interrupções, concorrência e resgate | 14 |
| HARNESS | Validação do próprio sistema de testes | 23 |
| HOOK | Hooks e políticas reais de desenvolvimento | 12 |
| MODEL | Propriedades e sequências combinatórias | 11 |

## Distribuição por escopo

| Escopo | Roteiros |
|---|---:|
| DEFERRED_THIRD_PARTY | 3 |
| EXTERNAL_INVENTORY_ONLY | 1 |
| FUTURE_LAYOUT_SPECIFICATION | 10 |
| HARNESS_HEADLESS | 24 |
| OFFICIAL_BRIDGE_INVENTORY_ONLY | 5 |
| OFFICIAL_CONTRIB_IF_PROVEN | 1 |
| OFFICIAL_GIT_HEADLESS | 299 |
| OFFICIAL_GUI_INVENTORY_ONLY | 1 |

## ENV — Versão, descoberta, configuração e invocação

### ENV-001 — Versão e capacidades do binário

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-version`, `git-help`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Executável resolvido por caminho absoluto; sem repositório pessoal.

**Ações:** Capturar version --build-options, help -a --no-aliases --no-external-commands, guias e interfaces.

**Oráculo / expectativa:** Registrar inventário realmente disponível; comando ausente não é teste aprovado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://git-scm.com/docs/git-help)

### ENV-002 — Subcomando externo no PATH

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-help`, `git-version`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** PATH e aliases de fixture; launcher do Git Layer e sentinelas sintéticas conhecidas. Nenhum aplicativo terceiro real.

**Ações:** Caracterizar resolução de git layer e precedência de alias/executável em ambiente isolado. Não executar binários desconhecidos nem mudar PATH permanente.

**Oráculo / expectativa:** A resolução observada deve apontar para o alvo declarado na fixture. Isso testa despacho oficial do Git, não compatibilidade com outro produto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-help) · [2](https://git-scm.com/docs/git-version)

### ENV-003 — Execução em subdiretório

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-rev-parse`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repositório com src/deep e arquivos na raiz.

**Ações:** Comparar invocações pela raiz, por subdiretório e com -C.

**Oráculo / expectativa:** Identidade do repositório e caminhos interpretados devem corresponder ao Git da versão testada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://git-scm.com/docs/git-status)

### ENV-004 — Gitfile e gitdir separado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-init`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Fixture com --separate-git-dir fora da árvore de trabalho.

**Ações:** Inicializar, redescobrir diretórios e consultar status.

**Oráculo / expectativa:** .git pode ser arquivo; não concatenar caminhos presumindo diretório.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-rev-parse)

### ENV-005 — GIT_DIR e GIT_WORK_TREE explícitos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-rev-parse`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Metadados e workspace separados dentro da raiz temporária.

**Ações:** Invocar pelo par de variáveis e pelas opções equivalentes.

**Oráculo / expectativa:** Consultar o repositório pretendido sem escrever no diretório atual por engano.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://git-scm.com/docs/git-status)

### ENV-006 — Escopos e precedência de config

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-config`, `git-var`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivos system/global/local temporários, com valores divergentes.

**Ações:** Comparar valores normais, -c, --config-env, --show-origin e --show-scope.

**Oráculo / expectativa:** Precedência observada deve ser preservada ou explicitamente recusada; nada muda no global real.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://git-scm.com/docs/git-var)

### ENV-007 — Include e includeIf

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-config`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Config isolada com include e condição gitdir/branch.

**Ações:** Mudar branch/diretório e consultar valores efetivos.

**Oráculo / expectativa:** Inclusões condicionais devem ser reconhecidas na configuração efetiva.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config)

### ENV-008 — Aliases simples e aliases shell

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-config`, `git-help`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Alias status e alias ! de script inofensivo criado pela fixture.

**Ações:** Invocar aliases e registrar diretório, argumentos e execução.

**Oráculo / expectativa:** Alias nativo segue o Git; teste não pode assumir que todo subcomando é builtin.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://git-scm.com/docs/git-help)

### ENV-009 — Repositório sem confiança

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-status`, `git-config`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Ambiente capaz de simular ownership divergente ou resultado explícito de indisponibilidade.

**Ações:** Exercitar safe.directory apenas em config isolada.

**Oráculo / expectativa:** Recusa de confiança não deve ser mascarada com configuração global permissiva.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-config)

### ENV-010 — Variáveis de execução e descoberta

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-var`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** HOME, XDG, ceiling dirs, PATH com espaços; ambiente isolado.

**Ações:** Variar descoberta, pager desativado e opções globais documentadas.

**Oráculo / expectativa:** Nenhum acesso acidental ao repositório pai ou às credenciais pessoais.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-var) · [2](https://git-scm.com/docs/git-rev-parse)

### ENV-011 — Sem repositório e argumento inválido

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-status`, `git-rev-parse`, `git-help`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Diretório novo fora de qualquer repo.

**Ações:** Invocar status e comandos com opções/argumentos incorretos.

**Oráculo / expectativa:** Saída e código explicam falha; não inicializar Git implicitamente em consultas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-rev-parse) · [3](https://git-scm.com/docs/git-help)

### ENV-012 — Formatos novos e extensões desconhecidas

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-init`, `git-config`, `git-repo`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Fixtures SHA-1/SHA-256 e files/reftable quando disponíveis.

**Ações:** Inspecionar formato e testar extensão de formato desconhecida em cópia separada.

**Oráculo / expectativa:** Distinguir incompatibilidade real de versão; não criar extensions.layers como atalho de integração.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-config) · [3](https://git-scm.com/docs/git-repo)

### ENV-013 — Core/CLI executados sem editor ou IDE

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-version`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-05, U-06

**Pré-condições:** Build dos fontes atuais de Core/CLI em saída exclusiva de teste e fixture Git pequena; nenhuma GUI iniciada.

**Ações:** Executar ajuda e fluxo init/create/on/add/commit/status pela CLI headless disponível; registrar árvore de processos criada pelo runner e dependências usadas no caminho executado.

**Oráculo / expectativa:** Fluxo efetivamente observado sem spawn de Electron/desktop/IDE. Falha não autoriza abrir o editor como atalho; registrar bloqueio/lacuna concreta.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://git-scm.com/docs/git-status) · [3](06-Decisoes-e-Autonomia.md)

### ENV-014 — Ambiente de teste não altera Git e configuração pessoais

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-config`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-01, U-05, U-10

**Pré-condições:** Configurações sintéticas e diretórios isolados; inventário de caminhos sensíveis sem coletar segredos.

**Ações:** Executar casos nativos com config/HOME próprios e conferir que writes/spawns controlados permanecem no escopo autorizado, preservando estado exterior.

**Oráculo / expectativa:** Não há configuração global, hooks, PATH permanente ou instalação Git alterados; evidência de isolamento registra somente informações necessárias.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://git-scm.com/docs/git-rev-parse) · [3](06-Decisoes-e-Autonomia.md)


## INIT — Inicialização, clone e topologias

### INIT-001 — Repositório vazio e primeiro commit

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-init`, `git-add`, `git-commit`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Pasta vazia, identidade temporária.

**Ações:** Inicializar, consultar unborn HEAD e criar primeiro commit.

**Oráculo / expectativa:** Primeiro commit não tem pai e não exige objetos inexistentes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-commit)

### INIT-002 — Inicializar pasta com arquivos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-init`, `git-status`, `git-add`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Pasta com bytes sentinela preexistentes.

**Ações:** Executar init e observar status antes de add.

**Oráculo / expectativa:** Init preserva bytes e não prepara arquivos automaticamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-status) · [3](https://git-scm.com/docs/git-add)

### INIT-003 — Reinicialização idempotente

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-init`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repositório com histórico, refs e índices.

**Ações:** Reexecutar init no mesmo caminho.

**Oráculo / expectativa:** Histórico e arquivos não devem ser substituídos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-show-ref)

### INIT-004 — Repositório bare

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-init`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Destino temporário sem workspace.

**Ações:** Criar --bare, listar refs e objetos.

**Oráculo / expectativa:** Não há projeção física; operações que exigem worktree têm resultado nativo apropriado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-rev-parse)

### INIT-005 — Clone comum com refs de Layer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clone`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Bare local com main e layer/ai.

**Ações:** Clonar normalmente sem hooks/templates herdados.

**Oráculo / expectativa:** Separar refs remotas recebidas, branch inicial local e ausência de metadados privados arbitrários.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clone) · [2](https://git-scm.com/docs/git-show-ref)

### INIT-006 — Clone single-branch e no-checkout

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clone`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem local com múltiplas branches.

**Ações:** Clonar --single-branch e --no-checkout em fixtures distintas.

**Oráculo / expectativa:** Apenas histórico/refs selecionados; no-checkout não materializa arquivos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clone) · [2](https://git-scm.com/docs/git-show-ref)

### INIT-007 — Clone bare versus mirror

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clone`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem com heads, tags e refs de recuperação sintéticas.

**Ações:** Comparar --bare e --mirror.

**Oráculo / expectativa:** Medir quais namespaces são copiados; mirror não é sinônimo de clone normal.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clone) · [2](https://git-scm.com/docs/git-show-ref)

### INIT-008 — Clone shallow e deepen

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clone`, `git-fetch`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor bare local; usar transporte que respeite --depth.

**Ações:** Clonar com profundidade e depois aprofundar/desfazer shallow.

**Oráculo / expectativa:** Limites de ancestralidade reconhecidos, sem interpretar objeto ausente como corrupção automática.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clone) · [2](https://git-scm.com/docs/git-fetch) · [3](https://git-scm.com/docs/git-rev-parse)

### INIT-009 — Clone parcial e backfill

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clone`, `git-backfill`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem local habilitada para filtros; capacidade detectada.

**Ações:** Clonar com filtro, acessar objeto ausente e executar backfill documentado.

**Oráculo / expectativa:** Distinguir placeholder promisor de perda; registrar fetch solicitado e resultado real.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clone) · [2](https://git-scm.com/docs/git-backfill) · [3](https://git-scm.com/docs/git-cat-file)

### INIT-010 — Clone local, alternates e dissociate

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clone`, `git-count-objects`, `git-fsck`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem imutável temporária.

**Ações:** Comparar --no-hardlinks, --shared, --reference e --dissociate em cópias.

**Oráculo / expectativa:** Provar dependência/independência de objetos; GC de uma fixture não pode danificar outra.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clone) · [2](https://git-scm.com/docs/git-count-objects) · [3](https://git-scm.com/docs/git-fsck)

### INIT-011 — Templates com arquivos adicionais

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-init`, `git-config`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Template controlado com sentinelas e hooks inofensivos.

**Ações:** Inicializar com --template e inspecionar resultado.

**Oráculo / expectativa:** Arquivos desconhecidos não pertencem automaticamente a Layers.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-config)

### INIT-012 — Movimentar repositório completo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rev-parse`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repo com metadados Layers e caminhos de recuperação a caracterizar.

**Ações:** Mover toda a fixture para caminho com espaços; reabrir.

**Oráculo / expectativa:** Descoberta Git permanece válida; localizar referências absolutas privadas que ficaram obsoletas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://git-scm.com/docs/git-status)


## INDEX — Staging, remoção, restauração e índice

### INDEX-001 — Add ponto na raiz

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-04, U-05, U-08

**Pré-condições:** Fixture main com README-base alterado, ordinary-new.txt não rastreado e Layer scripts ativa com tools/layer-only.txt modificado; snapshots de ambos os índices/refs e bytes.

**Ações:** Invocar Git oficial absoluto com add . na raiz, sem usar base-add do Core. Ler índice principal com ls-files --stage -z e diff --cached; ler os índices Layer separadamente.

**Oráculo / expectativa:** Índice principal contém mudanças esperadas da base e arquivo comum; não contém tools/layer-only.txt. HEAD/refs e índice da Layer preservados. Não concluir que houve commit.

**Avaliação do produto:** U-08: adição normal não contamina base. Comparar Git puro, N0-equivalent com mesmos ignores e implementação atual. Não adaptar expectativa para aceitar contaminação.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files) · [3](06-Decisoes-e-Autonomia.md)

### INDEX-002 — Add ponto no subdiretório

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mudanças dentro e fora de src; arquivos Layer nos dois locais.

**Ações:** Executar git add . dentro de src.

**Oráculo / expectativa:** Escopo relativo conforme Git; não preparar caminhos externos ao escopo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### INDEX-003 — Add all

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Adições, modificações e exclusões na árvore inteira.

**Ações:** Executar git add -A.

**Oráculo / expectativa:** Verificar inclusão de exclusões e cobertura de toda a árvore segundo versão.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-status)

### INDEX-004 — Add update

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo novo e mudanças em rastreados.

**Ações:** Executar git add -u.

**Oráculo / expectativa:** Novos não rastreados não se tornam preparados por engano.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-status)

### INDEX-005 — Add de caminho ignorado sem força

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-check-ignore`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo Layer protegido e arquivo ignorado comum.

**Ações:** Executar add explícito sem -f.

**Oráculo / expectativa:** Medir recusa e código; verificar ausência de preparação indevida.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-check-ignore)

### INDEX-006 — Add forçado de arquivo Layer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Layer ativa com exclusão efetiva.

**Ações:** Executar add -f -- arquivo-da-layer.

**Oráculo / expectativa:** Baseline confirma que -f contorna ignore; registrar contaminação como risco, não fingir bloqueio externo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### INDEX-007 — Add lote misto

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Base, Layer e arquivo sem proprietário.

**Ações:** Comparar add nativo a add gerenciado sobre o mesmo lote.

**Oráculo / expectativa:** Separar semântica nativa da recusa atômica de propriedade do produto atual.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### INDEX-008 — Add parcial interativo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Texto com dois hunks afastados.

**Ações:** Usar add -p em PTY e aceitar somente um hunk.

**Oráculo / expectativa:** Blob preparado contém apenas seleção; workspace conserva ambos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-diff)

### INDEX-009 — Editar patch interativo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Patch textual controlado e editor de fixture.

**Ações:** Exercitar add -e com patch válido e inválido.

**Oráculo / expectativa:** Patch inválido não vira preparação do arquivo inteiro.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-diff)

### INDEX-010 — Intent-to-add

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-ls-files`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo novo fora do índice.

**Ações:** Executar add -N e consultar índice/diffs.

**Oráculo / expectativa:** Preservar semântica da flag intent-to-add em comparações e commits posteriores.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://git-scm.com/docs/git-diff)

### INDEX-011 — Arquivo muda depois do add

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-commit`, `git-show`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo com versões A, B e C.

**Ações:** Preparar B, gravar C no disco e fazer commit.

**Oráculo / expectativa:** Commit contém B; C continua como alteração local.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-commit) · [3](https://git-scm.com/docs/git-show)

### INDEX-012 — Git rm normal e cached

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-rm`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo rastreado com cópia física.

**Ações:** Comparar rm, rm --cached e recusa sobre arquivo modificado.

**Oráculo / expectativa:** Separar remoção física de remoção do índice.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rm) · [2](https://git-scm.com/docs/git-ls-files)

### INDEX-013 — Git mv e detecção de rename

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-mv`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo rastreado e variantes com similaridade distinta.

**Ações:** Renomear, editar e consultar diff com e sem detecção.

**Oráculo / expectativa:** Git registra snapshots; rename exibido é inferência, não identidade persistente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-mv) · [2](https://git-scm.com/docs/git-diff)

### INDEX-014 — Restore disco versus staged

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-restore`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** HEAD=A, índice=B, disco=C.

**Ações:** Executar restore, restore --staged e restore --source em cópias independentes.

**Oráculo / expectativa:** Validar exatamente qual das três versões muda em cada variante.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-restore) · [2](https://git-scm.com/docs/git-ls-files)

### INDEX-015 — Reset por caminhos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-reset`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Dois caminhos preparados.

**Ações:** Executar reset -- um-caminho.

**Oráculo / expectativa:** HEAD fica inalterado; apenas seleção sai do staging.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-reset) · [2](https://git-scm.com/docs/git-diff)

### INDEX-016 — Índice alternativo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-read-tree`, `git-add`, `git-write-tree`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** GIT_INDEX_FILE aponta para caminho inexistente e exclusivo.

**Ações:** Inicializar índice alternativo, preparar e gravar árvore.

**Oráculo / expectativa:** Índice principal e HEAD não mudam; índice alternativo contém apenas o estado planejado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-read-tree) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-write-tree)

### INDEX-017 — Índice principal com lock ocupado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-commit`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** index.lock de fixture existente e processo proprietário conhecido.

**Ações:** Tentar stage/commit concorrente.

**Oráculo / expectativa:** Falha não remove lock alheio nem sobrescreve índice.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-commit)

### INDEX-018 — Add resolved disponível por capacidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Merge conflitante e mudanças não relacionadas; opção detectada.

**Ações:** Exercitar --resolved segundo manual da versão efetiva.

**Oráculo / expectativa:** Validar semântica contra baseline; indisponibilidade é separada de falha do produto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### INDEX-019 — Índice Layer legível e operável pelo Git oficial

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-ls-files`, `git-write-tree`, `git-read-tree`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-04

**Pré-condições:** Índice alternativo real produzido pelo produto em fixture e cópia de laboratório para experimentos de leitura/escrita.

**Ações:** Ler stage/mode/OID com Git nativo usando o índice alternativo. Na cópia, escrever tree e fazer roundtrip de leitura; conferir objetos e staging sem substituir o índice principal.

**Oráculo / expectativa:** Git reconhece o formato real, não um índice simulado. Entradas semânticas e conteúdo preservados; flags/backends/versões são capacidades declaradas, não igualdade binária presumida.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-ls-files) · [2](https://git-scm.com/docs/git-write-tree) · [3](https://git-scm.com/docs/git-read-tree) · [4](https://git-scm.com/docs/git-cat-file) · [5](06-Decisoes-e-Autonomia.md)

### INDEX-020 — Seleção de índice não vaza entre chamadas ou Layers

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-ls-files`, `git-write-tree`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-04, U-08

**Pré-condições:** Base e duas Layers com conteúdos staged distintos; subprocessos isolados em uma fixture.

**Ações:** Intercalar operações headless das Layers e adição nativa à base, capturando o índice efetivamente usado em cada invocação. Repetir em processo novo.

**Oráculo / expectativa:** Cada staging fica no índice esperado. GIT_INDEX_FILE não fica globalmente ativo nem faz comando da base usar índice Layer.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://git-scm.com/docs/git-write-tree) · [4](06-Decisoes-e-Autonomia.md)


## COMMIT — Commits, autores e histórico reescrito

### COMMIT-001 — Commit simples da base

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Somente arquivo base preparado.

**Ações:** Commit com mensagem determinística.

**Oráculo / expectativa:** Árvore corresponde ao índice e Layer não participa implicitamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-cat-file)

### COMMIT-002 — Commit all

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Rastreado modificado e arquivo novo não rastreado.

**Ações:** Executar commit -a -m.

**Oráculo / expectativa:** Apenas mudanças de rastreados entram conforme Git; validar arquivos Layer ignorados.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-status)

### COMMIT-003 — Commit por caminho

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-show`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Índice contém alteração A e disco contém alteração B em outro arquivo.

**Ações:** Commit -- arquivo selecionado.

**Oráculo / expectativa:** Conferir semântica nativa de seleção sem consumir inadvertidamente staging não relacionado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-show)

### COMMIT-004 — Commit only e include

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Vários caminhos preparados e não preparados.

**Ações:** Comparar --only e --include em fixtures independentes.

**Oráculo / expectativa:** Árvores e staging residual devem seguir cada modo real.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-diff)

### COMMIT-005 — Commit vazio deliberado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Workspace limpo.

**Ações:** Commit --allow-empty.

**Oráculo / expectativa:** Novo commit sem mudança de árvore; não inferir inexistência de operação pelo diff vazio.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-rev-list)

### COMMIT-006 — Recusa sem identidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-var`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Config isolada sem autor e useConfigOnly habilitado.

**Ações:** Tentar commit.

**Oráculo / expectativa:** Sem avanço de ref; preservar staging e bytes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-var)

### COMMIT-007 — Amend mensagem e conteúdo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Commit existente com descendência conhecida.

**Ações:** Amendar mensagem e depois conteúdo em cópias.

**Oráculo / expectativa:** Novo OID, pais conforme native; Layer deve detectar atualização externa do estado base.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-cat-file)

### COMMIT-008 — Autor diferente do committer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Identidades/datas fixadas por subprocesso.

**Ações:** Commit --author e variáveis de identidade.

**Oráculo / expectativa:** Preservar distinção de autoria e committer; nenhum vazamento de ambiente para outros testes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-cat-file)

### COMMIT-009 — Fixup e autosquash

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-rebase`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Sequência de commits com um fixup alvo.

**Ações:** Gerar --fixup e aplicar autosquash com editor de fixture.

**Oráculo / expectativa:** Mudanças finais e ordem observadas iguais ao baseline.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-rebase)

### COMMIT-010 — Mensagens, trailers e codificação

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-interpret-trailers`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mensagens com acentos, quebras e trailers.

**Ações:** Criar commit com -F, trailer e cleanup configurado.

**Oráculo / expectativa:** Não truncar mensagem nem confundir argumentos com shell.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-interpret-trailers)

### COMMIT-011 — Commit assinado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-verify-commit`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Chave efêmera em keyring temporário, capacidade detectada.

**Ações:** Assinar e verificar; repetir com assinatura exigida e indisponível.

**Oráculo / expectativa:** Não ignorar política de assinatura silenciosamente; chave real do usuário nunca é usada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-verify-commit)

### COMMIT-012 — Falha no hook de commit

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-commit`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Hook temporário que recusa explicitamente.

**Ações:** Tentar commit e depois --no-verify em fixture própria.

**Oráculo / expectativa:** Conferir refs, índice e execução dos hooks conforme opções.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-hook)

### COMMIT-013 — Reflog de commit e amend

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-reflog`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Histórico criado com identidade e tempo fixos.

**Ações:** Commit, amend, inspecionar reflog.

**Oráculo / expectativa:** Evidência registra OIDs anteriores sem exigir arquivos logs físicos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-reflog) · [2](https://git-scm.com/docs/git-show-ref)

### COMMIT-014 — Add ponto seguido de commit nativo não publica arquivo Layer na base

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-commit`, `git-ls-tree`, `git-cat-file`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-08

**Pré-condições:** Fixture de INDEX-001 com mudanças distinguíveis de base e Layer; identidade exclusivamente local.

**Ações:** Executar git add . e git commit pela instalação oficial. Conferir árvore e parents de main; comparar refs/índices das Layers e bytes. Rodar status do produto depois como observação separada.

**Oráculo / expectativa:** Commit da base contém somente o conjunto esperado. Uma suspensão posterior por EXTERNAL_HEAD é lacuna distinta e não autoriza contar arquivo Layer no commit como correto.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-commit) · [3](https://git-scm.com/docs/git-ls-tree) · [4](https://git-scm.com/docs/git-cat-file) · [5](https://git-scm.com/docs/git-show-ref) · [6](06-Decisoes-e-Autonomia.md)


## BRANCH — Branches, checkout e HEAD

### BRANCH-001 — Criar branch sem checkout

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`, `git-symbolic-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Base com dois commits.

**Ações:** Criar branch em revisão explícita.

**Oráculo / expectativa:** HEAD e disco permanecem; nova ref aponta para commit selecionado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-branch) · [2](https://git-scm.com/docs/git-symbolic-ref)

### BRANCH-002 — Criar e trocar branch

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-checkout`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Workspace limpo com alterações de árvore no destino.

**Ações:** Comparar switch -c e checkout -b.

**Oráculo / expectativa:** Branch ativa, índice e disco correspondem ao destino.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-checkout)

### BRANCH-003 — Troca preservando alterações compatíveis

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Alterações locais em arquivo não divergente no destino.

**Ações:** Trocar branch nativamente.

**Oráculo / expectativa:** Reproduzir política real de carry-over; não exigir limpeza total como se fosse regra universal do Git.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-status)

### BRANCH-004 — Troca com modificação que seria sobrescrita

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-checkout`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo tracked modificado que difere no destino.

**Ações:** Trocar sem força.

**Oráculo / expectativa:** Recusa preserva as alterações que o Git promete proteger.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-checkout)

### BRANCH-005 — Checkout com colisão em ignorado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-checkout`, `git-check-ignore`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo ignorado no disco e mesmo caminho tracked no destino.

**Ações:** Comparar checkout padrão a --no-overwrite-ignore.

**Oráculo / expectativa:** Registrar sobrescrita permitida nativamente versus recusa explícita; risco para projeções Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-check-ignore)

### BRANCH-006 — Checkout forçado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-checkout`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mudanças locais e caminhos ocupados em fixture descartável.

**Ações:** Executar checkout -f.

**Oráculo / expectativa:** Caracterizar descarte intencional nativo; não fabricar promessa de proteção da extensão.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-status)

### BRANCH-007 — Detached HEAD

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-symbolic-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Histórico com tag e commits.

**Ações:** Switch --detach, criar commit e retornar à branch.

**Oráculo / expectativa:** Commit destacado e reflog preservados conforme Git; produto não deve assumir HEAD sempre simbólico.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-symbolic-ref)

### BRANCH-008 — Branch orphan

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-checkout`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repo com histórico e arquivos.

**Ações:** Comparar switch --orphan e checkout --orphan em fixtures distintas.

**Oráculo / expectativa:** Novo histórico sem pais; diferenças de índice/worktree caracterizadas pelo native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-checkout)

### BRANCH-009 — Renomear branch ativa

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`, `git-symbolic-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branch base reconhecida pelo Git Layers.

**Ações:** Branch -m e -M em cópias.

**Oráculo / expectativa:** Mudança do nome não é mudança de proprietário dos arquivos Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-branch) · [2](https://git-scm.com/docs/git-symbolic-ref)

### BRANCH-010 — Excluir branch

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branches integrada, divergente e ativa.

**Ações:** Comparar -d, -D e tentativa de remover a ativa.

**Oráculo / expectativa:** Recusas/remoções seguem native; documentar refs Layer removidas externamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-branch) · [2](https://git-scm.com/docs/git-show-ref)

### BRANCH-011 — Tracking e upstream

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Remote bare temporário com tracking.

**Ações:** Definir/remover upstream e consultar @{upstream}.

**Oráculo / expectativa:** Config e resolução refletem upstream sem ativar Layer automaticamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-branch) · [2](https://git-scm.com/docs/git-rev-parse)

### BRANCH-012 — Colisão de nomes de ref

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`, `git-check-ref-format`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Refs ai, AI, ai/x e nomes Unicode em backend detectado.

**Ações:** Tentar combinações em files e reftable.

**Oráculo / expectativa:** Sem assumir que regras físicas do backend definem o namespace lógico do produto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-branch) · [2](https://git-scm.com/docs/git-check-ref-format)

### BRANCH-013 — Seleção de branch anterior e DWIM

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-checkout`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Duas branches e tracking com nomes coincidentes.

**Ações:** Exercitar switch - e seleção automática/--no-guess.

**Oráculo / expectativa:** Resolução conforme Git, sem interpretar layer/ como controle nativo especial.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-checkout)

### BRANCH-014 — Mudança de ignore/atributos no destino

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-check-attr`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branches diferem em .gitignore/.gitattributes.

**Ações:** Trocar branch com Layers limpas e modificadas.

**Oráculo / expectativa:** Caracterizar mudanças de exclusão/transformação antes de definir política do produto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-check-attr)

### BRANCH-015 — Limpeza de branches integradas por capacidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Opção de limpeza coletiva detectada em versão recente.

**Ações:** Exercitar --delete-merged conforme ajuda local, em refs descartáveis.

**Oráculo / expectativa:** Conferir conjunto excluído e proteção a branch atual; falta de opção não vira aprovação.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-branch)

### BRANCH-016 — Checkout nativo de branch com prefixo layer

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-checkout`, `git-symbolic-ref`, `git-ls-files`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-02, U-07

**Pré-condições:** Layer registrada inativa, main limpa e sentinelas; fixture descartável sem hooks de terceiros.

**Ações:** Invocar git checkout layer/<nome> pelo binário oficial; registrar HEAD, índice, arquivos e resultado posterior do diagnóstico do produto.

**Oráculo / expectativa:** Separar comportamento nativo real do alvo U-07. Não chamar instalação do subcomando de bloqueio. Mudança não impedida é lacuna de produto, não falha de ambiente.

**Avaliação do produto:** U-07 é alvo futuro, sem implementação nesta rodada. A caracterização nativa não pode mascarar a ausência de prevenção.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-symbolic-ref) · [3](https://git-scm.com/docs/git-ls-files) · [4](https://git-scm.com/docs/git-show-ref) · [5](06-Decisoes-e-Autonomia.md)

### BRANCH-017 — Switch nativo de branch com prefixo layer

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-switch`, `git-symbolic-ref`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-02, U-07

**Pré-condições:** Fixture equivalente a BRANCH-016, independente da tentativa de checkout.

**Ações:** Invocar git switch layer/<nome>; observar estado antes/depois e código. Variar Layer ativa/inativa em fixtures separadas e apenas pré-condições válidas.

**Oráculo / expectativa:** Verificar a transição efetiva e registrar lacuna em relação a ativar/desativar. Não deduzir bloqueio de switch apenas do teste de checkout.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://git-scm.com/docs/git-symbolic-ref) · [3](https://git-scm.com/docs/git-status) · [4](06-Decisoes-e-Autonomia.md)

### BRANCH-018 — Chamada absoluta ao Git não é prova do wrapper

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-checkout`, `git-switch`, `git-version`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-01, U-07

**Pré-condições:** Identidade/caminho do Git oficial conhecidos; eventual launcher de fixture não substitui esse binário.

**Ações:** Comparar o acesso gerenciado disponível com invocações absolutas de checkout/switch; registrar os executáveis reais e efeitos em fixtures separadas.

**Oráculo / expectativa:** Uma recusa do Core/wrapper não é atribuída ao Git nativo. Relatório explica exatamente qual superfície foi controlada, sem escolher solução técnica futura.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-switch) · [3](https://git-scm.com/docs/git-version) · [4](06-Decisoes-e-Autonomia.md)

### BRANCH-019 — Listagem de refs nativas versus classificação como Layer

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-branch`, `git-for-each-ref`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-02, U-05, U-07

**Pré-condições:** Branches tradicionais e refs/heads/layer/<nome> locais registradas e ainda não registradas.

**Ações:** Listar com Git puro; confrontar com listagem/classificação disponível na CLI do produto. Não abrir editor ou criar extensão visual.

**Oráculo / expectativa:** O prefixo permanece em refs/heads e não é convertido em novo tipo oficial por nomenclatura. Classificação do produto e listagem nativa são observações separadas.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-branch) · [2](https://git-scm.com/docs/git-for-each-ref) · [3](https://git-scm.com/docs/git-show-ref) · [4](06-Decisoes-e-Autonomia.md)

### BRANCH-020 — Erro de post-checkout não comprova prevenção de checkout

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-checkout`, `git-switch`, `git-symbolic-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-07

**Pré-condições:** Fixture com hook post-checkout sintético que registra evento e retorna erro; nenhum hook instalado em repositório real.

**Ações:** Executar checkout/switch e comparar eventos, código e estado físico antes/depois.

**Oráculo / expectativa:** Oráculo detecta se HEAD/worktree mudou apesar de erro. Não apresentar ação posterior como veto prévio; este teste estuda mecanismo Git, não implementa proteção no produto.

**Avaliação do produto:** Estudo técnico de mecanismo nativo; não é solução aprovada para U-07.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-switch) · [3](https://git-scm.com/docs/git-symbolic-ref) · [4](06-Decisoes-e-Autonomia.md) · [5](https://git-scm.com/docs/githooks)


## MERGE — Merge e classes de conflito

### MERGE-001 — Fast-forward

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Duas branches em relação ancestral.

**Ações:** Merge --ff-only.

**Oráculo / expectativa:** Ref avança sem merge commit adicional.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-rev-list)

### MERGE-002 — Merge commit explícito

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Históricos divergentes sem conflito.

**Ações:** Merge --no-ff.

**Oráculo / expectativa:** Commit tem pais corretos e árvore resultante esperada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-cat-file)

### MERGE-003 — Merge no-commit e squash

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mesmo par de branches sem conflito.

**Ações:** Comparar --no-commit e --squash.

**Oráculo / expectativa:** Separar índice preparado de histórico/pais; não tratar squash como merge já concluído.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-status)

### MERGE-004 — Conflito conteúdo-conteúdo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Ambas as branches alteram a mesma linha.

**Ações:** Merge e consultar ls-files -u.

**Oráculo / expectativa:** Índice contém estágios de conflito; marcadores no disco não são o único oráculo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-ls-files)

### MERGE-005 — Conflito add-add

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Duas branches adicionam mesmo caminho com bytes distintos.

**Ações:** Merge.

**Oráculo / expectativa:** Verificar versões e estágios existentes, não exigir stage 1 quando ausente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-ls-files)

### MERGE-006 — Conflito modify-delete

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Um lado modifica e outro remove.

**Ações:** Merge nas duas direções.

**Oráculo / expectativa:** Preservar versão recuperável e resultado de conflito conforme native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-ls-files)

### MERGE-007 — Conflitos de rename

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Rename/rename, rename/delete e rename/modify como variantes.

**Ações:** Executar merge com limite/similaridade fixados.

**Oráculo / expectativa:** Comparar caminhos, conflitos e árvores com baseline, não com nomes presumidos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-diff)

### MERGE-008 — Conflito arquivo versus diretório

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Uma branch usa tools como arquivo; outra usa tools/x.

**Ações:** Merge.

**Oráculo / expectativa:** Nomes de resolução e índices corretos; nenhuma perda silenciosa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-ls-files)

### MERGE-009 — Conflito binário

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo binário alterado dos dois lados.

**Ações:** Merge.

**Oráculo / expectativa:** Não interpretar ausência de marcadores textuais como ausência de conflito.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-ls-files)

### MERGE-010 — Resolver ours/theirs

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-checkout`, `git-restore`, `git-add`, `git-merge`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Merge em conflito já reproduzido.

**Ações:** Selecionar lado, add e concluir.

**Oráculo / expectativa:** Árvore final corresponde ao lado selecionado; base/Layers permanecem distintas conforme contrato.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-restore) · [3](https://git-scm.com/docs/git-add) · [4](https://git-scm.com/docs/git-merge)

### MERGE-011 — Abortar e continuar

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Merge pendente com estado anterior documentado.

**Ações:** Comparar --abort, resolução/--continue e --quit.

**Oráculo / expectativa:** Validar semântica específica; quit não equivale a restaurar todo o workspace.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-status)

### MERGE-012 — Reuso de resolução rerere

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rerere`, `git-merge`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mesmo conflito reproduzido duas vezes com rerere local.

**Ações:** Resolver primeira vez e observar segunda.

**Oráculo / expectativa:** Reuso não comita nem modifica índices de Layers sem contrato explícito.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rerere) · [2](https://git-scm.com/docs/git-merge)

### MERGE-013 — Merge de históricos independentes

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Duas raízes sem ancestral comum.

**Ações:** Comparar recusa padrão e --allow-unrelated-histories.

**Oráculo / expectativa:** Histórico de Layer independente não deve ser mesclado à base por acidente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge)

### MERGE-014 — Merge octopus e estratégias

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Três branches simples e estratégia selecionada.

**Ações:** Exercitar múltiplos pais e estratégias documentadas detectadas.

**Oráculo / expectativa:** Conferir pais/árvore; não declarar suporte de estratégia ausente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://git-scm.com/docs/git-cat-file)

### MERGE-015 — Merge tree sem tocar workspace

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-merge-tree`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branches divergentes, com e sem conflitos.

**Ações:** Calcular merge-tree em modo documentado.

**Oráculo / expectativa:** Separar objeto/resultado calculado de atualização efetiva de HEAD/índice/worktree.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge-tree) · [2](https://git-scm.com/docs/git-cat-file)


## REWRITE — Rebase, cherry-pick, revert e replay

### REWRITE-001 — Rebase linear

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rebase`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branch de trabalho e base avançada.

**Ações:** Rebase sobre nova base.

**Oráculo / expectativa:** Mudanças reaplicadas; novos OIDs/pais, sem duplicar arquivos Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-rev-list)

### REWRITE-002 — Rebase com conflito e continue

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rebase`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Commits que conflitam com nova base.

**Ações:** Resolver e continuar.

**Oráculo / expectativa:** Sequência retoma corretamente, índice deixa estágios de conflito.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-ls-files)

### REWRITE-003 — Rebase abort skip quit

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rebase`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Rebase parado em conflito em três cópias.

**Ações:** Comparar --abort, --skip e --quit.

**Oráculo / expectativa:** Efeitos distintos medidos em refs, disco e sequenciador.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-status)

### REWRITE-004 — Rebase interativo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rebase`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Quatro commits e sequence editor determinístico.

**Ações:** Exercitar reorder, squash, fixup, reword e edit como variantes.

**Oráculo / expectativa:** Histórico final comparado semanticamente com baseline e plano de edição.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-cat-file)

### REWRITE-005 — Rebase preservando merges

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rebase`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Histórico com merge interno.

**Ações:** Executar --rebase-merges.

**Oráculo / expectativa:** Estrutura de pais preservada/recriada conforme native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-rev-list)

### REWRITE-006 — Rebase com autostash

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rebase`, `git-stash`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branch suja com alterações que não pertencem à sequência.

**Ações:** Usar --autostash, incluindo caso de conflito ao reaplicar.

**Oráculo / expectativa:** Alterações locais não desaparecem; verificar stash residual se reaplicação falhar.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-stash)

### REWRITE-007 — Cherry-pick simples e no-commit

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-cherry-pick`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Commit selecionado em branch paralela.

**Ações:** Comparar modo normal e -n.

**Oráculo / expectativa:** Distinguir novo commit de alterações só no índice/worktree.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cherry-pick) · [2](https://git-scm.com/docs/git-status)

### REWRITE-008 — Cherry-pick de merge

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-cherry-pick`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Merge commit com dois pais conhecidos.

**Ações:** Aplicar com -m 1 e -m 2 em cópias.

**Oráculo / expectativa:** Alterações dependem do parent escolhido; ausência de -m deve seguir recusa native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cherry-pick) · [2](https://git-scm.com/docs/git-cat-file)

### REWRITE-009 — Cherry-pick em sequência com conflito

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-cherry-pick`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Três commits, conflito no segundo.

**Ações:** Testar continue, skip e abort.

**Oráculo / expectativa:** Estado sequencial e alterações anteriores/posteriores conferidos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cherry-pick) · [2](https://git-scm.com/docs/git-ls-files)

### REWRITE-010 — Revert simples e sequência

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-revert`, `git-show`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Histórico com alterações independentes e dependentes.

**Ações:** Reverter um e vários commits.

**Oráculo / expectativa:** Novo histórico desfaz alterações sem apagar commits originais.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-revert) · [2](https://git-scm.com/docs/git-show)

### REWRITE-011 — Revert de merge e conflitos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-revert`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Merge com mainline conhecido.

**Ações:** Revert -m; resolver/abortar conflito como variantes.

**Oráculo / expectativa:** Semântica de mainline e sequenciador medida.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-revert) · [2](https://git-scm.com/docs/git-ls-files)

### REWRITE-012 — Reset soft mixed hard

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-reset`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** HEAD=A, índice=B, disco=C, commit anterior disponível.

**Ações:** Comparar --soft, --mixed e --hard em fixtures isoladas.

**Oráculo / expectativa:** Ref, índice e disco mudam segundo o modo; Layer sujeita a descarte externo é registrada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-reset) · [2](https://git-scm.com/docs/git-status)

### REWRITE-013 — Reset merge e keep

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-reset`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mudanças locais sobre commits diferentes.

**Ações:** Exercitar --merge e --keep.

**Oráculo / expectativa:** Proteger/recusar mudanças conforme Git; não generalizar semântica de --hard.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-reset) · [2](https://git-scm.com/docs/git-status)

### REWRITE-014 — Replay disponível por capacidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-replay`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Grafo pequeno de commits e opções confirmadas no manual local.

**Ações:** Reaplicar usando replay sem interface gráfica.

**Oráculo / expectativa:** Capturar plano/refs/árvore e distinguir operação calculada de aplicada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-replay) · [2](https://git-scm.com/docs/git-rev-list)

### REWRITE-015 — History disponível por capacidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-history`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Comando recente detectado; fixture com três commits.

**Ações:** Exercitar subcomandos documentados, incluindo drop quando disponível.

**Oráculo / expectativa:** Usar native da mesma versão como oráculo; não supor sintaxe em versões antigas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-history) · [2](https://git-scm.com/docs/git-rev-list)


## STASH — Stash, limpeza e recuperação nativa

### STASH-001 — Stash padrão

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Tracked modificado, untracked e ignorado.

**Ações:** Stash push sem opções.

**Oráculo / expectativa:** Registrar o que é guardado e o que permanece no disco.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-status)

### STASH-002 — Stash com untracked

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mesmo conjunto de arquivos.

**Ações:** Stash push -u.

**Oráculo / expectativa:** Untracked incluídos, ignorados tratados conforme native; não confundir -u com -a.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-status)

### STASH-003 — Stash com todos e arquivos Layer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Layers projetadas são ignoradas na base.

**Ações:** Stash push -a.

**Oráculo / expectativa:** Registrar incorporação/remoção de ignorados e risco de misturar conteúdo Layer com stash da base.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-cat-file)

### STASH-004 — Keep-index e staged-only

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mesmo arquivo com versão staged e unstaged.

**Ações:** Comparar --keep-index e --staged.

**Oráculo / expectativa:** Separação entre índice e disco explicitamente verificada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-ls-files)

### STASH-005 — Stash por caminho e por patch

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Vários arquivos e hunks.

**Ações:** Exercitar pathspec e modo patch em PTY.

**Oráculo / expectativa:** Apenas seleção documentada é guardada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-diff)

### STASH-006 — Stash apply versus pop

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Stash aplicável e stash conflitante.

**Ações:** Comparar apply e pop.

**Oráculo / expectativa:** Verificar retenção do stash, especialmente após conflito.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-status)

### STASH-007 — Stash apply index

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Stash criado com staging distinto do disco.

**Ações:** Aplicar --index.

**Oráculo / expectativa:** Preparação recuperada quando possível; conflito não pode ser apresentado como sucesso completo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-ls-files)

### STASH-008 — Stash branch drop clear

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Vários stashes em fixture.

**Ações:** Criar branch, excluir entrada e limpar em cópias.

**Oráculo / expectativa:** Refs/conteúdo seguem native; comandos destrutivos só na fixture.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash) · [2](https://git-scm.com/docs/git-show-ref)

### STASH-009 — Stash export/import por capacidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-stash`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Opções detectadas no Git efetivo.

**Ações:** Exportar/importar stash entre fixtures locais conforme manual.

**Oráculo / expectativa:** Verificar árvore, índice e ausência de metadados Layers indevidos no transporte.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stash)

### STASH-010 — Clean dry-run normal e diretórios

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clean`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Untracked, ignorados, subdiretório e arquivo sentinela fora da fixture.

**Ações:** Comparar -n, -f e -fd.

**Oráculo / expectativa:** Lista prevista corresponde à remoção; sentinela externa intacta.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clean)

### STASH-011 — Clean incluindo ou só ignorados

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clean`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo Layer projetado, ignorado comum e untracked.

**Ações:** Comparar -fdx e -fdX em cópias.

**Oráculo / expectativa:** Demonstrar comportamento native destrutivo; classificação de compatibilidade não mascara exclusão.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clean)

### STASH-012 — Clean interativo exclusões e nested repo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-clean`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Nested repo descartável e itens excluídos por -e.

**Ações:** Executar modo interativo e combinações de força só na fixture.

**Oráculo / expectativa:** Não apagar o repositório de desenvolvimento; respeitar distinção de força adicional do Git.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-clean)

### STASH-013 — Reflog resgate e lost-found

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-reflog`, `git-fsck`, `git-branch`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Commit abandonado por reset na fixture.

**Ações:** Localizar pelo reflog/fsck e criar ref de resgate.

**Oráculo / expectativa:** Recuperação depende de objeto ainda existente; não prometer bytes nunca persistidos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-reflog) · [2](https://git-scm.com/docs/git-fsck) · [3](https://git-scm.com/docs/git-branch)


## REMOTE — Remotos, fetch, pull, push e namespaces

### REMOTE-001 — Remote add rename remove

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-remote`, `git-config`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Bare local e working repo descartável.

**Ações:** Adicionar, renomear e remover remote.

**Oráculo / expectativa:** Config e tracking mudam conforme Git; nenhum serviço externo é acessado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-remote) · [2](https://git-scm.com/docs/git-config)

### REMOTE-002 — Fetch sem modificar workspace

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-fetch`, `git-ls-remote`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem local avança main e Layer.

**Ações:** Fetch e comparar refs/índice/bytes.

**Oráculo / expectativa:** Fetch pode atualizar tracking e FETCH_HEAD; não é checkout nem registro de Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fetch) · [2](https://git-scm.com/docs/git-ls-remote)

### REMOTE-003 — Refspec explícito e negativo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-fetch`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem com main e três refs layer/.

**Ações:** Exercitar mapeamento seletivo e exclusão por refspec negativo.

**Oráculo / expectativa:** Conjunto recebido corresponde ao refspec; não supor que todas as Layers chegam.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fetch) · [2](https://git-scm.com/docs/git-show-ref)

### REMOTE-004 — Fetch prune e tags

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-fetch`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Origem remove branch e muda conjunto de tags.

**Ações:** Fetch --prune, opções de tags e prune-tags em cópias.

**Oráculo / expectativa:** Não excluir referência local fora da semântica documentada do refspec.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fetch) · [2](https://git-scm.com/docs/git-show-ref)

### REMOTE-005 — Pull fast-forward

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-pull`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Tracking configurado e branch sem divergência.

**Ações:** Pull --ff-only em origem local.

**Oráculo / expectativa:** Avança base; detectar efeito sobre composição sem duplicar commits Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-pull) · [2](https://git-scm.com/docs/git-rev-list)

### REMOTE-006 — Pull merge e rebase

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-pull`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Históricos divergentes com e sem conflito.

**Ações:** Comparar --no-rebase, --rebase e configuração pull.rebase.

**Oráculo / expectativa:** Distinguir operações e estados pendentes reais.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-pull) · [2](https://git-scm.com/docs/git-ls-files)

### REMOTE-007 — Push somente main

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-ls-remote`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Refs main, layer/ai e refs sintéticas de recuperação.

**Ações:** Push explícito main para bare local.

**Oráculo / expectativa:** Apenas ref selecionada e objetos necessários; pasta privada não é enviada como diretório.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-ls-remote)

### REMOTE-008 — Push Layer explícita

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-ls-remote`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Layer commitada, modificações locais e shelf privada.

**Ações:** Push explícito da ref Layer.

**Oráculo / expectativa:** Transmitir histórico commitado, não staging/disco/shelf por acidente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-ls-remote)

### REMOTE-009 — Push all

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-ls-remote`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Várias heads incluindo layer/.

**Ações:** Push --all para bare descartável.

**Oráculo / expectativa:** Como Layers são heads, podem entrar no envio; política de privacidade não pode supor o contrário.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-ls-remote)

### REMOTE-010 — Push mirror e refs de recuperação

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-ls-remote`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Refs fora de heads apontam para conteúdo sintético sensível.

**Ações:** Push --mirror somente para bare local.

**Oráculo / expectativa:** Medir publicação de refs extras; namespace não confere confidencialidade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-ls-remote) · [3](https://git-scm.com/docs/git-cat-file)

### REMOTE-011 — Push force versus lease

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Dois clones locais concorrentes e remote avançado.

**Ações:** Comparar rejeição non-FF, --force e --force-with-lease.

**Oráculo / expectativa:** Lease obsoleto recusa conforme native; nenhum remote real utilizado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-show-ref)

### REMOTE-012 — Push atomic e hook de recusa

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-receive-pack`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor bare com hook controlado que recusa uma ref.

**Ações:** Enviar duas refs com e sem --atomic.

**Oráculo / expectativa:** Atomicidade observada no servidor; falha não se torna sucesso parcial oculto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-receive-pack)

### REMOTE-013 — Excluir e recriar Layer remota

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-fetch`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Layer registrada no clone e ref removida na origem.

**Ações:** Push --delete, fetch e recriação em fixtures.

**Oráculo / expectativa:** Atualização externa não pode resetar índice privado silenciosamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-fetch)

### REMOTE-014 — URL e transporte

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-remote`, `git-url-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** URLs file, ssh, https sintéticas sem credenciais.

**Ações:** Analisar com url-parse quando disponível e aplicar configuração local de protocolo.

**Oráculo / expectativa:** Nenhuma conexão fora de loopback; parser não executa comandos embutidos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-remote) · [2](https://git-scm.com/docs/git-url-parse)

### REMOTE-015 — Falha e cancelamento de transporte

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-fetch`, `git-push`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor local que interrompe a conexão controladamente.

**Ações:** Interromper transferência durante fetch/push.

**Oráculo / expectativa:** Não declarar refs/objetos completos sem confirmação; estado deve ser diagnosticável.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fetch) · [2](https://git-scm.com/docs/git-push)

### REMOTE-016 — Push transporta commits e não o staging local

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-ls-remote`, `git-cat-file`, `git-ls-tree`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-02, U-04

**Pré-condições:** Remoto bare temporário, commit Layer A, staging B e disco C distintos; nenhum remoto real.

**Ações:** Push explícito da ref layer/<nome>; verificar commit/tree/blobs referenciados no receptor, índices locais e bytes no disco.

**Oráculo / expectativa:** Ref remota aponta ao commit selecionado A, não ao staging B ou disco C. Não existe suposto índice de push por branch. Objetos incidentais não são inferidos como publicados por aparecerem no banco local.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-ls-remote) · [3](https://git-scm.com/docs/git-cat-file) · [4](https://git-scm.com/docs/git-ls-tree) · [5](06-Decisoes-e-Autonomia.md)


## WORKTREE — Worktrees, submódulos e índices especiais

### WORKTREE-001 — Segundo worktree de branch diferente

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-worktree`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repo com duas branches e pasta de destino temporária.

**Ações:** Criar worktree, consultar commonDir e gitDir.

**Oráculo / expectativa:** Refs/objetos compartilhados; HEAD/índices próprios devem permanecer independentes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-worktree) · [2](https://git-scm.com/docs/git-rev-parse)

### WORKTREE-002 — Mesmo arquivo Layer em dois worktrees

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-worktree`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Uma Layer e duas árvores de trabalho, quando produto permitir.

**Ações:** Caracterizar ativação independente e staging simultâneo.

**Oráculo / expectativa:** Definir contrato de compartilhamento da ref versus índice/projeção por worktree; atual recusa não é compatibilidade plena.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-worktree) · [2](https://git-scm.com/docs/git-ls-files)

### WORKTREE-003 — Worktree detached e branch já usada

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-worktree`, `git-symbolic-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branch ativa em um worktree.

**Ações:** Tentar reutilizar e criar detached em outro.

**Oráculo / expectativa:** Recusas/forças conforme native; não furar proteção de branch por conveniência.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-worktree) · [2](https://git-scm.com/docs/git-symbolic-ref)

### WORKTREE-004 — Worktree move repair remove prune

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-worktree`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Worktree adicional com sentinelas.

**Ações:** Mover, reparar, remover e prune em cópias independentes.

**Oráculo / expectativa:** Metadados Layers acompanham escopo correto ou apontam lacuna explícita.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-worktree) · [2](https://git-scm.com/docs/git-rev-parse)

### WORKTREE-005 — Worktree lock e armazenamento removível

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-worktree`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Worktree temporariamente indisponível simulado sem remover dados pessoais.

**Ações:** Lock/list/prune/unlock.

**Oráculo / expectativa:** Prune respeita lock conforme Git; distinguir do lock interno de Layers.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-worktree)

### WORKTREE-006 — Config por worktree e excludes comuns

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-config`, `git-check-ignore`, `git-worktree`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Dois worktrees com escolhas de Layers distintas.

**Ações:** Habilitar worktreeConfig na fixture e inspecionar info/exclude.

**Oráculo / expectativa:** Detectar efeito cruzado de exclusões comuns; não assumir que pasta layers resolve esse problema.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://git-scm.com/docs/git-check-ignore) · [3](https://git-scm.com/docs/git-worktree)

### WORKTREE-007 — Submódulo adicionado e atualizado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-submodule`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Superprojeto e sub-repo locais.

**Ações:** Add/init/update/status de submódulo.

**Oráculo / expectativa:** Gitlink 160000 não é arquivo comum; não materializar como blob de Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-submodule) · [2](https://git-scm.com/docs/git-ls-files)

### WORKTREE-008 — Submódulo dirty e recursivo

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-submodule`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Submódulo com alterações e submódulo aninhado.

**Ações:** Consultar status/diff e operações --recurse-submodules.

**Oráculo / expectativa:** Preservar limite de repositório e semântica de recursão.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-submodule) · [2](https://git-scm.com/docs/git-status)

### WORKTREE-009 — Submódulo deinit absorbgitdirs

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-submodule`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Submódulo com gitdir próprio.

**Ações:** Exercitar deinit e absorbgitdirs em cópias.

**Oráculo / expectativa:** Reconhecer gitfiles e metadados movidos; não confundir com .git normal.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-submodule) · [2](https://git-scm.com/docs/git-rev-parse)

### WORKTREE-010 — Sparse checkout cone e não cone

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-sparse-checkout`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Árvore com diretórios selecionados e excluídos.

**Ações:** Set/add/list/reapply/disable em ambos os modos.

**Oráculo / expectativa:** Arquivos omitidos não são removidos do histórico; efeitos sobre Layers caracterizados.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-sparse-checkout) · [2](https://git-scm.com/docs/git-ls-files)

### WORKTREE-011 — Sparse index e split index

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-sparse-checkout`, `git-update-index`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Índice com capacidade correspondente.

**Ações:** Ativar sparse-index e split-index separadamente.

**Oráculo / expectativa:** Não assumir índice plano; leitura native representa estado completo corretamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-sparse-checkout) · [2](https://git-scm.com/docs/git-update-index) · [3](https://git-scm.com/docs/git-ls-files)

### WORKTREE-012 — Skip-worktree e assume-unchanged

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-update-index`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivos tracked com flags específicas.

**Ações:** Alterar bytes e consultar status; depois remover flags.

**Oráculo / expectativa:** Flags não são propriedade de Layer nem proteção geral contra sobrescrita.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-index) · [2](https://git-scm.com/docs/git-diff)

### WORKTREE-013 — Untracked cache e fsmonitor

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-update-index`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repo com muitos untracked e monitor controlado ou indisponível.

**Ações:** Ativar/desativar caches e repetir consultas/mutações.

**Oráculo / expectativa:** Resultado semântico equivale ao baseline sem cache; diferenças estatísticas do índice não são corrupção.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-index) · [2](https://git-scm.com/docs/git-status)

### WORKTREE-014 — Worktree add com ref de Layer

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-worktree`, `git-symbolic-ref`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-02, U-07

**Pré-condições:** Repositório/refs Layer de fixture; suporte nativo a worktree detectado.

**Ações:** Criar worktree temporário apontando a layer/<nome>; observar seleção e distribuição de índices/metadados. Consultar comportamento do produto separadamente sem exigir suporte que não existe.

**Oráculo / expectativa:** Cobrir rota de seleção diferente de checkout/switch no worktree principal. Recusa do produto a múltiplos worktrees não comprova prevenção no Git oficial.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-worktree) · [2](https://git-scm.com/docs/git-symbolic-ref) · [3](https://git-scm.com/docs/git-ls-files) · [4](06-Decisoes-e-Autonomia.md)


## PATH — Caminhos, tipos de arquivo e atributos

### PATH-001 — Espaços acentos e Unicode

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Nomes Unicode em NFC e NFD conforme filesystem.

**Ações:** Stage/commit/off-on em fixtures de cada grafia.

**Oráculo / expectativa:** Não normalizar ou renomear silenciosamente; suporte depende de plataforma e contrato explícito.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### PATH-002 — Caixa de arquivos e diretórios

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-mv`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Foo/foo e Config/config em filesystem com capacidade medida.

**Ações:** Criar colisões e renomes apenas de caixa.

**Oráculo / expectativa:** Comparar comportamento real sem fingir sensibilidade do filesystem.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-mv)

### PATH-003 — Nomes reservados e caminhos longos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Limites físicos medidos, nomes Windows especiais somente em plataforma apta.

**Ações:** Criar e consultar caminhos extremos.

**Oráculo / expectativa:** Recusa é preservada como limitação; não contar cenário impossível como aprovação.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-status)

### PATH-004 — Hífen inicial e caracteres de pathspec

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Nomes começando por hífen e contendo colchetes/exclamação.

**Ações:** Usar -- e modo literal.

**Oráculo / expectativa:** Nenhum arquivo vizinho é selecionado por expansão involuntária.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### PATH-005 — Pathspec glob exclude top e icase

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Conjunto conhecido de nomes e subdiretórios.

**Ações:** Exercitar magics documentadas em comandos que aceitam pathspec.

**Oráculo / expectativa:** Interpretar magics conforme Git; nomes literais não devem ser confundidos com opções.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-diff)

### PATH-006 — Entradas NUL via arquivo de pathspec

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-restore`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Nomes com espaços/quebras onde permitidos; capacidades detectadas.

**Ações:** Usar --pathspec-from-file e --pathspec-file-nul.

**Oráculo / expectativa:** Não dividir nomes por espaço/newline; contagem de caminhos deve ser exata.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-restore)

### PATH-007 — Bytes LF CRLF e mixed EOL

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-show`, `git-check-attr`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Textos com três variantes e autocrlf false/true/input.

**Ações:** Comparar bytes de disco, blob e rematerialização.

**Oráculo / expectativa:** Objeto normalizado e disco não são necessariamente idênticos; oráculo considera atributos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-show) · [3](https://git-scm.com/docs/git-check-attr)

### PATH-008 — Atributos por diretório global e index

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-check-attr`, `git-add`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Regras em raiz, subdiretório, info/attributes e config isolada.

**Ações:** Comparar atributos efetivos no disco e --cached.

**Oráculo / expectativa:** Não usar atributos da Layer errada nem ignorar precedência.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-check-attr) · [2](https://git-scm.com/docs/git-add)

### PATH-009 — Arquivo binário vazio e grande

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-hash-object`, `git-add`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** NULs, bytes inválidos UTF-8, zero bytes e arquivo grande controlado.

**Ações:** Preparar/commitar e consultar objetos sem editor.

**Oráculo / expectativa:** Core não deve herdar limite textual de 4 MiB do editor como limite geral sem decisão explícita.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-cat-file)

### PATH-010 — Executabilidade e filemode

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-update-index`, `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Modo 100644/100755 com suporte físico detectado.

**Ações:** Alterar modo e repetir core.filemode true/false.

**Oráculo / expectativa:** Preservar modo Git independentemente de representação limitada do Windows.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-index) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-ls-files)

### PATH-011 — Symlink hardlink junction e especiais

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-add`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Alvos e sentinelas dentro/fora da fixture; criação condicionada a privilégios.

**Ações:** Caracterizar native e recusa Layer sem seguir links perigosos.

**Oráculo / expectativa:** Nenhuma escrita fora da fixture; segurança da recusa separada da cobertura funcional.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-ls-files)

### PATH-012 — Clean/smudge filter e process filter

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-config`, `git-check-attr`, `git-add`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Filtros de fixture determinísticos que registram chamadas.

**Ações:** Exercitar filtros bem-sucedidos, required e falhos.

**Oráculo / expectativa:** Não executar filtros reais do usuário; verificar transformação, índice e rollback.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://git-scm.com/docs/git-check-attr) · [3](https://git-scm.com/docs/git-add)

### PATH-013 — Working-tree-encoding ident e diff driver

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-check-attr`, `git-add`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Atributos suportados pelo Git local e conversores controlados.

**Ações:** Comparar index/worktree/textconv.

**Oráculo / expectativa:** Não assumir texto UTF-8 universal nem chamar ausência de transformação de compatibilidade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-check-attr) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-diff)

### PATH-014 — Ignore precedência e negação

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-check-ignore`, `git-add`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Regras em .gitignore, info/exclude, excludesFile e subdiretório.

**Ações:** Testar negação tardia, wildcard e arquivo já rastreado.

**Oráculo / expectativa:** Ignore não desrastreia arquivo; proteção de Layer precisa comprovar regra efetiva.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-check-ignore) · [2](https://git-scm.com/docs/git-add)

### PATH-015 — Empty directories e nested repository

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-status`, `git-add`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Diretório vazio e repo aninhado descartável.

**Ações:** Consultar e tentar adicionar.

**Oráculo / expectativa:** Diretório vazio não é entrada de arquivo versionada; nested repo é tratado conforme Git.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-add)


## INSPECT — Consultas, diffs e histórico

### INSPECT-001 — Status estável para automação

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Adicionado, modificado, removido, renamed, ignored e unmerged.

**Ações:** Comparar humano, porcelain v1/v2 e -z.

**Oráculo / expectativa:** Parser usa formato estável, suporta conflitos e nomes sem ambiguidade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status)

### INSPECT-002 — Diff workspace índice e commits

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-diff`, `git-diff-files`, `git-diff-index`, `git-diff-tree`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** HEAD=A, índice=B, disco=C.

**Ações:** Consultar pares correspondentes e --cached.

**Oráculo / expectativa:** Distinguir três comparações; não misturar owner base e Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-diff) · [2](https://git-scm.com/docs/git-diff-files) · [3](https://git-scm.com/docs/git-diff-index) · [4](https://git-scm.com/docs/git-diff-tree)

### INSPECT-003 — Saídas raw numstat name-status

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivos binários, renames e nomes especiais.

**Ações:** Comparar formatos -z e códigos --exit-code/--quiet.

**Oráculo / expectativa:** Código 1 de diferença não é erro de execução.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-diff)

### INSPECT-004 — Algoritmos e whitespace

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Texto com blocos repetidos, espaços e linhas movidas.

**Ações:** Comparar histogram/patience/minimal e opções de whitespace.

**Oráculo / expectativa:** Não usar saída textual exata de outro algoritmo como único oráculo de conteúdo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-diff)

### INSPECT-005 — Log de caminhos e follow

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-log`, `git-show`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Histórico de rename e merges.

**Ações:** Log -- path, --follow e show de commits.

**Oráculo / expectativa:** Consultar árvores corretas sem inventar identidade fixa de arquivo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-log) · [2](https://git-scm.com/docs/git-show)

### INSPECT-006 — Ranges e simetria

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-rev-list`, `git-log`, `git-range-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Históricos divergentes com patches equivalentes.

**Ações:** Exercitar A..B, A...B e range-diff.

**Oráculo / expectativa:** Conjuntos/ranges seguem revisões Git, não simples diferenças de nomes de branch.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-list) · [2](https://git-scm.com/docs/git-log) · [3](https://git-scm.com/docs/git-range-diff)

### INSPECT-007 — Blame annotate last-modified

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-blame`, `git-annotate`, `git-last-modified`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Linhas movidas/copied em histórico pequeno; último comando capability-gated.

**Ações:** Inspecionar autoria e última alteração.

**Oráculo / expectativa:** Resultados relacionam paths/commits sem alterar refs ou índices.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-blame) · [2](https://git-scm.com/docs/git-annotate) · [3](https://git-scm.com/docs/git-last-modified)

### INSPECT-008 — Grep em worktree index e revisão

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-grep`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Texto distinto em disco, índice e commit.

**Ações:** Comparar grep, --cached e revisão explícita.

**Oráculo / expectativa:** Busca distingue snapshot e não atribui resultados à Layer errada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-grep)

### INSPECT-009 — Describe name-rev format-rev

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-describe`, `git-name-rev`, `git-format-rev`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Tags e referências com alcances conhecidos.

**Ações:** Gerar nomes/revisões usando sintaxe documentada disponível.

**Oráculo / expectativa:** Não depender de nome humano para identidade; objetos continuam verificáveis pelo OID.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-describe) · [2](https://git-scm.com/docs/git-name-rev) · [3](https://git-scm.com/docs/git-format-rev)

### INSPECT-010 — Shortlog mailmap trailers

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-shortlog`, `git-check-mailmap`, `git-interpret-trailers`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Autores equivalentes em .mailmap e mensagens com trailers.

**Ações:** Agregar e interpretar.

**Oráculo / expectativa:** Mapeamento de exibição não reescreve objetos sem comando explícito.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-shortlog) · [2](https://git-scm.com/docs/git-check-mailmap) · [3](https://git-scm.com/docs/git-interpret-trailers)

### INSPECT-011 — Notes add edit merge prune

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-notes`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Refs notes locais com textos sintéticos.

**Ações:** Adicionar/editar/mesclar notas e inspecionar namespaces.

**Oráculo / expectativa:** Notas não entram na árvore da base ou Layer automaticamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-notes) · [2](https://git-scm.com/docs/git-show-ref)

### INSPECT-012 — Tags leves anotadas e verificadas

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-tag`, `git-verify-tag`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Tags dos dois tipos e chave efêmera opcional.

**Ações:** Criar, listar, verificar, mover e excluir em cópias.

**Oráculo / expectativa:** Ref de tag pode apontar a tag object; não assumir todo OID de ref é commit direto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-tag) · [2](https://git-scm.com/docs/git-verify-tag) · [3](https://git-scm.com/docs/git-cat-file)

### INSPECT-013 — Show-branch e cherry

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-show-branch`, `git-cherry`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Branches com commits distintos e patches equivalentes.

**Ações:** Comparar relações e equivalência de patches.

**Oráculo / expectativa:** Não confundir identidade de commit com equivalência de patch.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-branch) · [2](https://git-scm.com/docs/git-cherry)

### INSPECT-014 — Consultas legadas e diagnose

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-whatchanged`, `git-bugreport`, `git-diagnose`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Fixture sem informações reais do usuário.

**Ações:** Executar comandos disponíveis com saída em pasta temporária.

**Oráculo / expectativa:** Caracterizar disponibilidade/depreciação; relatório não expõe dados pessoais nem altera histórico.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-whatchanged) · [2](https://git-scm.com/docs/git-bugreport) · [3](https://git-scm.com/docs/git-diagnose)


## PATCH — Patches, arquivos de distribuição e importação

### PATCH-001 — Apply check e aplicação direta

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-apply`, `git-diff`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Patch válido e patch inaplicável.

**Ações:** Comparar --check e aplicação.

**Oráculo / expectativa:** Check não altera; falha não deve virar sucesso nem patch integral inesperado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-apply) · [2](https://git-scm.com/docs/git-diff)

### PATCH-002 — Apply index cached reverse

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-apply`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Índice e disco com versões distintas.

**Ações:** Exercitar --index, --cached e -R em cópias.

**Oráculo / expectativa:** Verificar exatamente índice/disco afetados.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-apply) · [2](https://git-scm.com/docs/git-ls-files)

### PATCH-003 — Apply 3way e reject

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-apply`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Patch com blob base conhecido e conflitos locais.

**Ações:** Comparar --3way e --reject onde compatíveis.

**Oráculo / expectativa:** Conflitos/rejects são resultados explícitos; não inferir atomicidade de opções que não a prometem.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-apply) · [2](https://git-scm.com/docs/git-ls-files)

### PATCH-004 — Patch binário e rename

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-diff`, `git-apply`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mudança binária e rename representado em patch.

**Ações:** Gerar diff --binary e aplicar em clone temporário.

**Oráculo / expectativa:** Hashes dos bytes resultantes são exatos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-diff) · [2](https://git-scm.com/docs/git-apply)

### PATCH-005 — Format-patch e am

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-format-patch`, `git-am`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Série de commits com autores e mensagens controlados.

**Ações:** Exportar série e importar em base compatível.

**Oráculo / expectativa:** Árvores/mensagens/autoria coerentes; OID só é comparado se metadados forem determinísticos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-format-patch) · [2](https://git-scm.com/docs/git-am)

### PATCH-006 — Am conflito continue skip abort

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-am`, `git-status`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Série com conflito no meio.

**Ações:** Resolver, pular e abortar em fixtures separadas.

**Oráculo / expectativa:** Estado da sequência e commits aplicados conforme native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-am) · [2](https://git-scm.com/docs/git-status)

### PATCH-007 — Mailinfo mailsplit e patch-id

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-mailinfo`, `git-mailsplit`, `git-patch-id`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mailbox sintética sem envio de mensagens.

**Ações:** Separar, extrair e comparar patch-id estável.

**Oráculo / expectativa:** Ferramentas processam conteúdo; não alteram refs até aplicação explícita.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-mailinfo) · [2](https://git-scm.com/docs/git-mailsplit) · [3](https://git-scm.com/docs/git-patch-id)

### PATCH-008 — Archive tar zip e commit id

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-archive`, `git-get-tar-commit-id`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Revisões base/Layer e export-ignore/export-subst.

**Ações:** Criar arquivos locais e extrair dentro da fixture.

**Oráculo / expectativa:** Conteúdo é da árvore selecionada, não mistura workspace ou metadados privados.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-archive) · [2](https://git-scm.com/docs/git-get-tar-commit-id)

### PATCH-009 — Bundle completo e incremental

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-bundle`, `git-fetch`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Refs base, Layer e recuperação, bundle com pré-requisitos.

**Ações:** Create/verify/list-heads e fetch em repo novo/parcial.

**Oráculo / expectativa:** Verificar dependências do bundle e refs incluídas; todo conteúdo deve ser alcançável como esperado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-bundle) · [2](https://git-scm.com/docs/git-fetch)

### PATCH-010 — Fast-export fast-import

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-fast-export`, `git-fast-import`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Histórico com branches/tags e bytes incomuns.

**Ações:** Exportar para stream local e importar em destino isolado.

**Oráculo / expectativa:** Árvores equivalentes, nenhuma projeção duplicada; tratar marks e refs explicitamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fast-export) · [2](https://git-scm.com/docs/git-fast-import)

### PATCH-011 — Filter-branch legado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-filter-branch`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Cópia isolada descartável com histórico pequeno.

**Ações:** Aplicar filtro determinístico que apenas altera mensagem/caminho selecionado.

**Oráculo / expectativa:** Caracterizar reescrita e refs de backup; não recomendar sobre repo real nem substituir testes por help.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-filter-branch) · [2](https://git-scm.com/docs/git-show-ref)

### PATCH-012 — Quiltimport e request-pull

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-quiltimport`, `git-request-pull`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Série quilt e remotos locais com commits conhecidos.

**Ações:** Importar série e gerar pedido textual sem enviar.

**Oráculo / expectativa:** Histórico importado e texto verificáveis; nenhum email/rede externa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-quiltimport) · [2](https://git-scm.com/docs/git-request-pull)


## OBJECT — Objetos, árvores e plumbing do índice

### OBJECT-001 — Hash sem gravar e gravando

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-hash-object`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Mesmo conteúdo em arquivos com nomes diferentes.

**Ações:** Calcular hashes com/sem -w e ler objetos.

**Oráculo / expectativa:** Blob identifica conteúdo/tipo, não caminho; gravação só quando solicitada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://git-scm.com/docs/git-cat-file)

### OBJECT-002 — Cat-file batch

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Objetos blob/tree/commit/tag e OID ausente.

**Ações:** Usar batch-check/batch e formatos suportados.

**Oráculo / expectativa:** Ler tamanhos/tipos corretamente, inclusive dados binários e objetos ausentes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cat-file)

### OBJECT-003 — Mktree ls-tree

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-mktree`, `git-ls-tree`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Blobs conhecidos, diretórios e modos variados.

**Ações:** Construir árvore e listar com -z.

**Oráculo / expectativa:** Árvore mapeia nome/modo/OID; nunca reconstruir árvore lendo só nomes de arquivos físicos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-mktree) · [2](https://git-scm.com/docs/git-ls-tree)

### OBJECT-004 — Commit-tree e pais

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-commit-tree`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Árvore conhecida e pais opcionais.

**Ações:** Criar root, commit simples e merge sem atualizar refs.

**Oráculo / expectativa:** Criar objeto não move HEAD; distinguir objeto criado de commit publicado em branch.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit-tree) · [2](https://git-scm.com/docs/git-cat-file)

### OBJECT-005 — Mktag anotação nativa

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-mktag`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Commit e estrutura de tag válida/inválida.

**Ações:** Criar tag object e validar erros.

**Oráculo / expectativa:** Não criar ref implicitamente; erros não substituem objetos existentes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-mktag) · [2](https://git-scm.com/docs/git-cat-file)

### OBJECT-006 — Read-tree reset e merge

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-read-tree`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Índice alternativo exclusivo.

**Ações:** Ler árvore, esvaziar e fazer merge de três árvores.

**Oráculo / expectativa:** Índice resultante tem estágios corretos; base principal não tocada por ambiente vazado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-read-tree) · [2](https://git-scm.com/docs/git-ls-files)

### OBJECT-007 — Write-tree e conflito

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-write-tree`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Índice limpo e índice com estágios superiores.

**Ações:** Gravar árvore em ambas as fixtures.

**Oráculo / expectativa:** Recusa conflito não resolvido; árvore limpa corresponde a entradas do índice.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-write-tree) · [2](https://git-scm.com/docs/git-ls-files)

### OBJECT-008 — Checkout-index prefix e força

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-checkout-index`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Índice alternativo e destino novo, depois ocupado.

**Ações:** Materializar em prefixo temporário, comparar sem/com -f.

**Oráculo / expectativa:** Não escrever fora do destino; força caracterizada explicitamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-checkout-index)

### OBJECT-009 — Update-index cacheinfo index-info

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-update-index`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Blobs e modos já disponíveis.

**Ações:** Atualizar por OID e entrada NUL, sem consultar disco.

**Oráculo / expectativa:** Índice pode mudar sem workspace; detecção Layer não pode depender só do watcher de arquivos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-index) · [2](https://git-scm.com/docs/git-ls-files)

### OBJECT-010 — Unpack-file e leitura direta

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-unpack-file`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Blob binário conhecido e cwd descartável.

**Ações:** Materializar com unpack-file e comparar.

**Oráculo / expectativa:** Arquivo temporário contém bytes corretos e não é adotado como Layer automaticamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-unpack-file) · [2](https://git-scm.com/docs/git-cat-file)

### OBJECT-011 — Diff-pairs por capacidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-diff-pairs`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Comando recente disponível e pares de blobs.

**Ações:** Executar formatos suportados pelo manual local.

**Oráculo / expectativa:** Saída confere comparação de pares; não exigir comando em versão que não o tem.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-diff-pairs)

### OBJECT-012 — Merge-file merge-index merge-one-file

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-merge-file`, `git-merge-index`, `git-merge-one-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Três arquivos controlados e índice alternativo conflitante.

**Ações:** Exercitar combinação limpa/conflitante via comandos documentados.

**Oráculo / expectativa:** Separar merge de arquivo, índice e branch; códigos de conflito não são sucesso.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge-file) · [2](https://git-scm.com/docs/git-merge-index) · [3](https://git-scm.com/docs/git-merge-one-file)


## REF — Referências, logs, backend e manutenção

### REF-001 — Listar refs soltas e empacotadas

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-show-ref`, `git-for-each-ref`, `git-pack-refs`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Heads/tags/refs extras.

**Ações:** Consultar, pack-refs e consultar de novo.

**Oráculo / expectativa:** Refs lógicas iguais mesmo que arquivos refs/heads desapareçam.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://git-scm.com/docs/git-for-each-ref) · [3](https://git-scm.com/docs/git-pack-refs)

### REF-002 — Update-ref compare-and-swap

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-update-ref`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Ref com OID esperado conhecido.

**Ações:** Atualizar com OID correto e obsoleto.

**Oráculo / expectativa:** Atualização obsoleta recusa sem sobrescrever trabalho concorrente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-show-ref)

### REF-003 — Transação multi-ref

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-update-ref`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Duas refs e erro provocado em uma atualização.

**Ações:** Usar protocolo --stdin transacional disponível.

**Oráculo / expectativa:** Atomicidade das refs conforme suporte Git; não presumir atomicidade do workspace.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-show-ref)

### REF-004 — Symrefs e HEAD simbólico

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-symbolic-ref`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Refs simbólicas e HEAD detached em cópias.

**Ações:** Ler/escrever symref controlada.

**Oráculo / expectativa:** Resolver indirection sem ler HEAD como OID fixo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-symbolic-ref) · [2](https://git-scm.com/docs/git-rev-parse)

### REF-005 — Refs check-ref-format e backend

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-check-ref-format`, `git-refs`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Nomes válidos/inválidos e capacidades detectadas.

**Ações:** Verificar nomes e executar refs list/verify/migrate ou equivalentes documentados.

**Oráculo / expectativa:** Sem parsing de backend físico; migração de backend não pode apagar metadados extras.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-check-ref-format) · [2](https://git-scm.com/docs/git-refs)

### REF-006 — Reftable roundtrip

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-init`, `git-refs`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Repo reftable se disponível.

**Ações:** Criar refs/logs, compactar/migrar quando suportado.

**Oráculo / expectativa:** Mesma semântica de refs e logs; limitações de migração explicitadas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-init) · [2](https://git-scm.com/docs/git-refs) · [3](https://git-scm.com/docs/git-show-ref)

### REF-007 — Replace refs e ancestralidade

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-replace`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Objeto substituído e refs/replace locais.

**Ações:** Comparar comandos com e sem substituições.

**Oráculo / expectativa:** Identificar quando o Git vê histórico virtual; não interpretar como alteração física do objeto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-replace) · [2](https://git-scm.com/docs/git-rev-list)

### REF-008 — Reflog expire e GC

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-reflog`, `git-gc`, `git-fsck`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Objeto commitado, staged privado e reserva local.

**Ações:** Expirar logs e coletar somente em fixture exclusiva.

**Oráculo / expectativa:** Objetos necessários à Layer devem continuar alcançáveis por mecanismo válido; bytes só em índice precisam de retenção.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-reflog) · [2](https://git-scm.com/docs/git-gc) · [3](https://git-scm.com/docs/git-fsck)

### REF-009 — Repack e prune-packed

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-repack`, `git-prune-packed`, `git-verify-pack`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Objetos loose e packs com histórico conhecido.

**Ações:** Empacotar, verificar e remover loose redundantes.

**Oráculo / expectativa:** Leitura e hashes iguais; ausência de loose não significa perda de conteúdo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-repack) · [2](https://git-scm.com/docs/git-prune-packed) · [3](https://git-scm.com/docs/git-verify-pack)

### REF-010 — Prune e corrupção deliberada

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-prune`, `git-fsck`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Cópia descartável com objeto alcançável/órfão/corrompido.

**Ações:** Prune no órfão, corromper objeto selecionado e diagnosticar.

**Oráculo / expectativa:** Não mascarar corrupção; nunca executar em object store compartilhado da suíte.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-prune) · [2](https://git-scm.com/docs/git-fsck)

### REF-011 — Pack index unpack e show-index

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-pack-objects`, `git-index-pack`, `git-unpack-objects`, `git-show-index`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Lista explícita de objetos fixture.

**Ações:** Gerar pack, indexar, listar offsets e importar no destino.

**Oráculo / expectativa:** Integridade de objetos por Git; não escrever parser customizado de pack por conveniência.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-pack-objects) · [2](https://git-scm.com/docs/git-index-pack) · [3](https://git-scm.com/docs/git-unpack-objects) · [4](https://git-scm.com/docs/git-show-index)

### REF-012 — Pack-redundant legado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-pack-redundant`, `git-verify-pack`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Binário com comando disponível e packs redundantes controlados.

**Ações:** Exercitar a consulta documentada sem remover saída automaticamente.

**Oráculo / expectativa:** Disponibilidade/depreciação documentadas; comando não pode virar etapa destrutiva cega.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-pack-redundant) · [2](https://git-scm.com/docs/git-verify-pack)

### REF-013 — Commit graph e multi-pack index

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-commit-graph`, `git-multi-pack-index`, `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Grafo/packs pequenos, depois escala opcional.

**Ações:** Write/verify/expire/repack conforme capacidades.

**Oráculo / expectativa:** Aceleração não altera história ou projeções; erros separados de disponibilidade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit-graph) · [2](https://git-scm.com/docs/git-multi-pack-index) · [3](https://git-scm.com/docs/git-rev-list)

### REF-014 — Maintenance run sem agendar sistema

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-maintenance`, `git-for-each-repo`, `git-repo`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Registro global temporário; repos de fixture.

**Ações:** Executar tarefas explícitas e enumeração; não iniciar agendador real.

**Oráculo / expectativa:** Nenhum serviço/tarefa periódica permanece no computador do usuário.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-maintenance) · [2](https://git-scm.com/docs/git-for-each-repo) · [3](https://git-scm.com/docs/git-repo)

### REF-015 — Contagem e retenção privada

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-count-objects`, `git-fsck`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Muitos journals/shelves/checkpoints criados em fixture.

**Ações:** Medir objetos e bytes antes/depois de operações repetidas.

**Oráculo / expectativa:** Separar retenção necessária de vazamento de armazenamento; política de expurgo ainda pendente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-count-objects) · [2](https://git-scm.com/docs/git-fsck)


## PROTO — Transporte e auxiliares cliente/servidor

### PROTO-001 — Upload-pack e fetch-pack locais

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-upload-pack`, `git-fetch-pack`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Dois repositórios descartáveis, transporte por processo local.

**Ações:** Transferir objeto/ref pelo protocolo documentado.

**Oráculo / expectativa:** Objeto recebido válido e apenas refs pretendidas publicadas; nada acessa internet.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-upload-pack) · [2](https://git-scm.com/docs/git-fetch-pack)

### PROTO-002 — Receive-pack e send-pack locais

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-receive-pack`, `git-send-pack`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Bare local com hook inofensivo.

**Ações:** Enviar ref válida, inválida e non-FF.

**Oráculo / expectativa:** Validações de servidor e códigos observados sem supor que client-side lock protege o remote.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-receive-pack) · [2](https://git-scm.com/docs/git-send-pack)

### PROTO-003 — Git daemon em loopback

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-daemon`, `git-fetch`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor com exportação restrita à fixture e porta efêmera.

**Ações:** Clonar/fetch e encerrar servidor.

**Oráculo / expectativa:** Nenhum bind público, processo órfão ou repositório fora da fixture exposto.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-daemon) · [2](https://git-scm.com/docs/git-fetch)

### PROTO-004 — Smart HTTP backend

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-http-backend`, `git-fetch`, `git-push`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor HTTP de fixture em loopback, CGI controlado.

**Ações:** Exercitar descoberta/fetch/push e erro de autenticação sintético.

**Oráculo / expectativa:** Protocolo e refs coerentes; credenciais reais jamais usadas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-http-backend) · [2](https://git-scm.com/docs/git-fetch) · [3](https://git-scm.com/docs/git-push)

### PROTO-005 — Dumb HTTP e server info

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-update-server-info`, `git-http-fetch`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** HTTP estático local e objetos fixture.

**Ações:** Gerar info/refs/packs e consultar pelo helper disponível.

**Oráculo / expectativa:** Caracterizar alcance/limitações do transporte sem simular cobertura de smart HTTP.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-server-info) · [2](https://git-scm.com/docs/git-http-fetch)

### PROTO-006 — HTTP push legado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-http-push`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor WebDAV local somente quando disponível.

**Ações:** Executar envio real controlado conforme documentação.

**Oráculo / expectativa:** Ausência de WebDAV é ENV_BLOCKED; help sozinho não é teste funcional.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-http-push)

### PROTO-007 — Git shell restrito

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-shell`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Conta não é modificada; processo recebe comandos sintéticos permitidos e recusados.

**Ações:** Exercitar shell de forma local, sem alterar login shell do usuário.

**Oráculo / expectativa:** Comandos fora do conjunto permitido são recusados conforme native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-shell)

### PROTO-008 — Upload archive remoto local

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-upload-archive`, `git-archive`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Bare local e revisão permitida.

**Ações:** Solicitar archive pelo protocolo local.

**Oráculo / expectativa:** Somente árvore solicitada exportada; metadados privados não viram arquivos do archive.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-upload-archive) · [2](https://git-scm.com/docs/git-archive)

### PROTO-009 — Protocolos versões 0 1 2

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-fetch`, `git-upload-pack`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor local com capacidades explicitamente registradas.

**Ações:** Repetir negociação com protocol.version controlado.

**Oráculo / expectativa:** Conteúdo equivalente entre versões suportadas; diferenças de capacidade registradas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fetch) · [2](https://git-scm.com/docs/git-upload-pack)

### PROTO-010 — Credenciais fill approve reject

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-credential`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Helper efêmero que retorna credenciais falsas.

**Ações:** Exercitar operações do protocolo credential e redigir logs.

**Oráculo / expectativa:** Segredo sintético não vai para relatório público; nenhum gerenciador pessoal acessado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-credential)

### PROTO-011 — Credential cache temporário

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-credential-cache`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Socket/pasta exclusiva e capacidade detectada.

**Ações:** Store/get/erase/timeout/exit da fixture.

**Oráculo / expectativa:** Expiração e encerramento comprovados; nenhum daemon remanescente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-credential-cache)

### PROTO-012 — Credential store temporário

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-credential-store`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo exclusivo da fixture e credenciais falsas.

**Ações:** Store/get/erase com --file explícito.

**Oráculo / expectativa:** Nada escrito em ~/.git-credentials real; arquivo fica confinado ao teste.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-credential-store)


## TOOLS — Ferramentas gráficas, auxiliares e ecossistema

### TOOLS-001 — Difftool e mergetool controlados

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-difftool`, `git-mergetool`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Ferramenta dummy criada pela fixture registra argumentos e resolve arquivo controlado.

**Ações:** Abrir comparação e resolver conflito sem interface gráfica real.

**Oráculo / expectativa:** Parâmetros representam versões corretas; fluxo de retorno/backup conforme native.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-difftool) · [2](https://git-scm.com/docs/git-mergetool)

### TOOLS-002 — Git GUI citool e gitk

**Origem:** v1 | **Escopo:** OFFICIAL_GUI_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-gui`, `git-citool`, `gitk`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Catálogo do Git oficial com componentes gráficos e capacidade local documentada; nenhuma janela será aberta nesta rodada.

**Ações:** Inventariar git gui/citool/gitk e seus efeitos documentados. Preservar roteiro de validação gráfica para tarefa específica futura, sem executar interface.

**Oráculo / expectativa:** Inventário não é prova de operação gráfica. Classificar OUT_OF_SCOPE_CURRENT_PHASE com execução NOT_RUN.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Componentes oficiais permanecem catalogados; não abrir GUI nem automatizar tela nesta fase headless.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-gui) · [2](https://git-scm.com/docs/git-citool) · [3](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-003 — Gitweb e instaweb

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `gitweb`, `git-instaweb`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor local isolado, sem exportar repo pessoal.

**Ações:** Exibir história e árvores em loopback e encerrar serviços.

**Oráculo / expectativa:** Conteúdo de refs correto; servidor não permanece ativo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-instaweb) · [2](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-004 — Scalar em ambiente isolado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `scalar`, `git-maintenance`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** HOME/global config e destino só de fixture.

**Ações:** Exercitar diagnóstico e operações disponíveis sem agendar serviços globais.

**Oráculo / expectativa:** Qualquer registro/scheduler deve ser isolado ou declarado bloqueado, nunca alterar o usuário.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-maintenance) · [2](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-005 — Bisect manual e automatizado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-bisect`, `git-merge-base`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Grafo com commit defeituoso conhecido e script teste determinístico.

**Ações:** Good/bad/skip/run/reset.

**Oráculo / expectativa:** Localiza faixa/commit correto e restaura estado; distinguir checkout temporário da base.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-bisect) · [2](https://git-scm.com/docs/git-merge-base)

### TOOLS-006 — Merge-base modos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-merge-base`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Grafo com múltiplos ancestrais e fork-point quando aplicável.

**Ações:** Consultar --all, --is-ancestor e demais modos úteis.

**Oráculo / expectativa:** Saídas/códigos coerentes com grafo, não assumir ancestral único em todo caso.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge-base)

### TOOLS-007 — Column e stripspace

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-column`, `git-stripspace`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Entradas sintéticas com espaços, tabs e comentários.

**Ações:** Formatar/listar e normalizar segundo opções.

**Oráculo / expectativa:** Ferramentas puras não alteram refs ou workspace.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-column) · [2](https://git-scm.com/docs/git-stripspace)

### TOOLS-008 — Fmt-merge-msg

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-fmt-merge-msg`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** FETCH_HEAD de fixture e títulos previsíveis.

**Ações:** Gerar mensagem em modos documentados.

**Oráculo / expectativa:** Mensagem construída sem criar commit; nenhum nome de Layer interpretado como propriedade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fmt-merge-msg)

### TOOLS-009 — Sh-setup e sh-i18n

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-sh-setup`, `git-sh-i18n`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Shell compatível e script wrapper temporário.

**Ações:** Carregar bibliotecas shell documentadas e exercitar uma função relevante.

**Oráculo / expectativa:** Classificar helpers de biblioteca corretamente; não executá-los cegamente como porcelain.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-sh-setup) · [2](https://git-scm.com/docs/git-sh-i18n)

### TOOLS-010 — Stage alias de add

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-stage`, `git-add`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Duas fixtures idênticas.

**Ações:** Comparar git stage e git add nas mesmas entradas.

**Oráculo / expectativa:** Índices semanticamente equivalentes; não contabilizar alias como nova arquitetura.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-stage) · [2](https://git-scm.com/docs/git-add)

### TOOLS-011 — CLI em PowerShell CMD Bash

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-help`, `git-version`, `external:git-layer`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** CLI do produto disponível e diretórios com espaços.

**Ações:** Invocar help e fluxo curto via cada shell instalado.

**Oráculo / expectativa:** Argv, exit code, aspas e cwd preservados; shell ausente é bloqueio ambiental.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-help) · [2](https://git-scm.com/docs/git-version) · [3](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-012 — Git LFS opcional

**Origem:** v1 | **Escopo:** DEFERRED_THIRD_PARTY | **Tier sugerido:** optional

**Comandos relacionados:** `external:git-lfs`, `git-add`, `git-checkout`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** LFS instalado e endpoint falso/local; filtros limitados à fixture.

**Ações:** Track, add, checkout e fetch local de conteúdo sintético.

**Oráculo / expectativa:** Distinguir ponteiro LFS de bytes de trabalho; não declarar suporte apenas por preservar texto do ponteiro.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Compatibilidade com ferramenta/implementação externa foi retirada do escopo atual pelo usuário. ID preservado para rastreabilidade.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-checkout) · [3](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-013 — Subtree distribuído à parte

**Origem:** v1 | **Escopo:** OFFICIAL_CONTRIB_IF_PROVEN | **Tier sugerido:** optional

**Comandos relacionados:** `external:git-subtree`, `git-merge`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Subtree disponível e repos locais.

**Ações:** Add/pull/split/push para bare fixture.

**Oráculo / expectativa:** Namespaces e árvore resultante corretos; não confundir subtree com Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Executar apenas se a implementação for comprovadamente parte de contrib/distribuição oficial Git; não certificar ferramentas externas homônimas.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-merge) · [2](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-014 — Filter-repo externo

**Origem:** v1 | **Escopo:** DEFERRED_THIRD_PARTY | **Tier sugerido:** optional

**Comandos relacionados:** `external:git-filter-repo`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Ferramenta presente e clone descartável com sentinelas.

**Ações:** Reescrita pequena com argumentos locais explícitos.

**Oráculo / expectativa:** Caracterizar refs/OIDs alterados e recuperação Layer; pacote externo não é parte do catálogo core.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Compatibilidade com ferramenta/implementação externa foi retirada do escopo atual pelo usuário. ID preservado para rastreabilidade.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://github.com/git/git/blob/v2.56.0/command-list.txt)

### TOOLS-015 — Libgit2 JGit e clientes IDE

**Origem:** v1 | **Escopo:** DEFERRED_THIRD_PARTY | **Tier sugerido:** optional

**Comandos relacionados:** `external:libgit2`, `external:JGit`, `external:IDE-client`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Versões identificadas e acesso a runner próprio; ambientes opcionais.

**Ações:** Repetir stage/commit/checkout por cada implementação disponível.

**Oráculo / expectativa:** Não extrapolar resultado da CLI Git a bibliotecas que escrevem refs/índices por caminhos próprios.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Compatibilidade com ferramenta/implementação externa foi retirada do escopo atual pelo usuário. ID preservado para rastreabilidade.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://github.com/git/git/blob/v2.56.0/command-list.txt)


## LEGACY — Interoperabilidade legada e email

### LEGACY-001 — Send-email sem entrega externa

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-send-email`, `git-format-patch`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** SMTP loopback/capturador de fixture e mensagens falsas.

**Ações:** Enviar série ao receptor local e testar --dry-run.

**Oráculo / expectativa:** Nenhum destinatário real; resultado funcional exige captura local, não somente ajuda.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-send-email) · [2](https://git-scm.com/docs/git-format-patch)

### LEGACY-002 — Imap-send isolado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** optional

**Comandos relacionados:** `git-imap-send`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor IMAP de teste em loopback ou capacidade ausente.

**Ações:** Gravar mailbox sintética no servidor de fixture.

**Oráculo / expectativa:** Ausência de servidor é ENV_BLOCKED, não aprovação.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-imap-send)

### LEGACY-003 — SVN bridge

**Origem:** v1 | **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-svn`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** svnadmin/svn disponíveis e repositório SVN local.

**Ações:** Clone/rebase/dcommit em repositório de fixture.

**Oráculo / expectativa:** Preservar mapeamentos bridge; testar interação de ref/índice Layer sem credenciais externas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Comando oficial catalogado; validação end-to-end com outro SCM/servidor externo adiada. Não implementar integração com terceiros nesta rodada.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-svn)

### LEGACY-004 — Perforce bridge

**Origem:** v1 | **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-p4`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor e ferramentas de fixture licenciados/disponíveis.

**Ações:** Importar/submeter alteração sintética local.

**Oráculo / expectativa:** Registrar capacidades e efeitos reais; não instalar serviços/licenças sem autorização.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Comando oficial catalogado; validação end-to-end com outro SCM/servidor externo adiada. Não implementar integração com terceiros nesta rodada.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-p4)

### LEGACY-005 — CVS import e export

**Origem:** v1 | **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-cvsimport`, `git-cvsexportcommit`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** CVS local e módulos de fixture.

**Ações:** Importar histórico e exportar commit escolhido.

**Oráculo / expectativa:** Sem tocar módulos reais; refs geradas identificadas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Comando oficial catalogado; validação end-to-end com outro SCM/servidor externo adiada. Não implementar integração com terceiros nesta rodada.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cvsimport) · [2](https://git-scm.com/docs/git-cvsexportcommit)

### LEGACY-006 — CVS server

**Origem:** v1 | **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-cvsserver`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** Cliente/servidor bridge disponíveis em loopback.

**Ações:** Consultar e alterar fixture via protocolo permitido.

**Oráculo / expectativa:** Não assumir resultados de Git CLI certificam bridge.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Comando oficial catalogado; validação end-to-end com outro SCM/servidor externo adiada. Não implementar integração com terceiros nesta rodada.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cvsserver)

### LEGACY-007 — Arch import

**Origem:** v1 | **Escopo:** OFFICIAL_BRIDGE_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-archimport`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** GNU Arch de fixture disponível; opcional legado.

**Ações:** Importar histórico mínimo local.

**Oráculo / expectativa:** Comando catalogado mesmo quando não executável; limitações ambientais documentadas.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** KEEP_SPEC_DO_NOT_EXECUTE. Comando oficial catalogado; validação end-to-end com outro SCM/servidor externo adiada. Não implementar integração com terceiros nesta rodada.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-archimport)

### LEGACY-008 — Ferramentas extras do PATH

**Origem:** v1 | **Escopo:** EXTERNAL_INVENTORY_ONLY | **Tier sugerido:** optional

**Comandos relacionados:** `git-help`
**Perfis candidatos:** N0, L0, L1
**Requisitos:** U-01, U-05

**Pré-condições:** Inventário real pode conter comandos além do catálogo upstream.

**Ações:** Classificar sem executar binários desconhecidos; criar ficha de cobertura por ferramenta relevante.

**Oráculo / expectativa:** Novo comando não desaparece do relatório; avaliação/autorizações antes de executar terceiros.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** INVENTORY_ONLY. Registrar origem de comandos externos sem executar ou certificar compatibilidade.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-help)


## LAYER — Invariantes e ciclo de vida das Layers

### LAYER-001 — Nenhuma Layer registrada

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-status`, `git-add`, `git-commit`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Git Layers inicializado sem Layers.

**Ações:** Repetir fluxo nativo diário.

**Oráculo / expectativa:** Caracterizar equivalência da base e custo extra; não usar GUI.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-commit) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-002 — Duas Layers e HEAD tradicional

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-show-ref`, `git-ls-tree`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Duas Layers com arquivos distintos.

**Ações:** Ativar ambas e consultar refs/índices.

**Oráculo / expectativa:** Contrato atual: HEAD/base ficam independentes; testar por objetos Git reais.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://git-scm.com/docs/git-ls-tree) · [3](https://git-scm.com/docs/git-ls-files) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-003 — Commit Layer isolado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-cat-file`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Base staged, Layer A staged+dirty, Layer B staged.

**Ações:** Commit gerenciado só de A.

**Oráculo / expectativa:** Contrato atual: árvore exata de A; base e B inalteradas semanticamente e, quando garantido, byte a byte.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cat-file) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-004 — Ativação encontra arquivo local idêntico

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-status`, `git-hash-object`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer inativa e arquivo local mesmo nome/bytes.

**Ações:** Ativar.

**Oráculo / expectativa:** Contrato atual recusa apropriação automática; resultado futuro depende de decisão do usuário.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-hash-object) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-005 — Colisão base versus Layer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-ls-tree`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Mesmo caminho reivindicado pela base e Layer.

**Ações:** Tentar ativar/atribuir.

**Oráculo / expectativa:** Contrato atual recusa; registrar todos os caminhos conflitantes sem sobrescrever.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-ls-tree) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-006 — Colisão Layer versus Layer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-ls-tree`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Duas Layers com caminho comum, bytes iguais/distintos.

**Ações:** Ativar em ordens opostas.

**Oráculo / expectativa:** Mesmo resultado de conflito; não introduzir prioridade implícita por ordem.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-ls-tree) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-007 — Add unstage release

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-ls-files`, `git-status`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo novo reservado à Layer.

**Ações:** Preparar, desfazer staging e liberar explicitamente.

**Oráculo / expectativa:** Contrato atual mantém reserva após unstage e bytes após release.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-ls-files) · [2](https://git-scm.com/docs/git-status) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-008 — Excluir e recriar caminho

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-add`, `git-rm`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo commitado numa Layer.

**Ações:** Apagar, preparar exclusão, recriar e operar em diferentes ordens.

**Oráculo / expectativa:** Registrar momento de liberação de propriedade; nenhuma transferência silenciosa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-rm) · [3](https://git-scm.com/docs/git-ls-files) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-009 — Renomear arquivo entre proprietários

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-mv`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Origem Layer e destino base/outra Layer.

**Ações:** Comparar rename nativo e gerenciado.

**Oráculo / expectativa:** Recusa gerenciada ou reconciliação explícita; detectar diferença sem inventar transferência.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-mv) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-010 — Park e retomada

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-ls-files`, `git-cat-file`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Índice=A, disco=B, reserva nova e arquivo ausente.

**Ações:** Guardar/desativar e reativar.

**Oráculo / expectativa:** Contrato atual recupera as quatro dimensões separadamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-ls-files) · [2](https://git-scm.com/docs/git-cat-file) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-011 — Captura review confirm cancel

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-status`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivos preexistentes e novos dentro/fora do escopo.

**Ações:** Iniciar, criar, revisar e confirmar/cancelar em cópias.

**Oráculo / expectativa:** Somente candidatos atuais selecionados recebem propriedade; cancelar conserva bytes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-012 — Captura seguida de off

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-status`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer limpa com captura aberta.

**Ações:** Desativar e tentar cancelar/revisar/reiniciar captura.

**Oráculo / expectativa:** Reproduzir risco de estado preso encontrado na revisão; não normalizar travamento como contrato.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-013 — Arquivo muda durante revisão de captura

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-hash-object`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Candidato visto, depois editado/removido/trocado.

**Ações:** Confirmar seleção antiga.

**Oráculo / expectativa:** Especificar token/conteúdo esperado depois da decisão de produto; baseline não conhece captura Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-014 — Ref Layer avançada externamente

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-update-ref`, `git-show-ref`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer com staged e dirty.

**Ações:** Avançar ref por outro processo e chamar comando gerenciado.

**Oráculo / expectativa:** Contrato atual recusa sem resetar índice; registrar lacuna de reconciliação.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-show-ref) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-015 — Ref Layer apagada ou renomeada

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-update-ref`, `git-branch`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer registrada inclusive inativa.

**Ações:** Remover/renomear ref fora do produto.

**Oráculo / expectativa:** Diagnóstico e saída segura sem bloquear resgate de todas as Layers; resultado a caracterizar.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-branch) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### LAYER-016 — Remover renomear desregistrar Layer

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** smoke

**Comandos relacionados:** `git-show-ref`, `git-ls-files`
**Perfis candidatos:** L0, L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer limpa, dirty, parked e referenciada por captura.

**Ações:** Catalogar contrato proposto de ciclo de vida; executar somente APIs que existirem.

**Oráculo / expectativa:** Função ausente é PRODUCT_GAP/PENDING_PRODUCT_SPEC, não cenário pulado por ambiente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)


## LAYOUT — Namespace layers e futura migração

### LAYOUT-001 — Diretório layers ausente

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-rev-parse`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Repositório limpo sem diretório reservado.

**Ações:** Simular planejamento de criação de metadados, sem migrar o produto nesta etapa.

**Oráculo / expectativa:** Proposta usa raiz resolvida pelo Git; nenhum pressuposto de .git físico.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [4](https://git-scm.com/docs/gitrepository-layout) · [5](https://git-scm.com/docs/git-worktree)

### LAYOUT-002 — Diretório layers já ocupado

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-rev-parse`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Destino layers com sentinela de origem desconhecida, criada exclusivamente pela fixture.

**Ações:** Especificar inicialização/migração sem assumir propriedade dos dados. Não implementar migrador do produto nesta fase.

**Oráculo / expectativa:** Dados desconhecidos preservados. É segurança de dados, não requisito de compatibilidade com outra aplicação.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [4](https://git-scm.com/docs/gitrepository-layout) · [5](https://git-scm.com/docs/git-worktree)

### LAYOUT-003 — Layers versus layers por caixa

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-rev-parse`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Filesystem sensível/insensível medido.

**Ações:** Criar alias de nome quando possível e inspecionar.

**Oráculo / expectativa:** Não criar dois formatos conflitantes; preferência de nome é layers minúsculo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [4](https://git-scm.com/docs/gitrepository-layout) · [5](https://git-scm.com/docs/git-worktree)

### LAYOUT-004 — Migração antiga para nova limpa

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-rev-parse`, `git-show-ref`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Fixture sintética no formato antigo e destino vazio.

**Ações:** Especificar conversão do caminho e validar inventário; implementar só após aprovação de migração.

**Oráculo / expectativa:** OIDs, índice, bytes, reservas e flags conservados; não basta renomear pasta.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://git-scm.com/docs/git-show-ref) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [5](https://git-scm.com/docs/gitrepository-layout) · [6](https://git-scm.com/docs/git-worktree)

### LAYOUT-005 — Migração com journal pendente

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-rev-parse`, `git-fsck`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Journal antigo com caminhos absolutos e backups.

**Ações:** Planejar recusa segura ou migração validada do plano.

**Oráculo / expectativa:** Nenhum backup fica inacessível; formato/algoritmo ainda pendentes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://git-scm.com/docs/git-fsck) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [5](https://git-scm.com/docs/gitrepository-layout) · [6](https://git-scm.com/docs/git-worktree)

### LAYOUT-006 — Duas instalações concorrentes

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-version`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Versões antigas e futuras apontam à mesma fixture.

**Ações:** Caracterizar detecção de formato/proprietário e bloqueio de escrita dupla.

**Oráculo / expectativa:** Não permitir escritores com interpretações incompatíveis do estado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [4](https://git-scm.com/docs/gitrepository-layout) · [5](https://git-scm.com/docs/git-worktree)

### LAYOUT-007 — Migração interrompida

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-rev-parse`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Fixture migrável e checkpoints de teste externos.

**Ações:** Interromper em cada publicação da migração, quando autorizada.

**Oráculo / expectativa:** Reabertura identifica formato único ou estado recuperável, sem apagar cópia anterior.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [4](https://git-scm.com/docs/gitrepository-layout) · [5](https://git-scm.com/docs/git-worktree)

### LAYOUT-008 — Metadados comuns versus worktree

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-worktree`, `git-rev-parse`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Dois worktrees com bases/ativação diferentes.

**Ações:** Modelar registry compartilhado e índices/projeção locais.

**Oráculo / expectativa:** Nenhuma ativação/índice de A substitui os de B; excludes compartilhado precisa de contrato próprio.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-worktree) · [2](https://git-scm.com/docs/git-rev-parse) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [5](https://git-scm.com/docs/gitrepository-layout)

### LAYOUT-009 — Objetos refs e índices continuam nativos

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-cat-file`, `git-for-each-ref`, `git-ls-files`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Layout candidato com conteúdo Layer.

**Ações:** Verificar armazenamento por Git, inclusive pack-refs/reftable.

**Oráculo / expectativa:** Não criar segundo object store ou referências-fantasma em layers/ só por aparência.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cat-file) · [2](https://git-scm.com/docs/git-for-each-ref) · [3](https://git-scm.com/docs/git-ls-files) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [6](https://git-scm.com/docs/gitrepository-layout) · [7](https://git-scm.com/docs/git-worktree)

### LAYOUT-010 — Desinstalação e portabilidade de dados

**Origem:** v1 | **Escopo:** FUTURE_LAYOUT_SPECIFICATION | **Tier sugerido:** spec-only

**Comandos relacionados:** `git-show-ref`, `git-clone`
**Perfis candidatos:** L0, L1, L3, L4, L6
**Requisitos:** U-03, U-04

**Pré-condições:** Fixture com metadados antigos/novos, commits e dados só locais.

**Ações:** Especificar exportação/retirada sem apagar trabalho; comparar clone.

**Oráculo / expectativa:** Commits transportáveis distintos de staging/shelves/rascunhos locais; política de exportação pendente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** SPECIFY_AND_CHARACTERIZE_CURRENT_ONLY. Destino layers desejado; preparar critérios e caracterizar estado atual, sem implementar migrador ou layout novo.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://git-scm.com/docs/git-clone) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts) · [5](https://git-scm.com/docs/gitrepository-layout) · [6](https://git-scm.com/docs/git-worktree)

### LAYOUT-011 — Formato nativo do índice não é uma aproximação visual

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-ls-files`, `git-update-index`, `git-write-tree`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-04

**Pré-condições:** Índices originais e cópias de fixture; versões/flags compatíveis detectadas.

**Ações:** Verificar identificação e leitura efetiva pelo Git; onde suportado, variar versão de índice na cópia e comparar conteúdo semântico. Não alterar formato do produto.

**Oráculo / expectativa:** Teste comprova leitura/escrita nativa e registra restrições. Nome de arquivo ou cabeçalho isolado não substitui roundtrip funcional.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-ls-files) · [2](https://git-scm.com/docs/git-update-index) · [3](https://git-scm.com/docs/git-write-tree) · [4](06-Decisoes-e-Autonomia.md) · [5](https://git-scm.com/docs/gitformat-index)

### LAYOUT-012 — Objetos Git reutilizados e metadados adicionais distinguíveis

**Origem:** v2 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** core

**Comandos relacionados:** `git-cat-file`, `git-for-each-ref`, `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L2, L3
**Requisitos:** U-03, U-04

**Pré-condições:** Fixture atual com commits, staging e metadados; objeto e diretório Git resolvidos oficialmente.

**Ações:** Relacionar refs/árvores/blobs e índices usados pelo produto ao armazenamento Git; inventariar estado extra com sua função, sem mover arquivos.

**Oráculo / expectativa:** Separar formatos nativos de coordenação própria e identificar redundância funcional versus duplicação sem justificativa. Nenhum layout candidato é tratado como já implementado.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-cat-file) · [2](https://git-scm.com/docs/git-for-each-ref) · [3](https://git-scm.com/docs/git-rev-parse) · [4](06-Decisoes-e-Autonomia.md) · [5](https://git-scm.com/docs/gitformat-index)


## RECOVERY — Interrupções, concorrência e resgate

### RECOVERY-001 — Dois escritores gerenciados

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-update-ref`, `git-ls-files`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Dois processos em mesma fixture.

**Ações:** Sincronizar tentativa de stage/commit pelo mesmo lock.

**Oráculo / expectativa:** Serializar ou recusar; não misturar índices nem duplicar commit.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-002 — Leitura concorrente com escrita

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-status`, `git-ls-files`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Processo escreve enquanto outro consulta.

**Ações:** Executar leituras em barreiras controladas.

**Oráculo / expectativa:** Snapshot consistente ou diagnóstico de transição; nunca afirmar saúde sobre composição híbrida silenciosa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-003 — Git externo concorrente

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-add`, `git-commit`, `git-update-ref`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Writer nativo e writer Layer sobre alvos controlados.

**Ações:** Intercalar após preflight usando barreiras determinísticas.

**Oráculo / expectativa:** Registrar TOCTOU e CAS; lock Layer não é lock universal do Git.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-commit) · [3](https://git-scm.com/docs/git-update-ref) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-004 — Morte real com lock retido

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-status`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Processo Layer parado após aquisição do lock.

**Ações:** Encerrar PID exclusivo abruptamente e reabrir por CLI.

**Oráculo / expectativa:** Verificar diagnóstico/resgate de lock abandonado; exceção capturada não substitui morte real.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-005 — Morte entre backup e mutação

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-hash-object`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Operação com conteúdo a substituir/remover.

**Ações:** Interromper após backup e antes/depois de escrita.

**Oráculo / expectativa:** Nenhum arquivo recuperado de backup errado; preservar evidência.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-006 — Morte após update-ref

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-update-ref`, `git-rev-list`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Commit pronto e journal existente.

**Ações:** Interromper após avanço de ref e antes de publicação dos metadados.

**Oráculo / expectativa:** Reconhecer commit existente sem duplicar nem regredir ref.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-rev-list) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-007 — Morte durante materialização

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-checkout-index`, `git-hash-object`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer com múltiplos arquivos.

**Ações:** Interromper em cada posição k da publicação/remoção.

**Oráculo / expectativa:** Retomar/recusar de maneira conservadora; bytes posteriores não sobrescritos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-checkout-index) · [2](https://git-scm.com/docs/git-hash-object) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-008 — Edição após interrupção

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-hash-object`, `git-status`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Falha registrada seguida de edição manual externa.

**Ações:** Executar recuperação.

**Oráculo / expectativa:** Dados novos conservados; conflito reportado com caminhos e evidências.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://git-scm.com/docs/git-status) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-009 — Journal e registry inválidos

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-status`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** JSON malformado, schema futuro, arquivo ausente em cópias.

**Ações:** Tentar abrir, doctor, recover e exportar.

**Oráculo / expectativa:** Diagnóstico/exportação não devem depender de interpretar metadados corrompidos como válidos; lacuna atual registrada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-010 — Backups ausentes ou adulterados

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-hash-object`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Plano válido com backup faltando ou hash diferente.

**Ações:** Tentar recuperação.

**Oráculo / expectativa:** Recusar antes de restaurar qualquer destino não validado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-011 — Disco cheio permissões e arquivo bloqueado

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-add`, `git-update-ref`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Falhas de IO injetadas ou filesystem de fixture limitado.

**Ações:** Provocar falha em temporário, rename, fsync, journal e índice.

**Oráculo / expectativa:** Erro preserva backups/refs; não relaxar proteções nem pedir privilégio global.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-update-ref) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-012 — Snapshots acima do limite

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-switch`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Layer com volume próximo/maior que limite JSON/Base64.

**Ações:** Troca gerenciada em fixture; medir antes/depois e recuperação.

**Oráculo / expectativa:** Reproduzir risco de journal grande após remover projeções; sem aceitar perda temporária silenciosa como sucesso.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-switch) · [2](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-013 — Refpack ou GC concorrente

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-gc`, `git-pack-refs`, `git-update-ref`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Object store exclusivo da fixture.

**Ações:** Intercalar manutenção com leitura/stage usando checkpoints.

**Oráculo / expectativa:** Objetos necessários continuam legíveis ou operação falha claramente; não usar prune agressivo em store compartilhado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-gc) · [2](https://git-scm.com/docs/git-pack-refs) · [3](https://git-scm.com/docs/git-update-ref) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)

### RECOVERY-014 — Reabertura repetida e idempotência

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-status`, `git-fsck`
**Perfis candidatos:** L1, L2, L3, L4, L5, L6
**Requisitos:** U-01, U-05

**Pré-condições:** Operação concluída ou recuperação parcial conhecida.

**Ações:** Reabrir/recuperar repetidas vezes.

**Oráculo / expectativa:** Não cria novo commit/backup indefinidamente nem altera resultado já finalizado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-fsck) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/src/core/index.ts)


## HARNESS — Validação do próprio sistema de testes

### HARNESS-001 — Falha semântica detectada

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-status`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Fixture com um byte e uma ref sentinela.

**Ações:** Alterar deliberadamente expectativa ou saída do adaptador de teste.

**Oráculo / expectativa:** Runner falha com diferença objetiva; nunca mantém verde só por exit 0.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-002 — Falha esperada conhecida

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-status`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Cenário com defeito documentado e predicado específico.

**Ações:** Executar XFAIL e depois retirar a causa na fixture do harness.

**Oráculo / expectativa:** XPASS exige revisão; exceção qualquer não conta como falha esperada correta.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-003 — Pré-requisito versus recurso ausente

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-version`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Uma ferramenta ausente e uma API Layer não implementada.

**Ações:** Rodar ambos os casos.

**Oráculo / expectativa:** ENV_BLOCKED e PRODUCT_GAP separados; nenhum contado como compatibilidade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-004 — Isolamento do ambiente

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-config`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Config global real acompanhada só por fingerprint; configs fixture distintas.

**Ações:** Executar casos em paralelo com ambiente por subprocesso.

**Oráculo / expectativa:** Nenhuma mutação global de process.env cria interferência entre testes.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-005 — Oráculo independente do Core

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-cat-file`, `git-ls-files`, `git-for-each-ref`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Produto e comandos Git externos apontam à mesma fixture.

**Ações:** Comparar resultado do produto com objetos/índice/disco.

**Oráculo / expectativa:** Não validar estado só lendo o JSON produzido pelo próprio código sob teste.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cat-file) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://git-scm.com/docs/git-for-each-ref) · [4](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-006 — Baseline correto para ignorados

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-check-ignore`, `git-add`, `git-clean`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** N0 puro e N0 equivalente com mesmas exclusões/bytes.

**Ações:** Comparar comando nativo nas duas bases antes de L1.

**Oráculo / expectativa:** Distinguir efeito de ignore intencional de bug de integração.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-check-ignore) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-clean) · [4](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-007 — Reprodutibilidade de seed

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-rev-list`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Geração aleatória com seed e datas/autor fixados.

**Ações:** Repetir sequência e reduzir contraprova.

**Oráculo / expectativa:** Mesma falha reproduzível; guardar sequência mínima, versão e capacidade.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-list) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-008 — Snapshot semântico e não físico

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-status`, `git-pack-refs`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Índice pode renovar stat cache e refs podem empacotar.

**Ações:** Repetir consulta/manutenção e comparar.

**Oráculo / expectativa:** Não falhar por diferença irrelevante de cache/packing; proteger bytes quando contrato explicitamente exige.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-pack-refs) · [3](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-009 — Escala de arquivos e Layers

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-status`, `git-add`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Variações 1/10/100 Layers e 10/1000/10000 arquivos, se custo comportar.

**Ações:** Medir processos Git, bytes lidos, tempo e memória.

**Oráculo / expectativa:** Relatar medidas reais sem prazo inventado; identificar crescimento superlinear.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-add) · [3](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-010 — Escala de retenção

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-status`, `git-count-objects`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** 0/100/1000 journals concluídos e shelves sintéticas.

**Ações:** Repetir status e uma mutação.

**Oráculo / expectativa:** Medir degradação histórica; não apagar evidências para acelerar o teste.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-count-objects) · [3](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-011 — Matriz de plataformas

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-version`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Windows, Linux e macOS reais ou agentes claramente indisponíveis.

**Ações:** Executar subconjuntos adequados e registrar filesystem/shell/backend.

**Oráculo / expectativa:** Linux não certifica Windows; simular string de path não substitui execução nativa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-012 — Execução rápida versus completa

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-version`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Manifesto de testes com dependências/tags.

**Ações:** Rodar smoke, affected, core, extended e stress.

**Oráculo / expectativa:** Relatório informa seleção e omissões; subset não é apresentado como suíte completa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-013 — Limpeza segura de fixtures

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-rev-parse`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Diretório temporário com marcador/nonce e sentinelas externas.

**Ações:** Tentar limpeza válida e raiz incorreta em teste do harness.

**Oráculo / expectativa:** Recusar remoção sem prova de propriedade e conter toda escrita à fixture.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rev-parse) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-014 — Capacidade nova descoberta

**Origem:** v1 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-help`
**Perfis candidatos:** N0, L0, L1, L3, L6
**Requisitos:** U-05, U-10

**Pré-condições:** Inventário com entrada nova sintética ou Git atualizado.

**Ações:** Comparar catálogo conhecido com inventário local.

**Oráculo / expectativa:** Relatório exige nova classificação/cobertura; não executar comando desconhecido automaticamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-help) · [2](https://github.com/git/git/blob/v2.56.0/t/README)

### HARNESS-015 — Comprovação de fontes de produto preservadas

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-06, U-09, U-10

**Pré-condições:** Snapshot/fingerprint inicial de fontes Core/CLI/desktop e classificação das mudanças já existentes do usuário.

**Ações:** Comparar antes/depois da tarefa e dos testes; se ocorrer alteração externa, registrar separadamente sem reverter trabalho alheio.

**Oráculo / expectativa:** Mudança atribuível ao Codex fora do escopo é detectada. O relatório distingue mudanças de testes/docs de fontes de produto.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-016 — Runner não abre processos gráficos

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-05, U-06

**Pré-condições:** Supervisão dos subprocessos criados pelo runner e integração headless disponível.

**Ações:** Exercitar seleção smoke/comandos públicos e registrar descendentes; testar bloqueio da rota de GUI com comando sintético antes de iniciar processo real.

**Oráculo / expectativa:** Nenhum Electron/IDE/desktop é iniciado pelo runner. Não encerrar processos pessoais por nome para fabricar esse estado.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-017 — Defeito específico esperado não absorve outra falha

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-10

**Pré-condições:** Dois resultados sintéticos: assinatura de bug conhecido e erro diferente de setup/asserção.

**Ações:** Aplicar classificação estrita XFAIL e variante XPASS no runner.

**Oráculo / expectativa:** Somente assinatura explicitamente esperada é XFAIL; erro diferente falha; XPASS permanece visível para revisão.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-018 — Relatório detecta evidência ausente e contagem incoerente

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-10

**Pré-condições:** Bundle sintético de resultados e variantes com referência a artefato deliberadamente ausente.

**Ações:** Validar índices/contagens/links/hashes; introduzir inconsistências na fixture de relatório e conferir recusa.

**Oráculo / expectativa:** Relatório inválido não é aceito como entrega completa; apontar ID/artefato/contador divergente.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-019 — Resultados de snapshots distintos não viram full pass único

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-10

**Pré-condições:** Duas rodadas sintéticas com hashes de fonte/build/runner diferentes e seleções parcialmente disjuntas.

**Ações:** Tentar agregação; pedir resumo final e verificar a proveniência exibida.

**Oráculo / expectativa:** Resumo não afirma suíte única aprovada por somar testes de versões diferentes; mantém fingerprint/seleção por rodada.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-020 — ZIP de relatório portável e autocontido

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-10

**Pré-condições:** Bundle de relatório com evidências sintéticas e manifesto; destino novo de extração.

**Ações:** Reabrir em outro caminho, validar links relativos e hashes, procurar dependências de caminhos temporários inexistentes e dados não autorizados.

**Oráculo / expectativa:** Relatório e evidências acessíveis sem computador/caminhos originais; nenhum arquivo pessoal/segredo incluído.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-021 — Instruções separam tarefa atual e autonomia futura

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-05, U-06, U-09

**Pré-condições:** Documentação/AGENTS revisados e registro de decisões U-xx.

**Ações:** Validar links/referências; revisar criticamente regras antes/depois e dependência de GUI, com checklist ligado aos requisitos.

**Oráculo / expectativa:** Não há veto permanente ao desenvolvimento futuro nem exigência de editor para Core/CLI. Proteções de dados/evidências permanecem; revisão textual não certifica funcionamento do produto.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

### HARNESS-022 — Oráculo identifica execução pelo adaptador errado

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** `git-version`, `git-config`
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-01, U-05

**Pré-condições:** Comando nativo de fixture com configuração proposital em estudo, mais alvo Core separado.

**Ações:** Registrar executável/argv/config efetivos do observador e verificar que não depende exclusivamente das políticas de src/core/git.ts.

**Oráculo / expectativa:** O oráculo não herda silenciosamente filtros/restrições do produto que mudam o fenômeno estudado. Desvio é reportado como falha do teste.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](https://git-scm.com/docs/git-version) · [2](https://git-scm.com/docs/git-config) · [3](06-Decisoes-e-Autonomia.md)

### HARNESS-023 — Roteiro só especificado nunca vira teste aprovado

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-10

**Pré-condições:** Manifesto com cenários implementados, documentais, fora de escopo e não selecionados.

**Ações:** Gerar cobertura/relatório e validar denominadores, classificações e razões de ausência.

**Oráculo / expectativa:** SPEC_ONLY/TEST_GAP e OUT_OF_SCOPE permanecem distintos de PASS; quantidade de entradas do JSON não vira quantidade de testes executados.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)


## HOOK — Hooks e políticas reais de desenvolvimento

### HOOK-001 — Pre-commit com sucesso

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-commit`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Hook controlado grava marcador, sem acessar rede.

**Ações:** Commit normal com arquivo base preparado.

**Oráculo / expectativa:** Hook executado na etapa certa e commit contém árvore esperada; contrato Layer com hooks ainda a definir.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-hook) · [3](https://git-scm.com/docs/githooks)

### HOOK-002 — Prepare-commit-msg e commit-msg

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-commit`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Scripts fixture registram argumentos e validam mensagem.

**Ações:** Commit com -m, -F e amend.

**Oráculo / expectativa:** Distinguir hooks que alteram mensagem e hooks de validação; não desativar política silenciosamente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-hook) · [3](https://git-scm.com/docs/githooks)

### HOOK-003 — Post-commit e post-rewrite

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-commit`, `git-rebase`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Registro de chamadas e OIDs em arquivo temporário.

**Ações:** Commit/amend/rebase em fixtures separadas.

**Oráculo / expectativa:** Notificações refletem OIDs reais sem escrever na Layer errada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-rebase) · [3](https://git-scm.com/docs/git-hook) · [4](https://git-scm.com/docs/githooks)

### HOOK-004 — Pre-rebase e pre-merge-commit

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-rebase`, `git-merge`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Hooks de fixture aceitam/recusam por condição determinística.

**Ações:** Exercitar as duas decisões.

**Oráculo / expectativa:** Recusa preserva estado conforme native; chamada não é simulada pelo Core.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-rebase) · [2](https://git-scm.com/docs/git-merge) · [3](https://git-scm.com/docs/git-hook) · [4](https://git-scm.com/docs/githooks)

### HOOK-005 — Post-checkout e post-merge

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-checkout`, `git-merge`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Hook registra old/new OID e flags.

**Ações:** Trocar branch, restaurar arquivo e mesclar.

**Oráculo / expectativa:** Distinguir eventos; post hook não é proteção prévia universal contra sobrescrita.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-checkout) · [2](https://git-scm.com/docs/git-merge) · [3](https://git-scm.com/docs/git-hook) · [4](https://git-scm.com/docs/githooks)

### HOOK-006 — Pre-push

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-push`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Bare local e hook controlado.

**Ações:** Enviar ref base e Layer, aceitar/recusar.

**Oráculo / expectativa:** Argumentos refletem refs; usuário não perde política ao usar git layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-push) · [2](https://git-scm.com/docs/git-hook) · [3](https://git-scm.com/docs/githooks)

### HOOK-007 — Pre-receive update post-receive

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-receive-pack`, `git-push`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Servidor de fixture com três tipos de hook.

**Ações:** Push com várias refs e recusa seletiva.

**Oráculo / expectativa:** Resultado atômico/parcial segue configuração; registros do servidor independentes do cliente.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-receive-pack) · [2](https://git-scm.com/docs/git-push) · [3](https://git-scm.com/docs/git-hook) · [4](https://git-scm.com/docs/githooks)

### HOOK-008 — Reference-transaction

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-update-ref`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Hook local registra fases e suporta recusa documentada.

**Ações:** Transação CAS e multi-ref, com sucesso e falha.

**Oráculo / expectativa:** Verificar fases/refs segundo versão; hook não observa qualquer escrita arbitrária no filesystem.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-hook) · [3](https://git-scm.com/docs/githooks)

### HOOK-009 — Hook command runner

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Hook existente/inexistente e opções capability-gated.

**Ações:** Executar git hook run conforme manual, incluindo stdin/args.

**Oráculo / expectativa:** Código e fluxo de dados preservados; ausência não é aprovação falsa.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hook) · [2](https://git-scm.com/docs/githooks)

### HOOK-010 — Core hooksPath e encadeamento

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-config`, `git-hook`, `git-commit`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** HooksPath customizado e caminho vazio em copies isoladas.

**Ações:** Comparar descoberta e execução do Git e produto.

**Oráculo / expectativa:** Não sobrescrever hook do projeto; eventual integração precisa coexistir por contrato.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-config) · [2](https://git-scm.com/docs/git-hook) · [3](https://git-scm.com/docs/git-commit) · [4](https://git-scm.com/docs/githooks)

### HOOK-011 — Assinatura GPG SSH e tags

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-commit`, `git-tag`, `git-verify-commit`, `git-verify-tag`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Chaves efêmeras, backends detectados e confiança temporária.

**Ações:** Assinar e verificar commits/tags; falhar quando política exige backend ausente.

**Oráculo / expectativa:** Resultado não ignora assinatura requerida; nenhuma chave pessoal é usada.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-commit) · [2](https://git-scm.com/docs/git-tag) · [3](https://git-scm.com/docs/git-verify-commit) · [4](https://git-scm.com/docs/git-verify-tag) · [5](https://git-scm.com/docs/githooks)

### HOOK-012 — Filter e hook falho durante tarefa

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** extended

**Comandos relacionados:** `git-add`, `git-commit`, `git-hook`
**Perfis candidatos:** N0, L0, L1, L3
**Requisitos:** U-01, U-05

**Pré-condições:** Processos controlados que travam/retornam erro.

**Ações:** Aplicar timeout/cancelamento da fixture e reabrir.

**Oráculo / expectativa:** Processos terminam; arquivos/índices preservados conforme contrato, sem fallback silencioso.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-commit) · [3](https://git-scm.com/docs/git-hook) · [4](https://git-scm.com/docs/githooks)


## MODEL — Propriedades e sequências combinatórias

### MODEL-001 — Ativar e desativar como roundtrip

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-hash-object`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Layer limpa e base documentada.

**Ações:** Executar on/off sem editar.

**Oráculo / expectativa:** Contrato atual: árvores/bytes da base não mudam; roundtrip preserva conteúdo recuperável da Layer.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-hash-object) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-002 — Comutatividade de Layers disjuntas

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-show-ref`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Layers A/B sem colisões e sem efeitos externos.

**Ações:** Comparar on A/on B com on B/on A em cópias.

**Oráculo / expectativa:** Composição final semanticamente igual; ordem não cria precedência oculta.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-003 — Park como roundtrip de três estados

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-ls-files`, `git-hash-object`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** HEAD/índice/disco diferentes e reservas.

**Ações:** Guardar e restaurar em sequências repetidas.

**Oráculo / expectativa:** Preservar separadamente committed/staged/unstaged e ausência física.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-ls-files) · [2](https://git-scm.com/docs/git-hash-object) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-004 — Recusa atômica de lote

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-ls-files`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Lote com N caminhos válidos e um inválido, em posições variáveis.

**Ações:** Operação gerenciada sobre cada permutação.

**Oráculo / expectativa:** Contrato atual recusa sem preparar subconjunto indevido.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-ls-files) · [2](https://git-scm.com/docs/git-show-ref) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-005 — Independência entre owners

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-cat-file`, `git-ls-files`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Base e três Layers com estado distinto.

**Ações:** Mutar uma origem escolhida por seed.

**Oráculo / expectativa:** Nenhuma origem não selecionada perde refs/índice/bytes protegidos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-cat-file) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-006 — Sequências aleatórias válidas

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-status`, `git-add`, `git-commit`, `git-restore`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Modelo abstrato independente, seed fixa, fixture mínima.

**Ações:** Gerar sequências condicionadas por estado e reduzir primeira divergência.

**Oráculo / expectativa:** Registrar menor contraprova reproduzível; sequência inválida não é aleatoriamente descartada sem motivo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-status) · [2](https://git-scm.com/docs/git-add) · [3](https://git-scm.com/docs/git-commit) · [4](https://git-scm.com/docs/git-restore) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-007 — Sequências com operações externas

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-add`, `git-checkout`, `git-reset`, `git-clean`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Arquivo sentinela e modelo distinguindo ação nativa deliberada de mutação gerenciada.

**Ações:** Intercalar native e Layer com estados limpos/sujos.

**Oráculo / expectativa:** Relatar risco/efeito native e lacuna do contrato; não mascarar perda escolhendo baseline errado.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-add) · [2](https://git-scm.com/docs/git-checkout) · [3](https://git-scm.com/docs/git-reset) · [4](https://git-scm.com/docs/git-clean) · [5](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-008 — Injeção em todas as fronteiras de escrita

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-update-ref`, `git-hash-object`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Plano de operações com barreiras determinísticas externas ao produto, onde possível.

**Ações:** Interromper antes/depois de cada publicação crítica.

**Oráculo / expectativa:** Cada falha fica íntegra ou recuperável dentro do contrato; falta de instrumentação é TEST_GAP.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-update-ref) · [2](https://git-scm.com/docs/git-hash-object) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-009 — Monotonicidade de evidência e resgate

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-fsck`, `git-show-ref`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Falha com backups e edições posteriores.

**Ações:** Diagnosticar/exportar/reabrir sem autorizar reparo destrutivo.

**Oráculo / expectativa:** Consultas de resgate não destroem prova ou dados novos.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-fsck) · [2](https://git-scm.com/docs/git-show-ref) · [3](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-010 — Equivalência entre versões/backends

**Origem:** v1 | **Escopo:** OFFICIAL_GIT_HEADLESS | **Tier sugerido:** stress

**Comandos relacionados:** `git-show-ref`, `git-ls-files`, `git-cat-file`
**Perfis candidatos:** N0, L0, L1, L2, L3, L4, L5
**Requisitos:** U-01, U-05

**Pré-condições:** Versões suportadas e combinações hash/ref disponíveis.

**Ações:** Executar mesma sequência e comparar grafo/conteúdo semanticamente.

**Oráculo / expectativa:** Diferenças legítimas de OID/formato não viram corrupção; contrato preservado por equivalência de conteúdo.

**Avaliação do produto:** CHARACTERIZE_CURRENT; avaliar requisitos U-xx aplicáveis e contratos atuais citados. Decisões de comportamento não definidas ficam PENDING_PRODUCT_SPEC. Não implementar/corrigir o produto nesta fase.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Git oficial/Core/CLI por comandos; aplicar apenas perfis compatíveis com as pré-condições.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** environment fingerprint; commands and exit codes; semantic before/after state; independent Git/FS assertions; reproduction seed or exact fixture; actual-vs-expected diff.

**Referências:** [1](https://git-scm.com/docs/git-show-ref) · [2](https://git-scm.com/docs/git-ls-files) · [3](https://git-scm.com/docs/git-cat-file) · [4](https://github.com/rabrunos/GitLayer/blob/37887aad107bd751a3687bc660a6644ef5d90c54/docs/ARCHITECTURE.md)

### MODEL-011 — Contrato de comportamento independente da escolha técnica

**Origem:** v2 | **Escopo:** HARNESS_HEADLESS | **Tier sugerido:** harness

**Comandos relacionados:** Infraestrutura/documentação; sem comando Git obrigatório.
**Perfis candidatos:** Teste da própria infraestrutura.
**Requisitos:** U-04, U-10

**Pré-condições:** Requisito de comportamento U-xx e snapshots sintéticos com duas representações internas equivalentes; controle negativo divergente.

**Ações:** Verificar que o oráculo orientado a comportamento aceita equivalência justificada e recusa alteração real de conteúdo/propriedade. Não implementar outro produto para o experimento.

**Oráculo / expectativa:** Infraestrutura permite futura autonomia técnica sem normalizar corrupção ou exigir estética interna como critério de suporte.

**Avaliação do produto:** Caracterizar implementação atual e avaliar requisitos aplicáveis, sem modificar produto. O mecanismo futuro será investigado pelo Codex quando autorizado.

**Escopo nesta fase:** IMPLEMENT_AND_EXECUTE_WHEN_FEASIBLE. Acrescentado pelas decisões de 18/10/2026; preservar distinção entre alvo de produto e estrutura de testes.

**Estado desta entrega:** SPEC_ONLY / NOT_RUN.

**Evidências a produzir:** run and source fingerprint; exact commands and phase; expected and observed states; independent assertions; relative evidence paths and hashes; reproduction or explicit non-execution reason.

**Referências:** [1](06-Decisoes-e-Autonomia.md)

