# Etapa 2 — desempenho e recuperação

**Implementação validada em cópia nova; fechamento documental B.** A implementação está no commit local `934befc1516bd12b3aee43c6b4e326d34e647f1b`. A verificação independente da cópia nova A passou, com fontes iguais e runtime relocado sem dependências: [receipt](FRESH-COMMIT-A.json) e [auditoria de privacidade, sem candidatos](FRESH-COMMIT-A-PRIVACY-AUDIT.json). Commit documental B, push, cópia nova B e sincronia serão atestados depois de existirem; nenhum SHA B é antecipado. [Protocolo](PUBLICATION.md).

## Estado da campanha

**Registro pré-A (histórico).** **Validação local concluída no alcance executado; entrega e publicação pendentes.** A matriz V11 concluiu 361 selecionados: 355 PASS, seis ENV_BLOCKED e zero FAIL, exit 0 natural. A infraestrutura V11 concluiu 113 PASS/113, zero FAIL/SKIP. A full V9 mantém 415 resultados, 411 PASS e quatro SKIP; typecheck/build/smoke V9 também passaram. As campanhas conservam seus domínios e não são somadas. O benchmark V9 conserva nove pares completos e dois endpoints TIMEOUT_OWNED em 10.000 arquivos. Os FAIL de integridade V7/V8, da primeira infraestrutura V9 e da matriz V10 continuam preservados. D5 encerrou sem mudança de fontes/docs/runner; cópia nova, commit, push e sincronia no GitHub permanecem pendentes.

O snapshot current-v9 contém 209 entradas funcionais, fingerprint SHA-256 698f7e3f647381eef19463a5a1fd07252ed875b6a83c5789f1282129ebd97dbc. O domínio de 18 fontes Core tem fingerprint 23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb, mais uma fonte CLI. O benchmark confirmou imagens de fontes iguais antes/depois. O preflight typecheck passou, mas não substitui as fases finais.

O gate recovery5 V9 executou cinco arquivos: 62 resultados, 61 PASS, zero FAIL e um SKIP original por permissão de symlink no Windows; 54 pais, sem cancelamentos/todo, exit 0 e fonte igual. Os dois testes novos de queryIndexTree já integram esse total. As [linhas TAP públicas](DIRECTED-V9-RESULTS.json), a [auditoria](DIRECTED-V9-PRIVACY-AUDIT.json) e a [classificação dos achados técnicos](DIRECTED-V9-PRIVACY-CLASSIFICATION.json) preservam seu escopo dirigido. Nenhuma dessas contagens é somada à suíte completa.

**Registro pré-A (histórico).** A automação externa parou **depois** do término bem-sucedido da full. O guard terminou COMPLETED, com 2.855 amostras e nenhuma identidade registrada ainda presente na sua observação final. O controlador, porém, recusou uma amostra de processo com campo de executável ausente ao preparar o handoff: seu FINAL original continua HALTED e quiet=false. Isso não é um FAIL de teste Core/CLI e não foi reinterpretado como encerramento comprovado. O handoff foi comprovado posteriormente por uma verificação independente e somente leitura: CLOSURE_PROVEN, quiet=true, 128 identidades, duas consultas e nenhum processo sinalizado, SHA-256 766ea1c35983f54929d760a4b8344d97a740426406dbd80ab2c5fe6e0fbbe721. Essa prova não modifica o FINAL original HALTED/quiet=false. A continuação independente concluiu typecheck, build Core/CLI e smoke compilado com PASS, fonte209 igual e quiet=true. O smoke contém 82 comandos, quatro snapshots e sete etapas, sem somar esses números aos 415 resultados da full. A primeira infraestrutura V9 terminou FAIL sob D1; a infraestrutura posterior V10 concluiu 113 PASS/113 sob D2. A matriz V10 permaneceu FAIL. Após a correção restrita do HARNESS-021, infraestrutura e matriz inteira V11 passaram em novas campanhas: 113/113 e 355 PASS/seis ENV_BLOCKED/zero FAIL entre 361. Cópia nova e publicação continuam pendentes. Os [resultados completos](FULL-V9-RESULTS.json), a [auditoria](FULL-V9-PRIVACY-AUDIT.json) e a [classificação](FULL-V9-PRIVACY-CLASSIFICATION.json) distinguem esses fatos.

A auditoria de integridade interrompeu o fechamento V6: uma regressão na cópia temporal de consulta e três famílias também confirmadas na baseline atingiam desativação, staging e restauração de índices. As correções e seus oráculos estão documentados em [INTEGRITY-AUDIT.md](INTEGRITY-AUDIT.md). O V7 terminou com 67 PASS e três FAIL em 70 resultados; V8, com 68 PASS e dois FAIL em 70. Os originais continuam FAIL. Os 25 pais observados da full V6 interrompida não formam uma suíte completa. Os tempos V6 permanecem separados em [seu relatório intermediário](BENCHMARKS-INTERMEDIATE-V6.md), sem comparação causal V6→V9. [RESULTS.md](RESULTS.md) identifica as fontes e campanhas históricas.

## Baseline e identificação das fontes

No início foram conferidos cwd, branch, SHA, status, ignorados e remoto. A main local, origin/main e `ls-remote` apontavam para `d71ccc7d188500a22e56ea93c70ac946dba9db60`. Não havia alterações tracked ou untracked de código. Foram preservados `.workshop/`, `artifacts/`, `dist-core/`, `dist-debug/`, `dist/` e `node_modules/`, sem limpeza ou migração real.

O commit inicial foi extraído em diretório externo exclusivo com marcador/nonce. O manifesto dos 438 arquivos versionados tem fingerprint SHA-256 `9c488d44f0c443dc7b251c6f928b4762cba8ce0f30d0e3c769de5eaba4c84161`. O piloto foi medido antes da primeira alteração de implementação. As comparações posteriores continuaram usando essa cópia imutável, não a workingtree modificada como baseline.

O candidato intermediário V6 é identificado por 205 entradas funcionais e fingerprint `f72502adcfd332e3109ad3e82ec845731f376cfc41d5e4a44be5ce89a6c4a825`. O domínio de 17 fontes Core tem fingerprint `aab512270756d7888e5c1af60df6cc4b17d08a4376f4161552190a7115d32b35`; o snapshot inclui também uma fonte CLI. Domínios distintos não devem ter seus fingerprints comparados como se fossem iguais.

## Resultados de desempenho

A campanha V9 começou em 2026-11-04T22:50:03.262Z e terminou em 23:57:56.907Z, com encerramento próprio comprovado e fontes iguais. O orçamento era de 150 minutos, com limite de vinte minutos por endpoint n1; foram usados cerca de 67 minutos e 54 segundos, incluindo finalização. Esses limites incluem preparação e não são tempos de ativação.

Os números abaixo comparam a baseline d71 com o pacote V9 na mesma campanha. São tempos de API Core em worker já carregado, com fixture preparada e cache aquecido após setup. Não incluem startup completo da CLI e não representam cache frio do sistema operacional. n3 usa mediana; n1 é observação única, sem mediana, dispersão ou p95. Valores nesta tabela estão arredondados à milésima de segundo; todas as amostras permanecem nos detalhes.

| Cenário: Layers; arquivos nas Layers; alvo | n | Ativar antes → V9 | Desativar antes → V9 | Git direto on / off antes → V9 |
| --- | ---: | ---: | ---: | --- |
| 1; dez arquivos pequenos; alvo dez | 3 | 4,384 → 3,284 s | 4,481 → 3,535 s | 66→45 / 67→44 |
| 1; arquivo de 1 MiB; alvo um | 3 | 4,165 → 2,903 s | 4,198 → 2,760 s | 66→45 / 67→44 |
| 1; arquivo de 32 MiB; alvo um | 1 | 4,387 → 2,871 s | 4,809 → 3,173 s | 66→45 / 67→44 |
| 1; arquivo de 100 MiB; alvo um | 1 | 4,358 → 3,608 s | 5,332 → 4,737 s | 66→45 / 67→44 |
| 1; 1.000 arquivos pequenos; alvo 1.000 | 1 | 42,508 → 37,198 s | 54,151 → 49,111 s | 66→45 / 67→44 |
| 2; cem arquivos pequenos no total; alvo cinquenta | 1 | 7,609 → 6,313 s | 7,548 → 6,321 s | 92→63 / 88→60 |
| 5; cem arquivos pequenos no total; alvo vinte | 1 | 8,350 → 8,657 s | 8,217 → 7,889 s | 155→108 / 145→102 |
| 10; cem arquivos pequenos no total; alvo dez | 1 | 15,888 → 9,335 s | 13,588 → 8,909 s | 260→183 / 240→172 |
| 1; 10.000 arquivos pequenos | 1 planejada | Sem par completo | Sem par completo | TIMEOUT_OWNED nas duas versões; sem delta |

Cada cenário com Layers tem também dez arquivos da base; arquivos pequenos têm 256 B. Nos casos 2/5/10 Layers, as outras 1/4/9 continuam ativas durante off/on do alvo. Não é uma curva de quantidade de Layers com volume movimentado constante. A primeira ativação/registro tem rótulo próprio; on na tabela é reativação após off.

Com uma Layer e dez arquivos, status caiu de 6,596 para 5,069 s, com 123→90 invocações Git diretas; on-repeat, de 2,764 para 2,274 s, com 49→34. Sem Layers, status caiu de 2,445 para 1,862 s, com 54→36. As faixas n3 dessas operações não se sobrepõem. Isso demonstra redução nas amostras executadas, sem estabelecer uma garantia universal de latência.

**Há regressões de latência observadas.** Sem Layers, recover-empty passou de mediana 282,978 para 348,117 ms em três amostras (+23,019%; MEASURED_HIGHER_LATENCY). Em cinco Layers, há pioras n1: Ativação passou de 8,350 para 8,657 s (+3,7%); status, de 11,301 para 15,826 s (+40,0%); on-repeat, de 4,716 para 5,574 s (+18,2%). Os casos de cinco Layers são pares n1, com menos processos Git apesar da maior latência. Não há distribuição, significância estatística ou causa individual demonstrada. A ordem fixa por cenário, o cache e a variação temporal impedem atribuir todo delta a uma otimização específica. Não se usam diferenças entre campanhas V6 e V9 como ganho de código.

O pico amostrado de RSS do worker em 100 MiB caiu de 399,1 para 68,7 MiB ao ativar e de 398,4 para 68,6 MiB ao desativar, ambos n1. Em 32 MiB, os valores foram 215,7→67,4 MiB e 204,9→67,8 MiB. Isso é memória do worker observada a cada dez milissegundos, sem filhos Git, picos mais curtos ou garantia de pico físico da máquina. maxRSS acumulativo é registrado separadamente. A memória não melhorou em toda escala: com cinco Layers, on foi de 90,2 para 96,8 MiB e off de 76,6 para 99,1 MiB.

O custo por arquivo permanece alto. Em 1.000 arquivos, publish levou 31,572 s; writeCopy, 30,489 s em mil chamadas; transaction.record, 18,874 s em 2.008 chamadas. No off, deactivateInternal levou 46,719 s; remove, 38,682 s; track, 25,624 s. Esses métodos são inclusivos e aninhados: **não somar as durações**. Eles localizam o trabalho observado, sem separar exclusivamente cópia, hashing, flush e serialização. backupTracked não foi envelopado; ausência ou zero no contador backup não prova ausência de backups ou cópias.

Os contadores registram subprocessos diretos do Core com PID, tentativas observadas e falhas sem PID separadamente. V3 pode omitir um throw síncrono anterior ao registro; V4 registra a tentativa antes do spawn. Descendentes do launcher Git não foram observados. Bytes de payload lógico e canais Git não equivalem a IO físico; as fronteiras de tamanho em disco não demonstram pico de alocação. A meta de centenas de milissegundos não foi atingida de forma geral.

### Evidências de desempenho

[BENCHMARKS.md](BENCHMARKS.md) apresenta as operações; [BENCHMARKS.json](BENCHMARKS.json) é o índice compacto com todos os 130 registros de comparação, inclusive os não comparáveis. Os dez arquivos integrais, como [uma Layer/dez arquivos](benchmarks/cases/layers1-files10.json), [1.000 arquivos](benchmarks/cases/layers1-files1000.json) e [10.000 arquivos incompletos](benchmarks/cases/layers1-files10000.json), preservam amostras, fases, recursos e estados originais.

[BENCHMARKS-SHARDS.json](BENCHMARKS-SHARDS.json) prova a remontagem integral por igualdade estrutural e digest canônico de 319.987 nós, sem arredondar ou omitir valores. O JSON integral anterior de 13.692.844 bytes permanece preservado pelo seu SHA. A [auditoria independente](BENCHMARKS-PRIVACY-AUDIT.json) terminou NO_CANDIDATES_OBSERVED nos treze artefatos da distribuição, sem alterar dados. Esses resultados certificam a transformação documental e sua inspeção nesse escopo; não são testes do produto nem aprovação da suíte full. Este lote editorial posterior ainda aguarda sua própria auditoria.

## Gargalos identificados e alterações

| Gargalo anterior | Alteração implementada | Segurança e limite |
| --- | --- | --- |
| Descoberta e consultas repetidas de caminhos internos/refs | Consultas agrupadas e uma enumeração fresca de refs de Layers por guard | Hooks, sentinelas, topologia e concorrência continuam validados em cada guard. Não há cache de refs mutáveis. |
| Leitura repetida de árvores imutáveis numa operação | Cache por OID, até 64 árvores/100.000 entradas, restrito à mutação coordenada | Resultados copiados e cache descartado ao sair. Índices, arquivos, propriedade e configuração continuam atuais. |
| Buffers integrais/base64 no caminho físico normal | Fingerprints, backups, cópias e restauração por blocos de 256 KiB; desativação guarda fingerprints em vez de duplicar payload | Hash, identidade/modo, criação exclusiva, flush, revalidação e backup durável antes de remover continuam obrigatórios. |
| Transação sem mudança em repetição/status estáveis | Evitar JSON idêntico e transações desnecessárias quando as precondições são satisfeitas | Guard, lock, propriedade e confirmações pendentes não são omitidos. |
| Duas publicações sucessivas do journal para acompanhar um caminho | Publicar backup e plano juntos em um único `backup-ready` durável antes de alterar o alvo | `backup()` independente conserva sua durabilidade; AFTER, revogação e fronteiras D-03/V05 continuam separados. |
| Argumentos proporcionais a todos os caminhos tracked na consulta de Layer | Usar o domínio tracked do próprio índice no diff | Não inclui untracked nem une índices. |
| Um journal inválido escondia o diagnóstico dos demais | Leitura estrita compartilhada e diagnóstico por journal | Core continua recusando abrir/operar diante de metadados inválidos; diagnóstico não executa recuperação. |

O custo restante inclui subprocessos fixos, verificações por Layer, hashes/leituras por arquivo, flush e serialização integral repetida de journals crescentes. O custo acumulado do journal ainda pode ser O(N²). Uma publicação a menos por caminho não resolve essa arquitetura. Não houve descarte de evidências, cache baseado apenas em timestamps ou publicação antecipada de sucesso.

## Problema de integridade descoberto durante a validação

Uma falha no caso de 1.200 caminhos revelou dois problemas distintos. O Git oficial atualizava campos de stat do índice privado durante uma consulta de diff; uma asserção que comparava Buffers grandes produzia um diff de erro com consumo extremo de memória no Node.

O produto agora executa consultas de worktree diff sobre uma cópia temporária independente do índice, mantendo a semântica nativa correta e os bytes do índice real. A alternativa de somente desabilitar auto-refresh foi rejeitada: preservava os bytes, mas reportava 1.200 modificações em vez das duas reais em um índice com stat zerado.

O helper de testes agora compara todos os bytes e produz diagnóstico limitado com tamanho/hash/primeiro offset; não entrega Buffers grandes ao formatador. O oráculo não foi relaxado. As falhas e contraprovas permanecem em [INDEX-QUERY.md](INDEX-QUERY.md), [INDEX-QUERY.json](INDEX-QUERY.json) e [INVESTIGATION-RUNS.md](INVESTIGATION-RUNS.md). O gate dirigido V6 de 25 testes e o arquivo R-02/R-03 V6 com seis testes passaram separadamente. Eles não são somados para certificar a suíte completa.

## Materialização e alternativas

O microbenchmark de 100 MiB comparou cópia comum, tentativa de reflink com fallback, reflink obrigatório, streaming seguro e `checkout-index`. O reflink obrigatório retornou três erros reais `ENOSYS` no runtime/NTFS medido. O fallback criou cópias independentes, mas não provou CoW físico. Hardlinks demonstraram compartilhamento indesejado de escritas e não foram adotados; symlinks não foram usados.

Streaming seguro usa mais verificações que uma cópia simples e não é substituível apenas pelo menor tempo do microbenchmark. A extração Git já é aproveitada na preparação. Não houve duplicação permanente, arquitetura de worktrees sincronizadas, cache permanente de bytes ou download remoto na ativação. ReFS/Linux foram avaliados documentalmente, sem execução nem ampliação do suporte. [Decisões, números e fontes primárias](DECISIONS.md).

## Recuperação

GL-19 avança em diagnóstico independente, classificação de imagens atuais, planos/backups e testes de fronteiras antes/depois de publicação. `doctor` continua acessível com registry inválido e distingue journal inválido, backup ausente/modificado, V05 e bytes posteriores. Um plano validado não é anunciado como recuperação concluída.

Os testes cobrem failpoints, exceções sintéticas EIO/EPERM/EACCES/ENOSPC, término abrupto de filhos próprios, índices/refs externos, B preparado/C no disco, várias origens e repetição da recuperação. As modalidades e o estado de execução estão em [RECOVERY.md](RECOVERY.md). Não houve perda real de energia, enchimento do disco ou morte de processo alheio.

A repetição de recover sem reconstrução usa queryIndexTree sobre cópia independente e preserva a identidade física do índice vivo. A alternativa de apenas omitir write-tree foi rejeitada por uma contraprova de blob ausente: cached diff retornou 0 e write-tree, 128. O comando fixo mantém a validação nativa, podendo criar objetos Git ou renovar a data de objetos existentes; não é uma operação globalmente somente leitura. Pendências recuperadas, mudança de branch ou confirmações alteradas mantêm a rota de checkpoint. Os dois novos testes passaram no gate V9 e nos IDs observados 108/109 da full concluída; já estão nos 411 PASS, sem somatório adicional. [Auditoria e decisão](RECOVERY-NOOP-AUDIT.md).

Continuam manuais os estados sem prova determinística: materialização desaparecida, edição posterior incompatível, ref/índice desconhecido, backup ausente/alterado, plano inválido, lock real/disputado/órfão e ambiguidade de propriedade. Não se removem journals ou autorizações revogadas para aumentar a taxa de recuperação.

## Contratos preservados

O desenho conserva Git oficial, branches `layer/<nome>`, várias Layers físicas, staging e histórias separados, commits explícitos, ativação distinta de destino/abertura como branch, proteção opcional e desativação sem auto-park. Não há transferência silenciosa de propriedade. D-01 a D-04, R-02/R-03, revogação durável e V05 conservam seus mecanismos e exigem a validação final registrada em RESULTS.

## Requisitos e alcance da etapa

A classificação permanece em **20 implementados e sete parciais, entre 27 requisitos**. Nenhum parcial é promovido a completo por esta etapa. A [matriz histórica](../2026-11-02-closure/requirements.json) e os [contratos originais](../../decisions/implementation-2026-11-02/02-DECISOES-CONSOLIDADAS.json) foram preservados.

| Classificação mantida | Quantidade | Requisitos |
| --- | ---: | --- |
| Implementados no envelope declarado | 20 | GL-02–08, GL-10–14, GL-16/17, GL-21 e GL-23–27 |
| Parciais | 7 | GL-01, GL-09, GL-15, GL-18, GL-19, GL-20 e GL-22 |

| Requisito parcial | Avanço ou limite |
| --- | --- |
| GL-01 | Git tradicional continua padrão; Git direto mantém force e comandos nativos. Não há interceptação universal. |
| GL-09 | Fronteira explícita e reconciliação por comando; sem observação contínua de todo histórico externo. |
| GL-15 | Troca exige composição compatível e base tracked limpa; fluxos legados ainda limitam arquivos grandes. |
| GL-18 | Exclusões/verificações gerenciadas têm alcance explícito; comandos externos podem contorná-las. |
| GL-19 | Melhor diagnóstico e cobertura de interrupções; recuperação limitada aos fatos persistidos e validáveis. |
| GL-20 | Rename/remove conservadores; sem reconciliação universal de topologias/metadados externos. |
| GL-22 | `open-branch` e reservas opcionais continuam distintos da ativação; bypass nativo documentado. |

## Infraestrutura após a full

A primeira infraestrutura V9 terminou com 113 resultados: 112 PASS, um FAIL e zero SKIP/cancel/todo, exit 1 e fonte209 igual. O teste de cópia nova recusou um pai de fixtures dentro do checkout copiado: `EXISTING_FIXTURE_PARENT_INVALID`. A correção V10 informa explicitamente o pai externo já validado e mantém as asserções. O único delta funcional é tests/git-compat/infra/portability.test.mjs; Core/CLI, corpus full e benchmarks permanecem byte a byte iguais. O fingerprint global V10 é 868271bebd0da32fa1dfdf3d1d11b504c68f6b3912c613797c88013ebb4c9bde; a full415 e as medições continuam identificadas como V9, fingerprint 698f7e3f…, não como uma nova execução global V10. [FAIL preservado](INFRA-V9-FAILED-RESULTS.json) e [detalhes da correção e do D1](RESULTS.md#primeira-infraestrutura-v9-e-correção-restrita-v10). A infraestrutura posterior V10 passou: 113 PASS/113, zero FAIL/SKIP/cancel/todo, exit 0 e fontes iguais, entre 02:55:56.042Z e 02:57:39.134Z de 05/11. D2 manteve docs/runner/fontes inalterados e foi concluído; A matriz V10 permaneceu FAIL; a correção restrita do HARNESS-021 e nove controles locais foram seguidos de nova infraestrutura V11 (113 PASS/113) e nova matriz inteira V11 (355 PASS/seis ENV_BLOCKED/zero FAIL em 361). D5 foi preservado durante a matriz. Essas novas campanhas não apagam nem substituem o resultado anterior. O guard concluiu 44 amostras e o handoff posterior encontrou 64 identidades GONE, sem sinais. [Resultado e limites](RESULTS.md#infraestrutura-v10-concluída-sob-d2).

## Matriz final e bloqueios preservados

A matriz inteira V11 terminou PASS no alcance selecionado: 355 PASS, seis ENV_BLOCKED e zero FAIL entre 361, exit 0 natural, fonte5cc e D5docs321/runner492 inalterados. O guard concluiu 625 amostras; o fechamento root cobriu 1.807 identidades e seis registros de comandos em 22 consultas/lote máximo64, sem sinais. rootClosure foi ACCEPTED, conservando nested quiet=false. O FAIL anterior V10 não foi reclassificado. [Resultados, hashes e seis bloqueios](RESULTS.md#matriz-v11-concluída-e-alcance-da-validação).

RECOVERY-003 mantém PENDING_PRODUCT_SPEC apesar de PASS nas asserções: stage pode concluir depois de avanço externo de ref, conservando ref/índice e diagnóstico stale posterior. RECOVERY-005/006/007 mantêm DOCUMENTED_RESTRICTION de lock órfão, sem recuperação automática. Esses recortes não ampliam os requisitos ou a compatibilidade universal.

Os [recibos e resultados integrais V11](VALIDATION-BROAD-V11.json), a [prova de conservação](VALIDATION-BROAD-V11-SHARDS.json), a [auditoria](BROAD-V11-PRIVACY-AUDIT.json) e a [classificação](BROAD-V11-PRIVACY-CLASSIFICATION.json) permitem revisar o PASS no alcance selecionado e os seis ENV_BLOCKED, sem alterar nested quiet=false.

Os [dados públicos da matriz V10 FAIL](VALIDATION-BROAD-V10-FAILED.json), a [prova de conservação](VALIDATION-BROAD-V10-FAILED-SHARDS.json), a [auditoria](BROAD-V10-FAILED-PRIVACY-AUDIT.json) e a [classificação](BROAD-V10-FAILED-PRIVACY-CLASSIFICATION.json) preservam a campanha anterior integralmente, sem promover seu resultado após o retry.

## Próxima fase e publicação

A preparação para uso público precisa enfrentar latência/escala, retenção e crescimento de journals/backups, procedimentos de triagem manual e envelope efetivo de runtime/Git/Windows/filesystem. A preparação da próxima fase pode avançar com esses limites; ainda há impedimentos para declarar prontidão pública ampla só com esta etapa. Instalador, release, assinatura, binários públicos, deploy e migração real ficaram fora do escopo.

**Registro pré-A (histórico).** Commit, push, igualdade local/remoto/GitHub e cópia nova ainda estão PENDENTES. Serão observados depois das validações; não decorrem da existência deste relatório. Os resultados, comandos, limitações e links estão no [índice](README.md) e no [protocolo de publicação A/B](PUBLICATION.md). Duração de teste não é latência do produto.
