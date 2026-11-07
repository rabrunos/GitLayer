# Desempenho após reinício — migração TypeScript

A campanha final repete a revisão JavaScript `b4051c01ed09a42705439f18d6ca6c4a1f3f849b` e as fontes TypeScript do commit `016d234548232e35ae817f9d83715e6b2b75e361`, após o usuário encerrar um jogo e reiniciar o computador. O Windows confirmou boot em **07/11/2026 às 16:40:11 (America/Sao_Paulo)**. A condição informada e as saídas de cada campanha estão em [benchmark-conditions.json](benchmark-conditions.json). Não houve monitoramento do jogo nem isolamento causal de seu efeito.

Core, CLI, testes, helpers e scripts já existentes permanecem idênticos ao snapshot `345e2ae9c9dcc35f04d5cc1fd3240679b87bec06`, validado em 14/14 testes. O diagnóstico pareado foi acrescentado em `016d234548232e35ae817f9d83715e6b2b75e361` e ampliado para controlar a emissão em `aaa47e14c4df309d3d0aea655e98ebbae602b41b`; ambas as revisões passaram em `tsc --noEmit`. Não houve troca de motor, mudança de algoritmos, cache GitLayer ou otimização do add.

## Campanhas preservadas

- [JavaScript histórico](BENCHMARKS-JAVASCRIPT.md): relatório e [dados originais](benchmarks.json), com os números anteriores de 2,591/1,622/2,425 s para CLI on/off/reativação nos 10.000 compartilhados.
- [Campanha inicial desta migração](BENCHMARKS-INITIAL-RUN.md): 15 amostras JS, 15 TS, inicialização e 22 pares, possivelmente afetados por carga externa; todos os JSONs permanecem preservados. Não são usados para decidir a modalidade final de execução.
- Campanha após reinício: novos arquivos `*-post-reboot.json`, fixtures novas e execuções sequenciais. Os comparadores originais têm saídas TypeScript separadas das históricas.

## Ambiente e método

Windows x64 `10.0.26200`, Intel Core i7-9700KF @ 3,60 GHz, oito processadores lógicos; Node `v24.14.1`; Git `2.53.0.windows.2` por caminho absoluto. Fixtures descartáveis no volume `C:\` com identidade e configuração Git locais/isoladas, caminhos disjuntos, sem escritores concorrentes, filtros, hooks ou LFS. O agente executa uma campanha por vez, sem outros testes ou benchmarks em paralelo.

Cada cenário principal usa três fixtures independentes. Os arquivos têm 256 bytes determinísticos; 10.000 arquivos totalizam 2.560.000 bytes. A distribuição principal usa até 100 diretórios compartilhados com aplicação e outra Layer; a exclusiva usa uma pasta da Layer.

`commandMs` mede a CLI completa, incluindo inicialização e conclusão de todos os efeitos sobre todos os arquivos. `verificationMs` mede somente o observador externo; `verifiedMs` é o total. Após on/reativação, todos os conteúdos são lidos e comparados em lotes de 64; após off, todos os caminhos são conferidos como ausentes. Conteúdos das outras origens, HEAD e bytes do índice convencional também são verificados.

Fixture, outras origens, criação do índice, on vazio, geração dos arquivos, add, commit e off inicial são medidos separadamente. A primeira ativação preenchida é a primeira extração desses objetos do Git. Não há preparação adicional de cache/materialização. Caches normais do sistema/Git não foram esvaziados; não se afirma medição a frio.

O Core continua com `checkout-index` em lote, oito workers nativos e remoção assíncrona em lotes de 64. O add não foi otimizado. As medianas independentes e os deltas pareados são estatísticas diferentes; a soma de medianas separadas pode diferir da mediana do total. As observações são locais e descritivas, sem certificação universal ou prova estatística de equivalência.

## Campanha principal após reinício

**15/15 amostras JavaScript e 15/15 TypeScript verificadas**, três por cenário, sem falhas de conteúdo, ausência, outras origens, HEAD ou índice convencional. [JS bruto](benchmarks-javascript-post-reboot.json), [TS bruto](benchmarks-typescript-post-reboot.json). Segundos; delta significa a diferença entre medianas independentes (TS menos JS), não um delta pareado.

| Cenário | Operação | JS | TS nativo | Delta s | Delta % |
| --- | --- | ---: | ---: | ---: | ---: |
| 10 distribuídos | Primeira ativação | 0,490 | 0,561 | +0,071 | +14,5 |
| 10 distribuídos | Desativação | 0,336 | 0,383 | +0,047 | +14,1 |
| 10 distribuídos | Reativação | 0,492 | 0,541 | +0,049 | +9,9 |
| 100 distribuídos | Primeira ativação | 0,552 | 0,619 | +0,067 | +12,1 |
| 100 distribuídos | Desativação | 0,354 | 0,400 | +0,046 | +13,1 |
| 100 distribuídos | Reativação | 0,557 | 0,612 | +0,054 | +9,8 |
| 1.000 distribuídos | Primeira ativação | 0,686 | 0,804 | +0,118 | +17,2 |
| 1.000 distribuídos | Desativação | 0,502 | 0,564 | +0,061 | +12,2 |
| 1.000 distribuídos | Reativação | 0,694 | 0,821 | +0,127 | +18,3 |
| 10.000 compartilhados | Primeira ativação | 2,055 | 2,324 | +0,269 | +13,1 |
| 10.000 compartilhados | Desativação | 1,178 | 1,337 | +0,159 | +13,5 |
| 10.000 compartilhados | Reativação | 2,123 | 2,014 | -0,109 | -5,1 |
| 10.000 exclusivos | Primeira ativação | 3,485 | 3,732 | +0,246 | +7,1 |
| 10.000 exclusivos | Desativação | 1,290 | 1,328 | +0,039 | +3,0 |
| 10.000 exclusivos | Reativação | 3,521 | 3,740 | +0,219 | +6,2 |

O on/off compartilhado de 10.000 arquivos apresentou +13,1%/+13,5% nas medianas independentes. As diferenças foram investigadas nos ciclos pareados, em vez de serem atribuídas automaticamente ao Node ou à linguagem. O add conserva os mesmos comandos e a mesma seleção, sem otimização.

### Verificação integral e meta de cinco segundos

Medianas TypeScript, segundos, na ordem **ativar / desativar / reativar**. Cada comando já concluiu todos os efeitos; a conferência externa é custo adicional separado.

| Cenário | Comando | Só conferência | Comando + conferência |
| --- | --- | --- | --- |
| 10 distribuídos | 0,561 / 0,383 / 0,541 | 0,046 / 0,043 / 0,042 | 0,607 / 0,423 / 0,582 |
| 100 distribuídos | 0,619 / 0,400 / 0,612 | 0,071 / 0,062 / 0,070 | 0,702 / 0,464 / 0,682 |
| 1.000 distribuídos | 0,804 / 0,564 / 0,821 | 0,250 / 0,105 / 0,216 | 1,055 / 0,693 / 1,017 |
| 10.000 compartilhados | 2,324 / 1,337 / 2,014 | 1,515 / 0,341 / 1,319 | 3,839 / 1,706 / 3,279 |
| 10.000 exclusivos | 3,732 / 1,328 / 3,740 | 1,182 / 0,336 / 1,126 | 4,914 / 1,664 / 4,911 |

Nos 10.000 arquivos, **todos os 48 registros** (JS+TS, incluindo off inicial) ficaram abaixo de cinco segundos com a conferência integral. O pior foi **4,968 s**, com apenas **32,008 ms** de margem. Portanto a meta foi atendida nestas amostras, com pouca margem na pasta exclusiva; não há garantia universal ou a frio.

### Faixas dos comandos de 10.000 arquivos

Mínimo–máximo, segundos; ordem ativar / desativar / reativar.

| Layout | JS | TS nativo |
| --- | --- | --- |
| distributed | 1,929–2,059 / 1,056–1,632 / 2,001–2,169 | 2,222–2,409 / 1,136–1,370 / 1,911–2,308 |
| exclusive | 3,479–3,529 / 1,282–1,305 / 3,434–3,527 | 3,606–3,732 / 1,276–1,357 / 3,645–3,812 |

### Preparação completa de 10.000 arquivos

Segundos, medianas de três fixtures por layout. Nenhuma extração preenchida precede a primeira ativação medida. O add não foi otimizado nesta missão.

| Fase | JS compartilhado | TS compartilhado | JS exclusivo | TS exclusivo |
| --- | ---: | ---: | ---: | ---: |
| Fixture/aplicação básica | 0,423 | 0,467 | 0,438 | 0,433 |
| Aplicação e Layer acompanhante | 3,166 | 3,496 | 2,208 | 2,423 |
| Criar Layer e índice | 0,518 | 0,514 | 0,468 | 0,520 |
| Ativar Layer vazia | 0,488 | 0,563 | 0,486 | 0,538 |
| Gerar arquivos | 4,161 | 4,898 | 4,484 | 4,443 |
| Add inicial | 34,040 | 33,688 | 32,752 | 33,356 |
| Commit inicial | 1,330 | 1,411 | 1,064 | 1,129 |
| Off inicial: comando | 1,001 | 1,082 | 1,056 | 1,201 |
| Off inicial: conferência | 0,354 | 0,408 | 0,309 | 0,326 |
| Cache adicional | 0,000 | 0,000 | 0,000 | 0,000 |

### Inicialização isolada da CLI

[Dados brutos](startup-comparison-post-reboot.json): três warmups por runtime e **30 amostras por runtime**, com ordem alternada no mesmo repositório descartável. O intervalo inclui `node <cli> --help` até a saída completa, exige código zero, stderr vazio e stdout idêntico. Nenhuma operação Git ocorre dentro dele.

| Runtime | Mediana ms | Mínimo ms | Máximo ms |
| --- | ---: | ---: | ---: |
| javascript | 63,014 | 60,142 | 71,615 |
| typescript | 100,805 | 95,425 | 154,000 |

O acréscimo mediano foi **37,791 ms (+59,97%)**. É um custo real de inicialização, explicitado mesmo quando pequeno em tempo absoluto; os pares abaixo investigam seu efeito nas operações completas.

## Diagnósticos pareados

O mesmo repositório descartável, refs, índice de Layer e arquivos são usados por ambos os runtimes dentro de cada diagnóstico. Só o prefixo PATH do processo filho seleciona o launcher real. Cada ciclo começa inativo: on completo, conferência de todos os arquivos, off completo e nova conferência. A ordem alterna JS→TS/TS→JS. Dois ciclos de aquecimento ficam separados das estatísticas. São **reativações aquecidas**, sem substituir a primeira extração da campanha principal.

A campanha principal, startup e pares de 100/10.000 compartilhados terminaram antes de uma nova sessão de jogo. As medições foram pausadas a pedido do usuário; emissão, exclusiva e comparadores foram retomados quando ele informou que parou de jogar. As condições e horários são preservados, sem atribuição causal ao jogo.

| Fixture | Pares | Operação | JS mediana s | TS mediana s | Diferença de medianas ms | Mediana delta pareado ms | Mediana % por par |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| [100 distribuídos](runtime-comparison-post-reboot-100.json) | 10 | on | 0,573 | 0,617 | +44,317 | +43,844 | +7,725 |
| [100 distribuídos](runtime-comparison-post-reboot-100.json) | 10 | off | 0,361 | 0,404 | +42,928 | +39,450 | +10,927 |
| [10.000 compartilhados](runtime-comparison-post-reboot-10000-shared.json) | 6 | on | 2,031 | 2,066 | +35,394 | +66,919 | +3,462 |
| [10.000 compartilhados](runtime-comparison-post-reboot-10000-shared.json) | 6 | off | 1,365 | 1,625 | +259,633 | +209,208 | +14,537 |
| [10.000 exclusivos](runtime-comparison-post-reboot-10000-exclusive.json) | 6 | on | 3,586 | 3,612 | +25,867 | +25,229 | +0,703 |
| [10.000 exclusivos](runtime-comparison-post-reboot-10000-exclusive.json) | 6 | off | 1,270 | 1,270 | -0,357 | +138,738 | +11,713 |

A mediana dos deltas pode divergir da diferença entre medianas; o mesmo vale para percentuais por par. O off registrou acréscimos pareados de **209 ms no compartilhado e 139 ms no exclusivo**, que permanecem explicitados. Os dados têm variação e efeitos de ordem, e não demonstram equivalência estatística ou causalidade da diferença. Para investigar se esse custo era evitável com build, foi executado o controle seguinte.

## Controle de JavaScript emitido da mesma fonte

[Recibo de emissão](compiled-emission-experiment.json) e [pares brutos](runtime-comparison-post-reboot-native-vs-emitted.json). Um clone descartável recebeu saída automática de `tsc` somente em `dist/core.js` e `dist/cli.js`, com `rewriteRelativeImportExtensions`; os dois launchers desse clone apontaram ao dist. Core/CLI TypeScript não foram alterados. O driver exige **hashes canônicos iguais** entre as variantes e registra separadamente os hashes dos arquivos gerados.

Foram **seis pares alternados**, mais dois aquecimentos, com os mesmos 10.000 arquivos compartilhados, índice, refs e observador completo. Nesta tabela, o delta é **nativo menos emitido**, não nativo menos JavaScript antigo.

| Operação | Emitido mediana s | Nativo mediana s | Diferença de medianas ms | Mediana delta pareado ms | Mediana % por par |
| --- | ---: | ---: | ---: | ---: | ---: |
| on | 2,276 | 2,331 | +54,812 | +101,645 | +4,525 |
| off | 1,402 | 1,377 | -24,796 | -11,496 | +1,118 |

O controle não mostrou benefício consistente de emissão no off: a mediana do delta foi −11,496 ms, com três pares em cada direção e faixa −322,445…+299,957 ms. No on, o delta pareado foi +101,645 ms (+4,525%), com faixa −274,884…+201,065 ms. Esses custos observados são declarados, sem transformá-los em prova de aceleração ou equivalência.

**Decisão: manter execução nativa de TypeScript, sem build obrigatório.** A emissão não demonstrou eliminar o aumento de off que motivou o experimento; o custo observado em on não justificou acrescentar uma etapa obrigatória de distribuição frente à preferência da missão. O código-fonte do produto continua único em TypeScript. Os dois arquivos JavaScript emitidos existem somente no controle descartável, fora do checkout de desenvolvimento e da implementação publicada.

## Comparadores originais completos

Ambos foram migrados sem mudar estratégias e executados integralmente com 10.000 arquivos compartilhados. Estes experimentos não alteraram o Core.

### Materialização, três amostras

[Dados brutos](materialization-comparison-typescript.json). A ordem das três estratégias gira por repetição; cada amostra registra preparação completa e um índice privado read-tree. Segundos, medianas.

| Estratégia | Operação completa | Com conferência |
| --- | ---: | ---: |
| checkout-index direto, configuração padrão | 4,490 | 5,684 |
| checkout-index temporário + rename de todos os arquivos | 9,433 | 10,637 |
| git archive + tar | 5,311 | 6,449 |
| Retirada por rename para cache experimental | 4,750 | 5,101 |
| Reativação por rename do cache experimental | 4,792 | 5,958 |

O cache pertence somente ao comparador descartável. Extração inicial, publicação, renames e limpeza estão discriminados no JSON; nenhuma dessas estratégias foi incorporada ao produto.

### Paralelismo, seis extrações verificadas

[Dados brutos](parallel-comparison-typescript.json). Probes de uma extração por worker, com threshold zero apenas no comando do comparador; depois três confirmações do worker observado mais rápido. Segundos.

| Probe workers | Checkout completo | Com conferência |
| ---: | ---: | ---: |
| 1 | 4,453 | 5,576 |
| 4 | 1,860 | 3,090 |
| 8 | 1,499 | 2,779 |

O comparador selecionou **8 workers**. As três confirmações tiveram mediana de **1,577 s**, ou **2,894 s** com conferência. A remoção síncrona apareceu três vezes e teve mediana de **1,147 s**; a assíncrona em lotes de 64, também três vezes, **0,387 s**. Todas retiraram o conjunto inteiro e conferiram ausência e outras origens.

O Core conserva os oito workers e o limiar nativo original; os resultados exploratórios não reconfiguraram o produto. Sem mudança de algoritmo, cache persistente ou otimização do add.

## Reprodução e limites

Execute somente em cópias/fixtures descartáveis. Para preservar as amostras publicadas, informe um destino novo:

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run check
npm.cmd test
npm.cmd run benchmark -- docs/benchmarks-typescript-new.json
npm.cmd run benchmark:alternatives -- docs/materialization-comparison-typescript-new.json
npm.cmd run benchmark:parallel -- docs/parallel-comparison-typescript-new.json
npm.cmd run benchmark:startup -- <checkout-JS-b4051c0> docs/startup-new.json
$env:GIT_LAYER_COMPARE_COUNT = "10000"
$env:GIT_LAYER_COMPARE_LAYOUT = "distributed"
$env:GIT_LAYER_BENCH_SAMPLES = "6"
node scripts/compare-runtime.ts <checkout-JS-b4051c0> docs/runtime-new.json
Remove-Item Env:GIT_LAYER_COMPARE_COUNT,Env:GIT_LAYER_COMPARE_LAYOUT,Env:GIT_LAYER_BENCH_SAMPLES
```

Os comandos sem destino usam os defaults do manifesto/scripts; não preservam automaticamente uma saída anterior no mesmo arquivo. A baseline JS final usa o script original no clone b405, sem alterações, com destino explícito. O controle emitido usa o recibo/configuração temporária documentados e `GIT_LAYER_BASELINE_KIND=compiled-typescript`, apontando ao clone emitido; o driver nativo compara fontes canônicas idênticas.

A campanha principal atingiu a meta de cinco segundos nas amostras de 10.000 arquivos, incluindo conferência, com margem pequena na pasta exclusiva. Permanecem overhead de inicialização, deltas de off observados, variação temporal e limites de amostra. Os resultados não certificam outras máquinas, arquivos maiores, produção, topologias complexas, CI remoto ou equivalência estatística. Não foi consultado ou incorporado código de concorrentes.
