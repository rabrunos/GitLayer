# Campanha inicial — possível interferência de carga externa

**Esta campanha é preservada como evidência, mas não fundamenta a conclusão final de desempenho.** O usuário informou um jogo aberto e seu encerramento; depois reiniciou o computador. O Windows confirmou boot às 16:40:11 locais. O estado do jogo não foi instrumentado; não há atribuição causal isolada. Consulte [condições registradas](benchmark-conditions.json) e a [campanha final após reinício](BENCHMARKS.md).

# Benchmarks da migração TypeScript — 07/11/2026

A comparação usa a revisão JavaScript `b4051c01ed09a42705439f18d6ca6c4a1f3f849b` e as fontes TypeScript commitadas em `345e2ae9c9dcc35f04d5cc1fd3240679b87bec06`. Os algoritmos são os mesmos: `checkout-index` em lote com oito workers e remoção assíncrona em lotes de 64. O add não foi otimizado.

## Evidência preservada

- [Campanha JavaScript histórica](BENCHMARKS-JAVASCRIPT.md), [dados históricos](benchmarks.json), [alternativas históricas](materialization-comparison.json) e [paralelismo histórico](parallel-comparison.json) permanecem intactos.
- [Baseline JavaScript nova](benchmarks-javascript-baseline.json): **15/15 amostras verificadas**, três por cenário, em clone novo da referência.
- Os relatórios TypeScript usam destinos separados; seus hashes identificam os fontes efetivamente medidos.

## Ambiente e método

Windows x64 `10.0.26200`, Intel Core i7-9700KF @ 3,60 GHz, oito processadores lógicos, Node `v24.14.1`, Git `2.53.0.windows.2` por caminho absoluto e fixtures novas no volume `C:\`. Não houve testes ou outras campanhas de benchmark executados em paralelo pelo agente.

Cada cenário usa três fixtures independentes. Os arquivos têm 256 bytes determinísticos (10.000 arquivos = 2.560.000 bytes). O layout distribuído tem até 100 diretórios compartilhados com a aplicação e outra Layer; o layout exclusivo tem uma pasta da Layer. Caminhos são disjuntos e as identidades/configurações Git são locais e isoladas.

`commandMs` termina somente após a saída completa da CLI e todos os efeitos sobre os arquivos. `verificationMs` mede a conferência externa separadamente; `verifiedMs` é o total desde a chamada até concluir a conferência. Após on/reativação, todos os bytes são lidos e comparados em lotes de 64. Após off, todos os caminhos são conferidos como ausentes. Conteúdos das outras origens, HEAD e bytes do índice convencional também são conferidos em cada operação.

Fixture, outras origens, criação do índice, on vazio, geração dos arquivos, add, commit e off inicial são fases separadas. A primeira ativação preenchida é a primeira extração desses objetos Git. Não há cache GitLayer ou preparação adicional de materialização. Caches normais do sistema/Git não foram esvaziados; não se afirma medição a frio.

## Referência histórica

Estes valores pertencem à campanha JavaScript anterior, **não** à versão TypeScript. Segundos, medianas com 10.000 arquivos em 100 diretórios compartilhados:

| Fase | JavaScript histórico |
| --- | ---: |
| Ativar, CLI | 2,591 |
| Desativar, CLI | 1,622 |
| Reativar, CLI | 2,425 |
| Add inicial | 33,710 |

## Baseline JavaScript desta sessão

Segundos, medianas de três amostras. Colunas com conferência incluem o processo completo e o observador externo:

| Arquivos/layout | Ativar CLI | Off CLI | Reativar CLI | Ativar + conferência | Off + conferência | Reativar + conferência | Add inicial |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 distribuídos | 2,021 | 1,626 | 2,202 | 2,176 | 1,973 | 2,505 | 6,341 |
| 100 distribuídos | 2,101 | 1,457 | 2,069 | 2,574 | 1,675 | 2,743 | 5,591 |
| 1.000 distribuídos | 3,481 | 1,711 | 3,881 | 4,931 | 2,149 | 6,613 | 8,029 |
| 10.000 compartilhados | 8,689 | 3,243 | 3,726 | 12,044 | 4,263 | 8,766 | 46,473 |
| 10.000 exclusivos | 13,933 | 4,313 | 13,060 | 20,188 | 5,213 | 19,166 | 47,618 |

A variabilidade já aparece na própria versão JavaScript intacta. Nos 10.000 compartilhados, os comandos variaram entre 3,271–9,307 s para on, 1,607–3,874 s para off e 2,688–12,016 s para reativar. Nos exclusivos, as faixas foram 12,940–16,614 / 3,233–4,605 / 10,408–14,431 s. Os hashes dos oito fontes/launchers da baseline coincidem com os históricos, mas os tempos não reproduzem aquela campanha. Não se atribui uma causa não medida a essa diferença.

## Reprodução

```powershell
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run benchmark
npm.cmd run benchmark:alternatives
npm.cmd run benchmark:parallel
npm.cmd run benchmark:startup -- <checkout-JavaScript-b4051c0>
```

Os três primeiros scripts gravam, respectivamente, `benchmarks-typescript.json`, `materialization-comparison-typescript.json` e `parallel-comparison-typescript.json` em `docs/`. Startup grava `startup-comparison.json`. Pode-se informar outro destino como argumento; startup recebe o destino depois do caminho do checkout JavaScript.

A baseline nova executou o script original sem alterações, em clone descartável de `b4051c0`, com saída explicitamente direcionada para um arquivo novo. As campanhas são locais; não se afirma certificação de CI, outras máquinas, arquivos maiores, topologias complexas ou desempenho universal.

## Campanha TypeScript e comparação independente

A campanha TypeScript concluiu **15/15 amostras verificadas**, sem falhas de conteúdo, ausência, outras origens, HEAD ou índice convencional. [Dados brutos](benchmarks-typescript.json), medidos no clone commitado de `345e2ae9c9dcc35f04d5cc1fd3240679b87bec06`. Segundos; delta é a diferença entre medianas de campanhas independentes (TS menos JS), não um delta pareado.

| Cenário | Operação | JS novo | TS nativo | Delta s | Delta % |
| --- | --- | ---: | ---: | ---: | ---: |
| 10 distribuídos | Primeira ativação | 2,021 | 1,934 | -0,087 | -4,3 |
| 10 distribuídos | Desativação | 1,626 | 1,299 | -0,326 | -20,1 |
| 10 distribuídos | Reativação | 2,202 | 1,796 | -0,405 | -18,4 |
| 100 distribuídos | Primeira ativação | 2,101 | 2,721 | +0,620 | +29,5 |
| 100 distribuídos | Desativação | 1,457 | 1,556 | +0,099 | +6,8 |
| 100 distribuídos | Reativação | 2,069 | 2,222 | +0,153 | +7,4 |
| 1.000 distribuídos | Primeira ativação | 3,481 | 2,488 | -0,993 | -28,5 |
| 1.000 distribuídos | Desativação | 1,711 | 1,635 | -0,075 | -4,4 |
| 1.000 distribuídos | Reativação | 3,881 | 2,824 | -1,057 | -27,2 |
| 10.000 compartilhados | Primeira ativação | 8,689 | 6,574 | -2,114 | -24,3 |
| 10.000 compartilhados | Desativação | 3,243 | 4,881 | +1,638 | +50,5 |
| 10.000 compartilhados | Reativação | 3,726 | 8,045 | +4,319 | +115,9 |
| 10.000 exclusivos | Primeira ativação | 13,933 | 13,440 | -0,493 | -3,5 |
| 10.000 exclusivos | Desativação | 4,313 | 4,843 | +0,530 | +12,3 |
| 10.000 exclusivos | Reativação | 13,060 | 14,599 | +1,539 | +11,8 |

As medianas independentes mostram diferenças materiais, inclusive +50,5% em off e +115,9% em reativação nos 10.000 compartilhados. O cenário de 100 arquivos teve +29,5% em primeira ativação. Esses resultados motivaram o diagnóstico pareado descrito abaixo; não se declara equivalência por sobreposição de faixas.

### Conferência externa separada

Segundos, mediana de três amostras TypeScript. Cada célula segue a ordem **ativar / desativar / reativar**. A mediana do comando mais a mediana da verificação pode diferir da mediana do total.

| Cenário | Comando | Somente conferência | Comando + conferência |
| --- | --- | --- | --- |
| 10 distribuídos | 1,934 / 1,299 / 1,796 | 0,176 / 0,133 / 0,168 | 2,073 / 1,432 / 1,943 |
| 100 distribuídos | 2,721 / 1,556 / 2,222 | 0,348 / 0,325 / 0,380 | 2,985 / 1,856 / 2,584 |
| 1.000 distribuídos | 2,488 / 1,635 / 2,824 | 1,057 / 0,349 / 0,877 | 3,553 / 2,037 / 3,802 |
| 10.000 compartilhados | 6,574 / 4,881 / 8,045 | 9,810 / 1,209 / 5,318 | 16,384 / 6,090 / 16,639 |
| 10.000 exclusivos | 13,440 / 4,843 / 14,599 | 5,903 / 1,103 / 6,697 | 19,343 / 6,025 / 23,840 |

### Faixas dos comandos de 10.000 arquivos

Mínimo–máximo, segundos; ordem ativar / desativar / reativar.

| Layout | JavaScript novo | TypeScript nativo |
| --- | --- | --- |
| distributed | 3,271–9,307 / 1,607–3,874 / 2,688–12,016 | 3,370–8,332 / 1,499–5,894 / 2,824–11,321 |
| exclusive | 12,940–16,614 / 3,233–4,605 / 10,408–14,431 | 11,702–14,902 / 4,700–5,063 / 11,814–17,590 |

### Preparação completa de 10.000 arquivos

Segundos, medianas de três fixtures independentes por layout. O add conserva exatamente a seleção e os comandos Git anteriores. Não foi otimizado nesta missão.

| Fase | JS compartilhado | TS compartilhado | JS exclusivo | TS exclusivo |
| --- | ---: | ---: | ---: | ---: |
| Fixture/aplicação básica | 2,773 | 1,440 | 1,166 | 2,154 |
| Aplicação e Layer acompanhante | 9,137 | 9,667 | 7,532 | 7,675 |
| Criar Layer e índice | 1,072 | 1,698 | 1,641 | 1,383 |
| Ativar Layer vazia | 1,269 | 1,584 | 1,563 | 1,336 |
| Gerar arquivos | 19,392 | 18,073 | 24,682 | 14,763 |
| Add inicial | 46,473 | 44,727 | 47,618 | 45,579 |
| Commit inicial | 3,774 | 4,253 | 3,523 | 4,191 |
| Off inicial: comando | 5,323 | 5,158 | 5,498 | 4,952 |
| Off inicial: conferência | 1,264 | 0,981 | 1,024 | 0,863 |
| Cache adicional | 0,000 | 0,000 | 0,000 | 0,000 |

### Inicialização da CLI

[Dados brutos](startup-comparison.json): três warmups por runtime e **30 amostras por runtime**, alternando a ordem, no mesmo repositório descartável. Cada medição inclui `node <cli> --help` até a saída completa; exige código zero, stderr vazio e stdout idêntico. Não há operação Git dentro desse intervalo.

| Runtime | Mediana ms | Mínimo ms | Máximo ms |
| --- | ---: | ---: | ---: |
| javascript | 78,469 | 70,664 | 115,702 |
| typescript | 124,634 | 115,100 | 328,096 |

O acréscimo mediano foi **46,165 ms (+58,83%)**. Esse custo de inicialização é real, mas não explica sozinho as diferenças de centenas ou milhares de milissegundos nas campanhas independentes. A investigação compara também as operações completas na mesma fixture.

## Diagnósticos pareados da campanha inicial

Todos os pares e aquecimentos concluíram a conferência integral. São reativações aquecidas na mesma fixture; não substituem a primeira extração da campanha principal. Deltas são TS menos JS, calculados por par.

| Fixture | Pares | Operação | JS mediana s | TS mediana s | Mediana delta pareado ms | Mediana % por par |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| [100 distribuídos](runtime-comparison-100.json) | 10 | on | 1,199 | 1,251 | +34,382 | +4,430 |
| [100 distribuídos](runtime-comparison-100.json) | 10 | off | 0,685 | 0,644 | +87,685 | +18,318 |
| [10.000 compartilhados](runtime-comparison-10000-shared.json) | 6 | on | 10,192 | 8,229 | -521,365 | -4,717 |
| [10.000 compartilhados](runtime-comparison-10000-shared.json) | 6 | off | 5,348 | 4,955 | -1594,397 | -23,862 |
| [10.000 exclusivos](runtime-comparison-10000-exclusive.json) | 6 | on | 4,263 | 4,674 | +421,422 | +9,724 |
| [10.000 exclusivos](runtime-comparison-10000-exclusive.json) | 6 | off | 1,596 | 1,842 | +117,443 | +7,337 |

A mediana dos deltas pareados pode divergir da diferença entre as medianas de JS e TS: mediana não é linear. As séries têm variação temporal e efeitos de ordem. Nem os resíduos positivos, nem os negativos desta campanha permitem concluir equivalência, aceleração ou regressão causada pela linguagem.
