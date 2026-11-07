# Validação — 07/11/2026

A cópia nova e independente do commit [`090587d`](https://github.com/rabrunos/GitLayer/commit/090587dc5ada7b2c2067e5fc2561096f76d2bbc1) passou em **14/14 testes**, com zero falhas, cancelamentos, skips ou pendências. A cópia terminou com status limpo. As alterações posteriores desse fechamento são documentação e resultados, sem mudanças no código validado.

| Comando na cópia nova | Código |
| --- | ---: |
| `npm.cmd ci --ignore-scripts --offline --no-audit --no-fund` | 0 |
| `npm.cmd run check` | 0 |
| `node --test --test-concurrency=1 --test-reporter=tap tests/lab.test.mjs` | 0 |

Saída integral: [tests.tap](tests.tap). Recibo com versão e revisão testada: [validation.json](validation.json). A suíte levou 268,483 s; isso é duração da validação, não latência de ativação.

Os testes T01–T09 demonstram três branches reais com raízes e históricos independentes, on/off sem trocar HEAD ou índice principal, separação de arquivos da aplicação e Layers, novos arquivos espalhados, modificações e exclusões, caminhos específicos literais, autoria/ancestralidade nativas, commit de B preparado conservando C no disco e reativação com conteúdos corretos. Casos adicionais cobrem `.` em subdiretório, regras de ignore, staging sem commit, exclusão preparada seguida de recriação e recusa de interação sem terminal. Os observadores usam o Git oficial por caminho absoluto, fora do adaptador do Core.

O commit interativo também foi verificado separadamente em terminal real Windows: duas Layers com staging, mensagem `Interactive first`, confirmação da primeira e mensagem vazia para cancelar a segunda. O primeiro commit ficou registrado; a segunda referência e seu staging permaneceram; o HEAD convencional foi preservado. O processo terminou com código 0.

T10 é a campanha separada de [15 benchmarks verificados](BENCHMARKS.md), com 10, 100, 1.000 e 10.000 arquivos, inclusive diretórios compartilhados. Não há teste que aprove velocidade por antecipação.

Ambiente executado: Windows x64 `10.0.26200`, Node `v24.14.1`, Git `2.53.0.windows.2`. Instalação pelo lockfile sem dependências; não há build obrigatório. Fixtures novas e descartáveis, configuração/identidade Git isoladas, sem usar repositórios pessoais ou a demonstração. Estas são execuções locais; não se declara execução de CI remoto ou cobertura de plataformas e configurações fora das limitações do laboratório.
