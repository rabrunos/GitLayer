# Benchmarks — Etapa 2B

Baseline congelada: `e8f2e3feba87224246a42337f77f702914df989e`. Operações completas do Core, em Windows x64, Node 24.14.1/Git2.53.0.windows.2. Não inclui startup da CLI. Todos os tempos abaixo são milissegundos absolutos; Δ negativo indica menor tempo observado.

A projeção pública registra pidObtained e contagens agregadas, sem IDs reais de processos. Os arquivos brutos privados permanecem intactos, com tamanhos e hashes identificados no JSON. Os ciclos n3 repetem on/off na mesma fixture, com histórico retido e filesystem aquecido; não são três fixtures independentes nem prova de estabilidade estatística.

Esta campanha mede o Core corrigido, com a mesma versão do observador nos dois endpoints e ordem fixa baseline→Core por cenário. PC sem uso e sem jogo, conforme informado pelo usuário no relato observado pelo coordenador às 01:22:29 UTC de 06/11/2026. A ordem, o cache e a variação temporal limitam a atribuição causal.

Primeira ativação permanece n1; os ciclos n3 de 10/100/1000 repetem a mesma fixture. Casos grandes e compostos são n1. O histórico [V7 pré-correção](BENCHMARKS-V7-PRE-CORRECTION.md) e seus controles não entram nestas comparações. [Recibo da campanha](BENCHMARKS-CAMPAIGN-RECEIPT.json).

| Cenário | Operação | Antes ms(n) | Final ms(n) | Δ ms | Δ % | Qualificação |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| layers1-files10 | first-on-register-layer0 | 2314.934(1) | 5419.232(1) | 3104.298 | 134.099 | SINGLE_OBSERVATION |
| layers1-files10 | on-reactivation-no-cache | 2182.106(3) | 3232.611(3) | 1050.505 | 48.142 | N3_OBSERVED_COMPARISON |
| layers1-files10 | off | 2358.474(3) | 2439.076(3) | 80.603 | 3.418 | N3_OBSERVED_COMPARISON |
| layers1-files10 | on-already-active | 1362.110(3) | 1363.032(3) | 0.922 | 0.068 | N3_OBSERVED_COMPARISON |
| layers1-files10 | off-dirty-refusal | 2164.210(1) | 2372.912(1) | 208.702 | 9.643 | SINGLE_OBSERVATION |
| layers1-files10 | recover-empty | 836.933(3) | 916.328(3) | 79.395 | 9.486 | N3_OBSERVED_COMPARISON |
| layers1-files100 | first-on-register-layer0 | 4716.005(1) | 8781.748(1) | 4065.743 | 86.212 | SINGLE_OBSERVATION |
| layers1-files100 | on-reactivation-no-cache | 4587.105(3) | 6560.484(3) | 1973.379 | 43.020 | N3_OBSERVED_COMPARISON |
| layers1-files100 | off | 5524.916(3) | 5851.981(3) | 327.066 | 5.920 | N3_OBSERVED_COMPARISON |
| layers1-files100 | on-already-active | 1389.483(3) | 1429.494(3) | 40.011 | 2.880 | N3_OBSERVED_COMPARISON |
| layers1-files100 | off-dirty-refusal | 2403.671(1) | 2662.437(1) | 258.766 | 10.765 | SINGLE_OBSERVATION |
| layers1-files100 | recover-empty | 832.021(3) | 923.553(3) | 91.532 | 11.001 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | first-on-register-layer0 | 39201.910(1) | 41638.526(1) | 2436.616 | 6.216 | SINGLE_OBSERVATION |
| layers1-files1000 | on-reactivation-no-cache | 36613.349(3) | 39486.428(3) | 2873.079 | 7.847 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | off | 47933.945(3) | 41121.958(3) | -6811.987 | -14.211 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | on-already-active | 1617.938(3) | 1651.982(3) | 34.044 | 2.104 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | off-dirty-refusal | 5598.107(1) | 5656.184(1) | 58.076 | 1.037 | SINGLE_OBSERVATION |
| layers1-files1000 | recover-empty | 903.609(3) | 971.978(3) | 68.370 | 7.566 | N3_OBSERVED_COMPARISON |
| layers1-files10000 | first-on-register-layer0 | — | 412128.932(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | on-reactivation-no-cache | — | 405770.937(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | off | — | 521793.364(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | on-already-active | — | 5764.138(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | off-dirty-refusal | — | 83950.646(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | recover-empty | — | 3259.433(1) | — | — | NOT_COMPARABLE |
| layers1-file100MiB | first-on-register-layer0 | 3292.627(1) | 6964.596(1) | 3671.969 | 111.521 | SINGLE_OBSERVATION |
| layers1-file100MiB | on-reactivation-no-cache | 3291.649(1) | 4736.616(1) | 1444.967 | 43.898 | SINGLE_OBSERVATION |
| layers1-file100MiB | off | 4389.119(1) | 4297.762(1) | -91.357 | -2.081 | SINGLE_OBSERVATION |
| layers1-file100MiB | on-already-active | 1357.096(1) | 1362.545(1) | 5.449 | 0.402 | SINGLE_OBSERVATION |
| layers1-file100MiB | off-dirty-refusal | 2344.451(1) | 2737.648(1) | 393.197 | 16.771 | SINGLE_OBSERVATION |
| layers1-file100MiB | recover-empty | 828.600(1) | 915.063(1) | 86.464 | 10.435 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | first-on-register-layer0 | 3121.783(1) | 6695.439(1) | 3573.656 | 114.475 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | on-reactivation-no-cache | 3066.069(1) | 4691.210(1) | 1625.141 | 53.004 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | off | 4166.906(1) | 4156.875(1) | -10.031 | -0.241 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | on-already-active | 1364.494(1) | 1341.894(1) | -22.600 | -1.656 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | off-dirty-refusal | 2693.702(1) | 2964.025(1) | 270.323 | 10.035 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | recover-empty | 833.766(1) | 917.630(1) | 83.865 | 10.059 | SINGLE_OBSERVATION |
| layers5-files100 | first-on-register-layer0 | 2566.579(1) | 5825.397(1) | 3258.818 | 126.971 | SINGLE_OBSERVATION |
| layers5-files100 | first-on-allLayers-sum-API | 19613.626(1) | 36100.269(1) | 16486.643 | 84.057 | SINGLE_OBSERVATION |
| layers5-files100 | on-reactivation-no-cache | 5047.444(1) | 6247.468(1) | 1200.024 | 23.775 | SINGLE_OBSERVATION |
| layers5-files100 | off | 5050.678(1) | 5223.656(1) | 172.979 | 3.425 | SINGLE_OBSERVATION |
| layers5-files100 | on-already-active | 3082.540(1) | 3049.846(1) | -32.694 | -1.061 | SINGLE_OBSERVATION |
| layers5-files100 | off-dirty-refusal | 4792.782(1) | 5942.970(1) | 1150.188 | 23.998 | SINGLE_OBSERVATION |
| layers5-files100 | recover-empty | 2857.589(1) | 2962.760(1) | 105.171 | 3.680 | SINGLE_OBSERVATION |
| layers10-files100 | first-on-register-layer0 | 2291.734(1) | 5496.045(1) | 3204.312 | 139.820 | SINGLE_OBSERVATION |
| layers10-files100 | first-on-allLayers-sum-API | 52842.255(1) | 84384.226(1) | 31541.972 | 59.691 | SINGLE_OBSERVATION |
| layers10-files100 | on-reactivation-no-cache | 7976.272(1) | 9058.349(1) | 1082.077 | 13.566 | SINGLE_OBSERVATION |
| layers10-files100 | off | 7623.984(1) | 7762.902(1) | 138.919 | 1.822 | SINGLE_OBSERVATION |
| layers10-files100 | on-already-active | 5096.707(1) | 5272.094(1) | 175.387 | 3.441 | SINGLE_OBSERVATION |
| layers10-files100 | off-dirty-refusal | 8041.536(1) | 10145.462(1) | 2103.926 | 26.163 | SINGLE_OBSERVATION |
| layers10-files100 | recover-empty | 5399.381(1) | 5570.141(1) | 170.760 | 3.163 | SINGLE_OBSERVATION |

## Journals e disco

Contagens são observações nos handles do Core instrumentado. Bytes regravados não são espaço adicional retido nem bytes físicos de IO. As durações incluem o custo de observação em ambos os endpoints.

| Fonte/cenário | Operação/amostra | Journal escrito B | Flush de arquivo journal OK/tentativas | Journal lido B | Persist inclusivo ms |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline/layers1-files10 | first-on-register-layer0/1 | 311239 | 33/33 | 0 | 202.879 |
| baseline/layers1-files10 | off/1 | 346126 | 30/30 | 18571 | 189.360 |
| baseline/layers1-files10 | on-reactivation-no-cache/1 | 269946 | 29/29 | 40244 | 174.927 |
| baseline/layers1-files10 | off/2 | 346126 | 30/30 | 58268 | 181.602 |
| baseline/layers1-files10 | on-reactivation-no-cache/2 | 269946 | 29/29 | 79941 | 169.195 |
| baseline/layers1-files10 | off/3 | 346126 | 30/30 | 97965 | 180.625 |
| baseline/layers1-files10 | on-reactivation-no-cache/3 | 269946 | 29/29 | 119638 | 165.312 |
| baseline/layers1-files100 | first-on-register-layer0/1 | 13252375 | 213/213 | 0 | 1355.910 |
| baseline/layers1-files100 | off/1 | 18326620 | 210/210 | 124237 | 1341.154 |
| baseline/layers1-files100 | on-reactivation-no-cache/1 | 12966457 | 209/209 | 294416 | 1335.761 |
| baseline/layers1-files100 | off/2 | 18326620 | 210/210 | 418107 | 1366.810 |
| baseline/layers1-files100 | on-reactivation-no-cache/2 | 12966457 | 209/209 | 588286 | 1311.151 |
| baseline/layers1-files100 | off/3 | 18326620 | 210/210 | 711977 | 1404.258 |
| baseline/layers1-files100 | on-reactivation-no-cache/3 | 12966457 | 209/209 | 882156 | 1370.373 |
| baseline/layers1-files1000 | first-on-register-layer0/1 | 1193130811 | 2013/2013 | 0 | 22237.403 |
| baseline/layers1-files1000 | off/1 | 1701996244 | 2010/2010 | 1185343 | 22561.362 |
| baseline/layers1-files1000 | on-reactivation-no-cache/1 | 1190392388 | 2009/2009 | 2847728 | 20501.453 |
| baseline/layers1-files1000 | off/2 | 1701996244 | 2010/2010 | 4032526 | 21724.839 |
| baseline/layers1-files1000 | on-reactivation-no-cache/2 | 1190392388 | 2009/2009 | 5694911 | 19541.506 |
| baseline/layers1-files1000 | off/3 | 1701996244 | 2010/2010 | 6879709 | 21531.255 |
| baseline/layers1-files1000 | on-reactivation-no-cache/3 | 1190392388 | 2009/2009 | 8542094 | 18708.613 |
| baseline/layers1-file100MiB | first-on-register-layer0/1 | 63352 | 15/15 | 0 | 93.272 |
| baseline/layers1-file100MiB | off/1 | 44350 | 12/12 | 8044 | 77.645 |
| baseline/layers1-file100MiB | on-reactivation-no-cache/1 | 46463 | 11/11 | 14933 | 60.850 |
| baseline/layers1-files3x32MiB | first-on-register-layer0/1 | 102064 | 19/19 | 0 | 149.833 |
| baseline/layers1-files3x32MiB | off/1 | 88026 | 16/16 | 10382 | 98.402 |
| baseline/layers1-files3x32MiB | on-reactivation-no-cache/1 | 79753 | 15/15 | 20555 | 90.689 |
| baseline/layers5-files100 | first-on-register-layer0/1 | 810795 | 53/53 | 0 | 330.864 |
| baseline/layers5-files100 | off/1 | 1067688 | 50/50 | 157129 | 296.710 |
| baseline/layers5-files100 | on-reactivation-no-cache/1 | 806610 | 49/49 | 196682 | 296.706 |
| baseline/layers10-files100 | first-on-register-layer0/1 | 311806 | 33/33 | 0 | 193.850 |
| baseline/layers10-files100 | off/1 | 434416 | 30/30 | 205789 | 175.786 |
| baseline/layers10-files100 | on-reactivation-no-cache/1 | 354897 | 29/29 | 230522 | 180.674 |
| final/layers1-files10 | first-on-register-layer0/1 | 61455 | 64/64 | 72700 | 264.634 |
| final/layers1-files10 | off/1 | 92997 | 60/60 | 73474 | 262.137 |
| final/layers1-files10 | on-reactivation-no-cache/1 | 51335 | 54/54 | 102257 | 230.592 |
| final/layers1-files10 | off/2 | 92997 | 60/60 | 111178 | 245.098 |
| final/layers1-files10 | on-reactivation-no-cache/2 | 51335 | 54/54 | 139961 | 212.987 |
| final/layers1-files10 | off/3 | 92997 | 60/60 | 148882 | 241.228 |
| final/layers1-files10 | on-reactivation-no-cache/3 | 51335 | 54/54 | 177665 | 216.923 |
| final/layers1-files100 | first-on-register-layer0/1 | 404512 | 424/424 | 485454 | 1742.570 |
| final/layers1-files100 | off/1 | 755450 | 420/420 | 529247 | 1727.700 |
| final/layers1-files100 | on-reactivation-no-cache/1 | 394370 | 414/414 | 768278 | 1752.980 |
| final/layers1-files100 | off/2 | 755450 | 420/420 | 820221 | 1723.638 |
| final/layers1-files100 | on-reactivation-no-cache/2 | 394370 | 414/414 | 1059252 | 1652.904 |
| final/layers1-files100 | off/3 | 755450 | 420/420 | 1111195 | 1657.660 |
| final/layers1-files100 | on-reactivation-no-cache/3 | 394370 | 414/414 | 1350226 | 1692.044 |
| final/layers1-files1000 | first-on-register-layer0/1 | 3850859 | 4024/4024 | 4621868 | 16174.352 |
| final/layers1-files1000 | off/1 | 7415683 | 4020/4020 | 5098560 | 15965.912 |
| final/layers1-files1000 | on-reactivation-no-cache/1 | 3840695 | 4014/4014 | 7448999 | 16340.178 |
| final/layers1-files1000 | off/2 | 7415683 | 4020/4020 | 7933844 | 15981.840 |
| final/layers1-files1000 | on-reactivation-no-cache/2 | 3840695 | 4014/4014 | 10284283 | 16208.337 |
| final/layers1-files1000 | off/3 | 7415683 | 4020/4020 | 10769128 | 16287.527 |
| final/layers1-files1000 | on-reactivation-no-cache/3 | 3840695 | 4014/4014 | 13119567 | 16186.052 |
| final/layers1-files10000 | first-on-register-layer0/1 | 38475904 | 40024/40024 | 46075880 | 174204.403 |
| final/layers1-files10000 | off/1 | 74377716 | 40020/40020 | 50908572 | 166157.308 |
| final/layers1-files10000 | on-reactivation-no-cache/1 | 38465720 | 40014/40014 | 74463019 | 172752.065 |
| final/layers1-file100MiB | first-on-register-layer0/1 | 27276 | 28/28 | 31504 | 201.294 |
| final/layers1-file100MiB | off/1 | 27083 | 24/24 | 28003 | 108.031 |
| final/layers1-file100MiB | on-reactivation-no-cache/1 | 17171 | 18/18 | 35844 | 79.390 |
| final/layers1-files3x32MiB | first-on-register-layer0/1 | 34866 | 36/36 | 40656 | 156.588 |
| final/layers1-files3x32MiB | off/1 | 41727 | 32/32 | 38105 | 146.330 |
| final/layers1-files3x32MiB | on-reactivation-no-cache/1 | 24756 | 26/26 | 50598 | 106.257 |
| final/layers5-files100 | first-on-register-layer0/1 | 99621 | 104/104 | 118628 | 428.353 |
| final/layers5-files100 | off/1 | 171813 | 100/100 | 252419 | 398.053 |
| final/layers5-files100 | on-reactivation-no-cache/1 | 91769 | 94/94 | 307306 | 368.433 |
| final/layers10-files100 | first-on-register-layer0/1 | 61536 | 64/64 | 72772 | 275.064 |
| final/layers10-files100 | off/1 | 104589 | 60/60 | 264338 | 239.219 |
| final/layers10-files100 | on-reactivation-no-cache/1 | 56528 | 54/54 | 299223 | 210.775 |

| Fonte/cenário | Setup ms | Disco lógico final B | Backups B | Journals B | Materialized B | Validation indexes B | Initialization indexes B | Private indexes B | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline/layers1-files10 | 737.869 | 183726 | 14714 | 140862 | 10240 | 0 | 0 | 979 | PASS |
| baseline/layers1-files100 | 1143.778 | 1318350 | 121192 | 1009047 | 102400 | 0 | 0 | 8901 | PASS |
| baseline/layers1-files1000 | 4591.354 | 12707504 | 1188600 | 9730092 | 1024000 | 0 | 0 | 88103 | PASS |
| baseline/layers1-files10000 | — | — | — | — | — | — | — | — | TIMEOUT |
| baseline/layers1-file100MiB | 3711.787 | 524357302 | 104858852 | 25629 | 209715200 | 0 | 0 | 185 | PASS |
| baseline/layers1-files3x32MiB | 4220.115 | 503393350 | 100664940 | 33589 | 201326592 | 0 | 0 | 361 | PASS |
| baseline/layers5-files100 | 2156.788 | 391448 | 30916 | 239810 | 30720 | 0 | 0 | 9295 | PASS |
| baseline/layers10-files100 | 3479.518 | 445509 | 47430 | 274579 | 28160 | 0 | 0 | 9790 | PASS |
| final/layers1-files10 | 741.035 | 433342 | 11777 | 398091 | 0 | 3916 | 979 | 979 | PASS |
| final/layers1-files100 | 1078.158 | 3337874 | 94489 | 3112492 | 0 | 35604 | 8901 | 8901 | PASS |
| final/layers1-files1000 | 4451.082 | 32557616 | 924291 | 30427313 | 0 | 352412 | 88103 | 88103 | PASS |
| final/layers1-files10000 | 76743.117 | 134467010 | 3669857 | 120590420 | 0 | 1760210 | 880105 | 880105 | PASS |
| final/layers1-file100MiB | 3715.459 | 314676708 | 104858667 | 59538 | 0 | 370 | 185 | 185 | PASS |
| final/layers1-files3x32MiB | 3992.285 | 302117431 | 100664579 | 83213 | 0 | 722 | 361 | 361 | PASS |
| final/layers5-files100 | 2211.710 | 748782 | 29057 | 608267 | 0 | 11154 | 9295 | 9295 | PASS |
| final/layers10-files100 | 3525.539 | 824352 | 46451 | 660150 | 0 | 10769 | 9790 | 9790 | PASS |

## Dados de arquivo alocados no endpoint

A versão atual usa lstat BigInt e soma blocks×512, deduplicando dev:ino. O libuv 1.51 converte AllocationSize para blocos de 512 bytes; o Node24.14.1 encaminha esse campo. Isto observa alocação de dados de arquivos, fora dos relógios das APIs. Exclui diretórios, MFT/metadados, ADS, extents CoW compartilhados, IO do dispositivo e picos. Blksize não define a unidade de blocks nem prova clusters. [libuv1.51 fonte](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c#L1772), [Node fonte](https://github.com/nodejs/node/blob/v24.14.1/src/node_file-inl.h#L97).

| Fonte/cenário | Estado | Repo dados alocados B | Journals B | Backups B | Materialized B | Validation indexes B | Initialization indexes B | Private indexes B | Aliases dedup |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline/layers1-files10 | MEASURED | 184320 | 159744 | 16384 | 0 | 0 | 0 | 4096 | 0 |
| baseline/layers1-files100 | MEASURED | 1114112 | 1028096 | 61440 | 0 | 0 | 0 | 12288 | 0 |
| baseline/layers1-files1000 | MEASURED | 10321920 | 9744384 | 434176 | 0 | 0 | 0 | 90112 | 0 |
| baseline/layers1-files10000 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers1-file100MiB | MEASURED | 524353536 | 28672 | 104857600 | 209715200 | 0 | 0 | 0 | 0 |
| baseline/layers1-files3x32MiB | MEASURED | 503398400 | 40960 | 100663296 | 201326592 | 0 | 0 | 0 | 0 |
| baseline/layers5-files100 | MEASURED | 347136 | 249856 | 61952 | 0 | 0 | 0 | 20480 | 0 |
| baseline/layers10-files100 | MEASURED | 475648 | 303104 | 119296 | 0 | 0 | 0 | 40960 | 0 |
| final/layers1-files10 | MEASURED | 462848 | 430080 | 4096 | 0 | 16384 | 4096 | 4096 | 0 |
| final/layers1-files100 | MEASURED | 3248128 | 3137536 | 24576 | 0 | 49152 | 12288 | 12288 | 0 |
| final/layers1-files1000 | MEASURED | 31207424 | 30449664 | 163840 | 0 | 360448 | 90112 | 90112 | 0 |
| final/layers1-files10000 | MEASURED | 125720576 | 120604672 | 1110016 | 0 | 1761280 | 880640 | 880640 | 0 |
| final/layers1-file100MiB | MEASURED | 314681344 | 71680 | 104857600 | 0 | 0 | 0 | 0 | 0 |
| final/layers1-files3x32MiB | MEASURED | 302127104 | 96256 | 100663296 | 0 | 0 | 0 | 0 | 0 |
| final/layers5-files100 | MEASURED | 773120 | 634880 | 57856 | 0 | 24576 | 20480 | 20480 | 0 |
| final/layers10-files100 | MEASURED | 969728 | 715264 | 115200 | 0 | 45056 | 40960 | 40960 | 0 |

Validation indexes identifica somente transactions/ID/activation-UUID.index; initialization indexes identifica transactions/ID/register-UUID.index. MAIN e os índices privados têm categorias separadas. Ambos os endpoints usam o mesmo inventário atual, com validade e unidades declaradas; nenhum probe antigo de alocação foi incorporado. Hardlinks não são adotados como cópias independentes.


## Recursos observados

RSS do worker em MiB, amostrado a cada 10 ms; inclui o harness e exclui filhos Git. A coluna Git conta processos diretos com PID/tentativas de spawn, sem descendentes. Fases e tempos Git podem se sobrepor; não devem ser somados ao tempo total.

| Fonte/cenário | API/amostra | RSS pico MiB | Git PID/tentativas | Sem PID | Git dur. agregada ms |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline/layers1-files10 | first-on-register-layer0/1 | 61.465 | 46/46 | 0 | 1926.150 |
| baseline/layers1-files10 | off/1 | 71.645 | 44/44 | 0 | 1800.388 |
| baseline/layers1-files10 | on-reactivation-no-cache/1 | 72.160 | 45/45 | 0 | 1838.683 |
| baseline/layers1-files10 | off/2 | 75.609 | 44/44 | 0 | 1854.537 |
| baseline/layers1-files10 | on-reactivation-no-cache/2 | 73.547 | 45/45 | 0 | 1828.992 |
| baseline/layers1-files10 | off/3 | 90.723 | 44/44 | 0 | 1778.065 |
| baseline/layers1-files10 | on-reactivation-no-cache/3 | 91.898 | 45/45 | 0 | 1838.168 |
| baseline/layers1-files100 | first-on-register-layer0/1 | 71.605 | 46/46 | 0 | 1945.285 |
| baseline/layers1-files100 | off/1 | 82.199 | 44/44 | 0 | 1849.967 |
| baseline/layers1-files100 | on-reactivation-no-cache/1 | 89.926 | 45/45 | 0 | 1871.869 |
| baseline/layers1-files100 | off/2 | 105.160 | 44/44 | 0 | 1839.148 |
| baseline/layers1-files100 | on-reactivation-no-cache/2 | 106.746 | 45/45 | 0 | 1887.137 |
| baseline/layers1-files100 | off/3 | 106.273 | 44/44 | 0 | 1831.196 |
| baseline/layers1-files100 | on-reactivation-no-cache/3 | 107.305 | 45/45 | 0 | 1882.346 |
| baseline/layers1-files1000 | first-on-register-layer0/1 | 113.215 | 46/46 | 0 | 2409.947 |
| baseline/layers1-files1000 | off/1 | 174.969 | 44/44 | 0 | 2382.209 |
| baseline/layers1-files1000 | on-reactivation-no-cache/1 | 211.883 | 45/45 | 0 | 2350.154 |
| baseline/layers1-files1000 | off/2 | 211.207 | 44/44 | 0 | 2391.792 |
| baseline/layers1-files1000 | on-reactivation-no-cache/2 | 214.594 | 45/45 | 0 | 2506.767 |
| baseline/layers1-files1000 | off/3 | 199.605 | 44/44 | 0 | 2393.471 |
| baseline/layers1-files1000 | on-reactivation-no-cache/3 | 225.254 | 45/45 | 0 | 2356.022 |
| baseline/layers1-file100MiB | first-on-register-layer0/1 | 57.938 | 46/46 | 0 | 2028.625 |
| baseline/layers1-file100MiB | off/1 | 63.859 | 44/44 | 0 | 2197.655 |
| baseline/layers1-file100MiB | on-reactivation-no-cache/1 | 63.156 | 45/45 | 0 | 2015.546 |
| baseline/layers1-files3x32MiB | first-on-register-layer0/1 | 56.922 | 46/46 | 0 | 2037.528 |
| baseline/layers1-files3x32MiB | off/1 | 63.934 | 44/44 | 0 | 2169.731 |
| baseline/layers1-files3x32MiB | on-reactivation-no-cache/1 | 70.488 | 45/45 | 0 | 1964.580 |
| baseline/layers5-files100 | first-on-register-layer0/1 | 61.117 | 46/46 | 0 | 1912.933 |
| baseline/layers5-files100 | off/1 | 95.043 | 102/102 | 0 | 4129.804 |
| baseline/layers5-files100 | on-reactivation-no-cache/1 | 90.465 | 108/108 | 0 | 4376.958 |
| baseline/layers10-files100 | first-on-register-layer0/1 | 61.375 | 46/46 | 0 | 1917.517 |
| baseline/layers10-files100 | off/1 | 114.672 | 172/172 | 0 | 6982.711 |
| baseline/layers10-files100 | on-reactivation-no-cache/1 | 119.020 | 183/183 | 0 | 7487.463 |
| final/layers1-files10 | first-on-register-layer0/1 | 63.621 | 119/119 | 0 | 5212.144 |
| final/layers1-files10 | off/1 | 71.773 | 44/44 | 0 | 1803.615 |
| final/layers1-files10 | on-reactivation-no-cache/1 | 71.082 | 61/61 | 0 | 2646.526 |
| final/layers1-files10 | off/2 | 84.918 | 44/44 | 0 | 1781.931 |
| final/layers1-files10 | on-reactivation-no-cache/2 | 85.422 | 61/61 | 0 | 2571.005 |
| final/layers1-files10 | off/3 | 86.535 | 44/44 | 0 | 1856.496 |
| final/layers1-files10 | on-reactivation-no-cache/3 | 87.539 | 61/61 | 0 | 2553.377 |
| final/layers1-files100 | first-on-register-layer0/1 | 70.980 | 119/119 | 0 | 5290.460 |
| final/layers1-files100 | off/1 | 73.945 | 44/44 | 0 | 1842.662 |
| final/layers1-files100 | on-reactivation-no-cache/1 | 85.738 | 61/61 | 0 | 2620.494 |
| final/layers1-files100 | off/2 | 89.234 | 44/44 | 0 | 1840.033 |
| final/layers1-files100 | on-reactivation-no-cache/2 | 91.777 | 61/61 | 0 | 2614.610 |
| final/layers1-files100 | off/3 | 92.250 | 44/44 | 0 | 1844.633 |
| final/layers1-files100 | on-reactivation-no-cache/3 | 93.051 | 61/61 | 0 | 2645.633 |
| final/layers1-files1000 | first-on-register-layer0/1 | 96.188 | 119/119 | 0 | 5799.587 |
| final/layers1-files1000 | off/1 | 129.043 | 44/44 | 0 | 2472.369 |
| final/layers1-files1000 | on-reactivation-no-cache/1 | 177.852 | 61/61 | 0 | 3119.931 |
| final/layers1-files1000 | off/2 | 198.602 | 44/44 | 0 | 2460.309 |
| final/layers1-files1000 | on-reactivation-no-cache/2 | 206.992 | 61/61 | 0 | 3133.399 |
| final/layers1-files1000 | off/3 | 208.996 | 44/44 | 0 | 2460.115 |
| final/layers1-files1000 | on-reactivation-no-cache/3 | 216.195 | 61/61 | 0 | 3097.613 |
| final/layers1-files10000 | first-on-register-layer0/1 | 207.664 | 119/119 | 0 | 12028.457 |
| final/layers1-files10000 | off/1 | 264.941 | 44/44 | 0 | 10081.152 |
| final/layers1-files10000 | on-reactivation-no-cache/1 | 300.547 | 61/61 | 0 | 9577.444 |
| final/layers1-file100MiB | first-on-register-layer0/1 | 62.473 | 119/119 | 0 | 5357.875 |
| final/layers1-file100MiB | off/1 | 70.680 | 44/44 | 0 | 2207.609 |
| final/layers1-file100MiB | on-reactivation-no-cache/1 | 70.203 | 61/61 | 0 | 2713.292 |
| final/layers1-files3x32MiB | first-on-register-layer0/1 | 62.840 | 119/119 | 0 | 5353.765 |
| final/layers1-files3x32MiB | off/1 | 71.406 | 44/44 | 0 | 2174.724 |
| final/layers1-files3x32MiB | on-reactivation-no-cache/1 | 71.496 | 61/61 | 0 | 2761.357 |
| final/layers5-files100 | first-on-register-layer0/1 | 68.176 | 119/119 | 0 | 5272.236 |
| final/layers5-files100 | off/1 | 116.344 | 102/102 | 0 | 4161.229 |
| final/layers5-files100 | on-reactivation-no-cache/1 | 118.352 | 124/124 | 0 | 5139.908 |
| final/layers10-files100 | first-on-register-layer0/1 | 63.148 | 119/119 | 0 | 5321.514 |
| final/layers10-files100 | off/1 | 120.258 | 172/172 | 0 | 7002.217 |
| final/layers10-files100 | on-reactivation-no-cache/1 | 121.016 | 199/199 | 0 | 8229.744 |

O disco lógico total inclui toda a fixture (objetos Git, workspace, HOME isolado, índices de seeding e transações). Backups, journals e materialized são subtotais do repositório; nenhum deles é pico medido, ocupação física ou quota.


## Escala de dez mil arquivos

baseline: TIMEOUT; orçamento do worker inteiro 180000ms (setup incluído), duração externa 180166ms. Setup aproximado pela linha do tempo 40403.000ms. Intervalo observado desde início da primeira ativação até recibo do timeout 138314.000ms; não é latência completa. Operações incompletas não recebem aprovação nem delta pareado.

final: PASS; orçamento do worker inteiro 2100000ms (setup incluído), duração externa 1542168ms. Setup aproximado pela linha do tempo 76745.000ms. Operações incompletas não recebem aprovação nem delta pareado.

Nas duas fontes desta nova campanha, cada ativação/desativação concluída possui recibo em operationProofs: HEAD, refs de branches, MAIN semântico e blobs Git ou ausências, conferidos fora do relógio. Timeout posterior conserva as provas completas, mas não aprova o cenário inteiro.


Em 5/10 Layers há 100 arquivos no total. On/off do alvo bench0 move 20/10 arquivos com 4/9 outras Layers ativas. First-on-register-layer0 mede apenas a primeira origem, com as demais ainda inativas. First-on-allLayers-sum-API soma os tempos completos das 5/10 chamadas iniciais; exclui setup e oráculos entre chamadas e não é uma operação atômica única.


## Fontes e limites

- baseline: Core SHA-256 `23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb`; runner `7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761`.
- final: Core SHA-256 `dcada2527e12c8b65b437f8011125798c484f75adba7c6727cd366657cf3dceb`; runner `7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761`.

- Complete Core API calls; no CLI startup. Both baseline and corrected Core use the same frozen current observer in one new fixed-order campaign. There are no v1 inputs, primary overrides or historical auxiliary campaigns. Source/runtime and observer hashes are recorded separately.
- First activation includes first registration and is one observation per case. Reactivation is extraction again; no projection cache exists.
- Both phases request three same-fixture off/reactivation cycles for 10/100/1000 files; first activation remains n1. Large, multilayer and 10000-file cases use one cycle. Actual completed sample counts are authoritative; repetitions are not independent fresh fixtures or proof of statistical stability. No p95 or significance claim.
- Fixed baseline-then-current order per case, warm filesystem after setup and no OS cache eviction. The user reported the PC unused and no playing; the latest report is the primary campaign condition, with earlier messages kept only as history. Fixed order, cache and temporal variation limit causal attribution.
- Filesystem observers count known successful bytes at JavaScript FileHandle/filesystem boundaries, including repeated journal writes; not physical device IO.
- Native fs.copyFile returns void: its byte counter remains 0 (unknown payload), even on success. Git checkout-index IO is outside the JS filesystem observer. These zeros never prove absence of copies.
- Directory fsync attempts and failures remain separate. Windows can reject directory flush; file flush success does not establish power-loss durability of all names.
- Method phases are inclusive and overlap; do not add phase durations. Hash validation is included in materialize/diskSnapshot/copy/publish and IO calls, with no exclusive CPU timer.
- Worker RSS sampled every 10 ms omits shorter peaks and child Git RSS; includes harness/oracle allocations. Endpoint logical and OS-reported file-data allocated bytes are separate; neither is peak disk or full physical volume cost.
- Git spawn attempts, children with PID, and failures without PID are separated; descendants of Git/wrappers are unobserved.
- Both phases use the current endpoint file-data allocation observer via blocks*512 with dev/inode deduplication where valid. No old allocation probe, volume receipt or v1 endpoint is imported. This is OS-reported regular-file data allocation, not unique extents, total-volume physical cost, peak disk, device IO or a filesystem quota.
- Timeout/incomplete endpoints retain samples without claiming complete activation or a comparative speedup. Fixtures for failures are retained externally.
- Performance PASS includes independent Git/physical state oracles in the harness; functional certification comes from separate adversarial/regression suites.

Amostras, condições, oráculos nativos, contadores por syscall, Git direto e fases inclusivas constam de [BENCHMARKS.json](BENCHMARKS.json). Cache ausente/inválido e volumes alternativos não recebem números fictícios: não há cache de projeção no produto. Não se atribui medição de reflink ou rename de diretório a estes tempos.

## Calibração separada sem profiler

Chamadas completas em fixtures novas, n1 por operação concluída. Oráculos Git ficam fora do relógio. Não há contadores Core de Git/FS/fases/RSS nesta campanha, e seus tempos não corrigem nem integram as medianas instrumentadas.

| API | Baseline ms | Core22 ms |
| --- | ---: | ---: |
| first-on-register-layer0 | 34101.5376 | 39702.2029 |
| off | 44381.8336 | 39359.8765 |
| on-reactivation-no-cache | 33776.7236 | 37199.9369 |

Fonte Core22 por tuplas caminho/hash: 807ad17f66e41e3147792049797a48b56c919737734bbe2a847149a07909ee8b. Fingerprint próprio do benchmark: dcada2527e12c8b65b437f8011125798c484f75adba7c6727cd366657cf3dceb. São domínios distintos; cada manifesto permanece no JSON.

O gerador base e o pós-processador externo, os comandos normalizados, as condições e os hashes brutos privados são identificados no recibo. Qualificações legadas e texto de diagnóstico de processos foram ajustados sem alterar amostras, contadores, resultados ou comparações. O orçamento de 4 GiB é metadado consultivo; o runner não aplica quota física.

A full de 603 testes pertence ao fingerprint 1c0646a4edef5a2616050417dcba89abb5fd3e1ff2ed1f7a94b01bc333f4045d; a nova broad completa pertence ao fingerprint c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc. A [prova de transição restrita](SOURCE-TRANSITION-PROOF.json) verifica uma única receita de matriz fora do corpus da full, com 233 outras entradas e Core/corpus/helpers exatos. Não se atribui a full ao novo fingerprint completo.
