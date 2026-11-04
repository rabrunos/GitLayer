# Histórico complementar da origem base

Este documento acrescenta a cronologia posterior ao [registro compacto anterior](BASE-ORIGIN-HISTORY.json). As contraprovas e campanhas são independentes; suas contagens não são somadas nem certificam o snapshot final.

## FULL08 e diagnóstico da demonstração

FULL08 foi interrompida após a nova variante D-01, conservando os 183 inputs ec0. Seu recibo terminal `full-08/result.json`, SHA-256 `3f0733de8467a4060145602d4ede0c718e4cf0412d768439f586a76a28653be4`, registra código 4294967295 e summary vazio. O log contém 28 PASS individuais e um FAIL da demonstração em 150330,5965 ms, sem totais Node, stack ou diagnóstico conclusivo. Os seis R02/R03 não foram alcançados. O coordenador encerrou dez processos próprios e registrou zero restantes; preflight08/pipeline08 recusaram continuar e nenhuma fase posterior iniciou.

As duas contraprovas da demonstração com orçamentos de 150 e 900 segundos passaram, com 17 verificações originais cada e criação em aproximadamente 104,8 segundos. O compacto `demo-budget-comparison08/compact.json`, SHA-256 `1ddf251bd90092d7b9e1dfab00c8f14d1c942797f2bbd33768fd257253a7a1df`, classifica a causa original como inconclusiva. O prazo próprio de 600 segundos para a criação composta e os reporters spec/TAP da preparação09 apenas ampliam orçamento e diagnóstico; não alteram o oráculo, não demonstram causa de timeout e não aprovam a FULL08. O default de 150 segundos dos demais usos do helper e os limites individuais Git permanecem iguais.

## Variante D-01: baseUnstage não deve liberar origem

A sequência confirmada foi: target a; arquivo novo B preparado no índice principal com Git oficial; C posterior em disco; status identifica interferência da base e files aponta base; Core baseUnstage; status/reabertura atribuem o caminho à Layer a; off com descarte dessa Layer remove C da projeção. Não houve release, aceite base ou resolução de transferência entre essas operações. O compacto `native-base-unstage-auto-layer-before-01/compact.json`, SHA-256 `6a96eae04731ad021567218e1352ad3b3ff488bf07c8f74c914e1c64f735ae6e`, identifica o bundle imutável `0a8c3e90a232f90f716e8936a654248fef3f5a65642fb39be27a784b0810379c`, inputs estáveis e os domínios preservados.

O efeito confirma atribuição automática indevida seguida de descarte de conteúdo de outra origem. B permanece em objeto Git e C em backup técnico do journal (SHA-256 `f38afa61095fb532a289a3074780b380c173c4f5b2ea3a853b8a65a226c791c1`); portanto não se afirma perda definitiva ou corrupção. A, B e C designam conteúdo commitado, preparado e posterior no disco; a Layer a designa uma origem independente.

O contrato da correção em preparação é conservar a origem base observada após unstage, mesmo quando o arquivo ainda não entrou em HEAD. Uma mudança deliberada de origem requer liberação ou resolução explícita separada, conforme suas pré-condições, e revisão atual. Nenhuma consulta posterior deve transferir silenciosamente esse caminho à Layer. Isso amplia D-01 e não cria D-04. Validação terminal da implementação posterior continua necessária.

## Escopo dos registros

O [histórico do harness](HARNESS-HISTORY.md) registra a interrupção e os ajustes de orçamento/reporters. Os arquivos JSON anteriores, seus campos pendentes e os anchors documentais dos writers09 permanecem intactos até a aplicação dos writers após gates próprios. Este documento não substitui recibos finais, não soma contagens e não altera fontes de produção, testes ou evidências anteriores.

## Defeito distinto D-04: instância Core com papel antigo

Os registros anteriores desta página permanecem variantes D-01 de propriedade. Posteriormente, uma contraprova separada confirmou D-04: um objeto A aberto enquanto layer/a era a branch de trabalho conservou esse papel em memória; outro objeto B voltou à main. Mesmo sem nada preparado no índice privado de a, A.commit(a) publicou B da base em refs/heads/main. MAIN continuou semanticamente com B, o novo HEAD eliminou seu diff preparado, e C no disco/ref/árvore/índice privado de a permaneceram preservados. Isso é despacho para destino diferente do solicitado, não inferência de origem nem perda permanente de bytes.

[STALE-COMMIT-BEFORE.json](STALE-COMMIT-BEFORE.json), SHA-256 `de034cc89f612ee0fd58eb4b7da39d2fee3f68246ace797553e85149c6586e6c`, conserva sequência, código, recibos e bundle imutável ec0. A correção escolhe aliases depois do guard atualizado e reutiliza helpers internos na mesma transação. O terceiro cenário novo de diagnostics exige recusa NOTHING_STAGED, HEAD/MAIN B/C preservados e commit explícito da base posterior. A validação posterior continua independente; quatro defeitos atuais são D-01, D-02, D-03 e D-04, sem converter as variantes históricas D-01 em novos defeitos.

## Variante D-01 complementar: retenção não pode decidir ambiguidade

A contraprova [AMBIGUOUS-UNSTAGE-BEFORE](AMBIGUOUS-UNSTAGE-BEFORE.json) mostrou, no snapshot histórico c7/183, que reservar automaticamente todo NEW do MAIN ao retirar staging era excessivo: um candidato de rename com ausência conhecida tornou-se base e pôde ser commitado na main sem resolução. [AMBIGUOUS-UNSTAGE-REFS](AMBIGUOUS-UNSTAGE-REFS.json) confirma A/histórico e B privado preservados, com apenas main alterada entre as refs anteriores. É uma continuação controlada, não uma segunda rodada integral nem D-04.

A retenção legítima descrita acima continua necessária para NEW sem ambiguidade e para autoridade base explícita anterior. O ajuste distingue esses casos do candidato incerto; retirar staging não é aceite nem autorização de transferência. Registros históricos e os resultados c7 permanecem anteriores ao novo patch e não atestam sua aprovação final.
