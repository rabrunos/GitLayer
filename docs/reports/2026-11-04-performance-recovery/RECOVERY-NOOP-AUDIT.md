# Recuperação repetida: auditoria do checkpoint sem mudança

Durante o gate V8 foram emitidos dois FAIL de idempotência física nos testes privados 37 e 38; a campanha depois terminou FAIL com 70 testes, 68 PASS e esses dois FAIL, sem SKIP/cancel/todo. A primeira recuperação já havia satisfeito as comparações integrais da restauração e do replay nativo, com B preparado e C detectável. A falha ocorreu depois de repetir a recuperação concluída: inode, mtime e ctime mudaram. Os testes continuam exigindo estabilidade física nessa repetição. Os oráculos foram mantidos e o resultado terminal V8 continua FAIL.

Os [dados por allowlist](RECOVERY-NOOP-AUDIT.json) conservam os hashes dos recibos brutos. Veja também [RESULTS.md](RESULTS.md), o [replay da primeira recuperação](AUDIT-PRIVATE-INDEX-REPLAY.md) e os [testes de recuperação](../../../tests/integration/recovery-index-timestamp.test.ts).

## Separação dos comandos nativos

Um experimento derivado isolou dois comandos oficiais sobre cópias exclusivas do mesmo índice privado de 225 bytes. Também copiou todos os objetos Git de forma independente, sem hardlinks ou alternates, para que write-tree não pudesse atualizar os objetos originais. O harness usou o prefixo fixo do Core e GIT_OPTIONAL_LOCKS=0, apontando GIT_INDEX_FILE somente às cópias.

| Comando observado | Bytes | Identidade física | Mtime/ctime | C depois do comando |
| --- | --- | --- | --- | --- |
| diff --cached --quiet contra o checkpoint | Iguais | Igual | Iguais | Detectado como M |
| write-tree | Iguais | Substituída | Alterados | Detectado como M |

As duas cópias mantiveram SHA-256 ea127473fc2a0d66900971f6900d55203bf92d2320564f86f0c231ad749ae1fd. O write-tree produziu o mesmo OID de árvore/checkpoint: 3ab1012847d8af911c35decce2e8ea03da6bda20. A diferença observada é uma escrita física redundante, sem mudança de bytes ou ocultação de C.

A escrita do índice por write-tree é condicional no Git, segundo o estado do cache-tree; o experimento não demonstra que toda chamada o reescreva. [Código oficial Git for Windows v2.53.0.windows.2](https://github.com/git-for-windows/git/blob/v2.53.0.windows.2/cache-tree.c#L723), [manual de write-tree](https://git-scm.com/docs/git-write-tree).

## Evidência e limites

O recibo bruto RESULTS.json tem 7.954 bytes e SHA-256 2c45074d07c4fe8bd442191586f5b8dc5680c46fcff10c1d34b4cec80e53c982. O inventário SOURCE-BEFORE.json tem 32.891 bytes e SHA-256 86dc6a76213d5221441d1f7818c26f3828b56ef8b64b40b598560a8ebd6fda25. O inventário completo da fixture original permaneceu igual antes/depois, incluindo conteúdo, modo, identidade e tempos; atime foi excluído. O índice e os objetos originais não foram usados como destinos de escrita.

O experimento durou de 2026-11-04T22:24:23.731Z a 22:24:24.248Z, sob orçamento de cinco minutos/128 MiB, com 35.048 bytes lógicos observados antes do próprio recibo de resultado. Foram quatro invocações Git diretas: um comando principal e uma consulta de diff por cópia. Não houve execução de Core, teste de produto ou perda real de energia. Esses relógios não medem latência da recuperação do produto. Uma fixture e duas variantes de comando não certificam todas as configurações do Git.

## Registro histórico da proposta inicial — superada

A proposta inicial, registrada antes da contraprova abaixo, limitava o checkpoint final de recover às chamadas que efetivamente recuperaram transações, reconheceram movimento de branch ou alteraram confirmações: recovered.length || moved || acknowledged. Ela deve manter todas as validações existentes, a reserva/revalidação de proteção e o fluxo normal, sem retorno antecipado.

Essa condição isolada foi SUPERADA: omitir o write-tree eliminaria uma verificação de existência de objetos. O texto desta seção conserva a hipótese anterior; a decisão atual está abaixo. Os seis testes de recuperação permanecem com seus oráculos de idempotência intactos. Não há ganho de produto medido nem aprovação antecipada da proposta. As duas falhas do V8 continuam registradas e não são reclassificadas como problema de bytes.

## Contraprova de objeto ausente e decisão V9

Em duas cópias inicialmente idênticas de um índice válido, a contraprova retirou somente a extensão opcional TREE e recalculou o checksum. Moveu um blob copiado próprio para fora do armazenamento de objetos da cópia, preservando-o inteiro. O cached diff retornou 0; write-tree retornou 128 por objeto inválido/ausente. Portanto igualdade com o checkpoint não basta para substituir a validação nativa. O recibo tem 4.933 bytes, SHA-256 e6bbc8b57682f8394f47f1549e8198e40f4580859136588716aff06f31afa64a; são duas chamadas Git diretas em fixture própria, sem Core/teste de produto e com originais preservados.

A implementação candidata V9 conserva o write-tree. Quando não houve transação recuperada, movimento de branch ou confirmação alterada, queryIndexTree executa argv fixo sobre cópia independente do índice, usando todo o protocolo de locks, hashes, identidade, timestamp, recibos e retenção de index-query. A árvore privada precisa corresponder ao checkpoint recém-validado. Quando existe reconstrução efetiva, a rota anterior de checkpoint permanece. As demais validações, propriedade, exclusões e reservas de proteção continuam; não há retorno antecipado para esconder trabalho pendente.

O helper não escreve no índice vivo, nas refs nem nos JSON de Layers. Write-tree pode criar ou atualizar a recência de objetos Git, como o comando nativo anterior; não se promete ausência total de escrita no object database. Essa rota é exclusiva da validação de recover, sem ampliar a allowlist de diff nem alterar previews/status comuns.

Os seis testes de idempotência foram mantidos; dois testes novos de árvore conferem igualdade com Git e recusa diante de blob ausente, incluindo o contraste cached=0/write-tree=128. O dirigido recovery5 V9 passou no seu escopo, com 61 PASS e um SKIP ambiental entre 62 resultados, mas a suíte completa e a validação final continuam pendentes. O [estado das campanhas](RESULTS.md) distingue essa aprovação limitada de publicação/certificação geral. Não há ganho de latência atribuído a esta auditoria.
