# Etapa 2B — escalabilidade e movimentação segura

Implementação e investigação do Core/CLI, baseline e8f2e3feba87224246a42337f77f702914df989e. Git oficial permanece a fonte da verdade. Foram incorporados journal incremental compatível, publicação de nome ausente sem substituição, validações de origem/refs/índices e retirada restrita de novas extrações descartáveis após conclusão durável. Não há cache de projeção, auto-park ou sincronização remota automática.

A entrega **não demonstra aceleração universal**: em mil arquivos, first **41,639 s** (+6,216%), off **41,122 s** (−14,211%) e reativação **39,486 s** (+7,847%) frente à baseline medida. Dez mil arquivos concluíram first/off/react em **412,129/521,793/405,771 s**; a meta de cinco segundos não foi atingida. First é n1; off/react 1k são medianas de três ciclos na mesma fixture. A baseline 10k não concluiu no teto de 180 s; não há delta pareado.

- [Conclusões e respostas aos 18 critérios](REPORT.md)
- [Medições completas](BENCHMARKS.md), [amostras/condições](BENCHMARKS.json) e [recibo da campanha](BENCHMARKS-CAMPAIGN-RECEIPT.json)
- [Armazenamento, retenção e dependências](STORAGE.md)
- [Interrupções e recuperação](RECOVERY.md)
- [Alternativas e decisões](DECISIONS.md)
- [Validação e evidências](RESULTS.md)
- [Limites](LIMITATIONS.md)

Full V10: **599 PASS/quatro SKIP em 603, zero FAIL**; infraestrutura V10: **117/117 PASS**; broad V11: **355 PASS/seis ENV_BLOCKED em 361, zero FAIL**. Campanhas e fontes são distintas. A [prova de escopo](SOURCE-TRANSITION-PROOF.json) liga o snapshot da full ao atual por uma única receita alterada na matriz, conservando outros 233 arquivos/Core/CLI e o corpus da full. Falhas anteriores permanecem em [RESULTS](RESULTS.md) e [histórico](RESULTS-HISTORY-PRE-FINAL.md).

Os [benchmarks V7 anteriores às correções](BENCHMARKS-V7-PRE-CORRECTION.md), [medições intermediárias](BENCHMARKS-INTERMEDIATE.md) e relatórios das [etapas 1B](../2026-11-03-security-compatibility-implementation/README.md) e [2](../2026-11-04-performance-recovery/README.md) permanecem históricos. Teste aprovado, suporte de produto e publicação são dimensões distintas. As cópias novas e a sincronização final seguem o protocolo em [RESULTS](RESULTS.md#cópia-nova-e-publicação).
