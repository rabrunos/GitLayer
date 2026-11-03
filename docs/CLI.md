# CLI local `git-layer`

A CLI executa o Core e o Git oficial com argumentos separados. Não requer Electron, editor, plugin nem demonstração. Os contratos e limites de 02/11/2026 estão em [implementação do Core/CLI](IMPLEMENTATION-2026-11-02.md); as evidências anteriores do workshop não certificam esta versão.

## Build independente

Pré-requisitos: Node.js 22.12+, Git oficial e dependências do lockfile disponíveis. Se necessário, `npm.cmd ci --ignore-scripts` evita o postinstall do Electron. Na raiz das fontes:

```powershell
npm.cmd run build:core
node dist-core/cli/index.js --help
node dist-core/cli/index.js --cwd 'C:\caminho\repositorio' status --json
npm.cmd run cli:core -- --cwd 'C:\caminho\repositorio' status --json
```

O build usa esbuild e Node, recusa imports de dependências runtime externas e grava `dist-core/` sem apagar `dist/` ou `dist-debug/`. `dist-core/core/index.js` expõe o Core; `build-manifest.json` registra os inputs. Também é possível executar `node --import tsx src/cli/index.ts ...` durante desenvolvimento. Os scripts `build`/`cli`, o `bin` do pacote raiz e launchers anteriores continuam apontando para o pacote do laboratório; não são o build independente.

`git layer` funciona quando um launcher `git-layer` está no PATH do terminal. Não é necessário alterar o PATH permanente ou o Git global. Para ajuda via Git use `git layer -h` ou `git layer help`; `git layer --help` é interceptado pelo próprio Git para abrir o manual, cujo empacotamento não foi implementado. Os exemplos abaixo usam execução direta para evitar depender de launcher previamente instalado.

## Comandos públicos

Em todos os exemplos, `$cli` pode ser o caminho absoluto de `dist-core/cli/index.js`, e `$repo` é o repositório escolhido deliberadamente. Os caminhos de arquivos vêm depois de `--`, como argumentos separados; use aspas para espaços e acentos.

| Comando | Contrato |
|---|---|
| `init` | Inicializa o estado Layers; também cria Git se a pasta ainda não for repositório. |
| `list` | Reconhece branches locais e candidatas remotas `layer/<nome>`, sem ativá-las. |
| `create <nome>` | Cria ref Git real, histórico independente e Layer inativa. |
| `register <nome>` | Valida/integra uma ref existente ou cria tracking local de uma única origem remota; não exige classificação manual do prefixo. |
| `on <nome>` | Valida a composição e materializa arquivos da Layer. |
| `off <nome>` | Desativa somente se pendências estiverem resolvidas. |
| `off <nome> --discard --yes` | Descarta pendências dessa Layer por escolha explícita e desativa. |
| `edit <nome>` / `edit-end` | Escolhe/encerra destino dos arquivos novos, sem desativar automaticamente. |
| `status [<nome>]` | Mostra branch/papel, Layers, destino e pendências por origem. |
| `preview <on|off|remove> <nome>` | Consulta lógica de efeitos e impedimentos, incluindo newcomers do target ainda não persistidos, sem aplicar a ação. |
| `rename <nome> <novo>` | Renomeia ref/identidade local e valida os vínculos de uso. |
| `remove <nome> --yes` | Remove localmente sem autorizar descarte implícito de pendências. |
| `remove <nome> --discard --yes` | Autoriza também descarte explícito de pendências. Não exclui remoto. |
| `open-branch <nome>` | Abre deliberadamente a Layer como branch de trabalho, mantendo outras Layers compatíveis. |
| `switch <branch> [--off-current-layer]` | Troca preservando Layers compatíveis; a opção não reativa a origem que era branch de trabalho. A rota comum recusa selecionar Layer. |
| `protect` / `unprotect` | Instala/remove reservas de branches Layer em worktrees locais comprovadamente próprias; nenhuma ref Layer é removida por `unprotect`. |
| `migrate --yes` | Copia layout legado para `layers` com verificação e origem preservada. |
| `doctor [--fsck]` | Diagnostica sem depender de abrir normalmente metadados válidos. |
| `recover` | Tenta recuperar journals sem sobrescrever edição posterior. |
| `recovery-export <pasta-nova>` | Copia evidências para destino novo, inclusive com metadados inválidos. |

Layers exigem primeiro commit e nome diferente de `base`, que representa a origem da branch de trabalho nas APIs. O commit raiz vazio criado internamente para uma Layer não copia a base nem ativa arquivos. Uma branch prefixada com conteúdo incompatível é reconhecida, mas sua composição pode ser recusada sem filtrar/destruir o conteúdo. Candidatas remotas são identificadas pelas namespaces dos remotes configurados. `on`/`register` criam uma branch local de tracking somente quando há uma origem remota única e ainda não existe a local. Duas origens remotas para o mesmo nome causam recusa; escolha explicitamente com `git branch --track layer/<nome> <remoto>/layer/<nome>`. `preview` e `log` podem consultar a candidata única sem criar a branch local.

## Destino explícito e composição

```powershell
node $cli --cwd $repo init
node $cli --cwd $repo create scripts
node $cli --cwd $repo create ia
node $cli --cwd $repo on scripts
node $cli --cwd $repo on ia
node $cli --cwd $repo edit scripts
# Crie arquivos por editor, terminal ou outra ferramenta comum.
node $cli --cwd $repo status --json
node $cli --cwd $repo add scripts -- scripts/novo.ps1
node $cli --cwd $repo commit scripts -m 'Scripts locais'
node $cli --cwd $repo edit-end
```

O destino é persistido por workspace até encerramento/troca e reconciliado nos comandos/consultas do produto. Não faz commit automático, não absorve retroativamente arquivos sem dono e não transfere outra origem. Sem destino, arquivos novos seguem o fluxo da branch de trabalho, mesmo com várias Layers ativas. Para atribuir um arquivo local anterior ainda sem dono, use `add <nome> -- <arquivo>` explicitamente.

A propriedade dos arquivos novos é reconciliada na consulta/comando seguinte. Antes disso, o target aberto já mantém exclusões gerenciadas para proteger os novos caminhos do `git add` comum, com exceções exatas para os arquivos anteriores sem dono que já eram elegíveis. Não há watcher nem interceptação do executável Git. `git add -f` e negações de ignore de maior prioridade podem contornar a proteção; GL-01/09/18 continuam parciais frente a esses caminhos. Encerrar o destino preserva arquivos físicos e propriedade já atribuída.

A reconciliação avalia a intenção de ignore do usuário sem o bloco temporário gerenciado: regras de info/exclude, core.excludesFile e .gitignore mantêm prioridade/negações nativas. Arquivos assim ignorados não são reservados automaticamente; inclusão deliberada continua separada. O helper fornece ao Git um arquivo exclusivo de regras limpas em temporário externo, sem alterar metadata, refs, índices, exclude ou worktree do repositório, e remove sua entrada em finally. As [contraprovas R-02/R-03](evidence/closure-2026-11-02/review-target-preview.json) distinguem falhas anteriores e testes dirigidos aprovados.

A prévia off/remove pode ser usada diretamente após criar um arquivo externamente, sem status intermediário. Ela inclui os novos arquivos elegíveis em disappears/unreconciled e pendências; não altera o repositório. logicalComplete:false indica impedimento na enumeração. A ação revalida e pode recusar mudanças posteriores. A confirmação interativa exibe essa mesma prévia; confirmar remoção não autoriza automaticamente descarte.

## Preparação, commit, diff e histórico

| Comando | Efeito |
|---|---|
| `add <nome> -- <caminho>...` | Atribui/prepara lote autorizado no índice da Layer. |
| `unstage <nome> -- <caminho>...` | Retira da preparação preservando reserva e disco. |
| `release <nome> -- <caminho>...` | Libera somente reserva nunca commitada e já não preparada. |
| `diff <nome> [--staged] [-- <caminho>...]` | Diferença da origem escolhida. |
| `commit <nome> -m <mensagem>` | Registra somente seu índice Git, sem dividir commits automaticamente. |
| `log [<nome>]` / `show <revisão>` | Consulta histórico/commit Git. |
| `hunks <base|nome> -- <arquivo>` | Lista trechos suportados e token. |
| `stage-hunk <base|nome> --hunk <n> --token <token> -- <arquivo>` | Prepara trecho com estado ainda válido. |
| `restore <base|nome> [--yes] -- <caminho>...` | Restaura disco a partir do índice com backup; não faz unstage. |

Preparar todas as mudanças e fazer um commit só é o fluxo normal de GL-14. Preparar trechos é opcional. Os hunks começam em zero; token obsoleto é recusado, sem fallback para arquivo inteiro. Binários e patches não suportados exigem preparação integral. Preparar B e editar disco para C não faz o commit do índice capturar C silenciosamente.

Para a branch de trabalho, use `base-add -- <caminhos>`, `base-unstage -- <caminhos>` e `base-commit -m <mensagem>`. O índice dessa origem é separado dos índices das Layers ativas. `branches`, `branch-create <nome>` e `branch-delete <nome>` oferecem gerenciamento tradicional conservador; a exclusão não força histórico não integrado.

## Pendências e confirmações

`off` com pendências exige commit, descarte explícito ou cancelamento. `--park` é recusado; não há novo auto-guardar para reativar depois. Shelves históricas e backups de recuperação são preservados. `off --yes` sem `--discard` é erro de uso.

`remove` exige confirmação, mesmo sem descarte. Em TTY, a CLI mostra a prévia e pede `sim`; `--yes` confirma explicitamente para automação. Sem TTY ou com `--json`, ausência de `--yes` causa erro de uso. Confirmar remoção não equivale a escolher descarte: com pendências também é necessário `--discard`. `restore` tem sua própria confirmação e backup.

```powershell
node $cli --cwd $repo preview off scripts --json
node $cli --cwd $repo off scripts
node $cli --cwd $repo preview remove ia --json
node $cli --cwd $repo remove ia --yes
```

A operação real revalida o estado. Uma prévia não concede autorização futura nem permite aplicar cegamente um estado antigo.

## Seleção de branch e proteção opcional

```powershell
node $cli --cwd $repo protect
node $cli --cwd $repo open-branch scripts
node $cli --cwd $repo status --json
node $cli --cwd $repo switch main
node $cli --cwd $repo unprotect
```

`protect` é opt-in por repositório e cria reservas em worktrees Git próprias sem checkout de arquivos da Layer. Isso usa a recusa nativa de selecionar uma branch já em uso em outro worktree. `unprotect` remove somente reservas com propriedade comprovada, preservando branches e dados desconhecidos. Não altera Git/configuração global. A abertura deliberada ajusta sua própria reserva; outras Layers não são desligadas por conveniência.

Branches criadas pelo Git fora do produto exigem reaplicar `protect`; remover/prunar uma reserva por fora pode retirar a proteção e será diagnosticado nas operações gerenciadas. O Git oferece `--ignore-other-worktrees`; esse bypass continua existindo. Sem `protect`, o executável Git direto aceita a seleção normal da branch Layer. Assim, a prevenção padrão tem escopo demonstrável, mas GL-22 não representa bloqueio universal contra qualquer comando nativo, processo externo ou topologia. O relatório distingue esses caminhos e os efeitos reais.


Ao sair de uma Layer aberta como branch, o comportamento padrão de `switch` retoma essa origem como camada somente se ela já estava ativa antes da abertura. Se os commits feitos nesse modo acrescentaram arquivos de controle que não podem ser projetados, a retomada é recusada antes dos efeitos.

`switch <branch> --off-current-layer` é a escolha explícita de voltar à branch indicada **sem reativar a Layer que era a branch de trabalho**. A referência e seus commits são preservados. A opção não descarta pendências, não dispensa commit/índice limpo da branch de trabalho, não remove arquivos de outras origens e não desativa as demais Layers; elas continuam sujeitas à composição e à revalidação do destino. Pode ser usada também por quem simplesmente não quer retomar aquela origem. Se a origem não seria retomada, a opção não muda o conjunto das outras Layers.

```powershell
# Voltar mantendo o comportamento padrão de retomada:
node $cli --cwd $repo switch main
# Escolher explicitamente não reativar a origem que era branch:
node $cli --cwd $repo switch main --off-current-layer
```

Reconhecer/registrar uma branch Layer que contém `.gitignore`, `.gitattributes` ou `.gitmodules` preserva sua identidade e seu histórico. Isso não autoriza projetar esses controles sobre outra origem. `on` recusa essa composição antes de publicar arquivos; a entrada deliberada como branch é um papel diferente, ainda sujeita à convivência segura com as outras Layers. A opção de saída não é um bypass universal para atributos, hooks, filtros ou estados fora do envelope de suporte.

## Migração, resgate e transporte

Instalações novas usam `layers` no diretório Git descoberto. Layout legado continua em `git-layers` até `migrate --yes`. A migração preserva origem, shelves, índices e backups, recusa destino desconhecido e recuperação pendente e mantém cópia interrompida identificável. Teste uma cópia descartável antes de decidir migrar dados reais; o suporte foi validado somente em fixtures desta tarefa.

```powershell
node $cli --cwd $repo doctor --json
node $cli --cwd $repo recovery-export 'C:\pasta-nova-de-resgate'
node $cli --cwd $repo migrate --yes
```

`doctor`/`recovery-export` não exigem `GitLayers.open` normal. Exportar não repara automaticamente, sobrescreve destinos nem remove lock disputado. Para compartilhar histórico use Git oficial, por exemplo `git push remoto layer/scripts` e `git fetch remoto`. Reconhecer uma ref recebida não ativa a Layer. Nenhum comando CLI envia exclusão remota ou cria serviço de nuvem próprio.

## Captura legada e saída

A API legada continua disponível para compatibilidade: `capture <nome> [--path <pasta>]` interativo, `capture-start`, `capture-review`, `capture-confirm -- <caminhos>` e `capture-cancel`. A revisão/seleção é explícita e cancelar preserva disco. Esse mecanismo não é obrigatório para o novo destino de edição. Ctrl+C no capture interativo resulta em 130.

`--cwd <pasta>` seleciona o repositório. `--json` escreve `{ "ok": true, "result": ... }` em stdout ou `{ "ok": false, "error": { "code", "message", "details"? } }` em stderr. Sem JSON, diffs e ajuda são texto e os demais resultados são JSON legível. O capture interativo não aceita `--json`.

| Código | Significado |
|---|---|
| 0 | Operação concluída ou cancelada na confirmação. |
| 2 | Uso/opção/argumento inválido ou confirmação não interativa ausente. |
| 3 | Composição, propriedade ou estado recusado; `doctor` com `safe:false`. |
| 4 | Falha Git/processo/IO ou erro inesperado. |
| 5 | Recuperação/journal pendente. |
| 130 | Captura cancelada por Ctrl+C. |

`doctor` com `safe:false` retorna código 3 e preserva o diagnóstico em stdout como `{ "ok": false, "result": ... }`; isso permite automação sem declarar um bloqueio como sucesso. Ignorar caminhos já reconhecidos ajuda `git add .`, mas `git add -f`, comandos destrutivos e regras do usuário de maior prioridade mantêm os limites do Git direto. Veja [segurança](SAFETY.md), [limitações](LIMITATIONS.md) e o relatório novo antes de atribuir suporte a uma variante.
