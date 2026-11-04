# Segurança e compatibilidade — implementação1B

Esta etapa implementa as decisões aprovadas após a [investigação](../2026-11-03-security-compatibility-investigation/README.md), preservada como histórico. O produto é Core/CLI com Git oficial; protect é opcional e Git direto mantém sua semântica.

A campanha local terminou no ACE17/183: FULL315 resultados (311PASS/0FAIL/4SKIP), infra111PASS e broad355PASS/0FAIL/6ENV_BLOCKED entre361 selecionados. Cópias commitadas e publicação têm seu registro próprio em [PUBLICATION](PUBLICATION.md); este índice não antecipa suas atestações. Permanecem20 implementados e sete parciais.

## Relatório e operação

- [Relatório e limites](REPORT.md), [matriz](MATRIX.md) e [decisões técnicas](DECISIONS.md).
- [Reprodução/resolução seguras](REPRODUCTIONS.md), [resultados reais](RESULTS.md) e [histórico dos ciclos](HARNESS-HISTORY.md).
- [Evidências](EVIDENCE.json), [validação estruturada](VALIDATION.json), [manifesto funcional](SOURCE-MANIFEST.json) e [verificações suplementares](SUPPLEMENTAL14.json).
- [Cópias novas e publicação](PUBLICATION.md). Execução local não representa CI remoto.

## Provas e correções preservadas

- [Origem base/diagnóstico independente](BASE-ORIGIN-HISTORY.json), [complemento](BASE-ORIGIN-HISTORY.md), [fronteiraD01](FRONTIER-HISTORY.json) e [staging parcialD03](D03-HISTORY.json).
- [Commit por papel antigoD04](STALE-COMMIT-BEFORE.json), [origem conhecida após unstage](BASE-UNSTAGE-BEFORE.json), [unstage ambíguo](AMBIGUOUS-UNSTAGE-BEFORE.json) e [refs independentes](AMBIGUOUS-UNSTAGE-REFS.json).
- [Rename externo/troca nativa](NATIVE-RENAME-SWITCH.json) e [escritor no MAIN](INDEX-CONCURRENCY.json): experimentos históricos separados.
- [LedgerD01](d01-evidence/D01-CONSOLIDATED.json) e [focosACE17](d01-evidence/D01-FOCUSED-ACE17.json).

## Campanhas históricas e fontes

- Campanha10: [histórico reprovado](FULL10-HISTORY.json) e [manifesto](SOURCE-MANIFEST-10.json).
- Campanha11: [histórico](d01-evidence/CAMPAIGN11-HISTORY.json), [contexto](d01-evidence/CAMPAIGN11-README.md) e [manifesto](d01-evidence/SOURCE-MANIFEST11.json).
- Campanha12/49BA: [histórico](d01-evidence/CAMPAIGN12-HISTORY.json), [manifesto](d01-evidence/SOURCE-MANIFEST12.json) e [contraprovas originais](d01-evidence/ACK-ROLLBACK-BEFORE.json).
- Campanha13/6994: [histórico interrompido](d01-evidence/CAMPAIGN13-HISTORY.json), [manifesto](d01-evidence/SOURCE-MANIFEST13.json), [observação/continuação](d01-evidence/MATERIALIZATION-BEFORE.json) e [projeção menor da mesma prova](d01-evidence/MATERIALIZATION-BEFORE6994.json).
- [Rollback no overlayV02](d01-evidence/MATERIALIZATION-RECOVERY-BEFORE.json) e [proveniência](d01-evidence/MATERIALIZATION-V02-COMPOSITION.json), distintos de6994 e da fonte final.

## Reconstrução e receitas históricas

- [CadeiaACE17→6994→49BA](acknowledgement-reconstruction/CHAIN-PLAN.md), [reconstrução estática](acknowledgement-reconstruction/STATIC-RECONSTRUCTION.json) e [checks oficiais sem aplicação](acknowledgement-reconstruction/STATIC-GIT-CHECKS.json); o plano liga os dois patches e três manifestos.
- [Receitas ESMV2 executadas](reproductions/README.md), [oráculos e três fases49BA](d01-evidence/RECIPES49BA-RUNTIME.json) e [receita textual6994](reproductions/MATERIALIZATION6994-RECIPE.md).

FAILs, SKIPs, bloqueios e interrupções anteriores continuam visíveis. Checks, cenários, focos e versões não são somados aos totais finais. PASS de execução não equivale a suporte, recuperação automática ou backup.
