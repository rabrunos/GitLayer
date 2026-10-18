# Relatório de execução — Git Layers Lab 0.1

Data da execução: 17–18/10/2026 (America/Sao_Paulo / UTC). Classificação: **experimental parcial**. Não é uma declaração de conclusão de todos os critérios da especificação.

## Ambiente efetivamente utilizado

| Item | Versão/plataforma |
| --- | --- |
| Sistema | Ubuntu 24.04.3 LTS, Linux x64, kernel 6.18.55 |
| Node.js | 24.19.0 |
| npm | 11.9.0 |
| Git real | 2.43.0 nativo na verificação final; 2.51.1 também exercitado |
| Electron instalado/empacotado | 44.9.0; aplicação gráfica não iniciou |
| React / Monaco / Vite / TypeScript | 19.3.1 / 0.57.0 / 8.3.4 / 5.9.3 |
| Playwright / @electron/packager | 1.64.1 / 20.3.0 |

`package-lock.json` foi produzido por instalação npm real. Nenhuma versão, binário ou lockfile foi inventado. Os comandos Git foram executados em repositórios descartáveis, com identidade local e ambiente isolado, sem Git global alterado e sem repositórios/remotos do usuário.

## Resultados consolidados

**85 cenários distintos aprovados nas verificações finais por grupo:** 80 de Core/editor/armazenamento/recuperação/caminhos na execução ampla e 5 de CLI no rerun do arquivo corrigido. Typecheck, build, pacote Linux e instalação/build de uma extração independente também passaram. **O teste gráfico não passou da inicialização: 1 tentativa, 0 aprovações.**

A execução ampla de 85 casos terminou com 81 aprovações e 4 erros no harness da CLI (`os` não importado depois de mudar o diretório das fixtures). Corrigi a importação; o arquivo inteiro da CLI passou 5/5 em seguida. Os outros 80 casos já haviam passado. Os registros são separados, sem inventar uma saída única 85/85. Fontes de produção/artefatos ficaram iguais durante esse ajuste do harness.

| Verificação final | Resultado |
| --- | --- |
| Core, incluindo nome reservado base | 51 cenários aprovados |
| APIs de arquivos/editor | 3 aprovados |
| Armazenamento e validação de recuperação | 14 aprovados |
| Política de caminhos | 12 aprovados |
| CLI em processos reais | 5/5 aprovados após corrigir harness; 20724,554632 ms |
| E2E Electron empacotado | 1 tentado; falha no preflight de sandbox; 0 asserções gráficas executadas |
| Extração independente | npm ci, build, ajuda compilada, launcher, demonstração e doctor real concluídos |

As saídas originais estão em `docs/evidence/`. O total de 85 conta cada cenário uma vez; não soma repetições de testes direcionados.

## Verificações já executadas

| Comando/verificação | Resultado observado |
| --- | --- |
| `npm view` e `npm install` | Versões diretas verificadas e dependências instaladas; lockfile real com integridades. |
| `npm run typecheck` | Aprovado em TypeScript strict. |
| `npm test` — primeira execução integral estabilizada | **79/79 aprovados**, sem falhas, skips ou cancelamentos, 146842,568525 ms. Saída em `evidence/TESTS-79.txt`. |
| Dois testes adicionais sem identidade/schema de reservas | **2/2 aprovados**; sem identidade pessoal o checkpoint funciona e o commit de usuário é recusado; schema futuro não é sobrescrito. |
| `npm test` — repetição ampliada | **80/81 aprovados, 1 falha**, 146539,170238 ms. A reativação de shelf foi recusada porque o destino `scripts/new.py` apareceu depois da validação; nenhuma sobrescrita foi autorizada. A investigação e a execução final constam abaixo. |
| Troca gerenciada e recuperação após `after-switch-head` após a última proteção de fingerprints | **2/2 aprovados**, 6517,533284 ms. A recuperação conclui na branch de destino e preserva staged/unstaged. |
| APIs do editor — primeiro commit, UTF-8/EOL/binários/gravação obsoleta, renomeação/exclusão/backup | **3/3 aprovados**; são testes do Core, não da janela Electron. |
| `npm run build` | Aprovado: Core/CLI/main/preload compilados e renderer de produção com Monaco/workers/ícones/fontes locais. Vite processou 1120 módulos; alerta de chunks grandes não impediu o build. |
| `npm run package` | Pacote Linux x64 real gerado com runtime Electron, assets e ASAR. Conteúdo verificado; não equivale a execução visual. |
| `npm run test:e2e` | **1 teste tentado, 0 aprovados, 1 falhou no lançamento**. O Electron recusa execução como root sem desabilitar sandbox; nenhuma asserção de interface foi alcançada. Não foi usado `--no-sandbox` para declarar aprovação. |
| CLI pelo Git com PATH local | `git layer -h`, `git layer ... status --json` e `doctor --json` executados por launcher local; sem substituir Git ou instalação global. |
| Captura em PTY | `q` → revisão → seleção → `sim` preparou o candidato real. Ctrl+C na observação e revisão preservou os arquivos, cancelou a sessão e retornou 130. Teste manual, separado da contagem automatizada. |
| Garbage collection controlada | Teste real usa stage, checkpoint alcançável, expiração/prune/`fsck`, preservando o blob preparado. Executado somente na fixture descartável. |

Os comandos foram repetidos durante correções; a tabela não soma essas repetições como novos testes. As primeiras execuções encontraram falhas reais: `check-ignore` incompatível com modo global de pathspec literal; leitura com `write-tree` alterando cache do índice; uso de `diff-files` reportando diferenças de stat sem diferença de conteúdo; journals com fingerprints obsoletos; recuperação de switch ainda ausente. Esses pontos foram corrigidos, e seus cenários passaram nas execuções seguintes. Não se usa somente a execução verde anterior para ocultar a recusa intermitente posterior.

## Investigação da recusa intermitente

O teste de shelf em diretório de trabalho observou um arquivo presente entre o preflight e a publicação, sem processo de teste deliberadamente modificando esse caminho. A aplicação recusou o destino e preservou journals/backups. Ocorrências semelhantes de resíduos após remoção também foram observadas na preparação dos artefatos. Um probe simples de 100 escritas/remoções por local, tanto no workspace quanto em `/tmp`, não reproduziu o problema. Esse probe isolado não prova a causa nem substitui o teste de integração.

A instrumentação reproduziu o cenário no scratch com Git 2.51.1 e com Git nativo 2.43.0. Um arquivo deletado reapareceu com **novo inode e o mesmo hash antigo** durante chamadas de leitura `config`/`rev-parse`, sem escrita/cópia/rename correspondente do Node. O cenário equivalente em `/tmp` passou **18/18** vezes. O trecho relevante está em `evidence/SCRATCH-REAPPEARANCE.json`. O rastreamento de syscalls não pôde ser realizado por restrição do ambiente; a causa exata não foi provada.

Uma execução mista posterior teve 83/84 aprovações: os casos do Core já estavam em temporários e passaram; um teste novo do editor ainda usava scratch e observou o arquivo original reaparecer depois da renomeação. Todos os arquivos de testes agora usam temporários locais exclusivos, preservando comandos e asserções. A execução ampla seguinte aprovou todos os 80 casos fora da CLI; os 4 erros restantes eram a importação no harness, corrigida e reexecutada separadamente. Não se afirma que a mudança de local resolveu qualquer interferência de programas externos em geral.

O app conserva a recusa de destinos surgidos depois da validação. Não houve fallback para sobrescrever arquivos idênticos nem supressão de testes de integridade.

## Alcance e pendências

| Categoria | Situação |
| --- | --- |
| Implementado/testado com Git real | Core e CLI, exclusividade de propriedade, índices/refs, stage/unstage/hunks, commits exatos, checkpoints/GC, captura, shelves, switch, exclusões/negação, caminhos, locks/journals e APIs de arquivo nos cenários automatizados. |
| Implementado/compilado sem teste gráfico concluído | Desktop React/Monaco/Electron, IPC real da janela, workers no pacote, watchers, temas, teclas, acessibilidade, conflitos de buffers e recuperação de rascunhos. O código está conectado ao Core; não há validação E2E aprovada. |
| Não implementado | Amend, tags mutáveis, stash mutável, merge/cherry-pick/revert e resolução/continue/abort; reconciliação automática de ref Layer alterada por terceiros; operações recursivas de renomear/excluir diretórios. |
| Não testado | Windows/macOS, instaladores/assinatura/notarização, junctions/reparse points Windows, perda real de energia, desempenho/carga ampla, todos os cenários de programas externos destrutivos. |
| Fora da v0.1 | Rede, GitHub, transferências entre proprietários, merge de Layers/commit conjunto, worktrees múltiplos/sparse/submódulos/partial clone e implementação integral de toda a CLI Git. |

O pacote permanece experimental parcial porque a execução gráfica e os critérios dependentes de buffers/UI não foram concluídos. Consulte `TESTING.md` para o mapeamento dos 30 critérios e `LIMITATIONS.md` para o envelope conservador de suporte.

## Distribuição e extração efetivamente verificadas

`npm run verify:extracted -- /workspace/scratch/c7ba59945782/git-layers-lab-preflight.zip` executou numa pasta nova em `/tmp`:

1. Instalação pelo lockfile (`npm ci`, 85 pacotes), incluindo download/instalação do runtime Electron no postinstall.
2. Build completo do código entregue, com 1120 módulos e cinco workers Monaco locais.
3. Ajuda da CLI compilada e geração dos launchers locais.
4. Demonstração real com main/dev/collision-demo e duas Layers ativas.
5. `git layer doctor --json` pelo PATH local: `safe: true`, sete caminhos de propriedade exclusiva, três da base, checkpoints corretos e zero journals pendentes.

Os 108 hashes de fontes/configuração/build em `evidence/BUILD-SOURCE-HASHES.json` coincidiram com o ZIP extraído. A etapa final acrescentou apenas documentação e evidências de execução; o conteúdo de código, testes, configurações, dependências fixadas, assets e binário é comparado com essa extração antes de fechar o ZIP final. A saída original está em `evidence/EXTRACTED-INSTALL-BUILD.txt`.

O ASAR final tem 90 entradas; main/preload/HTML/Core/demo conferidos byte a byte com o build, cinco workers locais e nove arquivos de licença, sem node_modules da aplicação. O ELF Linux x64 real tem 229489992 bytes. Não foram produzidos .exe, .app, AppImage, assinatura ou notarização. A permissão de executável é preservada no ZIP quando o extrator a respeita.

A inclusão do runtime não comprova que a janela abriu. O limite root/sandbox permanece, e a instalação/build extraídos não substituem teste gráfico. O ZIP foi inspecionado contra caches, credenciais, node_modules, arquivos temporários, repositórios de teste e erros CRC antes da entrega.
