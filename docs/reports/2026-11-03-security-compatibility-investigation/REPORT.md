# Investigação de segurança e compatibilidade — 03/11/2026

## Resumo executivo

**O snapshot atual ainda não é adequado a uso cotidiano irrestrito.** O fluxo controlado pelo Core/CLI separa históricos e preparação, preserva Layers em trocas compatíveis e recusa várias colisões corretamente. Entretanto, esta investigação reproduziu **dois defeitos novos** nas operações do produto e **quatro famílias de risco no Git direto e nas reservas locais**. As famílias e suas variantes são contadas separadamente dos bypasses e limites de cobertura de `protect`; não são seis falhas independentes do Git.

Os dois defeitos merecem P0 antes de ampliar o uso: **D-01**, renomeação que acaba atribuída a outra origem durante um target; **D-02**, abertura de target concorrente com criação externa que publica uma baseline inválida e impede a reabertura normal. D-01 chegou a incorporar bytes de uma Layer no histórico de outra. D-02 preservou arquivos, refs e índices, mas tornou os metadados de edição ilegíveis para o próprio Core. Nenhuma solução foi implementada nesta rodada.

A recomendação é **fortalecer o coordenador e combinar recursos nativos com alcance explícito (A+B)**. Manter índices por origem, checkpoints e arquivos físicos no projeto; corrigir a atribuição e a captura de baseline; recusar ambiguidades; melhorar o diagnóstico. As contraprovas de `--no-overwrite-ignore` mostram uma mitigação útil para trocas. Manter `protect` **opcional** até decisão do usuário: ele impede seleção nominal comum de branches reservadas, mas não protege arquivos de Layers de uma troca para outra branch tradicional.

## Baseline, método e limites

- Checkout inicial: `main`, upstream `origin/main`, HEAD **18d26c18d0c9377141af7704bde50ee32b210465**. `ls-remote origin refs/heads/main` confirmou o mesmo SHA antes dos experimentos. Não se presumiu que o SHA fornecido fosse atual.
- Estado inicial: nenhum tracked modificado, nenhum untracked elegível, nenhum item preparado. Inventário de ignorados por raiz: `.workshop/`, `artifacts/`, `dist-core/`, `dist-debug/`, `dist/`, `node_modules/`. Foram preservados, sem limpeza nem travessia para descarte. O status inicial avisou que não podia ler o ignore global do host; os experimentos usaram configuração sintética isolada.
- Ambiente executado: Windows x64, Node v24.14.1, Git oficial **2.53.0.windows.2**, executável absoluto com argv e `shell:false`. Não houve execução Linux nesta rodada.
- Leitura: [estado anterior](../../STATUS.md), [arquitetura](../../ARCHITECTURE.md), [segurança](../../SAFETY.md), [limitações](../../LIMITATIONS.md), [contratos](../../IMPLEMENTATION-2026-11-02.md), [CLI](../../CLI.md), [fechamento](../2026-11-02-closure/REPORT.md), [27 requisitos](../2026-11-02-closure/requirements.json), [decisões originais](../../decisions/implementation-2026-11-02/README.md), fontes e testes pertinentes. Os requisitos aprovados prevalecem sobre mecanismos do protótipo e notas históricas.
- Bundles isolados foram compilados das fontes atuais, sem tocar `dist/`, `dist-debug/` ou `dist-core/` do desenvolvimento. Manifests identificam os inputs. O inventário desta rodada possui 362 arquivos versionados e um domínio funcional explícito de 172 arquivos; seu fingerprint não deve ser comparado diretamente aos domínios de 61 ou 173 arquivos do fechamento.
- Fixtures novas com marcador e nonce, fora do checkout e da demonstração. HOME/USERPROFILE/XDG, identidade, configurações global/system, temporários, editor e prompts foram isolados. Transporte experimental usou somente bare/clone locais. Não foram instalados hooks, aliases, interceptadores permanentes ou watchers.
- O oráculo independente foi o Git oficial: HEAD/branches/refs, árvores/blobs, índice principal e índices privados, bytes/ausências, reservas, journals e diagnóstico. Exit zero não foi aceito como prova de preservação.
- Houve desligamento do PC durante a investigação, informado pelo usuário. Resultados completos persistidos foram conservados; fixtures sem conclusão foram marcadas incompletas e os casos retomados em raízes novas. Isso não é teste certificado de tolerância a queda de energia. Uma configuração sintética inicial de hooks foi recusada antes dos casos; sua correção ocorreu somente no harness externo. Uma contraprova corrigiu um oráculo excessivo sobre refs técnicas, preservando a tentativa anterior.

A [matriz](MATRIX.md) e a [evidência compacta](EVIDENCE.json) identificam execuções e observações. Não se repetiu toda a suíte de 229 casos ou a broad de 361 variantes. Os resultados anteriores foram usados como cobertura histórica, sem atribuir PASS automático ao snapshot atual.

## Achados confirmados

### D-01 — Renomear pode transferir a origem para o target

**Classificação: defeito confirmado; P0; GL-09/18, com efeito em GL-01.**

Com Layer `b` escolhida como destino, renomear `base.txt` para um caminho novo e consultar o estado faz o destino ser reservado em `b`, com `safe:true`. Isso ocorreu tanto por filesystem externo quanto por `GitLayers.renameFile`, que havia retornado `owner:'base'`. Desativar `b` sem descarte recusou corretamente; autorizar o descarte de **b** removeu do disco o arquivo renomeado da **base**. Havia cópias técnicas nos journals: não se afirma perda irrecuperável nessa rota, mas o descarte autorizado para uma origem atingiu trabalho atribuído indevidamente a ela.

A variante externa `a.txt` de Layer `a` → `renamed-a.txt`, sob target `b`, confirmou o efeito mais direto: status atribuiu o novo caminho a `b`; add/commit de `b` aceitaram os bytes editados de `a`. O commit original de `a` e seus dados preparados não foram reescritos. A mistura está na origem do novo caminho no histórico de `b`.

**Causa:** candidatos são inferidos por diferença de caminhos contra `editing.before` e o mapa atual de proprietários. O novo nome não aparece em nenhum deles. `renameFile` preserva o proprietário Layer por reserva explícita, mas a rota base não conserva o novo destino como base. Uma renomeação externa não fornece ao coordenador uma declaração de intenção. Similaridade de conteúdo ou inode pode ajudar o diagnóstico, mas não prova a intenção geral e não deve decidir propriedade silenciosamente.

Fontes do snapshot: [candidatos e target](https://github.com/rabrunos/GitLayer/blob/18d26c18d0c9377141af7704bde50ee32b210465/src/core/index.ts#L223), [renameFile](https://github.com/rabrunos/GitLayer/blob/18d26c18d0c9377141af7704bde50ee32b210465/src/core/index.ts#L358). O controle `git mv` da base prepara o destino no índice principal e manteve sua origem; a renomeação gerenciada de arquivo de Layer também manteve sua origem. Isso delimita o defeito, sem condenar toda renomeação.

### D-02 — Abertura concorrente do target publica metadados inválidos

**Classificação: defeito confirmado; P0 por inconsistência persistida; GL-09/18.**

A abertura calcula `before` com uma varredura e `unassigned` com outro comando Git. Um processo externo criou `between.txt` entre essas leituras. `target('a')` retornou sucesso e persistiu `before` sem esse caminho, mas `unassigned` com ele. O carregador exige que `unassigned` seja subconjunto de `before`: status posterior e uma nova `GitLayers.open` falharam com `METADATA_INVALID`.

A contraprova foi repetida em fixture nova. A instrumentação coordenou a ordem pelo ponto de spawn de `ls-files`; lançou um processo Node externo real e não alterou fontes, respostas do Git ou metadados diretamente. Demonstra um interleaving possível, **não sua frequência natural**. O controle sem interferência abriu e reabriu normalmente. Bytes, branch, refs e índices permaneceram preservados; a indisponibilidade é do contexto persistido de edição. Não houve prova de corrupção de objetos Git.

**Causa:** duas enumerações independentes publicadas sem validar a relação que o próprio leitor exige. Fontes: [validação da baseline](https://github.com/rabrunos/GitLayer/blob/18d26c18d0c9377141af7704bde50ee32b210465/src/core/index.ts#L42), [abertura do target](https://github.com/rabrunos/GitLayer/blob/18d26c18d0c9377141af7704bde50ee32b210465/src/core/index.ts#L238). Aceitação da correção precisa incluir abertura/reabertura e semântica da fronteira temporal; apenas suprimir o erro do leitor não resolve o contrato.

### R-01 — Switch/checkout comuns podem sobrescrever uma Layer ignorada

**Classificação: risco confirmado; semântica nativa exposta pela projeção; GL-01/15.**

Uma Layer continha A commitado, B no índice privado e C no disco. A variante switch foi executada com `protect` ligado; checkout sem proteção. Uma branch tradicional de destino rastreava o mesmo caminho. `git switch develop` e `git checkout develop`, sem force, retornaram zero e substituíram C. O índice privado permaneceu preservado; o Core depois acusou `PATH_COLLISION`, já sem poder impedir a escrita externa.

O controle Git tradicional com untracked comum recusou; com untracked ignorado também sobrescreveu. Portanto o Git não mudou: o Git Layer introduz a exposição ao marcar trabalho projetado como ignorado para protegê-lo de add. O manual documenta sobrescrita de ignorados como padrão no checkout. Nos experimentos, **switch e checkout com `--no-overwrite-ignore` recusaram e conservaram C, HEAD e índice privado**. A reserva de `layer/scripts` não afeta uma troca para `develop`. [Documentação oficial de checkout](https://git-scm.com/docs/git-checkout/2.53.0).

### R-02 — Comandos destrutivos nativos atingem projeções físicas

**Classificação: risco confirmado; comportamento nativo; GL-01/15/18.**

`clean -fdx` removeu arquivos projetados e novos arquivos do target. `clean -fX` também removeu a projeção: ele apaga **somente ignorados**, justamente a classificação usada pelo produto. O controle Git ignorado teve o mesmo resultado. A versão C nunca preparada não existia como objeto nem como payload exato de backup do produto nos pares adicionais. Índice privado A/B permite recuperar o que foi persistido, não C.

`reset --hard` no HEAD atual e `restore .` restauraram a base e deixaram a projeção não rastreada nos casos sem colisão. Já `reset --hard develop`, quando a árvore de destino ocupava o caminho, substituiu C por B e avançou a branch **main** ao commit indicado; não selecionou `develop`. O controle untracked sem ignore também foi sobrescrito. `git mv -f` de arquivo da base sobre uma projeção substituiu seus bytes e gerou colisão depois. Variantes forçadas são bypass explícito; não são defeito do Git. [clean](https://git-scm.com/docs/git-clean), [reset](https://git-scm.com/docs/git-reset/2.53.0), [mv](https://git-scm.com/docs/git-mv).

`safe:true` após uma deleção representável como unstaged D significa coerência do estado observado, não prova de que nenhum conteúdo foi perdido desde a última consulta. O relatório não usa esse campo como certificação histórica de integridade.

### R-03 — Ignore de maior prioridade ou force podem colocar newcomers na base

**Classificação: risco confirmado de mistura; bypass explícito no force, precedência nativa no ignore; GL-01/09/18.**

O blanket protegeu arquivos novos antes da primeira consulta: add comum omitiu o newcomer; add de caminho explícito recusou; arquivos anteriores elegíveis continuaram preparáveis. Mas `add -f` incluiu o newcomer no índice principal. Uma negação preexistente exata em `.gitignore` também permitiu add comum e commit nativo antes da reconciliação. Nesse caso não se pode presumir intenção consciente de contornar o target.

Se o caminho já era propriedade conhecida da Layer, a contaminação foi diagnosticada. Se o Git o preparou na base antes da primeira observação, o proprietário passou a ser a base pelo índice principal; a consulta pode continuar `safe:true` e não atribuí-lo ao target. O produto não controla o índice usado por programas externos. Alterar a prioridade oficial de ignore ou esconder redirecionamento do Git não é solução compatível. Diagnóstico antecipado e política explícita para regras incompatíveis podem reduzir o risco. [gitignore](https://git-scm.com/docs/gitignore), [add](https://git-scm.com/docs/git-add).

## GL-22 — O que as reservas realmente fazem

`protect` cria worktrees reais locais, `--no-checkout`, para branches Layer locais. Seus caminhos administrativos, HEADs simbólicos e marcadores são estado adicional visível. O prefixo `layer/` continua sendo uma convenção, não um novo tipo protegido de ref.

As experiências confirmaram recusa da seleção nominal comum por switch/checkout e também efeitos sobre branch em uso, como `branch -D`/`branch -f`. `open-branch` ajustou sua própria reserva, permitiu commit Git nativo na Layer escolhida e voltou a `main` preservando outra Layer limpa. Isso é suporte verificado dentro das condições da matriz.

Há caminhos nativos fora dessa prevenção: `--ignore-other-worktrees`, seleção detached de revisão, `worktree add --force` e plumbing sobre refs. Alguns são bypass explícito; detached não seleciona a branch, portanto não deve ser chamado de falha da checagem de branch ocupada. Branch criada externamente após protect não ganha reserva por magia; `healthy:true` pode coexistir com `unprotectedLayers` não vazio. Remover reserva por fora retira a prevenção; a operação gerenciada diagnostica divergência e preserva dados desconhecidos.

Clone/fetch/push transportam commits/refs conforme o Git, não o cadastro local de proteção, índices privados ou estado de edição. Reconhecimento remoto não implica ativação nem reserva. Reaplicar proteção é uma operação local explícita. Reservas alteradas, removidas, bloqueadas ou com trabalho próprio não devem ser descartadas para fazer o diagnóstico parecer saudável. Os efeitos específicos efetivamente executados constam da matriz; topologias não exercitadas continuam não testadas. [worktree](https://git-scm.com/docs/git-worktree/2.53.0), [branch](https://git-scm.com/docs/git-branch), [fetch](https://git-scm.com/docs/git-fetch/2.53.0), [clone](https://git-scm.com/docs/git-clone).

**Decisão pendente:** manter opcional ou adotar como padrão. Recomenda-se opcional por ora: ajuda no erro comum de seleção, mas adiciona topologia, manutenção e recusas a comandos legítimos, sem resolver R-01/R-02/R-03/R-04. Não é necessário trocar o prefixo aprovado nem substituir o Git para melhorar esse mecanismo.

## R-04 — Uma reserva sem checkout pode receber commits destrutivos de conteúdo

**Classificação: risco operacional confirmado; comportamento nativo introduzido pela topologia da reserva; GL-01/22.**

`git status` dentro da reserva mostrou o conteúdo da Layer como deletado, embora os arquivos nunca tivessem sido materializados ali. Consultar status não criou índice e a reserva continuou estruturalmente saudável. Já `git -C <reserva> commit -a -m ...` retornou zero e criou na branch Layer um commit de árvore vazia. A projeção principal permaneceu intacta, e o commit pai conservou seu conteúdo; não houve corrupção ou perda irrecuperável demonstrada. O Core depois diagnosticou `PROTECTION_CONFLICT` pelo índice externo criado na reserva.

É um efeito de uma worktree Git real, relevante para ferramentas que enumerem e operem em todas as worktrees. Não é falha de `commit` nem prova de que uma reserva deva ser proibida. Exige diagnóstico, recuperação explícita e avaliação de clientes antes de mudar o default. Esse quarto risco é distinto da simples existência de `--ignore-other-worktrees`: bypasses documentados sem dano adicional não foram contados como novos defeitos.

## O que funcionou e o que permanece parcial

| Requisito | Verificado nesta investigação | Limite restante |
| --- | --- | --- |
| GL-01 | Fluxos nativos de add/commit nos casos compatíveis; índices separados; recusas/diagnóstico de contaminação conhecida. | Não há isolamento do filesystem ou roteamento obrigatório do Git externo; R-01/02/03 e efeitos das reservas. |
| GL-09 | Destino explícito, troca/encerramento, preservação de arquivos anteriores, sem stage automático. | D-01/D-02 e primeira observação contornada por ignore/force. |
| GL-15 | Troca gerenciada compatível conserva Layer staged/dirty; colisões inclusive bytes iguais são recusadas. | Git direto pode escrever antes do diagnóstico; exigência gerenciada de base tracked limpa é mais conservadora que Git. |
| GL-18 | Criação externa elegível, mudanças entre consultas, delete/recreate por caminho e regras de ignore nos casos da matriz. | Renomeação externa ambígua, janela da baseline e eventos não observados entre consultas. |
| GL-22 | Entrada/saída deliberadas, outras Layers, reserva e recusas nominais. | Bypass, refs externas, instalação local, topologias/cliente externos não universalmente controlados. |

Os seis testes atuais R-02/R-03 passaram **6/6**, zero FAIL/SKIP, exit 0. Confirmaram info/exclude, exclusões globais, .gitignore, sete controles de prioridade/negação e prévias off/remove com newcomers, sem escrita no repositório consultado. Não se reabriram esses defeitos antigos. Uma prévia continua sendo informativa: a ação revalida, e a criação de colisão depois dela foi recusada preservando o arquivo externo. Desativação normal suja recusou; descarte autorizado foi distinguido de uma confirmação comum.

**Mesmo após as melhorias propostas, os cinco requisitos permanecem parciais em seu alcance amplo enquanto o Git direto e programas externos conservarem suas opções.** Isso não reduz o requisito aprovado nem transforma um defeito corrigível em inevitável. Os fluxos gerenciados podem ganhar garantias observáveis maiores; o status global só deve mudar após implementação e campanha correspondente.

Novos `.gitignore`, `.gitattributes` e `.gitmodules` não foram atribuídos à Layer, corretamente. Entretanto, o blanket fez add nativo específico recusar exit1 durante target; após edit-end o mesmo add retornou zero. É uma limitação adicional de previsibilidade/compatibilidade, com bytes preservados, a tratar em P1; não foi contada como terceiro defeito P0.

## Respostas diretas e prioridades

1. **Seguro para uso cotidiano?** Para uso irrestrito, não. Uso experimental controlado exige cópia independente, trabalho persistido e atenção às rotas externas; os dois P0 devem ser corrigidos antes de ampliar a adoção.
2. **Riscos reais?** Atribuição/commit em origem errada, baseline ilegível, sobrescrita de ignorados e destruição de bytes nunca persistidos, além de captura nativa anterior à observação e commits com deleções dentro de reservas.
3. **Introduzidos pelo produto ou pelo Git?** D-01/D-02 são do produto. R-04 nasce da topologia de reserva acrescentada pelo produto: um commit nativo nela pode registrar deleções, preservando o pai e a projeção. O Git já sobrescreve ignorados e executa clean/reset/force. A projeção ignorada torna trabalho de Layer exposto a essas regras; o produto precisa mitigar e explicar essa combinação.
4. **Correções obrigatórias?** D-01/D-02, com regressões independentes e preservação de recuperação. Não se precisa reescrever toda a arquitetura para começar.
5. **Limites sem mudar Git?** Nenhum mapa privado impede comandos que não o consultam, opções de bypass, escrita de terceiros ou recuperação de bytes nunca copiados. Opções conservadoras e melhores recusas mitigam partes específicas.
6. **Estratégia?** A+B, conforme [OPTIONS](OPTIONS.md); C voluntária como redução de colisões, D somente protótipo separado.
7. **Alternativa arquitetural melhor?** Worktrees autoritativas com cópias projetadas podem preservar a última sincronização, mas criam reconciliação bidirecional, não eliminam a janela de trabalho só no projeto e ainda não demonstraram vantagem líquida.
8. **Maior ganho com menor complexidade?** Baseline coerente antes de publicar, origem explícita em rename gerenciado, recusa localizada de rename externo ambíguo, diagnóstico de cobertura e orientação comprovada `--no-overwrite-ignore`.
9. **Quais continuam parciais?** Os cinco, no alcance amplo; separar o envelope gerenciado da rota nativa na validação futura.
10. **O que aprovar?** Próxima implementação; política visível para ambiguidades; eventual mudança do default de protect; eventual organização voluntária ou protótipo de cópia autoritativa. Não há aprovação implícita nesta documentação.

| Prioridade | Recomendação | Aceitação objetiva e testes |
| --- | --- | --- |
| P0-1 | Preservar origem no rename e suspender atribuição ambígua. | Base→novo e Layer a→novo sob target b nunca aparecem em reservas/commit de b sem escolha explícita; rename gerenciado informa e conserva a mesma origem; off/discard de b preserva bytes alheios. Testar externo/Core, bytes iguais/diferentes, staged B/disco C, reinício e ausência+criação legítimas. |
| P0-2 | Publicar contexto de target coerente ou recusar sem alterar o anterior. | Todo sucesso reabre; `unassigned` e `before` obedecem invariantes; criação/exclusão/rename entre leituras não publicam estado inválido. Barreira determinística, estresse limitado, falha de processo, rollback e ausência de stage automático. |
| P0-3 | Reduzir a exposição de perda em R-01/R-02 e oferecer condições de uso verificadas. Documentar clean com/sem ignore e retenção de C; sem promessa de bloqueio universal. Usar opção nativa conservadora e prévia/diagnóstico preciso. | switch/checkout com opção disponível preservam bytes na colisão; comando gerenciado revalida destino/ignore/refs e não confia em prévia antiga. Testar branch/path iguais, ignorados, índices privados e concorrência. Não prometer impedir Git externo sem opção. |
| P1-2 | Explicar e diagnosticar preparação nativa fora da proteção. | Casos force/negação antes e depois de consulta têm respostas distintas e reproduzíveis; nenhuma mensagem afirma exclusividade universal. Não reatribuir silenciosamente conteúdo já no índice principal. |
| P1-3 | Mostrar cobertura real e recuperar reservas conservadoramente. | Estado separa enabled/healthy/cobertura; Layer externa ou recebida sem reserva fica explícita. Instalação/remoção idempotentes; conteúdo/índice/ref desconhecido preservados; clone/fetch/remoção externa/interrupção/bypass cobertos. Default depende decisão. |
| P1-4 | Delimitar recuperação e custo de retenção. | Diagnóstico distingue bytes commitados, staged, copiados e nunca persistidos; exportação independe da abertura normal. Testar D-02 sem editar JSON manualmente, edição posterior e preservação de backups. |
| P2 | Convenções opcionais de caminhos, clientes/plataformas adicionais e protótipo de fonte externa. | Sem migração implícita; fixtures Windows/Linux, vários Git e ferramentas worktree; comparação de segurança e custo antes de escolher arquitetura. Desempenho geral/distribuição ficam fora desta etapa. |

Não houve benchmark geral novo nem previsão numérica de ganho. Os tempos registrados são de experimentos instrumentados e concorrentes; não são SLO. As estimativas por estratégia e os testes necessários estão em OPTIONS.

## Publicação e preservação

Esta entrega publica somente documentação. A baseline funcional, o estado preparado e o remoto foram conferidos novamente antes do commit. A validação em cópia nova, revisão de arquivos/segredos, retenção externa e protocolo de publicação ficam em [VERIFICATION.json](VERIFICATION.json). O SHA final é conhecido apenas após o commit e a igualdade com o servidor é conferida depois do push; a entrega no chat fornece os permalinks definitivos. Nenhum CI remoto foi inferido de uma execução local.
