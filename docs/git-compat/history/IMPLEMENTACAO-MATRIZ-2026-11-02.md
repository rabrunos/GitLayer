# Evolução da matriz na implementação de 02/11/2026

A matriz de trabalho passou de 347 para 358 IDs: os 344 originais e os três controles de infraestrutura anteriores permanecem, e IMPL-001 a IMPL-011 acrescentam receitas dos requisitos atuais. A referência recebida não foi editada. Denominadores e scopes são calculados pelos arquivos da própria rodada; existência de uma receita não é resultado PASS.

O módulo implementation.mjs tem onze variantes IMPL e quatro variantes novas de MODEL-008. Estas usam CLI/Core reais compilados da fonte arquivada, Git oficial por caminho absoluto, transporte bare/clone local e filesystem como oráculos independentes. IMPL-010 exige reconhecimento de uma Layer remota no clone antes de criar branch local ou ativar; on deve estabelecer o fluxo local coerente. Não equivale a certificar provedores de hospedagem.

MODEL-008 preserva a expectativa histórica ampla de interrupções em todas as fronteiras. A campanha nova é explicitamente parcial: exceções tratadas depois de stage, rename, deactivate e openbranch, com inspeção nativa e recuperação. Não certifica morte abrupta, perda de energia, cada syscall ou toda concorrência externa. As evidências anteriores de mortes reais/interleavings permanecem separadas. A nota de baseResult que dizia não haver autorização para mudar produto foi atualizada para a autorização desta fase.

O snapshot do harness passou a incluir ambos .git/layers/ e .git/git-layers/ como metadados. Um controle próprio cria somente dados sintéticos do runner e confirma as duas entradas. Isso não simula Git nem certifica funcionalidade do produto.

Os controles de seleção em extensibility.test.mjs usavam MODEL-008 como um exemplo fixo de SPEC_ONLY. Depois da implementação das quatro variantes, essa hipótese deixou de ser válida. O primeiro reteste falhou e um subprocesso de seleção chegou a iniciar variantes reais, atingindo seu timeout antigo. A tentativa e os resultados parciais ficaram no log infra-matrix.log, sem contá-los como suíte aprovada. O teste agora escolhe um ID que continua efetivamente sem variantes executáveis; mantém a recusa de seleção vazia e os outros invariantes. A expectativa de seleção é a mesma, e a escolha fixa obsoleta foi removida explicitamente.

Os módulos históricos de produto ainda contêm caminhos git-layers e caracterizações de auto-park, LAYER_HEAD, exportação defeituosa e outras políticas superadas. Seus resultados anteriores são históricos; eles não foram reescritos para parecer aprovações desta implementação. Esta rodada nova não declara broad/all legado aprovado sem execução e revisão explícita de cada expectativa. As receitas IMPL testam contratos novos diretamente. Uma futura adaptação dos módulos antigos deve registrar a fonte/contrato de cada expectativa alterada e conservar a evidência anterior.

Evidências específicas: artifacts/implementation-2026-11-02/storage-rescue/. A execução interrompida tests-final.log antes do reinício do computador é INCOMPLETE, sem aprovação final. tests-post-restart.log registra a repetição concluída da suíte específica de armazenamento/resgate. O relatório principal distingue os snapshots e retestes posteriores.

## Expectativas versionadas e adaptador de fixture

O arquivo tests/git-compat/expectations-implementation-2026-11-02.json registra, por ID histórico, o contrato anterior, o requisito atual, motivo, receitas sucessoras e a relação de cobertura parcial. Não adiciona waiver em known-issues, não altera resultados anteriores e não transforma sucessores em prova de todo o cenário original. A matriz aponta para esse arquivo nas linhas afetadas.

Somente os helpers record/layerIndex de product.mjs foram adaptados para escolher layers quando presente e git-layers no legado da fixture normal. Nenhuma assertiva de estado foi mudada nessa adaptação. Isso permite que as receitas smoke de semântica inalterada encontrem os índices atuais; não revalida automaticamente receitas antigas de park, bloqueio absoluto de branch ou defeitos já corrigidos.

A ampliação do snapshot e seleção foi verificada por 16 testes de infraestrutura afetados: 16 PASS, código 0 em infra-matrix-retest.log. A tentativa anterior com duas falhas permanece separada. Os resultados do módulo de implementação serão os do runner arquivado, com fingerprints próprios, não uma soma com o resultado da infraestrutura.
