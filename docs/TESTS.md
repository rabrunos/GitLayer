# Validação TypeScript — 07/11/2026

A cópia nova e descartável do commit [`345e2ae9c9dcc35f04d5cc1fd3240679b87bec06`](https://github.com/rabrunos/GitLayer/commit/345e2ae9c9dcc35f04d5cc1fd3240679b87bec06) passou em **14/14 testes**, com zero falhas, cancelamentos, skips ou pendências. A verificação estática estrita terminou com **zero erros**. O clone estava limpo após a suíte; os 14 arquivos de fontes, launchers, manifesto, lockfile, atributos e configuração conferidos eram idênticos em bytes aos do checkout de trabalho.

| Comando no clone novo | Código |
| --- | ---: |
| `npm.cmd ci --ignore-scripts --offline --no-audit --no-fund` | 0 |
| `npm.cmd run check` (`tsc --noEmit`) | 0 |
| `npm.cmd test` (`node --test --test-concurrency=1 tests/lab.test.ts`) | 0 |

Saída integral: [tests-typescript.txt](tests-typescript.txt). Versões, revisão, comandos e hashes: [validation-typescript.json](validation-typescript.json). A suíte levou **287,714 s**; esse tempo é duração da validação, não latência de uma operação.

## Cobertura preservada

Os 14 cenários da suíte JavaScript foram migrados, conservando as assertions e os dados das fixtures. T01–T09 cobrem três branches com raízes/históricos independentes; on/off sem trocar HEAD ou índice convencional; separação da aplicação e Layers; arquivos novos espalhados; modificações e exclusões; caminhos literais; autoria e ancestralidade nativas; commit do conteúdo B preparado conservando C no disco; recusa de off sujo; reativação e diretórios compartilhados.

Os outros cinco casos verificam o escopo de `.` em subdiretórios, regras de ignore, propriedade mantida durante exclusão preparada e recriação em Layer ou aplicação, e commit sem nome com staging vazio ou recusa de interação sem TTY. Os observadores usam Git oficial por caminho absoluto, fora do adaptador do Core. Não se recriou a suíte extensa da arquitetura antiga.

A configuração TypeScript verifica todos os fontes em `src/`, `tests/` e `scripts/`, incluindo os comparadores. Usa `strict`, acesso indexado verificado, imports `type`, `NodeNext`, sintaxe removível e `noEmit`, sem `any` ou supressões de diagnóstico. A revisão funcional tinha oito fontes; o diagnóstico adicional `scripts/compare-runtime.ts` elevou a base a nove e passou novamente no mesmo check estrito antes do commit `016d234548232e35ae817f9d83715e6b2b75e361`. Esse commit acrescenta somente o diagnóstico: Core, CLI, testes, helpers, demais scripts, manifesto e configuração continuam idênticos ao snapshot funcional validado.

A ampliação do controle para JS emitido foi checada sem erros em `aaa47e14c4df309d3d0aea655e98ebbae602b41b`, alterando somente o diagnóstico, sem mudar Core, CLI ou os 14 cenários. Seu recibo também está em `validation-typescript.json`.

## Interação real e launcher Windows

Um processo em **PTY real** executou `node src/cli.ts --cwd <fixture nova> commit` no mesmo snapshot commitado. A Layer `agents` recebeu mensagem e confirmação, avançou seu tip e registrou o conteúdo preparado. Uma mensagem vazia cancelou a Layer `scripts`: seu tip, staging e conteúdo no disco permaneceram iguais. HEAD, branch convencional e bytes do índice principal também permaneceram iguais. O processo terminou com código 0.

O launcher `bin/git-layer.cmd` passou no smoke de `list --json` com `--cwd`; a suíte funcional usa `git layer` pelo launcher externo do Git. Toda a validação interativa ocorreu **antes de instalar node_modules no clone**, comprovando execução sem dependências npm de runtime. O [recibo interativo](interactive-typescript.json) inclui `stdinTTY=true`, entradas, referências, hash do índice e hashes das fontes. A fixture foi limpa pelo helper após as conferências.

## Ambiente e limites

Windows x64 `10.0.26200`, Node `v24.14.1`, npm `11.11.0`, TypeScript `7.0.2`, `@types/node` `22.20.5` e Git `2.53.0.windows.2`. Instalação reproduzida pelo lockfile, sem scripts de instalação; não há build obrigatório ou transpiler externo.

As fixtures são novas e descartáveis, com configuração/identidade Git isoladas, caminhos disjuntos e ausência de concorrência, filtros, hooks e LFS. Não foram usados projetos pessoais nem a demonstração antiga. Node 22.18 é o mínimo documentado para a modalidade nativa; a execução desta campanha foi em Node 24, sem afirmar teste de outras versões ou plataformas.

T10 permanece a campanha separada de [benchmarks](BENCHMARKS.md), com medições completas e conferência de todos os arquivos. Não há assertion de velocidade que aprove desempenho por antecipação. A [validação JavaScript anterior](TESTS-JAVASCRIPT.md), [tests.tap](tests.tap) e [validation.json](validation.json) foram preservados como evidência histórica.
