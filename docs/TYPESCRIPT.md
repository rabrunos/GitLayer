# Migração tecnológica — 07/11/2026

O ponto de partida é `b4051c01ed09a42705439f18d6ca6c4a1f3f849b`: `main`, `origin/main` e a referência remota coincidiam, sem alterações rastreadas ou arquivos novos livres. Os diretórios ignorados `.workshop/` e `artifacts/` foram preservados. O trabalho começou em `experimental/typescript-native`.

## Uma base de fontes

| Papel | Fonte JavaScript substituída | Fonte atual |
| --- | --- | --- |
| Core | `src/core.mjs` | `src/core.ts` |
| CLI | `src/cli.mjs` | `src/cli.ts` |
| Helpers de fixtures | `tests/helpers.mjs` | `tests/helpers.ts` |
| Suíte funcional | `tests/lab.test.mjs` | `tests/lab.test.ts` |
| Campanha principal | `scripts/benchmark.mjs` | `scripts/benchmark.ts` |
| Comparação de materialização | `scripts/compare-materialization.mjs` | `scripts/compare-materialization.ts` |
| Comparação de paralelismo | `scripts/compare-parallel.mjs` | `scripts/compare-parallel.ts` |
| Verificação | `scripts/check.mjs` | `tsc --noEmit` no manifesto |

Os oito `.mjs` foram removidos. `scripts/compare-startup.ts` mede o custo de inicialização da CLI. `scripts/compare-runtime.ts` foi acrescentado para investigar diferenças materiais das campanhas com ciclos JS/TS alternados na mesma fixture, reutilizando preparo e observador existentes. São nove arquivos-fonte TypeScript ativos, sem novo comando do produto. Launchers shell e `.cmd`, manifesto, lockfile e atributos Git apontam para os `.ts`. Os nomes `.js` dentro das fixtures são dados arbitrários de repositórios simulados, não implementação JavaScript mantida.

## Execução e tipos

`node src/cli.ts` e os launchers `git-layer` executam a mesma fonte diretamente. Git continua descobrindo `git-layer` pelo PATH da sessão; não foi alterado o PATH permanente nem a configuração global do Git. Não há build, bundler, runner externo ou dependência externa de runtime.

A faixa do manifesto é `^22.18.0 || >=23.6.0`: Node 22.18+ habilita a remoção de tipos por padrão; a série 23 exige 23.6+. Node 24 é a opção testada nesta campanha. O Node remove tipos, mas não verifica sua correção e ignora `tsconfig.json`. A verificação separada usa `npm.cmd ci --ignore-scripts --no-audit --no-fund` e `npm.cmd run check`.

O `tsconfig.json` usa `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `NodeNext` para módulo e resolução, `noEmit`, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `isolatedModules` e importações relativas com extensão `.ts`. Não há aliases de resolução, enums, namespaces com valores, decorators ou propriedades de parâmetro que exijam transformação. Campos da classe usam `declare`, sem acrescentar inicializações ao Core original.

Os tipos descrevem nomes e refs de Layers, caminhos, índices, OIDs, resultados de subprocessos, ativação, staging, mudanças, status, fixtures e registros de benchmark. Os dois documentos JSON internos têm assertions locais documentadas: estado produzido pelo próprio Core e status produzido pela própria CLI. Não se introduziu um sistema de validação de metadados externos, que continua fora do escopo do laboratório.

Dependências diretas de desenvolvimento fixadas: TypeScript `7.0.2` e `@types/node` `22.20.5`. O lockfile também registra `undici-types` e os pacotes de plataforma do compilador TypeScript. A tipagem usa a linha Node 22 para respeitar o runtime mínimo. O compilador é ferramenta de desenvolvimento; a CLI não o importa.

O Node recusa remoção de tipos em arquivos dentro de `node_modules`. Portanto esta modalidade executa o checkout fora desse diretório, conforme os launchers documentados. O pacote continua privado, sem prometer instalação npm como distribuição. Não se afirma suporte a plataformas ou versões de Node que não foram executadas.

A decisão nativa foi mantida após medição: startup com acréscimo mediano de 37,791 ms e controle pareado contra JS emitido automaticamente da mesma fonte TS. A emissão não mostrou benefício consistente no off que motivou a investigação. Configuração de emissão e dois `.js` gerados existem somente no clone descartável do experimento, fora da implementação publicada. Os custos e limites completos estão no [relatório](BENCHMARKS.md).

## Arquitetura conservada

Permanecem `refs/heads/layer/<nome>`, índices nativos por `GIT_INDEX_FILE`, HEAD e índice convencionais preservados, `checkout-index` em lote com oito workers e remoção assíncrona em lotes de 64. Seleção de origem no add, `info/exclude`, `write-tree`, `commit-tree`, `update-ref` e interação de commit conservam os fluxos anteriores. A migração acrescenta diagnósticos para ausência de nome na CLI e respostas Git estruturalmente incompletas; não modifica operações válidas.

As [limitações funcionais](LIMITATIONS.md) continuam vigentes. Resultados atuais estão em [testes](TESTS.md) e [benchmarks](BENCHMARKS.md). Os JSONs e recibos da versão JavaScript permanecem preservados; não se atribuem suas medições à versão TypeScript.

Referências técnicas: [execução nativa no Node](https://nodejs.org/api/typescript.html), [Node 22.18](https://nodejs.org/download/release/v22.18.0/docs/api/typescript.html), [opções de TypeScript](https://www.typescriptlang.org/tsconfig/) e [versão estável TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
