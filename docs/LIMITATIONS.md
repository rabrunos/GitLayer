# Limitações do Core/CLI e do workshop

**Etapa 2 — 04/11/2026:** [medições e recuperação](reports/2026-11-04-performance-recovery/README.md) têm execuções locais concluídas: nove pares de benchmark V9, full V9 411 PASS/quatro SKIP em 415, infraestrutura V11 113 PASS/113 e matriz V11 355 PASS/seis ENV_BLOCKED/zero FAIL em 361. Typecheck/build/smoke V9 passaram com Core/runtime/corpus equivalentes ao V11. Há ganhos e regressões observados, inclusive recover-empty sem Layers +23,019% em n3 e pioras n1 com cinco Layers. Não há promessa universal de tempo, todas as escalas, Linux ou perda real de energia. Cópia nova do commit e publicação ainda estão pendentes; duração de teste não é latência do produto.

A cópia temporária de índice usada nas consultas de worktree acrescenta leituras, cópia, recibos e verificações proporcionais ao índice; stat antigo pode exigir nova leitura de conteúdo em consultas posteriores. Ela preserva os bytes do índice vivo, sem promessa de latência universal. Falhas podem conservar um temporário completo, parcial, indisponível ou com identidade alterada: use a observação reportada e inspecione antes da limpeza manual, sem assumir que a cópia ainda exista. Esses temporários externos não entram em `recovery-export`; sua preservação exige tratamento separado. Os casos de consulta passaram na full V9, com bytes dos índices vivos preservados no alcance executado; [investigação e limites](reports/2026-11-04-performance-recovery/INDEX-QUERY.md) conservam a evidência. Isso não elimina interferência externa ou inspeção manual.

A serialização repetida do journal por arquivo, varreduras conservadoras e leitura do histórico retido continuam custos de escala. Não há expurgo automático. Troca de branch e shelves legadas ainda podem acumular snapshots base64; a redução de memória desta etapa cobre ativação/desativação normal, fingerprint, backup e restauração de backup. Reflink forçado retornou `ENOSYS` no runtime/volume NTFS medido; fallback bem-sucedido não prova CoW físico, nem o resultado exclui APIs/volumes não testados.

**Etapa 1B, preservada como histórico:** GL-01/09/15/18/22 receberam foco das correções e continuaram parciais; GL-19/20 também conservaram seu alcance parcial. O total permanece em 20 implementados e sete parciais; as novas recusas/diagnósticos estão no [relatório](reports/2026-11-03-security-compatibility-implementation/REPORT.md). D-01/D-02 não são limites inevitáveis e recebem correções específicas. A resolução de propriedade pode exigir revisão adicional quando há ausências e criações simultâneas; essa recusa conservadora não prova uma renomeação. Sequências externas inteiramente entre consultas não são reconstruídas. As novas verificações não criam isolamento ACID nem proteção universal do disco.

As exceções de arquivos anteriores são revalidadas por status/mutações que reconciliam o destino. Consultas somente leitura não reescrevem ignore; Git direto antes da reconciliação pode usar o bloco anterior. Recriar caminho antigo ausente pode exigir consulta antes do add comum.

O envelope executado deve ser consultado nos resultados desta etapa. Suporte universal de versões Git, Linux, worktrees arbitrárias, escala e recuperação ampliada não decorre dos testes Windows. Downgrade para fontes anteriores aos novos metadados de propriedade não foi certificado.

**Fase de 02/11/2026:** [novos contratos e limites](IMPLEMENTATION-2026-11-02.md) distinguem edição, abertura como branch, lifecycle, resgate e migração. GL-01/GL-22 não têm proteção universal de Git direto: `protect` usa reservas opt-in em worktrees, com bypass `--ignore-other-worktrees`; o target protege preparação nativa comum antes da observação e reconcilia propriedade nos comandos/consultas, mas force e ignore de maior prioridade continuam bypass. As seções gráficas abaixo e seus resultados são do workshop anterior, não execução desta rodada.

## Estado da entrega

**Core/CLI experimental, com requisitos parciais.** A validação usa comandos headless, Git oficial e fixtures descartáveis. As campanhas locais da [Etapa 2](reports/2026-11-04-performance-recovery/RESULTS.md) estão concluídas nos escopos e fontes identificados, com quatro SKIP da full e seis ENV_BLOCKED da matriz preservados. Cópia nova e publicação permanecem pendentes; os relatórios de [1B](reports/2026-11-03-security-compatibility-implementation/REPORT.md) e [02/11/2026](reports/2026-11-02-closure/REPORT.md) conservam seus resultados históricos, que não certificam fontes posteriores. Suporte e execução são dimensões distintas. O build `build:core` usa `dist-core/`, com Node e Git como requisitos de runtime. Não houve abertura ou desenvolvimento do laboratório nem teste gráfico nesta rodada.

### Workshop legado — distribuição e execuções históricas

As afirmações de Electron, Monaco, pacote portátil e validação gráfica abaixo descrevem o workshop anterior. O [TEST-REPORT.md](TEST-REPORT.md) conserva a procedência de suas execuções Windows; elas não certificam este snapshot do Core/CLI.

O pacote é portátil para Windows 10/11 x64, sem instalador e sem assinatura digital. Não foi produzido pacote macOS ou ARM64 nativo. Git for Windows 2.43+ era o pré-requisito histórico do laboratório. A renomeação Core/CLI atual requer a feature `--show-ref-format`, presente na fonte Git 2.44; sem ela retorna `RENAME_UNSUPPORTED`. A execução deste fechamento usou Git 2.53.0.windows.2, sem campanha runtime 2.44/2.43. Veja o [envelope GL-20 e as fontes oficiais](reports/2026-11-02-closure/REPORT.md#gl-20-preservação-nativa-e-envelope-restante). O editor usa Electron embutido; a CLI interativa do terminal Windows exige Node.js instalado 22.12+. O launcher portátil com Electron atende comandos não interativos, mas não fornece TTY para `capture`.

## Implementação existente e contrato atual

- Core compartilhado, Git CLI real, refs convencionais, índices alternativos, checkpoints alcançáveis e commits independentes com atualização condicionada ao OID anterior.
- Exclusões exatas no info/exclude, preservação de regras, detecção de negação, reservas persistentes e captura revisável legada. Shelves antigas são preservadas; o novo fluxo de desativação recusa auto-park.
- Stage/unstage por arquivo e por hunk de arquivos regulares de texto já rastreados, sem mudanças de modo. Novos/removidos, binários e patches incompatíveis exigem arquivo inteiro. Tokens obsoletos são recusados.
- Histórico de até 50 commits por chamada, detalhes e comparação. Renomear/excluir arquivos com backups.
- Troca de branch com base tracked limpa e Layers preservadas. Mudanças em .gitignore/.gitattributes podem exigir resolver pendências/desativar Layers antes da troca.
- Journals, backups e recuperação conservadora. Troca interrompida pode ser concluída quando plano, contexto, índices e arquivos continuam validáveis. Uma entrada física do workspace com BEFORE ausente e caminho atual ausente recusa com `RECOVERY_CONFLICT`/`workspace-materialization-disappeared`, inclusive sem AFTER durável ou confirmação anterior de ausência. Interrupção antes da escrita, publicação seguida de movimento externo e rollback parcial podem ser indistinguíveis. Metadados internos aprovados têm classificação estrita própria. O journal permanece pendente, pode exigir inspeção/recuperação manual e não é liberado por repetir `recover` ou resolver propriedade. Recusa tardia pode ocorrer após efeitos parciais em metadados. OID publicado não substitui validação de plano, backups, fingerprints e contexto. Veja [segurança](SAFETY.md#transações-e-recuperação); não há recuperação prometida de bytes nunca registrados.
- Integração histórica do laboratório, preservada: desktop React/Monaco, UTF-8/EOL, temas, abas, rascunhos, diff/histórico, captura, demonstração, identidade local, branches, diagnóstico e exportação conectados ao Core.
- Contrato preservado do laboratório: preload restrito, emissor IPC verificado, sandbox/contextIsolation ligados, Node desligado no renderer, CSP e bloqueio de navegação/rede.
- Busca do Git no PATH e pastas convencionais do Windows, ambiente sem duplicação Path/PATH e tratamento de separadores.
- Distribuição histórica do laboratório: CLI portátil com Node embutido, diagnóstico local e pacote .exe com DLLs, recursos, workers e licenças. O novo build Core/CLI separado usa Node instalado.

O fechamento corrigiu o mascaramento de ignore do usuário e a omissão de newcomers na prévia: [prova dirigida](evidence/closure-2026-11-02/review-target-preview.json). A consulta lógica usa Git oficial com scratch externo transitório, sem escrita no repositório inspecionado. Isso não certifica toda regra/configuração possível nem elimina bypass nativo; os resultados amplos das fontes finais pertencem ao [relatório público](reports/2026-11-02-closure/REPORT.md).

## Workshop legado — terminal e evidências históricas

Terminal integrado real node-pty/xterm, PowerShell/ConPTY no Windows, Bash/PTY para desenvolvimento no host. O catálogo contém os 33 comandos CLI, com formulário, prévia e **Copiar comando**. A execução acontece após colar e pressionar Enter manualmente. O aplicativo não é um mecanismo de tarefas.

Há testes do PowerShell/ConPTY real e do componente xterm no Electron Windows. Alterar a função prompt ou executar programas que removam o marcador da sessão pode deixar o indicador de estado desatualizado; a digitação normal continua sendo do terminal.

Apenas um repositório Git por janela, sem workspace multirroot. As fontes do workshop abrem no VS Code; debug usa sourcemaps/perfil separados. Inspectors são verificados automaticamente; a interação física com F5 e todas as combinações de extensões do usuário não equivalem a esse teste.

## Workshop legado — limites da validação gráfica histórica

Nas execuções históricas registradas, Playwright verificou a janela real, edição/commit, fronteira IPC, assets locais, indicadores e terminal. A verificação Dev cobre reinício e restauração de rascunho. Isso não certifica acessibilidade completa, DPI físico, todos os diálogos, todos os conflitos de buffers ou toda combinação de software do Windows. Consulte as execuções efetivamente concluídas no relatório.

A comparação de alteração externa usa conteúdo rotulado em leitura, sem mesclador de três vias. Binários/UTF-8 inválido são somente leitura; arquivos acima de 4 MiB não abrem para edição. Não há formatter automático. Uma morte abrupta pode perder a última alteração de buffer ainda não persistida.

## Não implementado

- Amend, criação/exclusão de tags, stash de escrita/pop, merge, cherry-pick, revert e resolução/continue/abort desses conflitos. Apenas stash-list está disponível como leitura.
- Reconciliação automática de refs/índices de Layer alterados por terceiros; mutações são suspensas com diagnóstico/exportação.
- Renomear/excluir árvores de diretórios recursivamente.
- Instalador, assinatura digital, notarização, atualizador e manual do help interceptado pelo Git.
- Isolamento ACID contra programas externos, recuperação de bytes nunca salvos ou copiados e observação contínua universal.
- Transferência de propriedade, commit conjunto e merge de Layers. Rede, rebase interativo, bisect e cliente integral de todos os subcomandos Git permanecem fora da v0.1.

## Envelope e cuidados específicos do Windows

Um worktree principal normal, não bare, HEAD simbólico tradicional ou Layer aberta deliberadamente, histórico completo e sem operações externas pendentes. Reservas de worktrees próprias de `protect` são reconhecidas; múltiplos worktrees arbitrários continuam fora do envelope certificado. Layers exigem o primeiro commit. O nome de Layer base é reservado. Todo o workspace é validado; links, hardlinks, repositórios aninhados e nomes não portáteis podem suspender o modo gerenciado mesmo em arquivos ignorados.

Symlinks/junctions reconhecidos pelo Node são recusados. Não há classificação completa de todos os reparse points de terceiros nem garantia de abertura atômica sem seguir links quando O_NOFOLLOW não existe. As verificações de lstat, links e identidade continuam ativas.

Modos Git como 100755 são preservados no índice. No Windows, permissões físicas são comparadas pelo suporte a somente leitura/gravação do Node; não há promessa de semântica chmod POSIX. core.filemode=false não registra mudanças físicas de executabilidade. Transformações nativas LF/CRLF são suportadas; filtros/LFS e conversões por código externo são recusados.

Arquivos somente leitura ou bloqueados por outro processo podem impedir substituição. Há tentativas curtas para gravações privadas do desktop, sem fallback destrutivo. Limites de caminho e políticas do Windows continuam se aplicando. Prefira pasta local curta, sem sincronizador concorrente.

Unicode NFC, caixa, equivalências por componentes e nomes reservados portáteis são validados; nenhuma renomeação silenciosa é feita. .gitignore, .gitattributes e .gitmodules pertencem à base. Hooks/assinatura, fsmonitor externo, split/sparse index, alternates, replace refs e filtros externos são recusados.

Journals JSON e shelves legadas têm limite de 64 MiB. Backups, shelves, refs de recuperação e rascunhos não têm expurgo automático nem criptografia. As escalas efetivamente medidas e seus limites pertencem ao [relatório da Etapa 2](reports/2026-11-04-performance-recovery/BENCHMARKS.md); os dois endpoints de 10.000 arquivos terminaram TIMEOUT_OWNED, sem on/off completos ou delta nessa escala. Não houve corte real de energia nem cobertura de todos os casos de interferência externa. RECOVERY-003 mantém product_status PENDING_PRODUCT_SPEC: o stage pode concluir após avanço externo de ref, preservando ref/índice e deixando diagnóstico stale posterior; seu PASS de caracterização não é serialização universal. A próxima fase de preparação pública pode avançar com esses limites explícitos; prontidão pública ampla ainda não foi atestada. Locks preexistentes ou cuja posse não possa ser comprovada são preservados. Locks temporários criados e comprovadamente pertencentes à operação podem ser publicados ou removidos pelo protocolo descrito em [segurança](SAFETY.md).

## Histórico

O relatório e as limitações da edição 0.1.0 foram preservados em history/. Seus resultados Linux e falhas de ambiente são históricos e não certificam Windows. As fixtures atuais usam os.tmpdir() em diretórios exclusivos, mantendo as asserções e a recusa de destinos que surjam após a validação.
