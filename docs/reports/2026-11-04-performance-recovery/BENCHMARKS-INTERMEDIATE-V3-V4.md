# Campanhas intermediárias V3/V4

**Estas medições usam o Core intermediário `current-v3`; não certificam o Core final V5.** A coalescência de publicações de backup foi autorizada depois destes resultados. Os dados estruturados estão em [BENCHMARKS-INTERMEDIATE-V3-V4.json](BENCHMARKS-INTERMEDIATE-V3-V4.json).

A baseline foi congelada no commit `d71ccc7d188500a22e56ea93c70ac946dba9db60`. Fingerprint Core baseline: `49e48c0604fbbf37587f7eee5b1b7b4dad8fcb1f6712c3318626e9f79a43fe4b`; intermediário: `139f61b6552c78d910b7d80b5eb6737c679cf0e9184acacaaccd89ecfb4099d5`. Os hashes de todos os 16 arquivos Core, runners, dependências, bundles e configurações estão no JSON.

O código intermediário pode ser reconstruído com o [patch portátil](CORE-INTERMEDIATE-CURRENT-V3.patch) sobre a baseline; o [manifesto dos 16 arquivos](CORE-INTERMEDIATE-CURRENT-V3.json) conserva hashes originais antes/depois.

## Ativação e desativação

`on` mede reativação de bench0 após `off`. `first-on-register-layer0` mede a primeira importação/ativação e permanece separada no JSON. Valores em ms; n3 = mediana de 3, n1 = observação única sem mediana/dispersão/p95. Nenhuma campanha teve 20 amostras para p95.

| Cenário | n | Arquivos da Layer alvo | on antes → depois (ms) | Variação | Git on | off antes → depois (ms) | Variação | Git off |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| layers0-files10 | 3 | 0 | — → — | — | — → — | — → — | — | — → — |
| layers1-files10 | 3 | 10 | 36.816,4 → 17.717,2 | -51,9% | 66 → 45 | 39.805,9 → 36.297,2 | -8,8% | 67 → 44 |
| layers1-file1MiB | 3 | 1 | 4.783,3 → 4.527,7 | -5,3% | 66 → 45 | 5.506,3 → 4.824,3 | -12,4% | 67 → 44 |
| layers1-file32MiB | 1 | 1 | 6.059,5 → 5.548,8 | -8,4% | 66 → 45 | 7.028,7 → 6.233,7 | -11,3% | 67 → 44 |
| layers1-file100MiB | 1 | 1 | 10.125 → 6.736,7 | -33,5% | 66 → 45 | 15.185,3 → 6.391,8 | -57,9% | 67 → 44 |
| layers2-files100 | 1 | 50 | 7.727,8 → 5.995,8 | -22,4% | 92 → 63 | 9.014,7 → 6.811,7 | -24,4% | 88 → 60 |
| layers5-files100 | 1 | 20 | 14.711 → 9.992,4 | -32,1% | 155 → 108 | 17.132 → 10.642,6 | -37,9% | 145 → 102 |
| layers10-files100 | 1 | 10 | 18.630,7 → 13.635 | -26,8% | 260 → 183 | 17.674,9 → 12.881,2 | -27,1% | 240 → 172 |
| layers1-files1000 | 1 | 1000 | 56.129,4 → 60.701,7 | 8,1% | 66 → 45 | 59.738,6 → 71.704,7 | 20% | 67 → 44 |
| layers1-files10000 | 1 | 10000 | — → — | — | — → — | — → — | — | — → — |

Nas escalas2/5/10 Layers há **100 arquivos totais**, distribuídos entre as Layers. A Layer alvo move50/20/10 arquivos respectivamente; as demais permanecem ativas. Não é uma curva de quantidade de Layers com volume materializado constante. O caso 0 Layer não tem on/off.

## Consultas e ativação repetida

| Cenário | status antes → depois (ms) | Git status | on-repeat antes → depois (ms) | Git repeat |
| --- | ---: | --- | ---: | --- |
| layers0-files10 | 11.603,2 → 6.665,1 | 54 → 36 | — → — | — → — |
| layers1-files10 | 29.955,1 → 36.078,1 | 123 → 90 | 12.372,2 → 8.593,8 | 49 → 34 |
| layers1-file1MiB | 10.911,6 → 7.040,1 | 123 → 90 | 4.236,4 → 3.227,1 | 49 → 34 |
| layers1-file32MiB | 11.622,7 → 11.891 | 123 → 90 | 5.098,4 → 2.609,7 | 49 → 34 |
| layers1-file100MiB | 11.539,6 → 8.436,3 | 123 → 90 | 3.782,4 → 3.761,5 | 49 → 34 |
| layers2-files100 | 16.384,9 → 11.230 | 152 → 117 | 4.980,8 → 4.213,5 | 60 → 44 |
| layers5-files100 | 22.284,6 → 18.252,1 | 239 → 198 | 7.635,8 → 6.813,8 | 93 → 74 |
| layers10-files100 | 27.185,6 → 24.551,2 | 384 → 333 | 10.446,4 → 8.578,3 | 148 → 124 |
| layers1-files1000 | 8.316 → 7.449,2 | 123 → 90 | 3.714,2 → 2.592,8 | 49 → 34 |
| layers1-files10000 | — → — | — → — | — → — | — → — |

## Dispersão e pioras observadas

Em 1 Layer/10 arquivos, on teve faixas sem sobreposição:31.577–45.697 ms antes e8.690–25.169 ms depois. A mediana caiu36.816 → 17.717 ms. Outras operações pioraram; nenhuma foi ocultada.

| Operação1L10 | Mediana antes → depois (ms) | Git diretas antes → depois | Classificação pelas faixas |
| --- | ---: | --- | --- |
| status | 29.955,1 → 36.078,1 | 123/123/123 → 90/90/90 | INCONCLUSIVE_OVERLAPPING_RANGES |
| add | 10.389,6 → 40.047,5 | 111/106/106 → 77/75/75 | INCONCLUSIVE_OVERLAPPING_RANGES |
| commit | 11.020,1 → 23.089,2 | 80/80/80 → 56/56/56 | INCONCLUSIVE_OVERLAPPING_RANGES |
| edit | 14.142,5 → 9.122 | 101/101/101 → 69/69/69 | INCONCLUSIVE_OVERLAPPING_RANGES |
| edit-end | 6.809,1 → 12.476,9 | 64/64/64 → 41/41/41 | INCONCLUSIVE_OVERLAPPING_RANGES |
| switch-other | 8.918,4 → 35.042,6 | 83/83/83 → 54/54/54 | MEASURED_HIGHER_LATENCY |
| switch-main | 10.549 → 33.911,1 | 83/83/83 → 54/54/54 | INCONCLUSIVE_OVERLAPPING_RANGES |
| off-dirty-refusal | 5.780,4 → 22.922,6 | 70/70/70 → 50/50/50 | MEASURED_HIGHER_LATENCY |

As faixas de status/add/commit se sobrepõem, apesar de medianas maiores no intermediário. `switch-other` e a recusa `off-dirty-refusal` ficaram mais lentos com faixas sem sobreposição. Em 1.000 arquivos, on 56.129 → 60.702 ms e off 59.739 → 71.705 ms pioraram na observação única. Essas observações motivaram a revisão V5; não provam causa exclusiva.

O JSON mantém cada duração, min/max/MAD quando n>1, soma de elapsed dos filhos Git, chamadas por comando e fases inclusivas. Fases aninhadas não devem ser somadas; filhos concorrentes podem acumular elapsed maior que a operação. O controle list0L continuou com 3 invocações, mas variou414/526/458 → 994/318/1701 ms; isso informa a incerteza, sem apagar as pioras.

## Arquivos grandes e recursos

| Arquivo | RSS amostrado do worker em on antes → depois | Tamanho lógico final da fixture antes → depois |
| --- | ---: | ---: |
| layers1-file32MiB | 219,6 → 72,2 MiB | 160,1 → 160 MiB |
| layers1-file100MiB | 396,9 → 72,8 MiB | 500,1 → 500,1 MiB |

RSS é amostrado a cada10 ms mais início/fim; não inclui memória dos filhos Git. O high-water mark reportado pelo worker também está no JSON. Os 100 MiB são bytes reais pseudoaleatórios, com 104.857.600 bytes lógicos materializados/retirados por ciclo. Os casos de 32/100 MiB deste benchmark estavam limpos; o teste B/C no runner usa um arquivo pequeno no caso 1L10, sem certificar B/C de 100 MiB. Permaneceram cópias e evidências transacionais. Tamanho lógico final não é pico nem alocação física. IO físico não foi medido.

## Limite real10.000 arquivos e interrupções

O endpoint baseline10k consumiu seu budget de 20 min **incluindo setup/init** e terminou TIMEOUT experimental, sem result.json/PASS. A última amostra durável foi init 9.918 ms; a primeira ativação não concluiu. Não há latência exata on/off nem contador Git total dessa operação: o observador mantinha entradas em RAM até measure terminar. Esses valores são UNKNOWN/null, não zero.

A inspeção após encerrar processos próprios encontrou 5.432/10.000 arquivos presentes fisicamente, sem oráculo final de blobs da composição parcial, journal pending de 6.431.718 bytes, 5.434 recovery.files, 5.435 entradas de backup e10.870 steps. O tamanho lógico total da fixture era15.387.911 bytes. O lock de diretório locks/coordinator, owner.json, journal e todos os bytes foram preservados; não houve recuperação, limpeza ou reatribuição. A revisão2 da inspeção corrigiu uma listagem inicial limitada a sufixo.lock, preservando o original. Não se extrapola duração final a partir do progresso.

current-v3/10k ficou NOT_RUN por decisão explícita de priorizar o Core V5 final, sem repetir20 min em um intermediário. Não é SKIP/ENV_BLOCKED nem aprovação do produto. Os 18 endpoints concluídos pertencem a9 pares distintos; o timeout e a não execução permanecem separados. A tentativa V3 baseline32 MiB interrompida no replanejamento n3 → n1 também é suplementar incompleta, nunca misturada ao par V4 concluído.

## Método e limites

- Bundles imutáveis de fontes congeladas; apenas o bundle recebe observadores. Core/CLI medidos não foram modificados pela instrumentação. Cada endpoint usa worker novo e setup fora das amostras. Não inclui startup completo da CLI.
- Condições quentes após setup, sem esvaziar cache do SO. Primeiro processo não significa cache frio. Ordem fixa baseline → current; sem outras suítes/benchmarks durante a janela, mas sem controle total de carga/frequência/cache.
- n3 para 0L10/1L10/1 MiB; n1 para escalas/grandes restantes. V3 teve 90 min disponíveis e replanejamento autorizado; V4 teve 90 min globais e cap20 min por endpoint10k. Budget4 GiB de desenho, sem quota/pico físico monitorado.
- Invocações Git **diretas do Core com PID** são contadas sem ring/limite; tentativas sem PID ficam separadas. Descendentes OS do launcher oficial cmd/git.exe não são observados. V3 pode omitir tentativa de spawn que lança erro síncrono antes do observer; V4 registra esse erro.
- HEAD/symref/índice MAIN semântico/blobs originais são observados pelo Git oficial ao final; ausências após off, preview de 3 metadados, B preparado vs C no disco e recuperação idempotente são verificados nos cenários pertinentes. Suítes funcionais separadas verificam integralmente propriedade, modos, índices privados, backups e regressões de segurança.
- O helper de parada V3 falhou ao persistir sua lista completa de ações depois de sinalizar processos próprios. Inventários antes/depois e término da sessão foram preservados; nenhuma prova faltante foi reconstruída como sucesso.
- Pilotos V2 tinham outras suítes concorrentes: são exploratórios e não entram nas comparações controladas. Proteção opt-in ficou desativada nos timings. Não há teste Linux nem perda real de energia.
