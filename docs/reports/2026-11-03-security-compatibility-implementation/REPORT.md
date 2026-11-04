# Etapa 1B — segurança e compatibilidade do Git Layer

**Validação local final concluída:**311 PASS/0 FAIL/4 SKIP e zero cancelamentos em315 resultados headless, com pipeline concluído no mesmo ACE17/183. **Cópias commitadas e publicação ainda pendentes**, sem atestação antecipada.

Fonte validada: **183 inputs**, fingerprint `ace17ce01ec8a0c5b908f0cb1a912f77af7b3f02af51313e7c749a2daeabc19d` (ACE17). Fingerprint de fontes não é SHA de commit. A [validação](RESULTS.md), os [recibos](VALIDATION.json) e o [manifesto](SOURCE-MANIFEST.json) identificam essa mesma fonte; os documentos acrescentados depois não alteram esses183 inputs.

## Resumo executivo

A etapa trata **quatro famílias de defeitos gerenciados, D-01/D-02/D-03/D-04, e duas lacunas P1**: atualização de exceções de ignore e coerência do diagnóstico independente de origem base aceita. As variantes encontradas em renomeações, unstage, rollback e materialização continuam na família D-01; não aumentam artificialmente esse total.

A solução implementa a combinação **A+B**: validações e recuperação conservadora do coordenador, apoiadas por refs, índices, exclusões e locks nativos do Git. Core e CLI continuam independentes de editor. Não foram introduzidos interceptadores globais, watchers obrigatórios, worktrees sincronizadas ou um novo sistema permanente de cópias.

FULL14 e pipeline concluíram no ACE17/183 estável; os focos permanecem execuções separadas. Cópias commitadas e publicação ainda precisam de sua atestação própria. Mantêm-se **20 requisitos implementados e sete parciais: GL-01/09/15/18/19/20/22**; esta etapa não certifica Linux, todas as versões Git, worktrees arbitrárias, CI remoto ou desempenho.

## Defeitos e correções

| Família | Efeito confirmado antes da correção | Comportamento implementado |
| --- | --- | --- |
| D-01 — origem dos arquivos | Conteúdo de uma origem podia ser reservado, commitado ou descartado por outra; variantes também reapresentavam autorização de ausência obsoleta após rollback/materialização. | Rename conhecido conserva origem; ausência+candidato exige resolução explícita; aceitações da base e revogações duráveis sobrevivem às transições cobertas; recuperação incerta permanece bloqueada. |
| D-02 — fronteira do destino | Consultas incompatíveis podiam publicar metadados de edição que não reabriam. | Captura coerente, tentativas limitadas e revalidação do contexto anterior antes da publicação, mantendo validadores estritos. |
| D-03 — staging parcial | Git add podia alterar MAIN e depois retornar erro; o coordenador não podia tratar esse erro como recusa sem efeitos. | Add gerenciado prepara uma cópia integral técnica do índice e só publica após sucesso, lock nativo, comparação do estado e journal durável. |
| D-04 — destino do commit | Uma instância Core com papel antigo de Layer como branch podia publicar o staging de MAIN na main ao receber commit da Layer. | O dispatch de commit/unstage ocorre depois de guard/refresh, dentro da operação coordenada; Layer projetada sem staging recusa NOTHING_STAGED. |

As duas lacunas P1 não demonstraram nova perda física: exceções antigas podiam neutralizar ignore alterado; o resgate independente podia marcar segura uma colisão acceptedBase×Layer que o Core já recusava. As correções reavaliam regras atuais e alinham a autoridade usada pelo diagnóstico independente.

Os [históricos de fronteira](FRONTIER-HISTORY.json), [origem base](BASE-ORIGIN-HISTORY.json), [staging parcial](D03-HISTORY.json) e [commit por papel antigo](STALE-COMMIT-BEFORE.json) preservam snapshots, efeitos e falhas anteriores. O [histórico do harness](HARNESS-HISTORY.md) mantém receitas revistas, FAILs e campanhas interrompidas; não os converte em PASS.

## Propriedade, edição e staging

Uma Layer ativa conserva arquivos, índice e histórico próprios. Ativar, selecionar destino de edição e abrir como branch continuam operações distintas. Sem destino, criações comuns seguem o fluxo da base; com destino, somente criações elegíveis posteriores à fronteira são atribuídas automaticamente. Arquivos anteriores ou ignorados não são absorvidos retroativamente.

`rename-file` conserva a origem conhecida sem staging. `ownership-review` consulta a ambiguidade e fornece token; `ownership-resolve` permite declarar rename, criação independente, exclusão reconhecida ou aceite base. A decisão não move bytes nem prepara conteúdo. Token obsoleto exige nova revisão; histórico e reservas explícitas de outra origem não são transferidos por inferência.

Ausência conhecida com candidatos impede staging, commit ou descarte gerenciados até uma decisão válida. Candidatos podem incluir caminhos anteriores sem dono ou ignorados: hash, nome ou inode não provam que uma criação seja independente. Renomeações conhecidas e externas continuam distintas.

`base-unstage` conserva disco e origem base conhecida, inclusive MAIN NEW legítimo sem ambiguidade. Preparar nativamente um candidato incerto não lhe dá autoridade base: retirar staging não deve criar reserva artificial nem esconder a ambiguidade. Se a retirada apagaria a última âncora de um caminho ausente, resolva essa ausência primeiro. Release é uma liberação explícita separada, sujeita à ausência na árvore commitada atual e no índice do proprietário; não apaga histórico.

Diagnósticos distintos orientam a revisão: **BASE_CONTAMINATED** para caminho conhecido de Layer preparado em MAIN; **EDITING_BASE_INTERFERENCE** para integração nativa inesperada na base durante edição; **EDITING_IGNORE_UNSAFE** antes de atribuir newcomer exposto por regras superiores; **IGNORE_UNSAFE** para exclusão inefetiva de caminhos já protegidos.

As regras do usuário mantêm prioridade nativa. Após alterá-las, status/mutações de reconciliação recalculam exceções presentes e elegíveis; caminhos ausentes não recebem whitelist. Preview e ownership-review não reescrevem o bloco. Git executado antes da reconciliação pode usar o bloco anterior. As seis regressões R-02/R-03 permanecem cobertas, sem reabrir aqueles defeitos históricos.

A publicação por índice técnico, lock nativo e comparação de fingerprint cobre **add gerenciado** da base, da Layer projetada e da Layer como branch. Não estende atomicidade a unstage, hunks, checkpoints, commits ou Git direto. A/B/C nas evidências significam conteúdo commitado/preparado/editado no disco; Layers a/b significam origens, não esses estados.

## Troca de branch e proteção opcional

A troca gerenciada exige composição compatível, base tracked limpa e destino de edição encerrado. Mantém Layers compatíveis, staging privado e bytes posteriores no disco; recusa colisões mesmo com conteúdo idêntico. Invoca `git switch --no-guess --no-overwrite-ignore`; se o Git não aceitar a opção, falha sem repetir uma troca insegura.

`protect` continua **opt-in** por repositório. `enabled` registra habilitação; `healthy` indica ausência dos problemas detectados nas reservas; `coverage.complete` considera as branches Layer locais atuais, descontada a Layer que já é a branch Git atual. Avalie `result.safe` e o papel de trabalho separadamente. Antes de registro Core persistido não existe baseline histórica de OID.

As reservas são worktrees reais sem checkout. Não prepare nem faça commit dentro delas: Git pode mostrar exclusões. Reapply só recompõe estado comprovadamente próprio; conteúdo, índices, locks e refs desconhecidos são preservados para inspeção/exportação. Branches externas novas exigem reaplicar a proteção. O bypass nativo `--ignore-other-worktrees` permanece; cobertura nominal não protege bytes contra clean/reset/mv ou troca nativa para outra branch tradicional.

## Recuperação: revogação durável e limite V05

Reconhecer uma exclusão não concede autorização eterna ao target. Reaparecimento observado e publicação gerenciada conhecida retiram a confirmação antiga. O journal conserva `beforeWorkspace` e o backup original e registra o plano opcional estrito `recovery.acknowledgements`, com `revoked` e `pending`; falha/rollback não podem ressuscitar essa autoridade obsoleta.

As [duas contraprovas49ba](d01-evidence/ACK-ROLLBACK-BEFORE.json), com EIO sintético e sem falha de I/O, confirmaram commit de conteúdo da origem Layer na main depois do rollback. A [materialização6994](d01-evidence/MATERIALIZATION-BEFORE6994.json) confirmou conteúdo de A em B após on A e rename externo. A [contraprova de recovery V02](d01-evidence/MATERIALIZATION-RECOVERY-BEFORE.json) pertence a uma composição experimental com overrides, não ao checkout6994 integral. O primeiro observador6994 chamou uma API inexistente: seu rótulo inicial de recusa segura não vale; a continuação com `app.add` confirmou o commit indevido. São variantes D-01, sem nova família ou prova de corrupção de objetos.

**V05 recusa `RECOVERY_CONFLICT`, reason `workspace-materialization-disappeared`, quando uma entrada física de workspace de um plano validado tinha BEFORE ausente e também está ausente na observação atual.** Não depende de AFTER, de `pending/revoked` ou de reconhecimento anterior. Abrange inclusive a primeira ativação e uma interrupção antes da escrita: a ausência atual também pode representar publicação seguida de movimento externo antes do registro durável.

O produto conserva essa incerteza, sem adivinhar rename ou atribuir o candidato a outra Layer. O guard é aplicado antes de restaurar e novamente com o fingerprint efetivamente lido no loop. Metadados aprovados de Git/Layer são excluídos pela mesma classificação estrita do validador; um arquivo de usuário com nome semelhante fora dessas posições não é metadado autorizado.

Planos e backups completos são validados antes das escritas. Imagens alternativas de workspace precisam ser deriváveis do plano; JSON válido ou hash arbitrário não basta. O backup original não é reescrito para facilitar recovery. Journals legados também recusam reposição de confirmação incompatível com materialização conhecida; divergência de backup/plano continua inválida.

Se a interferência só for observada no loop, parte dos metadados anteriores já pode ter sido restaurada. **Não se promete recusa sem efeitos totais nessa intercalação.** O journal permanece pendente e bloqueia novas atribuições gerenciadas; status não deve apresentar recuperação concluída. Use `doctor` e `recovery-export` para pasta nova fora do workspace, preservando índices, refs, bytes e backups. Repetir recover ou apagar o journal não resolve legitimamente a incerteza.

Um OID já publicado evita duplicar commit quando o restante do plano permite concluir; avanço da ref sozinho não dispensa essas verificações. Recusa conservadora não é suporte à recuperação recusada nem garantia de restaurar bytes nunca registrados. O sistema não oferece transação ACID contra programas externos ou certificação de perda de energia.

## O que já funciona e quais riscos permanecem

Os focos verificaram resolução deliberada, preservação de origem base aceita após mudança de HEAD/MAIN, transições de destino, revogação através de falha/recovery e recusas de materialização incerta. Criações comuns continuam disponíveis; Core/CLI não dependem do editor. Consulte a [matriz](MATRIX.md) para os critérios e a [CLI](../../CLI.md) para a operação.

Git direto conserva seu significado. `git add -f` e regras de maior prioridade podem contornar exclusões; ignorar não retira arquivo já rastreado do índice. `clean -fdx/-fX`, reset para revisão conflitante, mv forçado e checkout/switch nativos podem remover ou substituir bytes físicos. As projeções de Layers aumentam a exposição de arquivos que MAIN não rastreia; isso exige diagnóstico e cuidado explícito, sem redefinir os comandos Git como defeitos novos.

Commits e checkpoints conservam somente o conteúdo que efetivamente registraram e permaneça alcançável. Stage B não conserva edição C posterior; backup técnico só ajuda se contiver aqueles bytes. Não há promessa de recuperar C nunca copiado, impedir todo escritor externo entre verificações ou reconstruir causalidade invisível. Preview é observação instantânea, não autorização futura ou backup. Da mesma forma, `safe:true` descreve a verificação atual: não cria cópia dos bytes, não prova que C posterior ao staging esteja em objeto Git e não protege uma operação externa futura.

No comparativo histórico de ignore, dois casos global/info foram executados antes e depois, formando quatro execuções de caso. Cada fixture comparou Git Layer e controle Git, sem perda de bytes, commit ou transferência de origem nesses experimentos; não se somam aos totais finais.

A matriz mantém **MERGE-001 / core-merge-not-implemented-native-ff** como **PASS de execução e PRODUCT_GAP**: o Core recusou NOT_IMPLEMENTED preservando HEAD/índice/disco e o controle Git fez fast-forward.355 PASS de execução não significam355 funcionalidades suportadas; merge gerenciado ausente não é uma quinta família de defeito de segurança.

[SUPPLEMENTAL14](SUPPLEMENTAL14.json) registra13 checks de uma execução da CLI compilada, duas variantes de rename gerenciado sem dono e uma continuação base-unstage. O observador auxiliar inicial desta última falhou numa igualdade bruta de índice; a perícia comprovou diferenças apenas de cache/stat e a continuação preservou C da base no descarte. A falha permanece registrada e o segundo observador é NOT_RUN. Checks, variantes e continuação não se somam à FULL14.

## Validação e estado da entrega

Os cinco focos abaixo têm recibos terminais código0/sinal nulo e183 inputs estáveis no ACE17. São fases distintas; **não se somam à FULL14**. PASS de execução e suporte do produto continuam dimensões diferentes, inclusive nos casos de recovery com especificação pendente.

| Fase | Resultado observado | Unidade e limite |
| --- | --- | --- |
| focus-ack-02 | 8 PASS, zero FAIL/SKIP/cancelados | Oito testes; cenários forward Base/Layer não geram PASS adicionais. |
| focus-materialization-01 | 4 PASS, zero FAIL/SKIP/cancelados | Quatro testes abrangem15 fixtures/subcenários; não são15 testes PASS. |
| focus-base-origin-09 | 6 PASS, zero FAIL/SKIP/cancelados | Origem base, transições, liberação e diagnóstico independente. |
| focus-safety-06 | 17 PASS, zero FAIL/SKIP/cancelados | R-02/R-03, staging/unstage, D-04, ignore, destino e consultas. |
| focus-recovery-03 | 4 PASS de execução, exit0 | RECOVERY-001/003/014 e HARNESS-021; não certifica todo GL-19 nem encerra decisões de produto pendentes. |
| FULL14 |315 resultados: **311 PASS,0 FAIL,4 SKIP,0 cancelados**; código0/sinal nulo |183 inputs ACE17 estáveis antes/depois; recibo terminal próprio, sem soma aos focos. |
| Pipeline14 | Infra111PASS; broad355PASS/0FAIL/6ENV_BLOCKED; typecheck19/build18/smoke14 exit0; native8PASS | Pipeline completo; broad tem361 selecionados e25NOT_RUN fora da seleção. Fases e domínios são separados. |
| Cópia nova e publicação | **PENDENTE: commit, fresh, push e SHA no servidor** | [PUBLICATION](PUBLICATION.md) registrará eventos reais; teste local não representa CI remoto. |

Resultados, comandos, hashes e limites estão registrados em [RESULTS](RESULTS.md), [VALIDATION](VALIDATION.json) e [EVIDENCE](EVIDENCE.json). A [cronologia](HARNESS-HISTORY.md) preserva campanhas falhas/interrompidas. As receitas e reconstruções históricas em [REPRODUCTIONS](REPRODUCTIONS.md) distinguem fonte inicial, adaptações de harness e evidência runtime; hash privado sozinho não torna uma reprodução pública autossuficiente.

## Respostas às dez questões

1. **É seguro para uso cotidiano?** O uso continua experimental, dentro do envelope Windows e pelos fluxos gerenciados verificados. A validação integral local passou; cópias commitadas e publicação continuam pendentes, e não há proteção universal contra Git direto.
2. **Quais riscos reais permanecem?** Destruição de bytes por Git/ferramentas externas, staging nativo fora da prevenção, alterações entre verificações e recuperação incerta que exige inspeção. Não há reparo automático de histórico já misturado por versões anteriores.
3. **O que vem do Git Layer ou do Git?** As quatro famílias são erros do coordenador. Destruição/sobrescrita pelos comandos nativos mantém semântica Git; a projeção e as reservas reais ampliam os locais que o usuário precisa compreender. Não são quatro novos defeitos.
4. **O que é obrigatório antes de ampliar?** Os gates locais P0/P1 passaram no mesmo snapshot, com falhas anteriores preservadas. Ainda é preciso verificar cópias commitadas e servidor. Não aceitar estado saudável por conveniência ou ignorar journal pendente.
5. **Quais limites persistem com Git intacto?** Um programa que não consulta o mapa privado pode alterar disco, refs e índices. Não há bloqueio universal nem recuperação de bytes nunca registrados. Isso não torna inevitáveis os defeitos corrigíveis do coordenador.
6. **Qual estratégia é recomendada?** A+B: autoridade explícita e revalidação no Core, com índices/exclusões/refs/locks oficiais como mitigação limitada. Protect permanece opcional.
7. **Existe arquitetura melhor comprovada?** Nenhuma substituta foi demonstrada superior para todos os contratos. As [alternativas investigadas](../2026-11-03-security-compatibility-investigation/OPTIONS.md) podem orientar estudos opcionais; mudar organização de arquivos exige decisão específica.
8. **O que melhora segurança com menor complexidade?** Preservar origem e marcadores coerentes, tokens atuais, diagnósticos específicos e recusa conservadora; usar opção nativa de troca e reaplicação verificável de protect. O índice técnico tem custo adicional ainda sem benchmark.
9. **Quais requisitos seguem parciais?** GL-01/09/15/18/22 mantêm limites de Git direto, observação e cobertura; GL-19/20 conservam seu alcance parcial de recuperação e lifecycle/envelope. Total20 implementados+7parciais, sem reduzir os contratos aprovados.
10. **Quais decisões exigem aprovação?** Nenhuma decisão rotineira de engenharia desta etapa precisa ser repetida. Mudar protect para padrão, ampliar cópias/retenção ou recuperação automática, alterar organização do trabalho, certificar novas plataformas ou iniciar distribuição exige nova decisão; não foi feito aqui.

## Prioridades e critérios de aceitação

| Prioridade | Critério objetivo antes do encerramento | Validação exigida |
| --- | --- | --- |
| P0 — D-01 e recuperação | Nenhuma publicação/descarte em origem indevida nas rotas cobertas; falha não ressuscita autoridade; materialização incerta mantém journal/barreira; B preparado e C no disco permanecem distinguíveis. | Ownership, oito ack, quatro materialization, origem base, fronteira e recovery; Git independente, bytes/modos, índices, refs e backups. |
| P0 — D-02 | Fronteira coerente e reabrível ou recusa preservadora; presença de origem não absorvida por retry. | Escritor externo real, validador estrito, reabertura e publicação tardia. |
| P0 — D-03/D-04 | Falha de add não publica índice parcial; commit respeita o papel atualizado sob guard. | Atomic-stage, unborn, locks/escritores reais, interrupção e duas instâncias Core; MAIN e privados observados. |
| P1 — compatibilidade e diagnóstico | Troca compatível conserva Layers; colisões recusadas; ignore atual e resgate coerentes; protect distingue enabled/healthy/coverage e preserva desconhecidos. | Safety, protection, R-02/R-03, ignore dinâmico e contraprovas nativas; sem fallback inseguro. |
| P2 — evolução posterior | Medir custo e ampliar plataformas/versões mediante plano específico, mantendo os contratos. | Campanhas próprias; nenhum benchmark, Linux ou suporte universal inferido das durações atuais. |

A execução foi local Windows com Git oficial; isso não certifica todas as versões Windows/Git, Linux, topologias, intercalações, clientes ou durabilidade após perda de energia. Não houve migração de dados reais, alteração Git global, trabalho de desktop/plugins, distribuição pública ou certificação CI remota nesta etapa.
