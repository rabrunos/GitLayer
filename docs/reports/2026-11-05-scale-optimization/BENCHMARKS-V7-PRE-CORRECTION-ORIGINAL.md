# Benchmarks — Etapa 2B

**Qualificação posterior:** as tabelas e os dados desta campanha identificam o candidato medido Core21 `672b71a8…`, anterior à [correção do vínculo de materialização](MATERIALIZED-SOURCE-REPRO.json). O termo “final” abaixo designa a variante encerrada daquela campanha, não o runtime corrigido posteriormente. Nenhum tempo é transferido automaticamente para a nova fonte; a medição posterior continua pendente em [RESULTS](RESULTS.md).

Baseline congelada: `e8f2e3feba87224246a42337f77f702914df989e`. Operações completas do Core, em Windows x64, Node 24.14.1/Git2.53.0.windows.2. Não inclui startup da CLI. Todos os tempos abaixo são milissegundos absolutos; Δ negativo indica menor tempo observado.

A projeção pública registra pidObtained e contagens agregadas, sem IDs reais de processos. Os arquivos brutos privados permanecem intactos, com tamanhos e hashes identificados no JSON. Os ciclos n3 repetem on/off na mesma fixture, com histórico retido e filesystem aquecido; não são três fixtures independentes nem prova de estabilidade estatística.

A baseline principal de mil arquivos usa nova campanha controlada n3, com o mesmo observador do final. A observação v1 n1 permanece em supplementaryCampaigns no JSON e não entra nas comparações principais.

As comparações são observações, não estimativas causais. A baseline principal de mil arquivos e o final usam o mesmo observador, em janelas tranquilas diferentes confirmadas pelo usuário; a ociosidade do sistema operacional não foi comprovada. Os demais casos conservam a baseline histórica v1, com a diferença de observador explicitada. A ordem fixa, o aquecimento e a variação temporal limitam as conclusões.

A redução dos bytes de journal não produziu ganho universal de ativação: há regressões observadas na primeira ativação e na reativação dos casos pequenos, grandes e de várias Layers. A meta de dez mil arquivos em menos de cinco segundos não foi atingida. PASS de uma fixture de desempenho significa aprovação de seus oráculos independentes, não certificação funcional final; esta é registrada em [RESULTS.md](RESULTS.md).

O histórico anterior à adoção do buffer permanece em [BENCHMARKS-INTERMEDIATE.md](BENCHMARKS-INTERMEDIATE.md) e seu [JSON](BENCHMARKS-INTERMEDIATE.json). Os dados finais têm fontes identificadas pelos manifests; o fingerprint do benchmark final é fa684f0c1e741d961e5f683c2159d26aed15fd9dc3d1f2a382754648aa692aac. As mesmas 21 entradas, convertidas para as tuplas caminho/hash do validador, produzem 672b71a890b5bd58b089bb567763dba3c432ac1f08ca020c45d6a3b9ef4f204d.

| Cenário | Operação | Antes ms(n) | Final ms(n) | Δ ms | Δ % | Qualificação |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| layers1-files10 | first-on-register-layer0 | 2264.892(1) | 5471.849(1) | 3206.957 | 141.594 | SINGLE_OBSERVATION |
| layers1-files10 | on-reactivation-no-cache | 2226.468(3) | 3350.411(3) | 1123.944 | 50.481 | N3_OBSERVED_COMPARISON |
| layers1-files10 | off | 2303.058(3) | 2515.672(3) | 212.615 | 9.232 | N3_OBSERVED_COMPARISON |
| layers1-files10 | on-already-active | 1339.045(3) | 1406.874(3) | 67.829 | 5.065 | N3_OBSERVED_COMPARISON |
| layers1-files10 | off-dirty-refusal | 2149.493(1) | 2294.153(1) | 144.660 | 6.730 | SINGLE_OBSERVATION |
| layers1-files10 | recover-empty | 819.718(3) | 878.691(3) | 58.972 | 7.194 | N3_OBSERVED_COMPARISON |
| layers1-files100 | first-on-register-layer0 | 4957.594(1) | 8846.405(1) | 3888.811 | 78.441 | SINGLE_OBSERVATION |
| layers1-files100 | on-reactivation-no-cache | 4687.364(3) | 6763.470(3) | 2076.106 | 44.292 | N3_OBSERVED_COMPARISON |
| layers1-files100 | off | 5626.900(3) | 6102.824(3) | 475.924 | 8.458 | N3_OBSERVED_COMPARISON |
| layers1-files100 | on-already-active | 1363.293(3) | 1438.141(3) | 74.848 | 5.490 | N3_OBSERVED_COMPARISON |
| layers1-files100 | off-dirty-refusal | 2676.544(1) | 2581.074(1) | -95.469 | -3.567 | SINGLE_OBSERVATION |
| layers1-files100 | recover-empty | 824.346(3) | 891.298(3) | 66.952 | 8.122 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | first-on-register-layer0 | 46075.003(1) | 47319.821(1) | 1244.818 | 2.702 | SINGLE_OBSERVATION |
| layers1-files1000 | on-reactivation-no-cache | 44190.261(3) | 44678.561(3) | 488.300 | 1.105 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | off | 60864.789(3) | 46976.505(3) | -13888.284 | -22.818 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | on-already-active | 2204.060(3) | 1856.460(3) | -347.600 | -15.771 | N3_OBSERVED_COMPARISON |
| layers1-files1000 | off-dirty-refusal | 6226.983(1) | 6358.970(1) | 131.986 | 2.120 | SINGLE_OBSERVATION |
| layers1-files1000 | recover-empty | 1225.347(3) | 1016.993(3) | -208.354 | -17.004 | N3_OBSERVED_COMPARISON |
| layers1-files10000 | first-on-register-layer0 | — | 501009.566(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | on-reactivation-no-cache | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | off | — | 625864.576(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | on-already-active | — | 6739.918(1) | — | — | NOT_COMPARABLE |
| layers1-files10000 | off-dirty-refusal | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | recover-empty | — | 3395.008(1) | — | — | NOT_COMPARABLE |
| layers1-file100MiB | first-on-register-layer0 | 3058.888(1) | 6812.293(1) | 3753.405 | 122.705 | SINGLE_OBSERVATION |
| layers1-file100MiB | on-reactivation-no-cache | 2850.862(1) | 4532.598(1) | 1681.736 | 58.990 | SINGLE_OBSERVATION |
| layers1-file100MiB | off | 4400.267(1) | 4264.250(1) | -136.017 | -3.091 | SINGLE_OBSERVATION |
| layers1-file100MiB | on-already-active | 1367.219(1) | 1538.132(1) | 170.913 | 12.501 | SINGLE_OBSERVATION |
| layers1-file100MiB | off-dirty-refusal | 2380.869(1) | 2554.494(1) | 173.625 | 7.292 | SINGLE_OBSERVATION |
| layers1-file100MiB | recover-empty | 857.908(1) | 860.583(1) | 2.675 | 0.312 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | first-on-register-layer0 | 3197.025(1) | 6669.873(1) | 3472.848 | 108.628 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | on-reactivation-no-cache | 2998.146(1) | 4464.868(1) | 1466.722 | 48.921 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | off | 4162.881(1) | 4293.456(1) | 130.574 | 3.137 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | on-already-active | 1608.379(1) | 1419.058(1) | -189.321 | -11.771 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | off-dirty-refusal | 2745.420(1) | 2900.840(1) | 155.420 | 5.661 | SINGLE_OBSERVATION |
| layers1-files3x32MiB | recover-empty | 988.822(1) | 890.488(1) | -98.334 | -9.945 | SINGLE_OBSERVATION |
| layers5-files100 | first-on-register-layer0 | 2621.378(1) | 5967.078(1) | 3345.700 | 127.631 | SINGLE_OBSERVATION |
| layers5-files100 | first-on-allLayers-sum-API | 20331.020(1) | 36638.265(1) | 16307.245 | 80.209 | SINGLE_OBSERVATION |
| layers5-files100 | on-reactivation-no-cache | 5119.107(1) | 6600.092(1) | 1480.985 | 28.931 | SINGLE_OBSERVATION |
| layers5-files100 | off | 5071.308(1) | 5424.489(1) | 353.180 | 6.964 | SINGLE_OBSERVATION |
| layers5-files100 | on-already-active | 3184.738(1) | 3271.451(1) | 86.713 | 2.723 | SINGLE_OBSERVATION |
| layers5-files100 | off-dirty-refusal | 5061.838(1) | 5108.326(1) | 46.487 | 0.918 | SINGLE_OBSERVATION |
| layers5-files100 | recover-empty | 2920.562(1) | 3020.707(1) | 100.145 | 3.429 | SINGLE_OBSERVATION |
| layers10-files100 | first-on-register-layer0 | 2335.743(1) | 5856.912(1) | 3521.169 | 150.752 | SINGLE_OBSERVATION |
| layers10-files100 | first-on-allLayers-sum-API | 53963.970(1) | 89219.579(1) | 35255.609 | 65.332 | SINGLE_OBSERVATION |
| layers10-files100 | on-reactivation-no-cache | 8046.557(1) | 9403.892(1) | 1357.335 | 16.869 | SINGLE_OBSERVATION |
| layers10-files100 | off | 7777.979(1) | 8086.355(1) | 308.377 | 3.965 | SINGLE_OBSERVATION |
| layers10-files100 | on-already-active | 5347.843(1) | 5558.268(1) | 210.424 | 3.935 | SINGLE_OBSERVATION |
| layers10-files100 | off-dirty-refusal | 8163.981(1) | 8718.769(1) | 554.789 | 6.796 | SINGLE_OBSERVATION |
| layers10-files100 | recover-empty | 5624.829(1) | 6219.496(1) | 594.667 | 10.572 | SINGLE_OBSERVATION |

## Journals e disco

Contagens são observações nos handles do Core instrumentado. Bytes regravados não são espaço adicional retido nem bytes físicos de IO. As durações incluem o custo de observação em ambos os endpoints.

| Fonte/cenário | Operação/amostra | Journal escrito B | Flush de arquivo journal OK/tentativas | Journal lido B | Persist inclusivo ms |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline/layers1-files10 | first-on-register-layer0/1 | 311239 | 33/33 | 0 | 205.720 |
| baseline/layers1-files10 | off/1 | 346126 | 30/30 | 18571 | 178.336 |
| baseline/layers1-files10 | on-reactivation-no-cache/1 | 269946 | 29/29 | 40244 | 168.034 |
| baseline/layers1-files10 | off/2 | 346126 | 30/30 | 58268 | 180.773 |
| baseline/layers1-files10 | on-reactivation-no-cache/2 | 269946 | 29/29 | 79941 | 167.897 |
| baseline/layers1-files10 | off/3 | 346126 | 30/30 | 97965 | 173.575 |
| baseline/layers1-files10 | on-reactivation-no-cache/3 | 269946 | 29/29 | 119638 | 171.205 |
| baseline/layers1-files100 | first-on-register-layer0/1 | 13252375 | 213/213 | 0 | 1510.007 |
| baseline/layers1-files100 | off/1 | 18326620 | 210/210 | 124237 | 1457.003 |
| baseline/layers1-files100 | on-reactivation-no-cache/1 | 12966457 | 209/209 | 294416 | 1335.682 |
| baseline/layers1-files100 | off/2 | 18326620 | 210/210 | 418107 | 1369.684 |
| baseline/layers1-files100 | on-reactivation-no-cache/2 | 12966457 | 209/209 | 588286 | 1320.240 |
| baseline/layers1-files100 | off/3 | 18326620 | 210/210 | 711977 | 1465.629 |
| baseline/layers1-files100 | on-reactivation-no-cache/3 | 12966457 | 209/209 | 882156 | 1388.176 |
| baseline/layers1-files1000 | first-on-register-layer0/1 | 1193130811 | 2013/2013 | 0 | 23812.520 |
| baseline/layers1-files1000 | off/1 | 1701996244 | 2010/2010 | 1185343 | 26406.925 |
| baseline/layers1-files1000 | on-reactivation-no-cache/1 | 1190392388 | 2009/2009 | 2847728 | 21875.533 |
| baseline/layers1-files1000 | off/2 | 1701996244 | 2010/2010 | 4032526 | 26251.320 |
| baseline/layers1-files1000 | on-reactivation-no-cache/2 | 1190392388 | 2009/2009 | 5694911 | 22999.256 |
| baseline/layers1-files1000 | off/3 | 1701996244 | 2010/2010 | 6879709 | 25759.504 |
| baseline/layers1-files1000 | on-reactivation-no-cache/3 | 1190392388 | 2009/2009 | 8542094 | 20325.998 |
| baseline/layers1-file100MiB | first-on-register-layer0/1 | 63352 | 15/15 | 0 | 120.176 |
| baseline/layers1-file100MiB | off/1 | 44350 | 12/12 | 8044 | 81.247 |
| baseline/layers1-file100MiB | on-reactivation-no-cache/1 | 46463 | 11/11 | 14933 | 60.208 |
| baseline/layers1-files3x32MiB | first-on-register-layer0/1 | 102064 | 19/19 | 0 | 115.639 |
| baseline/layers1-files3x32MiB | off/1 | 88026 | 16/16 | 10382 | 91.228 |
| baseline/layers1-files3x32MiB | on-reactivation-no-cache/1 | 79753 | 15/15 | 20555 | 93.213 |
| baseline/layers5-files100 | first-on-register-layer0/1 | 810795 | 53/53 | 0 | 349.719 |
| baseline/layers5-files100 | off/1 | 1067688 | 50/50 | 157129 | 290.891 |
| baseline/layers5-files100 | on-reactivation-no-cache/1 | 806610 | 49/49 | 196682 | 286.880 |
| baseline/layers10-files100 | first-on-register-layer0/1 | 311806 | 33/33 | 0 | 195.841 |
| baseline/layers10-files100 | off/1 | 434416 | 30/30 | 205789 | 175.524 |
| baseline/layers10-files100 | on-reactivation-no-cache/1 | 354897 | 29/29 | 230522 | 173.560 |
| final/layers1-files10 | first-on-register-layer0/1 | 61455 | 64/64 | 72700 | 267.878 |
| final/layers1-files10 | off/1 | 92997 | 60/60 | 73474 | 265.611 |
| final/layers1-files10 | on-reactivation-no-cache/1 | 51335 | 54/54 | 102257 | 219.817 |
| final/layers1-files10 | off/2 | 92997 | 60/60 | 111178 | 245.173 |
| final/layers1-files10 | on-reactivation-no-cache/2 | 51335 | 54/54 | 139961 | 213.042 |
| final/layers1-files10 | off/3 | 92997 | 60/60 | 148882 | 241.915 |
| final/layers1-files10 | on-reactivation-no-cache/3 | 51335 | 54/54 | 177665 | 223.575 |
| final/layers1-files100 | first-on-register-layer0/1 | 404512 | 424/424 | 485454 | 1788.138 |
| final/layers1-files100 | off/1 | 755450 | 420/420 | 529247 | 1766.852 |
| final/layers1-files100 | on-reactivation-no-cache/1 | 394370 | 414/414 | 768278 | 1742.625 |
| final/layers1-files100 | off/2 | 755450 | 420/420 | 820221 | 1738.155 |
| final/layers1-files100 | on-reactivation-no-cache/2 | 394370 | 414/414 | 1059252 | 1703.449 |
| final/layers1-files100 | off/3 | 755450 | 420/420 | 1111195 | 1752.401 |
| final/layers1-files100 | on-reactivation-no-cache/3 | 394370 | 414/414 | 1350226 | 1676.802 |
| final/layers1-files1000 | first-on-register-layer0/1 | 3850859 | 4024/4024 | 4621868 | 18004.441 |
| final/layers1-files1000 | off/1 | 7415683 | 4020/4020 | 5098560 | 18202.699 |
| final/layers1-files1000 | on-reactivation-no-cache/1 | 3840695 | 4014/4014 | 7448999 | 18198.866 |
| final/layers1-files1000 | off/2 | 7415683 | 4020/4020 | 7933844 | 17939.301 |
| final/layers1-files1000 | on-reactivation-no-cache/2 | 3840695 | 4014/4014 | 10284283 | 18271.658 |
| final/layers1-files1000 | off/3 | 7415683 | 4020/4020 | 10769128 | 18223.051 |
| final/layers1-files1000 | on-reactivation-no-cache/3 | 3840695 | 4014/4014 | 13119567 | 17886.362 |
| final/layers1-files10000 | first-on-register-layer0/1 | 38475906 | 40024/40024 | 46075882 | 215672.699 |
| final/layers1-files10000 | off/1 | 74377716 | 40020/40020 | 50908573 | 212208.972 |
| final/layers1-file100MiB | first-on-register-layer0/1 | 27276 | 28/28 | 31504 | 128.428 |
| final/layers1-file100MiB | off/1 | 27083 | 24/24 | 28003 | 100.327 |
| final/layers1-file100MiB | on-reactivation-no-cache/1 | 17171 | 18/18 | 35844 | 88.443 |
| final/layers1-files3x32MiB | first-on-register-layer0/1 | 34866 | 36/36 | 40656 | 149.854 |
| final/layers1-files3x32MiB | off/1 | 41727 | 32/32 | 38105 | 182.613 |
| final/layers1-files3x32MiB | on-reactivation-no-cache/1 | 24756 | 26/26 | 50598 | 106.741 |
| final/layers5-files100 | first-on-register-layer0/1 | 99619 | 104/104 | 118626 | 438.978 |
| final/layers5-files100 | off/1 | 171813 | 100/100 | 252417 | 420.005 |
| final/layers5-files100 | on-reactivation-no-cache/1 | 91769 | 94/94 | 307304 | 382.548 |
| final/layers10-files100 | first-on-register-layer0/1 | 61536 | 64/64 | 72772 | 290.519 |
| final/layers10-files100 | off/1 | 104589 | 60/60 | 264339 | 245.803 |
| final/layers10-files100 | on-reactivation-no-cache/1 | 56528 | 54/54 | 299224 | 212.284 |
| journal-only/layers1-files1000 | first-on-register-layer0/1 | 3850768 | 4026/4026 | 3441410 | 16998.324 |
| journal-only/layers1-files1000 | off/1 | 7415683 | 4020/4020 | 5098431 | 17422.603 |
| journal-only/layers1-files1000 | on-reactivation-no-cache/1 | 3845955 | 4018/4018 | 6274068 | 18308.083 |

| Fonte/cenário | Setup ms | Disco lógico final B | Backups B | Journals B | Materialized B | Validation indexes B | Initialization indexes B | Private indexes B | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| baseline/layers1-files10 | 610.009 | 183624 | 14714 | 140862 | 10240 | — | — | — | PASS |
| baseline/layers1-files100 | 962.108 | 1318248 | 121192 | 1009047 | 102400 | — | — | — | PASS |
| baseline/layers1-files1000 | 5372.830 | 12707450 | 1188600 | 9730092 | 1024000 | 0 | 0 | 88103 | PASS |
| baseline/layers1-files10000 | — | — | — | — | — | — | — | — | TIMEOUT |
| baseline/layers1-file100MiB | 3676.983 | 524357200 | 104858852 | 25629 | 209715200 | — | — | — | PASS |
| baseline/layers1-files3x32MiB | 3499.325 | 503393248 | 100664940 | 33589 | 201326592 | — | — | — | PASS |
| baseline/layers5-files100 | 2044.591 | 391346 | 30916 | 239810 | 30720 | — | — | — | PASS |
| baseline/layers10-files100 | 4040.229 | 445407 | 47430 | 274579 | 28160 | — | — | — | PASS |
| final/layers1-files10 | 781.750 | 433303 | 11777 | 398091 | 0 | 3916 | 979 | 979 | PASS |
| final/layers1-files100 | 1092.041 | 3337835 | 94489 | 3112492 | 0 | 35604 | 8901 | 8901 | PASS |
| final/layers1-files1000 | 5044.925 | 32557577 | 924291 | 30427313 | 0 | 352412 | 88103 | 88103 | PASS |
| final/layers1-files10000 | — | — | — | — | — | — | — | — | TIMEOUT |
| final/layers1-file100MiB | 3833.542 | 314676669 | 104858667 | 59538 | 0 | 370 | 185 | 185 | PASS |
| final/layers1-files3x32MiB | 3629.211 | 302117392 | 100664579 | 83213 | 0 | 722 | 361 | 361 | PASS |
| final/layers5-files100 | 2264.595 | 748739 | 29057 | 608263 | 0 | 11154 | 9295 | 9295 | PASS |
| final/layers10-files100 | 3787.916 | 824315 | 46451 | 660152 | 0 | 10769 | 9790 | 9790 | PASS |
| journal-only/layers1-files10 | — | — | — | — | — | — | — | — | NOT_RUN |
| journal-only/layers1-files100 | — | — | — | — | — | — | — | — | NOT_RUN |
| journal-only/layers1-files1000 | 4796.862 | 13761586 | 454958 | 12029950 | 512000 | 0 | 0 | 88103 | PASS |
| journal-only/layers1-files10000 | — | — | — | — | — | — | — | — | NOT_RUN |
| journal-only/layers1-file100MiB | — | — | — | — | — | — | — | — | NOT_RUN |
| journal-only/layers1-files3x32MiB | — | — | — | — | — | — | — | — | NOT_RUN |
| journal-only/layers5-files100 | — | — | — | — | — | — | — | — | NOT_RUN |
| journal-only/layers10-files100 | — | — | — | — | — | — | — | — | NOT_RUN |

## Dados de arquivo alocados no endpoint

A versão atual usa lstat BigInt e soma blocks×512, deduplicando dev:ino. O libuv 1.51 converte AllocationSize para blocos de 512 bytes; o Node24.14.1 encaminha esse campo. Isto observa alocação de dados de arquivos, fora dos relógios das APIs. Exclui diretórios, MFT/metadados, ADS, extents CoW compartilhados, IO do dispositivo e picos. Blksize não define a unidade de blocks nem prova clusters. [libuv1.51 fonte](https://github.com/libuv/libuv/blob/v1.51.0/src/win/fs.c#L1772), [Node fonte](https://github.com/nodejs/node/blob/v24.14.1/src/node_file-inl.h#L97).

| Fonte/cenário | Estado | Repo dados alocados B | Journals B | Backups B | Materialized B | Validation indexes B | Initialization indexes B | Private indexes B | Aliases dedup |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline/layers1-files10 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers1-files100 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers1-files1000 | MEASURED | 10321920 | 9744384 | 434176 | 0 | 0 | 0 | 90112 | 0 |
| baseline/layers1-files10000 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers1-file100MiB | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers1-files3x32MiB | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers5-files100 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| baseline/layers10-files100 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| final/layers1-files10 | MEASURED | 462848 | 430080 | 4096 | 0 | 16384 | 4096 | 4096 | 0 |
| final/layers1-files100 | MEASURED | 3248128 | 3137536 | 24576 | 0 | 49152 | 12288 | 12288 | 0 |
| final/layers1-files1000 | MEASURED | 31207424 | 30449664 | 163840 | 0 | 360448 | 90112 | 90112 | 0 |
| final/layers1-files10000 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| final/layers1-file100MiB | MEASURED | 314681344 | 71680 | 104857600 | 0 | 0 | 0 | 0 | 0 |
| final/layers1-files3x32MiB | MEASURED | 302127104 | 96256 | 100663296 | 0 | 0 | 0 | 0 | 0 |
| final/layers5-files100 | MEASURED | 773120 | 634880 | 57856 | 0 | 24576 | 20480 | 20480 | 0 |
| final/layers10-files100 | MEASURED | 969728 | 715264 | 115200 | 0 | 45056 | 40960 | 40960 | 0 |
| journal-only/layers1-files10 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| journal-only/layers1-files100 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| journal-only/layers1-files1000 | MEASURED | 12396544 | 12048384 | 204800 | 0 | 0 | 0 | 90112 | 0 |
| journal-only/layers1-files10000 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| journal-only/layers1-file100MiB | NOT_MEASURED | — | — | — | — | — | — | — | — |
| journal-only/layers1-files3x32MiB | NOT_MEASURED | — | — | — | — | — | — | — | — |
| journal-only/layers5-files100 | NOT_MEASURED | — | — | — | — | — | — | — | — |
| journal-only/layers10-files100 | NOT_MEASURED | — | — | — | — | — | — | — | — |

Validation indexes identifica somente transactions/ID/activation-UUID.index; initialization indexes identifica separadamente transactions/ID/register-UUID.index; índices privados necessários e MAIN são categorias separadas. O JSON conserva os tamanhos lógicos e alocados de cada categoria. V1 não recebeu medidas retroativas. O probe isolado do contador demonstrou que um alias hardlink adiciona 8192 B lógicos e zero alocação contabilizada adicional; não adota hardlinks como cópias independentes nem certifica o produto.


## Recursos observados

RSS do worker em MiB, amostrado a cada 10 ms; inclui o harness e exclui filhos Git. A coluna Git conta processos diretos com PID/tentativas de spawn, sem descendentes. Fases e tempos Git podem se sobrepor; não devem ser somados ao tempo total.

| Fonte/cenário | API/amostra | RSS pico MiB | Git PID/tentativas | Sem PID | Git dur. agregada ms |
| --- | --- | ---: | ---: | ---: | ---: |
| baseline/layers1-files10 | first-on-register-layer0/1 | 60.574 | 46/46 | 0 | 1882.312 |
| baseline/layers1-files10 | off/1 | 71.711 | 44/44 | 0 | 1834.337 |
| baseline/layers1-files10 | on-reactivation-no-cache/1 | 72.973 | 45/45 | 0 | 1921.597 |
| baseline/layers1-files10 | off/2 | 75.836 | 44/44 | 0 | 1768.050 |
| baseline/layers1-files10 | on-reactivation-no-cache/2 | 73.145 | 45/45 | 0 | 1874.378 |
| baseline/layers1-files10 | off/3 | 89.402 | 44/44 | 0 | 1767.259 |
| baseline/layers1-files10 | on-reactivation-no-cache/3 | 91.785 | 45/45 | 0 | 1840.684 |
| baseline/layers1-files100 | first-on-register-layer0/1 | 70.828 | 46/46 | 0 | 1919.007 |
| baseline/layers1-files100 | off/1 | 82.270 | 44/44 | 0 | 1867.972 |
| baseline/layers1-files100 | on-reactivation-no-cache/1 | 95.949 | 45/45 | 0 | 1898.599 |
| baseline/layers1-files100 | off/2 | 108.527 | 44/44 | 0 | 1830.783 |
| baseline/layers1-files100 | on-reactivation-no-cache/2 | 104.543 | 45/45 | 0 | 1926.242 |
| baseline/layers1-files100 | off/3 | 108.156 | 44/44 | 0 | 1878.427 |
| baseline/layers1-files100 | on-reactivation-no-cache/3 | 100.527 | 45/45 | 0 | 1983.134 |
| baseline/layers1-files1000 | first-on-register-layer0/1 | 143.699 | 46/46 | 0 | 3126.561 |
| baseline/layers1-files1000 | off/1 | 176.371 | 44/44 | 0 | 3162.867 |
| baseline/layers1-files1000 | on-reactivation-no-cache/1 | 211.418 | 45/45 | 0 | 3668.587 |
| baseline/layers1-files1000 | off/2 | 182.918 | 44/44 | 0 | 3535.430 |
| baseline/layers1-files1000 | on-reactivation-no-cache/2 | 232.480 | 45/45 | 0 | 3085.351 |
| baseline/layers1-files1000 | off/3 | 216.441 | 44/44 | 0 | 3137.697 |
| baseline/layers1-files1000 | on-reactivation-no-cache/3 | 214.188 | 45/45 | 0 | 3021.869 |
| baseline/layers1-file100MiB | first-on-register-layer0/1 | 56.316 | 46/46 | 0 | 2047.466 |
| baseline/layers1-file100MiB | off/1 | 63.027 | 44/44 | 0 | 2219.779 |
| baseline/layers1-file100MiB | on-reactivation-no-cache/1 | 66.566 | 45/45 | 0 | 1972.680 |
| baseline/layers1-files3x32MiB | first-on-register-layer0/1 | 56.645 | 46/46 | 0 | 2310.784 |
| baseline/layers1-files3x32MiB | off/1 | 63.746 | 44/44 | 0 | 2339.933 |
| baseline/layers1-files3x32MiB | on-reactivation-no-cache/1 | 71.902 | 45/45 | 0 | 1983.500 |
| baseline/layers5-files100 | first-on-register-layer0/1 | 60.645 | 46/46 | 0 | 1935.572 |
| baseline/layers5-files100 | off/1 | 94.281 | 102/102 | 0 | 4185.411 |
| baseline/layers5-files100 | on-reactivation-no-cache/1 | 91.023 | 108/108 | 0 | 4469.189 |
| baseline/layers10-files100 | first-on-register-layer0/1 | 60.926 | 46/46 | 0 | 1972.272 |
| baseline/layers10-files100 | off/1 | 129.195 | 172/172 | 0 | 7132.229 |
| baseline/layers10-files100 | on-reactivation-no-cache/1 | 124.289 | 183/183 | 0 | 7574.595 |
| final/layers1-files10 | first-on-register-layer0/1 | 62.883 | 115/115 | 0 | 5221.450 |
| final/layers1-files10 | off/1 | 70.734 | 44/44 | 0 | 1972.579 |
| final/layers1-files10 | on-reactivation-no-cache/1 | 71.141 | 58/58 | 0 | 2607.511 |
| final/layers1-files10 | off/2 | 84.551 | 44/44 | 0 | 1879.527 |
| final/layers1-files10 | on-reactivation-no-cache/2 | 85.332 | 58/58 | 0 | 2495.710 |
| final/layers1-files10 | off/3 | 88.184 | 44/44 | 0 | 1907.602 |
| final/layers1-files10 | on-reactivation-no-cache/3 | 88.863 | 58/58 | 0 | 2538.336 |
| final/layers1-files100 | first-on-register-layer0/1 | 69.723 | 115/115 | 0 | 5257.090 |
| final/layers1-files100 | off/1 | 72.258 | 44/44 | 0 | 1961.461 |
| final/layers1-files100 | on-reactivation-no-cache/1 | 84.770 | 58/58 | 0 | 2704.048 |
| final/layers1-files100 | off/2 | 89.141 | 44/44 | 0 | 1955.123 |
| final/layers1-files100 | on-reactivation-no-cache/2 | 90.094 | 58/58 | 0 | 2670.870 |
| final/layers1-files100 | off/3 | 91.906 | 44/44 | 0 | 2009.795 |
| final/layers1-files100 | on-reactivation-no-cache/3 | 116.496 | 58/58 | 0 | 2539.612 |
| final/layers1-files1000 | first-on-register-layer0/1 | 97.711 | 115/115 | 0 | 6870.987 |
| final/layers1-files1000 | off/1 | 136.121 | 44/44 | 0 | 2821.178 |
| final/layers1-files1000 | on-reactivation-no-cache/1 | 177.656 | 58/58 | 0 | 3392.118 |
| final/layers1-files1000 | off/2 | 198.105 | 44/44 | 0 | 2745.735 |
| final/layers1-files1000 | on-reactivation-no-cache/2 | 199.555 | 58/58 | 0 | 3322.846 |
| final/layers1-files1000 | off/3 | 216.426 | 44/44 | 0 | 2946.319 |
| final/layers1-files1000 | on-reactivation-no-cache/3 | 220.137 | 58/58 | 0 | 3407.542 |
| final/layers1-files10000 | first-on-register-layer0/1 | 215.234 | 115/115 | 0 | 12163.445 |
| final/layers1-files10000 | off/1 | 218.949 | 44/44 | 0 | 11163.325 |
| final/layers1-file100MiB | first-on-register-layer0/1 | 62.121 | 115/115 | 0 | 5345.893 |
| final/layers1-file100MiB | off/1 | 70.410 | 44/44 | 0 | 2375.775 |
| final/layers1-file100MiB | on-reactivation-no-cache/1 | 70.387 | 58/58 | 0 | 2656.116 |
| final/layers1-files3x32MiB | first-on-register-layer0/1 | 63.016 | 115/115 | 0 | 5390.694 |
| final/layers1-files3x32MiB | off/1 | 71.297 | 44/44 | 0 | 2318.531 |
| final/layers1-files3x32MiB | on-reactivation-no-cache/1 | 71.434 | 58/58 | 0 | 2624.925 |
| final/layers5-files100 | first-on-register-layer0/1 | 66.035 | 115/115 | 0 | 5487.260 |
| final/layers5-files100 | off/1 | 72.516 | 102/102 | 0 | 4332.155 |
| final/layers5-files100 | on-reactivation-no-cache/1 | 74.016 | 121/121 | 0 | 5353.692 |
| final/layers10-files100 | first-on-register-layer0/1 | 63.109 | 115/115 | 0 | 5540.903 |
| final/layers10-files100 | off/1 | 121.805 | 172/172 | 0 | 7309.447 |
| final/layers10-files100 | on-reactivation-no-cache/1 | 120.551 | 196/196 | 0 | 8488.984 |
| journal-only/layers1-files1000 | first-on-register-layer0/1 | 95.453 | 46/46 | 0 | 2721.213 |
| journal-only/layers1-files1000 | off/1 | 138.316 | 44/44 | 0 | 2582.675 |
| journal-only/layers1-files1000 | on-reactivation-no-cache/1 | 164.891 | 45/45 | 0 | 2541.407 |

O disco lógico total inclui toda a fixture (objetos Git, workspace, HOME isolado, índices de seeding e transações). Backups, journals e materialized são subtotais do repositório; nenhum deles é pico medido, ocupação física ou quota.


## Escala de dez mil arquivos

A baseline atingiu o limite de 180.000 ms do worker, incluindo setup: duração externa 180.165 ms, sem ativação completa. O setup aproximado pela linha do tempo foi 41.289 ms; os 137.335 ms observados até o recibo do timeout não são latência de ativação concluída. O inventário preservou 2.020 arquivos parcialmente publicados e 10.000 extraídos, sem aprovação do cenário.

O final atingiu o limite de 1.200.000 ms do worker, também incluindo setup e oráculos: duração externa 1.200.245 ms. O cenário inteiro é TIMEOUT, mas seus arquivos finais de amostras e provas registram duas APIs completas:

| Operação de dez mil arquivos | Duração completa ms | n | Prova independente |
| --- | ---: | ---: | --- |
| Primeira ativação com registro | 501009,5665 | 1 | 10.000 blobs físicos conferidos pelo Git; HEAD, refs de branches e índice MAIN semântico preservados |
| Desativação limpa | 625864,5758 | 1 | 10.000 ausências conferidas; HEAD, refs de branches e índice MAIN semântico preservados |
| Reativação | — | 0 concluídas | Iniciou e foi interrompida pelo limite; nenhum tempo completo atribuído |

A baseline incompleta impede delta pareado nessa escala. A primeira comunicação provisória do timeout usou a cauda anterior ao limite e dizia que a desativação ainda não havia concluído. Os arquivos append-only finais corrigem essa informação: a prova de desativação foi registrada às 21:43:35.112 UTC; a reativação começou às 21:43:35.113 UTC. A correção permanece explícita no [recibo de linha do tempo](BENCHMARKS-10K-TIMELINE.json).

A publicação foi progressiva. Entre os 10.000 caminhos esperados do worktree, excluindo metadados .git, o primeiro write-completed está 34.699 ms após o início UTC; o último, 450.958 ms; e a conclusão do journal, 452.145 ms. São limites superiores aproximados registrados depois da publicação/verificação, não medições do primeiro instante de visibilidade ou da interface. Os relógios UTC e monotônico não têm sincronização comprovada. A API só retornou após 501.009,5665 ms, incluindo verificações e limpeza posterior; a Layer inteira não é publicada atomicamente por um único rename.

O [inventário posterior ao timeout](BENCHMARKS-10K-INVENTORY.json) encontrou zero arquivos da Layer no worktree, 104.250.780 bytes lógicos no repositório e 96.380.928 bytes de dados de arquivo alocados. É o estado preservado da reativação pendente, não um endpoint saudável concluído nem pico de disco. A rotina de encerramento do runner informou tree_exit 0 e descendant_tree_confirmed true; não houve fechamento forçado dos streams. Journals, backups e locks foram preservados; não foi executada recuperação ou limpeza para produzir esta evidência.

O helper externo de pós-processamento teve uma falha inicial antes de gravar dados e outra somente no log final, depois de gerar os recibos. Ambos os processos saíram com código 1. Uma leitura independente posterior validou os arquivos persistidos e seus hashes. Geração e validação são resultados separados no [recibo de controles/calibração](BENCHMARKS-CONTROLS-CALIBRATION.json); nenhum exit foi retroativamente convertido em sucesso.

Nos cenários finais, cada ativação/desativação concluída possui recibo em operationProofs: HEAD/refs de branches/índice MAIN semântico e blobs Git ou ausências, verificados fora do relógio. Um timeout posterior conserva esses recibos, mas mantém o cenário inteiro incompleto. A baseline possui os oráculos finais originais; os extras do v2 são explicitamente separados.


Em 5/10 Layers há 100 arquivos no total. On/off do alvo bench0 move 20/10 arquivos com 4/9 outras Layers ativas. First-on-register-layer0 mede apenas a primeira origem, com as demais ainda inativas. First-on-allLayers-sum-API soma os tempos completos das 5/10 chamadas iniciais; exclui setup e oráculos entre chamadas e não é uma operação atômica única.


## Calibração sem instrumentação

A campanha nova de mil arquivos executou somente relógios em torno das APIs completas, em ordem baseline/final, com uma fixture nova por fonte e uma observação por operação. Os oráculos Git ficam fora do relógio. Não há contadores de filesystem, subprocessos, fases ou RSS nessa campanha; os campos correspondentes são null no [recibo público](BENCHMARKS-CONTROLS-CALIBRATION.json).

| Mil arquivos, clock-only n1 | Baseline ms | Final ms |
| --- | ---: | ---: |
| Primeira ativação | 38693,7018 | 47639,4777 |
| Desativação | 56045,8257 | 43052,0460 |
| Reativação | 39883,8045 | 41644,5584 |

A primeira ativação e a reativação também regrediram nessas observações; a desativação melhorou. A primeira ativação final sem profiler não foi menor que a observação instrumentada separada. Portanto, não se deriva correção fixa de overhead, nem se desconta um percentual dos 501 segundos. Não se misturam n1 e n3. A medição anterior do candidato, invalidada quando o uso interativo foi retomado, permanece somente no recibo intermediário.

## Controles de implementação

Os controles instrumentados abaixo têm n1, fontes externas congeladas e oráculos próprios. O [recibo](BENCHMARKS-CONTROLS-CALIBRATION.json) inclui hashes exatos, amostras e comparações de primeiro ciclo; eles não são somados à campanha principal.

| Controle de mil arquivos, n1 | Primeira ativação ms | Desativação ms | Reativação ms |
| --- | ---: | ---: | ---: |
| Final com somente paths.ts da baseline | 48677,7090 | 43491,1634 | 46879,4749 |
| Baseline com somente journal novo e glue tipado | 34419,4394 | 44649,3924 | 36353,6292 |

O controle de paths mantém todas as demais mudanças do final. Seus resultados são mistos: a desativação ficou abaixo da mediana final. O microbenchmark de normalização não comprova melhoria universal da API completa. O segundo controle conserva as lacunas de integridade históricas omitidas pela baseline e é um contrafactual explicitamente inseguro para adoção. Ele usa storage e5 sem a mudança de buffer, isolando a arquitetura do journal; seu PASS de fixture não certifica segurança.

O [controle pareado do buffer](BENCHMARKS-BUFFER-CONTROL.json) executou n3 de ciclos na mesma fixture por variante, com primeira ativação n1. Original/buffer: 48.586/47.320 ms na primeira ativação; medianas 48.319/46.977 ms para desativar e 45.542/44.679 ms para reativar. São diferenças observadas de cerca de 2–3%, com ordem fixa e sem confiança estatística. Bytes de journal, número de syncs e armazenamento final foram iguais. O máximo de RSS da vida do worker foi 253.038.592/231.690.240 bytes, mas os máximos de algumas APIs aumentaram; não existe redução uniforme nem contador acumulado de capacidade alocada.

Antes desse ajuste de buffer, o controle de limpeza em um arquivo de 100 MiB mostrou 209.715.200 bytes adicionais de extrações retidas sem limpeza após duas ativações. Os dois controles tinham o mesmo número de ciclos. Seus tempos n1 e fingerprints permanecem no recibo intermediário. A política final mantém a limpeza segura; essa observação anterior não é apresentada como nova medição da combinação final sem limpeza.

## Fontes e limites

- baseline: Core SHA-256 `23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb`; runner `aefb70d07643360b4852efee14065705ba8995579bddbd070956bfaed1848209`.
- final: Core SHA-256 `fa684f0c1e741d961e5f683c2159d26aed15fd9dc3d1f2a382754648aa692aac`; runner `7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761`.
- journal-only: Core SHA-256 `f79285a165f198a5621a5ef246843ec91c6191b60cb7937edf28a938e00756c8`; runner `7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761`.
- Baseline1000 principal: Core `23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb`; runner `7800196cefe33e3f6768864beccde7d47d03b53ce615cabd786bdc79e8a40761`; n3, v2; v1 n1 separado em supplementaryCampaigns.

- Complete Core API calls; no CLI startup. Source and observer bundle frozen per phase. Older v1 baseline and current observer differ only in observation (tip classification, compiler provenance, per operation native Git proofs, endpoint allocated file data, final 1000 n3). Controlled primary 1000 baseline uses the same current observer as final.
- First activation includes first registration and is one observation per case. Reactivation is extraction again; no projection cache exists.
- Baseline 10/100 reactivation/off n3; primary1000 baseline v2 n3 and final1000 n3 where completed. Earlier v1 n1 is supplementary, never pooled. First activation and large/multilayer cases remain n1; no p95 or statistical significance.
- Fixed baseline-then-final order, filesystem warm after setup, no OS cache eviction, and unmeasured host load limit causal attribution.
- Filesystem observers count known successful bytes at JavaScript FileHandle/filesystem boundaries, including repeated journal writes; not physical device IO.
- Native fs.copyFile returns void: its byte counter remains 0 (unknown payload), even on success. Git checkout-index IO is outside the JS filesystem observer. These zeros never prove absence of copies.
- Directory fsync attempts and failures remain separate. Windows can reject directory flush; file flush success does not establish power-loss durability of all names.
- Method phases are inclusive and overlap; do not add phase durations. Hash validation is included in materialize/diskSnapshot/copy/publish and IO calls, with no exclusive CPU timer.
- Worker RSS sampled every 10 ms omits shorter peaks and child Git RSS; includes harness/oracle allocations. Endpoint logical and OS-reported file-data allocated bytes are separate; neither is peak disk or full physical volume cost.
- Git spawn attempts, children with PID, and failures without PID are separated; descendants of Git/wrappers are unobserved.
- Benchmark DriveInfo observed C: NTFS; its earlier Get-Volume/fsutil probes were denied. A later independent campaign Get-Volume receipt (PUBLICATION-FOCUSED.json) confirmed 4096-byte allocation units. Current observer measures endpoint OS-reported file-data allocation via blocks*512; v1 endpoints remain NOT_MEASURED; unique extents/full volume cost remain unmeasured.
- Timeout/incomplete endpoints retain samples without claiming complete activation or a comparative speedup. Fixtures for failures are retained externally.
- Performance PASS includes independent Git/physical state oracles in the harness; functional certification comes from separate adversarial/regression suites.

Amostras, condições, oráculos nativos, contadores por syscall, Git direto e fases inclusivas constam de [BENCHMARKS.json](BENCHMARKS.json). Cache ausente/inválido e volumes alternativos não recebem números fictícios: não há cache de projeção no produto. Não se atribui medição de reflink ou rename de diretório a estes tempos.

O gerador-base permanece identificado por hash no JSON. As qualificações adicionais, links e a seção de dez mil arquivos foram pós-processadas somente como documentação/dados; os payloads de fases, amostras e comparações do gerador foram preservados byte a byte em sua representação JSON canônica.
