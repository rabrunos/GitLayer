# Desempenho do laboratório mínimo — 07/11/2026

A campanha final concluiu **15/15 amostras verificadas**, três por cenário. Nos 10.000 arquivos distribuídos, ativação, desativação e reativação ficaram abaixo de cinco segundos nas três amostras, inclusive com o observador integral. Na pasta exclusiva, os comandos ficaram abaixo de cinco segundos; somar a verificação externa elevou as medianas de ativação e reativação para **5,278 e 5,284 s**. Portanto, a meta principal de cinco segundos **não foi atingida em todos os cenários**.

Amostras completas, preparação e hashes SHA-256 das fontes estão em [benchmarks.json](benchmarks.json). As explorações desta missão estão em [materialization-comparison.json](materialization-comparison.json) e [parallel-comparison.json](parallel-comparison.json); resultados históricos do produto anterior não entram nestas tabelas.

## Ambiente e método

Windows x64, `win32 10.0.26200`; Intel Core i7-9700KF @ 3,60 GHz, oito processadores lógicos; Node `v24.14.1`; Git `2.53.0.windows.2`, executado por caminho absoluto. Fixtures descartáveis no volume `C:\`, com configuração Git e identidade isoladas. Não houve outros testes ou benchmarks executados em paralelo pelo agente.

Cada arquivo contém 256 bytes determinísticos: 10.000 arquivos somam **2.560.000 bytes**. A distribuição principal usa 100 diretórios, cada um compartilhado com arquivos da aplicação e de outra Layer; o caso de dez arquivos usa dez diretórios. O cenário exclusivo contém os 10.000 arquivos em uma pasta da Layer. Não há colisões de caminhos.

`commandMs` mede o processo CLI completo, incluindo inicialização, todos os arquivos e a conclusão dos efeitos; nenhum tempo termina no primeiro arquivo. A métrica principal, `verifiedMs`, acrescenta a comparação de **todos os bytes**, ou a ausência de todos os caminhos após `off`, os conteúdos das outras origens, o HEAD convencional e os bytes do índice principal. O observador final lê em lotes assíncronos de 64. Todos esses checks passaram.

São três fixtures independentes por cenário. Houve um `on` vazio para permitir a atribuição inicial, seguido de geração dos arquivos, `add`, `commit` e retirada explicitamente medida. A primeira ativação preenchida é a primeira extração desses arquivos do Git. A reativação extrai novamente dos objetos Git: **não existe cache próprio de arquivos materializados**. Os caches normais do sistema e do Git não foram esvaziados; não se afirma medição a frio.

## Campanha final

**Métrica principal: comando e verificação integral, segundos, mediana de três amostras.**

| Arquivos e distribuição | Primeira ativação | Desativação | Reativação |
| --- | ---: | ---: | ---: |
| 10, distribuídos | 0,745 | 0,446 | 0,652 |
| 100, distribuídos | 0,773 | 0,512 | 0,822 |
| 1.000, distribuídos | 1,146 | 0,818 | 1,240 |
| 10.000, 100 diretórios compartilhados | 4,488 | 2,072 | 4,210 |
| 10.000, uma pasta exclusiva | 5,278 | 1,940 | 5,284 |

**Processo CLI completo, sem o observador externo, segundos, mediana de três amostras.**

| Arquivos e distribuição | Primeira ativação | Desativação | Reativação |
| --- | ---: | ---: | ---: |
| 10, distribuídos | 0,697 | 0,397 | 0,602 |
| 100, distribuídos | 0,692 | 0,436 | 0,739 |
| 1.000, distribuídos | 0,887 | 0,690 | 0,981 |
| 10.000, 100 diretórios compartilhados | 2,591 | 1,622 | 2,425 |
| 10.000, uma pasta exclusiva | 3,754 | 1,455 | 3,620 |

Faixas observadas dos **comandos completos** com 10.000 arquivos, mínimo–máximo em segundos:

| Distribuição | Primeira ativação | Desativação | Reativação |
| --- | ---: | ---: | ---: |
| Compartilhada | 2,399–2,653 | 1,240–1,826 | 2,300–2,767 |
| Exclusiva | 3,569–4,298 | 1,272–1,549 | 3,520–4,016 |

Com o observador, a ativação exclusiva variou de 5,116 a 6,508 s, e a reativação de 4,966 a 6,242 s. Esses resultados permanecem acima da meta em parte das amostras.

## Custo inicial explícito

Segundos, medianas de três amostras de 10.000 arquivos. Os tempos abaixo são das operações completas de preparação, anteriores à primeira extração preenchida; não foram incorporados artificialmente ao custo zero de um cache.

| Fase | Compartilhada | Exclusiva |
| --- | ---: | ---: |
| Inicializar fixture e aplicação básica | 0,625 | 0,585 |
| Preparar aplicação e Layer acompanhante | 3,885 | 2,800 |
| Criar Layer e índice nativo | 0,629 | 0,573 |
| Ativar Layer vazia | 0,695 | 0,594 |
| Gerar os 10.000 arquivos-fonte | 5,644 | 5,434 |
| `git layer add scripts .` inicial | 33,710 | 33,503 |
| Commit inicial da Layer | 1,559 | 1,381 |
| Retirar os arquivos-fonte com `off` inicial | 1,164 | 1,202 |
| Preparação adicional de cache/materialização | **0** | **0** |
| Total das fases cronometradas por amostra | 48,528 | 46,052 |

O total é a mediana da soma por amostra, não a soma das medianas. Checks externos de preparação também constam do JSON quando aplicáveis. O **add inicial continua caro**, em torno de 33,5–33,7 s; os tempos curtos de `on`/`off` não incluem nem eliminam esse custo. Este experimento não localizou separadamente cada custo interno do `git add`.

## Alternativas medidas e decisão

A receita mínima anterior ao paralelismo foi preservada no commit local `35e1638`. Sua exploração de 10.000 arquivos distribuídos planejava três amostras, concluiu **uma amostra inteira** e foi interrompida deliberadamente antes de continuar, para investigar paralelismo. O [JSON original](materialization-comparison.json) registra `plannedRepetitions=3`, `completedRepetitions=1`, a interrupção e a fixture de preparação seguinte preservada.

| Estratégia inicial, n=1 | Operação completa | Com verificação síncrona |
| --- | ---: | ---: |
| `checkout-index` direto | 24,571 s | 50,045 s |
| Extração temporária e rename por arquivo | 55,053 s | 75,192 s |
| Criar archive e extrair com tar | 23,837 s | 44,389 s |

Na alternativa de cache por arquivo, retirar para o cache levou 30,103 s e reativar por rename levou 21,099 s. Esse custo e a materialização adicional não justificaram adotar o cache. A diferença de uma única amostra entre archive/tar e extração direta não justificou acrescentar o arquivo tar e outra ferramenta à operação principal.

O [experimento de paralelismo](parallel-comparison.json) usou uma fixture, probes com `checkout.workers=1/4/8` e três confirmações do melhor probe, oito workers. A mediana das confirmações nativas foi **2,439 s**, ou **4,719 s** com o observador. As remoções assíncronas tiveram mediana de **0,651 s**, frente a **1,539 s** das síncronas, com três medições de cada método sobre o mesmo conjunto de arquivos. As configurações foram passadas com `-c`, sem alteração persistente do Git.

A implementação final adotou extração nativa direta com oito workers e remoção assíncrona em lotes de 64, sem cache adicional. O observador desse segundo experimento e da campanha final é assíncrono; o da exploração inicial era síncrono. As campanhas tiveram caches normais e fixtures/momentos diferentes: seus números não formam uma comparação pareada com a baseline, nem demonstram aceleração universal.

## Reprodução

Na revisão final, em checkout próprio do laboratório:

```powershell
npm.cmd run benchmark          # três amostras por cenário; 15 no total
npm.cmd run benchmark:parallel # probes 1/4/8 e três confirmações
```

Os scripts criam somente fixtures descartáveis novas e gravam os respectivos JSONs. Preserve as amostras publicadas antes de executar outra campanha, ou passe um caminho de saída diferente diretamente ao script.

Para reproduzir a exploração **anterior ao paralelismo**, use uma cópia descartável do snapshot `35e1638`; nele, o observador também é o síncrono original:

```powershell
$env:GIT_LAYER_BENCH_SAMPLES = '1'
node scripts/compare-materialization.mjs docs/materialization-comparison-new.json
Remove-Item Env:GIT_LAYER_BENCH_SAMPLES
```

A edição atual desse comparador usa o observador assíncrono e a CLI atual. Os hashes de cada campanha identificam a receita efetivamente executada. Esta medição cobre arquivos pequenos, caminhos disjuntos e o ambiente descrito; arquivos grandes, outras máquinas, outros volumes e uso de produção continuam fora da evidência apresentada.