# Benchmarks finais V9

Projeção da campanha encerrada; tempos do Core instrumentado, sem startup completo da CLI. O JSON preserva amostras, recursos, subprocessos e recibos.

- Baseline: d71ccc7d188500a22e56ea93c70ac946dba9db60.
- Fonte final: Core18 23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb; commit final ainda não atribuído.
- Estado: PARTIAL_OR_FAILED; orçamento real: 150 min; limite de endpoint n1: 20 min.
- n1: observação única; mediana, dispersão e p95 nulos. n3: mediana/min/máx/MAD, sem p95.
- Deltas só existem quando ambos endpoints PASS têm oráculos completos, amostras e ambiente equivalentes.
- Ordem fixa, cache aquecido após setup e variação temporal impedem atribuição causal a uma alteração isolada.

## Ativação e desativação

| Cenário | Layers / arquivos totais nas Layers | Alvo / outras ativas | Operação | Baseline ms | V9 ms | Δ % | Git direto antes → depois | Qualificação |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| layers1-files10 | 1 / 10 | 10 / 0 | on | 4383.865 | 3284.379 | -25.080 | [66,66,66] → [45,45,45] | MEASURED_LOWER_LATENCY |
| layers1-files10 | 1 / 10 | 10 / 0 | off | 4481.254 | 3534.588 | -21.125 | [67,67,67] → [44,44,44] | MEASURED_LOWER_LATENCY |
| layers1-files10 | 1 / 10 | 10 / 0 | on-repeat | 2764.382 | 2273.620 | -17.753 | [49,49,49] → [34,34,34] | MEASURED_LOWER_LATENCY |
| layers1-file1MiB | 1 / 1 | 1 / 0 | on | 4164.509 | 2903.431 | -30.282 | [66,66,66] → [45,45,45] | MEASURED_LOWER_LATENCY |
| layers1-file1MiB | 1 / 1 | 1 / 0 | off | 4198.436 | 2760.176 | -34.257 | [67,67,67] → [44,44,44] | MEASURED_LOWER_LATENCY |
| layers1-file1MiB | 1 / 1 | 1 / 0 | on-repeat | 3057.119 | 1857.089 | -39.254 | [49,49,49] → [34,34,34] | MEASURED_LOWER_LATENCY |
| layers1-file32MiB | 1 / 1 | 1 / 0 | on | 4387.076 | 2870.621 | -34.566 | [66] → [45] | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | 1 / 1 | 1 / 0 | off | 4808.592 | 3173.209 | -34.010 | [67] → [44] | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | 1 / 1 | 1 / 0 | on-repeat | 2807.817 | 1747.951 | -37.747 | [49] → [34] | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | 1 / 1 | 1 / 0 | on | 4358.046 | 3608.217 | -17.206 | [66] → [45] | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | 1 / 1 | 1 / 0 | off | 5332.464 | 4736.787 | -11.171 | [67] → [44] | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | 1 / 1 | 1 / 0 | on-repeat | 2617.273 | 1829.162 | -30.112 | [49] → [34] | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | 1 / 1000 | 1000 / 0 | on | 42508.063 | 37197.750 | -12.492 | [66] → [45] | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | 1 / 1000 | 1000 / 0 | off | 54151.235 | 49110.775 | -9.308 | [67] → [44] | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | 1 / 1000 | 1000 / 0 | on-repeat | 3068.981 | 2269.046 | -26.065 | [49] → [34] | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | 2 / 100 | 50 / 1 | on | 7609.180 | 6312.991 | -17.035 | [92] → [63] | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | 2 / 100 | 50 / 1 | off | 7547.976 | 6321.064 | -16.255 | [88] → [60] | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | 2 / 100 | 50 / 1 | on-repeat | 3910.464 | 2925.697 | -25.183 | [60] → [44] | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | 5 / 100 | 20 / 4 | on | 8349.598 | 8657.358 | 3.686 | [155] → [108] | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | 5 / 100 | 20 / 4 | off | 8216.517 | 7889.117 | -3.985 | [145] → [102] | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | 5 / 100 | 20 / 4 | on-repeat | 4716.330 | 5573.542 | 18.175 | [93] → [74] | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | 10 / 100 | 10 / 9 | on | 15887.643 | 9334.639 | -41.246 | [260] → [183] | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | 10 / 100 | 10 / 9 | off | 13588.497 | 8909.039 | -34.437 | [240] → [172] | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | 10 / 100 | 10 / 9 | on-repeat | 8430.393 | 5995.041 | -28.888 | [148] → [124] | SINGLE_OBSERVATION_ONLY |
| layers1-files10000 | 1 / 10000 | 10000 / 0 | on | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | 1 / 10000 | 10000 / 0 | off | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | 1 / 10000 | 10000 / 0 | on-repeat | — | — | — | — | NOT_COMPARABLE |

## Todas as operações observadas e planejadas

| Cenário | Operação | Baseline ms (n) | V9 ms (n) | Δ ms | Δ % | Resultado |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| layers0-files10 | init | 1884.953 (1) | 1231.044 (1) | -653.909 | -34.691 | SINGLE_OBSERVATION_ONLY |
| layers0-files10 | open | 262.230 (3) | 149.715 (3) | -112.515 | -42.907 | MEASURED_LOWER_LATENCY |
| layers0-files10 | status | 2445.483 (3) | 1861.884 (3) | -583.599 | -23.864 | MEASURED_LOWER_LATENCY |
| layers0-files10 | list | 232.179 (3) | 140.776 (3) | -91.403 | -39.368 | MEASURED_LOWER_LATENCY |
| layers0-files10 | excludes | 0.014 (3) | 0.013 (3) | -0.001 | — | INCONCLUSIVE_LIMITED_SAMPLE_OR_TIMER |
| layers0-files10 | recover-empty | 282.978 (3) | 348.117 (3) | 65.138 | 23.019 | MEASURED_HIGHER_LATENCY |
| layers1-files10 | init | 1939.647 (1) | 1160.927 (1) | -778.719 | -40.147 | SINGLE_OBSERVATION_ONLY |
| layers1-files10 | first-on-register-layer0 | 3966.645 (1) | 2868.823 (1) | -1097.823 | -27.676 | SINGLE_OBSERVATION_ONLY |
| layers1-files10 | open | 258.878 (3) | 176.880 (3) | -81.999 | -31.675 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-files10 | status | 6596.003 (3) | 5069.284 (3) | -1526.719 | -23.146 | MEASURED_LOWER_LATENCY |
| layers1-files10 | list | 142.136 (3) | 135.221 (3) | -6.916 | -4.866 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-files10 | excludes | 275.981 (3) | 181.078 (3) | -94.903 | -34.388 | MEASURED_LOWER_LATENCY |
| layers1-files10 | recover-empty | 1396.959 (3) | 1054.548 (3) | -342.410 | -24.511 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-files10 | on-repeat | 2764.382 (3) | 2273.620 (3) | -490.762 | -17.753 | MEASURED_LOWER_LATENCY |
| layers1-files10 | preview-off | 3285.077 (3) | 2459.657 (3) | -825.420 | -25.126 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-files10 | off | 4481.254 (3) | 3534.588 (3) | -946.666 | -21.125 | MEASURED_LOWER_LATENCY |
| layers1-files10 | on | 4383.865 (3) | 3284.379 (3) | -1099.486 | -25.080 | MEASURED_LOWER_LATENCY |
| layers1-files10 | edit | 5192.905 (3) | 3441.719 (3) | -1751.186 | -33.723 | MEASURED_LOWER_LATENCY |
| layers1-files10 | edit-end | 4064.827 (3) | 2328.901 (3) | -1735.926 | -42.706 | MEASURED_LOWER_LATENCY |
| layers1-files10 | add | 6174.697 (3) | 4282.857 (3) | -1891.840 | -30.639 | MEASURED_LOWER_LATENCY |
| layers1-files10 | commit | 4888.576 (3) | 3895.269 (3) | -993.307 | -20.319 | MEASURED_LOWER_LATENCY |
| layers1-files10 | on-repeat-disk-C | 3182.975 (3) | 2309.058 (3) | -873.917 | -27.456 | MEASURED_LOWER_LATENCY |
| layers1-files10 | off-dirty-refusal | 3955.464 (3) | 3278.630 (3) | -676.834 | -17.111 | MEASURED_LOWER_LATENCY |
| layers1-files10 | switch-other | 5819.778 (3) | 4121.714 (3) | -1698.064 | -29.177 | MEASURED_LOWER_LATENCY |
| layers1-files10 | switch-main | 5462.194 (3) | 3948.125 (3) | -1514.068 | -27.719 | MEASURED_LOWER_LATENCY |
| layers1-files10 | off-interrupted | 4427.428 (1) | 3685.670 (1) | -741.758 | -16.754 | SINGLE_OBSERVATION_ONLY |
| layers1-files10 | recover-interrupted-off | 1688.282 (1) | 1678.415 (1) | -9.868 | -0.584 | SINGLE_OBSERVATION_ONLY |
| layers1-files10 | recover-idempotent | 1746.149 (1) | 1798.215 (1) | 52.066 | 2.982 | SINGLE_OBSERVATION_ONLY |
| layers1-file1MiB | init | 2083.155 (1) | 1510.512 (1) | -572.643 | -27.489 | SINGLE_OBSERVATION_ONLY |
| layers1-file1MiB | first-on-register-layer0 | 3854.366 (1) | 2812.679 (1) | -1041.687 | -27.026 | SINGLE_OBSERVATION_ONLY |
| layers1-file1MiB | open | 285.500 (3) | 238.039 (3) | -47.461 | -16.624 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-file1MiB | status | 7132.604 (3) | 5153.123 (3) | -1979.481 | -27.753 | MEASURED_LOWER_LATENCY |
| layers1-file1MiB | list | 140.503 (3) | 227.674 (3) | 87.171 | 62.043 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-file1MiB | excludes | 269.439 (3) | 282.206 (3) | 12.767 | 4.738 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-file1MiB | recover-empty | 1117.344 (3) | 1092.030 (3) | -25.314 | -2.266 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-file1MiB | on-repeat | 3057.119 (3) | 1857.089 (3) | -1200.030 | -39.254 | MEASURED_LOWER_LATENCY |
| layers1-file1MiB | preview-off | 3322.759 (3) | 2711.020 (3) | -611.739 | -18.411 | INCONCLUSIVE_OVERLAPPING_RANGES |
| layers1-file1MiB | off | 4198.436 (3) | 2760.176 (3) | -1438.260 | -34.257 | MEASURED_LOWER_LATENCY |
| layers1-file1MiB | on | 4164.509 (3) | 2903.431 (3) | -1261.078 | -30.282 | MEASURED_LOWER_LATENCY |
| layers1-file32MiB | init | 2041.474 (1) | 1274.114 (1) | -767.360 | -37.589 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | first-on-register-layer0 | 4088.044 (1) | 3337.283 (1) | -750.762 | -18.365 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | open | 272.406 (1) | 152.431 (1) | -119.975 | -44.043 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | status | 6157.868 (1) | 5023.074 (1) | -1134.794 | -18.428 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | list | 143.650 (1) | 134.615 (1) | -9.035 | -6.289 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | excludes | 177.730 (1) | 176.477 (1) | -1.253 | -0.705 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | recover-empty | 1126.908 (1) | 1097.059 (1) | -29.849 | -2.649 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | on-repeat | 2807.817 (1) | 1747.951 (1) | -1059.866 | -37.747 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | preview-off | 2917.511 (1) | 2373.895 (1) | -543.616 | -18.633 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | off | 4808.592 (1) | 3173.209 (1) | -1635.384 | -34.010 | SINGLE_OBSERVATION_ONLY |
| layers1-file32MiB | on | 4387.076 (1) | 2870.621 (1) | -1516.455 | -34.566 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | init | 1904.786 (1) | 1303.397 (1) | -601.390 | -31.573 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | first-on-register-layer0 | 4660.664 (1) | 3609.804 (1) | -1050.860 | -22.547 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | open | 281.414 (1) | 239.235 (1) | -42.179 | -14.988 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | status | 6615.391 (1) | 5440.205 (1) | -1175.186 | -17.764 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | list | 138.083 (1) | 139.372 (1) | 1.289 | 0.934 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | excludes | 179.665 (1) | 269.025 (1) | 89.360 | 49.737 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | recover-empty | 1184.169 (1) | 1088.684 (1) | -95.485 | -8.063 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | on-repeat | 2617.273 (1) | 1829.162 (1) | -788.111 | -30.112 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | preview-off | 2911.462 (1) | 2745.919 (1) | -165.542 | -5.686 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | off | 5332.464 (1) | 4736.787 (1) | -595.677 | -11.171 | SINGLE_OBSERVATION_ONLY |
| layers1-file100MiB | on | 4358.046 (1) | 3608.217 (1) | -749.829 | -17.206 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | init | 2423.743 (1) | 1454.537 (1) | -969.206 | -39.988 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | first-on-register-layer0 | 43746.149 (1) | 37141.758 (1) | -6604.392 | -15.097 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | open | 346.515 (1) | 234.324 (1) | -112.191 | -32.377 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | status | 7866.119 (1) | 6699.743 (1) | -1166.376 | -14.828 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | list | 228.574 (1) | 136.970 (1) | -91.604 | -40.076 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | excludes | 203.846 (1) | 301.153 (1) | 97.307 | 47.735 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | recover-empty | 1308.137 (1) | 1194.030 (1) | -114.107 | -8.723 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | on-repeat | 3068.981 (1) | 2269.046 (1) | -799.935 | -26.065 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | preview-off | 3422.726 (1) | 3671.188 (1) | 248.462 | 7.259 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | off | 54151.235 (1) | 49110.775 (1) | -5040.460 | -9.308 | SINGLE_OBSERVATION_ONLY |
| layers1-files1000 | on | 42508.063 (1) | 37197.750 (1) | -5310.313 | -12.492 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | init | 2587.866 (1) | 1694.021 (1) | -893.846 | -34.540 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | first-on-register-layer0 | 6089.953 (1) | 4378.175 (1) | -1711.778 | -28.108 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | first-on-register-layer1 | 7877.031 (1) | 5681.923 (1) | -2195.108 | -27.867 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | open | 364.489 (1) | 231.921 (1) | -132.569 | -36.371 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | status | 10146.445 (1) | 8207.145 (1) | -1939.300 | -19.113 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | list | 223.343 (1) | 223.508 (1) | 0.165 | 0.074 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | excludes | 358.346 (1) | 442.431 (1) | 84.085 | 23.465 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | recover-empty | 2361.797 (1) | 2198.358 (1) | -163.439 | -6.920 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | on-repeat | 3910.464 (1) | 2925.697 (1) | -984.767 | -25.183 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | preview-off | 4221.866 (1) | 3356.749 (1) | -865.118 | -20.491 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | off | 7547.976 (1) | 6321.064 (1) | -1226.912 | -16.255 | SINGLE_OBSERVATION_ONLY |
| layers2-files100 | on | 7609.180 (1) | 6312.991 (1) | -1296.188 | -17.035 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | init | 3232.320 (1) | 2134.430 (1) | -1097.890 | -33.966 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | first-on-register-layer0 | 5885.322 (1) | 4324.064 (1) | -1561.257 | -26.528 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | first-on-register-layer1 | 5413.454 (1) | 6431.421 (1) | 1017.967 | 18.804 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | first-on-register-layer2 | 6382.682 (1) | 6998.889 (1) | 616.207 | 9.654 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | first-on-register-layer3 | 7478.846 (1) | 9742.368 (1) | 2263.522 | 30.266 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | first-on-register-layer4 | 8404.574 (1) | 9561.353 (1) | 1156.779 | 13.764 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | open | 172.526 (1) | 427.997 (1) | 255.471 | 148.076 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | status | 11300.851 (1) | 15826.418 (1) | 4525.567 | 40.046 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | list | 145.640 (1) | 226.408 (1) | 80.767 | 55.457 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | excludes | 680.510 (1) | 989.999 (1) | 309.489 | 45.479 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | recover-empty | 3548.197 (1) | 4895.214 (1) | 1347.018 | 37.963 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | on-repeat | 4716.330 (1) | 5573.542 (1) | 857.212 | 18.175 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | preview-off | 4347.805 (1) | 5358.093 (1) | 1010.288 | 23.237 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | off | 8216.517 (1) | 7889.117 (1) | -327.399 | -3.985 | SINGLE_OBSERVATION_ONLY |
| layers5-files100 | on | 8349.598 (1) | 8657.358 (1) | 307.760 | 3.686 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | init | 2505.207 (1) | 1601.146 (1) | -904.061 | -36.087 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer0 | 3739.669 (1) | 2632.668 (1) | -1107.001 | -29.602 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer1 | 5096.759 (1) | 3578.152 (1) | -1518.607 | -29.796 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer2 | 6126.035 (1) | 4235.906 (1) | -1890.128 | -30.854 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer3 | 7140.974 (1) | 5030.250 (1) | -2110.724 | -29.558 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer4 | 8234.153 (1) | 5760.220 (1) | -2473.933 | -30.045 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer5 | 9566.376 (1) | 6470.159 (1) | -3096.217 | -32.366 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer6 | 10763.458 (1) | 7280.108 (1) | -3483.350 | -32.363 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer7 | 13392.551 (1) | 8081.632 (1) | -5310.919 | -39.656 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer8 | 14454.695 (1) | 8834.673 (1) | -5620.023 | -38.880 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | first-on-register-layer9 | 14911.086 (1) | 9542.132 (1) | -5368.954 | -36.006 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | open | 324.186 (1) | 237.447 (1) | -86.739 | -26.756 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | status | 20267.333 (1) | 17430.948 (1) | -2836.385 | -13.995 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | list | 146.389 (1) | 141.766 (1) | -4.623 | -3.158 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | excludes | 1223.514 (1) | 1064.489 (1) | -159.025 | -12.997 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | recover-empty | 6913.826 (1) | 6360.407 (1) | -553.419 | -8.005 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | on-repeat | 8430.393 (1) | 5995.041 (1) | -2435.352 | -28.888 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | preview-off | 7110.660 (1) | 5570.207 (1) | -1540.453 | -21.664 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | off | 13588.497 (1) | 8909.039 (1) | -4679.459 | -34.437 | SINGLE_OBSERVATION_ONLY |
| layers10-files100 | on | 15887.643 (1) | 9334.639 (1) | -6553.005 | -41.246 | SINGLE_OBSERVATION_ONLY |
| layers1-files10000 | init | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | first-on-register-layer0 | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | open | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | status | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | list | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | excludes | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | recover-empty | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | on-repeat | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | preview-off | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | off | — | — | — | — | NOT_COMPARABLE |
| layers1-files10000 | on | — | — | — | — | NOT_COMPARABLE |

## Cobertura

| Cenário | Baseline | V9 |
| --- | --- | --- |
| layers0-files10 | PASS | PASS |
| layers1-files10 | PASS | PASS |
| layers1-file1MiB | PASS | PASS |
| layers1-file32MiB | PASS | PASS |
| layers1-file100MiB | PASS | PASS |
| layers1-files1000 | PASS | PASS |
| layers2-files100 | PASS | PASS |
| layers5-files100 | PASS | PASS |
| layers10-files100 | PASS | PASS |
| layers1-files10000 | TIMEOUT_OWNED | TIMEOUT_OWNED |

## Custos e recursos

Os detalhes por amostra estão em BENCHMARKS.json: subprocessos Git diretos com PID, tentativas observadas e falhas sem PID, duração por comando, bytes de stdout/stderr, RSS do worker, payload lógico materializado/retirado e fases inclusivas.
Descendentes de lançadores Git e RSS dos filhos não foram observados. V3 pode omitir tentativas que lançam erro síncrono antes do registro; V4 registra antes do spawn. Contagem direta não equivale ao total de processos do sistema.
Durações de métodos podem conter umas às outras: não somar fases. Walks, hashing, fsync, helpers de índices e queryIndexTree não têm tempos exclusivos próprios. backupTracked não foi envelopado: contador backup ausente/zero não prova ausência de backups ou cópias.
Bytes lógicos conhecidos não são IO físico. Discos foram observados entre endpoints; tamanho final e limites nessas fronteiras não provam pico, alocação física ou quota instantânea. RSS amostrado a cada 10 ms pode perder picos menores.
Nos cenários 2/5/10 Layers há 100 arquivos no total: on/off do alvo move 50/20/10 arquivos, com as demais Layers ativas. Não é curva pura de quantidade de Layers.
O primeiro processo não representa cache frio do SO. Compilador: versão de execução não registrada; bundles e lockfiles são identificados por hashes, sem inferir versão instalada depois.

## Segurança e limites

PASS exige encerramento normal externo/interno, fluxos sem truncamento, resultado PASS, oráculos nativos finais e fonte inalterada. TIMEOUT_OWNED e NOT_RUN permanecem incompletos e sem delta pareado. Observações parciais constam apenas do JSON com seu estado.
O benchmark verifica HEAD, branch, índice MAIN semântico, blobs originais, ausências ao desativar, prévia e B/C/recuperação no caso específico 1L10. A certificação funcional completa depende das suítes separadas; não é inferida desses tempos.
Sem validação Linux, perda real de energia, proteção opt-in nas medições, ablação individual ou significância estatística de n1. Evidências históricas e fixtures incompletas permanecem preservadas.

## Distribuição dos detalhes por cenário

Este Markdown conserva integralmente o prefixo da projeção original. Apenas esta seção editorial foi acrescentada; nenhum tempo, contador, estado ou comparação foi recalculado.
O BENCHMARKS.json desta distribuição é um índice compacto: sourceMetadata preserva todos os campos originais fora de cases; cases mantém todas as comparações e referências aos dez casos integrais.
Os detalhes incluem endpoints incompletos e timeouts, preservados com seus estados. Nenhum endpoint recebeu nova aprovação.
A prova de remontagem estrutural, os hashes e tamanhos dos arquivos estão em [BENCHMARKS-SHARDS.json](BENCHMARKS-SHARDS.json). O JSON integral original permanece preservado sob seu SHA256 35694f7edac3bb6b4dce56569979da34a2d345237d31d83549482ef19853eec8.

- [benchmarks/cases/layers0-files10.json](benchmarks/cases/layers0-files10.json) — 344140 bytes; SHA256 f5c9dcaaabb6960bfa143a8d5452e8bc9f81c86ac446d83a96638076366b1913.
- [benchmarks/cases/layers1-files10.json](benchmarks/cases/layers1-files10.json) — 3388309 bytes; SHA256 bdbe8d3bdeb27564b8ec636e22220dc8baa0e7fd1baf679678f3968147c4205e.
- [benchmarks/cases/layers1-file1MiB.json](benchmarks/cases/layers1-file1MiB.json) — 1387709 bytes; SHA256 ac05466977a2ca2f2c1b32e05b964913a1eede3c45e6c8ca029466923e7da199.
- [benchmarks/cases/layers1-file32MiB.json](benchmarks/cases/layers1-file32MiB.json) — 593474 bytes; SHA256 4c3264ce1c83d4a3e882aed4f595cdf0e546d5a4bcdee28d03c93b0d8d71f28f.
- [benchmarks/cases/layers1-file100MiB.json](benchmarks/cases/layers1-file100MiB.json) — 593749 bytes; SHA256 1d839d1d26696ad50ea21cd320a856433dd45f3258ff1b9d1e532aaf47546977.
- [benchmarks/cases/layers1-files1000.json](benchmarks/cases/layers1-files1000.json) — 734018 bytes; SHA256 49d2c2ae88d73310e40f981e4245e8a800c4698a314b7b11a1b19bdc8ffdd523.
- [benchmarks/cases/layers2-files100.json](benchmarks/cases/layers2-files100.json) — 783322 bytes; SHA256 0917eb10c261c9e3c08a005f5c6a1ce7edfea5e78a27e5254fe0b575de3d675c.
- [benchmarks/cases/layers5-files100.json](benchmarks/cases/layers5-files100.json) — 1379192 bytes; SHA256 c1cf8f85a9dad9797cb3b2ea987f7f385d0ea73d855e62391d3f0792962d4b63.
- [benchmarks/cases/layers10-files100.json](benchmarks/cases/layers10-files100.json) — 2641254 bytes; SHA256 f4ba132f5d3f9e51e4569b45ef07ab74c4781dda918dd15e81f166503b42f8bc.
- [benchmarks/cases/layers1-files10000.json](benchmarks/cases/layers1-files10000.json) — 233824 bytes; SHA256 969d6d835b82931e48ba9c29ac0a277963cd044a748f753987d53254c6cd7706.
