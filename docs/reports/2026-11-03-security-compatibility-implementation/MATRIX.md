# Matriz das correções

PASS exige efeitos verificados por Git oficial absoluto, índices, refs e arquivos. Recusa segura não equivale a suporte da operação recusada. Contagens finais e fingerprints estão em [RESULTS](RESULTS.md).

| Item | Antes comprovado | Critério da implementação | Cobertura executável |
| --- | --- | --- | --- |
| D-01 Core/base | rename podia reservar destino em B; discard B removia-o | origem base conservada, stage B/disco C distintos, descarte de B preserva destino | security-ownership.test.ts |
| D-01 Core/Layer A | variante gerenciada já conservava A | manter A com target B, restart e commit/índices separados | security-ownership.test.ts |
| D-01 externo | nome novo de A podia entrar no histórico de B | ausência+candidato bloqueia stage/commit/discard, inclusive após observação/reinício; resolução explícita sem transferir staging | security-ownership.test.ts; security-index-concurrency.test.ts (alteração real antes da publicação da ref, journal e exportação) |
| D-01 origens/bytes | hash igual não provava origem | base/A/sem dono, rename/copy-delete, mesmos bytes/editados, B preparado/C no disco | security-ownership.test.ts |
| D-01 fronteira de target | Bundle intermediário confirmou rename A durante retry, safe:true e commit indevido em B | Recusar a mudança de presença da origem; preservar contexto anterior, MAIN/stage B/disco C e branches; resolver explicitamente na origem correta | cinco casos D01 em security-editing-transition.test.ts: retry Layer, retry base, publicação após mudança em memória, substituição de caminho anterior sem dono, staging nativo antes da primeira âncora; FRONTIER-HISTORY.json |
| D-01 aceite base após reset misto | Tentativa01 recusou por ignore incidental; tentativa02, no mesmo bundle, fez status safe:true e commit de conteúdo base em b após reset --mixed | Aceite conserva origem fora de HEAD/MAIN; resolução não produz token stale sem mudança externa; ausência reconhecida não é entrada nova da base; destino/encerramento/desativação/remoção/restart preservam o vínculo; release/rename/delete aposentam marcadores e troca compatível não cria reserva fantasma | seis casos PASS da FULL14 em security-base-origin.test.ts no snapshot final; foco09 separado; BASE-ORIGIN-HISTORY.json |
| D-01 sem target | não abrangido pela contraprova original | detectar ausência de Layer ativa+candidato, inclusive nova entrada do índice base; caminhos base normais continuam possíveis | security-ownership.test.ts |
| D-01 unstage de MAIN NEW | baseUnstage retirou staging, status/reabertura transferiram origem para target e discard removeu C da projeção; C ficou em backup técnico | Retenção somente de NEW legítimo indexado sem ambiguidade ou com autoridade base anterior, após sucesso; candidato ambíguo não ganha reserva por unstage; ordinary NEW não reservado em recusa; alias após guard; commit/saída/restart não transferem origem | três cenários PASS na FULL14 e no foco safety06 em security-diagnostics.test.ts, no snapshot final; BASE-UNSTAGE-BEFORE.json permanece histórico; RESULTS.md e EVIDENCE.json |
| D-04 dispatch de commit | Core A com papel antigo de layer/a publicou B de MAIN na main após Core B voltar à main | Dispatch depois de guard/refresh; a sem stage recusa NOTHING_STAGED, HEAD/MAIN B/índices privados/C preservados; commit base deliberado e retorno de branch continuam corretos | terceiro cenário de unstage PASS na FULL14 e no foco safety06, com duas instâncias e recusa NOTHING_STAGED; STALE-COMMIT-BEFORE.json permanece histórico; RESULTS.md e EVIDENCE.json; sem teste adicional contado |
| D-03 staging parcial | Native add podia retornar erro após alterar MAIN; backup retido, journal pendente | Preparar índice integral técnico e publicar só após sucesso/CAS/lock nativo; preservar B/C, índices, refs e externos | security-atomic-stage.test.ts; caso original “base ownership claims never override original user ignore rules” mantido em security-ownership.test.ts |
| D-02 | target sucesso; before/unassigned incompatíveis; reopen recusado | fronteira coerente ou recusa; nenhuma publicação inválida; validadores estritos | editing-boundary.test.ts e security-editing-transition.test.ts |
| R-02/R-03 | seis regressões anteriores já corrigidas | preservar intenção de ignore, preview sem publicação e newcomers | review-target-preview.test.ts |
| Staging nativo | force/negação podiam incorporar newcomer na base com estado saudável | diagnosticar interferência; não reivindicar arquivo já na base; aceite explícito | security-diagnostics.test.ts |
| Ignore | prioridade superior neutralizava exclusão local | diagnóstico específico antes de autoatribuir; regras do usuário preservadas | security-diagnostics.test.ts; security-ownership.test.ts |
| Ignore dinâmico P1 | Whitelist antiga anulava ignore global/info após consulta; release ausente criava exceção stale | Revalidar exceções atuais e presentes; permitir unignore deliberado; preservar refs/índices/bytes e casos de controle | dois casos executáveis em security-ignore-refresh.test.ts (global e info), cada fixture com Git Layer e controle Git; quatro execuções de caso no comparativo histórico antes/depois, sem soma aos totais finais |
| Branch gerenciada | composição já validada; ignorados expostos a Git externo | conservar Layers, B/C e usar opção conservadora; recusar colisões mesmo com conteúdo igual | security-diagnostics.test.ts; regressões de branch existentes |
| Protect | enabled/healthy não expressavam cobertura/ref alterada | diagnosticar índice/arquivo/lock/ref, Layer externa descoberta, reapply idempotente e preservação desconhecida | security-protection.test.ts |
| Git destrutivo direto | clean/reset/switch/mv podem destruir disco | manter significado; contraprovas identificam o que existe em commit, stage, backup e somente disco | contraprovas externas compactas em EVIDENCE.json |
| GL16 e diretórios | Receita externa omitia a decisão sobre ausência+criação | Reconhecer exclusão deliberada sem atribuir locais; conservar todas as asserções originais e provar decisão sem efeitos em refs/índices/bytes | core.test.ts; duas reproduções dirigidas antes/depois |
| Resgate | JSON inválido já recusado/exportável; nova injeção controlada de colisão acceptedBase × reserva de Layer mostrou safe:true apenas no diagnóstico independente | doctor/export acessíveis, sem reconstrução silenciosa; diagnóstico independente considera a mesma origem aceita e recusa a colisão preservando todo o domínio | recovery/product-v1/security-editing-transition; caso 2 PASS da FULL14 em security-base-origin.test.ts no snapshot final; BASE-ORIGIN-HISTORY.json |

Testes anteriores são entradas históricas. A validação completa desta etapa deve manter snapshot próprio, sem somar execuções de fontes distintas.

## Alcance dos requisitos

| Requisito | Avanço da etapa 1B | Limite que mantém o requisito parcial |
| --- | --- | --- |
| GL-01 | Git oficial preservado, diagnóstico de índice/ignore e defesas nas operações gerenciadas | Git direto conserva force, clean/reset e alterações externas que não consultam o mapa privado. |
| GL-09 | Rename conserva origem; revisão explícita da ambiguidade; fronteira válida e reabrível do destino | Atribuição é observada por comando; regras superiores e staging nativo podem exigir diagnóstico/resolução posterior. |
| GL-15 | Troca compatível mantém Layers e B/C; opção nativa conservadora sem fallback inseguro | Troca Git direta pode sobrescrever ignorados; não há interceptação universal. |
| GL-18 | Criações comuns continuam automáticas; ausência+candidato não permite adivinhar origem | Eventos externos invisíveis entre consultas não têm causalidade reconstruída; ambiguidades exigem decisão. |
| GL-22 | Abertura deliberada preservada; proteção opcional com cobertura e integridade verificáveis | Reservas são worktrees reais, locais e contornáveis; não protegem bytes contra comandos destrutivos. |

Os demais contratos foram mantidos. GL-19/20 conservam a classificação parcial histórica; a etapa não certifica todo o seu alcance. Não houve promoção automática dos cinco requisitos a implementados.

## Contraprova suplementar

Os suplementos NATIVE-RENAME-SWITCH e INDEX-CONCURRENCY abaixo são registros históricos ec0/183; seus recibos permanecem inalterados e separados do manifesto global da campanha14, sem somar contagens.

Rename externo da base seguido de troca nativa antes da consulta: recusa segura OWNERSHIP_AMBIGUOUS antes/depois da reabertura, sem atribuir moved.txt. Hipótese refutada somente neste envelope; observações e efeitos técnicos em [NATIVE-RENAME-SWITCH](NATIVE-RENAME-SWITCH.json). Experimento separado, sem acréscimo aos totais integrais.

O escritor nativo antes de write-tree tem prova suplementar preservada em [INDEX-CONCURRENCY](INDEX-CONCURRENCY.json): recusa OWNERSHIP_AMBIGUOUS, staging/bytes preservados, journal RECOVERY_REQUIRED e exportação completa. Um PASS dirigido separado, sem somar ao total integral.

## Complemento D-01: unstage de candidato ambíguo

| Cenário histórico | Efeito comprovado | Critério verificado no snapshot final | Evidência |
| --- | --- | --- | --- |
| MAIN NEW preparado após rename de origem conhecida, sem target | OWNERSHIP_AMBIGUOUS virou safe:true após unstage criar baseReservation; baseStage/baseCommit publicaram D na main sem decisão | Retirar staging não decide origem; candidato permanece ambíguo e não ganha reserva artificial; preservar B privado/A histórico/D disco; revalidar contexto anterior antes de publicar | AMBIGUOUS-UNSTAGE-BEFORE.json e AMBIGUOUS-UNSTAGE-REFS.json: antes c7/183; três cenários de unstage e duas receitas de rename PASS na FULL14 e no foco safety06 do snapshot final; RESULTS.md/EVIDENCE.json |

A continuação controlada e a verificação somente de leitura pertencem ao mesmo experimento. Não são dois testes adicionais nem uma nova família de defeito. Os casos de rename integram os 17 PASS terminais do foco safety06 no snapshot final, com recibo separado da FULL14, sem exigir release artificial para desfazer uma reserva que não deveria existir.

## Revogação durável, materialização e recuperação D-01

| Fronteira | Antes confirmado | Critério no ACE17 | Evidência e unidade |
| --- | --- | --- | --- |
| Reconhecimento de ausência/rollback |49BA podia restaurar autorização antiga e permitir commit da Layer na main | pending/revoked duráveis; rollback não devolve autoridade; plano/backup/imagens validados | Oito testes acknowledgement na FULL14 e foco ack02, dez cenários/fixtures; [BEFORE49BA](d01-evidence/ACK-ROLLBACK-BEFORE.json), [ledger](d01-evidence/D01-CONSOLIDATED.json). |
| Materialização gerenciada |6994 rematerializava com autorização antiga e rename externo permitia commit de A em B | Revogar antes de publicar: ativação/projeção, restore, escrita e destino de rename | Quatro testes na FULL14 e foco materialization01,15 subcenários; [BEFORE6994](d01-evidence/MATERIALIZATION-BEFORE6994.json). TypeError app.stage inicial não é recusa segura. |
| Recuperação com origem desaparecida | OverlayV02 podia perder a âncora ativa e permitir commit em B | Entrada física validada BEFORE ausente/current ausente recusa workspace-materialization-disappeared, mesmo sem AFTER/ack anterior; metadados seguem whitelist estrita | [ProvaV02](d01-evidence/MATERIALIZATION-RECOVERY-BEFORE.json), [composição distinta](d01-evidence/MATERIALIZATION-V02-COMPOSITION.json), [dirigidos finais](d01-evidence/D01-FOCUSED-ACE17.json). |
| Limite V05 | Ausência não distingue interrupção pré-escrita, movimento externo ou rollback parcial | Journal pendente bloqueia preparação/commit/descarte; doctor/export disponíveis; recusa tardia pode suceder efeitos parciais nos metadados | Quarto teste: present recupera; recorded-after-present recusa antes; late-disappearance recusa no loop. Pending antes da escrita pode exigir inspeção manual. |

Essas variantes continuam D-01. O total permanece quatro famílias e duas lacunas P1. **20 requisitos implementados e sete parciais: GL-01/09/15/18/19/20/22.** GL-19 continua limitado pela recuperação incerta/manual e por bytes nunca registrados; GL-20 conserva o envelope anteriormente declarado de nomes/config/worktrees/backend, sem ampliação automática.

## Execução, suporte e suplementos

MERGE-001 / core-merge-not-implemented-native-ff é **PASS de execução e PRODUCT_GAP**: confirmou NOT_IMPLEMENTED do merge gerenciado com dados preservados e fast-forward nativo de controle. Não é funcionalidade Core implementada.

[SUPPLEMENTAL14](SUPPLEMENTAL14.json) separa13 checks da CLI compilada, duas variantes de rename sem dono e a continuação base-unstage. A falha inicial de igualdade bruta continua registrada; a perícia mostrou cache/stat e o segundo observador é NOT_RUN. Não somar checks/variantes aos315 resultados Node. [Históricos11/12/13](README.md), [reconstrução estática](acknowledgement-reconstruction/CHAIN-PLAN.md) e [replays49BA](reproductions/README.md) têm fontes e unidades distintas.
