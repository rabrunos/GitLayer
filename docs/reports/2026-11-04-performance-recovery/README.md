# Etapa 2 — desempenho e recuperação

**Implementação validada em cópia nova; fechamento documental B.** A implementação está no commit local `934befc1516bd12b3aee43c6b4e326d34e647f1b`. A verificação independente da cópia nova A passou, com fontes iguais e runtime relocado sem dependências: [receipt](FRESH-COMMIT-A.json) e [auditoria de privacidade, sem candidatos](FRESH-COMMIT-A-PRIVACY-AUDIT.json). Commit documental B, push, cópia nova B e sincronia serão atestados depois de existirem; nenhum SHA B é antecipado. [Protocolo](PUBLICATION.md).

**Registro pré-A (histórico).** **Validação local executada; publicação pendente.** Infraestrutura V11: 113 PASS/113. Matriz V11: 355 PASS, seis ENV_BLOCKED e zero FAIL entre 361 selecionados. A full415, typecheck/build/smoke e o benchmark permanecem V9, com runtime/Core/corpus iguais ao V11 pela [prova de equivalência](SOURCE-EQUIVALENCE-V9-V11.json). [Infraestrutura](INFRA-V11-RESULTS.json), [receipts](VALIDATION-INFRA-V11.json) e [nove controles HARNESS-021](HARNESS021-AUTHORITY-CONTROLS.json). Cópia nova, commit, push e sincronia ainda não foram comprovados.

Entrega de 04/11/2026 do Core/CLI, com Git oficial e fixtures externas próprias. A baseline é o commit `d71ccc7d188500a22e56ea93c70ac946dba9db60`, confirmado na main local e remota no início da missão.

**Registro pré-A (histórico).** A campanha final V9 encerrou nove pares completos e dois endpoints de 10.000 arquivos incompletos por tempo. Full V9: 415 resultados, 411 PASS, quatro SKIP; infraestrutura V11: 113 PASS/113; matriz V11: 355 PASS, seis ENV_BLOCKED e zero FAIL em 361 selecionados. Typecheck/build/smoke V9 passaram, com equivalência de Core/runtime/corpus V11. O gate dirigido mantém 61 PASS/um SKIP em 62, sem somatório. A matriz V11 preserva nested quiet=false e usa uma prova de encerramento independente aceita. FAIL históricos, HALTED original e limites dos benchmarks permanecem explícitos. Cópia nova e publicação estão pendentes; [RESULTS.md](RESULTS.md) identifica cada fonte e campanha.

- [Relatório completo](REPORT.md)
- [Publicação e verificações em cópia nova: protocolo A/B e pendências](PUBLICATION.md)
- [411 PASS e quatro SKIP da full V9](FULL-V9-RESULTS.json), [auditoria](FULL-V9-PRIVACY-AUDIT.json) e [classificação técnica](FULL-V9-PRIVACY-CLASSIFICATION.json); falha posterior do controlador e pendências em RESULTS.md
- [Primeira infraestrutura V9: 112 PASS e um FAIL preservado](INFRA-V9-FAILED-RESULTS.json), [auditoria](INFRA-V9-FAILED-PRIVACY-AUDIT.json) e [classificação técnica](INFRA-V9-FAILED-PRIVACY-CLASSIFICATION.json); correção restrita V10 e infraestrutura posterior PASS113/113 em RESULTS.md
- [Infraestrutura V10: 113 PASS/113](INFRA-V10-RESULTS.json), [receipts separados](VALIDATION-INFRA-V10.json), [auditoria](INFRA-V10-PRIVACY-AUDIT.json) e [classificação técnica](INFRA-V10-PRIVACY-CLASSIFICATION.json); [equivalência de fontes V9/V10](SOURCE-EQUIVALENCE-V9-V10.json)
- [Matriz V11 final: 355 PASS e seis ENV_BLOCKED](VALIDATION-BROAD-V11.json), [conservação e arquivos distribuídos](VALIDATION-BROAD-V11-SHARDS.json), [auditoria](BROAD-V11-PRIVACY-AUDIT.json) e [classificação técnica](BROAD-V11-PRIVACY-CLASSIFICATION.json)
- [Matriz V10 com FAIL preservado](VALIDATION-BROAD-V10-FAILED.json), [conservação e arquivos distribuídos](VALIDATION-BROAD-V10-FAILED-SHARDS.json), [auditoria](BROAD-V10-FAILED-PRIVACY-AUDIT.json) e [classificação técnica](BROAD-V10-FAILED-PRIVACY-CLASSIFICATION.json)
- [Receipts V9 do benchmark, full e fases independentes](VALIDATION-CORE-V9.json), [auditoria](VALIDATION-CORE-V9-PRIVACY-AUDIT.json) e [classificação técnica](VALIDATION-CORE-V9-PRIVACY-CLASSIFICATION.json)
- [61 PASS e um SKIP do gate dirigido V9](DIRECTED-V9-RESULTS.json), [auditoria de privacidade](DIRECTED-V9-PRIVACY-AUDIT.json) e [classificação dos achados técnicos](DIRECTED-V9-PRIVACY-CLASSIFICATION.json)
- [Medições e comparações V9](BENCHMARKS.md), [índice com todos os 130 registros](BENCHMARKS.json), [prova de conservação](BENCHMARKS-SHARDS.json) e [auditoria dos treze artefatos](BENCHMARKS-PRIVACY-AUDIT.json)
- Casos integrais: [uma Layer/dez arquivos](benchmarks/cases/layers1-files10.json), [1.000 arquivos](benchmarks/cases/layers1-files1000.json), [dez Layers](benchmarks/cases/layers10-files100.json) e [10.000 arquivos incompletos](benchmarks/cases/layers1-files10000.json); os dez estão vinculados em BENCHMARKS.md
- [Recuperação e experimentos](RECOVERY.md)
- [Decisões e alternativas](DECISIONS.md), [materialização](MATERIALIZATION.json), [startup isolado](STARTUP.json) e [controle de isolamento com FAIL](STARTUP-UNCONFINED.json)
- [Resultados, comandos e fingerprints](RESULTS.md), [R-02/R-03 dirigido](R02-R03-RESULTS.json) e [controles intermediários do projetor](PROJECTOR-CONTROLS.json)
- [Consulta de índices](INDEX-QUERY.md), [dados da investigação](INDEX-QUERY.json) e [25 resultados dirigidos V6 intermediários](DIRECTED-QUERY-RESULTS.json)
- [Replay nativo dos índices privados](AUDIT-PRIVATE-INDEX-REPLAY.md) e [dados por allowlist](AUDIT-PRIVATE-INDEX-REPLAY.json)
- [Campanhas anteriores com FAIL preservado](INVESTIGATION-RUNS.md) e [recibos](INVESTIGATION-RUNS.json)
- [Limitações restantes e próxima fase](LIMITATIONS.md)
- [Recuperação idempotente e validação nativa na cópia](RECOVERY-NOOP-AUDIT.md) e [evidências](RECOVERY-NOOP-AUDIT.json)
- [Campanha intermediária V6](BENCHMARKS-INTERMEDIATE-V6.md) e [dados preservados](BENCHMARKS-INTERMEDIATE-V6.json), sem misturar suas amostras com V9
- [Campanhas intermediárias V3/V4](BENCHMARKS-INTERMEDIATE-V3-V4.md), [dados](BENCHMARKS-INTERMEDIATE-V3-V4.json), [manifesto do Core intermediário](CORE-INTERMEDIATE-CURRENT-V3.json), [patch portátil](CORE-INTERMEDIATE-CURRENT-V3.patch) e [prova de aplicação exata](CORE-INTERMEDIATE-CURRENT-V3-APPLY.json)

Resultados históricos das etapas anteriores permanecem em seus relatórios. Não se somam testes de campanhas ou snapshots diferentes. Os documentos distinguem prova de integridade, observação de desempenho, recusa conservadora e suporte do produto.

**Registro pré-A (histórico).** As execuções locais acima estão concluídas nos seus escopos. O smoke independente contém 82 comandos, quatro snapshots e sete etapas, sem somar à full. A primeira infraestrutura V9 e a matriz V10 continuam FAIL; as campanhas posteriores V11 passaram separadamente. D5 manteve docs/runner/fontes iguais durante a matriz e foi liberado para esta prosa posterior, que terá sua própria auditoria final. Os dados de benchmark já auditados e seus históricos permanecem intactos. Recover-empty sem Layers piorou +23,019% em n3, além das pioras n1 com cinco Layers. Nenhum requisito parcial é promovido. Cópia nova, commit, push e sincronia permanecem pendentes.
