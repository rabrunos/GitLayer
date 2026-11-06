# Validação — Etapa 2B

A validação funcional e os benchmarks finais encerraram. A full V10 concluiu **603 resultados: 599 PASS, quatro SKIP e zero FAIL/cancel/todo**. A infraestrutura V10 concluiu **117/117 PASS**. A matriz inteira V11 concluiu **355 PASS, seis ENV_BLOCKED e zero FAIL entre 361 selecionadas**. São campanhas distintas; seus totais não são somados. As execuções foram locais, headless, com Git oficial e fixtures isoladas, sem CI remoto ou validação gráfica.

## Fontes e escopo

Baseline congelada: e8f2e3feba87224246a42337f77f702914df989e. As 234 entradas funcionais da full V10 conservaram fingerprint **1c0646a4edef5a2616050417dcba89abb5fd3e1ff2ed1f7a94b01bc333f4045d** antes/depois. A versão atual tem fingerprint **c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc**, também conservado na broad V11 e no preflight dos benchmarks finais.

A única diferença é a receita RECOVERY-011 em tests/git-compat/cases/additional.mjs. A [prova de transição](SOURCE-TRANSITION-PROOF.json) revalida os dois arquivos de fontes de 234 entradas e o projeto: outros **233 arquivos**, Core/CLI, dependências/configuração, **60 entradas da full e três helpers** permanecem byte a byte iguais. A receita alterada está fora dos quatro globs da full; a inspeção dos testes/helpers não encontrou chamada à matriz. A full continua atribuída ao snapshot antigo, sem renomeá-la como execução sobre o fingerprint global novo. A broad inteira foi executada novamente sobre o novo.

Core22 por tuplas caminho/hash: **807ad17f66e41e3147792049797a48b56c919737734bbe2a847149a07909ee8b**. O benchmark usa algoritmo próprio caminho/tamanho/hash, digest dcada2527e12c8b65b437f8011125798c484f75adba7c6727cd366657cf3dceb. O produto43 da matriz tem digest c5eca06ec0ff9ba4c4a78db9d4c4c995270d49c249ef191f17f3ba13cba2b1d7; o runner642 V11, 6b9a3e248b9720e320ce9a01f533f8e42ca6037b2aa955252a02e508bf912290. Esses domínios não são intercambiáveis. [Manifesto atual](SOURCE-MANIFEST-c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc.json), [manifesto V10](SOURCE-MANIFEST-1c0646a4edef5a2616050417dcba89abb5fd3e1ff2ed1f7a94b01bc333f4045d.json) e [inventário dos recibos](FINAL-VALIDATION-RECEIPTS.json).

## Campanhas finais executadas

| Campanha | Comando/corpus | Resultado próprio | Processo ms | Evidência |
| --- | --- | --- | ---: | --- |
| Typecheck V10 | npm.cmd run typecheck, execução direta de tsc | PASS, exit 0 | 2847 | [Recibo](VALIDATION-TYPECHECK-V10.json) |
| Build V10 | npm.cmd run build:core, execução direta do script | PASS, exit 0 | 124 | [Recibo](VALIDATION-BUILD-V10.json) |
| Smoke V10 | node scripts/smoke-core-cli.mjs --out &lt;EVIDENCE&gt;/smoke | PASS; 82 comandos, quatro snapshots, sete passos; runtime relocado sem dependências | 110506 | [Recibo](VALIDATION-SMOKE-V10.json) |
| Infra V10 | Corpus de npm.cmd run compat:infra | 117 PASS/117; zero FAIL/SKIP/cancel/todo, exit 0 | 101089 | [Recibo](VALIDATION-INFRA-V10.json) |
| Full V10 | Corpus completo de npm.cmd test; concorrência 2 | 599 PASS, quatro SKIP, zero FAIL/cancel/todo em 603; exit 0 | 6106662 | [Recibo](VALIDATION-FULL-V10.json) |
| RECOVERY-011 V11 dirigido | runner.mjs --suite broad --id RECOVERY-011 --jobs 1 --seed 20261105 --keep-fixtures | Uma variante aceita PASS, 21 assertions; fsck nativo exit 0 | 20811 internos | [Recibo](RECOVERY011-DIRECTED-V11.json) |
| Broad V11 inteira | Corpus compat:broad, jobs 2, seed 20261105, fixtures retidas | 355 PASS, seis ENV_BLOCKED de 361 selecionadas; zero FAIL, exit 0 | 1585988 supervisor / 1560836 internos | [Recibo](VALIDATION-BROAD-V11.json) |
| Benchmark final Core22 | Oito cenários B→F instrumentados mais par clock-only 1k separado | 17 controladores PASS e um TIMEOUT da baseline 10k; zero FAIL | Por controlador no JSON | [Amostras](BENCHMARKS.json), [recibo](BENCHMARKS-CAMPAIGN-RECEIPT.json) |

A full tem TAP completo e consistente, duração **6106585,8319 ms**, distinta do processo. As [quatro linhas SKIP observadas](FULL-V10-SKIPS.json) são três permissões de criação de symlink e um roundtrip Bash do host omitido pelo perfil Windows. Isso não significa ausência de Bash: a matriz inclui execução Bash nativa em seu escopo próprio. Testes que inspecionam contratos do laboratório não abrem Electron nem certificam GUI.

O supervisor externo V10 manteve corpus, concorrência e oráculos. Antes da execução, seu teto agregado da full foi fixado em seis horas, em vez das três do supervisor canônico. O timeout CLI de **900000 ms é o padrão**, com overrides individuais preservados, incluindo **1800000 ms** no caso composto D01 de materialização. Suas seis variantes passaram em 563129,3563 ms. Não houve aumento de orçamento no meio da execução. [Vínculo exato do supervisor](VALIDATOR-V10-BINDING.json), [patch normalizado](VALIDATOR-V10-NORMALIZED.patch) e [receita portátil](REPRODUCE-VALIDATOR-V10-V2.mjs). A receita pública foi inspecionada/verificada por sintaxe; o programa externo identificado no recibo foi o efetivamente executado. Não se atribui à receita uma execução que ela não teve.

## Broad V10 FAIL e correção restrita da receita

A [broad V10 original](VALIDATION-BROAD-V10.json) terminou com **354 PASS, um FAIL e seis ENV_BLOCKED em 361 selecionadas**, exit 1. Permanece FAIL. RECOVERY-011 esperava exit 4/GIT_FAILED, mas o primeiro acesso ao índice foi a guarda física anterior à transação: com FileShare.None, Node recusou open com **EBUSY**, mapeado pela CLI para saída **3**. O checkpoint por cópia não foi alcançado. [Forense](RECOVERY-011-EXCLUSIVE-HANDLE-FORENSIC.json).

A [alteração isolada da receita](RECOVERY-011-PORT.patch) exige precisamente exit 3/EBUSY e a origem de abertura esperada. Acrescenta preimages de bytes/identidade/modo/tempos dos índices MAIN e privado, stage/blobs oficiais, HEAD/todas as refs, arquivos físicos e inventário de metadados/journals; depois da liberação do holder próprio exige igualdade, ausência de nova transação e fsck nativo. Não há allowlist genérica, skip, reordenação de guarda ou mudança de Core/CLI. A [proposta preservada](RECOVERY-011-PORT-PROPOSAL.md) descreve o momento anterior à aplicação; o [dirigido V11](RECOVERY011-DIRECTED-V11.json) e a broad V11 são as execuções posteriores aceitas.

## Bloqueios e dimensões da matriz

A broad V11 tem 386 variantes/358 IDs no catálogo. As 25 NOT_RUN são cinco NOT_SELECTED e 20 OUT_OF_SCOPE_CURRENT_PHASE; não são 25 casos selecionados interrompidos. Os seis ENV_BLOCKED pertencem a probes implementados do Git oficial:

| Caso | Limite observado |
| --- | --- |
| INDEX-018 | git add --resolved não anunciado por este Git |
| BRANCH-015 | --delete-merged não disponível |
| REWRITE-015 | builtin history não disponível |
| REMOTE-014 | builtin url-parse não disponível |
| PROTO-007 | git-shell ausente da instalação observada |
| TOOLS-003 | Gitweb CGI não encontrado nos caminhos padrão/configurados da fixture, sem alegar ausência universal |

[Domínios, comandos e bloqueios](BROAD-V11-DOMAINS-ENV.json). As **13081 invocações registradas** são a soma dos arrays de comandos das 361 variantes, não contagem de todos os descendentes de processos nem de comandos Git exclusivamente. Status de produto continuam separados: 58 VERIFIED_SUPPORTED, 27 DOCUMENTED_RESTRICTION, 12 PENDING_PRODUCT_SPEC, um PRODUCT_GAP e 288 NOT_ASSESSED. PASS de uma recusa não implementa a operação recusada. Os 27 contratos permanecem em 20 implementados e sete parciais.

## Desempenho e armazenamento finais

A primeira ativação 1k foi **39,202→41,639 s (+6,216%)**, off **47,934→41,122 s (−14,211%)**, reativação sem cache **36,613→39,486 s (+7,847%)**. First é n1; off/react são medianas de três ciclos na mesma fixture. Dez mil arquivos concluíram first/off/react em **412,129/521,793/405,771 s**, com três provas nativas completas. A baseline 10k atingiu teto de 180 s sem uma API/prova completa, portanto não há delta pareado. A meta de cinco segundos falhou. O limite atual de 35 minutos foi fixado antes; o caso inteiro terminou em cerca de 25min42s, incluindo setup/oráculos/consultas.

Os journals escritos na primeira ativação 1k caíram de **1193130811 para 3850859 bytes (−99,677%)**, mas os syncs de arquivo passaram de 2013 para 4024. Persistência inclusiva foi **22237,4033→16174,3521 ms**; fases/Git/IO se sobrepõem e não devem ser somados. No endpoint após quatro ativações/três off, os journals retidos cresceram **9730092→30427313 bytes**. A retirada de materialized não elimina logs/índices de recuperação retidos. [Tempos absolutos e regressões](BENCHMARKS.md), [armazenamento](STORAGE.md).

PC sem uso/sem jogo conforme relato do usuário observado às 01:22:29 UTC; presença de processos e telemetria de carga não foram coletadas. A ordem fixa B→F, filesystem aquecido e variação temporal impedem tratar diferenças como causalidade isolada. O par clock-only 1k é separado, n1, sem misturar amostras ou subtrair overhead estimado. Não se mediu quando o primeiro arquivo ficou visível. O histórico [V7](BENCHMARKS-V7-PRE-CORRECTION.md), incluindo API de 501 s e linha do tempo antiga, permanece identificado e não representa o Core corrigido.

## Falhas históricas preservadas e limites atuais

As [tentativas anteriores](RESULTS-HISTORY-PRE-FINAL.md), [full V9 FAIL](VALIDATION-FULL-V9.json) e [dirigido de checkpoint](CHECKPOINT-INDEX-FOCUSED.json) continuam separados. A V9 tinha 603 resultados, 575 PASS, 24 FAIL e quatro SKIP; sua validação write-tree alterava bytes TREE/stat dos índices vivos. A correção executa a validação em cópia independente com fronteira temporal preservada e associa o backup ao fingerprint esperado antes de backup-ready. O oráculo legado exige agora os bytes B originais exatos com epoch+1s na restauração; a antiga reescrita pelo Git fica como contraprova, sem afrouxar comparações.

Recusas diante de interrupção, falta de objeto ou interferência não são estado saudável. A janela de substituição de destino **já existente** entre último fingerprint e rename ainda pode sobrescrever edição externa; a correção de nome ausente não elimina essa janela. No GC agressivo RECOVERY-013, B podado bloqueia a entrada no rollback automático A apesar do backup válido: preservação e recusa passam, restauração automática não é suportada nesse interleaving. [Recuperação](RECOVERY.md), [limites](LIMITATIONS.md). Não há cache de projeção, teste de corte real de energia, execução Linux ou certificação universal de concorrência.

## Cópia nova e publicação

A cópia nova local do commit de implementação **f213022bd121648fa4e9e1bb1ecf9af27c4c998b** concluiu **PASS**. [Recibo público](FRESH-COMMIT-A.json) e [auditoria de privacidade](FRESH-COMMIT-A-PRIVACY.json). Os 234 inputs do commit, projeto e clone têm fingerprint c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc, sem diferença antes/depois. O clone não usa alternates nem objetos hardlinked.

A instalação pelo lockfile, com scripts desativados, typecheck, build Core/CLI, help e smoke relocado sem dependências passaram. O smoke tem sete passos, 82 comandos e quatro snapshots. Nenhuma dessas contagens é somada à full, à infraestrutura ou à matriz; não houve nova full nem CI remoto nesse clone.

O [fechamento documental](PUBLICATION.md) conserva esses 234 inputs, acrescentando o recibo de A. Sua cópia local pré-push e a cópia nova do GitHub só podem ser verificadas depois de o commit documental existir. O SHA final, os resultados dessas duas cópias e a igualdade HEAD/origin/main/servidor são informados no encerramento após a observação. Este documento preserva a evidência concreta de A sem antecipar o próprio hash.
