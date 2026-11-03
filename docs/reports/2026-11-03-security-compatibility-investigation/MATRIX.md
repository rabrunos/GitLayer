# Matriz da investigação

Baseline `18d26c18d0c9377141af7704bde50ee32b210465`; Windows x64, Git 2.53.0.windows.2. **69 registros completos / 68 IDs**, sendo 63 registros experimentais novos e seis testes existentes reexecutados. A corrida tem duas fixtures no conjunto principal. Uma validação adicional do reprodutor portátil fica no protocolo de verificação, sem ser somada a estes registros.

Execução concluída descreve a experiência, não PASS de uma proteção. As duas causas de defeito e quatro famílias de risco têm várias variantes. Recusas, bypasses, suporte, comportamento nativo e limitações continuam dimensões distintas. Cada linha liga à evidência estruturada pelo mesmo ID em [EVIDENCE.json](EVIDENCE.json); [MATRIX.json](MATRIX.json) contém o índice legível por máquina. SHA-256 e tamanho identificam o log detalhado privado preservado, sem exigir esse log para entender o resultado.

| ID | Comando/entrada | Resultado e classificação |
| --- | --- | --- |
| add-dot | git add . | Funcionalidade suportada — Só old.txt anterior elegível entra na base; newcomer protegido e depois reservado a a. |
| add-all | git add -A | Funcionalidade suportada — Só old.txt anterior elegível entra na base; índices de Layers separados. |
| add-explicit | git add -- new.txt | Recusa segura — Exit1; novo arquivo ignorado não entra no índice principal. |
| add-force | git add -f -- new.txt | Bypass explícito / R-03 — Newcomer entra na base antes da observação; status safe:true e sem reserva do target. |
| pre-staged-commit | git commit -m ... | Funcionalidade suportada — Commit usa base.txt B já preparado; novo arquivo do target permanece fora da árvore base. |
| restore-dot | git restore . | Comportamento nativo — Base restaurada; projeção e newcomer preservados neste caso sem colisão. |
| restore-layer | git restore -- a.txt | Recusa nativa — Exit1: projeção não pertence ao índice principal; bytes preservados. |
| reset-hard | git reset --hard | Comportamento nativo — HEAD atual: base restaurada, projeção não rastreada preservada; não generalizar para destino conflitante. |
| clean-fd | git clean -fd | Comportamento nativo — Ignorados da Layer/target preservados no caso testado. |
| clean-fdx | git clean -fdx | Risco confirmado / R-02 — Ignorados da Layer e newcomer removidos; deleções podem continuar representáveis com safe:true. |
| mv-base | git mv base.txt moved.txt | Funcionalidade nativa suportada — Destino preparado no índice principal conserva origem base. |
| mv-layer | git mv a.txt moved.txt | Recusa nativa — Exit128: projeção não é fonte rastreada no índice principal; bytes preservados. |
| rm-base | git rm base.txt | Comportamento nativo — Remove e prepara exclusão da base; Layer preservada. |
| rm-layer | git rm a.txt | Recusa nativa — Exit128: caminho não pertence ao índice principal. |
| rm-layer-force | git rm -f a.txt | Recusa nativa — Mesmo force não faz rm operar em caminho não rastreado no índice usado. |
| mv-force-layer-over-base | git mv -f mover.txt a.txt | Bypass explícito / R-02 — Substitui projeção e prepara destino na base; Core depois PATH_COLLISION. |
| force-contamination-known | git add -f a.txt; git commit | Bypass explícito / R-03 — Caminho já conhecido contamina base; diagnóstico e off recusado; commit nativo continua sendo Git. |
| preview-stale-collision | Core preview on; escrita externa; on | Recusa segura — Arquivo externo posterior à prévia é preservado e ativação recusada. |
| preview-later-newcomer | Core preview off; criação externa; off | Recusa segura — Nova pendência depois da prévia é revalidada; off normal preserva ambos newcomers. |
| control-clean-fdx | Git controle: clean -fdx | Comportamento nativo — Remove untracked também no controle sem Layers. |
| control-restore | Git controle: restore . | Comportamento nativo — Restaura base e conserva untracked. |
| control-reset-hard | Git controle: reset --hard | Comportamento nativo — HEAD atual conserva untracked sem colisão. |
| native-preexisting-negation | .gitignore !new.txt; git add -A; git commit | Risco confirmado / R-03 — Negação preexistente permite add comum antes da observação; blob vai para base, safe:true. |
| S01-switch-layer-dirty | git switch develop (protect ligado) | risco confirmado; comportamento nativo Git — Exit0; C vira bytes develop; private B preservado; Core PATH_COLLISION depois. |
| S02-checkout-layer-dirty | git checkout develop | risco confirmado; comportamento nativo Git — Exit0; C sobrescrito; private preservado; Core PATH_COLLISION depois. |
| S03-switch-no-overwrite | git switch --no-overwrite-ignore develop | recusa segura — Exit1; C, HEAD e índices preservados; Core safe:true. |
| S04-checkout-no-overwrite | git checkout --no-overwrite-ignore develop | recusa segura — Exit1; C, HEAD e índices preservados; Core safe:true. |
| S05-control-untracked | Git controle: switch develop | recusa segura — Untracked não ignorado: recusa, C preservado. |
| S06-control-ignored | Git controle ignored: switch develop | risco confirmado; comportamento nativo Git — Exit0; C sobrescrito como na projeção; semântica nativa. |
| S07-managed-switch | Core switch develop (recusa); switch compatible | funcionalidade suportada e recusa segura — Bytes idênticos em origens distintas recusam; troca compatível conserva active, staged B/unstaged C. |
| S08-protect-native-entry | protect; switch/checkout; branch -D/-f | funcionalidade suportada: recusa nativa nominal — Switch/checkout128, delete1, force-branch128; snapshots materiais preservados. |
| S09-deliberate-entry-exit | protect; open-branch; git commit; switch main | funcionalidade suportada — Outra Layer limpa permanece; commit na origem selecionada; reservas recompostas, safe:true. |
| S10-checkout-bypass | git checkout --ignore-other-worktrees layer/scripts | bypass explícito — Exit0; seleciona Layer; Core EXPLICIT_LAYER_REQUIRED depois. |
| S11-detached-bypass | git switch --detach layer/scripts | comportamento nativo Git; seleção explícita de revisão — Acessa revisão sem selecionar branch; Core DETACHED_HEAD. |
| S12-worktree-force | git worktree add --force ... layer/scripts | bypass explícito e recusa gerenciada segura — Exit0; outra worktree na branch; Core MULTIPLE_WORKTREES. |
| S13-reservation-status | git -C <reserva> status --porcelain | observação de compatibilidade — Mostra D scripts.txt sem criar índice; inspeção healthy:true. |
| S14-external-layer | git branch layer/external; switch layer/external | limitação documentada: proteção local por branch existente — Nova branch sem reserva; healthy/safe:true e unprotected preenchido; seleção0, Core EXPLICIT_LAYER_REQUIRED. |
| S15-reservation-remove | worktree remove --force <reserva>; protect | bypass externo com diagnóstico e recomposição explícita — Remoção0 retira proteção; Core PROTECTION_CONFLICT; protect recompõe explicitamente. |
| S16-reservation-ref-delete | git update-ref -d refs/heads/layer/scripts; unprotect | mutação externa de ref e recusa segura — Plumbing remove ref apesar da reserva; unprotect recusa e preserva worktree/objeto. |
| S17-native-rename-reservation | git branch -m layer/scripts ... | mutação externa e recusa segura — Rename nativo muda HEAD da reserva; marcador diverge; recusa conservadora. |
| S18-local-transport | push; clone --no-local; fetch (bare local) | funcionalidade suportada; reservas locais não são transportadas — Históricos/refs viajam, reservas não; clone reconhece sem ativar; seleção tracking nativa possível. |
| S19-identical-layer-origins | Core on de duas Layers com mesmo caminho/bytes | recusa segura — PATH_COLLISION; bytes/HEAD/index/refs heads preservados; refs técnicas novas explicitadas. |
| S20-commit-in-reservation | git -C <reserva> commit -a -m ... | risco operacional nativo em worktree de reserva real — Exit0; commit de árvore vazia na Layer; projeção e pai preservados; Core PROTECTION_CONFLICT. |
| EDIT-BASE-RENAME-EXTERNAL | edit b; fs.rename base; status; off b; discard b | DEFECT_CONFIRMED / D-01 — Defeito confirmado: D-01 |
| EDIT-BASE-RENAME-GIT-MV | edit b; git mv base.txt renamed-base.txt; status; off b | VERIFIED_SUPPORTED_WITHIN_CASE — Destino preparado no índice principal, sem reserva em b; bytes preservados; controle nativo. |
| EDIT-BASE-RENAME-MANAGED | edit b; Core.renameFile base; status; discard b | DEFECT_CONFIRMED / D-01 — Defeito confirmado: D-01 |
| EDIT-BOUNDARY-RACE | target a; criação externa na fronteira walk/ls-files; open | DEFECT_CONFIRMED / D-02 — Defeito confirmado: D-02 |
| EDIT-BOUNDARY-RACE | target a; criação externa na fronteira walk/ls-files; open | DEFECT_CONFIRMED / D-02 — Defeito confirmado: D-02 |
| EDIT-DEFAULT-AND-BASELINE-CONTROL | git add .; commit (0→1→2 ativas); target; open | VERIFIED_SUPPORTED_WITHIN_CASE — Só native-N na base, editingTarget null e safe:true; target sem corrida reabre válido. |
| EDIT-RESERVATION-RECREATE | target a; criar/status; delete; target b; recriar; status | VERIFIED_SUPPORTED_WITHIN_CASE — new.txt continua reservado a a depois de recriar sob target b. |
| EDIT-IGNORE-AFTER-RESERVATION | status reserva; .gitignore ignora; off | VERIFIED_SUPPORTED_WITHIN_CASE — Reserva mantida; off sem descarte recusa LAYER_DIRTY; bytes preservados. |
| EDIT-IGNORE-CHANGE | *.cache; edit; criar new.cache; remover regra; status/end/add | VERIFIED_SUPPORTED_WITHIN_CASE — Só new.cache novo reservado; old.cache anterior fica base; sem captura retroativa. |
| EDIT-LAYER-RENAME-EXTERNAL | edit b; fs.rename a; status; add b; commit b | DEFECT_CONFIRMED / D-01 — Defeito confirmado: D-01 |
| EDIT-LAYER-RENAME-MANAGED | edit b; renameFile(a.txt, renamed-a.txt); add b | VERIFIED_SUPPORTED_WITHIN_CASE — Origem a preservada; add b recusa OWNERSHIP; controle gerenciado. |
| EDIT-NEW-CONTROL-GITATTRIBUTES | criar .gitattributes; add específico; edit-end; repetir add | NATIVE_REFUSAL_CAUSED_BY_MANAGED_EXCLUDE — Sem reserva Layer; add exit1 durante target, exit0 depois; bytes preservados. |
| EDIT-NEW-CONTROL-GITIGNORE | criar .gitignore; add específico; edit-end; repetir add | NATIVE_REFUSAL_CAUSED_BY_MANAGED_EXCLUDE — Sem reserva Layer; add exit1 durante target, exit0 depois; bytes preservados. |
| EDIT-NEW-CONTROL-GITMODULES | criar .gitmodules; add específico; edit-end; repetir add | NATIVE_REFUSAL_CAUSED_BY_MANAGED_EXCLUDE — Sem reserva Layer; add exit1 durante target, exit0 depois; bytes preservados. |
| EDIT-OLD-DELETE-RECREATE | old anterior; edit; delete/status/recriar; add | VERIFIED_SUPPORTED_WITHIN_CASE — Caminho anterior continua só na base; conteúdo novo do mesmo caminho não é capturado. |
| EDIT-TARGET-BOUNDARIES | edit a; criar one; edit b; criar two; end; criar normal; add | VERIFIED_SUPPORTED_WITHIN_CASE — one:a, two:b; old anterior e normal posterior entram só na base. |
| extra-clean-X-layer | git clean -fX | Risco confirmado / R-02; controle nativo — clean -fX remove C ignorado; privado/metadados preservados; C sem objeto/backup. |
| extra-clean-X-control | git clean -fX | Risco confirmado / R-02; controle nativo — clean -fX remove C ignorado; privado/metadados preservados; C sem objeto/backup. |
| extra-reset-collision-layer | git reset --hard develop | Risco confirmado / R-02; controle nativo — reset --hard develop substitui C, main avança; privado preservado; C sem objeto/backup. |
| extra-reset-collision-control | git reset --hard develop | Risco confirmado / R-02; controle nativo — reset --hard develop substitui C, main avança; privado preservado; C sem objeto/backup. |
| R02 native ignore evaluation preserves negations, hierarchy and last-rule priority | node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts | Teste atual passou; envelope da asserção — Teste existente inalterado; retorno exit0 do arquivo com 6 PASS, zero FAIL/SKIP. |
| R02 target preserves ignored intention from gitignore | node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts | Teste atual passou; envelope da asserção — Teste existente inalterado; retorno exit0 do arquivo com 6 PASS, zero FAIL/SKIP. |
| R02 target preserves ignored intention from global | node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts | Teste atual passou; envelope da asserção — Teste existente inalterado; retorno exit0 do arquivo com 6 PASS, zero FAIL/SKIP. |
| R02 target preserves ignored intention from info | node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts | Teste atual passou; envelope da asserção — Teste existente inalterado; retorno exit0 do arquivo com 6 PASS, zero FAIL/SKIP. |
| R03 preview off includes target newcomers without synchronizing metadata | node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts | Teste atual passou; envelope da asserção — Teste existente inalterado; retorno exit0 do arquivo com 6 PASS, zero FAIL/SKIP. |
| R03 preview remove includes target newcomers without synchronizing metadata | node --import tsx --test --test-concurrency=1 --test-timeout=180000 tests/integration/review-target-preview.test.ts | Teste atual passou; envelope da asserção — Teste existente inalterado; retorno exit0 do arquivo com 6 PASS, zero FAIL/SKIP. |

## Não executado e hipóteses

- Execução Linux nesta rodada
- Outras versões Git/Windows e clientes gráficos arbitrários
- Durabilidade em perda real de energia
- Escritas externas adversariais contínuas
- Troca da ref destino precisamente entre resolução do OID e switch interno por nome
- Combinações worktree prune/repair/move/lock não presentes nos casos executados
- Desempenho geral e distribuição pública

As tentativas de harness/host interrompidas estão identificadas em EVIDENCE.json. Não foram convertidas em skip ou sucesso do produto. A correção de um oráculo de experimento sobre refs técnicas está preservada; os testes existentes não foram alterados.

## Cobertura anterior consultada

[Fechamento](../2026-11-02-closure/REPORT.md), [matriz dos requisitos](../2026-11-02-closure/requirements.json), testes product-v1, branch-protection, review-target-preview, core e recovery. Full anterior:229/225PASS/4SKIP; broad anterior:361/355PASS/6ENV_BLOCKED. Esses números são históricos, não o resultado desta seleção nem certificação de toda variante nativa.
