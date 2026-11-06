# Benchmarks intermediários — Etapa 2B

Esta é uma observação intermediária de 05/11/2026. Os oráculos independentes do Git passaram nas fixtures descritas; o fechamento funcional completo e a matriz ampla continuam pendentes. A tabela principal de [BENCHMARKS.md](BENCHMARKS.md) permanece como estava. O [recibo intermediário JSON](BENCHMARKS-INTERMEDIATE.json) reúne sete casos e 76 amostras, com hashes dos programas, fontes, entradas e arquivos brutos preservados. Seu SHA-256 é `d760e2e1148f9c875646f8d5cbe3542eef70d9eeb8254cc4c9941715a5e24456`.

A baseline é `e8f2e3feba87224246a42337f77f702914df989e`. O candidato usa o mesmo observador instrumentado da nova baseline de mil arquivos. O fingerprint do manifesto de benchmark é `17e4867622ddc2436ada4ad1d086a41267214fb32dafa708f1d3e4beecce415d`; a mesma lista de 21 arquivos, convertida para as tuplas de caminho/hash do validador, produz `74efb04d209c542b97e5a078fcd96b07d1d2f4f7f84b64d2e3b3cc43db38b375`. Todos esses caminhos, tamanhos e hashes correspondem ao subconjunto Core do manifesto funcional de 225 entradas, `32f2714cfeca5aa6d94ef0d4a723557d7e737295f084d11c8685367f13e63190`. Os dois fingerprints do Core usam algoritmos de manifesto diferentes; suas definições estão no recibo.

Os três ciclos repetem on/off na mesma fixture, com histórico concluído retido e filesystem aquecido. A primeira ativação inclui o primeiro registro e tem somente uma observação. Não houve remoção do cache do sistema operacional; n3 não representa três fixtures independentes nem demonstra estabilidade estatística.

| Mil arquivos de 256 bytes | Baseline s | Candidato com limpeza s | Variação s | Variação % |
| --- | ---: | ---: | ---: | ---: |
| Primeira ativação, n1 | 46,075 | 50,662 | +4,587 | +9,96 |
| Desativação, mediana n3 | 60,865 | 49,008 | −11,856 | −19,48 |
| Reativação sem cache de projeção, mediana n3 | 44,190 | 47,054 | +2,863 | +6,48 |

O candidato apresenta regressões observadas na primeira ativação e na reativação de mil arquivos. A desativação ficou mais rápida nesta campanha. Os valores absolutos incluem a instrumentação; a ordem fixa e a carga não medida limitam atribuições causais.

Na primeira ativação, os bytes de journal observados caíram de 1.193.130.811 para 3.850.859. Os flushes de arquivo de journal passaram de 2.013 sucessos em 4,136 s somados para 4.024 sucessos em 6,269 s. O tempo inclusivo de persist passou de 23,813 s para 19,450 s. Essas durações se sobrepõem a outras fases e não devem ser somadas. Os bytes são contadores conhecidos das APIs JavaScript, não IO físico nem todo o tráfego de cópia. A API fs.copyFile retorna void e deixa o payload desconhecido ao observador, e a extração do Git ocorre fora desses contadores.

O controle com apenas a limpeza desabilitada registrou 44,373/47,693/38,503 s para ativar/desativar/reativar mil arquivos, com uma observação de cada operação. Suas diferenças não isolam toda a variação de ordem e carga. Os totais finais de armazenamento desses dois casos de mil arquivos não são equivalentes: o candidato fez três ciclos, e o controle, um.

| Um arquivo de 100 MiB, n1 por operação | Com limpeza s | Sem limpeza s |
| --- | ---: | ---: |
| Primeira ativação | 7,525 | 6,166 |
| Desativação | 4,357 | 4,206 |
| Reativação | 4,439 | 3,932 |

Nos dois casos de 100 MiB, a primeira ativação e um ciclo de desativação/reativação dão a mesma quantidade de histórico. A limpeza deixou zero bytes de extrações retidas, contra 209.715.200 bytes sem limpeza. O repositório terminou com 314.675.040/524.389.906 bytes lógicos e 314.681.344/524.396.544 bytes de dados de arquivo alocados, respectivamente. Essa alocação é a informada pelo sistema operacional, com identidades deduplicadas; exclui MFT, diretórios, ADS, extents CoW exclusivos, IO de dispositivo e pico de uso. Arquivos pequenos residentes podem reportar zero sem eliminar o custo de metadados do filesystem.

A baseline de mil arquivos sem instrumentação registrou 36,574/44,802/33,855 s, somente n1, em campanha separada. O usuário informou ter fechado a aplicação interativa antes da janela e depois informou que iria reabri-la. O intervalo exato da reabertura e sua carga no host não foram medidos. O endpoint sem instrumentação do candidato terminou com oráculos PASS, mas toda a sua medição de desempenho ficou inelegível para comparação após essa retomada; nenhum delta de calibração controlada é apresentado. Os dados brutos foram preservados. O estado ocioso do sistema operacional nunca foi comprovado.

O buffer ainda não foi adotado no produto nem medido. Novas medições exigem uma nova janela tranquila explicitamente confirmada pelo usuário. Dez mil arquivos, os demais casos e o fechamento funcional permanecem pendentes. Esta evidência intermediária não substitui a tabela pública principal nem certifica a implementação final.
