# Testes e critérios de aceitação

Os testes de domínio utilizam o Git instalado. Comparam referências, árvores, blobs, bytes do índice principal, staging e arquivos físicos. Não substituem o Git por mocks. Os repositórios são descartáveis e usam diretórios exclusivos em os.tmpdir(); identidade é configurada somente no repositório de teste. Os testes não escrevem na configuração global nem acessam repositórios do usuário.

Este documento descreve o que existe na suíte. A aprovação, as quantidades finais, os comandos efetivamente executados e as limitações do ambiente constam em `TEST-REPORT.md`. A presença de um caso abaixo não significa que ele passou ou que foi executado na plataforma do leitor.

Para o ciclo diário, use **Workshop → Testes unitários rápidos** ou `npm.cmd run test:unit`. Integração com Git real e Playwright/Electron são etapas separadas; veja [DEVELOPMENT.md](DEVELOPMENT.md). Não é necessário controlar a tela do Windows para executar o teste desktop. A pasta padrão para uso manual é `C:\Dev\GitLayerTest`; testes destrutivos continuam em fixtures temporárias.

## Executar

Pré-requisitos: Node.js compatível com `package.json`, npm e Git no PATH. A instalação das dependências exige acesso aos registros e ao runtime Electron; os fluxos do aplicativo usam somente Git e arquivos locais.

```sh
npm.cmd ci
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run package
npm.cmd run test:e2e
```

`npm.cmd test` executa `node --import tsx --test --test-concurrency=2 --test-timeout=180000 tests/unit/*.test.ts tests/unit/*.test.mjs tests/integration/*.test.ts tests/integration/*.test.mjs`. Os testes TypeScript são transpilados nesse comando; `typecheck` verifica separadamente o código de produção em modo strict. O comando é destinado ao ambiente de desenvolvimento; usar o pacote portátil não exige instalar a suíte.

Para executar um subconjunto durante uma correção:

```sh
node --import tsx --test --test-name-pattern='checkpoints retain|after-commit-ref' tests/integration/core.test.ts
node --import tsx --test tests/unit/paths.test.ts
node --import tsx --test tests/integration/storage.test.ts tests/integration/recovery.test.ts
```

Não aponte testes nem failpoints para um projeto real. Os testes de garbage collection e adição forçada são restritos aos repositórios descartáveis criados pela própria suíte. `GIT_LAYERS_FAILPOINT` injeta uma exceção numa etapa explícita; isso exercita journals e recuperação, mas não simula todas as possibilidades de queda do sistema ou interrupção durante uma gravação.

## Arquivos da suíte

| Arquivo | Verificação |
| --- | --- |
| `tests/unit/paths.test.ts` | Política portátil, caracteres perigosos, aliases Git/Windows/Unicode, colisões por componentes. |
| `tests/unit/platform.test.ts` | Ambiente Path/PATH, descoberta do Git Windows, índices com barras compatíveis, modos físicos e caminhos de entrada nativos. Casos puros executados no host não são execução Windows. |
| `tests/unit/windows-package.test.mjs` | Launchers portáteis, cabeçalho PE x64 e integridade mínima de payload. Testes estáticos, sem iniciar Windows. |
| `tests/integration/windows-compat.test.ts` | Caminhos com espaços/acentos, CRLF/binários, índice principal intacto, hooks desabilitados, permissões/metadados e recusa de links/junctions. A ramificação de junction exige Windows. |
| `tests/integration/core.test.ts` | Refs e índices reais, propriedade, commits independentes, shelves, captura, hunks, ignore, checkpoints, GC, recuperação e composição física. |
| `tests/integration/cli.test.ts` | Processos reais da CLI, códigos de saída, JSON, nomes literais, captura, confirmação de restore e criador da demonstração. |
| `tests/integration/editor.test.ts` | APIs reais do editor: repositório unborn, identidade local, primeiro commit, leitura/gravação UTF-8 e CRLF, hash obsoleto, binários, renomeação por proprietário e exclusão com backup. Não substitui testes gráficos. |
| `tests/integration/storage.test.ts` | Publicação de JSON, backups, modos, marcadores de ausência, journals, locks e recusa de symlinks. |
| `tests/integration/recovery.test.ts` | Validação independente de planos de recuperação, backups alterados/ausentes, destinos fora do workspace e alvos Git protegidos. |
| `tests/e2e/desktop.test.mjs` | Fluxo configurado para o executável empacotado, Monaco, commit real, limites IPC, conteúdo inerte, tema e observação de rede. A execução gráfica não foi concluída neste ambiente; consulte o relatório. |

## Mapeamento dos 30 cenários solicitados

Os nomes abaixo são os títulos dos testes; alguns estão abreviados pelo trecho que os identifica. `Core` indica `tests/integration/core.test.ts`, `CLI` indica `tests/integration/cli.test.ts` e `E2E` indica `tests/e2e/desktop.test.mjs`.

| # | Critério | Evidência disponível e limite |
| --- | --- | --- |
| 1 | Fluxo tradicional sem Layers | Core: `base flow uses the actual index, branch ref, staged tree and commit`; CLI: fixture cria o primeiro commit com `base-add`/`base-commit`; `editor.test.ts` inicializa um repositório unborn e cria seu primeiro commit após configuração explicitamente local da identidade. |
| 2 | Duas Layers, HEAD tradicional e arquivos reais | Core: `two active Layers project real files while HEAD and base index stay unchanged`. Compara árvores e raízes independentes. |
| 3 | `git add .` nativo protege Layers | Core: `native git add dot protects Layer files and adds ordinary new files`. Executa também adição explícita sem força e verifica sua recusa. |
| 4 | Isolamento de refs/índices | Core: `Layer stage and commit preserve base staging and the other Layer index bytes`; CLI: `CLI commits a real Layer ... leaves HEAD/base index intact`. |
| 5 | Árvore de Layer sem arquivos da base | Core: comparação de `ls-tree` no teste de duas Layers; `a mixed-owner batch is rejected before any part gets staged`; `base ownership includes staged additions ...`. |
| 6 | Commit exato do staged | Core: `a Layer commits exactly staged content and retains later disk edits`; CLI confere o blob e os bytes posteriores no disco. |
| 7 | Hunk e token obsoleto | Core: `base and Layer partial staging select one hunk and reject a stale token`; `partial unstage removes one staged hunk ... refuses obsolete tokens`. |
| 8 | Reservas após unstage/reabertura | Core: `new-file reservations survive unstage and reopening without leaking to base`; `release explicitly removes only a never-committed unstaged reservation`. |
| 9 | Captura somente de novos caminhos | Core: `capture selects only newly appearing paths and ends after confirmation`; CLI: `CLI shared capture selects new paths only ...`. |
| 10 | Cancelar captura preserva arquivos | Core: `capture cancellation preserves candidate bytes without assigning ownership`; CLI também cancela uma sessão posterior. |
| 11 | Colisão direta, mesmo com bytes iguais | Core: `activation refuses preexisting untracked bytes even if identical`; `an independent branch containing a base-owned file cannot be activated as a Layer`; unit: `equal paths from two owners collide ...`. |
| 12 | Prefixos, caixa, Unicode, nomes e links | Todos os testes unitários de caminhos; Core: `symlink file and paths through symlink directories are never adopted`, colisões com ancestral, árvore de diretório, alias de arquivo e diretório vazio. Junctions têm casos nativos Windows; symlinks sem privilégio informam skip. |
| 13 | Arquivos locais não rastreados/ignorados | Core: testes de ativação com arquivo idêntico, arquivo ignorado, ancestral ocupado e diretório com arquivo precioso. |
| 14 | Shelf preserva estados e modos | Core: `park and reactivation preserve staged, unstaged, reserved and deleted files`; `binary, UTF-8, LF, CRLF and executable mode survive clean off/on`. O modo executável é conferido quando a plataforma o suporta. |
| 15 | Diretório compartilhado preservado | Core: `deactivation removes only Layer files in a shared directory`. |
| 16 | Troca compatível e recusa da incompatível | Core: `managed switch preserves dirty Layer state and rejects colliding branch`. Compara HEAD, índice e bytes depois da recusa. |
| 17 | Buffers não salvos e rascunhos | O E2E verifica buffer distinto do disco; verify:dev verifica reinício, rascunho restaurado e salvamento. Nem todas as combinações de conflitos de buffers são cobertas. |
| 18 | Negação de ignore detectada | Core: `ignore negation blocks assignment ...`; `a later ignore negation marks the active composition unsafe before the next mutation`. Compara status, doctor e ausência de mutação. |
| 19 | Espaços, acentos e metacaracteres | Core: `literal pathspec and ignore metacharacters do not stage neighboring files`; CLI usa nomes com espaço, acento, colchetes e hífen inicial. |
| 20 | LF, CRLF, UTF-8, binários e modos | Core: teste de roundtrip misto e `native text eol attributes normalize the blob and restore exact CRLF bytes`. Compara buffers e blob normalizado pelo Git. `editor.test.ts` confere CRLF na leitura/gravação, rejeição de hash obsoleto e recusa de sobrescrita textual de binários. |
| 21 | Ref alterada externamente | Core: `external Layer ref movement refuses commit without overwriting new ref or disk`. A atualização externa usa `commit-tree`/`update-ref` reais. |
| 22 | Concorrência e locks | Core: `concurrent Core writers are serialized or one fails without corrupting refs`; `an existing coordinator lock ...`; storage: `coordinator rejects concurrent processes ...`. |
| 23 | Falhas injetadas e trabalho posterior | Core: casos `after-stage-index`, `after-stage-checkpoint`, `after-activate-files`, `after-deactivate-files` e `after-switch-head`; recuperação recusa sobrescrever bytes posteriores. Não equivale a teste de corte de energia. |
| 24 | Sem duplicar commit após avançar ref | Core: `a crash after Layer ref advancement is recovered without a duplicate commit`. Compara OID e quantidade de commits antes/depois. |
| 25 | Staging retido por checkpoint durante GC | Core: `checkpoints retain staged blobs after reflog expiration and immediate garbage collection`. Executa `reflog expire`, `gc --prune=now` e `fsck` somente na fixture. |
| 26 | Schema inválido/futuro e locks | Core: `future metadata schema ...`, `future reservation metadata schema ...`, `malformed metadata ...`, lock existente; storage e recovery verificam validação, backups e caminhos de journals. |
| 27 | Limites de comandos externos destrutivos | Core: `forced native addition demonstrates the protection limit and is diagnosed`. A suíte não executa `git clean -fdx`, `reset --hard` ou checkout externo destrutivo para afirmar recuperação desses bytes. |
| 28 | Conteúdo inerte e limites IPC | Unit valida caminhos; `editor.test.ts` testa a recusa de travessia, `.git` e caminho absoluto pela API de leitura do Core. O E2E abre HTML e recusa operações IPC inválidas. Os resultados gráficos Windows estão no relatório atual. |
| 29 | Sem rede/CDN no funcionamento | O E2E inspeciona recursos, requisições HTTP e preferências Electron. Os resultados da execução estão no relatório. Inspeção de build complementa a verificação gráfica. |
| 30 | ZIP extraído instalável/compilável | `scripts/verify-extracted.mjs` extrai, executa `npm.cmd ci`, build, ajuda compilada, launcher local, demonstração e `git layer doctor`. Não abre o desktop; use o E2E separado. O resultado efetivo está no relatório. |

O caso adicional `Layer root creation and stage checkpoints need no personal identity but user commits do` remove nome/email locais e ativa `user.useConfigOnly`: a criação do commit interno raiz e o stage/checkpoint devem funcionar; um commit do usuário deve falhar sem avançar refs nem alterar o índice principal.

## Desktop empacotado

O E2E importa o Core compilado e exige que `npm.cmd run build` e `npm.cmd run package` tenham terminado. O executável padrão é resolvido em `artifacts/` para a plataforma/arquitetura atuais; para outro caminho, defina `LAB_E2E_EXECUTABLE`.

O teste mantém `contextIsolation`, sandbox e `webSecurity`. Não adiciona `--no-sandbox` para contornar limitações do host. Falta de display, bibliotecas nativas ou permissão de sandbox impede a execução; esses casos devem ser registrados como não testados, não como aprovação. O suporte Electron do Playwright é experimental.

Mesmo quando executado com sucesso, esse fluxo não cobre todos os diálogos, leitores de tela, atalhos, conflitos de buffers, reconstrução completa após encerramento abrupto ou operações em todas as plataformas.

## Verificar outra extração

```sh
npm.cmd run verify:extracted -- /caminho/absoluto/git-layers-lab.zip
```

Esse script requer rede para reinstalar dependências e o Electron a partir do lockfile entregue. A verificação do executável gráfico continua separada. A edição 0.1.1 foi empacotada para Windows x64; não foi executada em Windows nativo. Testes no host não comprovam essa execução. Não há promessa de hooks, filtros externos, assinatura ou complementos Git que constem como incompletos em `LIMITATIONS.md`.

## Local das fixtures

As fixtures usam o diretório temporário local do sistema, com remoção ao final. A execução anterior no workspace gerenciado da tarefa registrou reaparecimento de arquivos apagados durante leituras Git. O relatório conserva essa falha e a comparação entre locais; não houve remoção de asserções nem fallback que permitisse sobrescrever um destino. Use um diretório temporário normal e isolado para reproduzir os testes, e não uma árvore sincronizada por outra ferramenta.

## Workshop 0.1.2

Use npm.cmd run workshop:prepare e workshop:doctor para preparar as fontes. O npm.cmd run workshop:ui testa o Electron local instalado, sem empacotar, com perfil e repositório descartáveis. LAB_E2E_APP/LAB_E2E_DIST permitem apontar para dist-debug. O resultado é gravado em .workshop/reports, e falha de inicialização nunca vira skip ou aprovação.

Novos casos: terminal-commands.test.ts compara catálogo e CLI; terminal.test.ts cobre estado/limites/geração PowerShell; terminal-runtime.test.mjs executa status e captura por TTY real; file-decorations.test.ts cobre badges e propriedade sem alterar o snapshot; workshop-ui.test.mjs garante propagação de falhas e registros novos. e2e-wait.test.mjs impede aprovação prematura de condições assíncronas. Contagens e skips atuais estão em TEST-REPORT.md.

O scripts/verify-debug-build.mjs confere sourcesContent e os mapas portáveis. npm.cmd run verify:package confere PE/ASAR, CLI e módulo nativo Windows byte a byte. Essas inspeções não comprovam execução nativa Windows.
