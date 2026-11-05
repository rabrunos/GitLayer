# Resultados — Etapa 2

**Implementação validada em cópia nova; fechamento documental B.** A implementação está no commit local `934befc1516bd12b3aee43c6b4e326d34e647f1b`. A verificação independente da cópia nova A passou, com fontes iguais e runtime relocado sem dependências: [receipt](FRESH-COMMIT-A.json) e [auditoria de privacidade, sem candidatos](FRESH-COMMIT-A-PRIVACY-AUDIT.json). Commit documental B, push, cópia nova B e sincronia serão atestados depois de existirem; nenhum SHA B é antecipado. [Protocolo](PUBLICATION.md).

**Registro pré-A (histórico).** **Validação local executada; publicação pendente.** Infraestrutura V11: 113 PASS/113. Matriz V11: 355 PASS, seis ENV_BLOCKED e zero FAIL entre 361 selecionados. A full415, typecheck/build/smoke e o benchmark permanecem V9, com runtime/Core/corpus iguais ao V11 pela [prova de equivalência](SOURCE-EQUIVALENCE-V9-V11.json). [Infraestrutura](INFRA-V11-RESULTS.json), [receipts](VALIDATION-INFRA-V11.json) e [nove controles HARNESS-021](HARNESS021-AUTHORITY-CONTROLS.json). Cópia nova, commit, push e sincronia ainda não foram comprovados.

## Snapshot candidato e estado

A auditoria confirmou quatro famílias de defeitos: desativação com edição posterior, cópia temporal do índice de consulta, duas fronteiras de cópia/publicação do staging e restauração temporal do índice no rollback. As correções implementadas e os 33 testes novos das quatro famílias foram executados dentro da full V9: 11 de consulta (IDs 97–107), 12 de staging (308–319), seis de recuperação (201–206) e quatro de desativação (69–72), todos PASS nesse recorte. Não constituem uma campanha adicional nem uma aprovação universal. Esse recorte de 33 não inclui os dois testes de validação queryIndexTree acrescentados no V9; os dois fazem parte dos 62 resultados do gate recovery5 abaixo e não são somados novamente. O [relato de integridade](INTEGRITY-AUDIT.md) preserva reproduções e qualificações.

**Registro pré-A (histórico).** **Resultados finais por campanha, sem somatório:** full V9 415 resultados/411 PASS/quatro SKIP; infraestrutura V11 113 PASS/113; matriz V11 361 selecionados/355 PASS/seis ENV_BLOCKED/zero FAIL. Typecheck, build e smoke independente V9 passaram; smoke tem 82 comandos, quatro snapshots e sete etapas. A fonte global V9 era 698f7e3f647381eef19463a5a1fd07252ed875b6a83c5789f1282129ebd97dbc; V11 tem 5cc41446889657aee4f4622a0d5ab3ed46483a01f937cab7218a8c297415b44d. Core18 permanece 23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb e a equivalência de runtime/corpus foi comprovada; isso não rebatiza a full415 como execução global V11. D5 preservou docs321/b1649e41… e runner492/ca46d8db… durante a matriz. Os FAIL anteriores e o HALTED/quiet=false original permanecem históricos. Cópia nova do commit, publicação e sincronia ainda estão pendentes.

**V8 intermediário, encerrado com FAIL.** O snapshot current-v8 tinha 209 entradas funcionais, fingerprint 4ecc0d4bee8edf46fa3011bc5ded80ce2cdd081f436f4728459edc37b6b137ed; seu domínio Core tinha 18 fontes, fingerprint d5b9d18b717b7e08d99d111385a2df76b760d060b02cfa7300b68cd2e1331042, mais uma fonte CLI. O preflight V8 passou; o gate V8 terminou em 2026-11-04T22:31:13.887Z com 70 testes, 68 PASS, dois FAIL e zero SKIP/cancel/todo, exit 1 e fontes inalteradas. Os dois FAIL exigiam idempotência física na repetição da recuperação privada; não foram relaxados nem reclassificados como aprovação. Esse histórico não certifica V9.

O snapshot intermediário arquivado `current-v7` contém 209 entradas funcionais de `src/`, `scripts/`, `tests/`, package JSON e tsconfig JSON, com fingerprint SHA-256 `902c595b8a1477487f88f3fb8f98bbacef0008881e52e232b11d4face1380ba1`. Seu domínio de 18 fontes Core tem fingerprint `40d2992ce900f8bd14d152b8b94b1f7098ad90d9fa73e51acaa10da654a22957`; há também uma fonte CLI. O typecheck preliminar V7-01 concluiu PASS, exit 0. O gate de integridade V7-01 terminou FAIL em oito arquivos, concurrency 1: 70 testes, 67 PASS, três FAIL, zero SKIP/cancel/todo. O recibo terminal confirma fontes inalteradas, exit 1, nenhum timeout/truncamento e resumo completo/consistente. O resultado V7 é histórico e não aprova V8.

O V6 intermediário medido/testado tinha 205 entradas funcionais e fingerprint `f72502adcfd332e3109ad3e82ec845731f376cfc41d5e4a44be5ce89a6c4a825`; seu domínio de 17 fontes Core tinha fingerprint `aab512270756d7888e5c1af60df6cc4b17d08a4376f4161552190a7115d32b35`. Cada fase arquiva os inputs e compara os manifests antes/depois; edição documental não altera esse domínio. Seus benchmarks permanecem INTERMEDIÁRIOS. A campanha V9 terminou separadamente, com nove pares completos e dois endpoints incompletos de 10.000 arquivos; seus dados não são atribuídos ao snapshot V6 nem usados como comparação causal entre campanhas. Os [históricos V6](BENCHMARKS-INTERMEDIATE-V6.md) permanecem preservados.

Plataforma observada: Windows x64 10.0.26200, Node v24.14.1/npm 11.11.0, Git oficial 2.53.0.windows.2. Fixtures e ambientes são próprios, externos e isolados. Não houve execução Electron, teste gráfico, instalação global ou migração real.

## Campanhas e estado das fontes

Cada linha é uma campanha independente. Não se somam seus resultados para construir um total de aprovação.

| Campanha | Resultado observado | Estado |
| --- | --- | --- |
| Typecheck preliminar V9-01 | Exit 0; 209 inputs, fingerprint 698f7e3f…, fonte igual | PASS; não substitui a fase final |
| Gate recovery5 V9-01 | Cinco arquivos, 62 resultados (incluindo subtests): 61 PASS, 0 FAIL, 1 SKIP; 54 pais; fonte igual | PASS dirigido; não se soma à full final |
| Benchmark final V9 | 18 endpoints PASS/nove pares; dois TIMEOUT_OWNED em 10.000 arquivos; fonte igual e quiet comprovado | ENCERRADO; incompleto na escala 10k, sem delta nesse caso |
| Headless completa V9 | 415 resultados: 411 PASS, 4 SKIP, 0 FAIL/cancel/todo; exit 0, resumo consistente e fonte igual | PASS no corpus completo; [linhas finais](FULL-V9-RESULTS.json) |
| Guard da full | COMPLETED; 2.855 amostras e zero identidades registradas presentes ao final | Monitor concluído; não substitui handoff independente |
| Pipeline externa após full | HALTED ao converter uma amostra de memória com executável ausente; FINAL quiet=false | Falha posterior do coordenador; handoff posterior comprovado; continuação posterior PASS em typecheck/build/smoke, sem alterar a full |
| Projeção final de benchmarks | 73 controles sintéticos PASS no gerador ce5d; nenhum teste Core/CLI incluído nessa contagem | PASS no utilitário; independente da suíte |
| Auditor independente | 44 controles sintéticos PASS no helper 808cb; limites negativos recusam excesso | PASS no utilitário; não prova ausência universal de segredo |
| Distribuição dos benchmarks | Dez cases integrais/130 registros; igualdade de remontagem e digest de 319.987 nós | PASS documental; [recibo](BENCHMARKS-SHARDS.json) |
| Privacidade dos benchmarks | Treze artefatos, exit 0 e NO_CANDIDATES_OBSERVED | [Auditoria](BENCHMARKS-PRIVACY-AUDIT.json); este lote editorial posterior ainda não auditado |
| Typecheck preliminar V8-01 | Exit 0; 209 inputs, fingerprint 4ecc0d4b…, fonte inalterada | PASS; não substitui typecheck/suítes finais |
| Gate de integridade V8-01 | 70 testes: 68 PASS, 2 FAIL, 0 SKIP/cancel/todo; fonte 4ecc0d4b… igual | FAIL terminal; exit 1; histórico preservado |
| Typecheck preliminar V7-01 | Exit 0; 209 inputs, fingerprint `902c595b…`, fonte inalterada | PASS; não substitui typecheck/suítes finais |
| Gate de integridade V7-01 | 70 testes: 67 PASS, três FAIL, zero SKIP/cancel/todo; oito arquivos, concurrency 1; fontes iguais | FAIL terminal; exit 1; não é a suíte completa |
| Typecheck preliminar V6-02 | Exit 0; fingerprint funcional preservado | PASS no snapshot V6 intermediário; não substitui a fase final posterior |
| Dirigido de consultas/streaming/asserção limitada V6-01 | 25 PASS, zero FAIL/SKIP/cancel; 13 testes de consulta, seis de streaming e seis de asserção | PASS; [linhas individuais](DIRECTED-QUERY-RESULTS.json) |
| Arquivo R-02/R-03 V6-01 | Seis PASS, zero FAIL/SKIP/cancel; oráculos anteriores preservados | PASS; independente do dirigido de 25 |
| Headless completa F725-01 | Mesmo corpus/concurrency/timeout do npm test, com reporters spec/TAP | INTERROMPIDA controladamente; FAIL/incompleta, sem totais finais |
| Infraestrutura V9-01 | 113 resultados: 112 PASS, 1 FAIL, 0 SKIP/cancel/todo; exit 1, sem timeout/truncamento, fonte V9 igual | FAIL terminal; [linhas públicas](INFRA-V9-FAILED-RESULTS.json) |
| Infraestrutura V10 após correção de isolamento | 113 PASS/113, 0 FAIL/SKIP/cancel/todo; exit 0 natural, fonte868271… igual; mesmo corpus/oráculos | PASS; não aprova retroativamente V9 |
| Matriz ampla V10 | 361 selecionados: 354 PASS, 1 FAIL (HARNESS-021), 6 ENV_BLOCKED; fontes/docs/runner/snapshot iguais | FAIL terminal; não reclassificado após a correção |
| Infraestrutura V11 | 113 PASS/113, zero FAIL/SKIP; fonte V11 e documentos D4 inalterados | PASS; [linhas](INFRA-V11-RESULTS.json) e [receipts](VALIDATION-INFRA-V11.json) |
| Matriz inteira V11 | 361 selecionados: 355 PASS, 6 ENV_BLOCKED, 0 FAIL; exit 0 natural; source/docs/runner/snapshot iguais | PASS no alcance selecionado; seis bloqueios preservados, fechamento independente aceito |
| Typecheck final | TypeScript sem emissão; exit 0 e fonte209 igual | PASS independente; não soma testes à full |
| Build independente Core/CLI | Saída dist-core, sem desktop; fonte209 igual | PASS independente |
| Smoke compilado/relocado | 82 comandos, quatro snapshots e sete etapas; fonte209 igual | PASS independente; comandos não somam ao denominador da full |
| Cópia nova do commit A | Commit 934befc1516bd12b3aee43c6b4e326d34e647f1b; 22 comandos com códigos esperados; smoke82/sete fluxos/quatro snapshots; quatro grupos e compilado preservados | PASS; [receipt](FRESH-COMMIT-A.json) |
| Cópia nova do commit B | Execução posterior ao push do SHA B efetivo | PENDENTE; SHA e resultado só depois de existirem |

O recibo preflight-typecheck-v8-01/result.json tem SHA-256 fb78614ab29e0fb585b85b56806f30d2f1c4a33461054fd5fb5c892f9834cd6d, 1.773 bytes; registra início em 2026-11-04T22:12:22.001Z, fim em 22:12:25.643Z, exit 0 e fingerprint 4ecc0d4b… antes/depois igual. O STARTED do gate V8 registra início em 22:12:34.398Z, a mesma fonte e seleção integral dos oito arquivos; não é recibo de conclusão. O manifesto do congelamento current-v8-receipt.json tem SHA-256 bfc5f9739475d61e95780130c42ab93a1c82be859792401742ef1b4f05c768d9.

**Idempotência física no V8 e decisão posterior.** Os dois FAIL privados (37 e 38) ocorreram na repetição já concluída: inode, mtime e ctime mudaram, embora a primeira recuperação tivesse satisfeito as comparações integrais de B/restauração/replay e C permanecesse detectável. A [auditoria derivada](RECOVERY-NOOP-AUDIT.md) isolou a escrita física. A proposta inicial de apenas omitir o checkpoint foi superada: a contraprova de objeto ausente retornou 0 no cached diff e 128 no write-tree. V9 mantém a validação nativa em cópia independente com queryIndexTree quando não há reconstrução a publicar; pendências, movimento de branch ou confirmações alteradas conservam a rota anterior de checkpoint. Nenhum dos seis oráculos de recuperação foi reduzido.

O gate V8 terminou com resumo completo/consistente e fontes 4ecc0d4b… iguais; seu result.json tem SHA-256 2baa69e8a5771920388e179f70aa6f178e4003bfce8a696f7548b96ba9b5ed03, 6.355 bytes. Seus dois FAIL permanecem no original.

O preflight-typecheck-v9-01/result.json tem SHA-256 89683d33401e646b3b17ee1fb33a7d543764dc63f7d6cecf3246b327d808344d, com execução de 22:41:01.542Z a 22:41:05.220Z, exit 0 e fonte 698f7e3f… igual. O congelamento current-v9-receipt.json tem SHA-256 29803992eba5c9366f65fa48cae85ec275cdbf68bdbb4ed27863f5de2bdd0937.

O integrity-gate-v9-01/result.json tem SHA-256 b6be828634195c7154ad2741816081ac1e821477d65a5e859d633c44eba57c0d, 5.650 bytes. Executou de 22:41:09.597Z a 22:50:00.702Z, com cinco arquivos completamente iniciados, 54 pais no plano TAP e 62 resultados incluindo subtests. São 61 PASS, zero FAIL/cancel/todo e um SKIP original: “Windows account cannot create symlinks.”, no teste de recuperação de destinos symlink. O monitor terminou aprovado e o processo saiu 0 sem timeout/truncamento; o fingerprint 698f7e3f… permaneceu igual. As [linhas públicas flat](DIRECTED-V9-RESULTS.json) conservam indentação/IDs observados, sem reconstruir hierarquia TAP. A [auditoria](DIRECTED-V9-PRIVACY-AUDIT.json) e a [classificação](DIRECTED-V9-PRIVACY-CLASSIFICATION.json) distinguem achados técnicos de informação privada. Isso não é a suíte completa e não se soma a V8/V7.

A pipeline-v9-01 é uma execução concreta, iniciada em 2026-11-04T22:47:08.063Z (19:47:08 em America/Sao_Paulo). O orquestrador revisado pipeline-v8.mjs tem SHA-256 700da9e5daeb8668bf07deae1d377592f7d11a42122d3cbb3d6e978d51cb7596; seu auxiliar de identidade de processos tem SHA-256 2b282f6232d79e4a8afbfaa75466677f23ede57818d06a83d8ef9e6d5b52cd39. Ele acompanhou o gate já iniciado e avançou somente após PASS, fontes iguais e encerramento próprio comprovado. O benchmark começou em 22:50:03.262Z e terminou em 23:57:56.907Z, antes do deadline 2026-11-05T01:20:03.262Z. O orçamento era de 150 minutos, com vinte minutos por endpoint n1; o elapsed de 4.073.645 ms inclui teardown/finalização e não é latência do produto. O FINAL registra 18 PASS, dois TIMEOUT_OWNED, zero FAIL e zero NOT_RUN, quiet e fontes iguais. Os dois timeouts continuam incompletos, sem delta. O [índice](BENCHMARKS.json) mantém todos os 130 registros de comparação; a [distribuição](BENCHMARKS-SHARDS.json) conserva integralmente os dez cases, inclusive os timeouts.

Após o benchmark, a pipeline executou a full, que terminou PASS com fonte igual. O coordenador externo ficou HALTED no handoff posterior, ao converter uma amostra de memória sem executável; seu FINAL quiet=false continua preservado. Uma prova posterior independente confirmou o handoff como CLOSURE_PROVEN/quiet=true; o FINAL original permanece HALTED/quiet=false. A continuação posterior concluiu typecheck/build/smoke com PASS, fonte igual e quiet=true. A primeira infraestrutura terminou FAIL sob D1; a infraestrutura posterior V10 passou com 113 PASS/113 sob D2. A matriz V10 permaneceu FAIL; infraestrutura e matriz inteira V11 passaram posteriormente em novas campanhas, identificadas abaixo. Os 73 controles de projeção, 44 do auditor e a remontagem são campanhas de utilitários, sem somatório à full. Nenhuma publicação ou retomada normal é inferida desse estado.

O gate V7 começou em 2026-11-04T20:42:37.291Z e terminou em 21:33:28.828Z. O recibo externo `integrity-gate-v7-01/result.json` tem SHA-256 `f7e70fa78fb444e5a8e5dd94b496429654fff8ae625e02b498450dba0c75f90a`, 6.355 bytes; confirma fingerprint `902c595b…` antes/depois igual, 209 inputs e delta vazio. Os três FAIL são preservados. Não se somam os 67 PASS a campanhas anteriores.

Em 20:54:57Z foi observada a falha `path-replaced-at-open`: o helper recusou antes de escrever metadados, mas retornou `UNSAFE_PATH` em vez de `EXTERNAL_EDIT` exigido pelo teste. Não houve sobrescrita observada. Naquele momento, a correção candidata propunha mudar a ordem de comprovação da identidade do FD/caminho e exigia nova execução; o oráculo não foi relaxado. A rota posterior foi executada no V9, sem alterar retroativamente o FAIL original.

Os FAIL 37 e 38 eram comparações do índice privado final de 225 bytes com o backup anterior ao checkpoint, com primeira divergência no offset 131. A investigação inicialmente pendente foi resolvida por auditoria somente leitura e replay nativo independente: o write-tree do Git oficial produz exatamente todos os 225 bytes finais nas duas configurações, com C ainda detectado como M. O tamanho stat racy passou de cinco para zero e o checksum foi atualizado; A/B/C, fontes, backups e refs permaneceram preservados. A expectativa final pré-checkpoint era inadequada. O [anexo público de replay](AUDIT-PRIVATE-INDEX-REPLAY.md) e seu [JSON](AUDIT-PRIVATE-INDEX-REPLAY.json) conservam os hashes dos originais, inclusive `bc8446c6ce07545beb7b630ad7b4c2f264ac8485b90866896c36aa6d24ddab46`.

A revisão candidata conserva bytes integrais: B raw exato no rename de restauração antes do checkpoint, e índice privado final exato contra o write-tree nativo independente. Não ignora campos stat/checksum nem substitui o oráculo por comparação semântica. MAIN, testes de falha no sync e os seis R-02/R-03 emitiram PASS no gate, mas a campanha original permanece FAIL. A correção do helper e dos dois oráculos compôs o V8 congelado acima, cujo gate terminou com FAIL, como registrado nesta página. O gate V9 posterior tem escopo dirigido próprio; não há PASS retroativo de V7/V8 nem certificação integral antecipada.

O recibo externo `preflight-typecheck-v7-01/result.json` tem SHA-256 `5a98ba16ed9df23ec9a95c6bb2733f3e346937c07d78b0455086983ab02e34a3`; registra início em 2026-11-04T20:41:35.187Z, fim em 20:41:39.301Z, exit 0 e igualdade dos manifests antes/depois. É execução local, sem afirmação de CI remoto.

A campanha headless completa V6 começou em 2026-11-04T19:21:55Z. Foi interrompida às 19:58:28Z para corrigir o defeito racy confirmado. O snapshot permaneceu igual antes/depois; guard sem trigger e processos próprios registrados encerrados. Os 25 pais PASS observados são somente linhas parciais, sem denominador final; o restante é NOT_COMPLETED. O próximo snapshot exigirá nova campanha completa.

## Suíte headless completa V9 e handoff do controlador

A execução foi de 2026-11-04T23:57:57.452Z a 2026-11-05T01:56:04.136Z. O resultado terminal da full registra **415 resultados, 411 PASS, quatro SKIP e zero FAIL/cancel/todo**, exit 0, nenhum sinal/timeout/truncamento e fingerprint funcional209 698f7e3f… igual antes/depois. Seu receipt bruto tem 2.518 bytes e SHA-256 9be7e11ab46a04bd0806c425528001072d8aa8b3f606006a0b4de2ec1e3575ce.

A [projeção pública da full](FULL-V9-RESULTS.json), SHA-256 57cb324f4b725fc9e3a412e91682d71fce8fe3af0699e9edd1d7cd12a1037c9c, contém as 415 linhas flat, correspondentes ao resumo Node final verificado. Preserva IDs/indentação observados sem reconstruir hierarquia. O stream TAP original, de 196.835 bytes, permanece identificado por SHA-256 8a41ff2e08d18e368f69ffc4f156d77e29565717bbafa2dadc7124fb11ae7c20; seu conteúdo bruto não foi publicado. A [auditoria](FULL-V9-PRIVACY-AUDIT.json) e a [classificação](FULL-V9-PRIVACY-CLASSIFICATION.json) documentam duas ocorrências técnicas dos caminhos de instalação Git/Node, sem apagar os originais.

Os SKIP são os quatro resultados originais abaixo. Não viraram PASS nem ENV_BLOCKED:

| ID TAP observado | Caso | Motivo exato |
| --- | --- | --- |
| 38 | symlink file and paths through symlink directories are never adopted | Windows account cannot create symlinks; junction coverage runs separately. |
| 211 | recovery cannot overwrite journals, arbitrary Git internals or symlink targets | Windows account cannot create symlinks. |
| 327 | storage refuses symlink sources, destinations and parent directories | Windows account cannot create symlinks. |
| 388 | terminal: Bash real preserva argumentos e não avalia metacaracteres da mensagem | Roundtrip Bash do host; o fluxo PowerShell tem verificação separada. |

Os dois novos queryIndexTree são os IDs observados 108 e 109, ambos PASS dentro dos 411; não se somam como uma campanha adicional. O mesmo vale para os seis testes de rollback temporal já presentes no dirigido.

**O controlador original falhou no handoff.** O monitor de memória terminou COMPLETED com 2.855 amostras, motivo explicit matching STOP nonce e zero identidades registradas presentes ao final; receipt SHA-256 1ed099265510716c1f8470ca38a725bcb8f297c6459a1aeb9d8affc9f8da4ad0. Isso é evidência do monitor e não substitui a prova global de encerramento da árvore própria.

Depois desses términos, a conversão das amostras do controlador encontrou uma observação Git com executable ausente entre 14.595 observações. A pipeline registrou HALTED em 2026-11-05T01:56:05.229Z, AssertionError/ERR_ASSERTION e quiet=false; seu FINAL original tem SHA-256 2736b6db68fe19f820947bdf535ff9850c7e6fc99aee5073cc981b46a415f750. Esse registro permanece inalterado. A falha é do coordenador externo, posterior ao resultado Node, e não altera os 411 PASS/quatro SKIP nem constitui um FAIL de teste do produto.

**Registro pré-A (histórico).** O handoff foi comprovado posteriormente por uma verificação independente e somente leitura: CLOSURE_PROVEN, quiet=true, 128 identidades, duas consultas e nenhum processo sinalizado, SHA-256 766ea1c35983f54929d760a4b8344d97a740426406dbd80ab2c5fe6e0fbbe721. Essa prova não modifica o FINAL original HALTED/quiet=false. A continuação posterior concluiu typecheck/build/smoke com PASS, fonte209 igual e quiet=true; a primeira infraestrutura V9 terminou FAIL sob D1 e a infraestrutura posterior V10 passou com 113 PASS/113 sob D2. A matriz V10 permaneceu FAIL; as campanhas posteriores de infraestrutura e matriz inteira V11 passaram, com seus escopos separados abaixo. Cópia nova, commit, push e sincronização continuam pendentes.

## Continuação final: typecheck, build e smoke

Depois do handoff independente, a nova continuação concluiu as três fases com PASS, fonte funcional209 698f7e3f… igual antes/depois e encerramento próprio quiet=true. O FINAL dessa execução tem SHA-256 57e0e6468075c71275abf95d6be677b1b9ba49f7ca3542e8c7704c8c8141a903. Ele não substitui nem reclassifica o FINAL HALTED/quiet=false do coordenador anterior.

| Fase independente | Resultado e alcance | SHA-256 do receipt original |
| --- | --- | --- |
| Typecheck final | PASS; concluído em 2026-11-05T02:10:55.849Z; fonte209 igual | 3ddf8ed2674134ca3a2fb5c7f32c1ce2fd170cfc82857a7c08853b0dff16cf10 |
| Build Core/CLI | PASS; concluído em 2026-11-05T02:10:56.822Z; fonte209 igual | a69c023b597d8460a3ab040b0c259877d9630b572d1991e671ad776338158c26 |
| Smoke compilado/relocado | PASS; 82 comandos, quatro snapshots e sete etapas; fonte209 igual | c52a842250ea671cde1528be0882b74c65fe3cd6baf6680b16b96ab1c28b0891 |

Esses comandos e snapshots não são testes adicionais ao denominador de 415. A [projeção pública conjunta dos receipts das fases](VALIDATION-CORE-V9.json), sua [auditoria](VALIDATION-CORE-V9-PRIVACY-AUDIT.json) e sua [classificação técnica](VALIDATION-CORE-V9-PRIVACY-CLASSIFICATION.json) foram preservadas separadamente. A [prova posterior de handoff](FULL-V9-CLOSURE-HANDOFF.json) e a [evidência de memória](FULL-V9-MEMORY.json) já estão preservadas separadamente.

**Registro pré-A (histórico).** A primeira infraestrutura V9 terminou FAIL sob D1; a infraestrutura posterior V10 concluiu 113 PASS/113 sob D2, sem alterar o primeiro resultado. A matriz V10 terminou FAIL; infraestrutura e matriz inteira V11 passaram posteriormente, sem reaproveitar aprovações entre campanhas. Cópia nova do commit, commit/push e verificação local/remoto/GitHub continuam pendentes. Nenhum check remoto de CI é inferido dessas execuções locais.

## Primeira infraestrutura V9 e correção restrita V10

A execução de 2026-11-05T02:36:36.500Z a 02:37:39.139Z terminou FAIL: **113 resultados, 112 PASS, um FAIL e zero SKIP/cancel/todo**, exit 1, sem timeout ou truncamento. A fonte funcional209 permaneceu 698f7e3f647381eef19463a5a1fd07252ed875b6a83c5789f1282129ebd97dbc antes/depois. A [projeção TAP](INFRA-V9-FAILED-RESULTS.json), SHA-256 2850e5cf8e43b6cd947c42c0e8e15b82c1920bed7175dc5e03a360e3a0fac6c4, conserva todas as linhas; [auditoria](INFRA-V9-FAILED-PRIVACY-AUDIT.json) e [classificação](INFRA-V9-FAILED-PRIVACY-CLASSIFICATION.json) acompanham os caminhos técnicos observados. O receipt bruto tem SHA-256 f3d82c0800fcf630193f7ea3127caa0e7fc4ecaefa9edeeb41db182dd349fc0b. O resultado original continua FAIL.

O teste de nível superior 55, `fresh copy accepts an authorized source baseline and reports its archived execution after a later edit without private brief`, falhou em `02-copied-runner`: exit 2 em vez de 0, com `EXISTING_FIXTURE_PARENT_INVALID`. O TEMP isolado estava dentro do checkout copiado e não podia servir como pai das fixtures Git internas. A correção em [portability.test.mjs](../../../tests/git-compat/infra/portability.test.mjs#L51) passa explicitamente `GIT_COMPAT_EXTERNAL_FIXTURE_PARENT=externalFixtureParent(project)` e acrescenta a asserção de que esse pai fica fora de copyRoot. Nenhuma expectativa foi removida ou convertida em SKIP; a recusa original de isolamento continua correta.

O snapshot V10 contém as mesmas 209 entradas no domínio funcional, com fingerprint 868271bebd0da32fa1dfdf3d1d11b504c68f6b3912c613797c88013ebb4c9bde. O único arquivo alterado desde V9 é esse teste de infraestrutura, SHA-256 202d5a8482b6b1f87dc68ab645de6c4410cb08268fb24d4cc68366e5e9fcc80a. Core18 conserva 23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb; CLI, runtime, corpus full e scripts de benchmark não mudaram. Essa equivalência de escopo permite identificar os resultados já executados, mas não transforma a full415 em uma execução do fingerprint global V10. Benchmark, dirigido, full e typecheck/build/smoke continuam identificados como V9. A infraestrutura posterior V10 concluiu 113 PASS/113; a matriz V10 posterior terminou FAIL e a nova matriz inteira V11 passou em campanha separada, como documentado abaixo.

D1 foi efetivamente congelado e mantido durante a primeira infraestrutura. A conferência posterior registrou docsUnchanged=true e runnerUnchanged=true, com fingerprints 40ec9dc1ae961e5c9a0e661b93f580778f97aa6ba4845db5e0877e5c53fd57c2 e d355b433fe05e65f5ea6b25d4a97ec38b4c5d945bf37f7b780731027f3. O receipt AFTER-INFRA tem SHA-256 89778b0cb9c13bd68b7bbc45198180182b8b7003e6a03da43a319d13ae5d9768. D1 foi liberado para a atualização anterior. A campanha posterior V10 passou sob D2, preservado e depois liberado; A matriz V10 permaneceu FAIL; D4/D5 e as novas infraestrutura/matriz inteiras V11 foram executados posteriormente, com resultados próprios. O PASS posterior é outra campanha, sem apagar ou somar este FAIL.

## Infraestrutura V10 concluída sob D2

A infraestrutura posterior executou de 2026-11-05T02:55:56.042Z a 02:57:39.134Z e concluiu **113 PASS em 113 resultados, zero FAIL/SKIP/cancel/todo**, exit 0 natural e 102.547 ms de processo. O fingerprint funcional209 868271bebd0da32fa1dfdf3d1d11b504c68f6b3912c613797c88013ebb4c9bde permaneceu igual antes/depois. São o mesmo corpus e os mesmos oráculos, com o pai externo explícito na fixture de portabilidade; o FAIL original 112/1 permanece registrado acima.

O guard terminou COMPLETED com 44 amostras e nenhuma identidade presente na observação final. O handoff posterior conferiu 64 identidades em uma consulta: todas GONE, nenhum processo sinalizado, SHA-256 fc11da92763f59d9f7389f5c971161755d8646a4d211133b29e8707c0cfd4a1c. A conferência de D2 encontrou 311 documentos, 482 entradas do runner e 209 fontes funcionais inalterados. D2 está concluído e liberado; A matriz V10 permaneceu FAIL; novas infraestrutura e matriz inteira V11 foram executadas depois e passaram em seus escopos. O monitor e o handoff têm escopos próprios e não somam testes.

As [113 linhas TAP públicas](INFRA-V10-RESULTS.json), SHA-256 3342383ebf0203e45b59784047204f178d1c197b917e1db9a4fcf3dc866c62ca, e os [receipts de infraestrutura](VALIDATION-INFRA-V10.json), SHA-256 1e512dfd4a8d5c5457a7259789edb9b94bdaba4a8464b480edad6f314390423e, preservam campanhas separadas. A [auditoria](INFRA-V10-PRIVACY-AUDIT.json) cobre esses artefatos e a prova de equivalência V9/V10; a [classificação técnica](INFRA-V10-PRIVACY-CLASSIFICATION.json) documenta dez ocorrências apenas dos caminhos públicos de instalação Node/Git. A full415 continua identificada como V9/global698f7e3f…, com equivalência de runtime/corpus comprovada separadamente, sem rebatizá-la como uma execução global V10.

A comparação V9 também conserva uma regressão n3 sem Layers: recover-empty passou de mediana 282,978 para 348,117 ms, +23,019%, classificada MEASURED_HIGHER_LATENCY. Ela se soma aos casos de maior latência observada, sem ocultar os resultados inconclusivos ou n1; não se atribui a uma alteração isolada. Todos os 130 registros permanecem em BENCHMARKS.json.

## Matriz V10 FAIL e correção restrita V11

A matriz ampla V10, jobs 2 e seed 20261104, terminou em 2026-11-05T03:37:35.341Z com **361 selecionados: 354 PASS, um FAIL e seis ENV_BLOCKED**. Fontes, documentos, runner e snapshot permaneceram inalterados durante D3. O único FAIL foi HARNESS-021, cuja expectativa de autoridade documental ainda tratava a etapa 1B como a missão atual. A Etapa 2 é a autoridade atual, e 1B permanece histórica com suas garantias preservadas. O resultado V10 continua FAIL; os seis bloqueios conservam os motivos observados, sem conversão em PASS ou SKIP.

O guard terminou COMPLETED com 599 amostras e nenhuma identidade na observação final. O wrapper registrou quiet=false ao exigir recibos execute para seis ciclos manuais de comando. Esse diagnóstico da coordenação permanece separado do FAIL do cenário. Um handoff posterior independente fez 1.770 observações ao longo de 19 consultas, encontrou zero identidades presentes e não sinalizou processos; ele não altera o quiet=false original nem converte a campanha em PASS.

A correção posterior em [harness-extra.mjs](../../../tests/git-compat/cases/harness-extra.mjs#L30) atualiza somente o reconhecimento da autoridade atual/histórica. Mantém os checks anteriores e o hash da referência 1B; nove controles locais passaram nesse recorte, sem certificar o Core ou substituir a matriz inteira. A nova fonte funcional209 V11 tem fingerprint 5cc41446889657aee4f4622a0d5ab3ed46483a01f937cab7218a8c297415b44d; Core18 conserva 23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb. Os dois deltas de testes desde a full V9 são a fixture de portabilidade e esse caso de autoridade; a [prova pública de equivalência V9/V11](SOURCE-EQUIVALENCE-V9-V11.json), SHA-256 590960f20f08178b26966a533857591a7a40f7cfd592b14a6456fb3a88a7fa46, foi preservada. A full415 e o benchmark continuam identificados como V9, não como novas execuções globais V11.

**Registro pré-A (histórico).** No fechamento da campanha V10, infraestrutura e matriz inteira V11 ainda eram pendentes. Ambas foram executadas posteriormente, como novas campanhas: infraestrutura 113 PASS/113; matriz inteira 355 PASS/seis ENV_BLOCKED/zero FAIL em 361. A aprovação não foi montada a partir dos 354 PASS anteriores e um foco corrigido. Os [dados públicos da matriz V10 FAIL](VALIDATION-BROAD-V10-FAILED.json), sua [conservação](VALIDATION-BROAD-V10-FAILED-SHARDS.json), [auditoria](BROAD-V10-FAILED-PRIVACY-AUDIT.json) e [classificação](BROAD-V10-FAILED-PRIVACY-CLASSIFICATION.json) estão preservados; os [nove controles](HARNESS021-AUTHORITY-CONTROLS.json) e a [equivalência V9/V11](SOURCE-EQUIVALENCE-V9-V11.json) já estão preservados. Cópia nova, commit, push e sincronização continuam pendentes.

## Matriz V11 concluída e alcance da validação

A nova matriz inteira V11 concluiu em **2026-11-05T04:41:22.179Z**, com **361 selecionados: 355 PASS, seis ENV_BLOCKED e zero FAIL**, exit 0 natural. Seu result.json tem SHA-256 7e1cd87dea62b65a094861690af9d81f88e95d09a3801da2db889a80b9e2d782. As fontes funcionais209 permaneceram 5cc41446889657aee4f4622a0d5ab3ed46483a01f937cab7218a8c297415b44d; D5 confirmou docs321 b1649e419699145e2423ec5ce9d3e110e5be7aa9082214d4ba740dab5cd322af e runner492 ca46d8dbf3a7a7bb05c23e512922bfce2b16abbbe80a0043e47a2315c6bcd408 inalterados, além do snapshot. Jobs 2, seed 20261104 e fixtures retidas conservaram a seleção inteira. Não houve composição de resultados com a matriz V10 FAIL.

O guard terminou COMPLETED com 625 amostras e nenhuma identidade presente no seu tail final; sua sessão de ferramenta foi fechada. A prova root independente cobriu 1.807 identidades registradas do guard e os seis registros de comandos sinalizados, em 22 consultas de PIDs conhecidos, lote máximo64, sem sinais ou inventário global. O coordenador recebeu rootClosure ACCEPTED. O **nested quiet=false original continua preservado**: a prova posterior não reescreve o ciclo de vida dos seis comandos nem o resultado V10.

O receipt root tem SHA-256 0ff48a08e643d9c75c35dc6666825d0fe90e0e0874a5b86f06fb3fdfc82ae9c7; a prova privada conservada tem SHA-256 1f38b54424c9f9c266bd5ec5c6bc6707c8ebb6e6235e7fa7194402fdeaabad41. São evidências externas da coordenação, sem executar reparo, apagar locks ou ampliar a garantia de recuperação do produto. Os [recibos e resultados integrais V11](VALIDATION-BROAD-V11.json), a [prova de conservação e distribuição](VALIDATION-BROAD-V11-SHARDS.json), a [auditoria](BROAD-V11-PRIVACY-AUDIT.json) e a [classificação técnica](BROAD-V11-PRIVACY-CLASSIFICATION.json) estão disponíveis para revisão. Os dados preservam os seis bloqueios, as campanhas separadas e o nested quiet=false original.

| ENV_BLOCKED V11 | Motivo e operação não certificada |
| --- | --- |
| INDEX-018/native-advanced | O Git efetivo não anuncia --resolved em add -h; resolved-staging não foi executado. |
| BRANCH-015/native-advanced | O Git efetivo não anuncia --delete-merged; nenhuma remoção correspondente foi certificada. |
| REWRITE-015/native-advanced | Builtin history ausente em --list-cmds=builtins; nenhum git-history externo foi lançado. |
| REMOTE-014/native-advanced | Builtin url-parse ausente; transporte de URL não é inferido de help ou parser de terceiros. |
| PROTO-007/native | git-shell ausente nos caminhos oficiais inspecionados; nenhum comando git-shell foi executado funcionalmente. Probe de disponibilidade não é PASS de shell. |
| TOOLS-003/legacy-transport | Gitweb CGI ausente nos caminhos oficiais padrão/configurados da fixture; probes isolados de PATH ficaram registrados. Nenhum browser/servidor foi iniciado, sem alegar ausência em todo o host. |

Os seis bloqueios continuam ENV_BLOCKED; não foram convertidos em PASS, SKIP ou suporte. Os dados finais preservarão os motivos integrais. Os registros brutos da matriz têm SHA-256 e8106d1977fe0eb94c4f2d93768cca777538f658852a8ab4007aaed51572a13f. Entre os casos RECOVERY conferidos individualmente, 001/014 são PASS com VERIFIED_SUPPORTED; 005/006/007 são PASS com DOCUMENTED_RESTRICTION; 003 é PASS de caracterização com PENDING_PRODUCT_SPEC. Neste último, stage pode concluir após avanço externo de ref, preserva ref/stage e o diagnóstico posterior acusa stale. PASS de asserções não elimina essa limitação.

Full415, dirigido62, typecheck/build/smoke e benchmark continuam identificados como V9. A prova SOURCE-EQUIVALENCE-V9-V11.json, SHA-256 590960f20f08178b26966a533857591a7a40f7cfd592b14a6456fb3a88a7fa46, comprova o mesmo Core18 23c0b284f827cf30c07264874591e0b14da2dafee373885f214181152d2f7feb, CLI/runtime e corpus unit/integration; os dois deltas V11 são somente os testes de portabilidade e autoridade documental. Infraestrutura e matriz V11 têm seus resultados próprios. Nenhum denominador é somado e nenhum resultado antigo é renomeado.

**Registro pré-A (histórico).** Esta prosa e os anexos finais são posteriores ao freeze documental D5 e não são apresentados como os bytes documentais testados naquele freeze. O código funcional5cc permanece congelado. Instalação em cópia nova do commit, auditoria/publicação final, commit/push e igualdade local/remoto/GitHub ainda são PENDENTES. A próxima fase pode preparar uso público com os limites de latência, O(N²) do journal, 10k incompleto, triagem manual e envelope de runtime; não há declaração de prontidão pública ampla.

## Comandos e política de execução

O supervisor versionado é [validate-performance-recovery.mjs](../../../scripts/validate-performance-recovery.mjs):

```powershell
node scripts/validate-performance-recovery.mjs --phase full --out <NOVO-DIRETORIO-EXTERNO> --fixture-parent <RAIZ-EXTERNA-VALIDADA>
node scripts/validate-performance-recovery.mjs --phase infra --out <NOVO-DIRETORIO-EXTERNO> --fixture-parent <RAIZ-EXTERNA-VALIDADA>
node scripts/validate-performance-recovery.mjs --phase broad --out <NOVO-DIRETORIO-EXTERNO> --fixture-parent <RAIZ-EXTERNA-VALIDADA>
node scripts/validate-performance-recovery.mjs --phase typecheck --out <NOVO-DIRETORIO-EXTERNO>
node scripts/validate-performance-recovery.mjs --phase build --out <NOVO-DIRETORIO-EXTERNO>
node scripts/validate-performance-recovery.mjs --phase smoke --out <NOVO-DIRETORIO-EXTERNO>
```

A tabela acima distingue comandos executados e pendentes; o bloco não é evidência de que todos foram executados.

Full usa Node `--import tsx --test --test-concurrency=2 --test-timeout=900000` sobre todos os arquivos unit/integration `.test.ts` e `.test.mjs`, com spec em stdout e TAP em stderr. O corpus, concorrência e timeout por teste equivalem a `npm.cmd test`; o orçamento global é de três horas. Infra tem trinta minutos; broad, três horas; typecheck/build, 120 s cada; smoke, trinta minutos. Timeout, falha de processo, saída truncada, fonte alterada ou resumo inconsistente não viram SKIP/ENV_BLOCKED.

HOME/USERPROFILE/XDG, identidade, configurações Git, credenciais/helpers, editores, pagers e temporários são isolados por subprocesso. O Git oficial usa caminho absoluto. Fixtures destrutivas têm marcador/nonce e ancestralidade validada. Não se usa origin do projeto como fixture de transporte.

Durante full e os gates posteriores há monitor externo dos processos próprios, identificado por executable, PID/data de criação e ancestralidade. O limite nominal é 2 GiB de memória privada por Node próprio, com amostragem nominal de um segundo mais o custo de CIM. Não é um teto instantâneo. Um trigger preserva recibo e encerra somente a árvore própria; nunca converte a campanha em aprovação. O monitor de validação não roda em paralelo com o benchmark; o estado de cada campanha é identificado acima.

No início de full, o monitor observou pressão global de commit de memória do Windows perto de 94–97%, enquanto os Nodes próprios observados estavam próximos de 100 MiB cada. Essa condição pertence à validação, sem identificação de causa externa e sem extrapolação automática aos benchmarks anteriores. Nenhum processo externo foi encerrado. Duração da suíte não é latência do produto.

## Regressões obrigatórias

**Registro pré-A (histórico).** A seleção full inclui D-01, D-02, D-03, D-04, R-02/R-03, propriedade/ambiguidades, concorrência de índices, staging B/disco C, protect opcional, failpoints e interrupções. O [mapa de recuperação](RECOVERY.md) localiza os testes. A full concluída registra suas linhas finais em FULL-V9-RESULTS.json; os quatro SKIP estão explicitados acima. Sua aprovação não é somada aos dirigidos nem à matriz V11 executada separadamente; cópia nova e publicação conservam seus gates próprios ainda pendentes.

## Falhas e campanhas intermediárias preservadas

[INVESTIGATION-RUNS.md](INVESTIGATION-RUNS.md) e [INVESTIGATION-RUNS.json](INVESTIGATION-RUNS.json) preservam o foco interrompido, o erro do formatador de Buffers, a mutação de stat pelo Git, as reproduções e os focos posteriores. Uma falha antiga não é apagada pelo retry; uma aprovação intermediária não certifica o snapshot final.

Os microbenchmarks de materialização e startup têm resultados próprios. O controle de isolamento startup-01 terminou FAIL; startup-02 terminou PASS no seu escopo. Os benchmarks intermediários V6 preservam regressões de latência e cenários incompletos. Esses resultados não são falhas da suíte headless nem devem ser somados às suas contagens.

## Commit A e cópia nova A executados

Commit A local: `934befc1516bd12b3aee43c6b4e326d34e647f1b`. A cópia nova A terminou PASS de 2026-11-05T05:13:30.486Z a 05:16:10.140Z, receipt bruto SHA-256 0697d7e2af969aabe1246f67baadeacee3af5010698ab6fe3e9079edbc90958e. Os 22 comandos do supervisor tiveram os códigos esperados: 21 exit 0 e um exit 1 esperado em source-uploadpack-hook-config, que comprova ausência do hook. O smoke compilado passou em 82 comandos, sete fluxos e quatro snapshots; o runtime relocado funcionou sem node_modules. Esses comandos não somam testes à full415 ou à matriz361. [Receipt público](FRESH-COMMIT-A.json), [auditoria sem candidatos](FRESH-COMMIT-A-PRIVACY-AUDIT.json) e [protocolo estruturado](PUBLICATION.json). Functional209 5cc41446… ficou igual em sourceBefore/sourceAfter/cloneBefore/cloneAfter; o compilado 8ef83fc2… também permaneceu igual antes/depois do smoke. Esta atualização B é documental; seu SHA, push, fresh B e sincronia serão observados depois de existirem.

## Publicação e cópia nova

**Registro pré-A (histórico).** O [protocolo de publicação A/B](PUBLICATION.md) separa commit A, verificação da cópia nova A antes do push, commit documental B e verificação da cópia nova B depois do push. As etapas abaixo permanecem pendentes até seus receipts reais; nenhum SHA futuro é inferido.

**Registro pré-A (histórico).** Commit e push ainda não foram realizados. A verificação em cópia nova usará clone local sem hardlinks/alternates, instalação por lockfile com scripts de instalação desabilitados, typecheck, build independente, help e smoke compilado/relocado. Isso não certifica Electron nem substitui a suíte full/matriz. O SHA só pode ser atestado depois de existir.

A publicação exigirá HEAD/origin/main/ls-remote/consulta direta ao GitHub iguais, diferença zero, código versionado limpo e links dos relatórios conferidos. Nenhum check remoto de CI será inventado a partir dos testes locais.

A [prova de equivalência V9/V10](SOURCE-EQUIVALENCE-V9-V10.json) conserva os 209 hashes, o delta único de infraestrutura e os fingerprints por escopo. Core/CLI, scripts, configuração, dependências e corpus unit/integration usados na full são byte-idênticos; não é uma nova execução dos 415 testes no fingerprint global V10.
