# Histórico anterior ao fechamento final

Registro editorial das tentativas anteriores. As expressões “pendente” e “candidato final” abaixo descrevem aquele momento, não a situação atual. Os resultados finais estão em [RESULTS](RESULTS.md). Corrigida a contagem textual do runner inicial de 534 para 628; os recibos originais não foram alterados.

# Validação — Etapa 2B

Validação V7 intermediária encerrada: typecheck, build Core/CLI, smoke e infraestrutura concluíram em sequência; a full foi interrompida após dois timeouts específicos de 180 segundos, sem resumo final TAP. Uma contraprova independente confirmou conteúdo privado incorreto aceito antes do primeiro hash; a correção posterior exige nova validação e medição. Matriz ampla, cópia nova e publicação continuam pendentes. As tentativas e os PASS intermediários permanecem separados abaixo. Nenhuma aprovação completa é antecipada. A baseline conhecida é `e8f2e3feba87224246a42337f77f702914df989e`.

As execuções são locais e headless. Não representam CI remoto, teste gráfico, suporte Linux ou perda real de energia. Os resultados são apresentados separadamente por campanha, com comando, código de saída, fonte antes/depois, contagens finais e bloqueios.

## V8 — fases encerradas e suspensão antes da full

As quatro fases V8 abaixo concluíram nas mesmas 232 fontes, fingerprint `749f16888c5cf0a8425e99608d03d0b8f61c2a2400a6cdad3f451fc312017d4b`, sem mudança antes/depois. O [manifesto completo](SOURCE-MANIFEST-749f16888c5cf0a8425e99608d03d0b8f61c2a2400a6cdad3f451fc312017d4b.json) identifica cada arquivo. A diferença em relação ao dirigido de refs foi somente a renderização do inventário em `summarize-scale.mjs`; Core, CLI e testes desse dirigido permaneceram iguais.

| Fase V8 | Resultado próprio | Processo ms | Recibo |
| --- | --- | ---: | --- |
| Typecheck | PASS, exit 0 | 4.457 | [Typecheck](VALIDATION-TYPECHECK-V8.json) |
| Build Core/CLI | PASS, exit 0 | 213 | [Build](VALIDATION-BUILD-V8.json) |
| Smoke compilado | PASS, 82 comandos/quatro snapshots/sete passos | 212.680 | [Smoke](VALIDATION-SMOKE-V8.json) |
| Infraestrutura | 113/113 PASS, zero FAIL/SKIP/cancel/todo | 185.600 | [Infraestrutura](VALIDATION-INFRA-V8.json) |
| Full headless | NÃO INICIOU; marcador planejado antes do lançamento | — | [Suspensão do supervisor](V8-HOLD.json) |

O exit 1 do supervisor V8 veio da suspensão planejada antes da full para preparar a compatibilidade da matriz; não é resultado de uma full executada nem FAIL do Core. As fases concluídas não são atribuídas às alterações posteriores dos testes. A full e a matriz ampla finais continuam pendentes.

## Primeira matriz dirigida — resultados preservados

A [campanha dos consumidores de journal e interleavings](INFRA-MATRIX-DIRECTED.json) separa uma fase de infraestrutura com sete/sete PASS e uma seleção de sete cenários reais com cinco PASS/dois FAIL. As 234 entradas funcionais conservaram fingerprint `29cecb295827a127b69b02b96e2cfb95e3897016c37cc20bcaa0b9a3b9a2948f`; o supervisor também auditou 671 entradas incluindo documentação, enquanto o domínio próprio do runner da matriz teve 628 entradas. Domínios e fingerprints não são intercambiáveis.

RECOVERY-003 parou no erro do novo teste que esperava `failed` em vez de `recovery-required`; o passo tem nome `failed`, mas esse não é o estado. A revisão também corrigiu o exit esperado das futuras chamadas de recover CLI para 5, distinto do exit 1 do adaptador de API. RECOVERY-013 confirmou recusa nativa de publicar a árvore B podada e retenção do índice B/arquivo B/backup A, em vez do rollback automático A esperado pelo oráculo anterior. Status e recuperações posteriores não foram executados depois dessas primeiras falhas. As receitas posteriores são estritas e exigem sua própria execução; nenhum FAIL anterior vira PASS por edição do teste. [Decisão e limite de automatismo](DECISIONS.md#gc-agressivo-e-automatismo-de-recuperação).

## Dirigidos posteriores — campanhas próprias

O [dirigido da materialização](MATERIALIZED-FOCUSED.json) concluiu 50/50 PASS, zero FAIL/SKIP/cancel/todo, exit 0 e 81.843,7924 ms no resumo TAP. Suas 229 fontes conservaram fingerprint `57d3044dc014f21226465ec3a7cbd8c9f3c6f12d9f144f5c6a47bbcea7f9018c` antes/depois. Abrange quatro casos de ativação, 15 de fingerprint Git, quatro do consumidor stdout, 24 do buffer e três controles do runner, todos na mesma campanha. Essa execução precede a correção de refs posterior e não é a full.

O [dirigido de refs](REFS-FOCUSED.json) separa dois processos sequenciais nas mesmas 232 fontes, fingerprint `964e387075ea377fd690e302fc6ba46b0744914ec642eedbc314c4a7e45da251` antes/depois: fase A, 21/21 PASS em 111.798,0241 ms TAP; fase B, seis/seis PASS em 84.886,5729 ms TAP. Cada fase teve exit 0 e zero FAIL/SKIP/cancel/todo. A fase B executou exatamente seis nomes selecionados de CAS e recuperação, incluindo os dois casos que haviam atingido 180 segundos na V7; os demais casos filtrados não são apresentados como executados. Esses denominadores não são somados ao dirigido de 50 casos nem à futura full.

A [contraprova de checkpoint simbólico](CHECKPOINT-SYMREF-REPRO.json) observou alteração de uma tag técnica A→B durante add gerenciado, sem mudança de HEAD, branch da Layer ou MAIN. O [probe de no-deref](NO-DEREF-PROBE.json) demonstrou que a flag isolada preserva o destino, mas pode substituir o alias. A correção prepara a transação oficial do Git, mantém seus locks durante a checagem de tipo e só envia commit quando as refs são diretas. Os dirigidos aprovados não antecipam matriz ampla, full, nova medição do runtime, cópia nova ou publicação.

## V7 — campanha intermediária encerrada

As quatro fases V7 encerradas conservaram os mesmos 226 arquivos funcionais antes/depois: fingerprint `1c5674ec0a9c42a0edb8ede973800e1e45b55683275c0eccc839d480e2e68fd9`. O [manifesto relativo completo](SOURCE-MANIFEST-1c5674ec0a9c42a0edb8ede973800e1e45b55683275c0eccc839d480e2e68fd9.json) identifica cada arquivo e hash. O Core21 tem digest por pares caminho/hash `672b71a890b5bd58b089bb567763dba3c432ac1f08ca020c45d6a3b9ef4f204d`, idêntico ao candidato congelado das medições finais. As fontes de scripts e testes também integram o manifesto funcional; os diferentes algoritmos dos manifestos de benchmark são identificados nas evidências, sem equiparar digests de formatos distintos.

| Fase V7 | Comando ou corpus | Resultado próprio | Duração do processo (ms) | Recibo |
| --- | --- | --- | ---: | --- |
| Typecheck | `node node_modules/typescript/bin/tsc --noEmit`, equivalente a `npm.cmd run typecheck` | PASS, exit 0 | 3.318 | [Typecheck V7](VALIDATION-TYPECHECK-V7.json) |
| Build Core/CLI | `node scripts/build-core.mjs`, equivalente a `npm.cmd run build:core` | PASS, exit 0; saída independente em dist-core | 141 | [Build V7](VALIDATION-BUILD-V7.json) |
| Smoke compilado | `node scripts/smoke-core-cli.mjs --out <EVIDENCE>/smoke` | PASS, 82 comandos, quatro snapshots e sete passos | 136.404 | [Smoke V7](VALIDATION-SMOKE-V7.json) |
| Infraestrutura | Mesmo corpus e concorrência de `npm.cmd run compat:infra`, com reporters de evidência | 113/113 PASS, zero FAIL/SKIP/cancel/todo; exit 0 | 136.760 | [Infraestrutura V7](VALIDATION-INFRA-V7.json) |
| Full headless | Mesmo corpus e concorrência 2 de `npm.cmd test`; dois testes tinham limite específico de 180.000 ms | INTERROMPIDA, exit 1, sem total TAP final; dois timeouts preservados | 1.129.069 | [Full V7 interrompida](FULL-V7-INTERRUPTED.json) |
| Matriz broad | Campanha separada após encerrar a full e congelar os documentos | Pendente | — | Pendente |

As durações da tabela são de validação funcional, não benchmarks. Comandos, snapshots e campanhas não são somados ao número de testes. As fontes arquivadas e os recibos próprios de cada fase preservam os resultados anteriores sem transformá-los em execução V7.

Durante a full V7, às 19h15 de 05/11/2026 no horário de São Paulo (22h15 UTC), o usuário informou que o computador seria usado para jogar por aproximadamente uma hora e meia e autorizou a continuidade. Essa carga foi declarada pelo usuário, sem medição dos processos ou do consumo do jogo. Todos os benchmarks já estavam encerrados. Os tempos da validação funcional posterior não são usados como medições de desempenho; eventual timeout exige diagnóstico próprio e não constitui, isoladamente, defeito do produto.

O [dirigido do buffer](BUFFER-FOCUSED.json) separa a prova externa, as falhas anteriores de loader/injeção e a execução dos 24 casos portados para o repositório. O [dirigido de staging](MANAGED-STAGE-FOCUSED.json) conserva 17 PASS, a regressão inicial com nove PASS/dois FAIL e a seleção corrigida com 16 PASS em campanhas diferentes. Eles não completam nem substituem a full acima.

### Diagnóstico e correção posteriores à V7

O [recibo da full](FULL-V7-INTERRUPTED.json) conserva os dois timeouts e a observação física da recuperação do primeiro caso depois de seu orçamento. Isso não aprova as asserções restantes nem prova que o jogo causou o atraso. A nova campanha usa o orçamento composto de 900 segundos nesse arquivo, mantendo todos os oráculos; os tempos de validação não constituem SLO de desempenho.

A [contraprova de materialização](MATERIALIZED-SOURCE-REPRO.json) executou Git real e alterou um binário A→C após `checkout-index` concluir com código 0 e antes do primeiro fingerprint. A ativação V7 retornou sucesso e status seguro com C no disco, enquanto branch e índice continuavam em A. A correção posterior vincula o hash físico inicial ao OID do blob no mesmo FD; representações convertidas diferentes do blob bruto exigem comparação com a saída nativa de `cat-file --filters` por streaming. O hash capturado não é substituído por uma observação posterior. Typecheck de pré-verificação passou após a implementação; os novos testes, a full posterior e as medições posteriores ainda precisam de seus próprios resultados. Os benchmarks V7 não são atribuídos ao runtime corrigido.

## Fases intermediárias V6 e gates posteriores

As quatro fases intermediárias V6 concluídas abaixo foram executadas em sequência, sem sobreposição entre elas. Todas tiveram exit 0, sem sinal, timeout ou truncamento, e igualdade de fontes antes/depois: fingerprint `7a3dc62aabdd34c0db0d04c8dba71ad8e2f8b6c77eebe0525cdff4e2d1510e42`, 224 arquivos funcionais. O [manifesto relativo completo V6](SOURCE-MANIFEST-7a3dc62aabdd34c0db0d04c8dba71ad8e2f8b6c77eebe0525cdff4e2d1510e42.json) inclui o runner `scripts/validate-performance-recovery.mjs`, SHA-256 `1f13f1533f70dee62a44ab5741c748850497a5eda17388e27036a2b3195cd899` (15.301 bytes). O hash V5 `06191a…` abaixo continua histórico e não é atribuído ao runner V6.

| Fase V6 | Comando ou corpus | Resultado próprio | Duração do processo (ms) | Recibo |
| --- | --- | --- | ---: | --- |
| Typecheck | `npm.cmd run typecheck` → `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 | 2.663 | [VALIDATION-TYPECHECK-V6.json](VALIDATION-TYPECHECK-V6.json) |
| Build Core/CLI | `npm.cmd run build:core` → `node scripts/build-core.mjs` | PASS, dist-core independente do desktop | 156 | [VALIDATION-BUILD-V6.json](VALIDATION-BUILD-V6.json) |
| Smoke compilado | `node scripts/smoke-core-cli.mjs --out <EVIDENCE>/smoke` | PASS, 82 comandos, quatro snapshots, sete passos | 105.721 | [VALIDATION-SMOKE-V6.json](VALIDATION-SMOKE-V6.json) |
| Infraestrutura | `npm.cmd run compat:infra`, mesmo corpus e concorrência; argv completo no recibo | 113 testes, 113 PASS, zero FAIL/SKIP/cancel/todo | 100.731 | [VALIDATION-INFRA-V6.json](VALIDATION-INFRA-V6.json) |
| Full headless | Mesmo corpus de `npm.cmd test`; concorrência 2 e orçamento de 900.000 ms por teste | INTERROMPIDA, exit 1, sem total TAP final | 3.505.638 | [FULL-V6-INTERRUPTED.json](FULL-V6-INTERRUPTED.json) |
| Validação V7 posterior | Campanhas próprias sobre as fontes corrigidas; suítes pesadas em sequência | Full e matriz pendentes, sem contagem antecipada | — | Pendente |

A full V6 começou depois das quatro fases concluídas e foi interrompida. Os quatro PASS permanecem intermediários e não validam a correção posterior de staging/checkpoint. Cada recibo corresponde a uma fase, conserva argv normalizado, hashes dos streams e observações de fontes. As durações são do processo supervisionado, distintas do setup/arquivamento e sem uso como benchmark de ativação. Não se somam os 113 testes com comandos/snapshots do smoke nem com dirigidos ou tentativas históricas para declarar validação completa. A aprovação da full e da matriz posteriores depende de seus próprios resultados finais.

## Fases intermediárias V5 e validação posterior

As quatro fases intermediárias concluídas abaixo tiveram código 0, sem sinal, timeout ou truncamento, e conservaram o fingerprint antes/depois `aea6cdb6a2faf6d68ae424272a2454f44d4e57e8b25683850e568030e20e1b31`, com 223 arquivos funcionais. O [manifesto relativo completo](SOURCE-MANIFEST-aea6cdb6a2faf6d68ae424272a2454f44d4e57e8b25683850e568030e20e1b31.json) inclui Core/CLI, scripts, testes, package/lockfile e tsconfigs. O runner `scripts/validate-performance-recovery.mjs` tem SHA-256 `06191a5673041b0da0a82df2ed4e5faf69b399c3f1a08aadf7aac591e0bbc0dc`, confirmado nesse manifesto e nas fontes revisadas.

| Fase | Comando ou corpus | Resultado próprio | Duração do processo (ms) | Recibo |
| --- | --- | --- | ---: | --- |
| Typecheck V5 intermediário | `npm.cmd run typecheck` → `node node_modules/typescript/bin/tsc --noEmit` | PASS, exit 0 | 7.160 | [VALIDATION-TYPECHECK-V5.json](VALIDATION-TYPECHECK-V5.json) |
| Build V5 intermediário | `npm.cmd run build:core` → `node scripts/build-core.mjs` | PASS, Core/CLI em dist-core | 332 | [VALIDATION-BUILD-V5.json](VALIDATION-BUILD-V5.json) |
| Infraestrutura V5 intermediária | `npm.cmd run compat:infra`, mesmo corpus e concorrência; argv completo no recibo | 113 testes, 113 PASS, zero FAIL/SKIP/cancel/todo | 303.137 | [VALIDATION-INFRA-V5.json](VALIDATION-INFRA-V5.json) |
| Smoke V5 intermediário | `node scripts/smoke-core-cli.mjs --out <EVIDENCE>/smoke` | PASS, 82 comandos, quatro snapshots, sete passos | 504.634 | [VALIDATION-SMOKE-V5.json](VALIDATION-SMOKE-V5.json) |
| Full headless V5 | Mesmo corpus de `npm.cmd test`; concorrência 2 e orçamento de 900.000 ms por teste | INTERROMPIDA, exit 1, sem total TAP final | 2.327.718 | [FULL-V5-INTERRUPTED.json](FULL-V5-INTERRUPTED.json) |
| Full headless posterior | Nova campanha sobre as fontes corrigidas, com recibo próprio | Pendente; nenhum total ou aprovação antecipado | — | Pendente |
| Matriz broad posterior | Nova raiz de evidência, depois de a full posterior encerrar | Pendente; tentativa sobreposta interrompida preservada separadamente | — | [Tentativa retirada](BROAD-V5-OVERLAP-INTERRUPTED.json) |

Esses quatro PASS não validam as fontes posteriores à correção de criação do índice nem completam a full interrompida. A duração é a do processo supervisionado, distinta do intervalo completo de preparação/arquivamento da fase. Esses tempos não são benchmarks. A full compartilhou inicialmente o host com as quatro fases concluídas e, brevemente, com a broad interrompida; consulte a [qualificação da sobreposição](#v5-correção-da-sobreposição-de-suítes). Cada linha tem seu próprio escopo: não se somam testes, comandos, snapshots ou campanhas para criar uma aprovação geral. Os recibos incluem argv normalizado, hashes dos streams e observações de fontes; não publicam caminhos privados, usuários ou IDs de processo.

## Observações anteriores à validação final

- A reprodução de corrida no rename da baseline falhou no critério de preservação: a ativação retornou sucesso e substituiu o arquivo concorrente. Essa falha não é convertida em PASS do produto antigo.
- O primeiro ensaio de sync num FD aberto somente para leitura recebeu EPERM no Windows; o candidato foi corrigido para conservar o flush feito pelo escritor e a fronteira documentada de sincronização de diretórios.
- Uma tentativa de testes sem elevação não conseguiu criar fixtures temporárias (EPERM); a repetição autorizada deve ser registrada separadamente, sem esconder a primeira tentativa.
- As primeiras consultas `Get-Volume` e `fsutil fsinfo volumeinfo C:` receberam acesso negado. Uma leitura posterior autorizada confirmou NTFS e unidade de alocação de 4.096 bytes; isso não é medição de extents, ocupação física ou I/O do dispositivo. [Recibo nativo e publicação](PUBLICATION-FOCUSED.json).

Os FAIL anteriores, fixtures e logs brutos são preservados externamente; as evidências públicas devem conter os fatos essenciais e hashes, sem caminhos privados, credenciais, dependências ou fixtures grandes.

## Candidato retirado: ativação com fonte externa alterada

A campanha dirigida v1 foi interrompida após dois probes independentes do Git oficial confirmarem falhas adicionais. Alterar o índice privado de A para B depois do guard e antes da extração fazia `on` retornar sucesso, publicar B e atualizar o checkpoint para B; a ref continuava em A e o status posterior considerava o staging válido. Alterar a ref local A→B depois da extração fazia `on` retornar sucesso com arquivos A; só a consulta seguinte diagnosticava `EXTERNAL_REF`. MAIN e HEAD permaneceram preservados nos dois casos. Esses resultados são defeitos confirmados, não PASS do candidato nem provas sobre cache, que não existe.

O [recibo da campanha interrompida](FOCUS-V1-INTERRUPTED.json) conserva fingerprint antes/depois igual, código 1, ausência de total TAP final, hashes dos logs e motivo. Somente a árvore própria de testes foi sinalizada após comprovar executável, argv e instante de criação; a consulta seguinte não encontrou os IDs próprios listados. Uma ocorrência já encerrada fez `taskkill` retornar 1, preservado no recibo. As fixtures e resultados parciais não foram apagados nem somados à validação posterior.

A correção candidata passa a vincular a extração a uma cópia verificada do índice e às observações atuais de ref/checkpoint/índice. Sua aprovação depende dos testes novos e da full final, não dos resultados da campanha retirada.

## Falhas de syscall e volumes distintos

A [campanha dirigida de cópia](COPY-FAILURE-FOCUSED.json) conserva a primeira tentativa (dois PASS/um FAIL de setup) e a repetição inteira (três PASS/zero FAIL/zero SKIP). O FAIL inicial veio de `mkdirSync` recursivo na raiz de um drive Windows já existente; o ajuste ficou na criação da fixture D: por `mkdtemp`, com marcador, nonce e ancestralidade validados. Não foi mudado o oráculo de movimentação.

A cópia de publicação escreveu efetivamente um prefixo de 17 bytes na entrada privada antes de ENOSPC sintético; nenhum fragmento chegou ao alvo público, e duas recuperações conservaram a recusa V05 e as evidências. Uma exceção EIO no syscall de rename do exclude existente preservou bytes e backup, com rollback comprovadamente concluído. Duas raízes novas próprias em C: e D:, com `dev` distintos, permitiram testar EXDEV real tanto em `fs.rename` quanto na primitiva de publicação: fonte nlink1 e destino ausente permaneceram. Não houve enchimento físico de disco, transferência entre volumes ou uso de dados preexistentes.

## Full V3 interrompida: inicialização da reserva

A [full V3](FULL-V3-INTERRUPTED.json) encontrou dois FAIL de compatibilidade em `branch-protection.test.ts`: a ativação direta de uma branch descoberta tentava validar seu `reservations.json` antes de publicá-lo pela primeira vez. Não houve alteração de expectativa para exigir registro manual. A correção publica a reserva vazia inicial pelo mesmo `writeJSON` acompanhado por backup/plano/AFTER antes de sua validação estrita; o save posterior reconhece os bytes iguais.

O código permaneceu igual antes/depois dessa campanha interrompida, que não tem total TAP final e não recebe aprovação da suíte completa. A árvore própria foi sinalizada somente depois de comprovar PID, argv, criação e descendentes. O `taskkill` retornou 128 com erro de operação não suportada; a consulta seguinte não encontrou os dez IDs previamente inventariados. Não se declara encerramento universal de descendentes não observados.

O helper histórico de proteção removia sua fixture também após falha; os dois diretórios originais desses FAIL já tinham sido removidos por ele. Logs TAP e fontes arquivadas continuam preservados. O helper foi atualizado para respeitar a flag de retenção da campanha, conservando a validação de nonce/ancestralidade e os mesmos oráculos do produto. Essa limitação de evidência não é escondida nem convertida em retenção retroativa.

## Candidato V2 retirado: índice idêntico com identidade externa

Uma revisão independente encontrou e reproduziu uma falha no novo wrapper de adoção do índice de shelf do **candidato V2**, posterior à baseline conhecida. A prova exclusiva está em [SHELF-ADOPT-REPRO.json](SHELF-ADOPT-REPRO.json), com hashes de activation-source.ts, index-stage.ts e index.ts. Não é uma reprodução de e8f2e3 e não se soma às campanhas anteriores.

O resultado observado foi `SUCCESS`/`adopted:true` após substituir o índice B por outro inode contendo os mesmos bytes, com mtime 59.558.963.200 ns posterior. MAIN/HEAD/ref da Layer permaneceram iguais; staged B e disco C também permaneceram presentes. Não se afirma perda observada de C. A falha é aceitar como própria a nova identidade física/temporal externa.

O executor principal retirou o gate V2, encerrou somente sua árvore própria e verificou a estabilidade das fontes. O reparo exige o witness exato do publicador, além do fingerprint; sua validação depende da nova campanha congelada. As interrupções e a correção são preservadas no [detalhe de recuperação](RECOVERY.md#candidato-v2-adoção-da-identidade-exata-do-índice-de-shelf).

## Full V4 interrompida: identidade externa durante a restauração

A [full V4](FULL-V4-INTERRUPTED.json) foi interrompida após uma reprodução independente confirmar uma lacuna na última fronteira do rollback de índice. Depois do preflight e durante a cópia do backup, o escritor externo da fixture substituiu B por outro inode com os mesmos bytes e mtime cerca de 60 segundos posterior. O candidato retornou sucesso de recuperação, restaurou A sobre esse índice externo e concluiu o journal em schema 1. Essa observação não afirma perda de bytes C do workspace. O reparo e seus testes de identidade/locks pertencem à campanha posterior; nenhum PASS é antecipado aqui.

A full V4 terminou com código 1 em 878.462 ms, sem total TAP final. Seus 223 arquivos funcionais conservaram o fingerprint `34f78b0b8e63d35816a38c8078170a91fc82b81ba27d7efbce8640cebb1262b7` antes/depois; o [manifesto relativo completo](SOURCE-MANIFEST-34f78b0b8e63d35816a38c8078170a91fc82b81ba27d7efbce8640cebb1262b7.json) permite comparar cada fonte. Somente a árvore própria foi sinalizada após inventário; a observação posterior não encontrou os 11 IDs anteriormente inventariados. O taskkill retornou 128 com mensagens de operação não suportada. Isso não é prova universal sobre descendentes não observados. Logs e fixtures restantes foram preservados, sem somar resultados parciais.

A [infraestrutura V4 separada](INFRA-V4-INTERMEDIATE.json) concluiu 113/113 PASS, zero FAIL/SKIP/cancel, exit 0, em 196.583 ms de processo, sobre o mesmo fingerprint. É uma campanha intermediária anterior à correção de recuperação; não valida as fontes posteriores nem completa a full interrompida.


## V5: correção da sobreposição de suítes

O [guia headless, linha 64](../../git-compat/README.md#selecionar-e-executar-sem-interface) exige executar suítes pesadas em sequência. O executor iniciou a matriz broad V5 enquanto a full V5 ainda estava em andamento. Ao identificar o erro de orquestração, interrompeu somente a árvore própria da broad e conservou a tentativa em [BROAD-V5-OVERLAP-INTERRUPTED.json](BROAD-V5-OVERLAP-INTERRUPTED.json), incluindo o manifesto completo das fontes. A full começou às 15:06:32.044Z; a broad às 15:18:44.494Z. A solicitação de encerramento ocorreu às 15:20:52.703Z, e seu wrapper fechou às 15:20:54.129Z com código 1, sem timeout ou truncamento e sem resumo final da matriz.

O erro ENOENT do wrapper veio da ausência de `matrix/latest-run.json` depois da interrupção deliberada; não é atribuído ao produto. Nenhuma contagem parcial é apresentada como denominador final. O taskkill retornou 128, com mensagens de tarefa já encerrada/operação não suportada; a observação seguinte não encontrou os dez IDs previamente inventariados. Isso não comprova encerramento universal de descendentes não observados. Logs, fontes e artefatos parciais da matriz permanecem preservados. A nova matriz deve usar raiz nova depois do encerramento da full, sem somar resultados dessa tentativa.

A full V5 também compartilhou o host com typecheck/build e, por parte de sua execução inicial, infraestrutura e smoke V5. As quatro fases encerradas conservaram o mesmo fingerprint funcional de 223 arquivos, `aea6cdb6a2faf6d68ae424272a2454f44d4e57e8b25683850e568030e20e1b31`; seus resultados permanecem separados. Seus tempos e os da full são observações de validação sob carga concorrente, não benchmarks de desempenho. A sobreposição não é omitida nem se presume que invalide um resultado funcional sem falha; qualquer timeout precisa de reprodução isolada antes de atribuir a causa ao produto. A aprovação da full posterior e da matriz depende dos respectivos recibos finais; a full V5 acima foi retirada.


## Full V5 interrompida: retenção do índice recém-criado

A [full V5](FULL-V5-INTERRUPTED.json) foi retirada após duas reproduções independentes em fixtures próprias confirmarem uma lacuna na criação compartilhada do índice durante o primeiro registro/ativação. Uma substituição externa do índice A por outro inode com os mesmos bytes foi aplicada depois de obter o token de validação e, na segunda prova, dentro da própria validação. O candidato diagnosticou `EXTERNAL_INDEX`, mas seu rollback automático removeu esse índice externo e concluiu o journal em schema 1 antes de `ActivationSource` ter sido atribuído.

As [duas contraprovas sanitizadas](INITIAL-INDEX-RETENTION-REPRO.json) conservam as fontes realmente observadas e não alegam perda de conteúdo B distinto. O [dirigido da correção](INITIAL-INDEX-FOCUSED.json) separa a primeira campanha de novos testes com falhas de razão/hook, o grupo final de 12 casos e os cinco regressivos antigos selecionados; esses resultados não compõem uma full nem certificam fontes posteriores.

A falha confirmada é retirar a identidade externa sem autoridade durável de criação. Não se afirma que havia staging B distinto ou que foi entregue/perdida outra versão nessa prova: HEAD, MAIN, ref da Layer e registry foram preservados. Um marcador de erro apenas em memória não basta se o erro acontecer antes de registrá-lo. A correção exige preparar a imagem pelo Git oficial em área técnica, verificar a árvore esperada e publicar com um testemunho durável que autorize somente ausência ou a identidade exata criada; seus testes pertencem à campanha posterior.

A campanha V5 permaneceu com o fingerprint `aea6cdb6a2faf6d68ae424272a2454f44d4e57e8b25683850e568030e20e1b31` antes/depois, 223 arquivos, exit 1, 2.327.718 ms de processo e nenhum total TAP final. O encerramento próprio foi solicitado às 15:45:21.272Z; a observação seguinte não encontrou os dez IDs previamente inventariados, com taskkill 128 e a qualificação de que descendentes não observados não foram universalmente certificados. O wrapper fechou às 15:45:23.806Z. Logs e fixtures restantes foram preservados. Typecheck/build/infra/smoke V5 continuam PASS de suas campanhas intermediárias sobre aquele snapshot; não são atribuídos à correção seguinte nem somados para declarar suíte completa. A qualificação anterior de sobreposição de carga permanece válida.


## Full V6 interrompida: recaptura de staging externo no checkpoint

A [full V6](FULL-V6-INTERRUPTED.json) foi retirada após probes independentes confirmarem, tanto na baseline e8f2e3 quanto no candidato V6, que o checkpoint podia recapturar um índice vivo posterior. O add gerenciado preparava B; um `read-tree` oficial externo substituía o índice vivo por C antes do checkpoint; a operação retornava sucesso e registrava AFTER/checkpoint em C. Não houve sobrescrita ou perda de dados observada nessas provas, e os objetos B/C continuaram disponíveis. O defeito confirmado é aceitar C como resultado da preparação gerenciada B.

As [duas reproduções sanitizadas](STAGE-RECAPTURE-REPRO.json) conservam os hashes exatos dos recibos e do bundle congelado realmente observado, separando-os dos testes dirigidos posteriores.

O programa efetivamente usado nesses probes foi enviado por stdin da ferramenta. O arquivo `PROBE.mjs` retido era uma nota; não é tratado como programa independente executado nem recebe hash de execução inventado. Os recibos sanitizados da reprodução e o teste dirigido versionado posterior têm escopos separados. A correção candidata passa a derivar a árvore B em cópia independente verificada do índice técnico pós-add e a vincular sua publicação ao checkpoint, sem novo `write-tree` sobre o índice vivo; sua aprovação depende da campanha posterior.

A full V6 manteve 224 arquivos e fingerprint `7a3dc62aabdd34c0db0d04c8dba71ad8e2f8b6c77eebe0525cdff4e2d1510e42` antes/depois. Terminou com exit 1 em 3.505.638 ms de processo, sem timeout, truncamento ou resumo TAP final. O wrapper fechou às 17:12:36.904Z. As quatro fases V6 concluídas continuam resultados intermediários desse snapshot, sem somar seus denominadores aos testes da full interrompida.

O inventário inicial de encerramento estava excessivo: onze associações por PID/pai incluíam quatro processos anteriores à raiz de testes, por reutilização de PID. A correção cronológica canônica V3 exclui esses quatro; eles continuavam vivos com a mesma identidade e não foram alvo de sinal. Dos sete processos previamente inventariados e cronologicamente próprios, nenhum permaneceu com a mesma identidade na observação posterior. O taskkill retornou 0 e relatou seis terminações: quatro correspondem ao inventário próprio; duas foram relatadas depois, com arestas de pai para a árvore conhecida, sem observação independente de seus instantes de criação. Não se declara encerramento universal de descendentes não observados nem certificação CIM desses dois filhos. Nenhum sinal adicional foi enviado. V3 substitui duas projeções anteriores incorretas; inventários originais, comandos e dados de outras aplicações permanecem privados, preservados externamente. O recibo público contém somente contagens, qualificações e hash da correção canônica.
