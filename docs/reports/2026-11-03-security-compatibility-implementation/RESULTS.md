# Resultados da etapa 1B

A campanha final usa os **183 inputs funcionais** de [SOURCE-MANIFEST.json](SOURCE-MANIFEST.json), fingerprint **ace17ce01ec8a0c5b908f0cb1a912f77af7b3f02af51313e7c749a2daeabc19d**. São bytes de src/, scripts/, tests/ e dos três arquivos de configuração listados no manifesto. A baseline anterior é e7f245afe1b3577213c8fee0b7ad8ff4f28e355c. Os documentos finais/atestação podem ser acrescentados depois da execução sem alterar esses inputs.

| Execução local final | Resultado | Duração observada |
| --- | --- | --- |
| Headless integral full14 | 315 resultados: 311 PASS, 0 FAIL, 4 SKIP, 0 cancelados | 8082.1 s |
| Infraestrutura infra14 | 111 resultados: 111 PASS, 0 FAIL, 0 SKIP, 0 cancelados | 95.0 s |
| Matriz ampla broad14 | 361 selecionadas: 355 PASS, 0 FAIL, 6 ENV_BLOCKED | 2324.4 s |
| Typecheck19 | exit 0 | 2.5 s |
| Build independente18 | exit 0 | 0.2 s |
| Smoke compilado14 | exit 0 | 158.8 s |
| Contraprovas nativas finais | 8 PASS, 0 FAIL; oito casos completos | recibos em EVIDENCE |

Full, infra, broad, typecheck, build e smoke conservaram os mesmos inputs antes/depois e entre fases, sem somar testes de versões diferentes. A matriz ampla também verificou seus domínios próprios de fontes e runner estáveis. Esses domínios e fingerprints são distintos do manifesto funcional e estão registrados em [VALIDATION.json](VALIDATION.json). Tempos são observações do ambiente, não benchmarks de desempenho do produto.

## Regressões dirigidas e seus limites

| Execução separada no ACE17/183 | Resultado | Alcance |
| --- | --- | --- |
| focus-ack-02 |8 PASS,0 FAIL/SKIP/cancelados | Oito pais e dez cenários/fixtures; também passaram na FULL14. |
| focus-materialization-01 |4 PASS,0 FAIL/SKIP/cancelados | Quatro pais e15 subcenários; também passaram na FULL14. |
| focus-base-origin-09 |6 PASS,0 FAIL/SKIP/cancelados | Origem base, transições, liberação e diagnóstico independente. |
| focus-safety-06 |17 PASS,0 FAIL/SKIP/cancelados | R-02/R-03, unstage, D-04, ignore, destino e consultas. |
| focus-recovery-03 |4 PASS de execução, exit0 | RECOVERY-001/003/014 e HARNESS-021; não certifica todo GL-19 ou encerra especificações pendentes. |

Os quatro testes de materialização cobrem ativação; restore/write/rename; interrupções/primeira ativação/metadados capture; e três rotas legadas. No quarto, present verifica recuperação normal e retry vazio; recorded-after-present verifica recusa prévia; late-disappearance verifica recusa tardia e barreira posterior. Os dois últimos ramos retornam antes das asserções de recuperação normal.

Pais, cenários e focos são unidades diferentes e não se somam à FULL14. Recibos em [VALIDATION](VALIDATION.json), [EVIDENCE](EVIDENCE.json) e [D01-FOCUSED-ACE17](d01-evidence/D01-FOCUSED-ACE17.json).

## Skips e bloqueios reais

- symlink file and paths through symlink directories are never adopted — Windows account cannot create symlinks; junction coverage runs separately.
- recovery cannot overwrite journals, arbitrary Git internals or symlink targets — Windows account cannot create symlinks.
- storage refuses symlink sources, destinations and parent directories — Windows account cannot create symlinks.
- terminal: Bash real preserva argumentos e não avalia metacaracteres da mensagem — Roundtrip Bash do host; o fluxo PowerShell tem verificação separada.

- INDEX-018 / native-advanced: ENV_BLOCKED — Effective Git add -h does not advertise --resolved; the resolved-staging operation was not executed.
- BRANCH-015 / native-advanced: ENV_BLOCKED — Effective Git branch does not advertise --delete-merged; no deletion operation was certified.
- REWRITE-015 / native-advanced: ENV_BLOCKED — Official history builtin absent from effective Git --list-cmds=builtins; no external git-history was launched.
- REMOTE-014 / native-advanced: ENV_BLOCKED — Official url-parse builtin absent in this Git; URL transport behavior is not inferred from help or a third-party parser.
- PROTO-007 / native: ENV_BLOCKED — git-shell is absent from the effective Git installation; inspected <Git-install>/mingw64/libexec/git-core/git-shell.exe, <Git-install>/cmd/git-shell.exe, <Git-install>/usr/bin/git-shell.exe, <Git-install>/mingw64/bin/git-shell.exe
- TOOLS-003 / legacy-transport: ENV_BLOCKED — Gitweb CGI is absent from the effective official installation default and fixture-configured paths; isolated PATH daemon probes are recorded. No browser or server was started. This does not assert absence everywhere on the host.

Não houve execução Linux nem certificação de todas versões Git. ENV_BLOCKED não equivale a suporte do produto e não foi convertido em PASS. Nenhuma execução de Electron ou CI remoto foi inferida.

## Comandos e escopo

Ambiente Windows x64, Node v24.14.1, Git 2.53.0.windows.2 oficial. Fixtures próprias externas, HOME/USERPROFILE/XDG/config/identidade/temporários isolados por processo. Nenhum comando destrutivo foi executado no checkout de desenvolvimento.

~~~text
node --import tsx --test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=stderr --test --test-concurrency=2 --test-timeout=900000 tests/unit/*.test.ts tests/unit/*.test.mjs tests/integration/*.test.ts tests/integration/*.test.mjs
node --test-reporter=spec --test-reporter-destination=stdout --test-reporter=tap --test-reporter-destination=stderr --test --test-concurrency=1 tests/git-compat/infra/*.test.mjs
node scripts/git-compat/runner.mjs --suite broad --jobs 2 --seed 20261103 --out <external-evidence>
node node_modules/typescript/bin/tsc --noEmit
node scripts/build-core.mjs
node scripts/smoke-core-cli.mjs --out <external-evidence>
~~~

O primeiro comando reproduz o corpus e os limites de npm test, acrescentando reporters spec e TAP para diagnóstico. Orçamentos explícitos de cenários compostos estão nos próprios testes; somente a criação composta da demonstração recebeu prazo próprio de 600 segundos, mantendo o default de 150 segundos dos demais usos desse helper e os limites dos subprocessos Git. Typecheck corresponde a npm run typecheck e build a npm run build:core; scripts de instalação/desktop não foram executados.

## Antes/depois e integridade das evidências

[EVIDENCE](EVIDENCE.json) conserva contraprovas D-01/D-02/P1, os46 pais selecionados da FULL14 e oito experimentos nativos finais. Os12 pais scoped possuem25 recibos de cenários identificados: não são25 novos testes ou PASS independentes. [VALIDATION](VALIDATION.json) mantém totais, comandos, fontes e recibos próprios por fase.

As seis regressões D-03, seis de origem base e cinco de fronteira passaram na FULL14. A regressão D-04 de commit com papel antigo integra o terceiro cenário diagnostics/unstage e não é contada de novo. [D03-HISTORY](D03-HISTORY.json), [BASE-ORIGIN-HISTORY](BASE-ORIGIN-HISTORY.json), [FRONTIER-HISTORY](FRONTIER-HISTORY.json), [STALE-COMMIT-BEFORE](STALE-COMMIT-BEFORE.json), [AMBIGUOUS-UNSTAGE-BEFORE](AMBIGUOUS-UNSTAGE-BEFORE.json) e [refs independentes](AMBIGUOUS-UNSTAGE-REFS.json) preservam os antes e fontes intermediárias.

O [ledgerD01](d01-evidence/D01-CONSOLIDATED.json) distingue49BA,6994, overlayV02 e ACE17. O TypeError app.stage da observação inicial6994 não é PASS ou recusa segura; a continuação correta confirmou o commit indevido. Os [históricos11/12/13](README.md) e [harness](HARNESS-HISTORY.md) preservam FAILs, SKIPs, bloqueios e interrupções, sem somar versões ou reclassificar falhas.

Broad14 tem355PASS/0FAIL/6ENV_BLOCKED entre361 selecionados e25NOT_RUN fora da seleção (cinco não selecionados e20 fora da fase). **MERGE-001 / core-merge-not-implemented-native-ff continua PRODUCT_GAP**: o PASS confirma NOT_IMPLEMENTED preservando HEAD/índice/disco e o fast-forward Git de controle, sem implementar merge gerenciado. Execução e suporte são dimensões distintas.

Logs/índices/bytes/fixtures têm preservação externa; publicam-se projeções compactas e hashes. `safe:true` não é backup nem prova de que C posterior ao staging exista em objeto Git.

## Procedimentos suplementares no snapshot final

[SUPPLEMENTAL14](SUPPLEMENTAL14.json) identifica binários, fonte183ACE17, Git independente e fechamentos observados:

- Uma execução da CLI compilada concluiu13 checks de origem, token stale, stagingB/commitB/discoC e uso da CLI.
- Rename gerenciado sem dono concluiu duas variantes (comum/ignorado), conservando owner:null, bytes e ausência de captura por B.
- O observador auxiliar inicial base-unstage encerrou1 antes do descarte ao exigir igualdade bruta de índice. A perícia confirmou apenas cache/stat/checksum e entradas semânticas idênticas. A continuação da mesma fixture encerrou0 e preservou C da base após descarte autorizado da Layer; a falha inicial permanece e o segundo observador é NOT_RUN.

Checks/variantes/continuação não aumentam315 resultados Node. [Reconstrução estática](acknowledgement-reconstruction/CHAIN-PLAN.md) e [dois replays49BA ESMV2](reproductions/README.md) têm identidades próprias: V1CJS bloqueou antes do produto; V2 longo falhou no setup Core antes dos hooks; V2 curto confirmou dois defeitos históricos por oráculos independentes. Código0 dessas contraprovas não aprova49BA ou a versão final.

## Código commitado e publicação

O código A `4ec2c037f1a3e4397ae49ae37b239df60bfcc26f`, sua instalação pelo lockfile em cópia nova, verificações compiladas e presença no servidor estão registrados em [PUBLICATION.md](PUBLICATION.md). Essa checagem não repetiu full/broad: confrontou os mesmos 183 inputs. O commit documental B deve conservar esse domínio e terá instalação/verificações e sincronização observadas após sua criação; o documento de B não antecipa sua própria aprovação.

## Campanha histórica FULL10

A campanha10 anterior terminou reprovada: 301 resultados Node, 295 PASS, 2 FAIL, 4 SKIP, 0 cancelamentos, exit 1, no snapshot 8fc/183. Seus dois FAILs de receita e o encerramento conservador dos coordenadores permanecem em [FULL10-HISTORY](FULL10-HISTORY.json), com [manifesto próprio](SOURCE-MANIFEST-10.json). Não integram nem aprovam os totais da campanha14 descrita acima.

## Verificação documental posterior

[HARNESS021-POST-DOCS.json](HARNESS021-POST-DOCS.json) registra 1 selecionada/1 PASS/0 FAIL/0 SKIP, produto NOT_ASSESSED, depois da consolidação. Filho e wrapper encerraram 0; o encerramento do wrapper foi observado pelo coordenador (tool chunk03ce71). Fonte183 ACE17 e os quatro documentos indicados permaneceram estáveis. Não se soma essa execução à FULL14/broad14 nem se certifica conteúdo dos outros documentos pelo cenário.

A primeira tentativa do verificador externo recusou antes de criar fixture ou executar a matriz: exigia nlink1 do executável Git instalado. O Git oficial possui nlink2. A cópia revisada verifica exclusivamente seu caminho, SHA-256 e identidade observados, mantendo nlink1 para documentos/fontes; não alterou Git, produto, fontes ou oráculos da matriz.
