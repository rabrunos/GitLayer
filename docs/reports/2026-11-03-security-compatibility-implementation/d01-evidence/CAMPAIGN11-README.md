# Campanha11 — histórico preservado

A campanha 11 não concluiu a validação final. Snapshot: 183 entradas; fingerprint c51774b34a1d18606cd70f9e294a073ddd6428816fdd7d9d1e7099bf47ba886b. O manifesto histórico é exato e não deve ser regenerado ao atualizar o manifesto corrente.

[Extrato com comandos, IDs e hashes](CAMPAIGN11-HISTORY.json) · [Manifesto histórico exato](SOURCE-MANIFEST11.json). Este histórico preserva o resultado da campanha11, separado das campanhas posteriores e de suas aprovações.

| Execução | PASS | FAIL | SKIP | ENV_BLOCKED | Saída |
| --- | ---: | ---: | ---: | ---: | ---: |
| Foco base06 |6|0|0|0|0|
| Foco safety03 |15|0|0|0|0|
| FULL11 |297|0|4|0|0|
| Infra11 |111|0|0|0|0|
| Broad11:361 selecionados |351|4|0|6|1|

Não somar esses denominadores: existe sobreposição. A matriz tinha386 variantes:361 selecionadas e25 NOT_RUN separados (5 não selecionadas/20 fora da fase). Manifestos antes/depois ficaram exatamente iguais nas cinco execuções.

As quatro FAIL permanecem históricas:

- RECOVERY-001/003: o helper recusou ProcessWrap na pré-condição da barreira. Breakpoint e bundle conferiram; os writers posteriores à barreira não foram exercitados. O recibo sozinho não distingue processo vivo de handle retido.
- RECOVERY-014: três ciclos status/recover aumentaram journals de 4 para 7; recover devolveu[] três vezes, e ref/índice privado semântico passaram. No snapshot histórico, status abria editing-sync com Layer ativa mesmo sem destino. Registra regressão de idempotência, sem prova de perda de bytes ou quinta P0.
- HARNESS-021: falhou a expectativa textual de autorização corrente, ainda presa à formulação/referência02/11. AGENTS já descrevia 03/11; nenhum repositório de produto foi inicializado.

Snapshots anteriores das fixtures de recuperação são NOT_INITIALIZED. Capturas pós-falha não certificam sozinhas igualdade integral pré/pós; a análise posterior não reescreve os FAIL.

Os seis ENV_BLOCKED são capacidades nativas não executadas, com produto NOT_ASSESSED: INDEX-018(--resolved), BRANCH-015(--delete-merged), REWRITE-015(history), REMOTE-014(url-parse), PROTO-007(git-shell nos caminhos examinados) e TOOLS-003(Gitweb CGI nos caminhos padrão/configurados examinados). Não se declarou Gitweb ausente em todo o host. Razões literais e hashes estão no extrato; só o prefixo da instalação foi normalizado.

FULL11 tem três SKIPs por permissão de symlink Windows e um do roundtrip Bash do perfil do host. TOOLS-011/native-optional-bash passou com Git Bash/Windows; aquele SKIP não significa ausência de Bash.

O pipeline11 recusou com exatamente dois passos: infra11 e broad11. Typecheck16/build15/smoke11 não iniciaram. AFTER11 encerrou naturalmente com zero passos; suas contraprovas filhas não rodaram e não adicionaram testes ao FULL11. Nenhum processo de teste foi sinalizado.

A campanha posterior precisa de resultados e fingerprint próprios. Sua aprovação não converte a campanha 11 em sucesso nem permite somar versões distintas.
