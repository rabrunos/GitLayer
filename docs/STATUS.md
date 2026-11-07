# Estado do laboratório

A reconstrução de 07/11/2026 substituiu a implementação anterior por um Core e uma CLI em JavaScript, sem dependências npm ou build obrigatório. Layers são branches reais `layer/*`, com índices nativos e commits independentes; HEAD e índice convencionais permanecem selecionados. Não há modo de edição, desktop, engine transacional ou migração.

A [validação da cópia nova](TESTS.md) concluiu **14/14 PASS**, zero falhas ou skips, com instalação pelo lockfile, sintaxe e status limpo. O commit interativo foi verificado em terminal real, inclusive cancelamento sem perder staging.

A [campanha final](BENCHMARKS.md) concluiu **15/15 amostras verificadas**. Para 10.000 arquivos de 256 bytes em 100 diretórios compartilhados, as medianas de ativação/desativação/reativação foram **2,591/1,622/2,425 s** nos comandos completos e **4,488/2,072/4,210 s** incluindo a conferência externa. Na pasta exclusiva, ativação/reativação com conferência tiveram medianas **5,278/5,284 s**. A meta de cinco segundos não foi atingida em todos os cenários. O add inicial de 10.000 arquivos ainda levou cerca de 33,5–33,7 s.

A extração usa oito workers nativos do Git; a remoção usa operações assíncronas em lotes de 64. Não há cache próprio de materialização. Fontes, resultados brutos e custos iniciais estão versionados, sem depender de arquivos privados. Consulte [README](../README.md), [arquitetura](ARCHITECTURE.md), [limitações](LIMITATIONS.md) e [remoções](REMOVED.md).

A base partiu de `25a4ee5d4a810d458872a9f6e3cf0c8c0feb956e`, preservado no histórico, e foi iniciada em `experimental/minimal-core`. O adendo autorizou a integração normal e publicação na main sem força. Perfis, demonstrações e conteúdo local desconhecido foram preservados; os antigos builds e dependências identificados foram removidos. Os resultados acima pertencem exclusivamente à reconstrução atual.

```powershell
npm.cmd run check
npm.cmd test
npm.cmd run benchmark
```

Use somente repositórios descartáveis. As execuções são locais, no ambiente Windows documentado; não se atribuem resultados a CI remoto ou às campanhas históricas.
