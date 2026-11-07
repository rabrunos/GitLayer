# Estado do laboratório — TypeScript

A base experimental iniciada em 07/11/2026 foi migrada integralmente de JavaScript para TypeScript ESM estrito. O ponto de partida foi `b4051c01ed09a42705439f18d6ca6c4a1f3f849b`, sem alterações locais rastreadas. A migração conserva a arquitetura funcional: Layers são branches reais `layer/*`, com índices nativos e commits independentes; HEAD e índice convencionais permanecem selecionados.

A extração continua usando `checkout-index` em lote com oito workers nativos do Git. A remoção continua assíncrona em lotes de 64 arquivos, somente para Layers limpas. Seleção de origem no add, exclusão local, staging, commit interativo e cancelamento conservam os fluxos anteriores. Não há cache próprio, modo de edição, desktop, journaling ou engine de recuperação.

Oito arquivos `.mjs` foram retirados: sete foram migrados para `.ts`, e o checker de sintaxe foi substituído por `tsc --noEmit`. A medição adicional de inicialização também está em TypeScript. Há uma única base de implementação, sem JavaScript gerado ou mantido em paralelo. TypeScript `7.0.2` e `@types/node` `22.20.5` são dependências de desenvolvimento; a CLI tem zero dependências externas de runtime e não exige build.

Use Node 22.18+ ou 24+ (a série 23 exige 23.6+) e o checkout fora de `node_modules`. Os launchers mantêm `git layer` no Windows e no shell. A [migração](TYPESCRIPT.md) descreve os tipos, a configuração estrita e os limites da execução nativa.

As evidências de cada campanha são identificadas separadamente em [testes](TESTS.md) e [benchmarks](BENCHMARKS.md). Os JSONs JavaScript anteriores foram preservados. As medições incluem todos os arquivos, o observador independente, HEAD e índice convencional; não se afirma desempenho a frio ou garantia universal de cinco segundos.

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run check
npm.cmd test
npm.cmd run benchmark
npm.cmd run benchmark:alternatives
npm.cmd run benchmark:parallel
```

Use somente repositórios descartáveis. Perfis, demonstrações e conteúdo local ignorado ou desconhecido foram preservados. Nenhuma configuração global do Git, instalação do Git ou PATH permanente foi alterado. O histórico continua linear e sem publicação forçada.
