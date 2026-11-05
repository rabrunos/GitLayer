# Auditoria do replay nativo do índice privado

O gate V7 terminou **FAIL: 70 testes, 67 PASS e três FAIL**, sem SKIP/cancelamento/todo. Dois FAIL comparavam o índice privado final com o backup raw anterior ao checkpoint. A análise das duas fixtures preservadas e um replay independente produziram **EXACT_NATIVE_REPLAY_MATCH**: os 225 bytes finais são exatamente os gerados pelo Git oficial, e C continua visível como modificação. Isso explica esses dois oráculos inadequados; não transforma a campanha original em PASS. A falha restante é o diagnóstico de identidade em `path-replaced-at-open`. V8 e sua nova validação estão em preparação.

Os [dados estruturados](AUDIT-PRIVATE-INDEX-REPLAY.json), o [estado das campanhas](RESULTS.md), as [decisões temporais](DECISIONS.md#rollback-de-índices-legados-sem-fronteira-temporal-registrada) e a [auditoria das quatro famílias](INTEGRITY-AUDIT.md) mantêm os domínios separados.

## Fontes e resultado terminal preservado

O gate executou oito arquivos com concurrency 1 e cap global de 60 minutos, entre 2026-11-04T20:42:37.291Z e 21:33:28.828Z. Exit 1, sem timeout ou truncamento; o resumo TAP é completo e consistente. O fingerprint funcional de 209 inputs permaneceu `902c595b8a1477487f88f3fb8f98bbacef0008881e52e232b11d4face1380ba1` antes/depois. O domínio Core tem 18 fontes, fingerprint `40d2992ce900f8bd14d152b8b94b1f7098ad90d9fa73e51acaa10da654a22957`, mais uma fonte CLI.

| Original externo preservado | Bytes | SHA-256 |
| --- | ---: | --- |
| Gate V7, result.json | 6.355 | `f7e70fa78fb444e5a8e5dd94b496429654fff8ae625e02b498450dba0c75f90a` |
| Auditoria somente leitura, RESULTS.json | 41.692 | `525c276b16fb7f3d102d19d89a136bd2f1f69627e58a73b95f240b92a90f8d6f` |
| Replay nativo, RESULTS.json | 5.498 | `bc8446c6ce07545beb7b630ad7b4c2f264ac8485b90866896c36aa6d24ddab46` |

Os originais e as fixtures permanecem externos; esta projeção usa uma lista explícita de campos, sem caminhos pessoais, PIDs, conteúdo de configuração/identidade ou refs técnicas privadas. Hashes dos dois harnesses e dos inputs também estão no JSON. O replay não executou as futuras correções V8.

## O que a auditoria observou

Os dois testes privados usam planos legados nas configurações Git padrão (`true-default`) e mínima (`false-minimal`). O journal já estava concluído. A leitura independente comprovou A commitado, B preparado, C no disco e `M\0layer-racy.txt\0` no diff oficial. Também conservou a outra entrada preparada e sua alteração física posterior.

Em cada índice de 225 bytes, o primeiro byte diferente estava no offset 131: o tamanho stat cacheado da entrada racy passou de cinco para zero. As outras vinte diferenças estavam no checksum final. O parser conferiu o checksum; caminhos, modos, OIDs e a extensão TREE permaneceram iguais. A auditoria somente leitura verificou inventário de bytes/identidades/mtime/ctime antes/depois das fixtures, excluindo atime.

A documentação primária explica que o Git zera o tamanho stat de uma entrada racy ao regravar o índice para impedir uma futura classificação falsamente limpa. Esse campo é cache; o blob preparado continua sendo B. [Git: tratamento de racy entries](https://git-scm.com/docs/racy-git).

## Replay com todos os bytes como oráculo

O experimento criou uma cópia exclusiva e independente de cada backup, com marcador/nonce, ambiente isolado e orçamento de cinco minutos/128 MiB. Aplicou epoch + 1 segundo pelo FD próprio, sincronizou e conferiu o timestamp exato. Executou `git write-tree` com `GIT_INDEX_FILE` apontando somente para essa cópia, seguido de diff oficial sem ext-diff/textconv. Não chamou Core/recover nem alterou os índices originais.

| Configuração | Backup copiado raw | Após write-tree nativo × índice final observado | Árvore/checkpoint | C detectado |
| --- | --- | --- | --- | --- |
| Padrão | 225 bytes exatos antes do comando | 225 bytes integralmente iguais | Mesmo OID | Sim, M |
| Mínima | 225 bytes exatos antes do comando | 225 bytes integralmente iguais | Mesmo OID | Sim, M |

`write-tree` cria a árvore a partir do índice; o replay usa esse mesmo comando do checkpoint, e não uma equivalência semântica improvisada. A árvore obtida foi `3ab1012847d8af911c35decce2e8ea03da6bda20` em ambos os casos. [Git: write-tree](https://git-scm.com/docs/git-write-tree).

O replay percorreu quatro invocações Git diretas; a auditoria anterior percorreu 26. Não são contagens de todos os descendentes do Git. O replay durou de 21:22:15.040Z a 21:22:17.182Z; esses relógios descrevem o experimento, não latência do produto. O inventário completo das fixtures originais permaneceu igual, incluindo refs, índices, backups, journals, arquivos e objetos, com a mesma exclusão de atime.

Na versão exata observada, Git for Windows v2.53.0.windows.2, ce_smudge_racily_clean_entry confere o conteúdo e zera sd_size da entrada falsamente limpa; do_write_index chama essa rotina para entradas racy que ainda não estejam marcadas como atualizadas. [Rotina e campo zerado](https://github.com/git-for-windows/git/blob/v2.53.0.windows.2/read-cache.c#L2397), [condição na serialização](https://github.com/git-for-windows/git/blob/v2.53.0.windows.2/read-cache.c#L2718). O caminho de write-tree grava o índice condicionalmente, conforme o estado do cache-tree; portanto não se afirma que toda chamada regrave o índice. [Condição de escrita](https://github.com/git-for-windows/git/blob/v2.53.0.windows.2/cache-tree.c#L723). A interpretação do mecanismo é sustentada pelo replay exato destas duas fixtures, sem extrapolar seu resultado a todas as configurações.

## Correção do oráculo e limites

A correção candidata dos testes conserva **duas comparações integrais distintas**: conferir todos os bytes B no rename de restauração, antes do checkpoint; depois, conferir todos os bytes do índice privado final contra o replay independente do write-tree nativo. Também mantém os checks de A/B/C, modos, refs, detecção de C e idempotência. Não ignora campos stat/checksum, não substitui bytes por mera comparação semântica e não reduz a expectativa de recuperação.

A terceira falha do gate permanece separada: o helper recusou a troca do caminho antes de escrever metadados, mas retornou UNSAFE_PATH onde o teste exige EXTERNAL_EDIT. A correção candidata ajusta a ordem de comprovação do FD/caminho, mantendo a recusa.

O gate V7 conserva os três FAIL e os recibos originais. V8 ainda exige novo congelamento e execução dirigida/integral. O replay cobre somente duas fixtures privadas SHA-1/index v2; não certifica perda de energia, outras plataformas, todas as versões de índice ou interleavings externos.
