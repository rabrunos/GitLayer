# Benchmarks finais: desempenho, recursos e limites

A melhora é comprovada nas faixas medidas de algumas operações comuns. Não houve melhora uniforme: 32 MiB, 1.000 arquivos e ativação com duas Layers pioraram nas observações n1; 10.000 arquivos não concluíram os endpoints. Dez Layers continuam longe de uma experiência instantânea. Esses resultados são publicados sem atribuir a causa individualmente a uma otimização ou ao ambiente.

Os valores completos, dispersões, fases, comandos Git, fontes e estados de execução estão em [BENCHMARKS.json](BENCHMARKS.json). A validação funcional é apresentada separadamente em [RESULTS.md](RESULTS.md); duração de suíte não é latência do produto.

## Fontes e campanhas

- Baseline imutável: commit `d71ccc7d188500a22e56ea93c70ac946dba9db60`; Core 16 `49e48c0604fbbf37587f7eee5b1b7b4dad8fcb1f6712c3318626e9f79a43fe4b`.
- Candidato medido: `current-v6`; Core 17 `aab512270756d7888e5c1af60df6cc4b17d08a4376f4161552190a7115d32b35`; conjunto funcional 205 `f72502adcfd332e3109ad3e82ec845731f376cfc41d5e4a44be5ce89a6c4a825`. O commit publicado deve ser associado por esses hashes, sem antecipar SHA.
- Conjuntos exatos de 16/17 fontes Core foram confrontados nos três roots; o recibo atual inclui também um arquivo CLI, cuja latência de inicialização não foi medida.
- Windows x64 `10.0.26200`, Node `v24.14.1`, git version 2.53.0.windows.2, Intel(R) Core(TM) i7-9700KF CPU @ 3.60GHz, RAM 31,9 GiB. Linux não executado.

| Campanha | Intervalo UTC / orçamento | Ordem | Amostras / alcance |
| --- | --- | --- | --- |
| Principal | 2026-11-04T17:27:45.615Z a 2026-11-04T18:57:45.042Z; prazo 2026-11-04T18:57:45.615Z; 90 min | baseline → atual, por cenário | três pares pequenos n3; escalas n1; 14 endpoints completos, 3 TIMEOUT, 3 NOT_RUN |
| Suplementar direta | 2026-11-04T18:58:57.786Z a 2026-11-04T19:18:59.658Z; prazo 2026-11-04T19:18:57.786Z; 20 min independentes | atual → baseline | somente 10 Layers; atual completo, baseline TIMEOUT no saldo; n1 |

O suplemento usa o runner V4 existente diretamente, com recibos reais de `execute`; não possui controlador de pares fictício. Não reinicia os 90 minutos nem mistura amostras. A inversão da ordem acrescenta uma limitação temporal/cache. O limite de aproximadamente 20 minutos dos endpoints 10k inclui setup, init e primeira ativação: **não é uma latência de on/off**.

Os pilotos anteriores e as medições de Core intermediário ficam em [BENCHMARKS-INTERMEDIATE-V3-V4.md](BENCHMARKS-INTERMEDIATE-V3-V4.md). Não certificam este candidato. A frase histórica fixa sobre uma interrupção V3/32MiB no gerador congelado foi explicitamente qualificada; o par 32 MiB da campanha final concluiu.

O encerramento/recibo suplementar terminou 1,872s após seu deadline, conforme timestamps e timeout registrados. Essa diferença de limite/término não foi escondida nem converteu o baseline parcial em endpoint concluído.

## Método e fronteiras

Tempos de API Core, em worker/bundle já carregado e repositório Git sintético preparado. O init medido inicializa os metadados Core sobre um Git existente; init/commit nativos, geração dos arquivos, refs e índices sintéticos ficam fora da medida de API. Não medimos startup completo Node/CLI. O setup aquece o filesystem; primeira invocação de processo não é cache frio do sistema operacional.

Cada endpoint usa fixture externa com marcador/nonce, HOME/configuração/identidade/temporários isolados, Git oficial e nenhum remoto real. Os processos baseline/atual rodam sequencialmente sem outras suítes da equipe na janela de tempo. Não há controle integral de cache, carga externa, temperatura ou latência do host. As três amostras reaproveitam processo/fixture e acumulam histórico transacional. Não houve ablação: deltas medem o pacote completo, inclusive as correções de integridade.

Git significa **invocações diretas do Core com PID**, sem contador circular. Tentativas sem PID ficam separadas no JSON. Os descendentes do launcher oficial `cmd/git.exe` e plumbing nativo não foram observados: total de processos Git do sistema operacional = UNKNOWN. V3 pode omitir tentativa que lança exceção síncrona antes do spawn; V4 registra essa tentativa antes de relançar. Contagens com PID não são afetadas.

n3: mediana, mínimo/máximo e MAD. n1: observação única, com mediana/dispersão/p95 nulos. Nenhum cenário tem 20 amostras; não há p95. As classificações de n3 exigem faixas observadas sem sobreposição, sem alegar significância estatística universal.

Bytes são apenas conteúdo lógico materializado/retirado e saída Git observada. Escritas físicas, tráfego de cache e pico de disco não foram medidos. Orçamento de disco de 4 GiB foi de projeto, não quota monitorada. RSS é do worker (amostra 10 ms/início/fim), exclui filhos Git e pode perder picos menores; maxRSS informado pelo worker é cumulativo, não exclusivo de cada operação.

## Ativação e desativação

`on` abaixo é ativação de uma Layer já registrada após `off`; a primeira ativação/registro tem linha própria. Arquivos pequenos têm 256 B cada. Nas escalas 2/5/10 há 100 arquivos de Layer **no total**, mais 10 de base: alvos 50/20/10, outras Layers ativas. Logo não é uma curva pura de quantidade de Layers com volume movimentado constante.

| Cenário: Layers; arquivos Layer+base=total; alvo | Op. | n | Antes(ms) | Atual(ms) | Variação | Git direto antes→atual | Bytes lógicos afetados | Segurança |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | --- |
| 1; 10+10=20; alvo 10×256B | on | 3 | 4.148,8 | 3.669,2 | -11,6% | 66→45 | 2.560 | Oráculo final do cenário PASS nas duas versões |
| 1; 10+10=20; alvo 10×256B | off | 3 | 4.393,3 | 3.339,1 | -24,0% | 67→44 | 2.560 | Oráculo final do cenário PASS nas duas versões |
| 1; 1+10=11; alvo 1×1MiB | on | 3 | 4.993,2 | 3.374,3 | -32,4% | 66→45 | 1.048.576 | Oráculo final do cenário PASS nas duas versões |
| 1; 1+10=11; alvo 1×1MiB | off | 3 | 4.967,2 | 3.513,3 | -29,3% | 67→44 | 1.048.576 | Oráculo final do cenário PASS nas duas versões |
| 1; 1+10=11; alvo 1×32MiB | on | 1 | 7.350,9 | 17.946,4 | +144,1% | 66→45 | 33.554.432 | Oráculo final do cenário PASS nas duas versões |
| 1; 1+10=11; alvo 1×32MiB | off | 1 | 7.370,6 | 11.957,1 | +62,2% | 67→44 | 33.554.432 | Oráculo final do cenário PASS nas duas versões |
| 1; 1+10=11; alvo 1×100MiB | on | 1 | 18.033,6 | 13.167,3 | -27,0% | 66→45 | 104.857.600 | Oráculo final do cenário PASS nas duas versões |
| 1; 1+10=11; alvo 1×100MiB | off | 1 | 19.220,5 | 11.062,8 | -42,4% | 67→44 | 104.857.600 | Oráculo final do cenário PASS nas duas versões |
| 2; 100+10=110; alvo 50×256B | on | 1 | 8.065,8 | 18.674,5 | +131,5% | 92→63 | 12.800 | Oráculo final do cenário PASS nas duas versões |
| 2; 100+10=110; alvo 50×256B | off | 1 | 8.673,6 | 8.922,3 | +2,9% | 88→60 | 12.800 | Oráculo final do cenário PASS nas duas versões |
| 1; 1000+10=1010; alvo 1000×256B | on | 1 | 52.286,2 | 103.339,6 | +97,6% | 66→45 | 256.000 | Oráculo final do cenário PASS nas duas versões |
| 1; 1000+10=1010; alvo 1000×256B | off | 1 | 77.174,8 | 211.862,2 | +174,5% | 67→44 | 256.000 | Oráculo final do cenário PASS nas duas versões |
| 5; 100+10=110; alvo 20×256B | on | 1 | 118.995,0 * | NOT_RUN | — | 155→UNKNOWN | 5.120 | Samples SUCCESS; oráculo final incompleto |
| 5; 100+10=110; alvo 20×256B | off | 1 | 96.465,9 * | NOT_RUN | — | 145→UNKNOWN | 5.120 | Samples SUCCESS; oráculo final incompleto |
| 10;100+10=110; alvo 10×256B (suplemento) | on | 1 | Não alcançado/TIMEOUT | 48.715,1 | — | UNKNOWN→183 | 2.560 | Atual PASS; baseline incompleta |
| 10;100+10=110; alvo 10×256B (suplemento) | off | 1 | Não alcançado/TIMEOUT | 116.454,6 | — | UNKNOWN→172 | 2.560 | Atual PASS; baseline incompleta |
| 1;10000+10=10010; alvo 10000×256B | on/off posteriores | 1 | Não alcançados | Não alcançados | — | UNKNOWN | UNKNOWN | Sem resultado completo |
PASS na coluna Segurança significa apenas o oráculo final deste cenário de benchmark. Não certifica a suíte funcional completa, linearizabilidade universal ou suporte fora do envelope executado.


* Baseline 5 teve samples duráveis, mas o endpoint terminou durante o oráculo Git independente final. Sua ativação 118995,027 ms já tinha retornado; isso não conclui a certificação do endpoint. Atual 5 ficou NOT_RUN. Original 10 foi NOT_RUN para ambos; atual 10 foi medido apenas no suplemento, com outras 9 Layers ativas. Baseline suplementar 10 foi interrompido no saldo restante de 582442 ms; não há delta comparável.

Os deltas n1 são mudanças observadas, sem distribuição ou causalidade estabelecida. Pioras importantes permanecem visíveis: 32 MiB on +144,1%, 1k on +97,6% e off +174,5%, duas Layers/on +131,5%. A repetição independente 32 MiB foi NOT_RUN por orçamento.

| Primeira ativação/registro | n | Antes(ms) | Atual(ms) | Nota |
| --- | ---: | ---: | ---: | --- |
| layers1-files10 | 1 | 4.151,7 | 3.161,0 | observação única |
| layers1-file32MiB | 1 | 5.329,2 | 13.272,1 | observação única |
| layers1-file100MiB | 1 | 24.505,9 | 6.790,4 | observação única |
| layers1-files1000 | 1 | 154.183,6 | 113.364,0 | observação única |
| layers1-files10000 | 1 | UNKNOWN | UNKNOWN | primeira on aberta ao interromper; métricas em RAM não publicadas |

## Operações comuns e dispersão

| Cenário/operação | n | Antes: mediana[faixa];MAD(ms) | Atual: mediana[faixa];MAD(ms) | Git antes→atual | Classificação |
| --- | ---: | --- | --- | --- | --- |
| layers0-files10 / Inicialização Core | 1 | 2.144,3 (única; dispersão não estimada) | 1.286,8 (única; dispersão não estimada) | 42→24 | observação única |
| layers0-files10 / Abertura Core | 3 | 248,4 [246,7–267,0]; 1,7 | 234,9 [147,8–243,3]; 8,4 | 8→5 | menor nas faixas medidas |
| layers0-files10 / Status | 3 | 2.805,4 [2.703,9–2.881,1]; 75,7 | 2.002,9 [1.911,9–2.017,6]; 14,7 | 54→36 | menor nas faixas medidas |
| layers0-files10 / Listagem | 3 | 136,0 [135,3–222,8]; 0,7 | 137,4 [137,1–218,1]; 0,3 | 3→3 | inconclusivo: faixas sobrepostas |
| layers0-files10 / Diagnóstico de exclusões | 3 | 0,0 [0,0–0,1]; 0,0 | 0,0 [0,0–0,1]; 0,0 | 0→0 | inconclusivo: amostra/temporizador |
| layers0-files10 / Recovery sem pendência | 3 | 444,3 [369,7–472,0]; 27,7 | 337,7 [334,7–346,7]; 3,0 | 10→7 | menor nas faixas medidas |
| layers1-files10 / Inicialização Core | 1 | 2.048,4 (única; dispersão não estimada) | 1.210,6 (única; dispersão não estimada) | 43→25 | observação única |
| layers1-files10 / Abertura Core | 3 | 265,1 [258,7–284,0]; 6,4 | 167,3 [163,0–233,7]; 4,3 | 8→5 | menor nas faixas medidas |
| layers1-files10 / Status | 3 | 7.026,5 [6.412,3–7.184,4]; 157,9 | 5.835,7 [5.811,6–6.337,0]; 24,0 | 123→90 | menor nas faixas medidas |
| layers1-files10 / Listagem | 3 | 139,6 [137,8–228,2]; 1,8 | 164,1 [135,1–483,3]; 29,0 | 3→3 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Diagnóstico de exclusões | 3 | 177,3 [176,6–182,9]; 0,8 | 184,4 [177,5–332,4]; 7,0 | 4→4 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Recovery sem pendência | 3 | 1.164,0 [1.154,9–1.847,0]; 9,1 | 976,0 [968,2–1.437,0]; 7,9 | 24→21 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Ativação já satisfeita | 3 | 2.688,9 [2.513,7–2.765,2]; 76,3 | 1.933,6 [1.880,5–2.316,0]; 53,1 | 49→34 | menor nas faixas medidas |
| layers1-files10 / Prévia de desativação | 3 | 3.102,3 [3.081,5–3.464,3]; 20,9 | 2.305,8 [2.148,2–2.860,4]; 157,6 | 61→43 | menor nas faixas medidas |
| layers1-files10 / Ativação após off | 3 | 4.148,8 [4.036,5–4.481,9]; 112,3 | 3.669,2 [3.453,5–3.727,7]; 58,5 | 66→45 | menor nas faixas medidas |
| layers1-files10 / Desativação | 3 | 4.393,3 [4.269,1–4.550,8]; 124,2 | 3.339,1 [3.220,8–3.613,3]; 118,3 | 67→44 | menor nas faixas medidas |
| layers1-files10 / Abrir destino de edição | 3 | 5.127,2 [4.709,6–5.162,4]; 35,2 | 3.821,6 [3.212,9–5.173,6]; 608,7 | 101→69 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Encerrar destino | 3 | 3.991,3 [3.912,1–4.094,9]; 79,2 | 2.531,9 [2.295,9–3.242,9]; 236,0 | 64→41 | menor nas faixas medidas |
| layers1-files10 / Staging | 3 | 6.201,3 [5.905,5–7.289,5]; 295,8 | 4.637,5 [4.429,3–13.775,1]; 208,2 | 111/106/106→77/75/75 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Commit explícito | 3 | 4.729,8 [4.634,7–5.338,6]; 95,1 | 3.623,1 [3.207,0–6.614,1]; 416,1 | 80→56 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Repetir on conservando C no disco | 3 | 2.964,3 [2.963,7–3.553,2]; 0,5 | 2.465,6 [1.821,2–3.928,8]; 644,4 | 49→34 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Recusa de off com disco modificado | 3 | 4.132,2 [3.941,2–4.527,0]; 191,0 | 3.272,1 [3.250,7–4.301,9]; 21,4 | 70→50 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Troca gerenciada para outra branch | 3 | 5.691,3 [5.396,4–5.975,8]; 284,5 | 3.993,5 [3.980,2–4.291,5]; 13,3 | 83→54 | menor nas faixas medidas |
| layers1-files10 / Retorno gerenciado para main | 3 | 6.280,8 [5.635,1–6.372,2]; 91,4 | 4.403,0 [3.527,6–5.882,1]; 875,4 | 83→54 | inconclusivo: faixas sobrepostas |
| layers1-files10 / Off com failpoint determinístico | 1 | 4.306,5 (única; dispersão não estimada) | 4.287,3 (única; dispersão não estimada) | 67→44 | observação única |
| layers1-files10 / Recovery após off interrompido | 1 | 1.667,6 (única; dispersão não estimada) | 2.295,2 (única; dispersão não estimada) | 34→28 | observação única |
| layers1-files10 / Recovery repetido | 1 | 1.717,7 (única; dispersão não estimada) | 1.426,5 (única; dispersão não estimada) | 24→21 | observação única |
| layers1-file1MiB / Status | 3 | 8.222,3 [7.611,1–8.438,2]; 215,8 | 7.175,9 [6.395,2–8.877,3]; 780,8 | 123→90 | inconclusivo: faixas sobrepostas |
| layers1-file1MiB / Ativação já satisfeita | 3 | 3.498,9 [3.273,3–4.275,9]; 225,6 | 2.749,8 [2.367,6–3.735,7]; 382,2 | 49→34 | inconclusivo: faixas sobrepostas |
| layers1-file1MiB / Ativação após off | 3 | 4.993,2 [4.703,5–5.075,9]; 82,8 | 3.374,3 [3.353,8–3.577,6]; 20,5 | 66→45 | menor nas faixas medidas |
| layers1-file1MiB / Desativação | 3 | 4.967,2 [4.958,7–5.009,7]; 8,5 | 3.513,3 [3.322,8–3.675,4]; 162,1 | 67→44 | menor nas faixas medidas |

Staging e commit 1L10 preservam B preparado e C posterior no disco. Deltas medianos menores de add/commit não eliminam a amplitude: add atual 4.637,5 [4.429,3–13.775,1]; 208,2. Recovery após off interrompido piorou de 1.667,6 para 2.295,2 ms, n1; causa inconclusiva. A interrupção dessa linha é failpoint simulado, não perda real de energia.

## Git, checkpoints, journals e materialização

O número de chamadas diretas caiu, por exemplo, status 1L10 de 123 para 90, on 66 para 45, off 67 para 44, repetido 49 para 34. Essa contagem é evidência da eliminação de trabalho. O ganho temporal de cada alteração isolada não foi medido. A cópia transitória de índice para consultas preserva integridade e tem custo; veja [INDEX-QUERY.md](INDEX-QUERY.md).

| Cenário/op. | API antes→atual(ms) | Soma tempos filhos Git antes→atual(ms) | track inclusivo antes→atual(ms) | transaction.record inclusivo antes→atual(ms) |
| --- | --- | --- | --- | --- |
| layers1-files10/status | 7.026,5→5.835,7 | 8.080,4→6.279,3 | UNKNOWN→UNKNOWN | UNKNOWN→UNKNOWN |
| layers1-files10/add | 6.201,3→4.637,5 | 8.355,9→6.886,7 | 136,8→92,9 | 98,5→79,6 |
| layers1-files10/commit | 4.729,8→3.623,1 | 4.694,1→3.519,3 | 127,7→93,9 | 99,6→85,7 |
| layers1-file32MiB/on | 7.350,9→17.946,4 | 7.785,4→14.945,3 | 249,7→589,0 | 159,8→675,2 |
| layers1-file32MiB/off | 7.370,6→11.957,1 | 5.415,9→9.812,0 | 1.395,8→919,2 | 554,3→242,3 |
| layers1-files1000/on | 52.286,2→103.339,6 | 5.105,0→4.431,5 | 25.954,2→33.681,9 | 23.651,4→55.221,2 |
| layers1-files1000/off | 77.174,8→211.862,2 | 4.874,0→11.918,1 | 46.946,5→111.336,9 | 29.905,7→85.681,8 |

Tempos de fases são inclusivos/aninhados; filhos Git podem sobrepor. Não somar fases, subtrair filhos do total como custo exclusivo ou interpretar soma Git maior que API como inconsistência. O observador congelado envolve Transaction.backup, mas a rota final de track usa backupTracked, não envolvida diretamente: ausência de fase backup **não significa ausência de cópias/backups**. track cobre essa rota inclusivamente; publicações duráveis por caminho são verificadas nos testes focados, não inferidas deste contador.

| Comandos mais caros: status 1L10 | Git diretos por amostra antes→atual | Mediana da soma de tempos filhos antes→atual(ms) |
| --- | --- | --- |
| rev-parse | 53/53/53→18/18/18 | 3.623,6→1.456,3 |
| ls-files | 20/20/20→20/20/20 | 1.069,6→1.269,9 |
| ls-tree | 14/14/14→14/14/14 | 810,3→854,9 |
| config | 10/10/10→10/10/10 | 706,9→518,1 |
| for-each-ref | 5/5/5→7/7/7 | 223,5→477,0 |
| diff | 6/6/6→6/6/6 | 376,5→439,9 |

A piora 1k não é explicada só por quantidade de subprocessos: on teve soma Git menor e API maior; off teve custos maiores em Git, track e record. As fontes/perfis identificam serialização/publicação de journals como trabalho relevante. Não há prova de causalidade individual para a variação observada. O tamanho lógico final da fixture 1k foi 6.524.322 B antes e 6.491.303 B atual: não é tamanho isolado de journal nem I/O físico. Fixtures PASS são removidas somente após oráculos; métricas/manifestos ficam retidos, mas journals brutos de 1k não estão disponíveis para comparação no mesmo ponto.

A coalescência de uma publicação de backup em track não muda a ordem quadrática de reserializar um journal crescente. Um formato incremental/append/checkpoints precisa protocolo/versionamento/replay/corrupção/durabilidade próprios; não foi introduzido nesta etapa. Cache persistente de journals concluídos por timestamps não é solução aprovada.

## Arquivos grandes e memória

| Cenário/operação | Bytes lógicos do alvo | Pico RSS amostrado antes(MiB) | Atual(MiB) |
| --- | ---: | ---: | ---: |
| layers1-file32MiB/first-on-register-layer0 | 33.554.432 | 166,0 | 56,3 |
| layers1-file32MiB/on | 33.554.432 | 210,3 | 61,6 |
| layers1-file32MiB/off | 33.554.432 | 197,0 | 62,3 |
| layers1-file100MiB/first-on-register-layer0 | 104.857.600 | 387,1 | 57,1 |
| layers1-file100MiB/on | 104.857.600 | 394,4 | 63,5 |
| layers1-file100MiB/off | 104.857.600 | 393,9 | 63,9 |

Arquivos binários determinísticos reais, até 100 MiB, foram gravados/lidos. Streaming reduz a necessidade de manter blobs/cópias inteiros no processo. O pico por operação não mede a RAM dos filhos Git, cache do SO ou soma total da máquina. A redução de RSS em 32 MiB coexistiu com piora de latência; isso permanece explícito.

Os experimentos de reflink/copy-on-write, cópias técnicas, índices e startup estão registrados em [DECISIONS.md](DECISIONS.md) e [REPORT.md](REPORT.md). Não foi adotado hardlink/symlink como materialização principal, duplicata permanente ou nova arquitetura de worktrees. Estes tempos não provam suporte a reflink nem suporte Linux.

## Limites reais de 10.000 arquivos

Ambos endpoints terminaram por timeout próprio, após setup/init e durante a primeira ativação. A operação aberta só publica sua métrica ao concluir: duração e Git da primeira on são UNKNOWN; on/off posteriores não foram alcançados. Não substituímos isso por zero, SKIP, ENV_BLOCKED ou PASS.

A inspeção após todas as medições foi somente leitura, sem abrir Core, Git, recuperar ou remover lock. Marcadores/ancestralidade verificados; journals, backups e bytes preservados. Os estados foram interrompidos em pontos diferentes e não formam controle equivalente para throughput ou latência.

| Estado retido | Arquivos presentes/corretos | Bytes presentes | Journal(B) | recovery.files | AFTER | steps | backup entries / cópias de dados |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline | 4.378/4.378 | 1.120.768 | 6.217.223 | 4.380 | 4.379 | 8.761 | 4.380/0 |
| current | 5.049/5.049 | 1.292.544 | 7.311.625 | 5.051 | 5.051 | 10.104 | 5.051/0 |

As cópias de dados são zero porque as entradas before registram ausência; isso não é backup ausente indevidamente. Ambos journals estão pending/activate, schema 1 e lock de coordenador preservado. Baseline parou em backup-ready; atual em write-completed. Não testamos recovery desses dois estados nem deduzimos autorização/propriedade de semelhança de bytes.

O inventário auxiliar inicial somou nomes de campos incorretos nos totais recursivos de bytes/links, produzindo null. O artefato original foi preservado e a revisão 2 marca esses campos **UNKNOWN_AGGREGATION_ERROR**. As contagens de arquivos, hashes/tamanho dos journals e comparação byte a byte dos arquivos de 256 B independem desse erro. Nenhum total desconhecido foi estimado.

## Cobertura e limites restantes

- Melhora medida em faixas n3: status sem Layer, status/on/off/on repetido 1L10, e on/off 1 MiB. Abertura/listagem ficam em centenas de milissegundos nas amostras; ativação/desativação continuam em segundos.
- Pioras n1 explícitas:32MiB, 1k, on com duas Layers e recovery após off interrompido. Status2Layers mudou pouco; n1 não estabelece distribuição. Add/commit têm amplitudes sobrepostas, apesar de medianas menores.
- Atual10 completo apenas no suplemento: on 48,7 s, off 116,5 s, status 119,5 s, repetido 28,9 s. Isso é uma limitação material; não é instantâneo.
- Atual 5 e repetição32MiB NOT_RUN; nenhum dado intermediário foi promovido a fonte final. Baseline 5 e baseline10 suplementar não completaram oráculos.
- Escalas representativas, sem matriz cartesiana. Alterados/staged/B-C/recusas/recovery/troca gerenciada estão concentrados em 1L10; as outras escalas são limpas. Protect opt-in desativado nos benchmarks; cobertura funcional separada.
- Sem cache frio real, startup completo CLI, IO físico, maxRSS de filhos Git, pico físico de disco, Linux ou perda real de energia.

O veredito por endpoint exige result PASS, oráculo semântico e término normal do worker e supervisor. Um sample SUCCESS ou result PASS isolado não substitui essas condições. O desempenho por arquivo/byte e a taxa de materialização de escalas não concluídas não foram extrapolados.

## Reprodução

Use os mesmos snapshots/hash do JSON, Git/Node/lockfile e ambiente isolado. Os runners constroem um bundle instrumentado sem alterar as fontes de produção. Diretórios de saída precisam ser novos ou resumíveis pelo próprio controlador; não sobrescrever evidência.

```text
node scripts/benchmark-performance-recovery-pairs.mjs --baseline-source <BASELINE_D71> --current-source <CURRENT_V6> --out <NOVO_N3> --budget-ms 1500000 --ids layers0-files10,layers1-files10,layers1-file1MiB
node scripts/benchmark-performance-recovery-pairs-v4.mjs --baseline-source <BASELINE_D71> --current-source <CURRENT_V6> --out <NOVO_N1> --budget-ms <SALDO_ORIGINAL> --samples 1 --10k-budget-ms 1200000 --ids <CENARIOS>
node scripts/benchmark-performance-recovery-v4.mjs --phase current --source <CURRENT_V6> --out <SUPLEMENTO_NOVO> --profile all --id layers10-files100 --samples 1 --budget-ms <SALDO_SUPLEMENTAR>
```

As chamadas de supervisão usam execute existente, timeout e identidade da árvore própria; os recibos e deadlines reais estão no JSON. A chamada direta suplementar baseline veio depois, no saldo restante; não se aplica um recibo de controlador de pares. O resumo bruto congelado e sua qualificação editorial têm hashes separados.
