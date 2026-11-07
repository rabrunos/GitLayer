# Estado do laboratório

Fase experimental mínima iniciada em 07/11/2026, na branch `experimental/minimal-core`, a partir de `25a4ee5d4a810d458872a9f6e3cf0c8c0feb956e`. A arquitetura anterior permanece no histórico; a main remota não é substituída nesta missão.

O contrato atual usa branches reais `layer/*`, índices nativos independentes, atribuição pelo add, exclusão local e materialização em lote. Não há modo de edição, desktop, motor transacional ou migração. Consulte o [README](../README.md), a [arquitetura](ARCHITECTURE.md), as [limitações](LIMITATIONS.md) e as [remoções](REMOVED.md).

A validação desta reconstrução é independente das campanhas históricas. Resultados funcionais e comandos executados serão registrados em [TESTS.md](TESTS.md); tempos, amostras e comparação de estratégias em [BENCHMARKS.md](BENCHMARKS.md). Até esses registros serem concluídos, não atribuir aprovação à suíte nova nem declarar atingida a meta de cinco segundos para 10.000 arquivos.

Reprodução local, sem build obrigatório:

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run benchmark
npm.cmd run benchmark:alternatives
```

Todos os testes e medições devem usar fixtures descartáveis novas. Os dados ignorados preservados no checkout não constituem resultados desta fase. O fechamento desta missão é local; push exige autorização posterior.
