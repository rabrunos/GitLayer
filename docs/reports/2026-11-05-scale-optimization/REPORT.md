# Escalabilidade e movimentação segura — Etapa 2B

A etapa reduziu a regravação dos journals e a desativação de mil arquivos, mas não tornou a ativação universalmente mais rápida. A primeira ativação de 10.000 arquivos concluiu em **412,129 s**, off em **521,793 s** e reativação em **405,771 s**. As três operações têm provas nativas independentes; a meta de cinco segundos **não foi atingida**. Segurança, tempo total e espaço retido são avaliados separadamente.

Baseline: `e8f2e3feba87224246a42337f77f702914df989e`. Main local, origin/main e `ls-remote` coincidiam antes da implementação; o código estava limpo. Dependências, perfis e evidências ignorados foram preservados. Não houve migração real, desktop, configuração global ou remoto pessoal usado como fixture.

## Contratos e implementação

Git oficial conserva branches, commits, árvores, blobs, índices e histórico. Nenhuma otimização faz fetch, push, merge, rebase, reset ou atualização de branch local a partir de tracking. Ativação, destino de edição e abertura como branch continuam distintos. D-01 a D-04, V05, revogação durável, propriedade exclusiva, staging independente e a distinção A commitado/B staged/C no disco mantêm suas barreiras.

- **Journals incrementais:** backup-ready e AFTER passam a registrar deltas tipados em log ordenado, com checksum, encadeamento e watermark sincronizado. Outros passos conservam snapshots. Leitura de journals anteriores permanece compatível, sem migração silenciosa ou expurgo histórico.
- **Publicação de nome ausente:** uma cópia independente validada e sincronizada é publicada por link transitório sem substituição, seguido da retirada do nome privado. Não se usam hardlinks como cópias independentes ou cache. EEXIST, EXDEV e erros não autorizam fallback substitutivo. [Armazenamento](STORAGE.md).
- **Fontes vinculadas ao Git:** ativação usa imagem independente do índice validado. Os bytes extraídos precisam corresponder ao blob cru ou à conversão oficial do blob solicitado; OID e SHA-256 físico são observados no mesmo FD. O hash aprovado continua sendo a expectativa da cópia posterior.
- **Índices e checkpoints:** criação inicial, shelf e staging gerenciado têm testemunhos de identidade e BEFORE/AFTER duráveis. O staging associa a árvore fixa B e o contexto nativo, sem recapturar C. A reconstrução dos checkpoints também valida write-tree em cópia independente, preservando bytes e fronteira racy dos índices vivos; refs/CAS, backups e reconstrução continuam presentes. Core.baseCommit explícito conserva seu caminho Git nativo.
- **Refs diretas:** o helper usa a transação oficial update-ref com no-deref, prepare e observação de tipo sob locks nativos antes de commit. No-deref isolado não prova que a ref seja direta; alias observado exige abort.
- **Temporários:** só a extração recém-criada, comprovada como descartável e sem dependências recebe retirada exata depois de finish durável. Backups, imagens técnicas, journals, refs e dados históricos continuam retidos. O buffer regular é limitado por `max(1, min(256 KiB, opened.size))`, sem enfraquecer validação de FD/hash/metadados.

Rename direto da extração, cache de projeção limpa, rename de diretório e novo reflink não foram adotados. A normalização imutável de safePath saiu do loop de irmãos, mas disco, identidade e aliases continuam sendo observações atuais. [Alternativas e fontes técnicas](DECISIONS.md), [protocolo e falhas](RECOVERY.md).

## Validação e fontes

A [full V10](VALIDATION-FULL-V10.json) concluiu **603 testes, 599 PASS, zero FAIL e quatro SKIP**, sem cancelamentos/todo, em seu fingerprint funcional `1c0646a4edef5a2616050417dcba89abb5fd3e1ff2ed1f7a94b01bc333f4045d`. Typecheck, build Core/CLI, smoke compilado de 82 comandos/quatro snapshots e [infraestrutura 117/117](VALIDATION-INFRA-V10.json) também passaram nas suas fases próprias. O timeout padrão Node de 900.000 ms admite overrides explícitos: security-ownership usa 1.800.000 ms no grupo de seis variantes; não houve teto uniforme de 900 segundos.

A [broad V11 inteira](VALIDATION-BROAD-V11.json) concluiu **355 PASS, seis ENV_BLOCKED e zero FAIL entre 361 variantes selecionadas**; 25 variantes não executadas são cinco não selecionadas e 20 fora do escopo da fase. Universo: 386 variantes/358 IDs. Os bloqueios e os SKIP não são aprovações de suporte. A classificação histórica de requisitos permanece em 20 implementados e sete parciais, GL-01/09/15/18/19/20/22; testar uma recusa ou melhorar tempo não promove requisito.

A broad usa o fingerprint posterior `c5f919feb2de4cb4ef81d6011dcf1193eca5441afcdb6023f065e202e61350fc`. A única mudança foi a receita de matriz RECOVERY-011, fora dos quatro globs da full: 233 outras entradas funcionais, os 60 arquivos da full, três helpers e os 22 arquivos Core ficaram exatos. A [prova restrita](SOURCE-TRANSITION-PROOF.json) conecta as campanhas; **a full continua atribuída à fonte em que realmente executou**. Core 22: `807ad17f66e41e3147792049797a48b56c919737734bbe2a847149a07909ee8b`; fingerprint próprio do benchmark: `dcada2527e12c8b65b437f8011125798c484f75adba7c6727cd366657cf3dceb`. São domínios diferentes. [Vínculo de escopo](SOURCE-SCOPE-LINK.md), [resultados separados](RESULTS.md).

A broad V10 anterior ficou FAIL: 354 PASS/um FAIL/seis ENV_BLOCKED. RECOVERY-011 esperava exit 4/GIT_FAILED, mas o FD guard recusou antes da transação com exit 3/EBUSY; o wrapper abortou antes de qualquer assertion. O port estrito conserva esse erro real e reforça preimages, raw/mtime/identidade, staging, refs, disco, inventário e fsck após release. O [dirigido posterior](RECOVERY011-DIRECTED-V11.json) passou uma variante/21 assertions; a broad V11 é uma campanha inteira distinta, não soma desse dirigido com PASS antigos. Não houve Corefix para esse port.

### História preservada e correções de integridade

As contraprovas e os FAIL intermediários não foram apagados:

1. A baseline podia substituir um destino criado no intervalo final de publicação. A rota para nome ausente agora recusa sem substituição; a limitação do destino existente permanece explícita abaixo.
2. Índice/ref alterados durante ativação podiam ser legitimados pelo consumo posterior do índice vivo. A origem independente e gates atuais recusam essa adoção. [Provas](ACTIVATION-FRONTIER-REPRO.json).
3. Os candidatos V2/V4/V5 tiveram lacunas de identidade em shelf, restauração e índice recém-criado. Testemunhos duráveis anteriores aos efeitos protegem a imagem exata; bytes iguais não autorizam adotar ou retirar um inode externo. [Shelf](SHELF-ADOPT-REPRO.json), [recovery](RECOVERY-IDENTITY-REPRO.json), [inicialização](INITIAL-INDEX-RETENTION-REPRO.json).
4. A baseline e V6 recapturavam índice C posterior ao add B. O staging fixo B e sua guarda de recuperação foram corrigidos sem alegar sobrescrita de C naquela prova. [Recaptura](STAGE-RECAPTURE-REPRO.json).
5. O V7 aceitava C alterado na extração antes do primeiro fingerprint, e checkpoint simbólico podia alterar uma tag técnica. A vinculação dos bytes e a transação nativa preparada corrigem essas fronteiras. [Extração](MATERIALIZED-SOURCE-REPRO.json), [refs](CHECKPOINT-SYMREF-REPRO.json).
6. A full V9 concluiu FAIL: 603 testes/575 PASS/24 FAIL/quatro SKIP. Native write-tree vivo podia preencher TREE inválido e modificar raw/identidade dos índices, inclusive MAIN no papel Layer-branch. O reparo move esse refresh para cópia verificada, sem eliminar reconstrução ou validação nativa. Os oráculos raw foram mantidos; NativeReplay antigo ficou como contrafactual explícito. [Perícia](DEACTIVATION-INDEX-TREE-FORENSICS.json), [dirigidos A1/A2/B2/C separados](CHECKPOINT-INDEX-FOCUSED.json).

O primeiro gate de interleavings conservou cinco PASS/dois FAIL. Seu domínio produto era **43 arquivos/8196470f…**, runner **628/5598c82a…** e arquivo total **671/02eea917…**; funcional 234 era outra projeção, sem somar domínios. RECOVERY-003 teve erro novo de teste no estado e depois serialização de undefined rejeitada pelo supervisor; o [rerun3](INFRA-MATRIX-RERUN3.json) aceitou somente esse caso. RECOVERY-013 recebeu PASS estrito no [rerun2](INFRA-MATRIX-RERUN2.json), preservando sua regressão conservadora de automatismo: plan.tree B ausente bloqueia o rollback automático atual apesar do backup A válido. Status unsafe e duas recusas cat-file 128 preservam evidências; isso não prova que A seja irrecuperável nem que tal bloqueio seja inerente à segurança.

Os tempos V7/Core 21, sua full interrompida, controles de buffer/limpeza e o inventário pendente de 10.000 permanecem [históricos](BENCHMARKS-V7-PRE-CORRECTION.md). Não medem o Core 807 atual e não entram nos resultados abaixo. Nenhum PASS de campanhas diferentes é totalizado para construir uma full.

## Operações completas medidas no Core corrigido

A campanha final usa o mesmo observador nos dois endpoints, ordem fixa baseline→Core por cenário e PC sem uso/jogo conforme declaração do usuário. Primeira ativação inclui registro e é n1; off/react de 10/100/1.000 são medianas de três ciclos da mesma fixture, não três fixtures independentes. Grandes, compostos e 10.000 são n1. Cache aquecido, ordem e variação temporal limitam causalidade; não há confiança estatística ou correção por clock-only. Tempos são da API completa, sem startup da CLI. [Amostras, custos e condições](BENCHMARKS.md).

| Arquivos | Operação | Baseline s | Core final s | Δ s | Δ % |
| --- | --- | ---: | ---: | ---: | ---: |
| 10 | Primeira ativação | 2,315 | 5,419 | +3,104 | +134,099% |
| 10 | Desativação limpa | 2,358 | 2,439 | +0,081 | +3,418% |
| 10 | Reativação sem cache | 2,182 | 3,233 | +1,051 | +48,142% |
| 100 | Primeira ativação | 4,716 | 8,782 | +4,066 | +86,212% |
| 100 | Desativação limpa | 5,525 | 5,852 | +0,327 | +5,920% |
| 100 | Reativação sem cache | 4,587 | 6,560 | +1,973 | +43,020% |
| 1.000 | Primeira ativação | 39,202 | 41,639 | +2,437 | +6,216% |
| 1.000 | Desativação limpa | 47,934 | 41,122 | −6,812 | −14,211% |
| 1.000 | Reativação sem cache | 36,613 | 39,486 | +2,873 | +7,847% |
| 10.000 | Primeira ativação | Não concluiu | 412,129 | — | Sem par completo |
| 10.000 | Desativação limpa | Não concluiu | 521,793 | — | Sem par completo |
| 10.000 | Reativação sem cache | Não concluiu | 405,771 | — | Sem par completo |

O cenário final de 10.000 foi **PASS inteiro**, com três provas nativas de blobs/ausências, HEAD, refs de branches e MAIN semântico conferidos fora dos relógios. Off sujo recusou LAYER_DIRTY em 83,951 s. Seu budget inteiro de 2.100 s, incluindo setup/oráculos, foi definido antes; o baseline atingiu TIMEOUT em 180,166 s no budget prévio de 180 s, sem API ou prova completa. Não há delta pareado válido nessa escala. Os 18 controladores fecharam com 17 PASS e esse único TIMEOUT baseline, sem FAIL. A visibilidade do primeiro arquivo **não foi medida nesta campanha**; a antiga linha do tempo V7 não é um relógio de visibilidade atual.

As regressões incluem os grandes/compostos: primeira ativação de 100 MiB, 3,293→6,965 s (+111,521%); três de 32 MiB, 3,122→6,695 s (+114,475%); soma das cinco chamadas iniciais para 100 arquivos totais, 19,614→36,100 s (+84,057%); dez chamadas, 52,842→84,384 s (+59,691%). São n1; as somas excluem setup/oráculos intermediários e não são uma ativação atômica única. O alvo individual move 20/10 arquivos com 4/9 outras Layers ativas. O ganho de off em 1.000 não é ganho universal de ativação.

A calibração separada sem profiler, n1, observou first 34,101538→39,702203 s, off 44,381834→39,359877 s e react 33,776724→37,199937 s. Não corrige as medianas instrumentadas. Contagens diretas de Git na primeira ativação de 1.000 foram 46→119; off 44→44 e react 45→61. Descendentes não são observados; fases são inclusivas e se sobrepõem. [Contadores completos](BENCHMARKS.json).

### Journal e espaço: ganhos diferentes

Na primeira ativação de 1.000, bytes de journal conhecidos na API JavaScript caíram **1.193.130.811→3.850.859 (−99,68%)**. Syncs passaram de 2.013 para 4.024; persistência inclusiva,22,2374033→16,1743521 s. Não são bytes físicos do dispositivo, parcela exclusiva do total ou redução de barreiras.

No endpoint equivalente de três ciclos, a retenção fez o oposto: **journals 9.730.092→30.427.313 B**, repositório lógico 12.617.916→32.468.035 B e dados de arquivo alocados reportados 10.321.920→31.207.424 B. Logs/snapshots continuam preservados; imagens de validação 352.412 B e inicialização 88.103 B são retidas. Materialized final 0 B; para esses arquivos pequenos sua alocação reportada era 0 também no baseline, sem implicar custo físico total zero. Cache de projeção 0 B por inexistência. Menos regravação não significa menos disco retido em todos os cenários. [Classes e escopos](STORAGE.md).

## Respostas aos 18 critérios da missão

| Critério | Resposta e evidência |
| --- | --- |
|1. Método mais rápido e seguro|A rota selecionada combina checkout-index oficial, origem vinculada ao Git, cópia independente por streaming, publicação sem substituição para nome ausente e journal incremental. Mantém as guardas comprovadas; não demonstrou ser universalmente mais rápida. Off 1.000 arquivos melhorou 14,211%, enquanto first/react pioraram.|
|2. Rename direto inicial|Não adotado. fs.rename substitui nomes existentes; mover o inode extraído também mantém a influência de FDs anteriores da fonte. O [probe](SOURCE-HANDLE-PROBE.json) demonstra essa fronteira específica. Link transitório publica apenas a cópia já independente e não elimina essa cópia.|
|3. Projeção limpa reutilizável|Não implementada nem medida como cache. Reativação extrai novamente a versão Git solicitada; não há ganho de cache a declarar.|
|4. Cache/espaço|Cache físico não é necessário e ocupa 0 B. Índices, imagens técnicas, backups, journals e temporários têm responsabilidades distintas. Retenção pode crescer mesmo com menor regravação; inventários lógicos e alocados são separados.|
|5. Reflink|Nenhuma vantagem nova demonstrada. ENOSYS no NTFS anterior permanece histórico; fallback de cópia não prova CoW. Há rota independente sem reflink.|
|6. Diretórios inteiros|Não adotado. Diretórios compartilhados e criação externa após inventário impedem inferir exclusividade da pasta. Não se impôs estrutura ao usuário.|
|7. Custo dos journals|First 1.000 arquivos escreveu 1.193.130.811→3.850.859 B na API; persist inclusivo 22,237→16,174 s e sync 2013→4024. Isso mede regravação, não fração causal exclusiva do tempo nem disco retido.|
|8. Durabilidade|Deltas tipados mantêm backup-ready/AFTER e append+watermark sincronizados. Truncamento, ordem, ID, checksum, flush e guardas incompatíveis recusam; schema 1 anterior continua legível sem migração silenciosa.|
|9. Cópias necessárias|Índices independentes, imagens de consulta/staging/ativação/inicialização, BEFORE e publicação têm papéis distintos. O refresh nativo ocorre em cópia, sem eliminar validação ou reconstrução. Exportação não inclui automaticamente todo workspace/objeto/temp externo.|
|10. Dados dispensáveis|Somente a nova extração comprovadamente descartável e sem dependências é retirada após finish. Consulta conserva limpeza própria. Não há expurgo retroativo de backups, journals, refs, shelves ou dados desconhecidos.|
|11. Tempos atuais|First/off/react:10 arquivos 5,419/2,439/3,233 s;1.00041,639/41,122/39,486 s;10.000412,129/521,793/405,771 s. API completa; firstn 1, off/reactn 3 nos menores e n1 em 10.000 arquivos. Meta 5 s não atingida.|
|12. Ganhos absolutos/%|Em 1.000 arquivos, off−6,812 s/−14,211%; first+2,437 s/+6,216%; react+2,873 s/+7,847%. Pequenos, grandes e compostos têm regressões explícitas.10.000 arquivos não tem baseline completo comparável.|
|13. Interrupção/cópia parcial|Preserva evidências e pode exigir recovery manual. ENOSPC após 17 B reais ocorreu só no temporário; V05 recusou repetição. RECOVERY-013 bloqueia automatic rollback atual apesar de A backup válido. Mortes de filhos não certificam energia.|
|14. Versão errada/perda conhecida|As contraprovas de extração, refs, recaptura e identidade tiveram reparos e validação identificados. Permanece risco conhecido: uma edição em destino existente após o último fingerprint e antes do rename substitutivo pode ser sobrescrita. A rota de nome ausente não fecha essa janela; não se declara ausência universal de perda/versão errada.|
|15. Rejeições|Rename substitutivo para nome ausente, mover inode extraído sem excluir escritor anterior, hardlinks como cópias independentes, cache sem benefício/protocolo, rename de diretório por inventário anterior e reflink presumido. No-deref isolado também não substitui guarda de tipo sob locks.|
|16. Testes|Full 10:603/599 PASS/4 SKIP/0 FAIL no 1 c 064; infra 117/117, build/typecheck/smoke próprios. Broad 11:355 PASS/6 ENV/0 FAIL no c 5 f 919 com prova estrita de transição. Broad 10 FAIL,V9 FAIL e timeouts históricos permanecem; nenhum denominador é somado. Cópia nova/publicação têm fechamento próprio posterior.|
|17. Limitações|[LIMITATIONS](LIMITATIONS.md) mantém fanout, custos de validação/retenção, snapshots não incrementais, RECOVERY-013 parcial, conflitos manuais, janela do destino existente, cache ausente e alcance Windows realmente observado.|
|18. Commit final|O commit desta entrega é identificável no histórico da main; o SHA verificado e a igualdade HEAD/origin/main/servidor são informados na resposta de encerramento, junto da validação efetivamente executada da cópia nova. Este documento não antecipa o próprio SHA.|

Os relatórios históricos e contratos GL-01 a GL-27 continuam disponíveis nas [fontes originais](../../decisions/implementation-2026-11-02/01-PROMPT-CODEX.md) e na [matriz histórica](../2026-11-02-closure/requirements.json). Validação local/headless não é CI remoto, Linux, todos os backends ou prova de perda de energia. Cópia nova, commit e push só recebem aprovação após seus recibos reais; não são inferidos dos benchmarks.